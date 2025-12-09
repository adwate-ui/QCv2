# AuthentiqC Cloudflare Worker

This directory contains the Cloudflare Worker that provides image proxying and metadata extraction services for the AuthentiqC application.

## Version

Current version: **1.1.0**

This version includes comprehensive CORS fixes and error handling to prevent the "No 'Access-Control-Allow-Origin' header" errors.

## Configuration

- **index.mjs**: The main worker code (ES Module format with nodejs_compat)
- **wrangler.toml**: The worker configuration file used for deployment
- **worker.js**: Legacy service worker format (kept for reference, not used in deployment)

## Deployment

The worker is deployed automatically via GitHub Actions when changes are pushed to the main branch.

Manual deployment:
```bash
cd cloudflare-worker
npx wrangler@4 deploy
```

## Important Notes

- Only `wrangler.toml` in this directory is used for worker deployment
- The root `wrangler.jsonc` is NOT used for worker deployment (it's for Pages)
- All endpoints include CORS headers: `'Access-Control-Allow-Origin': '*'`
- All endpoints include version header: `'X-Worker-Version': '1.1.0'`
- The worker uses `nodejs_compat` compatibility flag for Node.js built-ins (pixelmatch, pngjs, jpeg-js)
- Global error handler ensures CORS headers are present even on unhandled errors

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
- `X-Worker-Version: 1.1.0`
- `Access-Control-Allow-Origin: *`
