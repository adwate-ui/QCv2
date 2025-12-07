import { supabase, isSupabaseConfigured } from './supabase';
import { User, Product } from '../types';

// Robust Base64 to Blob converter (Pure JS, no fetch)
const base64ToBlob = (base64: string): Blob => {
  try {
    const arr = base64.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error("Blob conversion failed", e);
    throw new Error("Failed to process image data");
  }
};

// Helper to convert Blob (from download) to Base64 for App use
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export class DBService {
  
  async connect(): Promise<void> {
    if (!isSupabaseConfigured()) return Promise.resolve();
    return Promise.resolve();
  }

  // --- USER METHODS ---

  async saveUser(user: User) {
    if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error("No authenticated user session found");

    console.log("Saving user profile for:", authUser.id);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.id,
        email: user.email,
        gemini_api_key: user.apiKey
      });

    if (error) {
        console.error("Save User Error:", error);
        throw new Error("Database error: " + error.message);
    }
  }

  async getUser(email: string): Promise<User | undefined> {
    if (!isSupabaseConfigured()) return undefined;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return undefined;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile:", error);
    }

    return {
      email: authUser.email || email,
      passwordHash: 'supbase-managed', 
      apiKey: data?.gemini_api_key
    };
  }

  async deleteUser(email: string) {
    if (!isSupabaseConfigured()) return;

    try {
        const { error: rpcError } = await supabase.rpc('delete_own_account');
        
        if (rpcError) {
            console.warn("RPC delete_own_account failed. Falling back to manual data cleanup. Error:", rpcError.message);
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                // Delete in specific order to avoid foreign key constraint issues
                await supabase.from('qc_reports').delete().eq('user_id', authUser.id);
                await supabase.from('qc_batches').delete().eq('user_id', authUser.id);
                await supabase.from('images').delete().eq('user_id', authUser.id);
                await supabase.from('products').delete().eq('user_id', authUser.id);
                await supabase.from('profiles').delete().eq('id', authUser.id);
            }
        }
    } catch (e) {
        console.error("Partial failure during deleteUser:", e);
    }
    
    await supabase.auth.signOut();
  }
  
  // --- PRODUCT METHODS ---

  async saveProduct(product: Product) {
    if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");

    // Inject reference IDs into profile for storage
    // This allows them to be retrieved efficiently in getProducts list view
    const profileForDb = {
        ...product.profile,
        _referenceImageIds: product.referenceImageIds
    };

    const { error: prodError } = await supabase
      .from('products')
      .upsert({
        id: product.id,
        user_id: user.id,
        profile: profileForDb,
        created_at: product.createdAt,
        creation_settings: product.creationSettings
      });
    
    if (prodError) throw prodError;

    // Handle Reports - Delete existing and re-insert
    await supabase.from('qc_reports').delete().eq('product_id', product.id);
    
    if (product.reports && product.reports.length > 0) {
        const reportsPayload = product.reports.map(r => ({
            id: r.id,
            product_id: product.id,
            user_id: user.id,
            data: r,
            created_at: r.generatedAt
        }));
        const { error: repError } = await supabase.from('qc_reports').insert(reportsPayload);
        if (repError) throw repError;
    }

    // Handle Batches
    await supabase.from('qc_batches').delete().eq('product_id', product.id);

    if (product.qcBatches && product.qcBatches.length > 0) {
        const batchesPayload = product.qcBatches.map(b => ({
            id: b.id,
            product_id: product.id,
            user_id: user.id,
            timestamp: b.timestamp,
            image_ids: b.imageIds
        }));
        const { error: batchError } = await supabase.from('qc_batches').insert(batchesPayload);
        if (batchError) throw batchError;
    }
  }

  async getProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured()) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: productsData, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
        console.error(error);
        return [];
    }

    const { data: reportsData } = await supabase.from('qc_reports').select('*').eq('user_id', user.id);
    const { data: batchesData } = await supabase.from('qc_batches').select('*').eq('user_id', user.id);

    return productsData.map((p: any) => {
        const prodReports = reportsData 
            ? reportsData.filter((r: any) => r.product_id === p.id).map((r: any) => r.data)
            : [];
        
        const prodBatches = batchesData
            ? batchesData.filter((b: any) => b.product_id === p.id).map((b: any) => ({
                id: b.id,
                timestamp: b.timestamp,
                imageIds: b.image_ids
            }))
            : [];

        let profile = p.profile;
        let refIds: string[] = [];
        
        // Extract reference IDs from profile
        if (profile._referenceImageIds) {
            refIds = profile._referenceImageIds;
            delete profile._referenceImageIds;
        }

        return {
            id: p.id,
            profile: profile,
            referenceImageIds: refIds,
            qcBatches: prodBatches,
            reports: prodReports,
            createdAt: parseInt(p.created_at),
            creationSettings: p.creation_settings
        };
    });
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const products = await this.getProducts();
    return products.find(p => p.id === id);
  }

  async deleteProduct(productId: string) {
    if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
    
    const product = await this.getProduct(productId);
    if (!product) {
      console.warn(`Product with ID ${productId} not found for deletion.`);
      return;
    }
  
    // Delete all associated images from Supabase Storage
    const imageIdsToDelete = [
      ...product.referenceImageIds,
      ...product.qcBatches.flatMap(batch => batch.imageIds)
    ];
  
    // Use a Set to ensure we don't try to delete the same image ID twice
    const uniqueImageIds = [...new Set(imageIdsToDelete)];
  
    for (const imageId of uniqueImageIds) {
      try {
        await this.deleteImage(imageId);
      } catch (error) {
        // Log the error but continue trying to delete other images and the product itself
        console.error(`Failed to delete image with ID ${imageId}:`, error);
      }
    }
  
    // After deleting associated images, delete the product from the 'products' table.
    // Supabase is configured with cascading deletes, so associated qc_batches and qc_reports
    // for this product will be deleted automatically.
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
  
    if (error) {
      console.error(`Error deleting product with ID ${productId}:`, error);
      throw new Error(`Database error: ${error.message}`);
    }
  
    console.log(`Product with ID ${productId} and all its associated data has been deleted.`);
  }

  // --- IMAGE METHODS ---

  async saveImage(id: string, base64: string) { 
    if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Login required");

    const blob = base64ToBlob(base64); // Updated to sync version
    const filePath = `${user.id}/${id}`;
    
    // Attempt upload
    const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) {
      console.error("Storage Upload Error:", uploadError);

      if (uploadError.message.includes("Bucket not found")) {
        throw new Error("Supabase bucket 'images' not found. Please create a public bucket named 'images' in your Supabase Dashboard -> Storage.");
      }
      
      // RLS or Permission errors
      if (uploadError.message.includes("row-level security") || uploadError.message.includes("Permission denied") || uploadError.message.includes("new row violates")) {
        throw new Error("Permission denied. Go to Supabase Dashboard -> Storage -> Policies. Add a policy for 'images' bucket to allow 'SELECT', 'INSERT', and 'UPDATE' for authenticated users.");
      }
      
      throw uploadError;
    }

    // Save record to images table (linking the ID to the path)
    const { error: dbError } = await supabase
        .from('images')
        .upsert({
            id: id,
            user_id: user.id,
            storage_path: filePath
        });

    if (dbError) throw dbError;
  }

  async getImage(id: string): Promise<string | undefined> { 
    if (!isSupabaseConfigured()) return undefined;
    
    // First get path from DB
    const { data, error } = await supabase
        .from('images')
        .select('storage_path')
        .eq('id', id)
        .single();
    
    if (error || !data) return undefined;

    // Download from Storage
    const { data: blob, error: dlError } = await supabase.storage
        .from('images')
        .download(data.storage_path);

    if (dlError || !blob) return undefined;

    return await blobToBase64(blob);
  }
}

export const db = new DBService();