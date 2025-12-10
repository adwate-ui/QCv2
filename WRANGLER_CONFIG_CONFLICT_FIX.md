# Wrangler Configuration Conflict Fix - December 10, 2025

## Issue Description

Worker deployment failing with error:
```
✘ [ERROR] The directory specified by the "assets.directory" field in your configuration file does not exist:
  /home/runner/work/QCv2/QCv2/dist
```

This resulted in CORS 404 errors on production:
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...' 
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=... 
net::ERR_FAILED 404 (Not Found)
```

## Root Cause

The repository has TWO wrangler configuration files:

1. **`/wrangler.jsonc`** (Root) - For Cloudflare Pages deployment
   ```jsonc
   {
     "name": "authentiqc-app",
     "compatibility_date": "2025-12-10",
     "assets": {
       "directory": "./dist"
     }
   }
   ```

2. **`/cloudflare-worker/wrangler.toml`** (Worker) - For Cloudflare Worker deployment
   ```toml
   name = "authentiqc-worker"
   main = "index.mjs"
   compatibility_date = "2025-12-08"
   compatibility_flags = ["nodejs_compat"]
   workers_dev = true
   account_id = "72edc81c65cb5830f76c57e841831d7d"
   ```

### The Problem

When running `wrangler deploy` from the `cloudflare-worker/` directory, Wrangler was automatically discovering and merging configuration from BOTH files:
- Despite different project names ("authentiqc-app" vs "authentiqc-worker")
- Despite being in different directories
- Despite different file formats (.jsonc vs .toml)

The root `wrangler.jsonc` has an `assets.directory` field pointing to `./dist`, which doesn't exist relative to the worker directory, causing deployment to fail.

## Solution

Use the `--config` flag to explicitly specify which wrangler configuration file to use during deployment.

### Changes Made

**File: `.github/workflows/deploy-worker.yml`**
```diff
  - name: Publish worker
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
    run: |
      # Deploy from the cloudflare-worker directory to ensure wrangler.toml is used
      # This ensures compatibility flags (nodejs_compat) are properly applied
+     # Use --config flag to explicitly specify wrangler.toml and avoid picking up root wrangler.jsonc
      cd cloudflare-worker
-     npx wrangler@4 deploy
+     npx wrangler@4 deploy --config wrangler.toml
```

**File: `.gitignore`**
```diff
  # Worker configuration should only exist in cloudflare-worker/
  # Root wrangler.toml causes deployment conflicts with the worker
  # See CORS_404_FIX_SUMMARY.md for details
+ # NOTE: wrangler.jsonc in root is OK - it's for Pages deployment (different name: authentiqc-app)
+ #       Worker deployment explicitly uses --config wrangler.toml flag to avoid conflicts
  /wrangler.toml
```

## Why This Solution Is Better

### Previous Attempts
Previous fixes tried to remove/rename the root wrangler configuration files, but this created other challenges:
- Root `wrangler.toml` was gitignored (now understood why)
- Root `wrangler.jsonc` serves a legitimate purpose for Pages deployment
- Removing it would break Pages deployment configuration

### Current Solution Benefits
1. ✅ **Preserves both configurations** - Pages and Worker configs can coexist
2. ✅ **Explicit over implicit** - No ambiguity about which config is used
3. ✅ **No file renaming needed** - Both files keep their standard names
4. ✅ **Minimal changes** - One flag addition to the workflow
5. ✅ **Clear documentation** - Comments explain why the flag is needed

## How It Works

The `--config` flag tells Wrangler to:
1. Use ONLY the specified configuration file
2. Ignore any other wrangler.* files in parent directories
3. Resolve all paths relative to the specified config file's directory

This ensures that:
- Worker deployment uses `cloudflare-worker/wrangler.toml` exclusively
- Pages deployment can still use root `wrangler.jsonc` if needed
- No configuration merging or conflicts occur

## Verification

After merging this PR to main, the deployment should succeed:

1. **Check GitHub Actions**
   - Navigate to: https://github.com/adwate-ui/QCv2/actions
   - Look for successful "Deploy Cloudflare Worker" workflow
   - Should see: "Deployed authentiqc-worker triggers"

2. **Test Worker Health**
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
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

3. **Test CORS Headers**
   ```bash
   curl -I https://authentiqc-worker.adwate.workers.dev/
   ```
   Should include:
   ```
   Access-Control-Allow-Origin: *
   X-Worker-Version: 1.2.0
   ```

4. **Test fetch-metadata Endpoint**
   ```bash
   curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://www.chrono24.com/rado/centrix-11509273-38mm-ceramic-watch--id39050769.htm"
   ```
   Should return:
   - Status: 200 OK
   - CORS header: `Access-Control-Allow-Origin: *`
   - JSON response with images array

5. **Test from Frontend**
   - Navigate to: https://qcv2.pages.dev
   - Go to "Add Product" or "Product Identification" page
   - Enter a product URL (e.g., Chrono24, Rolex, etc.)
   - Click "Identify Product"
   - Should successfully fetch and display product images
   - No CORS errors in browser console

## Related Issues

This fix addresses the same underlying issue as:
- CORS_404_FIX_SUMMARY.md (previous fix attempt)
- DEEP_DIVE_ANALYSIS_CORS_404.md (root cause analysis)
- FINAL_DIAGNOSIS.md (deployment diagnosis)

## Technical Notes

### Wrangler Configuration Discovery
Wrangler's configuration discovery process:
1. Looks for wrangler.toml, wrangler.json, or wrangler.jsonc
2. Searches in current directory and parent directories
3. Can merge configurations from multiple files
4. `--config` flag overrides this behavior completely

### File Format Differences
- `.toml` = TOML format (original wrangler format)
- `.json/.jsonc` = JSON format with optional comments (newer format)
- Both are equally valid, project uses both intentionally

### Project Structure
```
/
├── wrangler.jsonc           # Pages deployment config (authentiqc-app)
├── cloudflare-worker/
│   ├── wrangler.toml        # Worker deployment config (authentiqc-worker)
│   ├── index.mjs            # Worker code
│   └── package.json         # Worker dependencies
└── .github/
    └── workflows/
        ├── deploy.yml        # Pages deployment (may use root wrangler.jsonc)
        └── deploy-worker.yml # Worker deployment (uses cloudflare-worker/wrangler.toml)
```

## Prevention

To prevent this issue from recurring:
1. ✅ Use `--config` flag in all wrangler deploy commands
2. ✅ Document the purpose of each wrangler configuration file
3. ✅ Keep worker config in subdirectory, separate from root
4. ✅ Maintain clear naming: "authentiqc-app" (Pages) vs "authentiqc-worker" (Worker)
5. ✅ Test deployments in CI before merging configuration changes

## Deployment Status

- **Current Branch:** `copilot/fix-cors-error-in-authentication`
- **Status:** Ready to merge
- **Action Required:** Merge to `main` to trigger automatic worker redeployment

Once merged, the GitHub Actions workflow will automatically:
1. Install worker dependencies
2. Deploy the worker using `wrangler deploy --config wrangler.toml`
3. Worker will be available at https://authentiqc-worker.adwate.workers.dev
4. All endpoints will have proper CORS headers
5. Frontend will be able to fetch images successfully
