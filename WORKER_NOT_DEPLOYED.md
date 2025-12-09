# CRITICAL: Worker Not Deployed - Diagnosis and Fix

## The Actual Problem

Your error shows a **404 with NO CORS headers**, which means:
- **The worker code is NOT running**
- Something else (likely Cloudflare's default 404 page) is returning the error
- The worker is either NOT deployed or deployed with a different name

## Diagnosis Steps

### 1. Check if Worker Exists in Cloudflare Dashboard

Go to: https://dash.cloudflare.com → Workers & Pages

**Look for:** A worker named **"authentiqc-worker"**

**If you DON'T see it:** The worker has NEVER been deployed. Go to "Deploy Now" section below.

**If you DO see it:** 
- Click on it
- Check the "Routes" tab - it should have `*.workers.dev` enabled
- Check the "Logs" tab - make a test request and see if logs appear

### 2. Test Worker Directly

```bash
# Test if worker responds (should return JSON with version info)
curl https://authentiqc-worker.adwate.workers.dev/

# Check CORS headers
curl -I https://authentiqc-worker.adwate.workers.dev/ | grep -i access-control
```

**Expected Output:**
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.2.0",
  "status": "ok",
  ...
}
```

**If you get:**
- **DNS error or 404**: Worker not deployed or wrong name
- **HTML page**: Worker not deployed, getting default Cloudflare page
- **JSON but no version 1.2.0**: Old worker code deployed

### 3. Check GitHub Secrets

Go to: https://github.com/adwate-ui/QCv2/settings/secrets/actions

**Required secrets:**
- `CF_API_TOKEN` - Cloudflare API token (must have Workers edit permission)
- `CF_ACCOUNT_ID` - Your Cloudflare account ID
- `VITE_IMAGE_PROXY_URL` - Should be `https://authentiqc-worker.adwate.workers.dev`

**Verify CF_ACCOUNT_ID matches wrangler.toml:**
```bash
cat cloudflare-worker/wrangler.toml | grep account_id
# Should show: account_id = "72edc81c65cb5830f76c57e841831d7d"
```

### 4. Check GitHub Actions Deployment

Go to: https://github.com/adwate-ui/QCv2/actions

Look for workflow: **"Deploy Cloudflare Worker"**

**If it's failing:**
- Click on the failed run
- Check the logs for errors
- Common issues:
  - Invalid `CF_API_TOKEN`
  - Wrong `CF_ACCOUNT_ID`
  - Network issues during deployment

**If it's NOT running:**
- It only runs on pushes to `main` branch
- This PR hasn't been merged yet
- You need to deploy manually (see below)

## Deploy Now (Manual Fix)

### Prerequisites

1. **Get Cloudflare API Token:**
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template
   - Copy the token

2. **Install wrangler (if not already installed):**
   ```bash
   npm install -g wrangler
   # OR use npx (no install needed)
   ```

### Deploy the Worker

```bash
# Clone/pull latest code if you haven't
cd /path/to/QCv2

# Go to worker directory
cd cloudflare-worker

# Set your API token (replace with actual token)
export CLOUDFLARE_API_TOKEN="your-token-here"

# Install dependencies
npm ci

# Deploy
npx wrangler@4 deploy

# Verify deployment
curl https://authentiqc-worker.adwate.workers.dev/
```

**Expected output from deploy:**
```
Total Upload: XX KiB / gzip: XX KiB
Uploaded authentiqc-worker (X.XX sec)
Published authentiqc-worker (X.XX sec)
  https://authentiqc-worker.adwate.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Verify It Works

```bash
# Health check
curl https://authentiqc-worker.adwate.workers.dev/

# Test fetch-metadata (the endpoint that's failing)
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://www.rolex.com/watches/sky-dweller/m336934-0001"
```

**If fetch-metadata works**, you should get JSON with an `images` array (not 404).

## Check VITE_IMAGE_PROXY_URL

The frontend needs to know the worker URL.

### Option 1: GitHub Secret (for production)

Set this in GitHub: https://github.com/adwate-ui/QCv2/settings/secrets/actions

- Name: `VITE_IMAGE_PROXY_URL`
- Value: `https://authentiqc-worker.adwate.workers.dev`

Then **redeploy** the Pages site (push to main or manually trigger deploy workflow).

### Option 2: Cloudflare Pages Environment Variable

Go to: https://dash.cloudflare.com → Workers & Pages → qcv2 → Settings → Environment Variables

Add:
- Variable name: `VITE_IMAGE_PROXY_URL`
- Value: `https://authentiqc-worker.adwate.workers.dev`

Then **redeploy** the Pages site.

### Option 3: Local Development

Create `.env.local`:
```bash
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev
```

Restart dev server:
```bash
npm run dev
```

## Common Mistakes

### 1. Worker Name Mismatch

**Check wrangler.toml:**
```bash
cd cloudflare-worker
cat wrangler.toml | grep "name ="
```

Should show: `name = "authentiqc-worker"`

If it shows something else, the worker URL will be different:
- Worker name in toml: `foo-bar`
- Actual URL: `https://foo-bar.adwate.workers.dev`

### 2. Deploying from Wrong Directory

**WRONG:**
```bash
cd QCv2
npx wrangler@4 deploy  # ❌ Uses root wrangler.toml (Pages config)
```

**CORRECT:**
```bash
cd QCv2/cloudflare-worker
npx wrangler@4 deploy  # ✅ Uses worker wrangler.toml
```

### 3. Old Cache

After deploying:
- **Clear browser cache** (hard refresh: Ctrl+Shift+R)
- **Wait 30 seconds** for Cloudflare edge cache to update
- **Test in incognito window** to avoid cache

## Still Not Working?

### Check Cloudflare Logs

**Via Dashboard:**
1. Go to: https://dash.cloudflare.com
2. Workers & Pages → authentiqc-worker → Logs
3. Real-time tab
4. Make a request from your app
5. Watch for log entries

**Via CLI:**
```bash
cd cloudflare-worker
npx wrangler@4 tail
```

**What to look for:**
- `[Worker] GET /fetch-metadata` - Worker received the request ✓
- `[Worker] 404 - Path not found` - Route doesn't match ✗
- No logs at all - Worker not deployed or not receiving requests ✗

### Check Account ID

```bash
# Get your actual account ID from Cloudflare
npx wrangler@4 whoami

# Compare with wrangler.toml
cat cloudflare-worker/wrangler.toml | grep account_id
```

If they don't match, update wrangler.toml with the correct account_id.

## Summary

**The code is correct.** The worker just needs to be deployed.

**Quick fix:**
1. cd cloudflare-worker
2. export CLOUDFLARE_API_TOKEN="your-token"
3. npx wrangler@4 deploy
4. Verify: curl https://authentiqc-worker.adwate.workers.dev/
5. Set VITE_IMAGE_PROXY_URL secret in GitHub
6. Redeploy Pages (push to main)
7. Hard refresh browser
8. Test product identification

**If still failing after deployment, the worker IS deployed but something else is wrong. Share:**
- Output of: `curl https://authentiqc-worker.adwate.workers.dev/`
- Output of: `curl -I https://authentiqc-worker.adwate.workers.dev/`
- Screenshot of Cloudflare dashboard showing the worker
- Browser console error (full stack trace)
- Network tab showing the request/response headers
