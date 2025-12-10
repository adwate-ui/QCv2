# Worker Testing Guide

## Current Version
Worker Version: 1.2.0 (includes logging and improved route matching)

## Issue Fixed
- Added request logging to help debug routing issues
- Clarified route matching logic (exact match first, then endsWith)
- Improved error logging in global error handler
- Updated version number to track deployment

## Testing the Worker Deployment

### 1. Check if Worker is Deployed and Version

```bash
curl -i https://authentiqc-worker.adwate.workers.dev/
```

**Expected Response:**
- Status: `200 OK`
- Headers should include:
  - `Access-Control-Allow-Origin: *`
  - `X-Worker-Version: 1.2.0`
- Body should be JSON with `"version": "1.2.0"`

**If you get a different version or no response:**
- The worker needs to be redeployed (see Deployment section below)

### 2. Test CORS Preflight (OPTIONS)

```bash
curl -X OPTIONS https://authentiqc-worker.adwate.workers.dev/fetch-metadata \
  -H "Origin: https://qcv2.pages.dev" \
  -H "Access-Control-Request-Method: GET" \
  -i
```

**Expected Response:**
- Status: `200 OK` or `204 No Content`
- Headers should include:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - `X-Worker-Version: 1.2.0`

### 3. Test /fetch-metadata Endpoint

```bash
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com" \
  -H "Origin: https://qcv2.pages.dev" \
  -i
```

**Expected Response:**
- Status: `200 OK` (or `502` if example.com fetch fails, which is expected)
- Headers should include:
  - `Access-Control-Allow-Origin: *`
  - `Content-Type: application/json`
  - `X-Worker-Version: 1.2.0`
- Body should be JSON (either with `"images"` array or error details)

**If you get 404:**
- The worker is not deployed or the endpoint is not being matched
- Check Cloudflare Dashboard logs for request details
- Redeploy the worker

### 4. Test with Browser Console

Open your browser's developer console on https://qcv2.pages.dev and run:

```javascript
// Test health check
fetch('https://authentiqc-worker.adwate.workers.dev/')
  .then(r => r.json())
  .then(data => {
    console.log('Worker version:', data.version);
    console.log('Endpoints:', data.endpoints);
  })
  .catch(err => console.error('Health check failed:', err));

// Test fetch-metadata endpoint
fetch('https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com')
  .then(r => r.json())
  .then(data => console.log('Metadata result:', data))
  .catch(err => console.error('Metadata fetch failed:', err));
```

**Expected:**
- No CORS errors in console
- `Worker version: 1.2.0`
- Metadata result returns JSON (with images or error)

## Deployment

### Automatic Deployment (via GitHub Actions)

The worker is automatically deployed when changes are pushed to the `main` branch.

1. **Merge this PR to `main`**
2. **Wait for GitHub Actions workflow to complete**
   - Go to: https://github.com/adwate-ui/QCv2/actions
   - Look for "Deploy Cloudflare Worker" workflow
   - Wait for it to show green checkmark

3. **Verify deployment** using the tests above

### Manual Deployment

If automatic deployment fails or you need to deploy immediately:

```bash
# From the repository root
cd worker

# Deploy using wrangler
npx wrangler@4 deploy

# Or if wrangler is installed globally
wrangler deploy
```

**Requirements:**
- Node.js 18+ installed
- Wrangler CLI installed (`npm install -g wrangler@4`)
- Cloudflare API token set in environment:
  ```bash
  export CLOUDFLARE_API_TOKEN="your-token-here"
  ```

**After deployment:**
- Test with curl commands above
- Check version is 1.2.0
- Verify CORS headers are present

## Troubleshooting

### 404 Error with No CORS Headers

**Symptoms:**
- Browser console shows: `Access to fetch at '...' has been blocked by CORS policy`
- Network tab shows: `404 (Not Found)` 
- Response has no `Access-Control-Allow-Origin` header

**Causes:**
1. **Worker not deployed** - Most common cause
   - Solution: Deploy the worker (see Deployment section)
2. **Old worker version deployed** - Worker version < 1.2.0
   - Solution: Redeploy with latest code
3. **Wrong worker URL** - URL doesn't point to the worker
   - Solution: Verify `VITE_IMAGE_PROXY_URL` is set correctly
4. **Worker failed to initialize** - Runtime error during startup
   - Solution: Check Cloudflare Dashboard logs for errors

**How to diagnose:**
1. Check deployed version:
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   ```
   - If it returns 404 or non-JSON, worker is not deployed properly
   - If version is not 1.2.0, worker needs redeployment

2. Check Cloudflare Dashboard logs:
   - Go to: Cloudflare Dashboard → Workers & Pages → authentiqc-worker → Logs
   - Look for errors or missing requests
   - If no requests appear, worker is not receiving traffic

3. Check GitHub Actions:
   - Go to: https://github.com/adwate-ui/QCv2/actions
   - Look at "Deploy Cloudflare Worker" runs
   - Check for deployment failures

### CORS Errors Still Occurring After Deployment

**If you've deployed version 1.2.0 but still see CORS errors:**

1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check browser is requesting correct URL**: 
   - Open DevTools Network tab
   - Look at the actual request URL
   - Verify it matches `https://authentiqc-worker.adwate.workers.dev/fetch-metadata`
3. **Check response headers**:
   - In Network tab, click on the failed request
   - Look at Response Headers
   - Verify `Access-Control-Allow-Origin: *` is present
   - If missing, worker is not deployed or has a bug

### Worker Won't Deploy

**If wrangler deploy fails:**

1. **Check Cloudflare API token**:
   ```bash
   echo $CLOUDFLARE_API_TOKEN
   ```
   - Should be set and valid
   - Token needs Workers write permissions

2. **Check wrangler.toml**:
   ```bash
   cat worker/wrangler.toml
   ```
   - Should have `name = "authentiqc-worker"`
   - Should have `main = "index.mjs"`
   - Should have `account_id` set

3. **Check for syntax errors**:
   ```bash
   node --check worker/index.mjs
   ```
   - Should exit with no output
   - If errors, fix syntax before deploying

4. **Check dependencies**:
   ```bash
   npm list pixelmatch pngjs jpeg-js
   ```
   - All three should be listed
   - If missing, run `npm install`

## Viewing Worker Logs

To debug issues, view real-time logs from the deployed worker:

### Via Cloudflare Dashboard
1. Go to: https://dash.cloudflare.com
2. Select your account
3. Go to: Workers & Pages
4. Click: authentiqc-worker
5. Click: Logs
6. Set filter to show all logs
7. Make a request to the worker
8. Watch logs appear in real-time

### Via Wrangler CLI
```bash
cd worker
npx wrangler@4 tail
```

**What to look for in logs:**
- `[Worker] GET /fetch-metadata` - Request received
- `[Worker] 404 - Path not found: /some-path` - Route not matched
- `[Worker] Unhandled error:` - Runtime error occurred
- If no logs appear, worker is not receiving requests

## Related Documentation

- [CLOUDFLARE_DEPLOYMENT_GUIDE.md](../CLOUDFLARE_DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [IMAGE_FETCHING_GUIDE.md](../IMAGE_FETCHING_GUIDE.md) - Image fetching troubleshooting
- [WORKER_CORS_FIX_GUIDE.md](../WORKER_CORS_FIX_GUIDE.md) - Previous CORS fix documentation
- [worker/README.md](README.md) - Worker-specific documentation
