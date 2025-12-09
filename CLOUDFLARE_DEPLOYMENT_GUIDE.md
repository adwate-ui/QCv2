# Cloudflare Deployment Guide

This guide provides step-by-step instructions for deploying the AuthentiqC app to Cloudflare Pages and configuring the required Cloudflare Worker for image proxy functionality.

## Overview

The application consists of two parts:
1. **Frontend App** - Deployed to Cloudflare Pages (Vite/React app)
2. **Image Proxy Worker** - Deployed to Cloudflare Workers (handles image fetching with CORS)

Both parts need to be deployed and properly configured for the image fetching feature to work.

### ⚠️ Important: Vite Environment Variables

**Critical concept**: Environment variables starting with `VITE_` (like `VITE_IMAGE_PROXY_URL`) are **embedded into the build at build time**, not at runtime. This means:

- They must be set **during the build process** (in GitHub Actions or your build command)
- Setting them in Cloudflare Pages environment variables dashboard **will NOT work** for Vite builds
- They become part of the compiled JavaScript bundle
- Once built, they cannot be changed without rebuilding

This is why the GitHub Actions workflow passes `VITE_IMAGE_PROXY_URL` as an environment variable during the `npm run build` step.

## Prerequisites

- A Cloudflare account (free tier works)
- GitHub repository with the code
- Node.js installed (for local testing)
- Gemini API key from Google AI Studio

---

## Part 1: Deploy the Cloudflare Worker

The Cloudflare Worker acts as an image proxy to handle CORS and fetch images from product URLs.

### Option A: Automatic Deployment via GitHub Actions (Recommended)

1. **Set up GitHub Secrets** (if not already done)
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `CF_API_TOKEN`: Your Cloudflare API token
     - `CF_ACCOUNT_ID`: Your Cloudflare account ID

2. **Get Cloudflare Credentials**
   - **API Token**: 
     1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
     2. Go to My Profile → API Tokens
     3. Create a token with "Edit Cloudflare Workers" permissions
   - **Account ID**:
     1. Go to Workers & Pages in Cloudflare Dashboard
     2. Your Account ID is displayed on the right side

3. **Deploy Worker**
   - The worker will automatically deploy when you push to the `main` branch
   - GitHub Actions workflow file: `.github/workflows/deploy-worker.yml`
   - Check the Actions tab in GitHub to monitor deployment

4. **Get Worker URL**
   - After deployment, go to Cloudflare Dashboard → Workers & Pages
   - Click on `authentiqc-worker`
   - Copy the worker URL (e.g., `https://authentiqc-worker.your-subdomain.workers.dev`)
   - **Save this URL** - you'll need it in Part 2

### Option B: Manual Deployment via Wrangler CLI

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Update Worker Configuration** (Optional)
   - Edit `cloudflare-worker/wrangler.toml`
   - Update `account_id` if needed

4. **Deploy the Worker**
   ```bash
   cd cloudflare-worker
   wrangler deploy index.mjs --name authentiqc-worker
   ```

5. **Get Worker URL**
   - After deployment, the URL will be displayed in the terminal
   - Format: `https://authentiqc-worker.your-subdomain.workers.dev`
   - **Save this URL** - you'll need it in Part 2

---

## Part 2: Deploy the Frontend to Cloudflare Pages

### Option A: Automatic Deployment via GitHub Actions (Recommended)

1. **Set up GitHub Secrets** (if not already done)
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add these secrets (if not already added):
     - `CF_API_TOKEN`: Your Cloudflare API token
     - `CF_ACCOUNT_ID`: Your Cloudflare account ID
     - `VITE_IMAGE_PROXY_URL`: The worker URL from Part 1 (e.g., `https://authentiqc-worker.your-subdomain.workers.dev`)

2. **Important: Set the Worker URL Secret**
   ```
   Secret Name: VITE_IMAGE_PROXY_URL
   Secret Value: https://authentiqc-worker.your-subdomain.workers.dev
   ```
   ⚠️ **This is the critical step that fixes the "Image proxy not configured" error!**

