# 🚨 CORS Error Quick Fix

## The Error You're Seeing:
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/' 
has been blocked by CORS policy
```

## What It Really Means:
**The worker is NOT deployed.** The browser shows "CORS error" but it's actually a DNS/network failure.

## Fix It NOW (2 minutes):

### Step 1: Deploy Worker
Go to: https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml

Click: **"Run workflow"** → Select "main" → Click **"Run workflow"**

Wait: 2-3 minutes

### Step 2: Verify
```bash
curl https://authentiqc-worker.adwate.workers.dev/
```

Should return:
```json
{"status":"ok","version":"1.2.0"}
```

### Step 3: Confirm
- Refresh https://qcv2.pages.dev
- Look for **"Worker Online"** badge (green dot)
- CORS errors should be GONE

## Still Broken?

### Check 1: GitHub Secrets
https://github.com/adwate-ui/QCv2/settings/secrets/actions

Required secrets:
- ✅ `CF_API_TOKEN` (Cloudflare API token)
- ✅ `CF_ACCOUNT_ID` (should be `72edc81c65cb5830f76c57e841831d7d`)

### Check 2: Deployment Log
https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml

Click latest run → Check for errors

### Check 3: Manual Deploy
```bash
cd QCv2/cloudflare-worker
npm install
npx wrangler@4 deploy
```

## Why This Happened

1. Worker was never deployed, or
2. Deployment failed silently, or
3. Worker was deleted/removed

## The Fix

The code is correct - worker has proper CORS headers.
Just needs to be deployed once!

---

**For full details:** See `URGENT_FIX_CORS_ISSUE.md`

**For verification:** Run `./verify-worker-setup.sh`
