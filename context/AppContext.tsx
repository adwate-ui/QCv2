import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Product, AppSettings, ModelTier, ExpertMode, BackgroundTask, QCBatch } from '../types';
import { db } from '../services/db';
import { supabase } from '../services/supabase';
import { identifyProduct, runQCAnalysis, runFinalQCAnalysis } from '../services/geminiService';
import { generateUUID } from '../services/utils';
import { generateComparisonImage } from '../services/comparisonImageService';

interface AppContextType {
  user: User | null;
  loading: boolean;
  products: Product[];
  settings: AppSettings;
  tasks: BackgroundTask[];
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  register: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  updateApiKey: (key: string) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  toggleModelTier: () => void;
  toggleExpertMode: () => void;
  refreshProducts: () => Promise<void>;
  startIdentificationTask: (apiKey: string, images: string[], url: string | undefined, settings: AppSettings) => void;
  startQCTask: (apiKey: string, product: Product, qcImages: string[], settings: AppSettings, qcUserComments: string) => void;
  finalizeQCTask: (apiKey: string, task: BackgroundTask, userComments: string) => void;
  dismissTask: (taskId: string) => void;
  bulkDeleteProducts: (ids: string[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    modelTier: ModelTier.FAST,
    expertMode: ExpertMode.NORMAL
  });
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  useEffect(() => {
    // This function runs once on initial app load.
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profileUser = await db.getUser(session.user.email!);
          setUser(profileUser || { email: session.user.email!, passwordHash: '', apiKey: '' });
          await loadProducts();
        } else {
          setUser(null);
          setProducts([]);
        }
      } catch (error) {
        console.error("Error checking initial session:", error);
        setUser(null);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // This listener handles auth changes that happen *after* the initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (!user || user.email !== session.user.email) {
          db.getUser(session.user.email!).then(profileUser => {
            setUser(profileUser || { email: session.user.email!, passwordHash: '', apiKey: '' });
          });
        }
      } else {
        setUser(null);
        setProducts([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadProducts = async () => {
    const prods = await db.getProducts();
    setProducts(prods.sort((a, b) => b.createdAt - a.createdAt));
  };

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
        console.error("Login Error:", error.message);
        return { success: false, message: error.message };
    }
    return { success: true };
  };

  const register = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password: pass,
    });
    
    if (error) {
        console.error("Signup Error:", error.message);
        return { success: false, message: error.message };
    }
    
    if (data.user && !data.session) {
      alert("Registration successful! Please check your email to confirm your account.");
      return { success: true, message: "Please confirm email" };
    }
    
    return { success: true };
  };

  const updateApiKey = async (key: string) => {
    if (!user) return;
    const updated = { ...user, apiKey: key };
    try {
        await db.saveUser(updated);
        setUser(updated);
    } catch (e: any) {
        console.error("Failed to save key", e);
        throw e; // Re-throw so UI can display error
    }
  };

  const addProduct = async (product: Product) => {
    await db.saveProduct(product);
    await loadProducts();
  };

  const updateProduct = async (product: Product) => {
    await db.saveProduct(product);
    await loadProducts();
  };

  const deleteProduct = async (productId: string) => {
    await db.deleteProduct(productId);
    setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
  };

  const bulkDeleteProducts = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    await db.bulkDeleteProducts(ids);
    setProducts(prev => prev.filter(p => !ids.includes(p.id)));
  };

  const logout = async () => {
    setUser(null);
    setProducts([]);
    setTasks([]);
    
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.error("Signout error (ignored for UX):", e);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    
    try {
        await db.deleteUser(user.email);
    } catch (e: any) {
        console.error("Backend delete failed:", e);
    } finally {
        setUser(null);
        setProducts([]);
        try {
            await supabase.auth.signOut();
        } catch (ignored) {}
        
        window.location.href = '/'; 
    }
  };

  const toggleModelTier = () => {
    setSettings(p => ({
      ...p,
      modelTier: p.modelTier === ModelTier.FAST ? ModelTier.DETAILED : ModelTier.FAST
    }));
  };

  const toggleExpertMode = () => {
    setSettings(p => ({
      ...p,
      expertMode: p.expertMode === ExpertMode.NORMAL ? ExpertMode.EXPERT : ExpertMode.NORMAL
    }));
  };

  const startIdentificationTask = (apiKey: string, images: string[], url: string | undefined, settings: AppSettings) => {
    const taskId = generateUUID();
    const task: BackgroundTask = {
        id: taskId,
        type: 'IDENTIFY',
        status: 'PROCESSING',
        createdAt: Date.now(),
        meta: {
            title: 'Product Identification',
            subtitle: url || (images.length > 0 ? `${images.length} images` : 'No input'),
            images,
            url,
            settings
        }
    };
    setTasks(prev => [task, ...prev]);

    identifyProduct(apiKey, images, url, settings)
        .then(async (profile) => {
            let finalImages = images;
            if (images.length === 0 && profile.imageUrls && profile.imageUrls.length > 0) {
                // If no images were provided, but the model returned some, fetch and save them.
                const proxyBase = (import.meta as any).env?.VITE_IMAGE_PROXY_URL || '';
                const fetchedImages = await Promise.all(
                    profile.imageUrls.slice(0, 5).map(async (imageUrl) => {
                      try {
                        const fetchUrl = proxyBase ? `${proxyBase.replace(/\/$/, '')}/proxy-image?url=${encodeURIComponent(imageUrl)}` : imageUrl;
                        const response = await fetch(fetchUrl);
                        if (!response.ok) {
                          console.debug('Image fetch failed', fetchUrl, response.status, response.statusText);
                          return null;
                        }
                        const blob = await response.blob();
                        return new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onloadend = () => resolve(reader.result as string);
                          reader.onerror = reject;
                          reader.readAsDataURL(blob);
                        });
                      } catch (error) {
                        console.error(`Failed to fetch image from URL ${imageUrl}:`, error);
                        return null;
                      }
                    })
                  );
                finalImages = fetchedImages.filter(Boolean) as string[];
            }
            
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED', result: profile, meta: { ...t.meta, images: finalImages } } : t));
        })
        .catch(err => {
            console.error("ID Task Failed", err);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'FAILED', error: err.message || "Identification failed" } : t));
        });
  };

  const startQCTask = async (apiKey: string, product: Product, qcImages: string[], settings: AppSettings, qcUserComments: string) => {
    const taskId = generateUUID();
    const task: BackgroundTask = {
       id: taskId,
       type: 'QC',
       status: 'PROCESSING',
       createdAt: Date.now(),
       meta: {
           title: `QC Inspection: ${product.profile.name}`,
           subtitle: 'Generating Preliminary Report...',
           targetId: product.id,
           images: qcImages,
           settings: settings
       }
   };
   setTasks(prev => [task, ...prev]);

   (async () => {
     try {
       const newImageIds = await Promise.all(
         qcImages.map(async (img) => {
           const id = generateUUID();
           await db.saveImage(id, img);
           return id;
         })
       );

       const batches = product.qcBatches || [];
       const previousBatchIds = batches.flatMap(b => b.imageIds);
       const previousImages = await Promise.all(previousBatchIds.map(id => db.getImage(id)));
       const validPrevImages = previousImages.filter(Boolean) as string[];
       const allQCRawImages = [...validPrevImages, ...qcImages];
       const allQCImageIds = [...previousBatchIds, ...newImageIds];

       const refImageIds = product.referenceImageIds || [];
       const refImages = await Promise.all(refImageIds.map(id => db.getImage(id)));
       const validRefImages = refImages.filter(Boolean) as string[];

       const refImagesAsBase64 = await Promise.all(
         validRefImages.map(async (url) => {
           try {
             const response = await fetch(url);
             if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
             const blob = await response.blob();
             return new Promise<string>((resolve, reject) => {
               const reader = new FileReader();
               reader.onloadend = () => resolve(reader.result as string);
               reader.onerror = reject;
               reader.readAsDataURL(blob);
             });
           } catch (error) {
             console.error(`Could not convert image URL ${url} to base64:`, error);
             return ''; 
           }
         })
       );
       const validRefImagesAsBase64 = refImagesAsBase64.filter(Boolean);

       const preliminaryReport = await runQCAnalysis(apiKey, product.profile, validRefImagesAsBase64, allQCRawImages, allQCImageIds, settings, qcUserComments);

       // Generate comparison images for each QC image
       const sectionComparisons: Record<string, { authImageId?: string; diffImageId?: string; diffScore?: number }> = {};
       
       // Generate a comparison image for each QC image against the first reference image
       if (validRefImages.length > 0 && allQCRawImages.length > 0) {
         try {
           for (let i = 0; i < allQCRawImages.length; i++) {
             const qcImageSrc = allQCRawImages[i];
             const refImageSrc = validRefImages[0]; // Use first reference image
             
             // Generate side-by-side comparison
             const comparisonImageData = await generateComparisonImage(refImageSrc, qcImageSrc);
             
             // Save comparison image
             const comparisonImageId = generateUUID();
             await db.saveImage(comparisonImageId, comparisonImageData);
             
             // Map to section (use QC image index as section identifier)
             const sectionKey = `qc_image_${i + 1}`;
             sectionComparisons[sectionKey] = {
               authImageId: product.referenceImageIds[0],
               diffImageId: comparisonImageId
             };
           }
           
           // Add comparisons to the report
           preliminaryReport.sectionComparisons = sectionComparisons;
         } catch (error) {
           console.error('Error generating comparison images:', error);
           // Continue without comparison images if generation fails
         }
       }

       const newBatch: QCBatch = { id: generateUUID(), timestamp: Date.now(), imageIds: newImageIds };
       const updatedProduct = {
         ...product,
         qcBatches: [...(product.qcBatches || []), newBatch],
       };
       await updateProduct(updatedProduct);

       setTasks(prev => prev.map(t => t.id === taskId ? { 
         ...t, 
         status: 'AWAITING_FEEDBACK', 
         preliminaryReport: preliminaryReport,
         meta: { ...t.meta, allQCImageIds: allQCImageIds, allQCRawImages: allQCRawImages, subtitle: 'Ready for your feedback' }
        } : t));

     } catch (err: any) {
       console.error("QC Task failed:", err);
       setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'FAILED', error: err.message || "Preliminary QC analysis failed" } : t));
     }
   })();
  };

  const finalizeQCTask = async (apiKey: string, task: BackgroundTask, userComments: string) => {
    if (!task || !task.preliminaryReport) return;

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'PROCESSING', meta: {...task.meta, subtitle: "Generating Final Report..."} } : t));
    
    (async () => {
      try {
        const product = products.find(p => p.id === task.meta.targetId);
        if (!product) throw new Error("Product not found for task");

        const refImageIds = product.referenceImageIds || [];
        const refImages = await Promise.all(refImageIds.map(id => db.getImage(id)));
        const validRefImages = refImages.filter(Boolean) as string[];

        const refImagesAsBase64 = await Promise.all(
          validRefImages.map(async (url) => {
            try {
              const response = await fetch(url);
              if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
              const blob = await response.blob();
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } catch (error) {
              console.error(`Could not convert image URL ${url} to base64:`, error);
              return ''; 
            }
          })
        );
        const validRefImagesAsBase64 = refImagesAsBase64.filter(Boolean);

        const allQCRawImages = task.meta.allQCRawImages || [];
        const allQCImageIds = task.meta.allQCImageIds || [];

        const finalReport = await runFinalQCAnalysis(
          apiKey,
          product.profile,
          validRefImagesAsBase64,
          allQCRawImages,
          allQCImageIds,
          task.meta.settings!,
          task.preliminaryReport,
          userComments
        );
        
        // Generate comparison images for final report
        const sectionComparisons: Record<string, { authImageId?: string; diffImageId?: string; diffScore?: number }> = {};
        
        if (validRefImages.length > 0 && allQCRawImages.length > 0) {
          try {
            for (let i = 0; i < allQCRawImages.length; i++) {
              const qcImageSrc = allQCRawImages[i];
              const refImageSrc = validRefImages[0];
              
              const comparisonImageData = await generateComparisonImage(refImageSrc, qcImageSrc);
              const comparisonImageId = generateUUID();
              await db.saveImage(comparisonImageId, comparisonImageData);
              
              const sectionKey = `qc_image_${i + 1}`;
              sectionComparisons[sectionKey] = {
                authImageId: product.referenceImageIds[0],
                diffImageId: comparisonImageId
              };
            }
            
            finalReport.sectionComparisons = sectionComparisons;
          } catch (error) {
            console.error('Error generating comparison images:', error);
          }
        }
        
        const updatedProduct = {
          ...product,
          reports: [...(product.reports || []), finalReport],
        };
        await updateProduct(updatedProduct);

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'COMPLETED', result: finalReport } : t));
      } catch (err: any) {
        console.error("Final QC Task failed:", err);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'FAILED', error: err.message || "Final QC analysis failed" } : t));
      }
    })();
  };
  
  const dismissTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };
  
  return (
    <AppContext.Provider value={{ 
        user, loading, products, settings, tasks, 
        login, register, updateApiKey, addProduct, updateProduct, 
        deleteProduct, logout, deleteAccount, toggleModelTier, 
        toggleExpertMode, refreshProducts: loadProducts, 
        startIdentificationTask, startQCTask, dismissTask,
        bulkDeleteProducts, finalizeQCTask
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};