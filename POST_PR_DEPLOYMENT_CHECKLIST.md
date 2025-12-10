# 🚀 POST-PR DEPLOYMENT CHECKLIST

## Quick Reference for Deploying After PR Merge

This checklist guides you through deploying the worker and verifying everything works correctly after this PR is merged.

---

## ⚡ Quick Deploy (5 Minutes)

### Step 1: Get Your Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Click "Continue to summary"
5. Click "Create Token"
6. **Copy the token** (you won't see it again!)

### Step 2: Deploy the Worker

```bash
# Navigate to worker directory
cd cloudflare-worker

# Set your API token (replace with actual token)
export CLOUDFLARE_API_TOKEN="your-token-here"

# Install dependencies
npm ci

# Deploy
npx wrangler@4 deploy
```

**Expected output:**
```
✨ Success! Uploaded authentiqc-worker
Published authentiqc-worker (X.XX sec)
  https://authentiqc-worker.adwate.workers.dev
```

### Step 3: Verify Deployment

```bash
# Test health check
curl https://authentiqc-worker.adwate.workers.dev/
```

**Expected response (JSON):**
```json
{
  "name": "AuthentiqC Image Proxy Worker",
  "version": "1.3.0",
  "status": "ok",
  "endpoints": [...]
}
```

**✅ If you see JSON with version 1.3.0, deployment succeeded!**

**❌ If you see HTML or 404, deployment failed. Check logs.**

---

## 🔍 Detailed Verification

### Test 1: CORS Headers

```bash
curl -I https://authentiqc-worker.adwate.workers.dev/ | grep -i access-control
```

**Expected output:**
```
access-control-allow-origin: *
x-worker-version: 1.3.0
```

### Test 2: Fetch Metadata Endpoint

```bash
curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://www.cloudflare.com"
```

**Expected output:**
```json
{
  "images": [
    "https://www.cloudflare.com/img/...",
    ...
  ]
}
```

### Test 3: Proxy Image Endpoint

```bash
curl "https://authentiqc-worker.adwate.workers.dev/proxy-image?url=https://www.cloudflare.com/img/logo.png" -o test.png
```

**Expected:** Downloads test.png file (should be a valid image)

### Test 4: Application Integration

1. Open: https://qcv2.pages.dev
2. Click "Add Product"
3. Select "Identify from URL"
4. Enter a product URL (e.g., from Amazon, Nike, Rolex)
5. Click "Identify"

**Expected:**
- ✅ Images load successfully
- ✅ Product is identified
- ✅ No errors in browser console (F12)
- ✅ Product details displayed

---

## 🔧 Environment Variables Setup

### GitHub Secrets (Required for GitHub Actions)

Go to: https://github.com/adwate-ui/QCv2/settings/secrets/actions

**Verify these exist:**

- ✅ `CF_API_TOKEN` - Your Cloudflare API token (from Step 1)
- ✅ `CF_ACCOUNT_ID` - Your Cloudflare account ID
- ✅ `VITE_IMAGE_PROXY_URL` - Must be `https://authentiqc-worker.adwate.workers.dev`
- ✅ `GEMINI_API_KEY` - Your Google Gemini API key

**If missing, add them:**

1. Click "New repository secret"
2. Enter name and value
3. Click "Add secret"

### Get Your Cloudflare Account ID

```bash
npx wrangler@4 whoami
```

Or go to: https://dash.cloudflare.com → Copy Account ID from sidebar

---

## 📋 Troubleshooting Checklist

### Problem: Worker returns HTML instead of JSON

**Diagnosis:**
```bash
curl https://authentiqc-worker.adwate.workers.dev/
# If HTML: Worker not deployed
# If JSON: Worker is deployed ✅
```

**Fix:**
1. Verify you're in `cloudflare-worker/` directory
2. Verify `CLOUDFLARE_API_TOKEN` is set
3. Run `npx wrangler@4 deploy` again
4. Check for errors in deploy output
5. Wait 30 seconds and try curl again

### Problem: CORS errors in browser

**Diagnosis:**
```bash
curl -I https://authentiqc-worker.adwate.workers.dev/ | grep -i access-control
# Should see: access-control-allow-origin: *
```

**Fix:**
1. Verify worker is deployed (curl health check)
2. Hard refresh browser (Ctrl+Shift+R)
3. Clear browser cache
4. Try in incognito window
5. Check Network tab for actual error

### Problem: Images not loading in application

**Diagnosis:**
1. Open browser DevTools (F12)
2. Go to Console tab - check for errors
3. Go to Network tab - filter "fetch"
4. Try to load a product
5. Check request to worker:
   - URL should include `authentiqc-worker.adwate.workers.dev`
   - Status should be 200
   - Response should be JSON

**Fix:**
1. Verify `VITE_IMAGE_PROXY_URL` is set in environment
2. Redeploy Pages (push to main or trigger workflow)
3. Verify worker is accessible (curl tests)
4. Check browser console for specific error

### Problem: GitHub Actions deployment fails

**Diagnosis:**
1. Go to: https://github.com/adwate-ui/QCv2/actions
2. Click failed workflow run
3. Read error message

**Common causes:**
- ❌ `CF_API_TOKEN` not set → Add in GitHub secrets
- ❌ `CF_ACCOUNT_ID` not set → Add in GitHub secrets
- ❌ Token lacks permissions → Create new token with "Edit Cloudflare Workers"
- ❌ Account ID mismatch → Verify with `npx wrangler@4 whoami`

---

## ✅ Success Criteria

You're done when ALL of these are true:

- [ ] `curl https://authentiqc-worker.adwate.workers.dev/` returns JSON
- [ ] JSON response includes `"version": "1.3.0"`
- [ ] CORS headers present in response
- [ ] `/fetch-metadata` endpoint returns images array
- [ ] `/proxy-image` endpoint downloads images
- [ ] Application can import products by URL
- [ ] No CORS errors in browser console
- [ ] GitHub Actions shows green checkmarks
- [ ] Images load correctly in application

---

## 🔄 Future Deployments

After initial setup, deployments are automatic:

### For Worker Changes

1. Make code changes in `cloudflare-worker/`
2. Commit and push to `main` branch
3. GitHub Actions automatically deploys
4. Verify with curl commands

**Or manual deploy:**
```bash
cd cloudflare-worker
npx wrangler@4 deploy
```

### For Pages Changes

1. Make changes to frontend code
2. Commit and push to `main` branch
3. GitHub Actions automatically builds and deploys
4. Verify at https://qcv2.pages.dev

---

## 📚 Documentation Reference

**Quick fixes:**
- `QUICK_FIX_WORKER_HTML.md` - HTML instead of JSON fix

**Comprehensive guides:**
- `CLOUDFLARE_CONFIGURATION_GUIDE.md` - Complete architecture
- `GITHUB_INTEGRATION_ERROR_FIX.md` - Integration troubleshooting
- `WORKER_DEPLOYMENT_RESOLUTION_SUMMARY.md` - Detailed analysis
- `RESOLUTION_COMPLETE.md` - Executive summary

**Worker specific:**
- `cloudflare-worker/README.md` - Worker documentation

---

## ⚠️ Important Reminders

### DO:
- ✅ Deploy from `cloudflare-worker/` directory
- ✅ Keep wrangler.jsonc name as "qcv2"
- ✅ Keep worker wrangler.toml name as "authentiqc-worker"
- ✅ Set `VITE_IMAGE_PROXY_URL` environment variable
- ✅ Test after deployment

### DON'T:
- ❌ Deploy from root directory
- ❌ Change configuration names to match
- ❌ Worry about GitHub integration error (cosmetic)
- ❌ Hardcode account_id in wrangler files

---

## 🆘 Getting Help

If you're stuck:

1. **Check logs:**
   - Deployment logs (terminal output)
   - GitHub Actions logs (workflow page)
   - Cloudflare Dashboard → Workers → Logs

2. **Run diagnostics:**
   ```bash
   # Health check
   curl https://authentiqc-worker.adwate.workers.dev/
   
   # CORS check
   curl -I https://authentiqc-worker.adwate.workers.dev/
   
   # Endpoint test
   curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com"
   ```

3. **Check configuration:**
   ```bash
   # Validate configs
   .github/scripts/validate-wrangler-configs.sh
   
   # Check account
   npx wrangler@4 whoami
   ```

4. **Share diagnostics:**
   - Curl command outputs
   - Browser console errors
   - Network tab screenshots
   - GitHub Actions logs
   - Cloudflare Dashboard screenshots

---

## 🎉 You're Done!

Once all success criteria are met, your deployment is complete and the worker is functioning correctly.

**Next step:** Start using the application to import and analyze products!
