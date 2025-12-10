<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1pShI4np7Qntn9U9CTnSQ8BNbO-mnukbd

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
   - Set the `VITE_IMAGE_PROXY_URL` to your deployed Cloudflare Worker URL (required for fetching images from product URLs)
3. Run the app:
   `npm run dev`

## Cloudflare Deployment

The app requires both a Cloudflare Pages deployment (for the frontend) and a Cloudflare Worker deployment (for the image proxy).

### 🚨 Build Error? "Workers-specific command in Pages project"?

**See:** [IMMEDIATE_FIX_CLOUDFLARE_PAGES.md](IMMEDIATE_FIX_CLOUDFLARE_PAGES.md) - Remove the custom deploy command in Cloudflare Pages settings

This is caused by a custom "deploy command" in Cloudflare Pages dashboard that needs to be removed.

### 🚨 CORS Error? Worker Not Working?

**See:** [CORS_FIX_NOW.md](CORS_FIX_NOW.md) - 2-minute quick fix guide

If you're seeing CORS errors, the worker is likely not deployed. This is the #1 issue.

### Quick Start (Local Development)

To deploy the worker for local development:
1. Install Wrangler CLI: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`
3. Deploy the worker: `cd cloudflare-worker && wrangler deploy`
4. Copy the worker URL and set it as `VITE_IMAGE_PROXY_URL` in your `.env.local`
5. Verify: `./verify-worker-setup.sh`

### Production Deployment

For complete step-by-step instructions on deploying to Cloudflare Pages (including automatic deployment via GitHub Actions), see:

📖 **[Cloudflare Deployment Guide](CLOUDFLARE_DEPLOYMENT_GUIDE.md)**

This guide covers:
- Deploying the Cloudflare Worker (image proxy)
- Deploying the frontend to Cloudflare Pages
- Setting up environment variables correctly
- Configuring GitHub Actions for automatic deployment
- Troubleshooting common deployment issues

**Important:** The `VITE_IMAGE_PROXY_URL` environment variable must be set during the build process for the image fetching feature to work in production.

### Troubleshooting

- **CORS errors**: See [CORS_FIX_NOW.md](CORS_FIX_NOW.md)
- **Detailed diagnosis**: See [URGENT_FIX_CORS_ISSUE.md](URGENT_FIX_CORS_ISSUE.md)
- **Verify setup**: Run `./verify-worker-setup.sh`

### Troubleshooting Image Fetching

If you're having issues with fetching images from product URLs, see the [Image Fetching Troubleshooting Guide](IMAGE_FETCHING_GUIDE.md) for:
- How the multi-stage image fetching works
- Common issues and solutions
- Monitoring and debugging tips
- Best practices for reliable results

**December 2025 Update:** If you encounter **404 errors with no CORS headers** when accessing worker endpoints, see [WORKER_DEPLOYMENT_FIX.md](WORKER_DEPLOYMENT_FIX.md) for the solution. This was caused by missing dependencies during worker deployment and has been fixed.
