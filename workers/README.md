# AuthentiqC - Cloudflare Workers

This directory contains all Cloudflare Workers for the AuthentiqC application.

## Workers

### Image Proxy Worker

The image proxy worker is responsible for fetching external images and providing CORS-enabled access to them for the frontend application.

**Location:** `/workers/image-proxy`

**Features:**
- Fetches images from external URLs
- Provides CORS headers for cross-origin access
- Handles retries and error cases
- Browser-like user agent for better compatibility
- SSRF protection

**Deployment:**
```bash
cd image-proxy
npx wrangler@4 deploy
```

## Development

Each worker is independent and has its own:
- `index.mjs` or `index.ts` - Worker code
- `wrangler.toml` - Cloudflare Workers configuration
- `package.json` - Dependencies (if needed)
- `README.md` - Worker-specific documentation

## Deployment

Workers are deployed independently to Cloudflare Workers:

```bash
# Deploy all workers
./deploy-all.sh

# Deploy specific worker
cd image-proxy
npx wrangler@4 deploy
```

## Project Structure

```
/workers
├── image-proxy/      # Image proxy worker
│   ├── index.mjs
│   ├── wrangler.toml
│   ├── package.json
│   └── README.md
└── tsconfig.json     # Shared TypeScript config (if using TypeScript workers)
```

## Environment Variables

Workers use Cloudflare Workers environment variables and secrets:
- Set via `wrangler secret put <KEY>`
- Or via Cloudflare Dashboard > Workers > Settings > Variables

## Testing

See individual worker READMEs for testing instructions.
