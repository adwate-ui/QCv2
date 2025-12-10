# IMMEDIATE FIX: Cloudflare Pages Deployment Error

## The Error You're Seeing

```
✘ [ERROR] It looks like you've run a Workers-specific command in a Pages project.
For Pages, please run `wrangler pages deploy` instead.
```

## Quick Fix (Do This Now!)

### 1. Go to Cloudflare Dashboard

Open: https://dash.cloudflare.com/

### 2. Navigate to Pages Settings

1. Click **"Workers & Pages"** in the left sidebar
2. Find and click your project: **"qcv2"**
3. Click **"Settings"** tab
4. Click **"Builds & deployments"** section

### 3. Remove the Custom Deploy Command

1. Scroll to **"Build configurations"**
2. Find the field labeled **"Deploy command"**
3. If it contains `npx wrangler deploy` or any other command:
   - **DELETE/CLEAR the entire field**
   - Leave it **EMPTY**
4. Click **"Save"**

### 4. Verify Other Settings

While you're there, confirm these settings:

| Setting | Value |
|---------|-------|
| **Framework preset** | None or Vite |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Deploy command** | **(LEAVE EMPTY)** |

### 5. Trigger New Deployment

Option A: **Push to GitHub (Recommended)**
```bash
git commit --allow-empty -m "Trigger deployment"
git push origin main
```

Option B: **Manual Trigger**
1. Go to GitHub repository
2. Click **"Actions"** tab
3. Select **"Deploy to Cloudflare Pages"** workflow
4. Click **"Run workflow"** → **"Run workflow"**

## Why This Fixes It

- **GitHub Actions already handles deployment** using `cloudflare/pages-action@v1`
- The custom deploy command was running AFTER the build, trying to use wrangler
- `npx wrangler deploy` is for **Workers**, not **Pages**
- Cloudflare Pages automatically deploys the `dist/` directory - no custom command needed

## Verification

After the fix, you should see in GitHub Actions:
- ✅ Build succeeds
- ✅ Deployment succeeds  
- ✅ No "Workers-specific command" error

Your site will be live at: https://qcv2.pages.dev

## Still Having Issues?

See detailed documentation: [PAGES_DEPLOYMENT_FIX_README.md](./PAGES_DEPLOYMENT_FIX_README.md)

## Summary

🔴 **WRONG:** Custom deploy command = `npx wrangler deploy`  
🟢 **CORRECT:** Deploy command = **(empty/blank)**

The GitHub Action handles everything automatically! 🎉
