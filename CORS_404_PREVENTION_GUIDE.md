# CORS 404 Error Prevention Guide

## Overview

This document explains how the application prevents CORS 404 errors and what to do if they occur.

## What is a CORS 404 Error?

When you see this error:
```
Access to fetch at 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=...' 
from origin 'https://qcv2.pages.dev' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=... 
net::ERR_FAILED 404 (Not Found)
```

**This is NOT a CORS problem** - it's a deployment problem. The 404 error without CORS headers means the Cloudflare Worker is not deployed or not accessible.

## Prevention Mechanisms

### 1. Worker Health Check Service

**Location**: `services/workerHealthService.ts`

The application now includes a comprehensive worker health check service that:

- **Checks worker health** before making any requests
- **Caches health status** for 30 seconds to reduce overhead
- **Implements circuit breaker pattern** to prevent repeated failures
- **Provides clear error messages** when worker is down
- **Retries failed requests** with exponential backoff

**How it works**:
```typescript
// Before making any worker request:
await workerHealthService.ensureHealthy();

// This will:
// 1. Check if worker URL is configured
// 2. Verify worker is responding (GET /)
// 3. Check for proper JSON response
// 4. Verify CORS headers are present
// 5. Cache the result for 30 seconds
// 6. Throw detailed error if worker is down
```

### 2. Circuit Breaker Pattern

The service implements a circuit breaker to prevent cascading failures:

**States**:
- **CLOSED** (normal): All requests go through
- **OPEN** (failing): Requests are blocked, returns cached error
- **HALF_OPEN** (testing): Try one request to see if service recovered

**Thresholds**:
- Opens after 3 consecutive failures
- Stays open for 60 seconds
- Then tries again (HALF_OPEN)
- Closes on successful request

**Benefits**:
- Prevents hammering a down worker
- Provides instant feedback to users
- Automatically recovers when worker is back

### 3. Enhanced Error Messages

All errors now include:
- **Root cause** explanation
- **Troubleshooting steps** numbered list
- **Links to documentation** for detailed help
- **Context** about what was being attempted

**Example**:
```
Cannot process product URL because the Cloudflare Worker is not available.

Worker health check failed: HTTP 404. The worker may not be deployed or is returning errors.

Possible solutions:
1. Check if VITE_IMAGE_PROXY_URL is set correctly in your environment
2. Verify the Cloudflare Worker is deployed (see CLOUDFLARE_DEPLOYMENT_GUIDE.md)
3. Test the worker URL directly in your browser
4. Check the GitHub Actions logs for deployment failures
5. If the issue persists, contact support with this error message
```

### 4. Retry Logic with Exponential Backoff

All worker requests now retry on transient failures:
- **3 retries** for network errors
- **Exponential backoff**: 1s, 2s, 4s
- **Smart retry** only on retriable errors (5xx, 429, network errors)
- **Fast fail** on non-retriable errors (404, 403)

### 5. Robust Deployment Verification

**Location**: `.github/workflows/deploy-worker.yml`

The GitHub Actions workflow now includes comprehensive verification:

```yaml
- Syntax validation (node --check)
- Deployment command
- Health check with retries (up to 6 attempts)
- CORS header verification
- Endpoint testing (/fetch-metadata)
- Version header check
- Detailed logging of all steps
```

If ANY verification step fails, the deployment is marked as failed.

### 6. Account ID in wrangler.toml

**Location**: `cloudflare-worker/wrangler.toml`

The account ID is now explicitly set:
```toml
account_id = "72edc81c65cb5830f76c57e841831d7d"
```

This ensures:
- Worker deploys to the correct account
- URL is consistent across deployments
- No ambiguity about which account to use

## When CORS 404 Errors Occur

### Immediate Steps

1. **Check Worker Health**
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   ```
   
   Expected response:
   ```json
   {
     "name": "AuthentiqC Image Proxy Worker",
     "version": "1.2.0",
     "status": "ok"
   }
   ```

2. **Check GitHub Actions**
   - Go to: https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml
   - Look for latest run
   - Check if "Verify worker deployment" step passed
   - Look for any errors in logs

3. **Check Environment Variable**
   ```javascript
   // In browser console on https://qcv2.pages.dev
   console.log(import.meta.env.VITE_IMAGE_PROXY_URL);
   ```
   
   Should show: `https://authentiqc-worker.adwate.workers.dev`

4. **Test Endpoint Directly**
   ```bash
   curl "https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://www.cloudflare.com"
   ```
   
   Should return JSON with images array (or error, but not 404)

### Root Cause Analysis

If checks above fail, determine root cause:

#### Worker Not Deployed
- **Symptom**: curl returns 404, GitHub Actions workflow failed
- **Fix**: Manually trigger deployment or fix deployment issues
- **Action**: Go to GitHub Actions → Run workflow

#### Wrong URL Configured
- **Symptom**: curl works but browser shows different URL
- **Fix**: Update VITE_IMAGE_PROXY_URL in Cloudflare Pages settings
- **Action**: Cloudflare Dashboard → Pages → qcv2 → Settings → Environment variables

#### Account/Permission Issues
- **Symptom**: Deployment succeeds but worker returns 404
- **Fix**: Verify account_id matches CF_API_TOKEN account
- **Action**: Check Cloudflare Dashboard → Workers → authentiqc-worker

#### DNS/Routing Issues
- **Symptom**: curl times out or DNS resolution fails
- **Fix**: Wait for DNS propagation (up to 5 minutes)
- **Action**: Try again in a few minutes

