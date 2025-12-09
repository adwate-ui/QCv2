<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1pShI4np7Qntn9U9CTnSQ8BNbO-mnukbd

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
   - Set the `VITE_IMAGE_PROXY_URL` to your deployed Cloudflare Worker URL (required for fetching images from product URLs)
3. Run the app:
   `npm run dev`

## Cloudflare Worker Deployment

The app requires a Cloudflare Worker to fetch images from product URLs. The worker code is in `cloudflare-worker/worker.js`.

To deploy the worker:
1. Install Wrangler CLI: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`
3. Deploy the worker: `cd cloudflare-worker && wrangler deploy`
4. Copy the worker URL and set it as `VITE_IMAGE_PROXY_URL` in your `.env.local`

The worker provides the following endpoints:
- `/fetch-metadata?url=<product_url>` - Fetches image URLs from a product page
- `/proxy-image?url=<image_url>` - Proxies image requests with CORS headers
