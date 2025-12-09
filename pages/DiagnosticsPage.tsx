import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Info, Loader2, XCircle } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export const DiagnosticsPage = () => {
  const [testUrl, setTestUrl] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (name: string, updates: Partial<TestResult>) => {
    setResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        return prev.map(r => r.name === name ? { ...r, ...updates } : r);
      } else {
        return [...prev, { name, status: 'pending', message: '', ...updates } as TestResult];
      }
    });
  };

  const runDiagnostics = async () => {
    if (!testUrl) {
      setResults([{
        name: 'validation',
        status: 'error',
        message: 'Please enter a test URL',
        details: 'Enter a valid product URL to begin diagnostics'
      }]);
      return;
    }

    setIsRunning(true);
    setResults([]);

    // Test 1: Check if VITE_IMAGE_PROXY_URL is configured
    updateResult('proxy-config', { status: 'running', message: 'Checking proxy configuration...' });
    const proxyUrl = import.meta.env?.VITE_IMAGE_PROXY_URL;
    if (!proxyUrl) {
      updateResult('proxy-config', {
        status: 'error',
        message: 'VITE_IMAGE_PROXY_URL is not configured',
        details: 'Add VITE_IMAGE_PROXY_URL=<your-cloudflare-worker-url> to your .env.local file'
      });
      setIsRunning(false);
      return;
    } else {
      updateResult('proxy-config', {
        status: 'success',
        message: `Proxy configured: ${proxyUrl}`
      });
    }

    // Test 2: Check if URL is valid
    updateResult('url-validation', { status: 'running', message: 'Validating URL...' });
    try {
      new URL(testUrl);
      updateResult('url-validation', { status: 'success', message: 'URL is valid' });
    } catch {
      updateResult('url-validation', {
        status: 'error',
        message: 'Invalid URL format',
        details: 'Please enter a valid HTTP or HTTPS URL'
      });
      setIsRunning(false);
      return;
    }

    // Test 3: Fetch metadata
    updateResult('metadata-fetch', { status: 'running', message: 'Fetching page metadata...' });
    const metadataUrl = `${proxyUrl.replace(/\/$/, '')}/fetch-metadata?url=${encodeURIComponent(testUrl)}`;
    try {
      const startTime = Date.now();
      const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(15000) });
      const elapsed = Date.now() - startTime;
      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        let errorDetails = 'Unknown error';
        
        // Try to parse as JSON if content-type suggests it
        if (contentType?.includes('application/json')) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          errorDetails = JSON.stringify(errorData, null, 2);
        } else {
          // Worker might be returning HTML (404 page) instead of JSON
          errorDetails = `Response Content-Type: ${contentType || 'not set'}\n\nThe worker may not be deployed or the URL is incorrect.\n\nExpected: application/json\nReceived: ${contentType || 'not set'}`;
        }
        
        updateResult('metadata-fetch', {
          status: 'error',
          message: `Metadata fetch failed (${response.status} ${response.statusText})`,
          details: errorDetails
        });
        setIsRunning(false);
        return;
      }

      // Check if response is JSON
      if (!contentType?.includes('application/json')) {
        updateResult('metadata-fetch', {
          status: 'error',
          message: 'Worker returned non-JSON response',
          details: `Expected: application/json\nReceived: ${contentType || 'not set'}\n\nThis usually means:\n1. The Cloudflare Worker is not deployed\n2. The VITE_IMAGE_PROXY_URL points to the wrong location\n3. The worker URL is returning a 404 page\n\nCheck IMAGE_FETCHING_GUIDE.md for setup instructions.`
        });
        setIsRunning(false);
        return;
      }

      const metadata = await response.json();

      if (metadata.error) {
        updateResult('metadata-fetch', {
          status: 'error',
          message: 'Metadata endpoint returned error',
          details: metadata.error
        });
        setIsRunning(false);
        return;
      }

      if (!metadata.images || metadata.images.length === 0) {
        updateResult('metadata-fetch', {
          status: 'warning',
          message: 'No images found on page',
          details: 'The page may not have Open Graph, Twitter Card, or img tags. Check the page source manually.'
        });
        setIsRunning(false);
        return;
      }

      updateResult('metadata-fetch', {
        status: 'success',
        message: `Found ${metadata.images.length} images (${elapsed}ms)`,
        details: `Images:\n${metadata.images.slice(0, 5).join('\n')}${metadata.images.length > 5 ? '\n...' : ''}`
      });

      // Test 4: Try fetching first image
      updateResult('image-fetch', { status: 'running', message: 'Fetching first image...' });
      const firstImageUrl = metadata.images[0];
      const proxyImageUrl = new URL('/proxy-image', proxyUrl.replace(/\/$/, ''));
      proxyImageUrl.searchParams.set('url', firstImageUrl);

      const imageStartTime = Date.now();
      const imageResponse = await fetch(proxyImageUrl.toString(), { signal: AbortSignal.timeout(10000) });
      const imageElapsed = Date.now() - imageStartTime;

      if (!imageResponse.ok) {
        updateResult('image-fetch', {
          status: 'error',
          message: `Image fetch failed (${imageResponse.status})`,
          details: `URL: ${firstImageUrl}`
        });
        setIsRunning(false);
        return;
      }

      const blob = await imageResponse.blob();

      if (!blob.type.startsWith('image/')) {
        updateResult('image-fetch', {
          status: 'warning',
          message: 'Response is not an image',
          details: `Content-Type: ${blob.type}\nSize: ${blob.size} bytes`
        });
        setIsRunning(false);
        return;
      }

      if (blob.size < 1024) {
        updateResult('image-fetch', {
          status: 'warning',
          message: 'Image is very small (likely tracking pixel)',
          details: `Size: ${blob.size} bytes`
        });
      } else {
        updateResult('image-fetch', {
          status: 'success',
          message: `Image fetched successfully (${Math.round(blob.size / 1024)}KB in ${imageElapsed}ms)`,
          details: `Content-Type: ${blob.type}\nURL: ${firstImageUrl}`
        });
      }

      // Test 5: Summary
      updateResult('summary', {
        status: 'success',
        message: '✅ All tests passed! Image fetching should work.',
        details: `The proxy is correctly configured and can fetch images from the test URL.`
      });
    } catch (error: any) {
      const errorMessage = error.name === 'TimeoutError'
        ? 'Request timed out. The website may be slow or blocking requests.'
        : error.message || String(error);

      updateResult('metadata-fetch', {
        status: 'error',
        message: 'Error during metadata fetch',
        details: errorMessage
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="animate-spin text-blue-600" size={20} />;
      case 'success':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'warning':
        return <AlertTriangle className="text-yellow-600" size={20} />;
      case 'error':
        return <XCircle className="text-red-600" size={20} />;
      default:
        return <Info className="text-gray-400" size={20} />;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold">Image Fetching Diagnostics</h1>
        <p className="text-sm text-gray-600 mt-1">Test if image fetching from product URLs is working correctly</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-bold text-lg mb-4">Test Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Test URL</label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://example.com/product/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              disabled={isRunning}
            />
            <p className="text-xs text-gray-500 mt-1">Enter any product URL to test (e.g., from Amazon, eBay, or brand websites)</p>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={isRunning || !testUrl}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
              isRunning || !testUrl
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-indigo-700'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Running Tests...
              </>
            ) : (
              'Run Diagnostics'
            )}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-bold text-lg mb-4">Test Results</h2>
          
          <div className="space-y-4">
            {results.map((result, i) => (
              <div key={i} className="border-l-4 pl-4 py-2" style={{
                borderColor: 
                  result.status === 'success' ? '#10b981' :
                  result.status === 'warning' ? '#f59e0b' :
                  result.status === 'error' ? '#ef4444' :
                  result.status === 'running' ? '#3b82f6' : '#d1d5db'
              }}>
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{result.message}</h3>
                    {result.details && (
                      <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {result.details}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info className="text-blue-600 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Troubleshooting Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Ensure VITE_IMAGE_PROXY_URL is set in your .env.local file</li>
              <li>Make sure your Cloudflare Worker is deployed and accessible</li>
              <li>Some websites block automated requests - try different product URLs</li>
              <li>Check browser console for additional error messages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
