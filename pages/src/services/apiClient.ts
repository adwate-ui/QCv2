/**
 * API request wrapper with error handling, retry logic, and logging
 * Provides a consistent interface for making API calls
 */

import { API, ERROR_MESSAGES } from './constants';
import { log } from './logger';

export interface RequestOptions extends RequestInit {
  retry?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make an API request with retry logic and error handling
 * @param url - URL to fetch
 * @param options - Request options including retry configuration
 * @returns Promise resolving to the response
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    retry = true,
    retryAttempts = API.RETRY_ATTEMPTS,
    retryDelay = API.RETRY_DELAY,
    timeout = API.GEMINI_TIMEOUT,
    ...fetchOptions
  } = options;

  const method = fetchOptions.method || 'GET';
  let lastError: Error | null = null;
  const startTime = performance.now();

  for (let attempt = 1; attempt <= (retry ? retryAttempts : 1); attempt++) {
    try {
      log.debug(`API request attempt ${attempt}/${retryAttempts}`, {
        method,
        url: url.substring(0, 100), // Truncate long URLs
      });

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const duration = performance.now() - startTime;
        log.api(method, url, response.status, duration);

        // Handle non-OK responses
        if (!response.ok) {
          let errorData: any;
          try {
            errorData = await response.json();
          } catch {
            errorData = await response.text();
          }

          throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response.statusText,
            errorData
          );
        }

        // Parse response based on content type
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else {
          return (await response.text()) as any;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = retry && attempt < retryAttempts && isRetryableError(error);

      if (shouldRetry) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        log.warn(`API request failed, retrying in ${delay}ms`, {
          attempt,
          error: lastError.message,
        });
        await sleep(delay);
      } else {
        // Log final error
        const duration = performance.now() - startTime;
        log.error('API request failed', lastError, {
          method,
          url: url.substring(0, 100),
          attempt,
          duration,
        });

        // Throw user-friendly error
        if (error instanceof ApiError) {
          throw error;
        } else if (lastError.name === 'AbortError') {
          throw new ApiError('Request timeout. Please try again.', 408);
        } else if (lastError.message.includes('Failed to fetch')) {
          throw new ApiError(ERROR_MESSAGES.NETWORK);
        } else {
          throw new ApiError(ERROR_MESSAGES.INVALID_INPUT);
        }
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Unknown error');
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Retry on network errors
  if (error.message?.includes('Failed to fetch')) {
    return true;
  }

  // Retry on timeout
  if (error.name === 'AbortError') {
    return true;
  }

  // Retry on specific HTTP status codes
  if (error instanceof ApiError) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return error.status ? retryableStatusCodes.includes(error.status) : false;
  }

  return false;
}

/**
 * POST request helper
 */
export async function post<T = any>(
  url: string,
  data?: any,
  options: RequestOptions = {}
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * GET request helper
 */
export async function get<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'GET',
  });
}

/**
 * PUT request helper
 */
export async function put<T = any>(
  url: string,
  data?: any,
  options: RequestOptions = {}
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function del<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'DELETE',
  });
}
