/**
 * Service for processing product URLs and importing images.
 * Handles both direct image URLs and webpage URLs with og:image meta tags.
 */

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
 * @param pageUrl The webpage URL to extract og:image from
 * @param workerUrl The Cloudflare worker base URL
 * @returns The og:image URL if found, or the first image URL from the page
 * @throws Error if no images are found or if the fetch fails
 */
const extractOgImage = async (pageUrl: string, workerUrl: string): Promise<string> => {
  const metadataUrl = `${workerUrl.replace(/\/$/, '')}/fetch-metadata?url=${encodeURIComponent(pageUrl)}`;
  
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata from ${pageUrl}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.images || data.images.length === 0) {
    throw new Error(`No images found on ${pageUrl}`);
  }
  
  // Return the first image (which should be og:image if available, as per worker.js implementation)
  return data.images[0];
};

/**
 * Fetches an image through the Cloudflare worker proxy endpoint.
 * @param imageUrl The image URL to fetch
 * @param workerUrl The Cloudflare worker base URL
 * @returns A Blob containing the image data
 * @throws Error if the fetch fails
 */
const fetchImageViaProxy = async (imageUrl: string, workerUrl: string): Promise<Blob> => {
  const proxyUrl = `${workerUrl.replace(/\/$/, '')}/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image via proxy: ${response.statusText}`);
  }
  
  return await response.blob();
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
 * 1. Checks if the URL is an image or a webpage
 * 2. If it's a webpage, extracts the og:image meta tag content using the Cloudflare worker
 * 3. Fetches the final image URL through the Cloudflare worker proxy endpoint
 * 4. Converts the response blob into a File object named 'imported_product.jpg'
 * 
 * @param url The product URL to process (can be an image URL or a webpage URL)
 * @returns A Promise that resolves to a File object containing the imported image
 * @throws Error if the URL cannot be processed or if the worker URL is not configured
 * 
 * @example
 * ```typescript
 * try {
 *   const imageFile = await processProductUrl('https://example.com/product');
 *   // Use imageFile for upload or display
 * } catch (error) {
 *   console.error('Failed to process URL:', error);
 * }
 * ```
 */
export const processProductUrl = async (url: string): Promise<File> => {
  // Validate the input URL
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL provided: ${url}`);
  }
  
  // Get the Cloudflare worker URL from environment
  const workerUrl = getEnv('VITE_IMAGE_PROXY_URL');
  if (!workerUrl) {
    throw new Error('VITE_IMAGE_PROXY_URL is not configured. Please set the Cloudflare worker URL.');
  }
  
  let finalImageUrl: string;
  
  // Check if the URL is a direct image or a webpage
  if (isImageUrl(url)) {
    // Direct image URL
    finalImageUrl = url;
  } else {
    // Webpage URL - extract og:image
    finalImageUrl = await extractOgImage(url, workerUrl);
  }
  
  // Fetch the image via the Cloudflare worker proxy
  const imageBlob = await fetchImageViaProxy(finalImageUrl, workerUrl);
  
  // Convert to File object with the specified filename
  const imageFile = blobToFile(imageBlob, 'imported_product.jpg');
  
  return imageFile;
};
