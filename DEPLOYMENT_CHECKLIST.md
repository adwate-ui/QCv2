# Deployment Checklist

This document provides a checklist for deploying the AuthentiqC application.

## Prerequisites

1. **Cloudflare Account**
   - Account ID: `72edc81c65cb5830f76c57e841831d7d` (already configured)
   - API Token with permissions for Workers and Pages

2. **Gemini API Key**
   - Get from: https://aistudio.google.com/app/apikey
   - Required for AI-powered product identification and QC analysis

3. **Supabase Account**
   - Default credentials are pre-configured:
     - URL: `https://gbsgkvmjtsjpmjrpupma.supabase.co`
     - Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2drdm1qdHNqcG1qcnB1cG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTQ4MjQsImV4cCI6MjA4MDY3MDgyNH0.GYsoEO8qJXOsiOjK2QHYMOOI0OFAdc9KqX1SA-Z-3ac`
   - You can use a different Supabase project by setting environment variables

## Step 1: Deploy Cloudflare Worker

The Cloudflare Worker handles image proxying and CORS.

### Option A: Deploy via GitHub Actions (Recommended)

1. **Set GitHub Secrets**
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Add or verify: `CF_API_TOKEN`
   - Add or verify: `CF_ACCOUNT_ID`

2. **Trigger Deployment**
   - Push to `main` branch or manually trigger the "Deploy Cloudflare Worker" workflow
   - The worker will be deployed to: `https://authentiqc-worker.adwate.workers.dev`

### Option B: Deploy Manually

```bash
cd cloudflare-worker
npm install
npx wrangler@4 login  # First time only
npx wrangler@4 deploy
```

**Verify Deployment:**
Visit: `https://authentiqc-worker.adwate.workers.dev/`

You should see:
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.2.0",
  "status": "ok",
  "endpoints": [...]
}
```

## Step 2: Configure GitHub Secrets

Go to: Repository → Settings → Secrets and variables → Actions

Add these secrets:

1. **`GEMINI_API_KEY`** (Required)
   - Your Google Gemini API key
   - Get from: https://aistudio.google.com/app/apikey

2. **`VITE_IMAGE_PROXY_URL`** (Required)
   - Value: `https://authentiqc-worker.adwate.workers.dev`
   - This should match your deployed worker URL

3. **`CF_API_TOKEN`** (Required for deployment)
   - Cloudflare API token with Workers and Pages permissions
   - Get from: Cloudflare Dashboard → My Profile → API Tokens

4. **`CF_ACCOUNT_ID`** (Required for deployment)
   - Value: `72edc81c65cb5830f76c57e841831d7d`
   - Already configured in wrangler.toml

## Step 3: Deploy Frontend

The frontend is automatically deployed via GitHub Actions when you push to `main`.

### Trigger Deployment

1. Push to `main` branch
2. Or manually trigger: Actions → "Deploy to Cloudflare Pages" → Run workflow

### Verify Deployment

Visit: `https://qcv2.pages.dev`

## Step 4: Verify Everything Works

1. **Check Environment Variables**
   - Open browser console on https://qcv2.pages.dev
   - You should NOT see: "GEMINI_API_KEY is not set"
   - You should NOT see: "VITE_IMAGE_PROXY_URL is not set"

2. **Test Image Fetching**
   - Navigate to "Add Product"
   - Enter a product URL (e.g., https://www.chrono24.com/rado/centrix-11509273-38mm-ceramic-watch--id39050769.htm)
   - Click "Fetch Images from URL"
   - Images should load without CORS errors

3. **Test Product Identification**
   - Upload or import product images
   - Click "Identify Product"
   - AI should analyze and identify the product

## Troubleshooting

### CORS Errors

If you see CORS errors like:
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata...' has been blocked by CORS policy
```

**Possible causes:**
1. Worker is not deployed
2. Wrong worker URL in `VITE_IMAGE_PROXY_URL`
3. Worker deployment failed

**Fix:**
1. Verify worker is deployed: Visit `https://authentiqc-worker.adwate.workers.dev/`
2. Check GitHub secret `VITE_IMAGE_PROXY_URL` matches the deployed worker URL
3. Re-deploy worker: `cd cloudflare-worker && npx wrangler@4 deploy`
4. Re-deploy frontend to pick up the correct URL

### GEMINI_API_KEY Not Set

If you see: "GEMINI_API_KEY is not set"

**Fix:**
1. Add `GEMINI_API_KEY` as a GitHub secret
2. Re-deploy the frontend (push to main or manual trigger)

### Worker Returns 404

If worker requests return 404:

**Possible causes:**
1. Worker name mismatch
2. Worker not deployed to the expected URL
3. Routes not configured correctly

**Fix:**
1. Check `cloudflare-worker/wrangler.toml`: name should be "authentiqc-worker"
2. Re-deploy worker: `cd cloudflare-worker && npx wrangler@4 deploy`
3. Check Cloudflare Dashboard → Workers & Pages → authentiqc-worker → Settings

## Local Development

For local development:

1. **Create `.env.local`**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`**
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev
   ```

3. **Start Development Server**
   ```bash
   npm install
   npm run dev
   ```

4. **Optional: Run Worker Locally**
   ```bash
   cd cloudflare-worker
   npm install
   npx wrangler@4 dev
   ```
   
   Then update `.env.local`:
   ```env
   VITE_IMAGE_PROXY_URL=http://localhost:8787
   ```

## Support

If you encounter issues:

1. Check Cloudflare Dashboard logs: Workers & Pages → authentiqc-worker → Logs
2. Check GitHub Actions logs for deployment failures
3. Check browser console for detailed error messages
4. Review the troubleshooting guides:
   - `IMAGE_FETCHING_GUIDE.md`
   - `TROUBLESHOOTING_WORKER_ERROR.md`
   - `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
