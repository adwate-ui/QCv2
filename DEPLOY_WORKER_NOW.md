# CORS 404 Error Fix - Action Required

## Current Situation

You're seeing this error:
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...' 
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=... net::ERR_FAILED 404 (Not Found)
```

## Root Cause

The worker code in this repository is **correct** and includes proper CORS headers on all responses. However, the **deployed worker** at Cloudflare is either:

1. **Not deployed** (most likely)
2. **Outdated** (old version without CORS fixes)
3. **Failed to initialize** (dependency or runtime error)

## Fix - Deploy the Worker

### Option 1: Automatic Deployment (Recommended)

**Merge this PR to `main` branch**, then:

1. Wait for GitHub Actions workflow "Deploy Cloudflare Worker" to complete
2. Check workflow status: https://github.com/adwate-ui/QCv2/actions
3. Look for green checkmark ✓

**Then verify deployment:**
```bash
curl https://authentiqc-worker.adwate.workers.dev/
```

Expected output should include:
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.2.0",
  "status": "ok",
  ...
}
```

If version is `1.2.0`, the fix is deployed! ✓

### Option 2: Manual Deployment

If GitHub Actions fails or you need immediate deployment:

```bash
# From repository root
cd cloudflare-worker

# Set your Cloudflare API token
export CLOUDFLARE_API_TOKEN="your-token-here"

# Run the deployment script
./deploy.sh

# Or deploy directly with wrangler
npx wrangler@4 deploy
```

**Get your Cloudflare API token:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Create token with "Edit Cloudflare Workers" template
3. Copy the token

## Verification Checklist

After deployment, verify the fix:

- [ ] **Health check returns version 1.2.0**
  ```bash
  curl https://authentiqc-worker.adwate.workers.dev/
  ```
  
- [ ] **CORS headers are present**
  ```bash
  curl -I https://authentiqc-worker.adwate.workers.dev/ | grep -i access-control
  ```
  Should show: `Access-Control-Allow-Origin: *`

- [ ] **fetch-metadata endpoint works**
  ```bash
  curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com"
  ```
  Should return JSON (not 404)

- [ ] **No CORS errors in browser**
  - Open https://qcv2.pages.dev
  - Open browser DevTools (F12)
  - Try to identify a product from URL
  - Check Console tab - should have no CORS errors
  - Check Network tab - `/fetch-metadata` request should return 200 or 502 (not 404)

## Why This Happened

The worker code was correct, but it wasn't deployed to Cloudflare. Possible reasons:

1. **GitHub Actions not configured** - Check if workflow has required secrets
2. **Manual deployment needed** - Code was committed but not deployed
3. **Deployment failed** - Check GitHub Actions logs for errors
4. **Worker cache** - Cloudflare cached old worker version

## What Changed in This Fix

1. **Added request logging** - Every request now logs to Cloudflare logs
2. **Updated version to 1.2.0** - Easier to verify which version is deployed
3. **Improved error logging** - Better debugging information
4. **Created deployment tools** - `deploy.sh` script for easy deployment
5. **Created testing guide** - `test-worker.md` with comprehensive tests

## Still Getting Errors?

### If health check fails (no response or wrong version):

```bash
# Check if worker is deployed at all
curl https://authentiqc-worker.adwate.workers.dev/
```

- **No response or HTML page**: Worker not deployed - run deployment (see above)
- **Version not 1.2.0**: Old version deployed - redeploy with latest code
- **404 error**: Worker doesn't exist - check worker name in wrangler.toml

### If CORS headers missing after deployment:

1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
2. **Wait 30 seconds**: Cloudflare may be caching old version
3. **Check in private/incognito window**: Avoid browser cache
4. **Use curl to verify**: Tests without browser cache

### If fetch-metadata returns 404 after deployment:

```bash
# Test the exact endpoint
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com"
```

- **Still 404**: Check Cloudflare logs for errors
- **Different error**: Worker is working, but has different issue
- **Success**: Frontend may be caching, hard refresh browser

### Check Cloudflare Logs

View real-time logs to see what's happening:

**Via Dashboard:**
1. Go to: https://dash.cloudflare.com
2. Workers & Pages → authentiqc-worker → Logs
3. Make a request and watch for log entries

**Via CLI:**
```bash
cd cloudflare-worker
npx wrangler@4 tail
```

Look for:
- `[Worker] GET /fetch-metadata` - Request received ✓
- `[Worker] 404 - Path not found` - Route not matched ✗
- `[Worker] Unhandled error` - Runtime error ✗
- No logs at all - Worker not receiving requests ✗

## Support

If you've deployed the worker and verified version 1.2.0 but still have issues:

1. **Check logs** (see above)
2. **Export logs** and share them
3. **Test with curl** and share output
4. **Check browser DevTools Network tab** and share request/response details

## Summary

**The fix is ready in the code.** It just needs to be **deployed** to Cloudflare.

**Quick fix**: Merge this PR to main, wait for GitHub Actions, then verify version 1.2.0 is deployed.

**Manual fix**: Run `./cloudflare-worker/deploy.sh` after setting `CLOUDFLARE_API_TOKEN`.
