# AuthentiqC Cloudflare Worker

This directory contains the Cloudflare Worker that provides image proxying and metadata extraction services for the AuthentiqC application.

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
- All endpoints must include CORS headers: `'Access-Control-Allow-Origin': '*'`
- The worker uses `nodejs_compat` compatibility flag for Node.js built-ins (pixelmatch, pngjs, jpeg-js)

## Endpoints

- `GET /fetch-metadata?url=<URL>` - Extract image URLs from a webpage
- `GET /proxy-image?url=<URL>` - Proxy an image with CORS headers
- `GET /diff?imageA=<URL>&imageB=<URL>` - Generate a diff image (pixel comparison)

All endpoints support CORS preflight (OPTIONS) requests.
