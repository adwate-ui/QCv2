# Worker Deployment Fix - December 2025

## Issue

The Cloudflare Worker was returning **404 Not Found** errors with **no CORS headers** when accessing endpoints like `/fetch-metadata`, causing CORS errors in the browser:

```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...'
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=... net::ERR_FAILED 404 (Not Found)
```

## Root Cause

The worker code (`index.mjs`) uses Node.js dependencies:
- `pixelmatch` - for image comparison
- `pngjs` - for PNG image processing  
- `jpeg-js` - for JPEG image processing

These dependencies were defined in the **root** `package.json`, but the deployment workflow was:

1. Running `npm ci` in the root directory to install dependencies
2. Changing to the `cloudflare-worker/` subdirectory
3. Running `wrangler deploy` from the subdirectory

**Problem**: Wrangler couldn't find the dependencies because they were in the root `node_modules/` directory, not in `cloudflare-worker/node_modules/`.

When wrangler couldn't bundle the dependencies, either:
- The deployment failed silently, leaving an old/broken worker deployed
- The worker crashed on cold start when trying to import the missing modules
- The worker returned 404s for all requests

## Solution

Created a dedicated `package.json` in the `cloudflare-worker/` directory with the required dependencies:

```json
{
  "name": "authentiqc-worker",
  "version": "1.2.0",
  "type": "module",
  "dependencies": {
    "pixelmatch": "^5.3.0",
    "pngjs": "^6.0.0",
    "jpeg-js": "^0.4.3"
  }
}
```

Updated the GitHub Actions workflow to install dependencies in the worker directory before deployment:

```yaml
- name: Install worker dependencies
  run: |
    cd cloudflare-worker
    npm ci

- name: Publish worker
  run: |
    cd cloudflare-worker
    npx wrangler@4 deploy
```

## Files Changed

1. **cloudflare-worker/package.json** (new) - Worker dependencies
2. **cloudflare-worker/.npmrc** (new) - npm configuration for clean installs
3. **cloudflare-worker/.gitignore** (new) - Ignore node_modules and build artifacts
4. **.github/workflows/deploy-worker.yml** (updated) - Install dependencies before deploy
5. **cloudflare-worker/deploy.sh** (updated) - Install dependencies in manual deploy script
6. **cloudflare-worker/README.md** (updated) - Updated documentation

## How to Deploy

### Automated (GitHub Actions)
Push to the `main` branch and GitHub Actions will automatically deploy the worker.

### Manual Deployment
```bash
cd cloudflare-worker
npm ci                    # Install dependencies
npx wrangler@4 deploy    # Deploy worker
```

Or use the deploy script:
```bash
cd cloudflare-worker
./deploy.sh
```

## Verification

After deployment, verify the worker is working:

```bash
# Check health endpoint
curl https://authentiqc-worker.adwate.workers.dev/

# Expected response includes:
# - "version": "1.2.0"
# - "status": "ok"

# Check CORS headers
curl -I https://authentiqc-worker.adwate.workers.dev/

# Expected headers include:
# - Access-Control-Allow-Origin: *
# - X-Worker-Version: 1.2.0
```

## Prevention

To prevent this issue in the future:

1. **Always install dependencies in the directory where wrangler will be run**
2. **Keep worker dependencies separate from the main app dependencies**
3. **Test worker deployment locally before pushing to main**
4. **Check worker logs in Cloudflare Dashboard after deployment**

## Related Files

- `cloudflare-worker/index.mjs` - Main worker code
- `cloudflare-worker/wrangler.toml` - Worker configuration
- `.github/workflows/deploy-worker.yml` - Deployment workflow
- `cloudflare-worker/README.md` - Worker documentation
