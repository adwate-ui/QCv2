#!/bin/bash

# Quick deployment script for the Cloudflare Worker
# This script deploys the worker and verifies the deployment

set -e  # Exit on error

echo "========================================="
echo "Deploying AuthentiqC Cloudflare Worker"
echo "========================================="
echo ""

# Check if we're in the correct directory
if [ ! -f "wrangler.toml" ]; then
    echo "Error: wrangler.toml not found!"
    echo "Please run this script from the worker directory:"
    echo "  cd worker && ./deploy.sh"
    exit 1
fi

# Check if index.mjs exists
if [ ! -f "index.mjs" ]; then
    echo "Error: index.mjs not found!"
    exit 1
fi

# Check for CLOUDFLARE_API_TOKEN
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "Warning: CLOUDFLARE_API_TOKEN environment variable not set"
    echo "If deployment fails, set it with:"
    echo "  export CLOUDFLARE_API_TOKEN='your-token-here'"
    echo ""
fi

# Check if package.json exists and install dependencies
if [ -f "package.json" ]; then
    echo "→ Installing dependencies..."
    npm ci
    if [ $? -eq 0 ]; then
        echo "  ✓ Dependencies installed"
    else
        echo "  ✗ Failed to install dependencies"
        exit 1
    fi
    echo ""
fi

# Validate JavaScript syntax
echo "→ Validating JavaScript syntax..."
node --check index.mjs
if [ $? -eq 0 ]; then
    echo "  ✓ Syntax is valid"
else
    echo "  ✗ Syntax error found"
    exit 1
fi

echo ""
echo "→ Deploying worker..."
npx wrangler@4 deploy

if [ $? -ne 0 ]; then
    echo ""
    echo "✗ Deployment failed!"
    echo ""
    echo "Common issues:"
    echo "  - CLOUDFLARE_API_TOKEN not set or invalid"
    echo "  - Insufficient permissions on the API token"
    echo "  - Network connectivity issues"
    echo ""
    exit 1
fi

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "→ Testing deployment..."
echo ""

# Test health check endpoint
echo "Testing health check..."
RESPONSE=$(curl -s https://authentiqc-worker.adwate.workers.dev/)
VERSION=$(echo "$RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

if [ -n "$VERSION" ]; then
    echo "  ✓ Worker is responding"
    echo "  ✓ Version: $VERSION"
    
    if [ "$VERSION" = "1.2.0" ]; then
        echo "  ✓ Version is correct (1.2.0)"
    else
        echo "  ⚠ Version mismatch! Expected 1.2.0, got $VERSION"
        echo "    This may indicate caching or old deployment"
    fi
else
    echo "  ✗ Worker is not responding correctly"
    echo "  Response: $RESPONSE"
fi

echo ""
echo "Testing CORS headers..."
CORS_HEADER=$(curl -s -I https://authentiqc-worker.adwate.workers.dev/ | grep -i "access-control-allow-origin")

if [ -n "$CORS_HEADER" ]; then
    echo "  ✓ CORS headers present: $CORS_HEADER"
else
    echo "  ✗ CORS headers missing!"
fi

echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo ""
echo "1. Test in browser console:"
echo "   fetch('https://authentiqc-worker.adwate.workers.dev/')"
echo "     .then(r => r.json())"
echo "     .then(console.log)"
echo ""
echo "2. Test fetch-metadata endpoint:"
echo "   curl 'https://authentiqc-worker.adwate.workers.dev/fetch-metadata?url=https://example.com'"
echo ""
echo "3. Test in the app:"
echo "   - Go to https://qcv2.pages.dev"
echo "   - Try to identify a product from URL"
echo "   - Check browser console for errors"
echo ""
echo "4. View logs:"
echo "   - Cloudflare Dashboard → Workers → authentiqc-worker → Logs"
echo "   - Or run: npx wrangler@4 tail"
echo ""
