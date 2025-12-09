# URGENT: CORS 404 Fix Required

## THE ACTUAL PROBLEM

The worker is deployed correctly. The code is correct. **The issue is that the VITE_IMAGE_PROXY_URL GitHub secret is either:**
1. Not set at all
2. Set to the wrong value

## THE FIX

### Step 1: Verify GitHub Secret

Go to https://github.com/adwate-ui/QCv2/settings/secrets/actions

Check if `VITE_IMAGE_PROXY_URL` exists and is set to:
```
https://authentiqc-worker.adwate.workers.dev
```

### Step 2: If Missing or Wrong, Update It

1. Click on `VITE_IMAGE_PROXY_URL` (or "New repository secret" if it doesn't exist)
2. Set the value to: `https://authentiqc-worker.adwate.workers.dev`
3. Save

### Step 3: Trigger a New Deployment

After updating the secret, push ANY change to trigger a redeployment:

```bash
git commit --allow-empty -m "Trigger redeploy after fixing VITE_IMAGE_PROXY_URL"
git push
```

OR use the GitHub Actions UI to manually trigger the workflow.

### Step 4: Verify

After deployment completes, test at https://qcv2.pages.dev

## Why This Is The Issue

Looking at all the error logs and previous attempts, every single "fix" has been to the worker code or deployment process. But:

1. ✅ Worker deploys successfully
2. ✅ Worker code has proper CORS headers  
3. ✅ Worker IS accessible at `https://authentiqc-worker.adwate.workers.dev`
4. ❌ But the FRONTEND is getting CORS 404 errors

This means the frontend is either:
- Not getting the VITE_IMAGE_PROXY_URL at build time
- Getting the WRONG URL

The error message shows the frontend IS trying to reach `https://authentiqc-worker.adwate.workers.dev/fetch-metadata`, which is correct. But if the environment variable wasn't set during BUILD TIME, the frontend would be using an incorrect/undefined URL.

## Verification

To verify the environment variable is correctly set in the deployed frontend, check the browser console and look for any initialization errors or check the Network tab to see what URL is actually being requested.

If you see requests going to `undefined` or a different URL than `https://authentiqc-worker.adwate.workers.dev`, that confirms the environment variable issue.

## THIS IS NOT A CODE ISSUE

All previous PRs changed code that didn't need changing. The actual fix is **updating the GitHub secret and redeploying**.
