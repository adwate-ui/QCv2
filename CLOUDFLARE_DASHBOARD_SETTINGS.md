# Cloudflare Dashboard Settings Reference

## ⚠️ Critical: Correct Configuration for This Repository

This repository uses **GitHub Actions for ALL deployments**. The Cloudflare dashboard should have **minimal configuration**.

## Cloudflare Pages Project Settings

### Project: `qcv2` (Frontend/UI)

Navigate to: **Cloudflare Dashboard** → **Workers & Pages** → **qcv2** → **Settings** → **Builds & deployments**

#### Build Configuration

```
Build command:           npm run build
Root directory:          / 
Output directory:        dist
Node version:            20
```

#### Deploy Configuration

```
Deploy command:          [LEAVE EMPTY / NOT SET]
```

> ⚠️ **IMPORTANT**: The "Deploy command" field must be **empty**. Cloudflare Pages handles deployment automatically after the build completes. If you see `npx wrangler deploy` or any other command here, **DELETE IT**.

### Why No Deploy Command?

Cloudflare Pages deployment process:
1. GitHub Actions triggers on push to `main` branch
2. Workflow runs `npm run build` to create `dist/` folder
3. Workflow uses `cloudflare/pages-action` to upload `dist/` to Cloudflare
4. **Cloudflare Pages serves the static files** - no additional deploy step needed

If you add a deploy command, Cloudflare tries to run it AFTER the upload, which:
- Is unnecessary (files are already deployed)
- Causes errors if you use worker-specific commands like `wrangler deploy`
- Creates confusion between Pages and Workers deployments

## Cloudflare Worker Settings

### Worker: `authentiqc-worker` (API/Image Proxy)

**DO NOT configure the worker in the Cloudflare dashboard**. It is deployed exclusively via:
- GitHub Actions workflow: `.github/workflows/deploy-worker.yml`
- Configuration file: `cloudflare-worker/wrangler.toml`
- Deploy command: `cd cloudflare-worker && npx wrangler deploy`

## Environment Variables

### Pages Project (`qcv2`)

Set these in: **Settings** → **Environment variables** → **Production**

```
VITE_IMAGE_PROXY_URL     https://authentiqc-worker.adwate.workers.dev
GEMINI_API_KEY           [Your Gemini API key]
```

Optional (if using non-default Supabase):
```
VITE_SUPABASE_URL        [Your Supabase URL]
VITE_SUPABASE_ANON_KEY   [Your Supabase anon key]
```

> **Note**: Environment variables starting with `VITE_` are embedded into the build and become part of the client-side JavaScript bundle.

### Worker (`authentiqc-worker`)

Workers do not need environment variables configured in the dashboard. All configuration is in `cloudflare-worker/wrangler.toml`.

## GitHub Integration

### Pages Project (`qcv2`)

- **Connected Repository**: `adwate-ui/QCv2`
- **Production Branch**: `main`
- **Preview Branches**: All branches
- **Auto-deploy**: Enabled (via GitHub Actions, not dashboard trigger)

The GitHub integration allows Cloudflare to:
- Show deployment status in GitHub
- Link commits to deployments
- Provide deployment preview URLs

**However**, the actual deployment is controlled by `.github/workflows/deploy.yml`, not by Cloudflare's automatic GitHub triggers.

## Common Mistakes to Avoid

### ❌ Mistake 1: Adding a Deploy Command
```
Deploy command: npx wrangler deploy  ← WRONG!
```
**Why wrong**: This is for Workers, not Pages. Pages don't need a deploy command.

### ❌ Mistake 2: Confusing Pages and Workers
```
# Running this in root directory:
npx wrangler deploy  ← WRONG! This is for workers only
```
**Why wrong**: The root directory is a Pages project (React app), not a Worker.

### ❌ Mistake 3: Creating wrangler.toml in Root
```
# Creating this file:
/wrangler.toml  ← WRONG!
```
**Why wrong**: Only the worker needs wrangler configuration, not the Pages project.

