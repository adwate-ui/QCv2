/**
 * Service for processing product URLs and importing images.
 * Handles both direct image URLs and webpage URLs with og:image meta tags.
 * 
 * This service now includes:
 * - Health checking before making worker requests
 * - Circuit breaker pattern to prevent repeated failures
 * - Retry logic with exponential backoff
 * - Clear error messages when worker is down
 */

import { workerHealthService } from '@/services/workerHealthService';

// Helper to safely get env vars in different environments (Vite vs others)
const getEnv = (key: string) => {
  // Check import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  // Check process.env (Node/Webpack)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

// Helper function to normalize the worker URL by removing endpoint paths if they exist
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

/**
 * Determines if a URL points to an image based on file extension.
 * @param url The URL to check
 * @returns true if the URL appears to be an image
 */
const isImageUrl = (url: string): boolean => {
  try {
    // Check file extension from URL pathname
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const pathname = new URL(url).pathname.toLowerCase();
    const extension = pathname.split('.').pop() || '';
    return imageExtensions.includes(extension);
  } catch {
    // If URL parsing fails, assume it's not an image URL
    return false;
  }
};

/**
 * Extracts the og:image URL from a webpage using the Cloudflare worker's fetch-metadata endpoint.
 * Now includes retry logic and better error handling.
 * @param pageUrl The webpage URL to extract og:image from
 * @param workerUrl The Cloudflare worker base URL (will be normalized)
 * @returns The og:image URL if found, or the first image URL from the page
 * @throws Error if no images are found or if the fetch fails
 */
const extractOgImage = async (pageUrl: string, workerUrl: string): Promise<string> => {
  const normalizedUrl = normalizeWorkerUrl(workerUrl);
  const metadataUrl = `${normalizedUrl}/fetch-metadata?url=${encodeURIComponent(pageUrl)}`;
  
  console.log('[ImageService] Fetching metadata from:', metadataUrl);
  
  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(metadataUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        
        // Check if this is a 404 - likely means worker is not deployed
        if (response.status === 404) {
          throw new Error(
            `Worker endpoint not found (404). This usually means:\n` +
            `1. The Cloudflare Worker is not deployed\n` +
            `2. The worker URL is incorrect\n` +
            `3. The fetch-metadata endpoint is missing\n\n` +
            `Please check CLOUDFLARE_DEPLOYMENT_GUIDE.md for deployment instructions.`
          );
        }
        
        // Retry on 5xx errors or 429
        if ((response.status >= 500 || response.status === 429) && attempt < maxRetries - 1) {
          console.warn(`[ImageService] Attempt ${attempt + 1} failed with ${response.status}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }
        
        throw new Error(`Failed to fetch metadata (HTTP ${response.status}): ${errorText}`);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          `Expected JSON response but got ${contentType}. ` +
          `This usually means the worker is not deployed correctly.`
        );
      }
      
      const data = await response.json();
      
      if (!data.images || data.images.length === 0) {
        throw new Error(`No images found on ${pageUrl}`);
      }
      
      console.log(`[ImageService] Found ${data.images.length} images from ${pageUrl}`);
      // Return the first image (which should be og:image if available, as per worker.js implementation)
      return data.images[0];
      
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on non-network errors
      if (error.message.includes('404') || error.message.includes('not deployed')) {
        throw error;
      }
      
      // Retry on network errors
      if (attempt < maxRetries - 1 && (error.name === 'TypeError' || error.message.includes('fetch'))) {
        console.warn(`[ImageService] Network error on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Failed to fetch metadata after all retries');
};

/**
 * Fetches an image through the Cloudflare worker proxy endpoint.
 * Now includes retry logic and better error handling.
 * @param imageUrl The image URL to fetch
 * @param workerUrl The Cloudflare worker base URL (will be normalized)
 * @returns A Blob containing the image data
 * @throws Error if the fetch fails
 */
const fetchImageViaProxy = async (imageUrl: string, workerUrl: string): Promise<Blob> => {
  const normalizedUrl = normalizeWorkerUrl(workerUrl);
  const proxyUrl = `${normalizedUrl}/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  
  console.log('[ImageService] Fetching image via proxy:', proxyUrl);
  
  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        // Check if this is a 404 - likely means worker is not deployed
        if (response.status === 404) {
          throw new Error(
            `Worker endpoint not found (404). This usually means:\n` +
            `1. The Cloudflare Worker is not deployed\n` +
            `2. The worker URL is incorrect\n` +
            `3. The proxy-image endpoint is missing\n\n` +
            `Please check CLOUDFLARE_DEPLOYMENT_GUIDE.md for deployment instructions.`
          );
        }
        
        // Retry on 5xx errors or 429
        if ((response.status >= 500 || response.status === 429) && attempt < maxRetries - 1) {
          console.warn(`[ImageService] Attempt ${attempt + 1} failed with ${response.status}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }
        
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to fetch image via proxy (HTTP ${response.status}): ${errorText}`);
      }
      
      console.log('[ImageService] Successfully fetched image via proxy');
      return await response.blob();
      
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on non-network errors
      if (error.message.includes('404') || error.message.includes('not deployed')) {
        throw error;
      }
      
      // Retry on network errors
      if (attempt < maxRetries - 1 && (error.name === 'TypeError' || error.message.includes('fetch'))) {
        console.warn(`[ImageService] Network error on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Failed to fetch image after all retries');
};

/**
 * Converts a Blob to a File object with a specific filename.
 * @param blob The Blob to convert
 * @param filename The desired filename
 * @returns A File object
 */
const blobToFile = (blob: Blob, filename: string): File => {
  return new File([blob], filename, { type: blob.type });
};

/**
 * Processes a product URL and returns an imported image file.
 * 
 * This function:
 * 1. Performs a health check on the Cloudflare Worker before making requests
 * 2. Checks if the URL is an image or a webpage
 * 3. If it's a webpage, extracts the og:image meta tag content using the Cloudflare worker
 * 4. Fetches the final image URL through the Cloudflare worker proxy endpoint
 * 5. Converts the response blob into a File object named 'imported_product.jpg'
 * 
 * This function now includes comprehensive error handling and health checking to prevent
 * CORS 404 errors when the worker is not deployed or unavailable.
 * 
 * @param url The product URL to process (can be an image URL or a webpage URL)
 * @returns A Promise that resolves to a File object containing the imported image
 * @throws Error if the URL cannot be processed, worker is not available, or other failures
 * 
 * @example
 * ```typescript
 * try {
 *   const imageFile = await processProductUrl('https://example.com/product');
 *   // Use imageFile for upload or display
 * } catch (error) {
 *   console.error('Failed to process URL:', error);
 *   // Error message will include troubleshooting tips
 * }
 * ```
 */
export const processProductUrl = async (url: string): Promise<File> => {
  console.log('[ImageService] Processing product URL:', url);
  
  // Validate the input URL
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL provided: ${url}`);
  }
  
  // Check worker health BEFORE making any requests
  // This prevents CORS 404 errors by failing fast with clear error messages
  try {
    await workerHealthService.ensureHealthy();
  } catch (healthError: any) {
    console.error('[ImageService] Worker health check failed:', healthError.message);
    throw new Error(
      `Cannot process product URL because the Cloudflare Worker is not available.\n\n` +
      healthError.message
    );
  }
  
  // Get the Cloudflare worker URL from environment
  const workerUrl = workerHealthService.getWorkerUrl();
  if (!workerUrl) {
    throw new Error(
      'VITE_IMAGE_PROXY_URL is not configured. Please set the Cloudflare worker URL.\n\n' +
      'For setup instructions, see VITE_IMAGE_PROXY_URL_SETUP.md'
    );
  }
  
  let finalImageUrl: string;
  
  try {
    // Check if the URL is a direct image or a webpage
    if (isImageUrl(url)) {
      console.log('[ImageService] URL is a direct image');
      finalImageUrl = url;
    } else {
      console.log('[ImageService] URL is a webpage, extracting og:image');
      // Webpage URL - extract og:image
      finalImageUrl = await extractOgImage(url, workerUrl);
    }
    
    console.log('[ImageService] Final image URL:', finalImageUrl);
    
    // Fetch the image via the Cloudflare worker proxy
    const imageBlob = await fetchImageViaProxy(finalImageUrl, workerUrl);
    
    // Convert to File object with the specified filename
    const imageFile = blobToFile(imageBlob, 'imported_product.jpg');
    
    console.log('[ImageService] Successfully processed product URL');
    return imageFile;
    
  } catch (error: any) {
    console.error('[ImageService] Error processing product URL:', error);
    
    // Enhance error message with context
    if (error.message.includes('404') || error.message.includes('not deployed')) {
      // Worker deployment issue - already has good error message
      throw error;
    } else if (error.message.includes('No images found')) {
      // No images on page - this is expected for some URLs
      throw error;
    } else if (error.name === 'TypeError' || error.message.includes('fetch failed')) {
      // Network error
      throw new Error(
        `Network error while processing ${url}:\n${error.message}\n\n` +
        `This could be due to:\n` +
        `1. The Cloudflare Worker being temporarily down\n` +
        `2. Network connectivity issues\n` +
        `3. The target website blocking requests\n\n` +
        `Please try again or check the worker status.`
      );
    } else {
      // Unknown error - include original message
      throw new Error(`Failed to process product URL: ${error.message}`);
    }
  }
};
