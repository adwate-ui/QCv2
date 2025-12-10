#!/bin/bash

# Worker Verification Script
# Run this after the PR is merged to verify the worker is deployed correctly

set -e

WORKER_URL="https://authentiqc-worker.adwate.workers.dev"
EXPECTED_VERSION="1.4.0"

echo "============================================"
echo "Worker Deployment Verification"
echo "============================================"
echo ""

# Test 1: Health Check
echo "→ Test 1: Health Check"
RESPONSE=$(curl -s "$WORKER_URL/")
VERSION=$(echo "$RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

if [ -z "$VERSION" ]; then
    echo "  ❌ FAILED: Worker not responding with JSON"
    echo "  Response: $RESPONSE"
    exit 1
fi

if [ "$VERSION" = "$EXPECTED_VERSION" ]; then
    echo "  ✅ PASSED: Worker version $VERSION"
else
    echo "  ⚠️  WARNING: Expected version $EXPECTED_VERSION, got $VERSION"
fi

# Test 2: CORS Headers
echo ""
echo "→ Test 2: CORS Headers"
CORS_HEADER=$(curl -s -I "$WORKER_URL/" | grep -i "access-control-allow-origin")

if [ -z "$CORS_HEADER" ]; then
    echo "  ❌ FAILED: CORS headers missing"
    exit 1
else
    echo "  ✅ PASSED: $CORS_HEADER"
fi

# Test 3: Content Type
echo ""
echo "→ Test 3: Content Type"
CONTENT_TYPE=$(curl -s -I "$WORKER_URL/" | grep -i "content-type")

if echo "$CONTENT_TYPE" | grep -q "application/json"; then
    echo "  ✅ PASSED: Returns JSON"
elif echo "$CONTENT_TYPE" | grep -q "text/html"; then
    echo "  ❌ FAILED: Returns HTML (worker not deployed correctly)"
    exit 1
else
    echo "  ⚠️  WARNING: Unexpected content type: $CONTENT_TYPE"
fi

# Test 4: fetch-metadata Endpoint
echo ""
echo "→ Test 4: fetch-metadata Endpoint"
METADATA_RESPONSE=$(curl -s "$WORKER_URL/fetch-metadata?url=https://example.com")

if echo "$METADATA_RESPONSE" | grep -q "images"; then
    echo "  ✅ PASSED: fetch-metadata endpoint working"
else
    echo "  ❌ FAILED: fetch-metadata endpoint not working"
    echo "  Response: $METADATA_RESPONSE"
    exit 1
fi

# Test 5: Worker Name (via logs or response)
echo ""
echo "→ Test 5: Worker Name"
WORKER_NAME=$(echo "$RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if echo "$WORKER_NAME" | grep -q "AuthentiqC"; then
    echo "  ✅ PASSED: Worker name correct"
else
    echo "  ⚠️  WARNING: Unexpected worker name: $WORKER_NAME"
fi

echo ""
echo "============================================"
echo "✅ All Tests Passed!"
echo "============================================"
echo ""
echo "Worker is deployed and accessible at:"
echo "  $WORKER_URL"
echo ""
echo "Next steps:"
echo "  1. Test in the application:"
echo "     - Go to https://qcv2.pages.dev"
echo "     - Try product identification from URL"
echo "     - Check browser console for errors"
echo ""
echo "  2. View logs in Cloudflare Dashboard:"
echo "     - Go to: https://dash.cloudflare.com"
echo "     - Workers & Pages → authentiqc-worker → Logs"
echo ""
echo "  3. Monitor for issues:"
echo "     - Watch GitHub Actions for deployment success"
echo "     - Check application functionality"
echo ""
