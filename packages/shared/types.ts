/**
 * Shared Types for AuthentiqC
 * 
 * This file contains TypeScript type definitions shared between:
 * - Cloudflare Pages (Frontend)
 * - Cloudflare Workers (Backend/API)
 * 
 * By centralizing shared types, we ensure consistency across the entire application.
 */

// ============================================================================
// Worker API Types
// ============================================================================

/**
 * Response from the /fetch-metadata endpoint
 * Used when extracting images from a product URL
 */
export interface MetadataResponse {
  /** Array of image URLs found on the page */
  images: string[];
  /** Error message if the request failed */
  error?: string;
  /** HTTP status code if the request failed */
  status?: number;
  /** Human-readable error message */
  message?: string;
}

/**
 * Response from the /proxy-image endpoint
 * Binary image data with CORS headers
 */
export interface ImageProxyResponse {
  /** Binary image data */
  data: ArrayBuffer;
  /** Content type of the image */
  contentType: string;
}

/**
 * Response from the /diff endpoint
 * Pixel-level comparison of two images
 */
export interface ImageDiffResponse {
  /** Percentage of pixels that differ (0-100) */
  diffScore: number;
  /** Base64-encoded diff image showing differences */
  diffImage: string;
  /** Base64-encoded version of image A */
  imageA: string;
  /** Base64-encoded version of image B */
  imageB: string;
  /** Error message if the request failed */
  error?: string;
  /** Human-readable error message */
  message?: string;
}

/**
 * Standard error response from worker endpoints
 */
export interface WorkerErrorResponse {
  /** Short error identifier */
  error: string;
  /** Human-readable error message */
  message?: string;
  /** HTTP status code */
  status?: number;
  /** Additional error details */
  details?: unknown;
}

/**
 * Worker health check response
 */
export interface WorkerHealthResponse {
  /** Worker name */
  name: string;
  /** Worker version */
  version: string;
  /** Health status */
  status: 'ok' | 'error';
  /** Available endpoints */
  endpoints?: Array<{
    path: string;
    method: string;
    description: string;
  }>;
}

// ============================================================================
// Shared Configuration Types
// ============================================================================

/**
 * Configuration for image proxy worker
 */
export interface ImageProxyConfig {
  /** Worker URL (e.g., https://authentiqc-worker.adwate.workers.dev) */
  workerUrl: string;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Image metadata extracted from various sources
 */
export interface ImageMetadata {
  /** Image URL */
  url: string;
  /** Image source (og:image, twitter:image, img tag, etc.) */
  source: 'opengraph' | 'twitter' | 'jsonld' | 'img' | 'unknown';
  /** Alt text if available */
  alt?: string;
  /** Image dimensions if known */
  dimensions?: {
    width: number;
    height: number;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data if successful */
  data?: T;
  /** Error information if failed */
  error?: WorkerErrorResponse;
  /** HTTP status code */
  status: number;
  /** Whether the request was successful */
  success: boolean;
}

/**
 * Request options for fetch-metadata endpoint
 */
export interface FetchMetadataOptions {
  /** Target URL to extract metadata from */
  url: string;
  /** Maximum number of images to return */
  maxImages?: number;
}

/**
 * Request options for proxy-image endpoint
 */
export interface ProxyImageOptions {
  /** Target image URL to proxy */
  url: string;
  /** Optional referer header override */
  referer?: string;
  /** Optional user agent override */
  userAgent?: string;
  /** Optional accept header override */
  accept?: string;
}

/**
 * Request options for diff endpoint
 */
export interface ImageDiffOptions {
  /** URL of first image */
  imageA: string;
  /** URL of second image */
  imageB: string;
  /** Threshold for pixel matching (0-1) */
  threshold?: number;
}
