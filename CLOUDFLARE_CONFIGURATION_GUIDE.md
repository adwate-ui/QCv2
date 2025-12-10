# Cloudflare Configuration Architecture Guide

## Overview

This repository deploys **TWO SEPARATE** Cloudflare services that work together:

1. **Cloudflare Pages** - Hosts the frontend (React app)
2. **Cloudflare Worker** - Provides image proxy API endpoints

**CRITICAL:** These deployments use different names and configurations. Mixing them up will cause deployment failures.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Frontend (Cloudflare Pages)                                             │
│ ─────────────────────────────────────────────────────────────────────── │
│ Configuration: /wrangler.jsonc                                          │
│ Name: "qcv2"                                                            │
│ URL: https://qcv2.pages.dev                                             │
│ Deployment: .github/workflows/deploy.yml                                │
│ Content: HTML, CSS, JavaScript (React build output)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Frontend makes API calls to →
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Worker (Cloudflare Worker)                                              │
│ ─────────────────────────────────────────────────────────────────────── │
│ Configuration: /cloudflare-worker/wrangler.toml                         │
│ Name: "authentiqc-worker"                                               │
│ URL: https://authentiqc-worker.adwate.workers.dev                       │
│ Deployment: .github/workflows/deploy-worker.yml                         │
│ Content: API endpoints for image proxying, metadata extraction, diffs   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Files

### 1. Root `/wrangler.jsonc` (Pages Configuration)

```jsonc
{
  "name": "qcv2",                    // ← MUST match Cloudflare Pages project name
  "compatibility_date": "2025-12-10",
  "pages_build_output_dir": "./dist"
}
```

**Purpose:** Configures Cloudflare Pages deployment (frontend)
**Used by:** `.github/workflows/deploy.yml`
**Deployment command:** Handled by `cloudflare/pages-action@v1`
**DO NOT:** Rename to "authentiqc-worker" - this would break Pages deployment

### 2. `/cloudflare-worker/wrangler.toml` (Worker Configuration)

```toml
name = "authentiqc-worker"           # ← MUST match expected worker URL
main = "index.mjs"
compatibility_date = "2025-12-10"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
```

**Purpose:** Configures Cloudflare Worker deployment (API endpoints)
**Used by:** `.github/workflows/deploy-worker.yml`
**Deployment command:** `npx wrangler@4 deploy`
**DO NOT:** Rename to "qcv2" - this would conflict with Pages

## Common Errors and Solutions

### Error: "Worker URL returning HTML instead of JSON"

**Cause:** The worker is not deployed, or you're hitting the Pages URL instead of the Worker URL

**Solution:**
1. Verify worker is deployed: `curl https://authentiqc-worker.adwate.workers.dev/`
2. Expected response: JSON with `{"name": "AuthentiqC Image Proxy Worker", ...}`
3. If you get HTML: Worker is not deployed or URL is wrong
4. Deploy worker: `cd cloudflare-worker && npx wrangler@4 deploy`

### Error: "Error fetching GitHub User or Organization details"

**Cause:** Cloudflare is trying to connect to GitHub but the configuration is unclear

**Solutions:**
1. **This error is typically cosmetic** - it doesn't prevent deployment
2. It occurs when Cloudflare Pages tries to read repository metadata
3. As long as GitHub Actions workflows run successfully, ignore this error
4. If deployments fail, check that GitHub secrets are set correctly:
   - `CF_API_TOKEN` - Cloudflare API token
   - `CF_ACCOUNT_ID` - Cloudflare account ID

### Error: "Cloudflare wants wrangler.jsonc to have 'name': 'authentiqc-worker'"

**Cause:** Confusion about which configuration file to use

**Solution:**
- **DO NOT CHANGE** `/wrangler.jsonc` name from "qcv2"
- The root `wrangler.jsonc` is for Pages (name: "qcv2")
- The worker uses `cloudflare-worker/wrangler.toml` (name: "authentiqc-worker")
- These are DIFFERENT deployments and MUST have different names
- Cloudflare may show this message if it's confused about the repository structure
- The current configuration is CORRECT - don't change it

### Error: "Worker not working, unable to fetch images"

**Diagnosis:**
```bash
# 1. Check if worker is deployed and responding
curl https://authentiqc-worker.adwate.workers.dev/

# 2. Check CORS headers
curl -I https://authentiqc-worker.adwate.workers.dev/ | grep -i access-control

# 3. Test fetch-metadata endpoint
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com"
```

**Solutions:**
1. If 404 or DNS error: Worker not deployed → Deploy manually
2. If HTML response: Wrong URL or worker overwritten → Check deployment logs
3. If JSON but old version: Stale deployment → Redeploy worker
4. If CORS errors: Worker code issue → Check `index.mjs` has CORS headers

## Deployment Checklist

### Initial Setup

