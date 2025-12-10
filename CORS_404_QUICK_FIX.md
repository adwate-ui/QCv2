# CORS 404 Quick Fix Card

## 🚨 If You See This Error:
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata...' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
GET ... net::ERR_FAILED 404 (Not Found)
```

## ✅ Quick Diagnosis (30 seconds)

### 1. Is the worker deployed?
```bash
curl https://authentiqc-worker.adwate.workers.dev/
```
- **Expected**: JSON with `{"status":"ok","version":"1.2.0"}`
- **If 404**: Worker is NOT deployed → Go to Fix #1
- **If timeout**: Network/DNS issue → Go to Fix #2
- **If 200**: Worker is deployed → Go to Fix #3

### 2. Check latest deployment
```
https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml
```
- **Look for**: Green checkmark on latest run
- **If failed**: Click run → Check "Verify worker deployment" step
- **If passed**: Worker should be live (might be cached)

### 3. Check environment variable
```javascript
// In browser console on https://qcv2.pages.dev
console.log(import.meta.env.VITE_IMAGE_PROXY_URL)
```
- **Expected**: `https://authentiqc-worker.adwate.workers.dev`
- **If undefined**: Not set → Go to Fix #4
- **If wrong URL**: Update → Go to Fix #5

## 🔧 Quick Fixes

### Fix #1: Worker Not Deployed
**Symptom**: curl returns 404

**Solution A - Auto Deploy (Recommended)**:
```bash
# Trigger GitHub Actions workflow
# Go to: https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml
# Click: "Run workflow" → Run workflow
# Wait: 2-3 minutes for deployment
# Verify: curl https://authentiqc-worker.adwate.workers.dev/
```

**Solution B - Manual Deploy**:
```bash
git clone https://github.com/adwate-ui/QCv2.git
cd QCv2/cloudflare-worker
npm install
npx wrangler@4 deploy
# When prompted, login with your Cloudflare account
```

### Fix #2: Network/DNS Issue
**Symptom**: curl times out or DNS error

**Solution**:
```bash
# Wait 5 minutes for DNS propagation
# Try again
curl https://authentiqc-worker.adwate.workers.dev/

# If still failing, check Cloudflare status
# https://www.cloudflarestatus.com/
```

### Fix #3: Worker Deployed But Still 404
**Symptom**: Root endpoint works, but /fetch-metadata returns 404

**Solution**:
```bash
# Check worker version
curl https://authentiqc-worker.adwate.workers.dev/ | grep version

# If version is old (< 1.2.0), redeploy:
# Go to: https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml
# Click: "Run workflow"
```

### Fix #4: VITE_IMAGE_PROXY_URL Not Set
**Symptom**: Environment variable is undefined

**For Production (Cloudflare Pages)**:
```
1. Go to: https://dash.cloudflare.com
2. Navigate to: Pages → qcv2 → Settings → Environment variables
3. Add/Update: 
   - Name: VITE_IMAGE_PROXY_URL
   - Value: https://authentiqc-worker.adwate.workers.dev
4. Save and redeploy
```

**For Local Development**:
```bash
# Create .env.local file
echo "VITE_IMAGE_PROXY_URL=https://authentiqc-worker.adwate.workers.dev" > .env.local

# Restart dev server
npm run dev
```

### Fix #5: Wrong URL Configured
**Symptom**: URL is set but points to wrong location

**Check these locations**:
1. `.env.local` (local dev)
2. Cloudflare Pages settings (production)
3. GitHub Secrets (if using CI/CD)

**Correct URL**: `https://authentiqc-worker.adwate.workers.dev`
- ✅ With or without trailing slash is fine
- ✅ With or without `/fetch-metadata` is fine (app normalizes it)
- ❌ No port numbers
- ❌ No http:// (must be https://)

## 🛡️ Prevention (Already Implemented)

The application now includes:

### 1. Health Check Service
- Automatically checks worker health before EVERY request
- Caches result for 30 seconds
- Provides clear error if worker is down

### 2. Circuit Breaker
- Opens after 3 failures
- Blocks requests for 60 seconds
- Automatically retries when time expires
- Closes on successful request

### 3. Retry Logic
- 3 retries with exponential backoff
- Only retries retriable errors (5xx, 429, network)
- Fast fails on 404 (deployment issue)

### 4. Enhanced Deployment Verification
- GitHub Actions now verifies deployment
- Tests health endpoint
- Checks CORS headers
- Tests fetch-metadata endpoint
- Fails if worker returns 404

### 5. Better Error Messages
- Root cause explanation
- Numbered troubleshooting steps
- Links to documentation
- Context about what was being attempted

## 📊 Monitoring

### Browser Console
Look for these logs:
```javascript
// Healthy
[WorkerHealth] Worker is healthy (version: 1.2.0)
[ImageService] Successfully processed product URL

// Unhealthy
[WorkerHealth] Health check failed: HTTP 404
[WorkerHealth] Circuit breaker opened after 3 failures
[ImageService] Worker health check failed
```

### GitHub Actions
Check workflow runs:
```
✓✓✓ ALL VERIFICATION CHECKS PASSED ✓✓✓
```

If you see:
```
✗✗✗ DEPLOYMENT VERIFICATION FAILED ✗✗✗
```
Then deployment failed and frontend will have issues.

## 📚 Full Documentation

For detailed information, see:
- **CORS_404_PREVENTION_GUIDE.md** - Complete prevention guide
- **CLOUDFLARE_DEPLOYMENT_GUIDE.md** - Deployment instructions
- **IMAGE_FETCHING_GUIDE.md** - Image fetching architecture

## 🆘 Still Not Working?

1. ✅ Verified worker is deployed (curl returns 200)
2. ✅ Environment variable is set correctly
3. ✅ GitHub Actions workflow passed
4. ✅ Still getting CORS 404 errors

**Then**:
1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Try incognito/private window
3. Check browser console for exact error
4. Check Network tab for actual request URL
5. Create GitHub issue with:
   - Browser console logs
   - Network tab screenshot
   - Worker curl output
   - GitHub Actions workflow URL

## ⚡ Emergency Rollback

If new deployment broke the worker:

```bash
# Go to Cloudflare Dashboard
# https://dash.cloudflare.com → Workers & Pages → authentiqc-worker

# Click "Deployments"
# Find last working deployment (look for green checkmark)
# Click "..." → "Rollback to this deployment"
# Wait 1 minute
# Verify: curl https://authentiqc-worker.adwate.workers.dev/
```

---

**Last Updated**: 2025-12-10
**Worker Version**: 1.2.0
**App Version**: Latest from main branch
