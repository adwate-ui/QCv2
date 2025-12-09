# Worker Deployment Issue Fix

## Problem

The Cloudflare Worker deployment was failing with error:

```
npm error The `npm ci` command can only install with an existing package-lock.json or
npm error npm-shrinkwrap.json with lockfileVersion >= 1.
```

This caused the application to show CORS 404 errors because the worker was not being deployed.

## Root Cause

The GitHub Actions workflow (`.github/workflows/deploy-worker.yml`) was using `npm ci` to install dependencies in the `cloudflare-worker` directory, but there was no `package-lock.json` in that directory.

### Why This Happened

- The worker has its own `package.json` with dependencies (pixelmatch, pngjs, jpeg-js)
- The workflow was changed to use `npm ci` for faster, reproducible installs
- But `npm ci` **requires** a lockfile, which wasn't present in the cloudflare-worker directory
- The root directory has a package-lock.json, but the worker directory didn't

## Solution

Changed the workflow to use `npm install` instead of `npm ci`:

```yaml
- name: Install worker dependencies
  run: |
    cd cloudflare-worker
    npm install
```

### Why This Works

- `npm install` doesn't require a lockfile
- It will install dependencies listed in package.json
- It generates a package-lock.json automatically
- Subsequent deployments can use the generated lockfile

## Alternative Solutions Considered

### Option 1: Generate package-lock.json (NOT CHOSEN)
- Could run `npm install` locally and commit the generated package-lock.json
- Pros: Enables use of `npm ci` for faster installs
- Cons: Adds another file to maintain

### Option 2: Use root package-lock.json (NOT CHOSEN)
- Could install from root then cd to worker directory
- Pros: Uses existing lockfile
- Cons: Worker has different dependencies than main app, would install unnecessary packages

### Option 3: Use npm install (CHOSEN)
- Simple, doesn't require lockfile
- Pros: Minimal change, works immediately
- Cons: Slightly slower than `npm ci`, but difference is negligible for worker with few dependencies

## Verification

After this fix, the worker should deploy successfully. You can verify by:

1. **Check GitHub Actions**: The "Deploy Cloudflare Worker" workflow should complete successfully
2. **Check worker logs**: Look for output like:
   ```
   Deployed authentiqc-worker triggers
   https://authentiqc-worker.adwate.workers.dev
   ```
3. **Test the worker**: 
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   ```
   Should return a JSON response with version info

## Impact

### Before Fix
- Worker deployment failing since run #81
- Last successful deployment was run #80 (2025-12-09T18:01)
- Users seeing CORS 404 errors when trying to fetch images
- Application unable to fetch metadata from product URLs

### After Fix
- Worker deploys successfully
- CORS headers present on all responses
- Image fetching from URLs works properly
- Application can identify products from URLs

## Related Issues

This fix addresses the underlying deployment issue. However, users may still experience issues if:

1. **Environment variable not set**: `VITE_IMAGE_PROXY_URL` must be set to `https://authentiqc-worker.adwate.workers.dev`
2. **DNS propagation**: After first deployment, DNS may take a few minutes to propagate
3. **Browser cache**: Users may need to hard refresh to clear cached 404 responses

## Files Changed

- `.github/workflows/deploy-worker.yml` - Changed `npm ci` to `npm install`

## See Also

- `CORS_FIX_SUMMARY.md` - Details about CORS header implementation
- `WORKER_CORS_FIX_GUIDE.md` - Guide for verifying CORS is working
- `cloudflare-worker/README.md` - Worker documentation
- `CLOUDFLARE_DEPLOYMENT_GUIDE.md` - Complete deployment guide
