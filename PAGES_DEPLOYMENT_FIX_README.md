# Cloudflare Pages Deployment Fix

## Problem

The Cloudflare Pages build is failing with the following error:

```
✘ [ERROR] It looks like you've run a Workers-specific command in a Pages project.
For Pages, please run `wrangler pages deploy` instead.
```

This error occurs during the "Executing user deploy command" step after the build completes successfully.

## Root Cause

**Cloudflare Pages has a custom "deploy command" configured in the dashboard** that runs `npx wrangler deploy` after building. This command is for **Cloudflare Workers**, not **Cloudflare Pages** projects.

The confusion arose because:
1. The repository contains a `wrangler.jsonc` file at the root
2. This file was intended to configure Pages deployment
3. However, the command `npx wrangler deploy` is specifically for Workers
4. For Pages projects, Cloudflare uses `wrangler pages deploy` instead

## Solution

### Step 1: Remove Custom Deploy Command in Cloudflare Dashboard

**This is the PRIMARY fix that must be done in the Cloudflare dashboard:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to: **Workers & Pages** → **qcv2** → **Settings** → **Builds & deployments**
3. Under **"Build configurations"**, find the **"Deploy command"** field
4. If it shows `npx wrangler deploy` or any similar command, **clear/remove it**
5. Save the settings

**Why remove it?**
- GitHub Actions already handles the deployment via `cloudflare/pages-action@v1`
- Cloudflare Pages automatically deploys the built files from the `dist` directory
- A custom deploy command is unnecessary and causes conflicts

### Step 2: Repository Changes (Already Applied in This PR)

This PR makes the following changes:

1. **Removed `wrangler.jsonc` from root** - This file was causing confusion by making Cloudflare think this is a Worker project. For GitHub Actions-based deployment using `cloudflare/pages-action@v1`, no wrangler configuration is needed at the root.

2. **Updated validation script** - Modified `.github/scripts/validate-wrangler-configs.sh` to not require the root wrangler config, since it's not needed for Pages deployments via GitHub Actions.

## How Deployment Works Now

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Cloudflare Pages (Frontend)                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Name: qcv2                                                               │
│ Deployment: GitHub Actions (.github/workflows/deploy.yml)               │
│ Method: cloudflare/pages-action@v1                                      │
│ Source: dist/ directory (built by Vite)                                 │
│ URL: https://qcv2.pages.dev                                             │
│                                                                          │
│ NO wrangler config needed at root for this deployment method            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker (Image Proxy API)                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Name: authentiqc-worker                                                  │
│ Deployment: GitHub Actions (.github/workflows/deploy-worker.yml)        │
│ Method: npx wrangler@4 deploy                                           │
│ Config: cloudflare-worker/wrangler.toml                                 │
│ URL: https://authentiqc-worker.adwate.workers.dev                       │
│                                                                          │
│ This DOES use wrangler config (in cloudflare-worker/ directory)         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Deployment Flow

1. **Push to main branch** triggers both workflows
2. **Pages workflow** (`.github/workflows/deploy.yml`):
   - Installs dependencies
   - Builds the frontend (`npm run build` → creates `dist/`)
   - Deploys using `cloudflare/pages-action@v1` (handles everything automatically)
3. **Worker workflow** (`.github/workflows/deploy-worker.yml`):
   - Changes to `cloudflare-worker/` directory
   - Runs `npx wrangler@4 deploy` (uses `cloudflare-worker/wrangler.toml`)
   - Verifies deployment with health checks

## Why This Approach is Correct

### Using `cloudflare/pages-action@v1` (No wrangler config needed)

✅ **Advantages:**
- Official Cloudflare GitHub Action
- Handles all deployment complexity automatically
- No need for wrangler configuration
- Integrates with GitHub deployments UI
- Supports environment variables, preview deployments, etc.

### Alternative: Manual wrangler pages deploy (Not used here)

If you wanted to use `wrangler pages deploy` manually, you would need:
```bash
npx wrangler pages deploy dist --project-name=qcv2
```

But we don't use this approach because GitHub Actions handles it better.

## Verification Steps

After applying this fix:

1. **Check Cloudflare Pages Settings:**
   - Ensure "Deploy command" field is empty
   - Build command should be: `npm run build`
   - Build output directory should be: `dist`

2. **Trigger a New Deployment:**
   - Push a commit to main branch, or
   - Manually trigger via GitHub Actions tab

3. **Verify Successful Deployment:**
   - GitHub Actions should show all green checks
   - No "It looks like you've run a Workers-specific command" error
   - Site should be accessible at https://qcv2.pages.dev

4. **Verify Worker is Still Working:**
   - Worker should still be accessible at https://authentiqc-worker.adwate.workers.dev
   - Test health check: `curl https://authentiqc-worker.adwate.workers.dev/`

## Common Issues and Solutions

### Issue: Still seeing the error after removing deploy command

**Solution:** 
- Clear your browser cache
- Ensure you saved the settings in Cloudflare dashboard
- Try a fresh deployment from GitHub Actions

### Issue: GitHub Actions deployment fails with authentication error

**Solution:**
- Verify GitHub secrets are set:
  - `CF_API_TOKEN` (Cloudflare API token)
  - `CF_ACCOUNT_ID` (Cloudflare account ID)
- Ensure the API token has correct permissions (Account → Workers Scripts → Edit)

### Issue: Worker deployment fails

**Solution:**
- Worker deployment is separate and should still work
- Check `.github/workflows/deploy-worker.yml` logs
- Verify `cloudflare-worker/wrangler.toml` configuration

## Related Files

- `.github/workflows/deploy.yml` - Pages deployment workflow
- `.github/workflows/deploy-worker.yml` - Worker deployment workflow  
- `.github/scripts/validate-wrangler-configs.sh` - Configuration validation
- `cloudflare-worker/wrangler.toml` - Worker configuration (still needed!)

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages GitHub Action](https://github.com/cloudflare/pages-action)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Repository Deployment Guide](./CLOUDFLARE_DEPLOYMENT_GUIDE.md)

## Summary

**TL;DR:**
1. ✅ Remove custom deploy command from Cloudflare Pages dashboard
2. ✅ This PR removes the root `wrangler.jsonc` (not needed for GitHub Actions deployment)
3. ✅ GitHub Actions handles both Pages and Worker deployments correctly
4. ✅ No additional configuration needed
