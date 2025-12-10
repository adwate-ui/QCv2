# Deployment Architecture

## Overview

This document explains how the AuthentiqC application is deployed to Cloudflare.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GITHUB REPOSITORY                                │
│                         adwate-ui/QCv2                                   │
└───────────────┬────────────────────────┬────────────────────────────────┘
                │                        │
                │ Push to main           │ Push to main
                │                        │
        ┌───────▼──────────┐     ┌──────▼───────────┐
        │  GitHub Action   │     │  GitHub Action   │
        │   deploy.yml     │     │deploy-worker.yml │
        └───────┬──────────┘     └──────┬───────────┘
                │                        │
                │                        │
        ┌───────▼──────────┐     ┌──────▼───────────┐
        │   npm ci         │     │ cd cloudflare-   │
        │   npm run build  │     │    worker/       │
        │   → dist/        │     │ npm install      │
        └───────┬──────────┘     └──────┬───────────┘
                │                        │
                │                        │
        ┌───────▼──────────┐     ┌──────▼───────────┐
        │ cloudflare/      │     │ npx wrangler@4   │
        │ pages-action@v1  │     │    deploy        │
        │                  │     │                  │
        │ Uses:            │     │ Uses:            │
        │ • CF_API_TOKEN   │     │ cloudflare-      │
        │ • CF_ACCOUNT_ID  │     │ worker/          │
        │ • dist/ folder   │     │ wrangler.toml    │
        └───────┬──────────┘     └──────┬───────────┘
                │                        │
                │                        │
        ┌───────▼──────────────────┐   ┌▼───────────────────────────┐
        │ CLOUDFLARE PAGES         │   │ CLOUDFLARE WORKER          │
        │ ══════════════════       │   │ ═══════════════════        │
        │ Project: qcv2            │   │ Name: authentiqc-worker    │
        │ Type: Static Site        │   │ Type: Service Worker       │
        │ Content: HTML, CSS, JS   │   │ Purpose: Image Proxy API   │
        │                          │   │                            │
        │ URL:                     │   │ URL:                       │
        │ https://qcv2.pages.dev   │   │ https://authentiqc-worker  │
        │                          │   │   .adwate.workers.dev      │
        │                          │   │                            │
        │ ✅ NO wrangler config    │   │ ✅ HAS wrangler.toml       │
        │    needed at root        │   │    in worker directory     │
        └──────────────────────────┘   └────────────────────────────┘
```

## Key Points

### 1. Two Separate Deployments

The application consists of TWO independent deployments:

1. **Frontend (Cloudflare Pages)** - Static HTML, CSS, JavaScript
2. **Backend (Cloudflare Worker)** - Image proxy API

Each has its own:
- GitHub Actions workflow
- Deployment method
- Configuration
- URL

### 2. Pages Deployment (Frontend)

**Workflow**: `.github/workflows/deploy.yml`

**Process**:
1. Checkout code
2. Install dependencies (`npm ci`)
3. Build application (`npm run build` → creates `dist/` folder)
4. Deploy using `cloudflare/pages-action@v1`

**Configuration**:
- ✅ **NO `wrangler.jsonc` at root** (this was causing the error!)
- ✅ Uses `cloudflare/pages-action@v1` GitHub Action
- ✅ Automatically handles deployment to Cloudflare Pages
- ✅ No manual wrangler commands needed

**Important**: Ensure Cloudflare Pages dashboard has NO custom "deploy command" configured!

### 3. Worker Deployment (Backend)

**Workflow**: `.github/workflows/deploy-worker.yml`

**Process**:
1. Checkout code
2. Change to `cloudflare-worker/` directory
3. Install worker dependencies
4. Deploy using `npx wrangler@4 deploy`

**Configuration**:
- ✅ **HAS `cloudflare-worker/wrangler.toml`** (this is correct!)
- ✅ Uses wrangler CLI directly
- ✅ Separate from Pages deployment

## Common Mistakes to Avoid

### ❌ WRONG: Having wrangler.jsonc at root

```
QCv2/
├── wrangler.jsonc          ← ❌ CAUSES ERROR!
├── cloudflare-worker/
│   └── wrangler.toml       ← ✅ Correct
```

**Problem**: Cloudflare Pages tries to use wrangler.jsonc for deployment, but Pages deployment should use `cloudflare/pages-action@v1`, not wrangler CLI.

### ❌ WRONG: Custom deploy command in Cloudflare Pages

In Cloudflare Dashboard → Pages → qcv2 → Settings:
```
Deploy command: npx wrangler deploy    ← ❌ CAUSES ERROR!
```

**Problem**: This runs `npx wrangler deploy` which is for Workers, not Pages.

### ✅ CORRECT: No root wrangler config, no custom deploy command

```
QCv2/
├── (no wrangler.jsonc)     ← ✅ Correct for GitHub Actions deployment
├── cloudflare-worker/
│   └── wrangler.toml       ← ✅ Correct for worker
```

In Cloudflare Dashboard → Pages → qcv2 → Settings:
```
Build command:        npm run build
Build output dir:     dist
Deploy command:       (empty/blank)     ← ✅ Let GitHub Actions handle it
```

## Environment Variables

### Frontend (Pages) Build

Set in GitHub Actions workflow during build:
- `VITE_IMAGE_PROXY_URL` - Worker URL for image fetching
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `GEMINI_API_KEY` - Google Gemini API key

**Note**: `VITE_*` variables are embedded at build time, not runtime!

### Worker Deployment

Set in GitHub Actions workflow:
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

## Deployment Flow

### On Push to Main Branch:

1. **Both workflows trigger simultaneously**
2. **Pages workflow runs**:
   - Validates wrangler configs (checks for conflicts)
   - Installs dependencies
   - Builds frontend
   - Deploys to Cloudflare Pages via GitHub Action
3. **Worker workflow runs**:
   - Validates wrangler configs
   - Installs worker dependencies
   - Validates worker code syntax
   - Deploys to Cloudflare Workers via wrangler CLI
   - Verifies deployment with health checks

4. **Result**: Both frontend and worker are deployed and accessible

## Troubleshooting

### Build fails with "Workers-specific command in Pages project"

**Solution**: Remove custom deploy command from Cloudflare Pages dashboard
- See: [IMMEDIATE_FIX_CLOUDFLARE_PAGES.md](./IMMEDIATE_FIX_CLOUDFLARE_PAGES.md)

### Worker deployment fails

**Solution**: Check worker workflow logs and verify:
- `CF_API_TOKEN` secret is set correctly
- `CF_ACCOUNT_ID` secret is set correctly
- `cloudflare-worker/wrangler.toml` is valid

### Frontend deploys but image fetching fails

**Solution**: Worker might not be deployed or URL not set
- Verify worker is accessible: `curl https://authentiqc-worker.adwate.workers.dev/`
- Verify `VITE_IMAGE_PROXY_URL` secret is set in GitHub
- Remember: Need to rebuild frontend after setting `VITE_IMAGE_PROXY_URL`

## References

- [IMMEDIATE_FIX_CLOUDFLARE_PAGES.md](./IMMEDIATE_FIX_CLOUDFLARE_PAGES.md) - Quick fix for deploy command issue
- [PAGES_DEPLOYMENT_FIX_README.md](./PAGES_DEPLOYMENT_FIX_README.md) - Detailed explanation
- [CLOUDFLARE_DEPLOYMENT_GUIDE.md](./CLOUDFLARE_DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [FIX_SUMMARY_DEPLOYMENT.md](./FIX_SUMMARY_DEPLOYMENT.md) - Summary of recent fix
