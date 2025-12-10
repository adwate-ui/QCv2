# Worker Connection Fix - Verification Guide

## Quick Verification

After merging this PR, follow these steps to verify the worker is back online:

### 1. Check GitHub Actions

Go to: https://github.com/adwate-ui/QCv2/actions

Look for:
- ✅ "Deploy Cloudflare Worker" workflow completed successfully
- ✅ All validation checks passed
- ✅ Worker health verification passed

### 2. Test Worker Directly

Run this command in your terminal:

```bash
curl https://authentiqc-worker.adwate.workers.dev/
```

**Expected Response (JSON):**
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.2.0",
  "status": "ok",
  "endpoints": [
    { "path": "/fetch-metadata", "method": "GET", "description": "Extract image URLs from a webpage" },
    { "path": "/proxy-image", "method": "GET", "description": "Proxy an image with CORS headers" },
    { "path": "/diff", "method": "GET", "description": "Generate a diff image (pixel comparison)" }
  ]
}
```

**❌ If you see HTML instead of JSON, the worker is still not deployed correctly.**

### 3. Check in Application UI

1. Open your application: https://qcv2.pages.dev/
2. Look for the **Worker Health Indicator** in the header/dashboard
3. Should show:
   - 🟢 **Green badge** with "Worker Online"
   - Version number (e.g., "v1.2.0")

**If you see:**
- 🔴 **Red badge** "Worker Offline" → Worker not deployed
- 🔵 **Blue badge** "Checking..." → Loading (wait a moment)

### 4. Test Image Fetching

Try to add a product from a URL:
1. Go to "Add Product" page
2. Enter a product URL (e.g., `https://www.amazon.com/dp/B08N5WRWNW`)
3. Click "Fetch Images"
4. Should see product images load successfully

**If you get CORS errors or 404s, the worker is not working.**

## What Was Fixed

### The Problem
Root `wrangler.jsonc` had the same name as the worker configuration:
- Root: `"name": "authentiqc-worker"` ❌
- Worker: `name = "authentiqc-worker"` ✓

This caused Pages deployment to overwrite the worker.

### The Solution
Changed root `wrangler.jsonc` to use Pages project name:
- Root: `"name": "qcv2"` ✓ (different from worker)
- Worker: `name = "authentiqc-worker"` ✓ (unchanged)

Now they deploy to different subdomains:
- Pages: `https://qcv2.pages.dev/`
- Worker: `https://authentiqc-worker.adwate.workers.dev/`

## Troubleshooting

### Worker Still Shows Offline

1. **Check deployment logs:**
   - Go to GitHub Actions
   - Click on latest "Deploy Cloudflare Worker" run
   - Look for errors in logs

2. **Check Cloudflare Dashboard:**
   - Go to https://dash.cloudflare.com
   - Navigate to Workers & Pages
   - Find "authentiqc-worker"
   - Check status and logs

3. **Manual deployment:**
   If automatic deployment failed, deploy manually:
   ```bash
   cd cloudflare-worker
   npx wrangler@4 deploy --config wrangler.toml
   ```

### Validation Script Fails

If `.github/scripts/validate-wrangler-configs.sh` reports an error:

1. Check `wrangler.jsonc` has `"name": "qcv2"`
2. Check `cloudflare-worker/wrangler.toml` has `name = "authentiqc-worker"`
3. Make sure names are different

### CORS Errors Still Occur

If you still get CORS errors after fixing:

1. Verify worker is online (step 2 above)
2. Check `VITE_IMAGE_PROXY_URL` is set correctly in production
3. Clear browser cache and hard refresh (Ctrl+Shift+R)
4. Check Network tab in DevTools for actual error

## Prevention

This issue won't happen again because:

1. ✅ **Validation Script** - Automatically checks for name conflicts
2. ✅ **CI/CD Integration** - Runs before every deployment
3. ✅ **Clear Documentation** - Comments explain the separation
4. ✅ **Build Failure** - Deployment fails if conflict detected

## Related Files

- `wrangler.jsonc` - Fixed configuration
- `.github/scripts/validate-wrangler-configs.sh` - Validation script
- `.github/workflows/deploy-worker.yml` - Worker deployment with validation
- `.github/workflows/deploy.yml` - Pages deployment with validation
- `WORKER_NAME_CONFLICT_FIX.md` - Detailed explanation of the fix

## Support

If the worker is still offline after following these steps:
1. Check GitHub Actions logs for deployment errors
2. Review `WORKER_NAME_CONFLICT_FIX.md` for detailed troubleshooting
3. Contact support with the GitHub Actions logs