### Manual Deployment

If automated deployment fails:

```bash
# 1. Clone repository
git clone https://github.com/adwate-ui/QCv2.git
cd QCv2/cloudflare-worker

# 2. Install dependencies
npm install

# 3. Deploy
npx wrangler@4 deploy

# 4. Verify
curl https://authentiqc-worker.adwate.workers.dev/
```

### Rollback Procedure

If new deployment broke the worker:

1. **Revert to last working version**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or rollback in Cloudflare Dashboard**
   - Go to: Workers & Pages → authentiqc-worker → Deployments
   - Find last working deployment
   - Click "Rollback to this deployment"

3. **Verify health**
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   ```

## Monitoring and Alerts

### Health Check Monitoring

The application monitors worker health automatically:
- Checks health before each request
- Caches result for 30 seconds
- Opens circuit breaker after 3 failures
- Logs all health check results

### Browser Console Logs

Look for these logs in browser console:

**Healthy worker**:
```
[WorkerHealth] Worker is healthy (version: 1.2.0)
[ImageService] Processing product URL: https://...
[ImageService] Successfully processed product URL
```

**Unhealthy worker**:
```
[WorkerHealth] Health check failed: HTTP 404
[WorkerHealth] Circuit breaker opened after 3 failures
[ImageService] Worker health check failed: Worker is temporarily unavailable
```

### GitHub Actions Monitoring

Monitor deployment health:
1. Watch GitHub Actions → Deploy Cloudflare Worker workflow
2. Check "Verify worker deployment" step output
3. Look for "✓✓✓ ALL VERIFICATION CHECKS PASSED ✓✓✓"
4. If verification fails, deployment is automatically marked as failed

## Testing Changes

Before merging changes that affect the worker:

### 1. Test Worker Locally
```bash
cd cloudflare-worker
npm install
npx wrangler dev
```

Then test in browser:
```javascript
fetch('http://localhost:8787/')
  .then(r => r.json())
  .then(console.log)
```

### 2. Test Health Check
```javascript
import { workerHealthService } from './services/workerHealthService';

// Check health
const health = await workerHealthService.checkHealth();
console.log('Health status:', health);

// Get circuit breaker state
const cb = workerHealthService.getCircuitBreakerStatus();
console.log('Circuit breaker:', cb);
```

### 3. Test Error Handling
```javascript
// Simulate worker down
localStorage.setItem('VITE_IMAGE_PROXY_URL', 'https://invalid.example.com');

// Try to process URL
import { processProductUrl } from './src/services/imageService';
try {
  await processProductUrl('https://www.example.com');
} catch (error) {
  console.error('Expected error:', error.message);
  // Should show clear error with troubleshooting steps
}
```

### 4. Test Circuit Breaker
```javascript
// Trigger multiple failures
for (let i = 0; i < 4; i++) {
  try {
    await workerHealthService.checkHealth(true);
  } catch (e) {
    console.log(`Failure ${i + 1}:`, e.message);
  }
}

// Check circuit breaker opened
const cb = workerHealthService.getCircuitBreakerStatus();
console.log('Should be OPEN:', cb.state); // Should be 'OPEN'
```

## Maintenance

### Regular Checks

**Weekly**:
- Check GitHub Actions workflow runs
- Verify worker health endpoint
- Check error rates in browser console

**Monthly**:
- Review worker version compatibility
- Update wrangler if new version available
- Check Cloudflare Worker usage/quotas

**After Deployment**:
- Verify health check passes
- Test fetch-metadata endpoint
- Check CORS headers present
- Monitor error logs for 24 hours

### Updating Worker Code

When updating worker code:

1. **Test locally first**
   ```bash
   cd cloudflare-worker
   npx wrangler dev
   ```

2. **Update version number**
   ```javascript
   // In index.mjs
   const WORKER_VERSION = '1.3.0'; // Increment version
   ```

3. **Deploy to staging first** (if available)

4. **Merge to main** (triggers auto-deployment)

5. **Verify deployment**
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   # Check version in response
   ```

6. **Monitor for issues** for 24 hours

### Updating Dependencies

When updating worker dependencies:

1. **Update package.json**
   ```bash
   cd cloudflare-worker
   npm update
   ```

2. **Test locally**
   ```bash
   npx wrangler dev
   ```

3. **Commit package-lock.json** (if using npm ci)

4. **Deploy and verify**

## Related Documentation

- **CLOUDFLARE_DEPLOYMENT_GUIDE.md** - Complete deployment instructions
- **VITE_IMAGE_PROXY_URL_SETUP.md** - Environment variable setup
- **IMAGE_FETCHING_GUIDE.md** - Image fetching architecture
- **TROUBLESHOOTING_WORKER_ERROR.md** - Legacy troubleshooting guide
- **DEEP_DIVE_ANALYSIS_CORS_404.md** - Technical deep dive

## Support

If issues persist after following this guide:

1. Check recent GitHub issues for similar problems
2. Review GitHub Actions workflow logs
3. Check Cloudflare Worker logs in dashboard
4. Create issue with:
   - Error message from browser console
   - Worker health check results
   - GitHub Actions workflow run URL
   - Steps to reproduce

## Changelog

- **2025-12-10**: Initial guide created
  - Added worker health check service
  - Implemented circuit breaker pattern
  - Enhanced error messages
  - Improved deployment verification
  - Added comprehensive prevention mechanisms
