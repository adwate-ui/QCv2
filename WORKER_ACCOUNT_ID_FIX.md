# Worker Account ID Fix - December 10, 2025

## Problem Statement

The worker deployment was failing with Cloudflare complaining that "the name in Wrangler configuration file must match deployed Worker." This issue persisted despite multiple fix attempts over 24 hours.

## Root Cause

The `cloudflare-worker/wrangler.toml` file had a **hardcoded `account_id`**:

```toml
account_id = "72edc81c65cb5830f76c57e841831d7d"
```

This caused issues because:

1. **Account Mismatch**: If the `CF_API_TOKEN` secret in GitHub Actions belongs to a different Cloudflare account than the hardcoded ID, Wrangler cannot deploy or update the worker properly.

2. **Token/Account Binding**: The hardcoded account ID may not match the account associated with the API token, causing Cloudflare to reject deployments or look for workers in the wrong account.

3. **Name Matching Error**: When account IDs don't align, Cloudflare cannot properly match the worker name in the configuration file with the deployed worker, resulting in the error message about name mismatches.

## The Fix

**Removed the hardcoded `account_id` from `cloudflare-worker/wrangler.toml`:**

### Before
```toml
name = "authentiqc-worker"
main = "index.mjs"
compatibility_date = "2025-12-08"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

account_id = "72edc81c65cb5830f76c57e841831d7d"
```

### After
```toml
name = "authentiqc-worker"
main = "index.mjs"
compatibility_date = "2025-12-08"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

# Account ID is automatically detected from the CLOUDFLARE_API_TOKEN
# Or can be set via CLOUDFLARE_ACCOUNT_ID environment variable
# Do NOT hardcode the account_id here as it may cause conflicts if the token
# belongs to a different account or if deploying to multiple accounts
```

## Why This Works

1. **Automatic Detection**: Wrangler can automatically detect the account ID from the `CLOUDFLARE_API_TOKEN` environment variable.

2. **Environment Variable**: The `.github/workflows/deploy-worker.yml` already sets `CLOUDFLARE_ACCOUNT_ID` from secrets, which Wrangler will use if account_id is not hardcoded.

3. **Flexibility**: This allows the same configuration to work across different Cloudflare accounts without modification.

4. **Correct Matching**: With the account ID properly aligned with the API token, Cloudflare can correctly match the worker name "authentiqc-worker" with the deployed worker.

## Deployment Configuration

The GitHub Actions workflow already has the correct setup:

```yaml
- name: Publish worker
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
  run: |
    cd cloudflare-worker
    npx wrangler@4 deploy --config wrangler.toml
```

Wrangler will use `CLOUDFLARE_ACCOUNT_ID` when it's not hardcoded in the configuration file.

## Correct Configuration Summary

### Pages Deployment
- **Name**: `qcv2`
- **Type**: Cloudflare Pages
- **Configuration**: Uses `cloudflare/pages-action` with `projectName: "qcv2"`
- **URL**: `https://qcv2.pages.dev`
- **No wrangler file needed**: The action handles deployment directly

### Worker Deployment  
- **Name**: `authentiqc-worker`
- **Type**: Cloudflare Worker
- **Configuration**: `cloudflare-worker/wrangler.toml`
- **URL**: `https://authentiqc-worker.adwate.workers.dev`
- **Account ID**: Automatically detected from API token

### Root wrangler.jsonc
- **Purpose**: Optional configuration file (not currently used by GitHub Actions)
- **Name**: `qcv2` (matches Pages project for consistency)
- **Note**: The Pages deployment uses `cloudflare/pages-action` directly, not this file

## Verification Steps

After merging this fix to main:

1. **GitHub Actions will automatically deploy** the worker using the updated configuration

2. **Test worker health:**
   ```bash
   curl https://authentiqc-worker.adwate.workers.dev/
   ```
   
   Expected response (JSON, not HTML):
   ```json
   {
     "name": "AuthentiqC Image Proxy Worker",
     "version": "1.2.0",
     "status": "ok",
     ...
   }
   ```

3. **Test in the application:**
   - Navigate to https://qcv2.pages.dev
   - Try to identify a product from a URL
   - Should successfully fetch images without CORS errors

## Why Previous Fixes Didn't Work

Previous attempts tried to:
- Change worker names
- Modify route configurations
- Adjust the validation script
- Update deployment workflows

However, these didn't address the root cause: the hardcoded account ID was preventing Wrangler from properly authenticating and matching the worker with the correct Cloudflare account.

## Prevention

- **Never hardcode `account_id`** in wrangler.toml - let Wrangler detect it from the API token
- **Use environment variables** for account-specific configuration
- **Validation script** ensures worker and Pages names don't conflict
- **`--config` flag** ensures only the correct wrangler file is used during deployment

## Related Files

- `cloudflare-worker/wrangler.toml` - Worker configuration (fixed)
- `.github/workflows/deploy-worker.yml` - Worker deployment workflow
- `.github/workflows/deploy.yml` - Pages deployment workflow
- `.github/scripts/validate-wrangler-configs.sh` - Configuration validation
- `wrangler.jsonc` - Root configuration (optional, not used by GitHub Actions)

## Key Takeaway

**The account ID must match the API token's account for Wrangler to properly deploy and update workers. By removing the hardcoded account ID and relying on automatic detection, the deployment process becomes more reliable and flexible.**
