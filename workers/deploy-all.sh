#!/bin/bash
# Deploy all Cloudflare Workers

set -e

echo "=== Deploying All Cloudflare Workers ==="

# Image Proxy Worker
echo ""
echo "Deploying Image Proxy Worker..."
cd image-proxy
npx wrangler@4 deploy
cd ..

echo ""
echo "=== All workers deployed successfully ==="
