# Quick Setup Guide

## What was fixed:

✅ **Supabase Connection** - App now uses default credentials automatically  
✅ **GEMINI_API_KEY** - Configured in deployment workflow  
✅ **Worker Name** - Already correct: "authentiqc-worker"  
⚠️ **CORS/Image Fetching** - Requires worker deployment

## Required Actions:

### 1. Set GitHub Secrets

Go to: **Repository → Settings → Secrets and variables → Actions**

Add these secrets if not already set:

| Secret Name | Value | Required |
|------------|-------|----------|
| `GEMINI_API_KEY` | Your Gemini API key from https://aistudio.google.com/app/apikey | ✅ Yes |
| `VITE_IMAGE_PROXY_URL` | `https://authentiqc-worker.adwate.workers.dev` | ✅ Yes |
| `CF_API_TOKEN` | Your Cloudflare API token | ✅ Yes |
| `CF_ACCOUNT_ID` | `72edc81c65cb5830f76c57e841831d7d` | ✅ Yes |

### 2. Deploy Cloudflare Worker

**Option A: Automatic (via GitHub Actions)**
- Push to `main` branch
- GitHub Actions will deploy the worker automatically

**Option B: Manual**
```bash
cd cloudflare-worker
npm install
npx wrangler@4 deploy
```

### 3. Verify Worker Deployment

Visit: https://authentiqc-worker.adwate.workers.dev/

✅ Should see JSON response with worker info  
❌ Should NOT see 404 or Cloudflare error page

### 4. Deploy Frontend

Push to `main` branch or manually trigger the deployment workflow:
- Go to: **Actions → "Deploy to Cloudflare Pages" → Run workflow**

### 5. Test the Application

Visit: https://qcv2.pages.dev

**Check:**
1. No "Connect to Supabase" prompt
2. No console errors about missing environment variables
3. Image fetching from URLs works without CORS errors
4. AI identification works

## Default Supabase Credentials (Pre-configured)

- **URL:** `https://gbsgkvmjtsjpmjrpupma.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2drdm1qdHNqcG1qcnB1cG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTQ4MjQsImV4cCI6MjA4MDY3MDgyNH0.GYsoEO8qJXOsiOjK2QHYMOOI0OFAdc9KqX1SA-Z-3ac`

These are now hardcoded as defaults. No manual setup needed!

## Troubleshooting

**CORS errors persist?**
1. Verify worker is deployed: `curl https://authentiqc-worker.adwate.workers.dev/`
2. Check GitHub secret `VITE_IMAGE_PROXY_URL` is set correctly
3. Re-deploy worker and frontend

**"GEMINI_API_KEY is not set" error?**
1. Add `GEMINI_API_KEY` to GitHub secrets
2. Re-deploy frontend (push to main or manual trigger)

**Supabase setup prompt still shows?**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check browser console for errors

## Next Steps

1. Set the 2 required GitHub secrets (GEMINI_API_KEY and VITE_IMAGE_PROXY_URL)
2. Deploy the worker (push to main or manual deploy)
3. Deploy the frontend (automatic on push to main)
4. Test and verify everything works

See `FIX_SUMMARY_SUPABASE_ENV.md` for detailed information.
