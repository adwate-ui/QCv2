# How to Prevent Worker Name Conflicts

## The Issue

When deploying to Cloudflare, having two configurations with the same `name` field causes one deployment to overwrite the other, even if they're in different files or directories.

## Rule: Keep Names Separate

### ✅ Correct Configuration

```
Repository Structure:
├── wrangler.jsonc               ← Pages config: name = "qcv2"
└── cloudflare-worker/
    └── wrangler.toml            ← Worker config: name = "authentiqc-worker"

Result:
✓ Pages deploys to:  https://qcv2.pages.dev/
✓ Worker deploys to: https://authentiqc-worker.adwate.workers.dev/
✓ No conflict - both work
```

### ❌ Incorrect Configuration (Causes Conflict)

```
Repository Structure:
├── wrangler.jsonc               ← Pages config: name = "authentiqc-worker" ❌
└── cloudflare-worker/
    └── wrangler.toml            ← Worker config: name = "authentiqc-worker"

Result:
✗ Both try to deploy to: https://authentiqc-worker.adwate.workers.dev/
✗ Pages deployment overwrites worker
✗ Worker URL serves static HTML instead of API
✗ Application shows "Worker Offline"
```

## Validation Checklist

Before committing changes to wrangler configs, check:

- [ ] Root `wrangler.jsonc` has `name: "qcv2"`
- [ ] Worker `wrangler.toml` has `name: "authentiqc-worker"`
- [ ] Names are different
- [ ] Run validation: `.github/scripts/validate-wrangler-configs.sh`

## Automated Protection

The repository now has automated validation:

1. **Local Validation**
   ```bash
   .github/scripts/validate-wrangler-configs.sh
   ```
   Run this before committing config changes.

2. **CI/CD Validation**
   Both deployment workflows automatically validate configs:
   - `.github/workflows/deploy-worker.yml`
   - `.github/workflows/deploy.yml`

3. **Build Failure**
   If names conflict, the build fails with a clear error message.

## Warning Signs

If you see these symptoms, check for name conflicts:

- 🔴 Worker shows as offline in UI
- 🔴 Worker URL returns HTML instead of JSON
- 🔴 CORS errors when fetching images from URLs
- 🔴 curl to worker returns React app HTML

## Quick Fix

If you accidentally create a conflict:

1. **Check the names:**
   ```bash
   # Check root config
   grep '"name"' wrangler.jsonc
   
   # Check worker config
   grep '^name' cloudflare-worker/wrangler.toml
   ```

2. **Fix the root config:**
   Edit `wrangler.jsonc`:
   ```jsonc
   {
     "name": "qcv2",  // ← Must be different from worker
     "compatibility_date": "2025-12-10",
     "assets": {
       "directory": "./dist"
     }
   }
   ```

3. **Validate:**
   ```bash
   .github/scripts/validate-wrangler-configs.sh
   ```

4. **Commit and push:**
   ```bash
   git add wrangler.jsonc
   git commit -m "Fix wrangler name conflict"
   git push
   ```

5. **Wait for deployment:**
   Check GitHub Actions for successful deployment.

## Why This Matters

Cloudflare uses the `name` field to determine:
- Subdomain for workers: `{name}.{account}.workers.dev`
- Project name for tracking and management
- Routing and DNS configuration

When two configs use the same name:
- They deploy to the same URL
- The later deployment overwrites the earlier one
- Only one can be active at a time

## Project Naming Convention

This project uses:

| Component | Name | URL | Purpose |
|-----------|------|-----|---------|
| **Pages (Root)** | `qcv2` | `https://qcv2.pages.dev/` | React application frontend |
| **Worker (API)** | `authentiqc-worker` | `https://authentiqc-worker.adwate.workers.dev/` | Image proxy and API endpoints |

**Never change these names unless you have a specific reason and understand the implications.**

## Best Practices

1. **Always use different names** for Pages and Workers
2. **Match Pages name** to the Cloudflare Pages project name
3. **Use descriptive names** that indicate what they're for
4. **Run validation** before committing wrangler config changes
5. **Test after deployment** to ensure both are working
6. **Document naming** in comments within config files

## Related Documentation

- `WORKER_NAME_CONFLICT_FIX.md` - Detailed explanation of the December 2025 fix
- `WORKER_FIX_VERIFICATION.md` - How to verify the fix works
- `CLOUDFLARE_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `WRANGLER_CONFIG_CONFLICT_FIX.md` - Original conflict documentation

## Summary

**Golden Rule:** Root `wrangler.jsonc` name MUST be different from `cloudflare-worker/wrangler.toml` name.

✅ Root: `"qcv2"`
✅ Worker: `"authentiqc-worker"`
✅ No conflicts