### ❌ Mistake 4: Wrong Environment Variable Names
```
IMAGE_PROXY_URL=...          ← WRONG! Missing VITE_ prefix
REACT_APP_PROXY_URL=...      ← WRONG! This is for Create React App, not Vite
```
**Correct**: `VITE_IMAGE_PROXY_URL=...`

## Correct Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Repository: adwate-ui/QCv2                          │
│                                                             │
│  ┌──────────────────────┐  ┌───────────────────────────┐  │
│  │ Root Directory       │  │ cloudflare-worker/        │  │
│  │ (React App)          │  │ (Image Proxy API)         │  │
│  │                      │  │                           │  │
│  │ • package.json       │  │ • index.mjs               │  │
│  │ • vite.config.ts     │  │ • wrangler.toml           │  │
│  │ • App.tsx            │  │ • package.json            │  │
│  └──────────────────────┘  └───────────────────────────┘  │
│          │                              │                   │
│          │                              │                   │
└──────────┼──────────────────────────────┼──────────────────┘
           │                              │
           │                              │
    ┌──────▼──────┐              ┌───────▼────────┐
    │ .github/    │              │ .github/       │
    │ workflows/  │              │ workflows/     │
    │ deploy.yml  │              │ deploy-worker. │
    │             │              │ yml            │
    └──────┬──────┘              └───────┬────────┘
           │                              │
           │                              │
    ┌──────▼─────────────┐      ┌────────▼──────────┐
    │ Cloudflare Pages   │      │ Cloudflare Worker │
    │                    │      │                   │
    │ Project: qcv2      │      │ Name:             │
    │ URL: qcv2.pages.   │      │ authentiqc-worker │
    │ dev                │      │                   │
    │                    │      │ URL: authentiqc-  │
    │ Config in          │      │ worker.adwate.    │
    │ dashboard:         │      │ workers.dev       │
    │ • Build cmd only   │      │                   │
    │ • NO deploy cmd    │      │ Config in         │
    │                    │      │ wrangler.toml     │
    └────────────────────┘      └───────────────────┘
```

## Quick Reference Commands

### Check Current Configuration

```bash
# View Pages project settings
# (Must be done in Cloudflare Dashboard - no CLI equivalent)

# View Worker configuration
cat cloudflare-worker/wrangler.toml

# Check GitHub Actions workflows
cat .github/workflows/deploy.yml
cat .github/workflows/deploy-worker.yml
```

### Manual Deployment (if needed)

```bash
# Deploy Pages manually (from root directory)
npm run build
npx wrangler pages deploy dist --project-name=qcv2

# Deploy Worker manually (from worker directory)
cd cloudflare-worker
npx wrangler deploy
```

> **Note**: Manual deployment is rarely needed. GitHub Actions handles all deployments automatically.

## Verification Checklist

After configuring the dashboard correctly:

- [ ] Pages project has NO deploy command set
- [ ] Pages project build command is `npm run build`
- [ ] Pages project output directory is `dist`
- [ ] Environment variable `VITE_IMAGE_PROXY_URL` is set
- [ ] GitHub Actions workflow `deploy.yml` is enabled
- [ ] GitHub Actions workflow `deploy-worker.yml` is enabled
- [ ] Latest deployment succeeded in Cloudflare dashboard
- [ ] Worker responds at `https://authentiqc-worker.adwate.workers.dev/`
- [ ] App loads successfully at production URL
- [ ] Image importing from URLs works (no 502 errors)

## Getting Help

If deployments fail after following this guide:

1. Check GitHub Actions logs: https://github.com/adwate-ui/QCv2/actions
2. Check Cloudflare deployment logs: Dashboard → Workers & Pages → qcv2 → Deployments
3. Verify worker is accessible: `curl https://authentiqc-worker.adwate.workers.dev/`
4. Review: `CLOUDFLARE_PAGES_DASHBOARD_FIX.md` for detailed troubleshooting

## Last Updated

2025-12-10 - Initial documentation to prevent Pages/Workers deployment confusion
