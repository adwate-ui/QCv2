# Quick Fix: Image Proxy Configuration Error

If you're seeing the error "Image proxy not configured. Please set VITE_IMAGE_PROXY_URL environment variable", follow these steps:

## Immediate Solution

### Step 1: Get Your Worker URL

Your Cloudflare Worker should already be deployed. Find its URL:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click on **authentiqc-worker**
4. Copy the URL (it looks like: `https://authentiqc-worker.XXXXX.workers.dev`)

If the worker isn't deployed yet, deploy it first:
```bash
cd cloudflare-worker
npx wrangler@4 deploy index.mjs --name authentiqc-worker
```

### Step 2: Set GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Set:
   - **Name**: `VITE_IMAGE_PROXY_URL`
   - **Value**: Your worker URL from Step 1 (e.g., `https://authentiqc-worker.XXXXX.workers.dev`)
5. Click **Add secret**

### Step 3: Redeploy

Option A: Push a commit to trigger automatic deployment
```bash
git commit --allow-empty -m "Trigger redeploy with worker URL"
git push origin main
```

Option B: Manually trigger GitHub Actions
1. Go to your repository's **Actions** tab
2. Select **Deploy to Cloudflare Pages** workflow
3. Click **Run workflow** → **Run workflow**

### Step 4: Verify

1. Wait for the deployment to complete (check Actions tab)
2. Open your deployed app (e.g., `https://qcv2.pages.dev`)
3. Open browser console (F12)
4. Run: `import.meta.env.VITE_IMAGE_PROXY_URL`
5. It should show your worker URL (not `undefined`)

## Why This Happens

The error occurs because:
- Vite environment variables (starting with `VITE_`) are **embedded during build time**
- They need to be set **when building**, not at runtime
- The GitHub Actions workflow now passes `VITE_IMAGE_PROXY_URL` during the build step

## Alternative: Set in Cloudflare Pages (Not Recommended)

⚠️ **Note**: Setting environment variables in Cloudflare Pages dashboard only works for Cloudflare Pages Functions, not for Vite builds. The GitHub Actions method above is the correct approach.

## Need More Help?

- See [CLOUDFLARE_DEPLOYMENT_GUIDE.md](CLOUDFLARE_DEPLOYMENT_GUIDE.md) for detailed deployment instructions
- See [IMAGE_FETCHING_GUIDE.md](IMAGE_FETCHING_GUIDE.md) for troubleshooting image fetching issues
- Run `./cloudflare-setup-checker.sh` to verify your deployment setup

## Testing

Test your worker directly:
```bash
curl "https://your-worker-url.workers.dev/fetch-metadata?url=https://example.com"
```

You should get a JSON response with an `images` array.
