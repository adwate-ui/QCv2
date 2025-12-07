import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Product, AppSettings, ModelTier, ExpertMode, BackgroundTask } from '../types';
import { db } from '../services/db';
import { supabase } from '../services/supabase';
import { identifyProduct, runQCAnalysis } from '../services/geminiService';
import { generateUUID } from '../services/utils';

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
  startQCTask: (apiKey: string, product: Product, refImages: string[], qcImages: string[], settings: AppSettings) => void;
  dismissTask: (taskId: string) => void;
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
    setLoading(true);

    // onAuthStateChange fires immediately with the session from storage,
    // and then again whenever the auth state changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const profileUser = await db.getUser(session.user.email!);
          setUser(profileUser || { email: session.user.email!, passwordHash: '', apiKey: '' });
          await loadProducts();
        } else {
          // If there's no session, ensure the user and products are cleared.
          setUser(null);
          setProducts([]);
        }
      } catch (error) {
        // If any async operation fails (db fetch, etc.), log the error and clear the session.
        console.error("Error handling auth state change:", error);
        setUser(null);
        setProducts([]);
      } finally {
        // This is the crucial part: ALWAYS set loading to false after the first check.
        setLoading(false);
      }
    });

    // Cleanup subscription on component unmount
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

  const logout = async () => {
    // Optimistically clear state immediately to prevent UI hanging
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
        // Attempt backend deletion
        await db.deleteUser(user.email);
    } catch (e: any) {
        // Log the specific backend error but proceed to cleanup locally
        console.error("Backend delete failed:", e);
    } finally {
        // ALWAYS clean up local session and redirect
        // This ensures the user feels "deleted" even if backend has RLS issues
        setUser(null);
        setProducts([]);
        try {
            await supabase.auth.signOut();
        } catch (ignored) {}
        
        // Hard reload to reset application state fully
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

  // --- Background Tasks ---

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
        .then(profile => {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED', result: profile } : t));
        })
        .catch(err => {
            console.error("ID Task Failed", err);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'FAILED', error: err.message || "Identification failed" } : t));
        });
  };

  const startQCTask = async (apiKey: string, product: Product, refImages: string[], qcImages: string[], settings: AppSettings) => {
    const taskId = generateUUID();
    const task: BackgroundTask = {
       id: taskId,
       type: 'QC',
       status: 'PROCESSING',
       createdAt: Date.now(),
       meta: {
           title: `QC Inspection: ${product.profile.name}`,
           targetId: product.id
       }
   };
   setTasks(prev => [task, ...prev]);

   (async () => {
     try {
       // 1. Fetch ALL previous batch images (Cumulative Analysis)
       const batches = product.qcBatches || [];
       const previousBatchIds = batches.flatMap(b => b.imageIds);
       
       const previousImages = await Promise.all(previousBatchIds.map(id => db.getImage(id)));
       const validPrevImages = previousImages.filter(Boolean) as string[];
       
       // Combine
       const combinedAnalysisImages = [...validPrevImages, ...qcImages];

       // 2. Run Analysis
       const report = await runQCAnalysis(apiKey, product.profile, refImages, combinedAnalysisImages, settings);

       // 3. Save NEW QC images to DB (Uploads to Storage)
       const newImageIds: string[] = [];
       for (const img of qcImages) {
         const id = generateUUID();
         await db.saveImage(id, img);
         newImageIds.push(id);
       }

       // 4. Update Product in DB
       const newBatch = {
         id: generateUUID(),
         timestamp: Date.now(),
         imageIds: newImageIds
       };

       const updatedProduct = {
         ...product,
         qcBatches: [...batches, newBatch],
         reports: [...(product.reports || []), report] 
       };

       await db.saveProduct(updatedProduct);
       await loadProducts(); 
       
       setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED', result: report } : t));
     } catch (err: any) {
       console.error("QC Task Failed", err);
       setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'FAILED', error: err.message || "QC Analysis failed" } : t));
     }
   })();
 };

 const dismissTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
 };

  return (
    <AppContext.Provider value={{
      user, loading, products, settings, tasks,
      login, register, updateApiKey, addProduct, updateProduct, deleteProduct, logout, deleteAccount,
      toggleModelTier, toggleExpertMode, refreshProducts: loadProducts,
      startIdentificationTask, startQCTask, dismissTask
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
