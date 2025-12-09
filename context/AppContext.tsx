import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Product, AppSettings, ModelTier, ExpertMode, BackgroundTask, QCBatch, QCReport } from '../types';
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
  startIdentificationTask: (apiKey: string, images: string[], url: string | undefined, settings: AppSettings) => Promise<void>;
  startQCTask: (apiKey: string, product: Product, qcImages: string[], settings: AppSettings, qcUserComments: string) => void;
  finalizeQCTask: (apiKey: string, task: BackgroundTask, userComments: string) => void;
  dismissTask: (taskId: string) => void;
  bulkDeleteProducts: (ids: string[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper function to ensure grade matches score based on the rubric:
// PASS: score > 80, CAUTION: score 61-80 (inclusive), FAIL: score <= 60
const correctGradeBasedOnScore = (report: QCReport): QCReport => {
  const correctedReport = { ...report };
  
  // Correct overall grade
  if (correctedReport.overallScore > 80) {
    correctedReport.overallGrade = 'PASS';
  } else if (correctedReport.overallScore >= 61 && correctedReport.overallScore <= 80) {
    correctedReport.overallGrade = 'CAUTION';
  } else {
    correctedReport.overallGrade = 'FAIL';
  }
  
  // Correct section grades
  if (correctedReport.sections) {
    correctedReport.sections = correctedReport.sections.map(section => {
      const correctedSection = { ...section };
      if (correctedSection.score > 80) {
        correctedSection.grade = 'PASS';
      } else if (correctedSection.score >= 61 && correctedSection.score <= 80) {
        correctedSection.grade = 'CAUTION';
      } else {
        correctedSection.grade = 'FAIL';
      }
      return correctedSection;
    });
  }
  
  return correctedReport;
};

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    modelTier: ModelTier.FAST,
    expertMode: ExpertMode.NORMAL
  });
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  // Helper function to strip large image data from tasks before persisting
  const sanitizeTasksForStorage = (tasksToSave: BackgroundTask[]): BackgroundTask[] => {
    return tasksToSave.map(task => {
      // Create a shallow copy of the task
      const sanitized = { ...task };
      
      // Strip large image data from meta to avoid quota issues
      if (sanitized.meta) {
        sanitized.meta = {
          ...sanitized.meta,
          // Remove image data but keep count for reference
          images: sanitized.meta.images ? [] : undefined,
          allQCRawImages: sanitized.meta.allQCRawImages ? [] : undefined,
          // Add image counts as separate metadata
          imageCount: sanitized.meta.images?.length,
          allQCRawImageCount: sanitized.meta.allQCRawImages?.length,
        };
      }
      
      // Remove large result data for completed tasks
      if (sanitized.status === 'COMPLETED' && sanitized.result) {
        sanitized.result = undefined;
      }
      
      return sanitized;
    });
  };

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    // Only keep active tasks (PROCESSING or AWAITING_FEEDBACK) and recent completed tasks
    const activeTasks = tasks.filter(t => 
      t.status === 'PROCESSING' || 
      t.status === 'AWAITING_FEEDBACK' ||
      (t.status === 'COMPLETED' && Date.now() - t.createdAt < 3600000) || // Keep completed tasks for 1 hour
      (t.status === 'FAILED' && Date.now() - t.createdAt < 1800000) // Keep failed tasks for 30 minutes
    );
    
    if (activeTasks.length > 0) {
      try {
        const sanitized = sanitizeTasksForStorage(activeTasks);
        const serialized = JSON.stringify(sanitized);
        
        // Check size before saving (localStorage typically has 5-10MB limit)
        const sizeInBytes = new TextEncoder().encode(serialized).length;
        const maxSizeInBytes = 4 * 1024 * 1024; // 4MB safety limit
        
        if (sizeInBytes > maxSizeInBytes) {
          console.warn(`Tasks data too large (${Math.round(sizeInBytes / 1024)}KB), keeping only processing tasks`);
          // Only keep processing tasks if size is too large
          const processingOnly = activeTasks.filter(t => t.status === 'PROCESSING');
          const processingSanitized = sanitizeTasksForStorage(processingOnly);
          localStorage.setItem('authentiqc_tasks', JSON.stringify(processingSanitized));
        } else {
          localStorage.setItem('authentiqc_tasks', serialized);
        }
      } catch (e) {
        console.error('Failed to persist tasks:', e);
        // If quota exceeded, try saving only critical processing tasks
        try {
          const criticalTasks = activeTasks.filter(t => t.status === 'PROCESSING');
          if (criticalTasks.length > 0) {
            const sanitized = sanitizeTasksForStorage(criticalTasks);
            localStorage.setItem('authentiqc_tasks', JSON.stringify(sanitized));
            console.log('Saved only processing tasks due to storage constraints');
          }
        } catch (fallbackError) {
          console.error('Failed to save even critical tasks:', fallbackError);
          // Clear the storage and try one more time with just task IDs
          try {
            localStorage.removeItem('authentiqc_tasks');
          } catch (clearError) {
            // Can't do anything if we can't even clear
          }
        }
      }
    } else {
      // Clean up storage when no active tasks
      try {
        localStorage.removeItem('authentiqc_tasks');
      } catch (e) {
        console.error('Failed to remove tasks from storage:', e);
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

  // Periodic cleanup of old completed/failed tasks to prevent memory issues
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const ONE_HOUR = 3600000;
      const THIRTY_MINUTES = 1800000;
      
      setTasks(prevTasks => {
        const filtered = prevTasks.filter(task => {
          // Always keep processing and awaiting feedback tasks
          if (task.status === 'PROCESSING' || task.status === 'AWAITING_FEEDBACK') {
            return true;
          }
          // Keep completed tasks for 1 hour
          if (task.status === 'COMPLETED' && now - task.createdAt < ONE_HOUR) {
            return true;
          }
          // Keep failed tasks for 30 minutes
          if (task.status === 'FAILED' && now - task.createdAt < THIRTY_MINUTES) {
            return true;
          }
          // Remove everything else
          return false;
        });
        
        // Only update state if we actually removed something
        return filtered.length !== prevTasks.length ? filtered : prevTasks;
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, []);

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
        const proxyBaseRaw = import.meta.env?.VITE_IMAGE_PROXY_URL as string || '';
        const proxyBase = normalizeWorkerUrl(proxyBaseRaw);
        const imagePromises = product.profile.imageUrls.map(async (imageUrl) => {
          try {
            let fetchUrl: string;
            if (proxyBase) {
              // Use URL constructor for safe URL building - proxyBase is normalized
              const proxyUrl = new URL('/proxy-image', proxyBase);
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

      // Generate comparison only for sections with issues (CAUTION or FAIL)
      const sectionsWithIssues = report.sections.filter(s => s.grade !== 'PASS');
      
      console.log(`Generating ${sectionsWithIssues.length} comparison images for non-PASS sections:`, sectionsWithIssues.map(s => `${s.sectionName} (${s.grade})`));
      
      // Limit observations shown in comparison images for better readability
      const MAX_OBSERVATIONS_FOR_COMPARISON = 4;
      
      // Generate all comparison images in parallel
      const comparisonPromises = sectionsWithIssues.map(async (section, sectionIndex) => {
        try {
          // Try to find the most relevant QC image for this section
          // Strategy:
          // 1. If section has imageIds (future compatibility), use the first available QC image
          // 2. Otherwise, distribute QC images across sections using round-robin
          // 3. Fallback to first image if only one available
          let qcImageSrc: string;
          if (section.imageIds && section.imageIds.length > 0 && allQCRawImages.length > 0) {
            // Section has specific image references (future compatibility)
            // For now, just use the first QC image since we don't have imageId-to-image mapping here
            qcImageSrc = allQCRawImages[0];
          } else if (allQCRawImages.length > 1) {
            // Distribute images across sections using round-robin for better coverage
            qcImageSrc = allQCRawImages[sectionIndex % allQCRawImages.length];
          } else {
            // Use first (and likely only) QC image
            qcImageSrc = allQCRawImages[0];
          }
          
          const refImageSrc = referenceImages[0]; // Use first reference image
          
          // Get observations for this section (limit for better readability)
          const observations = Array.isArray(section.observations) 
            ? section.observations.slice(0, MAX_OBSERVATIONS_FOR_COMPARISON) 
            : [];
          
          // Generate side-by-side comparison with observations highlighted
          const comparisonImageData = await generateComparisonImage(
            refImageSrc, 
            qcImageSrc, 
            undefined, // No bounding boxes available from AI model
            observations
          );
          
          // Save comparison image
          const comparisonImageId = generateUUID();
          await db.saveImage(comparisonImageId, comparisonImageData);
          
          console.log(`Generated comparison image for ${section.sectionName} (${section.grade})`);
          
          return {
            sectionName: section.sectionName,
            comparison: {
              authImageId: product.referenceImageIds[0],
              diffImageId: comparisonImageId
            }
          };
        } catch (error) {
          console.error(`Failed to generate comparison for ${section.sectionName}:`, error);
          return null;
        }
      });
      
      const comparisonResults = (await Promise.all(comparisonPromises)).filter(Boolean) as Array<{
        sectionName: string;
        comparison: { authImageId?: string; diffImageId?: string; diffScore?: number }
      }>;
      
      // Map results to sectionComparisons
      comparisonResults.forEach(result => {
        sectionComparisons[result.sectionName] = result.comparison;
      });
      
      console.log(`Successfully generated ${comparisonResults.length} comparison images`);
    } catch (error) {
      console.error('Error generating comparison images:', error);
      // Return partial results or empty object if generation fails
    }
    
    return sectionComparisons;
  };

  // Maximum number of images to fetch from a product URL
  const MAX_IMAGES_FROM_URL = 5;

  // Helper function to check if a response is JSON based on content-type
  const isJsonResponse = (response: Response): boolean => {
    const contentType = response.headers.get('content-type');
    return contentType !== null && contentType.toLowerCase().includes('application/json');
  };

  // Helper function to normalize the worker URL by removing endpoint paths if they exist
  // This handles cases where VITE_IMAGE_PROXY_URL incorrectly includes endpoint paths
  const normalizeWorkerUrl = (workerUrl: string): string => {
    if (!workerUrl) return workerUrl;
    
    // Remove trailing slash
    let normalized = workerUrl.replace(/\/$/, '');
    
    // Remove common endpoint paths if they exist
    const endpointPaths = ['/fetch-metadata', '/proxy-image', '/proxy'];
    for (const path of endpointPaths) {
      if (normalized.endsWith(path)) {
        normalized = normalized.slice(0, -path.length);
        break;
      }
    }
    
    return normalized;
  };

  // Helper function to fetch images from a product URL with retry logic and better error handling
  const fetchImagesFromUrl = async (url: string, retryCount: number = 0): Promise<{ images: string[]; error?: string }> => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // 1 second
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      const error = 'Invalid URL format provided';
      console.error(error, url);
      return { images: [], error };
    }

    const proxyBase = normalizeWorkerUrl(import.meta.env?.VITE_IMAGE_PROXY_URL as string || '');
    if (!proxyBase) {
      const error = 'Image proxy not configured. Please set VITE_IMAGE_PROXY_URL in .env.local (for local development) or as a GitHub secret (for production). See IMAGE_FETCHING_GUIDE.md for details.';
      console.error('[Image Fetch]', error);
      return { images: [], error };
    }

    // Validate proxy URL format
    try {
      new URL(proxyBase);
    } catch {
      const error = `Invalid VITE_IMAGE_PROXY_URL format: "${proxyBase}". Must be a valid URL (e.g., https://your-worker.workers.dev)`;
      console.error('[Image Fetch]', error);
      return { images: [], error };
    }

    try {
      // First, fetch metadata to get image URLs from the page
      // proxyBase is now normalized (endpoint paths removed), so we append /fetch-metadata
      const metadataUrl = `${proxyBase}/fetch-metadata?url=${encodeURIComponent(url)}`;
      console.log(`[Image Fetch] Attempt ${retryCount + 1}: Fetching metadata from:`, metadataUrl);
      console.log(`[Image Fetch] Using worker URL: ${proxyBase}`);
      
      const metadataResponse = await fetch(metadataUrl, { 
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });
      
      if (!metadataResponse.ok) {
        // Try to parse error response as JSON if content-type is appropriate
        let errorData = { error: 'Unknown error' };
        if (isJsonResponse(metadataResponse)) {
          try {
            errorData = await metadataResponse.json();
          } catch (parseError) {
            // Keep default error data if JSON parsing fails due to malformed content or other parse errors
          }
        }
        
        const error = `Failed to fetch metadata (Status ${metadataResponse.status}): ${errorData.error || errorData.message || 'Unknown error'}`;
        console.error('[Image Fetch]', error);
        
        // Retry on server errors (5xx) or rate limits (429)
        if ((metadataResponse.status >= 500 || metadataResponse.status === 429) && retryCount < MAX_RETRIES) {
          console.log(`[Image Fetch] Retrying in ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return fetchImagesFromUrl(url, retryCount + 1);
        }
        
        return { images: [], error };
      }
      
      // Check if response is JSON before parsing
      if (!isJsonResponse(metadataResponse)) {
        const contentType = metadataResponse.headers.get('content-type');
        
        // Provide specific guidance based on the response type
        const error = contentType?.includes('text/html') 
          ? `Worker returned non-JSON response (Content-Type: ${contentType || 'not set'}).
The worker URL (${proxyBase}) appears to be returning an HTML page instead of JSON. This usually means:
1. The Cloudflare Worker is not deployed at this URL
2. The URL is incorrect (make sure it points to your worker, not a generic Cloudflare page)
3. The worker exists but is misconfigured

To fix:
- Deploy the worker: cd cloudflare-worker && npx wrangler@4 deploy index.mjs --name authentiqc-worker
- Update VITE_IMAGE_PROXY_URL with the correct worker URL
- See IMAGE_FETCHING_GUIDE.md for detailed instructions`
          : `Worker returned non-JSON response (Content-Type: ${contentType || 'not set'}). Please verify VITE_IMAGE_PROXY_URL (${proxyBase}) is correctly configured and the Cloudflare Worker is deployed.`;
        
        console.error('[Image Fetch]', error);
        return { images: [], error };
      }
      
      // Parse JSON response with error handling
      let metadata;
      try {
        metadata = await metadataResponse.json();
      } catch (parseError: unknown) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        const error = `Failed to parse worker response as JSON: ${errorMsg}. The worker may be misconfigured or returning an error page.`;
        console.error('[Image Fetch]', error);
        return { images: [], error };
      }
      
      if (metadata.error) {
        const error = `Metadata endpoint error: ${metadata.error}`;
        console.error('[Image Fetch]', error);
        return { images: [], error };
      }
      
      if (!metadata.images || metadata.images.length === 0) {
        const error = 'No images found on the product page. Will try AI-powered image search as fallback.';
        console.warn('[Image Fetch]', error);
        return { images: [], error };
      }

      console.log(`[Image Fetch] Found ${metadata.images.length} images on page, fetching up to ${MAX_IMAGES_FROM_URL}`);

      // Fetch up to MAX_IMAGES_FROM_URL images from the page through the proxy
      const imageUrls = metadata.images.slice(0, MAX_IMAGES_FROM_URL);
      const fetchedImages = await Promise.all(
        imageUrls.map(async (imageUrl: string, index: number) => {
          try {
            // Build proxy URL - proxyBase is normalized, so we append /proxy-image
            const proxyUrl = new URL('/proxy-image', proxyBase);
            proxyUrl.searchParams.set('url', imageUrl);
            
            console.log(`[Image Fetch] (${index + 1}/${imageUrls.length}) Fetching:`, imageUrl);
            const response = await fetch(proxyUrl.toString(), {
              signal: AbortSignal.timeout(10000) // 10 second timeout per image
            });
            
            if (!response.ok) {
              console.debug(`[Image Fetch] Image ${index + 1} failed (Status ${response.status}):`, imageUrl);
              return null;
            }
            
            const blob = await response.blob();
            
            // Validate that we actually got an image
            if (!blob.type.startsWith('image/')) {
              console.debug(`[Image Fetch] Image ${index + 1} is not an image (${blob.type}):`, imageUrl);
              return null;
            }
            
            // Skip very small images (likely tracking pixels)
            if (blob.size < 1024) {
              console.debug(`[Image Fetch] Image ${index + 1} too small (${blob.size} bytes):`, imageUrl);
              return null;
            }
            
            console.log(`[Image Fetch] Image ${index + 1} success:`, imageUrl, `(${Math.round(blob.size / 1024)}KB)`);
            
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error(`[Image Fetch] Image ${index + 1} error:`, imageUrl, error);
            return null;
          }
        })
      );
      
      const validImages = fetchedImages.filter(Boolean) as string[];
      console.log(`[Image Fetch] Successfully fetched ${validImages.length} out of ${imageUrls.length} images`);
      
      if (validImages.length === 0) {
        const error = 'All images failed to download. Will try AI-powered image search as fallback.';
        return { images: [], error };
      }
      
      return { images: validImages };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error && error.name === 'TimeoutError' 
        ? 'Request timed out. The website may be slow or blocking requests.'
        : error instanceof Error 
          ? `Error fetching images: ${error.message}`
          : `Error fetching images: ${String(error)}`;
      
      console.error('[Image Fetch]', errorMsg, error);
      
      // Retry on network errors
      if (retryCount < MAX_RETRIES && error instanceof Error && error.name !== 'AbortError') {
        console.log(`[Image Fetch] Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return fetchImagesFromUrl(url, retryCount + 1);
      }
      
      return { images: [], error: errorMsg };
    }
  };

  const startIdentificationTask = async (apiKey: string, images: string[], url: string | undefined, settings: AppSettings) => {
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

    // If URL is provided and no images, try to fetch images from the URL first
    let imagesToUse = images;
    let scrapingError: string | undefined;
    
    if (url && images.length === 0) {
      try {
        // Update task to show we're scraping
        setTasks(prev => prev.map(t => t.id === taskId ? { 
          ...t, 
          meta: { ...t.meta, subtitle: 'Fetching images from URL...' } 
        } : t));
        
        const result = await fetchImagesFromUrl(url);
        
        if (result.images.length > 0) {
          console.log(`[Identification] Successfully scraped ${result.images.length} images from URL`);
          imagesToUse = result.images;
          // Update task meta with scraped images
          setTasks(prev => prev.map(t => t.id === taskId ? { 
            ...t, 
            meta: { ...t.meta, images: imagesToUse, subtitle: `Analyzing ${imagesToUse.length} scraped images...` } 
          } : t));
        } else {
          scrapingError = result.error || 'No images found';
          console.warn(`[Identification] URL scraping failed: ${scrapingError}. Will rely on AI image search.`);
          // Update task to show we're falling back to AI
          setTasks(prev => prev.map(t => t.id === taskId ? { 
            ...t, 
            meta: { ...t.meta, subtitle: 'AI searching for product images...' } 
          } : t));
        }
      } catch (error: any) {
        scrapingError = error.message || 'Unknown error during scraping';
        console.error('[Identification] Failed to fetch images from URL:', error);
        setTasks(prev => prev.map(t => t.id === taskId ? { 
          ...t, 
          meta: { ...t.meta, subtitle: 'AI searching for product images...' } 
        } : t));
      }
    }

    identifyProduct(apiKey, imagesToUse, url, settings)
        .then(async (profile) => {
            // Use imagesToUse which may contain scraped images
            let finalImages = imagesToUse;
            
            // Fallback: If we still have no images but the model returned imageUrls, fetch them
            // This handles the case where URL scraping failed but the AI found images via Google Search
            if (finalImages.length === 0 && profile.imageUrls && profile.imageUrls.length > 0) {
                console.log(`[Identification] No images from URL scraping${scrapingError ? ` (${scrapingError})` : ''}. AI found ${profile.imageUrls.length} image URLs via search. Fetching them...`);
                
                // Update task to show we're fetching AI-found images
                setTasks(prev => prev.map(t => t.id === taskId ? { 
                  ...t, 
                  meta: { ...t.meta, subtitle: `Downloading ${profile.imageUrls.length} AI-discovered images...` } 
                } : t));
                
                const proxyBaseRaw = import.meta.env?.VITE_IMAGE_PROXY_URL as string || '';
                const proxyBase = normalizeWorkerUrl(proxyBaseRaw);
                
                if (!proxyBase) {
                  console.error('[Identification] VITE_IMAGE_PROXY_URL not configured, cannot fetch AI-provided image URLs. See IMAGE_FETCHING_GUIDE.md for setup instructions.');
                } else {
                  const fetchedImages = await Promise.allSettled(
                      profile.imageUrls.slice(0, MAX_IMAGES_FROM_URL).map(async (imageUrl, index) => {
                        try {
                          // Use URL constructor for safe URL building - proxyBase is normalized
                          const proxyUrl = new URL('/proxy-image', proxyBase);
                          proxyUrl.searchParams.set('url', imageUrl);
                          const fetchUrl = proxyUrl.toString();
                          
                          console.log(`[Identification] Fetching AI image ${index + 1}/${profile.imageUrls.length}:`, imageUrl);
                          const response = await fetch(fetchUrl, {
                            signal: AbortSignal.timeout(10000) // 10 second timeout
                          });
                          
                          if (!response.ok) {
                            console.debug(`[Identification] AI image ${index + 1} fetch failed (Status ${response.status}):`, fetchUrl);
                            return null;
                          }
                          
                          const blob = await response.blob();
                          
                          // Validate image
                          if (!blob.type.startsWith('image/') || blob.size < 1024) {
                            console.debug(`[Identification] AI image ${index + 1} invalid:`, imageUrl, blob.type, blob.size);
                            return null;
                          }
                          
                          console.log(`[Identification] AI image ${index + 1} success:`, imageUrl, `(${Math.round(blob.size / 1024)}KB)`);
                          return new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                          });
                        } catch (error: any) {
                          console.error(`[Identification] Failed to fetch AI image ${index + 1} from ${imageUrl}:`, error);
                          return null;
                        }
                      })
                  );
                  
                  finalImages = fetchedImages
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => (result as PromiseFulfilledResult<string>).value);
                    
                  console.log(`[Identification] Successfully fetched ${finalImages.length} out of ${profile.imageUrls.length} AI-provided images`);
                  
                  if (finalImages.length === 0) {
                    console.warn('[Identification] All AI-provided images failed to download');
                  }
                }
            } else if (finalImages.length === 0) {
                console.warn('[Identification] No images available after all attempts (URL scraping failed and AI did not provide image URLs)');
            }
            
            setTasks(prev => prev.map(t => t.id === taskId ? { 
              ...t, 
              status: 'COMPLETED', 
              result: profile, 
              meta: { 
                ...t.meta, 
                images: finalImages,
                subtitle: finalImages.length > 0 ? `Identified with ${finalImages.length} images` : 'Identified (no images found)'
              } 
            } : t));
        })
        .catch(err => {
            console.error("[Identification] Task Failed", err);
            const errorMessage = err.message || "Identification failed";
            setTasks(prev => prev.map(t => t.id === taskId ? { 
              ...t, 
              status: 'FAILED', 
              error: `${errorMessage}${scrapingError ? ` (Image scraping: ${scrapingError})` : ''}` 
            } : t));
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
       
       // Correct grades to match scores based on rubric
       const correctedPreliminaryReport = correctGradeBasedOnScore(preliminaryReport);

       // Generate comparison images and update product in parallel
       const [sectionComparisons] = await Promise.all([
         generateAndStoreComparisonImages(product, allQCRawImages, correctedPreliminaryReport),
         (async () => {
           const newBatch: QCBatch = { id: generateUUID(), timestamp: Date.now(), imageIds: newImageIds };
           const updatedProduct = {
             ...product,
             qcBatches: [...(product.qcBatches || []), newBatch],
           };
           await updateProduct(updatedProduct);
         })()
       ]);
       
       correctedPreliminaryReport.sectionComparisons = sectionComparisons;

       setTasks(prev => prev.map(t => t.id === taskId ? { 
         ...t, 
         status: 'AWAITING_FEEDBACK', 
         preliminaryReport: correctedPreliminaryReport,
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
        
        // Correct grades to match scores based on rubric
        const correctedFinalReport = correctGradeBasedOnScore(finalReport);
        
        // Generate comparison images and update product in parallel
        const [sectionComparisons] = await Promise.all([
          generateAndStoreComparisonImages(product, allQCRawImages, correctedFinalReport),
          (async () => {
            const updatedProduct = {
              ...product,
              reports: [...(product.reports || []), correctedFinalReport],
            };
            await updateProduct(updatedProduct);
          })()
        ]);
        
        correctedFinalReport.sectionComparisons = sectionComparisons;

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'COMPLETED', result: correctedFinalReport } : t));
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