- [ ] 1. Set GitHub Secrets:
  - `CF_API_TOKEN` - Cloudflare API token with Workers and Pages permissions
  - `CF_ACCOUNT_ID` - Your Cloudflare account ID
  - `VITE_IMAGE_PROXY_URL` - Set to `https://authentiqc-worker.adwate.workers.dev`
  - `GEMINI_API_KEY` - Google Gemini API key

- [ ] 2. Verify wrangler configurations:
  - Root `/wrangler.jsonc` has `"name": "qcv2"`
  - Worker `/cloudflare-worker/wrangler.toml` has `name = "authentiqc-worker"`
  - Names are DIFFERENT (critical!)

- [ ] 3. Deploy worker first (dependency for Pages):
  ```bash
  cd cloudflare-worker
  npm ci
  npx wrangler@4 deploy
  ```

- [ ] 4. Verify worker is working:
  ```bash
  curl https://authentiqc-worker.adwate.workers.dev/
  # Should return JSON with version info
  ```

- [ ] 5. Deploy Pages (frontend):
  - Push to main branch, or
  - Manually trigger "Deploy to Cloudflare Pages" workflow

- [ ] 6. Verify Pages deployment:
  - Visit https://qcv2.pages.dev
  - Try to import a product by URL
  - Check browser console for errors

### Ongoing Maintenance

- Worker auto-deploys when changes are pushed to `main` (`.github/workflows/deploy-worker.yml`)
- Pages auto-deploys when changes are pushed to `main` (`.github/workflows/deploy.yml`)
- Both deployments are independent and don't interfere with each other

## Manual Deployment

### Deploy Worker Only

```bash
cd cloudflare-worker
export CLOUDFLARE_API_TOKEN="your-token-here"
npm ci
npx wrangler@4 deploy
```

### Deploy Pages Only

```bash
# Build the frontend
npm ci
npm run build

# Deploy to Pages (requires Cloudflare CLI or GitHub Actions)
# Usually done via GitHub Actions workflow
```

## Verification Commands

```bash
# Check worker health
curl https://authentiqc-worker.adwate.workers.dev/

# Check worker version
curl https://authentiqc-worker.adwate.workers.dev/ | jq '.version'

# Check CORS headers
curl -I https://authentiqc-worker.adwate.workers.dev/ | grep -i access-control

# Test fetch-metadata endpoint
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://www.cloudflare.com"

# Test proxy-image endpoint
curl "https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https://example.com/image.jpg" -o test.jpg

# Check Pages deployment
curl https://qcv2.pages.dev/
```

## Troubleshooting Workflow

1. **Worker returns 404:**
   - Check if worker is deployed: Visit Cloudflare Dashboard → Workers & Pages
   - Look for "authentiqc-worker" in the list
   - If missing: Deploy worker manually
   - If present: Check worker logs for errors

2. **Worker returns HTML:**
   - Verify you're using the correct URL: `https://authentiqc-worker.adwate.workers.dev`
   - NOT: `https://qcv2.pages.dev` (this is Pages, not worker)
   - Check GitHub Actions logs for deployment errors

3. **Pages deployment fails:**
   - Check GitHub Actions workflow logs
   - Verify `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets are set
   - Ensure build succeeds: `npm run build` locally
   - Check that `wrangler.jsonc` has correct name: "qcv2"

4. **Image fetching fails in app:**
   - Check `VITE_IMAGE_PROXY_URL` is set correctly
   - Verify worker is accessible: `curl https://authentiqc-worker.adwate.workers.dev/`
   - Check browser console for CORS errors
   - Test worker endpoints directly with curl

## Key Takeaways

✅ **DO:**
- Keep `/wrangler.jsonc` name as "qcv2" (Pages)
- Keep `/cloudflare-worker/wrangler.toml` name as "authentiqc-worker" (Worker)
- Deploy worker BEFORE Pages (Pages needs worker URL)
- Set `VITE_IMAGE_PROXY_URL` secret in GitHub

❌ **DON'T:**
- Don't rename wrangler configs to match each other (they MUST be different)
- Don't deploy worker from root directory (use `cloudflare-worker/` subdirectory)
- Don't hardcode `account_id` in wrangler files (use environment variables)
- Don't confuse Pages URL with Worker URL (they're different services)

## Getting Help

If you're still having issues:

1. Check GitHub Actions logs: https://github.com/adwate-ui/QCv2/actions
2. Check Cloudflare Dashboard: https://dash.cloudflare.com
3. Review worker logs: Dashboard → Workers & Pages → authentiqc-worker → Logs
4. Test worker directly: `curl https://authentiqc-worker.adwate.workers.dev/`
5. Share error messages, curl output, and dashboard screenshots

## Related Documentation

- [CLOUDFLARE_DEPLOYMENT_GUIDE.md](./CLOUDFLARE_DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [WORKER_NOT_DEPLOYED.md](./WORKER_NOT_DEPLOYED.md) - Worker deployment troubleshooting
- [cloudflare-worker/README.md](./cloudflare-worker/README.md) - Worker-specific documentation