3. **Create Cloudflare Pages Project** (First-time only)
   - Go to Cloudflare Dashboard → Workers & Pages
   - Click "Create application" → Pages → Connect to Git
   - Select your GitHub repository
   - **Build configuration**:
     - Framework preset: None (or Vite)
     - Build command: `npm run build`
     - Build output directory: `dist`
     - Environment variables: (Leave empty - we'll use GitHub secrets)
   - Click "Save and Deploy"

4. **Deploy**
   - Push to `main` branch to trigger deployment
   - GitHub Actions workflow file: `.github/workflows/deploy.yml`
   - The workflow will:
     1. Build the app with `VITE_IMAGE_PROXY_URL` embedded
     2. Deploy to Cloudflare Pages

5. **Verify Deployment**
   - Go to Cloudflare Dashboard → Workers & Pages → qcv2
   - Your app URL will be something like: `https://qcv2.pages.dev`

### Option B: Manual Deployment via Cloudflare Dashboard

1. **Build the App Locally**
   ```bash
   # Set environment variables
   export VITE_IMAGE_PROXY_URL=https://authentiqc-worker.your-subdomain.workers.dev
   
   # Build
   npm run build
   ```

2. **Deploy to Cloudflare Pages**
   - Go to Cloudflare Dashboard → Workers & Pages
   - Click "Create application" → Pages → "Upload assets"
   - Upload the `dist` folder
   - Click "Save and Deploy"

---

## Part 3: Set Environment Variables in Cloudflare Pages (Alternative Method)

If you prefer to set environment variables directly in Cloudflare Pages instead of GitHub secrets:

1. **Go to Cloudflare Dashboard**
   - Navigate to Workers & Pages → qcv2 (your project)
   - Go to Settings → Environment variables

2. **Add Production Variable**
   ```
   Variable name: VITE_IMAGE_PROXY_URL
   Value: https://authentiqc-worker.your-subdomain.workers.dev
   Environment: Production
   ```

3. **Redeploy**
   - Go to Deployments tab
   - Click "Retry deployment" on the latest deployment
   - Or push a new commit to trigger a rebuild

⚠️ **Important**: Environment variables in Cloudflare Pages are only used for functions, NOT for Vite builds. For Vite apps, you MUST set the variable during the build process (via GitHub Actions as shown in Option A above).

---

## Part 4: Configure Application Settings

### Set Gemini API Key

Users need to set their Gemini API key in the app:
1. Open the deployed app
2. Go to Settings
3. Enter your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## Troubleshooting

### Issue: "Image proxy not configured" error

**Solution:**
1. Verify the Cloudflare Worker is deployed and accessible:
   - Visit `https://your-worker-url.workers.dev/fetch-metadata?url=https://example.com` in a browser
   - You should see a JSON response with images array

2. Verify `VITE_IMAGE_PROXY_URL` is set:
   - Check GitHub repository secrets include `VITE_IMAGE_PROXY_URL`
   - Re-trigger the GitHub Actions workflow (push a commit or manually trigger)
   - Check the build logs to ensure the environment variable is set

3. Verify the variable is embedded in the build:
   - Open browser DevTools (F12) in your deployed app
   - Run in console: `import.meta.env.VITE_IMAGE_PROXY_URL`
   - It should show your worker URL (not `undefined`)

### Issue: Worker returns 403 or 404 errors

**Solution:**
- Check that the worker is deployed: Go to Cloudflare Dashboard → Workers & Pages
- Verify the worker URL is correct and accessible
- Check worker logs in Cloudflare Dashboard for errors

### Issue: Images still not loading

**Solution:**
1. Check browser console (F12) for detailed error messages
2. Try with a known working product URL (e.g., Amazon product page)
3. Verify CORS is enabled in the worker (it should be by default)
4. Check if the target website is blocking requests (try different URLs)

### Issue: GitHub Actions deployment fails

**Solution:**
- Verify all secrets are set correctly in GitHub
- Check the Actions logs for specific error messages
- Ensure `CF_API_TOKEN` has the correct permissions (Edit Cloudflare Workers and Edit Cloudflare Pages)

---

## Testing Your Deployment

1. **Test Worker Directly**
   ```bash
   curl "https://your-worker-url.workers.dev/fetch-metadata?url=https://www.amazon.com/dp/B08N5WRWNW"
   ```
   Should return JSON with images array.

2. **Test in App**
   - Go to your deployed app
   - Try adding a product via URL (e.g., Amazon product page)
   - Check browser console for any errors
   - Images should be fetched and displayed

---

## Summary Checklist

- [ ] Deploy Cloudflare Worker (Part 1)
  - [ ] Worker is accessible at `https://authentiqc-worker.your-subdomain.workers.dev`
- [ ] Set GitHub Secret `VITE_IMAGE_PROXY_URL` with worker URL
- [ ] Deploy Frontend to Cloudflare Pages (Part 2)
  - [ ] Build process includes `VITE_IMAGE_PROXY_URL` environment variable
  - [ ] App is accessible at `https://qcv2.pages.dev` (or custom domain)
- [ ] Test image fetching in the deployed app
- [ ] Set Gemini API key in app settings

---

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Image Fetching Troubleshooting Guide](IMAGE_FETCHING_GUIDE.md)

---

## Support

If you continue to experience issues after following this guide:
1. Check the browser console for detailed error messages
2. Review the [Image Fetching Troubleshooting Guide](IMAGE_FETCHING_GUIDE.md)
3. Verify all environment variables are set correctly
4. Try the manual deployment method to isolate issues
