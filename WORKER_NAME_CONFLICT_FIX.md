# Worker Name Conflict Fix - December 10, 2025

## Issue Summary

The worker became offline after the last merge because the root `wrangler.jsonc` file had the same name as the worker configuration, causing the Cloudflare Pages deployment to overwrite the worker deployment.

### Symptom
When accessing `https://authentiqc-worker.adwate.workers.dev/`, instead of getting the worker's JSON response, the site was returning the React application's HTML, indicating that the Pages deployment had overwritten the worker.

## Root Cause

The repository has two Wrangler configuration files:

1. **Root `wrangler.jsonc`** - Used for Cloudflare Pages deployment of the React app
2. **`cloudflare-worker/wrangler.toml`** - Used for Cloudflare Worker deployment

After a recent merge, the root `wrangler.jsonc` was incorrectly configured with:
```jsonc
{
  "name": "authentiqc-worker",  // ❌ WRONG - Same as worker name
  "compatibility_date": "2025-12-10",
  "assets": {
    "directory": "./dist"
  }
}
```

The worker configuration in `cloudflare-worker/wrangler.toml` has:
```toml
name = "authentiqc-worker"  // Worker name
main = "index.mjs"
# ... other config
```

**The Problem:** When Cloudflare deploys using the root `wrangler.jsonc`, it uses the name `"authentiqc-worker"`, which is the **same subdomain** as the actual worker. This causes the Pages static site to be deployed at `authentiqc-worker.adwate.workers.dev`, overwriting the actual worker API.

## The Fix

### 1. Changed Root `wrangler.jsonc` Name

Updated `/wrangler.jsonc` to use the correct Pages project name:

```jsonc
{
  // Wrangler configuration for Cloudflare Pages deployment
  // This file is used when deploying the main application as static assets
  // IMPORTANT: This name MUST be different from the worker name to avoid conflicts
  // Pages project name: "qcv2" (matches projectName in .github/workflows/deploy.yml)
  // Worker name: "authentiqc-worker" (in cloudflare-worker/wrangler.toml)
  "name": "qcv2",  // ✅ CORRECT - Matches Cloudflare Pages project name
  "compatibility_date": "2025-12-10",
  "assets": {
    "directory": "./dist"
  }
}
```

### 2. Added Validation Script

Created `.github/scripts/validate-wrangler-configs.sh` to detect and prevent this issue:

- Checks that root `wrangler.jsonc` and worker `wrangler.toml` have different names
- Validates that names match expected values
- Provides clear error messages if conflicts are detected
- Runs automatically in CI/CD pipelines

### 3. Updated CI/CD Workflows

Added validation step to both deployment workflows:

**`.github/workflows/deploy-worker.yml`:**
```yaml
- name: Validate wrangler configurations
  run: |
    echo "Checking for wrangler configuration conflicts..."
    .github/scripts/validate-wrangler-configs.sh
    echo "✓ Wrangler configurations are valid"
```

**`.github/workflows/deploy.yml`:**
```yaml
- name: Validate wrangler configurations
  run: |
    echo "Checking for wrangler configuration conflicts..."
    .github/scripts/validate-wrangler-configs.sh
    echo "✓ Wrangler configurations are valid"
```

## Verification

After fixing the configuration:

1. **Test validation script locally:**
   ```bash
   .github/scripts/validate-wrangler-configs.sh
   ```
   
   Expected output:
   ```
   Validating wrangler configurations...
   ✓ Found root wrangler.jsonc with name: qcv2
   ✓ Found worker wrangler.toml with name: authentiqc-worker
   ✓ Names are different - no conflict
     Root (wrangler.jsonc):   qcv2
     Worker (wrangler.toml):  authentiqc-worker
   
   ✓✓✓ Wrangler configuration validation passed ✓✓✓
   ```

2. **Deploy the worker** (after merging this fix):
   - Push to main branch
   - GitHub Actions will automatically deploy the worker
   - Or manually trigger: Go to Actions → Deploy Cloudflare Worker → Run workflow

3. **Verify worker is online:**
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   ```
   
   Expected response (JSON, not HTML):
   ```json
   {
     "name": "AuthentiqC Image Proxy Worker",
     "version": "1.2.0",
     "status": "ok",
     "endpoints": [...]
   }
   ```

4. **Check worker health in UI:**
   - The WorkerHealthIndicator component should show "Worker Online"
   - Green status badge in the header
   - Image fetching from URLs should work

## Prevention

This issue is now prevented by:

1. **Validation Script** - Automatically detects name conflicts
2. **CI/CD Integration** - Validation runs before every deployment
3. **Clear Documentation** - Comments in `wrangler.jsonc` explain the separation
4. **Build Failure** - Deployment will fail if names conflict, preventing the issue

## Key Takeaways

### Correct Configuration

**Pages Deployment (Root):**
- File: `wrangler.jsonc`
- Name: `"qcv2"` (Cloudflare Pages project name)
- Purpose: Static site deployment
- URL: `https://qcv2.pages.dev/`

**Worker Deployment:**
- File: `cloudflare-worker/wrangler.toml`
- Name: `"authentiqc-worker"`
- Purpose: API/proxy worker
- URL: `https://authentiqc-worker.adwate.workers.dev/`

### Why Names Must Be Different

Cloudflare uses the `name` field to determine the deployment subdomain. If both configurations use the same name, they will deploy to the same URL, causing one to overwrite the other.

## Related Documentation

- `WRANGLER_CONFIG_CONFLICT_FIX.md` - Original conflict documentation
- `CORS_404_FIX_SUMMARY.md` - CORS and 404 troubleshooting
- `CLOUDFLARE_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `.github/workflows/deploy-worker.yml` - Worker deployment workflow
- `.github/workflows/deploy.yml` - Pages deployment workflow

## Timeline

- **Before fix:** Worker URL returned React app HTML (Pages deployment overwriting worker)
- **After fix:** Worker URL returns correct JSON API responses
- **Prevention:** Validation prevents future name conflicts
