# Worker Deployment Troubleshooting

## Issue: 404 Error Without CORS Headers

If you're seeing this error:
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...'
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...
net::ERR_FAILED 404 (Not Found)
```

This indicates the worker is NOT deployed or NOT responding.

## Why This Happens

A 404 error **without CORS headers** means:
- The request is NOT reaching the worker code at all
- Cloudflare infrastructure is returning a 404 (before the worker executes)
- This happens when:
  1. The worker is not deployed
  2. The worker deployment failed
  3. The worker URL is incorrect
  4. There's an account/routing issue

Note: If the worker WAS running, even a 404 from the worker code would include CORS headers (see the 404 handler in `cloudflare-worker/index.mjs` in the `handleRequest` function).

## Quick Checks

### 1. Verify Worker is Deployed

```bash
# Test the health check endpoint
curl -i https://authentiqc-worker.adwate.workers.dev/

# Should return:
# HTTP/2 200
# Access-Control-Allow-Origin: *
# Content-Type: application/json
# {"name":"AuthentiqC Image Proxy Worker","version":"1.2.0","status":"ok",...}
```

**If you get a 404 or 404 without CORS headers**: The worker is NOT deployed.

**If you get a 200 with JSON**: The worker IS deployed and working.

### 2. Check GitHub Actions

1. Go to: https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml
2. Check the most recent run
3. Look for errors in the "Publish worker" or "Verify worker deployment" steps

Common errors:
- `Error: Your Cloudflare API token is invalid` → CF_API_TOKEN secret is wrong/expired
- `Error: Missing account_id` → CF_ACCOUNT_ID secret not set
- `npm install failed` → Dependency installation issue
- Network errors → Temporary Cloudflare API issues

### 3. Check Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com
2. Navigate to: Workers & Pages → Overview
3. Look for: `authentiqc-worker`

If you DON'T see it: The worker is not deployed.
If you see it: Click on it and check:
- Status: Should be "Active"
- Last updated: Should be recent
- Routes: Should show `*.workers.dev` route
- Logs: Check for errors

## How to Fix

### Option 1: Trigger Manual Deployment

1. Go to: https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml
2. Click "Run workflow"
3. Select branch: `main`
4. Click "Run workflow"
5. Wait for deployment to complete
6. Check verification step output

### Option 2: Deploy Locally

If you have wrangler and Cloudflare credentials:

```bash
cd cloudflare-worker

# Make sure dependencies are installed
npm install

# Deploy
npx wrangler@4 deploy

# Or use the deploy script
./deploy.sh
```

### Option 3: Push to Main Branch

The worker auto-deploys when code is pushed to `main`:

```bash
git checkout main
git pull origin main
git push origin main
```

This will trigger the deploy-worker.yml workflow.

## Required GitHub Secrets

Ensure these secrets are set in: Repository → Settings → Secrets and variables → Actions

1. **CF_API_TOKEN**
   - Cloudflare API token with Workers permission
   - Get from: https://dash.cloudflare.com/profile/api-tokens
   - Required permissions: "Edit Cloudflare Workers"

2. **CF_ACCOUNT_ID**
   - Your Cloudflare account ID
   - Get from: Cloudflare Dashboard → Workers & Pages → right sidebar
   - Format: 32-character hexadecimal string

3. **VITE_IMAGE_PROXY_URL**
   - Worker URL: `https://authentiqc-worker.adwate.workers.dev`
   - This is used by the frontend to call the worker
   - Set this AFTER the worker is deployed

## Verification Steps

After deployment:

```bash
# 1. Health check
curl https://authentiqc-worker.adwate.workers.dev/
# Expected: {"name":"AuthentiqC Image Proxy Worker","version":"1.2.0",...}

# 2. Test fetch-metadata
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com"
# Expected: {"images":[...]} or error with CORS headers

# 3. Test CORS
curl -I https://authentiqc-worker.adwate.workers.dev/
# Expected: Access-Control-Allow-Origin: *

# 4. Test from browser console (on https://qcv2.pages.dev)
fetch('https://authentiqc-worker.adwate.workers.dev/')
  .then(r => r.json())
  .then(console.log)
# Expected: {name: "AuthentiqC Image Proxy Worker", ...}
```

## Recent Changes

### December 10, 2025

**Changes made to fix deployment:**

1. **wrangler.toml** - Removed hardcoded account_id
   - Account ID is now inferred from CF_API_TOKEN
   - Reduces risk of account mismatch
   - Falls back to CLOUDFLARE_ACCOUNT_ID env var

2. **deploy-worker.yml** - Enhanced workflow
   - Added manual trigger (workflow_dispatch)
   - Added code syntax validation
   - Added deployment verification steps
   - Tests health check endpoint
   - Tests fetch-metadata endpoint
   - Verifies CORS headers present

3. **Verification** - Auto-tests after deployment
   - Fails CI if worker not accessible
   - Provides immediate feedback on deployment issues
   - Checks both health and functional endpoints

## Prevention

To avoid this issue in the future:

1. ✅ Monitor GitHub Actions after pushing to main
2. ✅ Check the "Verify worker deployment" step output
3. ✅ Set up Cloudflare notifications for worker failures
4. ✅ Test worker endpoints after each deployment
5. ✅ Keep CF_API_TOKEN and CF_ACCOUNT_ID secrets up to date

## Common Mistakes

❌ **Hardcoding account_id in wrangler.toml**
- Can cause issues if token belongs to different account
- Now fixed by removing hardcoded value

❌ **Not checking deployment logs**
- Deployments can fail silently
- Now fixed with verification step

❌ **Wrong worker URL in VITE_IMAGE_PROXY_URL**
- Must match actual deployed worker URL
- Must be `https://authentiqc-worker.adwate.workers.dev` (not a subdomain of qcv2.pages.dev)

❌ **Missing GitHub secrets**
- CF_API_TOKEN required for deployment
- CF_ACCOUNT_ID required if not in wrangler.toml

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Worker Deployment Guide](./CLOUDFLARE_DEPLOYMENT_GUIDE.md)
- [Image Fetching Guide](./IMAGE_FETCHING_GUIDE.md)

## Contact

If the issue persists after following this guide:

1. Check GitHub Actions workflow logs
2. Check Cloudflare Dashboard logs
3. Check browser console for detailed error messages
4. Verify all secrets are set correctly
5. Try manual deployment with `./deploy.sh`
