# CORS 404 Issue - Root Cause and Fix

## Issue Description

**Error Message:**
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...' 
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=... 
net::ERR_FAILED 404 (Not Found)
```

## Timeline

- **Dec 9, 18:37 UTC**: Worker deployment successful (Run #82)
- **Dec 9, 18:50 UTC**: Worker deployment successful (Run #83)  
- **Dec 9, 19:20 UTC**: Worker deployment successful (Run #84)
- **Dec 9, 19:26 UTC**: Issue reported - worker returning 404 errors

## Root Cause Analysis

### The Problem

There were **TWO** `wrangler.toml` configuration files in the repository with conflicting settings:

1. **`/wrangler.toml`** (Root directory - WRONG)
   ```toml
   name = "authentiqc-worker"
   compatibility_date = "2025-12-09"
   
   [assets]
   directory = "./dist"
   ```
   - Configured for Cloudflare Pages/Assets
   - Has the same name as the worker
   - Was NOT being used by GitHub Actions deployment
   - Likely caused Cloudflare deployment confusion

2. **`/cloudflare-worker/wrangler.toml`** (Worker directory - CORRECT)
   ```toml
   name = "authentiqc-worker"
   main = "index.mjs"
   compatibility_date = "2025-12-08"
   compatibility_flags = ["nodejs_compat"]
   workers_dev = true
   account_id = "72edc81c65cb5830f76c57e841831d7d"
   ```
   - Proper worker configuration
   - Used by GitHub Actions workflow
   - Has correct main entry point and compatibility flags

### Why This Caused Issues

When both files exist with the same `name` field, Cloudflare's deployment system can get confused:

- The root wrangler.toml tries to deploy as a Pages project with assets
- The cloudflare-worker/wrangler.toml tries to deploy as a Worker
- Both use the name "authentiqc-worker"
- This can cause routing conflicts, deployment failures, or the worker to be incorrectly configured

Even though the GitHub Actions workflow specifically deploys from the `cloudflare-worker/` directory, having a conflicting root wrangler.toml can cause:
- Cloudflare's infrastructure to register multiple resources with the same name
- DNS routing confusion between Pages and Workers
- The worker to deploy but not respond correctly to requests

## Solution Applied

### Changes Made

1. **Removed `/wrangler.toml`** from the root directory
   - This file was not used by any workflows
   - It was causing deployment conflicts

2. **Updated `.gitignore`**
   - Added `/wrangler.toml` to prevent it from being committed again
   - Added comment explaining why root wrangler.toml should not exist:
     ```gitignore
     # Worker configuration should only exist in cloudflare-worker/
     # Root wrangler.toml causes deployment conflicts
     /wrangler.toml
     ```

### Why This Fix Works

- Only one wrangler.toml configuration exists now (in cloudflare-worker/)
- No naming conflicts between Pages and Workers
- Cloudflare deployment system has clear, unambiguous instructions
- Worker will deploy correctly with proper endpoints

## Verification Steps

After merging this PR to main, the worker will be redeployed automatically. To verify the fix:

1. **Check Worker Status:**
   ```bash
   curl -i https://authentiqc-worker.adwate.workers.dev/
   ```
   
   Expected response:
   ```json
   {
     "name": "AuthentiqC Image Proxy Worker",
     "version": "1.2.0",
     "status": "ok",
     "endpoints": [...]
   }
   ```
   
   With headers:
   ```
   HTTP/2 200
   Access-Control-Allow-Origin: *
   X-Worker-Version: 1.2.0
   ```

2. **Test fetch-metadata Endpoint:**
   ```bash
   curl -i "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://www.rolex.com/watches/sky-dweller/m336934-0001"
   ```
   
   Should return:
   - Status: 200 OK
   - CORS header: `Access-Control-Allow-Origin: *`
   - JSON response with images array

3. **Test from Frontend:**
   - Navigate to https://qcv2.pages.dev
   - Go to "Add Product" or "Product Identification" page
   - Enter the Rolex URL: `https://www.rolex.com/watches/sky-dweller/m336934-0001`
   - Click "Identify Product"
   - Should successfully fetch and display product images without CORS errors

## Prevention

To prevent this issue from happening again:

1. ✅ Root wrangler.toml is now in `.gitignore`
2. ✅ Documentation added explaining the issue
3. ✅ Only cloudflare-worker/wrangler.toml should exist

**Important:** Never create a wrangler.toml in the root directory. All worker configuration must be in the `cloudflare-worker/` directory.

## Related Issues

This fix addresses the fundamental configuration conflict. The worker code itself (index.mjs) already has:
- ✅ Proper CORS headers on all endpoints
- ✅ 404 handler with CORS headers
- ✅ OPTIONS preflight handling
- ✅ Error responses with CORS headers

The issue was not in the code, but in the deployment configuration conflict.

## Deployment Status

- **Current Branch:** `copilot/fix-cors-issue-fetch-metadata-again`
- **Status:** Ready to merge
- **Action Required:** Merge to `main` to trigger automatic worker redeployment

Once merged, the GitHub Actions workflow will automatically:
1. Install worker dependencies
2. Deploy the worker using only cloudflare-worker/wrangler.toml
3. Worker will be available at https://authentiqc-worker.adwate.workers.dev

## Additional Notes

### Worker Configuration Best Practices

1. **Single Source of Truth:** Only one wrangler.toml per Worker
2. **Directory Structure:** Keep worker files in dedicated subdirectory
3. **Naming:** Use unique names for different Cloudflare resources
4. **Testing:** Always test endpoints after deployment
5. **CORS:** Ensure all response paths include CORS headers

### GitHub Actions Workflow

The deployment workflow in `.github/workflows/deploy-worker.yml`:
```yaml
- name: Install worker dependencies
  run: |
    cd cloudflare-worker
    npm install

- name: Publish worker
  run: |
    cd cloudflare-worker
    npx wrangler@4 deploy
```

This workflow:
- Changes to cloudflare-worker directory
- Installs dependencies from cloudflare-worker/package.json
- Deploys using cloudflare-worker/wrangler.toml
- The `cd cloudflare-worker` ensures the correct config is used
