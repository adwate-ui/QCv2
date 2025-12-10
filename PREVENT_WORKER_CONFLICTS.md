# Complete Deployment Separation Guide

## The Solution: Path-Based Triggers + Name Separation

This repository implements **complete deployment separation** using two mechanisms:

1. **Path-Based Workflow Triggers** - Workflows only run when relevant files change
2. **Name Separation** - Different deployment names prevent conflicts

## How It Works

### Architecture Overview

```
Repository Structure:
├── .github/workflows/
│   ├── deploy.yml          ← Triggers on FRONTEND changes only
│   └── deploy-worker.yml   ← Triggers on WORKER changes only
├── wrangler.toml          ← Pages config: name = "qcv2"
├── cloudflare-worker/
│   └── wrangler.toml      ← Worker config: name = "authentiqc-worker"

Result:
✓ Frontend change → Only Pages deploys
✓ Worker change   → Only Worker deploys
✓ Both change     → Both deploy
✓ No conflicts    → Different names prevent overwrites
```

## Path-Based Triggers

### Pages Workflow (deploy.yml)

Triggers on changes to:
- Frontend code: `*.tsx`, `*.ts`, `*.jsx`, `*.js`, `*.css`
- Configuration: `package.json`, `vite.config.ts`, `tsconfig.json`
- Directories: `components/`, `context/`, `pages/`, `services/`, `src/`, `public/`
- **Explicitly excludes**: `cloudflare-worker/**`

### Worker Workflow (deploy-worker.yml)

Triggers on changes to:
- `cloudflare-worker/**` (any file in worker directory)
- `.github/workflows/deploy-worker.yml` (workflow itself)

### Benefits

✅ **No Unnecessary Deployments**: Each service only deploys when its code changes
✅ **Faster CI/CD**: No wasted build minutes on unchanged services
✅ **Reduced Conflicts**: Fewer simultaneous deployments
✅ **Clear Separation**: Easy to understand what triggers what

## Name Separation

### Why Names Must Be Different

Cloudflare uses the `name` field in wrangler.toml to determine:
- Deployment target URL
- Resource identification
- Routing configuration

**If two configs have the same name, they deploy to the same URL, causing one to overwrite the other.**

### Current Configuration

| Component | Name | URL | Config File |
|-----------|------|-----|-------------|
| **Pages** | `qcv2` | `https://qcv2.pages.dev` | `wrangler.toml` (root) |
| **Worker** | `authentiqc-worker` | `https://authentiqc-worker.adwate.workers.dev` | `cloudflare-worker/wrangler.toml` |

### Validation

The validation script ensures:
1. Worker config exists and has correct name
2. If root config exists, it has a different name than worker
3. Names match expected values

```bash
# Run validation
.github/scripts/validate-wrangler-configs.sh
```

## Complete Separation Checklist

When making changes, verify:

- [ ] Frontend changes don't trigger worker deployment
- [ ] Worker changes don't trigger pages deployment  
- [ ] Root `wrangler.toml` has `name = "qcv2"`
- [ ] Worker `wrangler.toml` has `name = "authentiqc-worker"`
- [ ] Names are different (no conflict)
- [ ] Validation script passes
- [ ] Only relevant workflow runs in GitHub Actions

## Testing the Separation

### Test 1: Frontend-Only Change

```bash
# Make a frontend change
echo "// test" >> components/Input.tsx
git add components/Input.tsx
git commit -m "Test: frontend change"
git push

# Expected: Only .github/workflows/deploy.yml runs
# Worker workflow should NOT run
```

### Test 2: Worker-Only Change

```bash
# Make a worker change
echo "// test" >> cloudflare-worker/index.mjs
git add cloudflare-worker/index.mjs
git commit -m "Test: worker change"
git push

# Expected: Only .github/workflows/deploy-worker.yml runs
# Pages workflow should NOT run
```

### Test 3: Both Change

```bash
# Make changes to both
echo "// test" >> components/Input.tsx
echo "// test" >> cloudflare-worker/index.mjs
git add .
git commit -m "Test: both changed"
git push

# Expected: BOTH workflows run
# This is correct behavior when both services change
```

## Troubleshooting

### Problem: Both workflows running on every push

**Diagnosis:**
- Check if you're modifying shared files (e.g., `package.json`, README)
- Some files may trigger both workflows legitimately

**Solution:**
- Review path patterns in workflow files
- Consider if both deployments are actually needed for your changes

### Problem: Worker not deploying when it should

**Diagnosis:**
- Did you change files in `cloudflare-worker/`?
- Path-based trigger requires changes in that directory

**Solution:**
- Use `workflow_dispatch` to manually trigger deployment
- Ensure your changes are in `cloudflare-worker/` directory

### Problem: Name conflict detected

**Diagnosis:**
- Run validation: `.github/scripts/validate-wrangler-configs.sh`
- Check names in both wrangler.toml files

**Solution:**
```bash
# Root wrangler.toml should have:
name = "qcv2"

# cloudflare-worker/wrangler.toml should have:
name = "authentiqc-worker"
```

### Problem: Pages deploying even though worker config changed

**Diagnosis:**
- Check if you also changed frontend files
- Check if workflow file itself was modified

**Solution:**
- This might be expected if you touched both
- Review your commit: `git show --name-only`

## Manual Deployment

Both workflows support manual triggering via `workflow_dispatch`:

1. Go to: https://github.com/adwate-ui/QCv2/actions
2. Select the workflow you want to run
3. Click "Run workflow"
4. Select branch and run

## Best Practices

1. **Make focused changes** - Change only what's needed
2. **Understand triggers** - Know which files trigger which workflow
3. **Test locally first** - Use `npm run build` and worker testing
4. **Monitor deployments** - Check GitHub Actions after pushing
5. **Use manual triggers when needed** - `workflow_dispatch` is available
6. **Keep names different** - Never use the same name for Pages and Worker
7. **Run validation** - Always run validation script before committing config changes

## Summary

The repository achieves complete deployment separation through:

1. **Path-Based Triggers**
   - Pages workflow: Triggers on frontend code changes
   - Worker workflow: Triggers on worker code changes
   - No unnecessary deployments

2. **Name Separation**
   - Pages: name = "qcv2"
   - Worker: name = "authentiqc-worker"
   - No deployment conflicts

3. **Validation**
   - Automated checks in CI/CD
   - Prevents configuration errors
   - Clear error messages

4. **Independent Workflows**
   - Each service has its own deployment workflow
   - Each workflow handles its own configuration
   - Manual triggering available when needed

This architecture ensures that Pages and Worker deployments are **completely independent** while preventing conflicts and unnecessary deployments.

- `WRANGLER_CONFIG_CONFLICT_FIX.md` - Original conflict documentation

## Summary

**Golden Rule:** Root `wrangler.jsonc` name MUST be different from `cloudflare-worker/wrangler.toml` name.

✅ Root: `"qcv2"`
✅ Worker: `"authentiqc-worker"`
✅ No conflicts
