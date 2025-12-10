# QUICK FIX: Worker Returning HTML Instead of JSON

## The Problem

The worker URL `https://authentiqc-worker.adwate.workers.dev` is returning HTML instead of JSON.

## Most Likely Cause

**The worker is not deployed.** When the worker isn't deployed, requests hit Cloudflare's default 404 page (HTML) instead of the worker code (JSON).

## Quick Fix (5 minutes)

### Step 1: Deploy the Worker

```bash
cd cloudflare-worker
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token-here"
npm ci
npx wrangler@4 deploy
```

### Step 2: Verify It Works

```bash
curl https://authentiqc-worker.adwate.workers.dev/
```

**Expected output (JSON):**
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.3.0",
  "status": "ok",
  "endpoints": [...]
}
```

**If you still get HTML:** The worker didn't deploy correctly. Check the error message from Step 1.

## About the Configuration Errors in Cloudflare Dashboard

### "Error fetching GitHub User or Organization details"

This error is **COSMETIC** and can be ignored if:
- ✅ GitHub Actions workflows are running successfully
- ✅ The worker is accessible (returns JSON, not HTML)
- ✅ The Pages site is accessible

**Why it happens:**
- Cloudflare Pages tries to connect to GitHub to fetch repository metadata
- This can fail due to permissions, rate limits, or integration issues
- It doesn't prevent GitHub Actions from deploying

**Solution: Ignore it.** Or disable Cloudflare's GitHub auto-deploy and use GitHub Actions exclusively (already configured).

### "Cloudflare wants wrangler.jsonc to have 'name': 'authentiqc-worker'"

**DO NOT CHANGE THE NAME.** This would be wrong. Here's why:

```
❌ WRONG Configuration (would break everything):
/wrangler.jsonc → name: "authentiqc-worker"
/cloudflare-worker/wrangler.toml → name: "authentiqc-worker"
Problem: Same name causes conflicts, worker overwrites Pages or vice versa

✅ CORRECT Configuration (current setup):
/wrangler.jsonc → name: "qcv2" (Pages project)
/cloudflare-worker/wrangler.toml → name: "authentiqc-worker" (Worker)
Why: Different names = separate deployments = no conflicts
```

**If Cloudflare shows this message, it's confused about the repository structure. The current configuration is CORRECT.**

## Understanding the Architecture

This repository deploys TWO things:

1. **Cloudflare Pages (Frontend)**
   - Configuration: `/wrangler.jsonc`
   - Name: `qcv2`
   - URL: `https://qcv2.pages.dev`
   - Content: React app (HTML, CSS, JS)

2. **Cloudflare Worker (API)**
   - Configuration: `/cloudflare-worker/wrangler.toml`
   - Name: `authentiqc-worker`
   - URL: `https://authentiqc-worker.adwate.workers.dev`
   - Content: Image proxy API endpoints (JSON)

**They MUST have different names. Don't change them.**

## Deployment Checklist

- [ ] 1. **Deploy Worker First** (Pages depends on Worker)
  ```bash
  cd cloudflare-worker
  export CLOUDFLARE_API_TOKEN="your-token"
  npm ci
  npx wrangler@4 deploy
  ```

- [ ] 2. **Verify Worker Returns JSON**
  ```bash
  curl https://authentiqc-worker.adwate.workers.dev/
  # Should see JSON with "version": "1.3.0"
  ```

- [ ] 3. **Set Environment Variable**
  - GitHub: Settings → Secrets and variables → Actions
  - Add: `VITE_IMAGE_PROXY_URL` = `https://authentiqc-worker.adwate.workers.dev`

- [ ] 4. **Deploy Pages**
  - Push to main branch OR
  - Manually trigger "Deploy to Cloudflare Pages" workflow in GitHub Actions

- [ ] 5. **Verify Pages Works**
  - Visit `https://qcv2.pages.dev`
  - Try importing a product by URL
  - Check for image fetching errors

## Common Mistakes

### Mistake 1: Deploying from wrong directory

```bash
# ❌ WRONG - deploys Pages config, not Worker
cd QCv2
npx wrangler@4 deploy

# ✅ CORRECT - deploys Worker
cd QCv2/cloudflare-worker
npx wrangler@4 deploy
```

### Mistake 2: Using wrong URL

```bash
# ❌ WRONG - This is Pages, not Worker
https://qcv2.pages.dev/fetch-metadata?url=...

# ✅ CORRECT - This is Worker
https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...
```

### Mistake 3: Changing wrangler.jsonc name

```jsonc
// ❌ WRONG - Don't change this
{
  "name": "authentiqc-worker"  // Would conflict with worker!
}

// ✅ CORRECT - Keep as is
{
  "name": "qcv2"  // Matches Pages project name
}
```

## Still Not Working?

Run these diagnostics:

```bash
# 1. Check worker health
curl https://authentiqc-worker.adwate.workers.dev/
# Expected: JSON response

# 2. Check CORS headers
curl -I https://authentiqc-worker.adwate.workers.dev/
# Expected: Access-Control-Allow-Origin: *

# 3. Check worker version
curl https://authentiqc-worker.adwate.workers.dev/ | jq '.version'
# Expected: "1.3.0"

# 4. Test fetch-metadata endpoint
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com"
# Expected: JSON with "images" array

# 5. Check GitHub Actions
# Go to: https://github.com/adwate-ui/QCv2/actions
# Look for green checkmarks on "Deploy Cloudflare Worker"
```

If all checks pass but app still doesn't work:
1. Clear browser cache (Ctrl+Shift+R)
2. Open browser console and check for errors
3. Verify `VITE_IMAGE_PROXY_URL` environment variable is set
4. Check Network tab in browser dev tools for actual request URLs

## Need More Help?

See detailed guides:
- [CLOUDFLARE_CONFIGURATION_GUIDE.md](./CLOUDFLARE_CONFIGURATION_GUIDE.md) - Complete architecture guide
- [GITHUB_INTEGRATION_ERROR_FIX.md](./GITHUB_INTEGRATION_ERROR_FIX.md) - Fixing GitHub integration errors
- [WORKER_NOT_DEPLOYED.md](./WORKER_NOT_DEPLOYED.md) - Worker deployment troubleshooting

## Key Points

1. **Worker must be deployed to work** - HTML responses mean it's not deployed
2. **"GitHub integration error" is cosmetic** - ignore it if deployments work
3. **Don't change wrangler.jsonc name** - it's correct as "qcv2"
4. **Pages and Worker are separate** - they must have different names
5. **Deploy worker before Pages** - Pages needs the worker URL
