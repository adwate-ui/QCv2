# Cloudflare Pages Deploy Command Fix (December 2025)

## 🚨 CRITICAL ISSUE

The worker deployment is failing with the following error during Cloudflare Pages build:

```
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

This error occurs at the "Executing user deploy command: npx wrangler deploy" step.

## 🔍 Root Cause

**The Cloudflare Pages dashboard has a custom "deploy command" configured that should not be there.**

### What's Happening:

1. ✅ Cloudflare Pages build runs successfully (`npm run build`)
2. ✅ Build outputs to `dist/` directory as expected
3. ❌ **Then Pages executes a custom deploy command: `npx wrangler deploy`**
4. ❌ This command runs from the **root directory** where there is **no wrangler configuration**
5. ❌ Wrangler fails with "Missing entry-point to Worker script"
6. ❌ **The Pages deployment fails even though the build succeeded**

### Why This is Wrong:

- **Pages deployment** is handled by **GitHub Actions** via `cloudflare/pages-action@v1`
- **No wrangler command** should be executed for Pages deployment
- The custom deploy command is unnecessary and causes conflicts
- Worker deployment is handled separately by `.github/workflows/deploy-worker.yml`

## ✅ SOLUTION (REQUIRED MANUAL ACTION)

**You MUST manually fix this in the Cloudflare Dashboard** (cannot be automated):

### Step 1: Access Cloudflare Pages Settings

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click on **qcv2** (the Pages project)
4. Go to **Settings** tab
5. Click on **Builds & deployments** section

### Step 2: Remove the Deploy Command

1. Scroll down to **"Build configurations"** section
2. Look for the **"Deploy command"** field
3. **If it contains `npx wrangler deploy` or ANY command:**
   - **DELETE IT**
   - **Leave the field COMPLETELY EMPTY**
4. **Click "Save"** to apply changes

### Step 3: Verify Other Settings

Ensure your build configuration looks like this:

```
Build command:              npm run build
Build output directory:     dist
Root directory:             / (or leave blank)
Deploy command:             [EMPTY - MUST BE BLANK]
```

**DO NOT** set:
- ❌ Deploy command
- ❌ Any post-build commands
- ❌ Any wrangler-related commands

### Step 4: Retry Deployment

After saving the settings:

1. Go to the **Deployments** tab
2. Click **"Retry deployment"** on the latest failed deployment
3. Or push a new commit to trigger a fresh deployment

## 📊 Verification

After fixing the deploy command, you should see:

✅ **In Cloudflare Pages Build Logs:**
```
✓ Build command completed
✓ Finished building project
✓ Deploying build output
✓ Deployment complete
```

❌ **You should NOT see:**
```
Executing user deploy command: npx wrangler deploy
```

## 🏗️ How Deployment Should Work

### Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ PAGES DEPLOYMENT (Frontend)                                   │
├───────────────────────────────────────────────────────────────┤
│ Method:  GitHub Actions (automatic)                           │
│ Workflow: .github/workflows/deploy.yml                        │
│ Action:   cloudflare/pages-action@v1                          │
│ Source:   dist/ directory                                     │
│ URL:      https://qcv2.pages.dev                              │
│                                                                │
│ NO wrangler command                                           │
│ NO deploy command in dashboard                                │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ WORKER DEPLOYMENT (Image Proxy API)                           │
├───────────────────────────────────────────────────────────────┤
│ Method:  GitHub Actions (separate workflow)                   │
│ Workflow: .github/workflows/deploy-worker.yml                 │
│ Command:  npx wrangler@4 deploy                               │
│ Config:   cloudflare-worker/wrangler.toml                     │
│ URL:      https://authentiqc-worker.adwate.workers.dev        │
│                                                                │
│ Runs from cloudflare-worker/ directory                        │
│ Uses wrangler.toml configuration                              │
└───────────────────────────────────────────────────────────────┘
```

### Deployment Flow

**When you push to main branch:**

1. **GitHub Actions** triggers two workflows:
   
   a. **Pages workflow** (`.github/workflows/deploy.yml`):
      - Installs dependencies
      - Runs `npm run build` → creates `dist/`
      - Uses `cloudflare/pages-action@v1` to deploy
      - ✅ **No wrangler command involved**
   
   b. **Worker workflow** (`.github/workflows/deploy-worker.yml`):
      - Changes to `cloudflare-worker/` directory
      - Installs worker dependencies
      - Runs `npx wrangler@4 deploy` (with proper config)
      - Verifies deployment with health checks

