#!/bin/bash
# Cloudflare Deployment Setup Script
# This script helps you verify your Cloudflare deployment configuration

set -e

echo "=========================================="
echo "AuthentiqC Cloudflare Deployment Checker"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in CI
if [ -n "$CI" ]; then
    echo "Running in CI environment, skipping interactive checks..."
    exit 0
fi

echo "This script will help you verify your Cloudflare deployment setup."
echo ""

# Check 1: GitHub Secrets
echo "📋 Step 1: Check GitHub Repository Secrets"
echo "----------------------------------------"
echo "Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
echo ""
echo "Required secrets:"
echo "  1. CF_API_TOKEN - Your Cloudflare API token"
echo "  2. CF_ACCOUNT_ID - Your Cloudflare account ID"
echo "  3. VITE_IMAGE_PROXY_URL - Your Cloudflare Worker URL"
echo ""
read -p "Have you set all three secrets? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Please set up GitHub secrets before continuing.${NC}"
    echo "See: CLOUDFLARE_DEPLOYMENT_GUIDE.md for instructions"
    exit 1
fi
echo -e "${GREEN}✓ GitHub secrets configured${NC}"
echo ""

# Check 2: Worker URL
echo "🔧 Step 2: Verify Cloudflare Worker"
echo "----------------------------------------"
read -p "Enter your Cloudflare Worker URL (e.g., https://authentiqc-worker.your-subdomain.workers.dev): " WORKER_URL

if [ -z "$WORKER_URL" ]; then
    echo -e "${RED}❌ Worker URL is required${NC}"
    exit 1
fi

# Validate URL format to prevent command injection
if ! [[ "$WORKER_URL" =~ ^https?:// ]]; then
    echo -e "${RED}❌ Invalid URL format. Must start with http:// or https://${NC}"
    exit 1
fi

echo "Testing worker endpoint..."
# Use -- to prevent curl from interpreting URL as options
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -- "${WORKER_URL}/fetch-metadata?url=https://example.com" || echo "000")

if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 400 ] || [ "$HTTP_STATUS" -eq 500 ]; then
    echo -e "${GREEN}✓ Worker is accessible and responding${NC}"
else
    echo -e "${RED}❌ Worker is not accessible (HTTP $HTTP_STATUS)${NC}"
    echo "Please verify:"
    echo "  - Worker is deployed to Cloudflare"
    echo "  - Worker URL is correct"
    echo "  - Worker has CORS enabled"
    exit 1
fi
echo ""

# Check 3: Verify VITE_IMAGE_PROXY_URL secret matches
echo "🔐 Step 3: Verify Environment Variable"
echo "----------------------------------------"
echo "Make sure your GitHub secret VITE_IMAGE_PROXY_URL is set to:"
echo "  ${WORKER_URL}"
echo ""
read -p "Does your GitHub secret match this URL? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Please update your GitHub secret VITE_IMAGE_PROXY_URL${NC}"
    echo "1. Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
    echo "2. Edit or create: VITE_IMAGE_PROXY_URL"
    echo "3. Set value to: ${WORKER_URL}"
    exit 1
fi
echo -e "${GREEN}✓ Environment variable configured${NC}"
echo ""

# Check 4: Cloudflare Pages Project
echo "🌐 Step 4: Verify Cloudflare Pages"
echo "----------------------------------------"
read -p "Enter your Cloudflare Pages URL (e.g., https://qcv2.pages.dev): " PAGES_URL

if [ -z "$PAGES_URL" ]; then
    echo -e "${YELLOW}⚠️  Cloudflare Pages URL not provided${NC}"
    echo "You can check it later in Cloudflare Dashboard → Workers & Pages"
else
    # Validate URL format
    if ! [[ "$PAGES_URL" =~ ^https?:// ]]; then
        echo -e "${RED}❌ Invalid URL format. Must start with http:// or https://${NC}"
        exit 1
    fi
    echo "Testing Cloudflare Pages..."
    # Use -- to prevent curl from interpreting URL as options
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -- "$PAGES_URL" || echo "000")
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        echo -e "${GREEN}✓ Cloudflare Pages is accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  Cloudflare Pages returned HTTP $HTTP_STATUS${NC}"
        echo "This might be normal if the page requires authentication"
    fi
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Setup Summary"
echo "=========================================="
echo ""
echo "Worker URL: ${WORKER_URL}"
if [ -n "$PAGES_URL" ]; then
    echo "Pages URL:  ${PAGES_URL}"
fi
echo ""
echo "Next steps:"
echo "1. Push a commit to trigger GitHub Actions deployment"
echo "2. Check deployment logs in GitHub Actions tab"
echo "3. Verify the app loads at your Cloudflare Pages URL"
echo "4. Test image fetching with a product URL"
echo ""
echo "📖 For detailed instructions, see:"
echo "   - CLOUDFLARE_DEPLOYMENT_GUIDE.md"
echo "   - IMAGE_FETCHING_GUIDE.md"
echo ""
echo -e "${GREEN}✓ Setup verification complete!${NC}"
