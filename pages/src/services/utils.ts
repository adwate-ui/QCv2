import { API } from './constants';

/**
 * Generate a UUID v4 identifier
 * Uses crypto.randomUUID if available (Secure Contexts), falls back to Math.random
 * @returns A unique identifier string in UUID v4 format
 */
export const generateUUID = (): string => {
  // Use crypto.randomUUID if available (Secure Contexts)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for non-secure contexts (e.g., HTTP IP address)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Helper to normalize worker URL by removing endpoint paths
 * This handles cases where VITE_IMAGE_PROXY_URL incorrectly includes endpoint paths
 * @param workerUrl The worker URL to normalize
 * @returns Normalized worker URL without endpoint paths, or empty string if invalid
 */
export const normalizeWorkerUrl = (workerUrl: string): string => {
  // Handle falsy values and string representations of null/undefined
  if (!workerUrl || workerUrl === 'undefined' || workerUrl === 'null') {
    return '';
  }
  
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

/**
 * Parse a text string into an array of observations
 * Handles various formats including newline-separated lists, numbered lists, and bullets
 * @param text - Text to parse (may contain line breaks, bullets, or numbered lists)
 * @returns Array of individual observations (trimmed, non-empty strings)
 */
export const parseObservations = (text?: string): string[] => {
  if (!text) return [];
  // Normalize Windows CRLF
  const normalized = text.replace(/\r/g, '\n');

  // If text already contains newline-separated bullets/lines, split by line
  if (/\n/.test(normalized)) {
    return normalized
      .split(/\n+/)
      .map(l => l.replace(/^\s*[-–•\d\)\.]+\s*/, '').trim())
      .filter(Boolean);
  }

  // Otherwise try to split numbered lists like '1) ... 2) ...'
  const numbered = normalized.split(/\d+\)\s+/).map(s => s.trim()).filter(Boolean);
  if (numbered.length > 1) return numbered;

  // Fallback: split on sentence-ending punctuation but keep abbreviations (naive)
  const sentences = normalized.split(/(?<=[\]\.\?\!])\s+(?=[A-Z0-9])/)
    .map(s => s.trim())
    .filter(Boolean);
  return sentences;
};

/**
 * Fetches an image from a URL and converts it to a Base64 string.
 * This is necessary because Gemini API's inlineData expects raw Base64 image data, not a URL.
 * Uses the Cloudflare Worker proxy to bypass CORS restrictions when fetching from external URLs.
 * @param url The URL of the image to fetch.
 * @returns A Promise that resolves to the Base64 string of the image, or rejects if fetching fails.
 */
export const fetchAndEncodeImage = async (url: string): Promise<string> => {
  try {
    let fetchUrl = url;
    
    // Check if this is an external URL (not a data URL or blob URL)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Use the image proxy to bypass CORS restrictions
      const proxyBaseRaw = import.meta.env?.VITE_IMAGE_PROXY_URL as string || '';
      
      if (proxyBaseRaw) {
        const proxyBase = normalizeWorkerUrl(proxyBaseRaw);
        
        // Build proxy URL
        const proxyUrl = new URL('/proxy-image', proxyBase);
        proxyUrl.searchParams.set('url', url);
        fetchUrl = proxyUrl.toString();
        
        console.log(`[fetchAndEncodeImage] Using proxy for external URL: ${url}`);
      } else {
        console.warn(`[fetchAndEncodeImage] VITE_IMAGE_PROXY_URL not configured. Attempting direct fetch for: ${url}`);
        console.warn('[fetchAndEncodeImage] This may fail due to CORS restrictions. Please configure VITE_IMAGE_PROXY_URL.');
      }
    }
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API.IMAGE_FETCH_TIMEOUT);
    
    try {
      const response = await fetch(fetchUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]); // Extract Base64 part
          } else {
            reject(new Error("Failed to read image as Data URL."));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // Provide more specific error messages
      if (fetchError.name === 'AbortError') {
        throw new Error(`TimeoutError: Request timed out while fetching image`);
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error(`[fetchAndEncodeImage] Error fetching image from ${url}:`, error.message || error);
    throw error;
  }
};

/**
 * Calculate estimated completion time for a task
 * @param taskType - Type of task (IDENTIFY or QC)
 * @param modelTier - Model tier being used (FAST or DETAILED)
 * @param imageCount - Number of images to process
 * @param sectionCount - Number of sections (for QC tasks)
 * @param failedSections - Number of failed/caution sections requiring image search (for QC tasks)
 * @returns Estimated completion time in seconds
 */
export const calculateTaskEstimate = (
  taskType: 'IDENTIFY' | 'QC',
  modelTier: 'FAST' | 'DETAILED',
  imageCount: number = 1,
  sectionCount: number = 0,
  failedSections: number = 0
): number => {
  // Constants defined inline to avoid circular dependency with constants.ts
  const TASK_ESTIMATES = {
    IDENTIFY_FAST: 15,
    IDENTIFY_DETAILED: 30,
    QC_FAST_PER_IMAGE: 10,
    QC_DETAILED_PER_IMAGE: 20,
    QC_BASE_OVERHEAD: 10,
    QC_COMPARISON_PER_SECTION: 5,
    IMAGE_SEARCH_PER_SECTION: 8,
  };

  if (taskType === 'IDENTIFY') {
    return modelTier === 'FAST' ? TASK_ESTIMATES.IDENTIFY_FAST : TASK_ESTIMATES.IDENTIFY_DETAILED;
  } else {
    // QC task
    const baseTime = TASK_ESTIMATES.QC_BASE_OVERHEAD;
    const imageProcessingTime = imageCount * (
      modelTier === 'FAST' ? TASK_ESTIMATES.QC_FAST_PER_IMAGE : TASK_ESTIMATES.QC_DETAILED_PER_IMAGE
    );
    const comparisonTime = sectionCount * TASK_ESTIMATES.QC_COMPARISON_PER_SECTION;
    const imageSearchTime = failedSections * TASK_ESTIMATES.IMAGE_SEARCH_PER_SECTION;
    
    return baseTime + imageProcessingTime + comparisonTime + imageSearchTime;
  }
};

/**
 * Format seconds into a human-readable time string
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "2m 30s", "45s", "1m")
 */
export const formatEstimatedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
};