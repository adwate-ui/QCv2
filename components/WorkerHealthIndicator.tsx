import React, { useEffect, useState } from 'react';
import { workerHealthService, type WorkerHealthStatus } from '@/services/workerHealthService';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

/**
 * WorkerHealthIndicator - Shows the health status of the Cloudflare Worker
 * 
 * Displays a badge indicating whether the worker is healthy, unhealthy, or being checked.
 * Provides clear feedback to users about worker availability and prevents confusion
 * when CORS 404 errors occur due to worker deployment issues.
 */
export const WorkerHealthIndicator: React.FC = () => {
  const [health, setHealth] = useState<WorkerHealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const status = await workerHealthService.checkHealth(true); // Force refresh
      setHealth(status);
      setLastChecked(new Date());
    } catch (error) {
      console.error('[WorkerHealthIndicator] Error checking health:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check health on mount
    checkHealth();

    // Refresh every 60 seconds
    const interval = setInterval(checkHealth, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!health) {
    return null;
  }

  const getStatusColor = () => {
    if (isChecking) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (health.isHealthy) return 'bg-green-100 text-green-800 border-green-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getStatusIcon = () => {
    if (isChecking) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (health.isHealthy) return <CheckCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    if (health.isHealthy) return `Worker Online${health.workerVersion ? ` (v${health.workerVersion})` : ''}`;
    return 'Worker Offline';
  };

  const getTooltipText = () => {
    if (health.isHealthy) {
      return `The Cloudflare Worker is online and responding. Last checked: ${lastChecked?.toLocaleTimeString() || 'unknown'}`;
    }
    
    const circuitBreaker = workerHealthService.getCircuitBreakerStatus();
    const circuitInfo = circuitBreaker.state === 'OPEN' 
      ? `Circuit breaker is open (${circuitBreaker.failureCount} failures). Will retry at ${new Date(circuitBreaker.nextRetryTime).toLocaleTimeString()}.`
      : '';

    return `${health.error || 'Worker is not responding.'} ${circuitInfo}`;
  };

  return (
    <div className="relative group">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${getStatusColor()}`}
        title={getTooltipText()}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        
        {!isChecking && (
          <button
            onClick={checkHealth}
            className="ml-1 hover:opacity-70 transition-opacity"
            aria-label="Refresh health status"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Tooltip on hover */}
      <div className="absolute left-0 top-full mt-2 w-80 p-3 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="text-sm text-slate-700">
          <p className="font-semibold mb-2">Worker Status</p>
          <p className="mb-2">{getTooltipText()}</p>
          
          {!health.isHealthy && (
            <div className="mt-3 p-2 bg-slate-50 rounded text-xs">
              <p className="font-semibold text-slate-800 mb-1">Troubleshooting:</p>
              <ol className="list-decimal ml-4 space-y-1 text-slate-600">
                <li>Check if VITE_IMAGE_PROXY_URL is configured</li>
                <li>Verify worker deployment in GitHub Actions</li>
                <li>Test worker URL in browser</li>
                <li>See CORS_404_QUICK_FIX.md for details</li>
              </ol>
            </div>
          )}

          {health.isHealthy && (
            <div className="mt-2 text-xs text-slate-500">
              <p>Last checked: {lastChecked?.toLocaleString() || 'N/A'}</p>
              {health.workerVersion && <p>Version: {health.workerVersion}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Error details (shown when unhealthy) */}
      {!health.isHealthy && !isChecking && (
        <div className="absolute left-0 top-full mt-1 w-96 p-4 bg-red-50 border-2 border-red-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-2">Worker Unavailable</h4>
              <p className="text-sm text-red-800 mb-3">
                The Cloudflare Worker is not responding. Image fetching from URLs will not work until the worker is available.
              </p>
              
              {health.consecutiveFailures > 0 && (
                <p className="text-xs text-red-700 mb-3">
                  Consecutive failures: {health.consecutiveFailures}
                </p>
              )}

              <div className="text-xs text-red-700 space-y-1">
                <p className="font-semibold">Quick fixes:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Check worker URL: <code className="bg-red-100 px-1 rounded">curl https://authentiqc-worker.adwate.workers.dev/</code></li>
                  <li>View deployment status in <a href="https://github.com/adwate-ui/QCv2/actions" target="_blank" rel="noopener noreferrer" className="underline">GitHub Actions</a></li>
                  <li>See <a href="https://github.com/adwate-ui/QCv2/blob/main/CORS_404_QUICK_FIX.md" target="_blank" rel="noopener noreferrer" className="underline">Quick Fix Guide</a></li>
                </ul>
              </div>

              <button
                onClick={checkHealth}
                className="mt-3 w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Retry Health Check
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Simple version for use in layouts or headers
 */
export const WorkerHealthBadge: React.FC = () => {
  const [health, setHealth] = useState<WorkerHealthStatus | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      const status = await workerHealthService.checkHealth();
      setHealth(status);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  return (
    <div className="flex items-center gap-2">
      {health.isHealthy ? (
        <div className="flex items-center gap-1 text-green-600 text-xs">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Worker Online</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-600 text-xs">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span>Worker Offline</span>
        </div>
      )}
    </div>
  );
};
