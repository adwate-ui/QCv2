# Cloudflare Worker CORS Fix Guide

## Overview

This document explains the CORS 404 error fix implemented in the Cloudflare Worker and how to verify it's working correctly.

## Problem

Users were experiencing CORS errors when trying to fetch images from product URLs:

```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...' 
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=... net::ERR_FAILED 404 (Not Found)
```

## Root Cause

The issue occurred when unhandled errors in the worker bypassed normal response handling, resulting in responses without proper CORS headers.

## Solution

### 1. Global Error Handler

Added a try-catch wrapper around the fetch handler to ensure CORS headers are always present:

```javascript
export default {
  fetch: async (request, env, ctx) => {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error('Unhandled error in worker:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error?.message || String(error)
      }), { 
        status: 500,
        headers: getCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }
  }
};
```

### 2. Standardized CORS Headers

Created a `getCorsHeaders()` helper function to ensure consistent CORS headers:

```javascript
function getCorsHeaders(additionalHeaders = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'X-Worker-Version': WORKER_VERSION,
    ...additionalHeaders
  };
}
```

### 3. Version Tracking

Added version header to all responses for debugging:

```javascript
const WORKER_VERSION = '1.1.0';
```

Every response now includes `X-Worker-Version` header to identify which version is deployed.

### 4. Health Check Endpoint

Added root path handler for health checks:

```bash
curl https://authentiqc-worker.adwate.workers.dev/
```

Returns:
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.1.0",
  "status": "ok",
  "endpoints": [...]
}
```

### 5. Improved Route Matching

Made route matching more explicit:

```javascript
if (pathname.endsWith('/fetch-metadata') || pathname === '/fetch-metadata') {
  // Handle request
}
```

### 6. Enhanced Error Messages

404 responses now include debugging information:

```json
{
  "error": "Not found",
  "pathname": "/invalid-path",
  "message": "The requested path '/invalid-path' does not match any known endpoints...",
  "availableEndpoints": ["/fetch-metadata", "/proxy-image", "/diff"]
}
```

## Verification Steps

### 1. Check Worker Version

```bash
curl -I https://authentiqc-worker.adwate.workers.dev/
```

Look for:
```
X-Worker-Version: 1.1.0
Access-Control-Allow-Origin: *
```

### 2. Test Health Check

```bash
curl https://authentiqc-worker.adwate.workers.dev/
```

Should return JSON with version "1.1.0" and status "ok".

### 3. Test CORS Preflight

```bash
curl -X OPTIONS https://authentiqc-worker.adwate.workers.dev/fetch-metadata \
  -H "Origin: https://qcv2.pages.dev" \
  -H "Access-Control-Request-Method: GET" \
  -i
```

Should return CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
X-Worker-Version: 1.1.0
```

### 4. Test Metadata Endpoint

```bash
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com" \
  -H "Origin: https://qcv2.pages.dev" \
  -i
```

Should return JSON with `Access-Control-Allow-Origin: *` header and `X-Worker-Version: 1.1.0`.

### 5. Test in Browser Console

Open the application in your browser and run:

```javascript
fetch('https://authentiqc-worker.adwate.workers.dev/')
  .then(r => r.json())
  .then(console.log);
```

Should return the health check response without CORS errors.

## Deployment

The worker is automatically deployed via GitHub Actions when changes are pushed to the `main` branch.

To manually deploy:

```bash
cd cloudflare-worker
npx wrangler@4 deploy
```

## Troubleshooting

### CORS Errors Still Occurring

1. **Check deployed version**: Use the health check endpoint to verify version 1.1.0 is deployed
2. **Clear browser cache**: Hard refresh or clear cache to avoid cached responses
3. **Check worker logs**: View logs in Cloudflare Dashboard → Workers → authentiqc-worker → Logs

### Worker Not Responding

1. **Verify deployment**: Check GitHub Actions workflow for deployment status
2. **Check Cloudflare Dashboard**: Ensure worker is active and has recent deployments
3. **Verify DNS/Routing**: Ensure the worker URL is correct

### Environment Variable Issues

If using `env.ENVIRONMENT` to control stack trace exposure:

1. Set in Cloudflare Dashboard: Workers → authentiqc-worker → Settings → Variables
2. Add variable: `ENVIRONMENT` = `production`
3. Redeploy worker

## Security Considerations

- Stack traces are only included in non-production environments
- SSRF protection is in place to block internal URLs
- All endpoints validate input parameters
- Rate limiting should be configured at the Cloudflare level

## Related Files

- `cloudflare-worker/index.mjs` - Main worker code
- `cloudflare-worker/wrangler.toml` - Worker configuration
- `.github/workflows/deploy-worker.yml` - Deployment workflow

## Support

If issues persist:

1. Check worker logs in Cloudflare Dashboard
2. Verify version header matches expected version (1.1.0)
3. Test endpoints directly with curl
4. Check GitHub Actions deployment logs
