/**
 * Cloudflare Worker Health Check Service
 * 
 * This service provides health checking, circuit breaker pattern, and resilience
 * for the Cloudflare Worker API. It prevents CORS 404 errors by:
 * - Checking worker health before making requests
 * - Implementing circuit breaker to avoid repeated failures
 * - Providing clear error messages when worker is down
 * - Caching health status to reduce unnecessary health checks
 */

interface WorkerHealthStatus {
  isHealthy: boolean;
  lastChecked: number;
  workerVersion: string | null;
  error: string | null;
  consecutiveFailures: number;
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
}

// Constants
const HEALTH_CHECK_CACHE_MS = 30000; // Cache health status for 30 seconds
const CIRCUIT_BREAKER_THRESHOLD = 3; // Open circuit after 3 failures
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // Try again after 60 seconds
const HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 second timeout for health checks
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class WorkerHealthService {
  private healthStatus: WorkerHealthStatus | null = null;
  private circuitBreaker: CircuitBreakerState = {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    nextRetryTime: 0,
  };

  /**
   * Get environment variable from various sources
   */
  private getEnv(key: string): string {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key] as string;
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored) return stored;
    }
    return '';
  }

  /**
   * Normalize worker URL by removing endpoint paths
   */
  private normalizeWorkerUrl(workerUrl: string): string {
    if (!workerUrl) return workerUrl;
    
    let normalized = workerUrl.replace(/\/$/, '');
    const endpointPaths = ['/fetch-metadata', '/proxy-image', '/proxy', '/diff'];
    
    for (const path of endpointPaths) {
      if (normalized.endsWith(path)) {
        normalized = normalized.slice(0, -path.length);
        break;
      }
    }
    
    return normalized;
  }

  /**
   * Get worker URL from environment
   */
  getWorkerUrl(): string | null {
    const url = this.getEnv('VITE_IMAGE_PROXY_URL');
    if (!url) {
      console.warn('[WorkerHealth] VITE_IMAGE_PROXY_URL not configured');
      return null;
    }
    return this.normalizeWorkerUrl(url);
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(): boolean {
    const now = Date.now();
    
    if (this.circuitBreaker.state === 'OPEN') {
      if (now >= this.circuitBreaker.nextRetryTime) {
        // Transition to HALF_OPEN to try again
        this.circuitBreaker.state = 'HALF_OPEN';
        console.log('[WorkerHealth] Circuit breaker transitioning to HALF_OPEN');
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    this.circuitBreaker.failureCount = 0;
    if (this.circuitBreaker.state !== 'CLOSED') {
      console.log('[WorkerHealth] Circuit breaker closing after successful call');
      this.circuitBreaker.state = 'CLOSED';
    }
  }

  /**
   * Record a failed call
   */
  private recordFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextRetryTime = Date.now() + CIRCUIT_BREAKER_TIMEOUT_MS;
      console.error(
        `[WorkerHealth] Circuit breaker opened after ${this.circuitBreaker.failureCount} failures. ` +
        `Will retry at ${new Date(this.circuitBreaker.nextRetryTime).toISOString()}`
      );
    }
  }

  /**
   * Perform health check with timeout
   */
  private async performHealthCheckWithTimeout(workerUrl: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(`${workerUrl}/`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check worker health by calling the root endpoint
   */
  async checkHealth(forceRefresh: boolean = false): Promise<WorkerHealthStatus> {
    const workerUrl = this.getWorkerUrl();
    
    if (!workerUrl) {
      return {
        isHealthy: false,
        lastChecked: Date.now(),
        workerVersion: null,
        error: 'VITE_IMAGE_PROXY_URL is not configured. Please set the Cloudflare Worker URL in your environment variables.',
        consecutiveFailures: 0,
      };
    }

    // Return cached status if available and recent
    const now = Date.now();
    if (
      !forceRefresh &&
      this.healthStatus &&
      (now - this.healthStatus.lastChecked) < HEALTH_CHECK_CACHE_MS
    ) {
      return this.healthStatus;
    }

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      const waitSeconds = Math.ceil((this.circuitBreaker.nextRetryTime - now) / 1000);
      return {
        isHealthy: false,
        lastChecked: now,
        workerVersion: null,
        error: `Worker is temporarily unavailable (circuit breaker open). Retrying in ${waitSeconds}s.`,
        consecutiveFailures: this.circuitBreaker.failureCount,
      };
    }

    // Perform health check with retries
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.performHealthCheckWithTimeout(workerUrl);
        
        if (!response.ok) {
          lastError = new Error(`Worker returned ${response.status}: ${response.statusText}`);
          
          // Retry on 5xx errors or 429 (rate limit)
          if ((response.status >= 500 || response.status === 429) && attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
            continue;
          }
          
          // Non-retriable error
          this.recordFailure();
          this.healthStatus = {
            isHealthy: false,
            lastChecked: now,
            workerVersion: null,
            error: `Worker health check failed: HTTP ${response.status}. The worker may not be deployed or is returning errors.`,
            consecutiveFailures: this.circuitBreaker.failureCount,
          };
          return this.healthStatus;
        }

        // Check content type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          this.recordFailure();
          this.healthStatus = {
            isHealthy: false,
            lastChecked: now,
            workerVersion: null,
            error: `Worker health check failed: Expected JSON response but got ${contentType}. This usually means the worker is not deployed at this URL.`,
            consecutiveFailures: this.circuitBreaker.failureCount,
          };
          return this.healthStatus;
        }

        // Parse response
        const data = await response.json();
        const version = response.headers.get('X-Worker-Version') || data.version || 'unknown';

        // Success
        this.recordSuccess();
        this.healthStatus = {
          isHealthy: true,
          lastChecked: now,
          workerVersion: version,
          error: null,
          consecutiveFailures: 0,
        };
        
        console.log(`[WorkerHealth] Worker is healthy (version: ${version})`);
        return this.healthStatus;

      } catch (error: any) {
        lastError = error;
        
        // Retry on network errors
        if (attempt < MAX_RETRIES - 1) {
          console.warn(`[WorkerHealth] Attempt ${attempt + 1} failed, retrying...`, error.message);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
          continue;
        }
      }
    }

    // All retries failed
    this.recordFailure();
    
    const errorMessage = lastError?.name === 'AbortError'
      ? `Worker health check timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s. The worker may be down or unreachable.`
      : lastError?.message?.includes('fetch')
      ? `Cannot reach worker at ${workerUrl}. Network error: ${lastError.message}. Please check if the worker is deployed and the URL is correct.`
      : `Worker health check failed: ${lastError?.message || 'Unknown error'}`;

    this.healthStatus = {
      isHealthy: false,
      lastChecked: now,
      workerVersion: null,
      error: errorMessage,
      consecutiveFailures: this.circuitBreaker.failureCount,
    };

    console.error('[WorkerHealth] Health check failed:', errorMessage);
    return this.healthStatus;
  }

  /**
   * Ensure worker is healthy before making a request
   * Throws error with user-friendly message if worker is down
   */
  async ensureHealthy(): Promise<void> {
    const health = await this.checkHealth();
    
    if (!health.isHealthy) {
      const errorDetails = health.error || 'Worker is not healthy';
      const troubleshootingTips = [
        '\n\nPossible solutions:',
        '1. Check if VITE_IMAGE_PROXY_URL is set correctly in your environment',
        '2. Verify the Cloudflare Worker is deployed (see CLOUDFLARE_DEPLOYMENT_GUIDE.md)',
        '3. Test the worker URL directly in your browser',
        '4. Check the GitHub Actions logs for deployment failures',
        '5. If the issue persists, contact support with this error message',
      ].join('\n');
      
      throw new Error(`${errorDetails}${troubleshootingTips}`);
    }
  }

  /**
   * Get current health status (cached)
   */
  getCurrentStatus(): WorkerHealthStatus | null {
    return this.healthStatus;
  }

  /**
   * Reset circuit breaker (useful for testing or manual override)
   */
  resetCircuitBreaker(): void {
    console.log('[WorkerHealth] Circuit breaker manually reset');
    this.circuitBreaker = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
    };
    this.healthStatus = null;
  }

  /**
   * Get circuit breaker status for debugging
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }
}

// Singleton instance
export const workerHealthService = new WorkerHealthService();

// Export for testing
export type { WorkerHealthStatus, CircuitBreakerState };
