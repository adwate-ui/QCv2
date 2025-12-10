# 🚨 URGENT FIX: Cloudflare Pages Dashboard Misconfiguration

## Problem

The Cloudflare Pages project dashboard has an **incorrect deploy command** that is causing deployment failures:

```
Error: It looks like you've run a Workers-specific command in a Pages project.
For Pages, please run `wrangler pages deploy` instead.
```

## Root Cause

The Cloudflare Pages dashboard is configured with:
- **Build command**: `npm run build` ✅ (correct)
- **Deploy command**: `npx wrangler deploy` ❌ (WRONG - this is for Workers, not Pages)

### Why This Is Wrong

1. **Cloudflare Pages handles deployment automatically** after build - no deploy command needed
2. `npx wrangler deploy` is specifically for **Cloudflare Workers**, not Pages
3. When run from the root directory, wrangler detects it as a Pages project and fails
4. This causes the build logs to show the confusing error message

## Immediate Fix Required

### Step 1: Fix Cloudflare Pages Dashboard

1. Go to: https://dash.cloudflare.com
2. Navigate to: **Workers & Pages** → **qcv2** project
3. Go to: **Settings** → **Builds & deployments**
4. Find: **Build command** and **Deploy command** settings

**Correct Configuration:**
```
Build command:     npm run build
Root directory:    /
Output directory:  dist
Deploy command:    [LEAVE EMPTY - DELETE ANY VALUE HERE]
```

### Step 2: Save and Redeploy

1. Click **Save** after removing the deploy command
2. Go to **Deployments** tab
3. Click **Retry deployment** on the latest failed deployment
4. The deployment should now succeed

## Understanding the Architecture

This repository has **TWO separate deployments**:

### 1. Cloudflare Pages (Frontend)
- **What**: The React application (UI)
- **Deployed via**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Deployed to**: `https://qcv2.pages.dev` (or custom domain)
- **Configuration**: No wrangler.toml in root directory
- **Build**: `npm run build` → outputs to `dist/`
- **Deploy**: Handled automatically by Cloudflare Pages after build

### 2. Cloudflare Worker (API/Image Proxy)
- **What**: Backend API for image proxying and processing
- **Deployed via**: GitHub Actions (`.github/workflows/deploy-worker.yml`)
- **Deployed to**: `https://authentiqc-worker.adwate.workers.dev`
- **Configuration**: `cloudflare-worker/wrangler.toml`
- **Build**: N/A (JavaScript file, no build step needed)
- **Deploy**: `cd cloudflare-worker && npx wrangler deploy`

## Prevention: What NOT To Do

❌ **DO NOT** add a deploy command to Cloudflare Pages dashboard
❌ **DO NOT** run `wrangler deploy` from the root directory
❌ **DO NOT** create a `wrangler.toml` or `wrangler.jsonc` in the root directory
❌ **DO NOT** modify the GitHub Actions workflows without understanding the architecture

## How Deployment Works (Current Correct Setup)

```
GitHub Push to main branch
        ↓
   Triggers TWO workflows
        ↓
  ┌─────┴─────┐
  ↓           ↓
Pages      Worker
(.github/  (.github/
workflows/ workflows/
deploy.    deploy-
yml)       worker.yml)
  ↓           ↓
Builds     Changes to
React app  cloudflare-
and        worker/
deploys    and deploys
to Pages   worker
```

### Pages Workflow (deploy.yml)
1. Runs `npm run build` in root directory
2. Uses `cloudflare/pages-action@v1` to deploy `dist/` folder
3. **Does NOT use wrangler at all**

### Worker Workflow (deploy-worker.yml)
1. Changes to `cloudflare-worker/` directory
2. Runs `npx wrangler deploy --config wrangler.toml`
3. Deploys only the worker code

## Verification

After fixing the dashboard configuration, verify:

1. **Pages deployment succeeds**:
   ```bash
   # Check latest deployment at:
   # https://dash.cloudflare.com → Workers & Pages → qcv2 → Deployments
   ```

2. **Worker is accessible**:
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   # Should return: {"name":"AuthentiqC Image Proxy Worker","version":"1.3.0","status":"ok",...}
   ```

3. **No 502 errors** when using the app to fetch images from URLs

## Troubleshooting

### If you see "Workers-specific command in a Pages project"
→ You still have a deploy command in Cloudflare Pages dashboard - remove it

### If Pages deployment fails after removing deploy command
→ Check that GitHub Actions workflow `.github/workflows/deploy.yml` is enabled

### If Worker is not accessible (404 or 502)
→ Check that `.github/workflows/deploy-worker.yml` ran successfully
→ Verify worker deployment at: https://dash.cloudflare.com → Workers & Pages

### If images show 502 Bad Gateway
→ Worker is not deployed or `VITE_IMAGE_PROXY_URL` is incorrect
→ Verify worker URL is set correctly in environment variables

## Related Files

- `.github/workflows/deploy.yml` - Pages deployment via GitHub Actions
- `.github/workflows/deploy-worker.yml` - Worker deployment via GitHub Actions
- `cloudflare-worker/wrangler.toml` - Worker configuration (only worker!)
- `.github/scripts/validate-wrangler-configs.sh` - Prevents config conflicts

## Summary

**THE FIX**: Remove the deploy command from Cloudflare Pages dashboard settings. Pages deployments are handled automatically after build, and Workers are deployed separately via GitHub Actions.

**DO NOT** run `wrangler deploy` from the root directory - this is what's causing the error!
