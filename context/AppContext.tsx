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

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (tasks.length > 0) {
      try {
        localStorage.setItem('authentiqc_tasks', JSON.stringify(tasks));
      } catch (e) {
        console.error('Failed to persist tasks:', e);
      }
    }
  }, [tasks]);

  // Restore tasks from localStorage on mount
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('authentiqc_tasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        // Only restore tasks that are still processing or awaiting feedback
        const activeTasks = parsedTasks.filter((t: BackgroundTask) => 
          t.status === 'PROCESSING' || t.status === 'AWAITING_FEEDBACK'
        );
        if (activeTasks.length > 0) {
          setTasks(activeTasks);
        }
      }
    } catch (e) {
      console.error('Failed to restore tasks:', e);
    }
  }, []);

  // Add beforeunload warning if there are active tasks
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const activeTasks = tasks.filter(t => t.status === 'PROCESSING');
      if (activeTasks.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have active QC inspections running. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tasks]);

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
    // Load products immediately after successful login
    await loadProducts();
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

  const generateAndStoreComparisonImages = async (
    product: Product,
    allQCRawImages: string[],
    report: QCReport
  ): Promise<Record<string, { authImageId?: string; diffImageId?: string; diffScore?: number }>> => {
    const sectionComparisons: Record<string, { authImageId?: string; diffImageId?: string; diffScore?: number }> = {};
    
    if (allQCRawImages.length === 0) {
      return sectionComparisons;
    }

    try {
      // Use original images from internet if available, otherwise fall back to reference images
      let referenceImages: string[] = [];
      
      if (product.profile.imageUrls && product.profile.imageUrls.length > 0) {
        // Download and convert original images from internet in parallel
        const proxyBase = import.meta.env?.VITE_IMAGE_PROXY_URL as string || '';
        const imagePromises = product.profile.imageUrls.map(async (imageUrl) => {
          try {
            let fetchUrl: string;
            if (proxyBase) {
              // Use URL constructor for safe URL building
              const proxyUrl = new URL('/proxy-image', proxyBase.replace(/\/$/, ''));
              proxyUrl.searchParams.set('url', imageUrl);
              fetchUrl = proxyUrl.toString();
            } else {
              fetchUrl = imageUrl;
            }
            
            const response = await fetch(fetchUrl);
            if (!response.ok) {
              console.debug('Failed to fetch original image', fetchUrl);
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
            console.error(`Failed to fetch original image from ${imageUrl}:`, error);
            return null;
          }
        });
        
        const fetchedImages = await Promise.all(imagePromises);
        referenceImages = fetchedImages.filter(Boolean) as string[];
      }
      
      // Fall back to uploaded reference images if no original images available
      if (referenceImages.length === 0) {
        const refImageIds = product.referenceImageIds || [];
        const refImages = await Promise.all(refImageIds.map(id => db.getImage(id)));
        referenceImages = refImages.filter(Boolean) as string[];
      }
      
      if (referenceImages.length === 0) {
        console.warn('No reference images available for comparison');
        return sectionComparisons;
      }

      // Generate comparison only for sections with discrepancies (not PASS)
      const sectionsWithIssues = report.sections.filter(s => s.grade !== 'PASS');
      
      // Generate all comparison images in parallel
      const comparisonPromises = sectionsWithIssues.map(async (section, i) => {
        // Use corresponding QC image or first available
        const qcImageSrc = allQCRawImages[Math.min(i, allQCRawImages.length - 1)];
        const refImageSrc = referenceImages[0]; // Use first reference image
        
        // Generate side-by-side comparison
        const comparisonImageData = await generateComparisonImage(refImageSrc, qcImageSrc);
        
        // Save comparison image
        const comparisonImageId = generateUUID();
        await db.saveImage(comparisonImageId, comparisonImageData);
        
        return {
          sectionName: section.sectionName,
          comparison: {
            authImageId: product.referenceImageIds[0],
            diffImageId: comparisonImageId
          }
        };
      });
      
      const comparisonResults = await Promise.all(comparisonPromises);
      
      // Map results to sectionComparisons
      comparisonResults.forEach(result => {
        sectionComparisons[result.sectionName] = result.comparison;
      });
    } catch (error) {
      console.error('Error generating comparison images:', error);
      // Return partial results or empty object if generation fails
    }
    
    return sectionComparisons;
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
                const proxyBase = import.meta.env?.VITE_IMAGE_PROXY_URL as string || '';
                const fetchedImages = await Promise.all(
                    profile.imageUrls.slice(0, 5).map(async (imageUrl) => {
                      try {
                        let fetchUrl: string;
                        if (proxyBase) {
                          // Use URL constructor for safe URL building
                          const proxyUrl = new URL('/proxy-image', proxyBase.replace(/\/$/, ''));
                          proxyUrl.searchParams.set('url', imageUrl);
                          fetchUrl = proxyUrl.toString();
                        } else {
                          fetchUrl = imageUrl;
                        }
                        
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
       // Parallel operations: save new images and load previous images simultaneously
       const [newImageIds, previousImages, refImages] = await Promise.all([
         Promise.all(
           qcImages.map(async (img) => {
             const id = generateUUID();
             await db.saveImage(id, img);
             return id;
           })
         ),
         Promise.all((product.qcBatches || []).flatMap(b => b.imageIds).map(id => db.getImage(id))),
         Promise.all((product.referenceImageIds || []).map(id => db.getImage(id)))
       ]);

       const validPrevImages = previousImages.filter(Boolean) as string[];
       const allQCRawImages = [...validPrevImages, ...qcImages];
       const allQCImageIds = [...(product.qcBatches || []).flatMap(b => b.imageIds), ...newImageIds];
       const validRefImages = refImages.filter(Boolean) as string[];

       // Convert reference images to base64 in parallel
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

       // Generate comparison images and update product in parallel
       const [sectionComparisons] = await Promise.all([
         generateAndStoreComparisonImages(product, allQCRawImages, preliminaryReport),
         (async () => {
           const newBatch: QCBatch = { id: generateUUID(), timestamp: Date.now(), imageIds: newImageIds };
           const updatedProduct = {
             ...product,
             qcBatches: [...(product.qcBatches || []), newBatch],
           };
           await updateProduct(updatedProduct);
         })()
       ]);
       
       preliminaryReport.sectionComparisons = sectionComparisons;

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

        const allQCRawImages = task.meta.allQCRawImages || [];
        const allQCImageIds = task.meta.allQCImageIds || [];

        // Load and convert reference images in parallel
        const refImages = await Promise.all((product.referenceImageIds || []).map(id => db.getImage(id)));
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
        
        // Generate comparison images and update product in parallel
        const [sectionComparisons] = await Promise.all([
          generateAndStoreComparisonImages(product, allQCRawImages, finalReport),
          (async () => {
            const updatedProduct = {
              ...product,
              reports: [...(product.reports || []), finalReport],
            };
            await updateProduct(updatedProduct);
          })()
        ]);
        
        finalReport.sectionComparisons = sectionComparisons;

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