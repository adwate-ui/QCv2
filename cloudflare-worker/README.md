# AuthentiqC Cloudflare Worker

This directory contains the Cloudflare Worker that provides image proxying and metadata extraction services for the AuthentiqC application.

## Version

Current version: **1.2.0**

This version includes:
- Comprehensive CORS fixes and error handling
- Enhanced 404 response with proper CORS headers
- Fixed dependency management for worker deployment
- Proper package.json for worker-specific dependencies

## Configuration

- **index.mjs**: The main worker code (ES Module format with nodejs_compat)
- **package.json**: Worker dependencies (pixelmatch, pngjs, jpeg-js)
- **wrangler.toml**: The worker configuration file used for deployment
- **worker.js**: Legacy service worker format (kept for reference, not used in deployment)

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
npx wrangler@4 deploy
```

Or use the deploy script:
```bash
cd cloudflare-worker
./deploy.sh
```

## Important Notes

- Only `wrangler.toml` in this directory is used for worker deployment
- The root `wrangler.jsonc` is NOT used for worker deployment (it's for Pages)
- All endpoints include CORS headers: `'Access-Control-Allow-Origin': '*'`
- All endpoints include version header: `'X-Worker-Version': '1.2.0'`
- The worker uses `nodejs_compat` compatibility flag for Node.js built-ins (pixelmatch, pngjs, jpeg-js)
- Worker dependencies are managed in `cloudflare-worker/package.json`
- Global error handler ensures CORS headers are present even on unhandled errors
- 404 responses include CORS headers to prevent cross-origin errors

## Endpoints

- `GET /` - Health check endpoint (returns worker version and status)
- `GET /fetch-metadata?url=<URL>` - Extract image URLs from a webpage
- `GET /proxy-image?url=<URL>` - Proxy an image with CORS headers
- `GET /diff?imageA=<URL>&imageB=<URL>` - Generate a diff image (pixel comparison)

All endpoints support CORS preflight (OPTIONS) requests.

## Troubleshooting

If you experience CORS errors, see [WORKER_CORS_FIX_GUIDE.md](../WORKER_CORS_FIX_GUIDE.md) for:
- Verification steps
- Common issues and solutions
- Deployment troubleshooting

## Testing

Verify the worker is responding correctly:

```bash
# Check version and health
curl https://authentiqc-worker.adwate.workers.dev/

# Test CORS headers
curl -I https://authentiqc-worker.adwate.workers.dev/
```

Look for:
- `X-Worker-Version: 1.2.0`
- `Access-Control-Allow-Origin: *`
