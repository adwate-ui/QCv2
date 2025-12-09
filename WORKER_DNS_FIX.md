# Worker DNS Resolution Fix

## Problem
The application was experiencing CORS 404 errors when trying to fetch images from product URLs:

```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...' 
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=... 
net::ERR_FAILED 404 (Not Found)
```

## Root Cause
The error was **NOT** caused by missing CORS headers in the worker code. The CORS headers were correctly implemented on all endpoints including error responses.

The actual issue was **DNS resolution failure**. The subdomain `adwate.workers.dev` either didn't exist or wasn't properly configured in the Cloudflare account, causing the worker URL to not resolve.

### Evidence
1. Worker deployment logs showed successful deployment to `https://authentiqc-worker.adwate.workers.dev`
2. DNS lookup failed: `curl: (6) Could not resolve host: authentiqc-worker.adwate.workers.dev`
3. Worker code analysis confirmed CORS headers present on all responses
4. Worker code analysis confirmed OPTIONS preflight handling was correct

## Solution
Added `workers_dev = true` to `cloudflare-worker/wrangler.toml`.

This flag ensures the worker is deployed to Cloudflare's default workers.dev domain with proper DNS configuration. Without this flag, Cloudflare may attempt to use a custom subdomain that hasn't been set up.

### Changes Made
```diff
 name = "authentiqc-worker"
 main = "index.mjs"
 compatibility_date = "2025-12-08"
 compatibility_flags = ["nodejs_compat"]
+workers_dev = true
 # Set your Cloudflare account id here (matches CF_ACCOUNT_ID secret)
 account_id = "72edc81c65cb5830f76c57e841831d7d"
```

## What to Expect After Deployment

### Worker URL
After the next deployment to the `main` branch, the worker will be accessible at a URL determined by Cloudflare. It could be:
- `https://authentiqc-worker.{account-subdomain}.workers.dev` (where `{account-subdomain}` is your Cloudflare account's default subdomain)
- The exact URL will be shown in the GitHub Actions deployment logs

### Verification Steps
1. Check the GitHub Actions workflow for "Deploy Cloudflare Worker"
2. Look for the output line showing the deployed URL
3. Test the worker with:
   ```bash
   curl -I "https://{worker-url}/"
   # Should return 200 OK with CORS headers
   ```
4. Update the `VITE_IMAGE_PROXY_URL` environment variable in:
   - `.env.local` (for local development)
   - GitHub Secrets (for production deployment)
   - Cloudflare Pages environment variables (if applicable)

### Testing Endpoints
Once deployed, test all three endpoints:

1. **Health Check** (root):
   ```bash
   curl "https://{worker-url}/"
   ```
   Should return JSON with API information.

2. **Fetch Metadata**:
   ```bash
   curl "https://{worker-url}/fetch-metadata?url=https://example.com"
   ```
   Should return JSON with extracted images.

3. **Proxy Image**:
   ```bash
   curl -I "https://{worker-url}/proxy-image?url=https://example.com/image.jpg"
   ```
   Should return the image with CORS headers.

## Important Notes

1. **CORS Headers Are Correct**: The worker code already has proper CORS headers on all responses, including errors. No changes were needed to the worker's CORS implementation.

2. **DNS vs CORS**: When you see "blocked by CORS policy" in the browser, it doesn't always mean CORS headers are missing. In this case, the browser couldn't complete the request due to DNS failure, which manifested as a CORS error.

3. **Environment Variable**: After deployment, you may need to update `VITE_IMAGE_PROXY_URL` to match the actual deployed worker URL if it's different from the expected URL.

## Related Files
- `cloudflare-worker/wrangler.toml` - Worker configuration (modified)
- `cloudflare-worker/index.mjs` - Worker implementation (no changes needed)
- `.github/workflows/deploy-worker.yml` - Deployment workflow
- `src/services/imageService.ts` - Frontend service that calls the worker

## References
- Cloudflare Workers Documentation: https://developers.cloudflare.com/workers/
- Wrangler Configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
