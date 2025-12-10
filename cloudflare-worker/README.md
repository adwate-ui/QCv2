# AuthentiqC Cloudflare Worker

This directory contains the Cloudflare Worker that provides image proxying and metadata extraction services for the AuthentiqC application.

## Version

Current version: **1.3.0**

This version includes:
- Enhanced configuration documentation
- Clear separation between Pages and Worker deployments
- Comprehensive CORS fixes and error handling
- Enhanced 404 response with proper CORS headers
- Fixed dependency management for worker deployment
- Proper package.json for worker-specific dependencies

## Configuration

- **index.mjs**: The main worker code (ES Module format with nodejs_compat)
- **package.json**: Worker dependencies (pixelmatch, pngjs, jpeg-js)
- **wrangler.toml**: The worker configuration file used for deployment

## Deployment

The worker is deployed automatically via GitHub Actions when changes are pushed to the main branch.

### Prerequisites

The worker directory has its own package.json with required dependencies:
- pixelmatch: For image comparison
- pngjs: For PNG image processing
- jpeg-js: For JPEG image processing

### Manual deployment:
```bash
cd cloudflare-worker
npm ci  # Install dependencies first
export CLOUDFLARE_API_TOKEN="your-token-here"
npx wrangler@4 deploy
```

Or use the deploy script:
```bash
cd cloudflare-worker
./deploy.sh
```

## Important Notes

- **Only `wrangler.toml` in this directory is used for worker deployment**
- The root `wrangler.jsonc` is NOT used for worker deployment (it's for Pages)
- Worker name: **authentiqc-worker** (must match name in wrangler.toml)
- Worker URL: **https://authentiqc-worker.adwate.workers.dev**
- All endpoints include CORS headers: `'Access-Control-Allow-Origin': '*'`
- All endpoints include version header: `'X-Worker-Version': '1.3.0'`
- The worker uses `nodejs_compat` compatibility flag for Node.js built-ins
- Worker dependencies are managed in `cloudflare-worker/package.json`
- Global error handler ensures CORS headers are present even on unhandled errors
- 404 responses include CORS headers to prevent cross-origin errors

**CRITICAL:** If you get 404 errors with NO CORS headers, the worker is likely NOT deployed. See [WORKER_NOT_DEPLOYED.md](../WORKER_NOT_DEPLOYED.md) for diagnosis.

## Architecture

This worker is **separate** from the Cloudflare Pages deployment:

```
Pages (Frontend)          Worker (API)
┌────────────────┐       ┌─────────────────────┐
│ wrangler.jsonc │       │ wrangler.toml       │
│ name: "qcv2"   │       │ name: "authentiqc-  │
│                │       │       worker"       │
│ React app      │  →    │ Image proxy API     │
│ (HTML/CSS/JS)  │ calls │ (JSON endpoints)    │
└────────────────┘       └─────────────────────┘
```

**DO NOT rename either configuration to match - they must be different!**

## Endpoints

- `GET /` - Health check endpoint (returns worker version and status)
- `GET /fetch-metadata?url=<URL>` - Extract image URLs from a webpage
- `GET /proxy-image?url=<URL>` - Proxy an image with CORS headers
- `GET /diff?imageA=<URL>&imageB=<URL>` - Generate a diff image (pixel comparison)

All endpoints support CORS preflight (OPTIONS) requests and return JSON (except proxy-image which returns image data).

## Troubleshooting

### Worker returns HTML instead of JSON

**Cause:** Worker is not deployed

**Fix:**
```bash
cd cloudflare-worker
export CLOUDFLARE_API_TOKEN="your-token"
npm ci
npx wrangler@4 deploy
```

### "Error fetching GitHub User or Organization details"

**Cause:** Cloudflare GitHub integration issue (cosmetic)

**Fix:** Ignore this error if GitHub Actions deployments work. See [GITHUB_INTEGRATION_ERROR_FIX.md](../GITHUB_INTEGRATION_ERROR_FIX.md)

### CORS errors

See [WORKER_CORS_FIX_GUIDE.md](../WORKER_CORS_FIX_GUIDE.md) for:
- Verification steps
- Common issues and solutions
- Deployment troubleshooting

## Testing

Verify the worker is responding correctly:

```bash
# Check version and health
curl https://authentiqc-worker.adwate.workers.dev/

# Expected output (JSON):
# {
#   "name": "AuthentiqC Image Proxy Worker",
#   "version": "1.3.0",
#   "status": "ok",
#   ...
# }

# Test CORS headers
curl -I https://authentiqc-worker.adwate.workers.dev/
# Should include: Access-Control-Allow-Origin: *

# Test fetch-metadata endpoint
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com"
# Should return: {"images": [...]}
```

Look for:
- `X-Worker-Version: 1.3.0`
- `Access-Control-Allow-Origin: *`
- JSON response format (not HTML)

## Related Documentation

- [CLOUDFLARE_CONFIGURATION_GUIDE.md](../CLOUDFLARE_CONFIGURATION_GUIDE.md) - Complete architecture guide
- [QUICK_FIX_WORKER_HTML.md](../QUICK_FIX_WORKER_HTML.md) - Quick fix for HTML instead of JSON
- [GITHUB_INTEGRATION_ERROR_FIX.md](../GITHUB_INTEGRATION_ERROR_FIX.md) - GitHub integration troubleshooting
- [WORKER_NOT_DEPLOYED.md](../WORKER_NOT_DEPLOYED.md) - Worker deployment troubleshooting

