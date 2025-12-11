# Fix Summary: VITE_IMAGE_PROXY_URL Not Configured Error

## Problem Description

The production application was showing the error:
```
[WorkerHealth] VITE_IMAGE_PROXY_URL not configured
```

Even though the `VITE_IMAGE_PROXY_URL` secret was correctly configured in GitHub repository settings.

## Root Cause

The issue was in the GitHub Actions workflows:

1. **deploy-pages.yml** - Only passed `GEMINI_API_KEY` to the build step, missing `VITE_IMAGE_PROXY_URL`
2. **ci.yml** - Also missing `VITE_IMAGE_PROXY_URL` during the build step

When Vite builds the application, it needs environment variables to be available at build time (not runtime). Without the environment variable:
- Vite serializes `VITE_IMAGE_PROXY_URL` as `undefined`
- This becomes the string `"undefined"` in the compiled JavaScript bundle
- The worker health service correctly detects this as "not configured" at runtime

## Solution Applied

### Changed Files

1. **`.github/workflows/deploy-pages.yml`**
   ```yaml
   - name: Build Pages
     env:
       GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
       VITE_IMAGE_PROXY_URL: ${{ secrets.VITE_IMAGE_PROXY_URL }}  # ← ADDED
     run: npm run build:pages
   ```

2. **`.github/workflows/ci.yml`**
   ```yaml
   - name: Build Pages
     working-directory: pages
     env:
       GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY || 'dummy_key_for_ci' }}
       VITE_IMAGE_PROXY_URL: ${{ secrets.VITE_IMAGE_PROXY_URL || 'https://dummy-worker.workers.dev' }}  # ← ADDED
     run: npm run build
   ```

## Verification Steps

After this PR is merged to main, you can verify the fix:

### 1. Check the Deployed Application

1. Navigate to your production URL (qcv2.pages.dev or your custom domain)
2. Open the browser console (F12 → Console tab)
3. You should **NOT** see the warning `[WorkerHealth] VITE_IMAGE_PROXY_URL not configured`
4. Instead, the worker health service should attempt to connect to your configured worker URL

### 2. Verify Environment Variable in Build

1. Check the GitHub Actions logs for the deploy-pages workflow
2. In the "Build Pages" step, you should see the build complete successfully
3. The compiled bundle should contain your actual worker URL

### 3. Test Image Fetching

1. Try to identify a product from a URL
2. The application should successfully fetch images from the product URL
3. No errors should appear related to the image proxy being unconfigured

## Important Notes

### The Secret Must Still Be Set

This fix **assumes the secret is already set** in your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Verify `VITE_IMAGE_PROXY_URL` exists in **Repository secrets**
3. The value should be your Cloudflare Worker URL (e.g., `https://authentiqc-worker.your-subdomain.workers.dev`)

If the secret is not set, you'll need to add it:
1. Click **New repository secret**
2. Name: `VITE_IMAGE_PROXY_URL`
3. Value: Your Cloudflare Worker URL
4. Click **Add secret**

### What If the Error Still Occurs?

If the error still appears after merging this PR:

1. **Verify the secret value is correct:**
   - The URL should not end with a path (e.g., `/fetch-metadata`)
   - Just the base URL: `https://authentiqc-worker.your-subdomain.workers.dev`

2. **Check if the worker is deployed:**
   ```bash
   cd workers/image-proxy
   npx wrangler@4 deploy index.mjs --name authentiqc-worker
   ```

3. **Test the worker directly:**
   - Visit your worker URL in a browser
   - You should see a JSON response with version info
   - If you get HTML or a 404, the worker isn't deployed correctly

4. **Clear Cloudflare Pages cache:**
   - Go to your Cloudflare Pages dashboard
   - Deployments → Your deployment
   - Click "Retry deployment" to force a fresh build

## Technical Details

### How Vite Handles Environment Variables

Vite uses static replacement at build time for environment variables:

```typescript
// Source code
const workerUrl = import.meta.env.VITE_IMAGE_PROXY_URL;

// Built output (WITH env var set)
const workerUrl = "https://authentiqc-worker.example.workers.dev";

// Built output (WITHOUT env var set)
const workerUrl = undefined;  // This is the problem!
```

### Why This Matters for Production

- **Local Development**: `.env.local` file provides the variable
- **Production Build**: GitHub Actions environment must provide it
- **Runtime**: Too late - the value is already baked into the compiled code

## Related Files

- `.github/workflows/deploy-pages.yml` - Production deployment workflow
- `.github/workflows/ci.yml` - CI workflow for PRs
- `pages/vite.config.ts` - Vite configuration (already correct)
- `pages/src/services/workerHealthService.ts` - Where the warning originates
- `.env.example` - Example environment variable configuration

## Testing Performed

✅ Local build test with environment variable set:
```bash
GEMINI_API_KEY="test_key" VITE_IMAGE_PROXY_URL="https://test-worker.workers.dev" npm run build:pages
```

✅ Verified the environment variable is properly embedded in the compiled bundle

✅ Confirmed the worker health service will receive the correct URL

## Next Steps

1. **Merge this PR** to the main branch
2. **Monitor the deployment** in GitHub Actions
3. **Test the production application** to verify the fix
4. **Close the issue** if the error no longer appears

## Questions or Issues?

If you continue to see the error after merging:

1. Check the GitHub Actions logs for any build errors
2. Verify the secret is set correctly in repository settings
3. Ensure the Cloudflare Worker is deployed and accessible
4. Review the browser console for any other related errors

The most likely cause of continued issues would be:
- Secret not set or has incorrect value
- Worker not deployed or returning errors
- Cloudflare Pages cache needs to be cleared