## 🚫 Common Mistakes to Avoid

### ❌ Mistake 1: Setting a Deploy Command

**Don't do this in Cloudflare Pages settings:**
```
Deploy command: npx wrangler deploy
```

**Why it's wrong:**
- GitHub Actions already handles deployment
- Wrangler will fail (no config at root)
- Causes the error you're seeing

### ❌ Mistake 2: Adding Root wrangler.jsonc

**Don't create this file:**
```
/wrangler.jsonc  ← DO NOT CREATE
```

**Why it's wrong:**
- Pages deployment via GitHub Actions doesn't need it
- Can cause name conflicts with worker
- Will confuse wrangler about what to deploy

### ❌ Mistake 3: Using wrangler pages deploy

**Don't use this command:**
```bash
npx wrangler pages deploy dist
```

**Why it's wrong:**
- GitHub Actions handles it automatically
- Adds unnecessary complexity
- Can cause authentication issues

## ✅ Correct Configuration Checklist

Use this checklist to verify your setup:

- [ ] Cloudflare Pages deploy command field is **EMPTY**
- [ ] Build command is set to `npm run build`
- [ ] Build output directory is set to `dist`
- [ ] **NO** `wrangler.jsonc` file exists in root directory
- [ ] Worker has its own config at `cloudflare-worker/wrangler.toml`
- [ ] GitHub secrets are set: `CF_API_TOKEN`, `CF_ACCOUNT_ID`
- [ ] GitHub Actions workflows are enabled

## 🔧 Troubleshooting

### Issue: Still seeing "Missing entry-point" error

**Check these:**
1. Did you save the settings in Cloudflare dashboard?
2. Did you completely remove the deploy command (not just empty it)?
3. Did you retry deployment after making changes?
4. Are you looking at a fresh deployment (not old cached logs)?

**Solution:**
- Log out and log back into Cloudflare Dashboard
- Double-check the deploy command field is blank
- Trigger a new deployment (don't just retry)

### Issue: GitHub Actions deployment fails

**Check these:**
1. Are GitHub secrets properly set?
   - `CF_API_TOKEN` (Cloudflare API token)
   - `CF_ACCOUNT_ID` (Cloudflare account ID)
2. Does the API token have correct permissions?
   - Account → Workers Scripts → Edit
   - Account → Account Settings → Read

**Solution:**
- Regenerate the Cloudflare API token
- Update the GitHub secret
- Retry the workflow

### Issue: Worker is not deploying

**This is a separate issue:**
- Worker deployment is independent from Pages
- Check `.github/workflows/deploy-worker.yml` logs
- Worker should deploy from `cloudflare-worker/` directory
- See `WORKER_DEPLOYMENT_TROUBLESHOOTING.md`

## 📚 Related Documentation

- `PAGES_DEPLOYMENT_FIX_README.md` - Background on Pages deployment
- `PREVENT_WORKER_CONFLICTS.md` - Avoiding worker name conflicts
- `CLOUDFLARE_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `.wrangler-do-not-deploy` - Safeguard marker file

## 🎯 Summary

**TL;DR:**

1. **Problem:** Cloudflare Pages has a deploy command that runs `npx wrangler deploy`
2. **Impact:** Worker deployment fails with "Missing entry-point" error
3. **Solution:** Remove the deploy command from Cloudflare Pages dashboard settings
4. **Location:** Dashboard → Workers & Pages → qcv2 → Settings → Builds & deployments
5. **Action:** DELETE the deploy command, leave field EMPTY
6. **Result:** Pages deploys via GitHub Actions, worker deploys separately

**This is a MANUAL fix that must be done in the Cloudflare Dashboard.**

---

## 🆘 Need Help?

If you're still having issues after following this guide:

1. Check GitHub Actions logs for specific errors
2. Verify Cloudflare Pages dashboard settings match this guide
3. Review related documentation files listed above
4. Check that both workflows are enabled in GitHub Actions
5. Ensure no manual changes were made to deployment configs

**Remember:** The deploy command field in Cloudflare Pages dashboard **MUST** be empty!
