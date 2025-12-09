# VITE_IMAGE_PROXY_URL Configuration Guide

## Important: URL Format

The `VITE_IMAGE_PROXY_URL` environment variable should be set to your Cloudflare Worker URL.

**Note:** The application code automatically normalizes the URL, so it works whether you include `/fetch-metadata` or not.

### ✅ Both formats work (normalized automatically)
```
# Base URL (recommended)
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev

# With endpoint path (also works - will be normalized)
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev/fetch-metadata
```

### ❌ Incorrect Formats
```
# DO NOT include trailing slash
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev/
```

## How It Works

The application automatically:
1. Normalizes the worker URL by removing any endpoint paths (`/fetch-metadata`, `/proxy-image`, `/proxy`)
2. Constructs the proper endpoint URLs as needed:
   - `/fetch-metadata` - for fetching page metadata
   - `/proxy-image` - for proxying images
   - `/proxy` - for general proxying

This means the CORS error with double paths (`/fetch-metadata/fetch-metadata`) has been fixed.

## Setup Instructions

### For Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and set your worker URL:
   ```
   VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev
   ```

3. Restart your dev server:
   ```bash
   npm run dev
   ```

### For Production (Cloudflare Pages / GitHub Actions)

1. Go to your GitHub repository settings
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Add:
   - **Name**: `VITE_IMAGE_PROXY_URL`
   - **Value**: `https://authentiqc-worker.adwate.workers.dev` (your worker URL)

## How to Get Your Worker URL

1. Deploy your Cloudflare Worker:
   ```bash
   cd cloudflare-worker
   npx wrangler@4 deploy index.mjs --name authentiqc-worker
   ```

2. After deployment, Wrangler will output your worker URL:
   ```
   Published authentiqc-worker (X.XX sec)
     https://authentiqc-worker.YOUR-SUBDOMAIN.workers.dev
   ```

3. Copy the URL and use it in your configuration

## Verification

To verify your configuration is correct:

1. Check the Diagnostics page in the app
2. The proxy URL should show your worker URL (normalized)
3. Test with a product URL to ensure images load correctly

## Troubleshooting

If you still see CORS errors:
1. Verify the Cloudflare Worker is deployed and accessible
2. Check that the worker URL is correct in your environment variables
3. Ensure the worker has proper CORS headers (check `cloudflare-worker/worker.js`)
4. Try the Diagnostics page to see detailed error messages

