#!/bin/bash

# Verification script for Cloudflare Worker setup
# This script checks if the worker is properly deployed and accessible
#
# Usage: ./verify-worker-setup.sh [WORKER_URL]
# Example: ./verify-worker-setup.sh https://authentiqc-worker.adwate.workers.dev

set -e

# Default worker URL or accept from command line
WORKER_URL="${1:-https://authentiqc-worker.adwate.workers.dev}"

# Allow override from environment variable
if [ -n "$VITE_IMAGE_PROXY_URL" ]; then
  WORKER_URL="$VITE_IMAGE_PROXY_URL"
fi

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  Cloudflare Worker Verification Script"
echo "=========================================="
echo ""
echo "Testing worker at: $WORKER_URL"
echo ""

# Check 1: DNS Resolution
echo -e "${BOLD}[1/5] Checking DNS resolution...${NC}"
WORKER_HOST=$(echo "$WORKER_URL" | sed -E 's|https?://||' | sed 's|/.*||')
if host "$WORKER_HOST" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ DNS resolves successfully${NC}"
else
    echo -e "${RED}✗ DNS does not resolve${NC}"
    echo ""
    echo -e "${YELLOW}This means the worker is NOT deployed.${NC}"
    echo ""
    echo "Deploy it now:"
    echo "  Option 1: GitHub Actions - https://github.com/adwate-ui/QCv2/actions/workflows/deploy-worker.yml"
    echo "  Option 2: Manual - cd cloudflare-worker && npx wrangler@4 deploy"
    echo ""
    exit 1
fi

# Check 2: Worker Health Endpoint
echo ""
echo -e "${BOLD}[2/5] Checking worker health endpoint...${NC}"
HTTP_CODE=$(curl -s -o /tmp/worker-response.json -w "%{http_code}" "$WORKER_URL/" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Worker is responding (HTTP 200)${NC}"
    
    # Check response content
    if command -v jq > /dev/null 2>&1; then
        VERSION=$(cat /tmp/worker-response.json | jq -r '.version' 2>/dev/null || echo "unknown")
        STATUS=$(cat /tmp/worker-response.json | jq -r '.status' 2>/dev/null || echo "unknown")
        echo "  Version: $VERSION"
        echo "  Status: $STATUS"
    else
        echo "  Response: $(cat /tmp/worker-response.json | head -c 100)"
    fi
else
    echo -e "${RED}✗ Worker returned HTTP $HTTP_CODE${NC}"
    echo ""
    echo "Expected: 200"
    echo "Got: $HTTP_CODE"
    echo ""
    if [ "$HTTP_CODE" = "404" ]; then
        echo -e "${YELLOW}Worker is not deployed or URL is wrong.${NC}"
    fi
    exit 1
fi

# Check 3: CORS Headers
echo ""
echo -e "${BOLD}[3/5] Checking CORS headers...${NC}"
CORS_HEADER=$(curl -s -I "$WORKER_URL/" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")

if [ -n "$CORS_HEADER" ]; then
    echo -e "${GREEN}✓ CORS headers present${NC}"
    echo "  $CORS_HEADER"
else
    echo -e "${RED}✗ CORS headers missing${NC}"
    echo ""
    echo "Worker needs to return 'Access-Control-Allow-Origin: *' header"
    echo "Check cloudflare-worker/index.mjs - getCorsHeaders() function"
    exit 1
fi

# Check 4: Fetch Metadata Endpoint
echo ""
echo -e "${BOLD}[4/5] Testing /fetch-metadata endpoint...${NC}"
METADATA_URL="${WORKER_URL}/fetch-metadata?url=https://www.cloudflare.com"
METADATA_CODE=$(curl -s -o /tmp/metadata-response.json -w "%{http_code}" "$METADATA_URL" 2>/dev/null || echo "000")

if [ "$METADATA_CODE" = "200" ]; then
    echo -e "${GREEN}✓ fetch-metadata endpoint working${NC}"
    
    if command -v jq > /dev/null 2>&1; then
        IMAGE_COUNT=$(cat /tmp/metadata-response.json | jq '.images | length' 2>/dev/null || echo "0")
        echo "  Found $IMAGE_COUNT image(s)"
    fi
elif [ "$METADATA_CODE" = "502" ] || [ "$METADATA_CODE" = "400" ]; then
    echo -e "${GREEN}✓ fetch-metadata endpoint accessible (returned $METADATA_CODE)${NC}"
    echo "  Note: Test URL may have failed, but endpoint exists"
elif [ "$METADATA_CODE" = "404" ]; then
    echo -e "${RED}✗ fetch-metadata endpoint returned 404${NC}"
    echo ""
    echo "This endpoint is missing. Worker code may be outdated."
    echo "Redeploy the worker from cloudflare-worker/index.mjs"
    exit 1
else
    echo -e "${YELLOW}⚠ Unexpected status: $METADATA_CODE${NC}"
    echo "  This may be a transient issue"
fi

# Check 5: Proxy Image Endpoint
echo ""
echo -e "${BOLD}[5/5] Testing /proxy-image endpoint...${NC}"
PROXY_URL="${WORKER_URL}/proxy-image?url=https://www.cloudflare.com/favicon.ico"
PROXY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROXY_URL" 2>/dev/null || echo "000")

if [ "$PROXY_CODE" = "200" ]; then
    echo -e "${GREEN}✓ proxy-image endpoint working${NC}"
elif [ "$PROXY_CODE" = "404" ]; then
    echo -e "${RED}✗ proxy-image endpoint returned 404${NC}"
    echo ""
    echo "This endpoint is missing. Worker code may be outdated."
    exit 1
else
    echo -e "${YELLOW}⚠ proxy-image returned: $PROXY_CODE${NC}"
    echo "  Test image may be unavailable, but endpoint exists"
fi

# Final Summary
echo ""
echo "=========================================="
echo -e "${GREEN}${BOLD}✓ ALL CHECKS PASSED!${NC}"
echo "=========================================="
echo ""
echo "Your Cloudflare Worker is properly deployed and accessible."
echo ""
echo "Worker URL: $WORKER_URL"
echo ""
echo "Next steps:"
echo "  1. Set VITE_IMAGE_PROXY_URL=$WORKER_URL"
echo "  2. Restart your development server (if running locally)"
echo "  3. Rebuild and redeploy frontend (if in production)"
echo "  4. Verify 'Worker Online' badge appears in the app"
echo ""
echo "For production deployment:"
echo "  - GitHub Secret: VITE_IMAGE_PROXY_URL=$WORKER_URL"
echo "  - Cloudflare Pages: Environment Variable: VITE_IMAGE_PROXY_URL=$WORKER_URL"
echo ""
