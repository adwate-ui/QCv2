#!/bin/bash

# Test script for AuthentiqC Worker
# This script tests all endpoints of the deployed worker

set -e

WORKER_URL="${WORKER_URL:-https://authentiqc-worker.adwate.workers.dev}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Testing AuthentiqC Worker at: $WORKER_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Health check
echo "Test 1: Health check (GET /)"
echo "──────────────────────────────────────────────────────────"
RESPONSE=$(curl -s "$WORKER_URL/")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Extract version if JSON
VERSION=$(echo "$RESPONSE" | jq -r '.version' 2>/dev/null || echo "unknown")
STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")

if [ "$STATUS" = "ok" ]; then
  echo "✅ Health check passed (version: $VERSION)"
else
  echo "❌ Health check failed"
  exit 1
fi
echo ""

# Test 2: CORS headers
echo "Test 2: CORS headers"
echo "──────────────────────────────────────────────────────────"
HEADERS=$(curl -sI "$WORKER_URL/")
echo "$HEADERS" | grep -i "access-control-allow-origin" && echo "✅ CORS headers present" || echo "❌ CORS headers missing"
echo "$HEADERS" | grep -i "x-worker-version" && echo "✅ Version header present" || echo "⚠️  Version header missing"
echo ""

# Test 3: CORS preflight
echo "Test 3: CORS preflight (OPTIONS)"
echo "──────────────────────────────────────────────────────────"
OPTIONS_RESPONSE=$(curl -sI -X OPTIONS "$WORKER_URL/proxy-image")
echo "$OPTIONS_RESPONSE" | grep -i "access-control-allow-methods" && echo "✅ CORS preflight works" || echo "❌ CORS preflight failed"
echo ""

# Test 4: Fetch metadata endpoint
echo "Test 4: Fetch metadata endpoint"
echo "──────────────────────────────────────────────────────────"
TEST_URL="https://www.rolex.com"
METADATA_RESPONSE=$(curl -s "$WORKER_URL/fetch-metadata?url=$TEST_URL")
echo "$METADATA_RESPONSE" | jq '.' 2>/dev/null || echo "$METADATA_RESPONSE"

# Check if we got images
IMAGE_COUNT=$(echo "$METADATA_RESPONSE" | jq '.images | length' 2>/dev/null || echo "0")
if [ "$IMAGE_COUNT" -gt 0 ]; then
  echo "✅ Fetch metadata works (found $IMAGE_COUNT images)"
else
  echo "⚠️  Fetch metadata returned no images (might be expected)"
fi
echo ""

# Test 5: Proxy image endpoint
echo "Test 5: Proxy image endpoint"
echo "──────────────────────────────────────────────────────────"
TEST_IMAGE="https://via.placeholder.com/150"
PROXY_RESPONSE=$(curl -sI "$WORKER_URL/proxy-image?url=$TEST_IMAGE")
CONTENT_TYPE=$(echo "$PROXY_RESPONSE" | grep -i "content-type:" | cut -d' ' -f2 | tr -d '\r\n' | tr -d ' ')

# Check if content type starts with "image/"
if [[ "$CONTENT_TYPE" == image/* ]]; then
  echo "✅ Proxy image works (content-type: $CONTENT_TYPE)"
else
  echo "❌ Proxy image failed (got: $CONTENT_TYPE)"
  echo "$PROXY_RESPONSE"
fi
echo ""

# Test 6: Error handling (missing URL)
echo "Test 6: Error handling"
echo "──────────────────────────────────────────────────────────"
ERROR_RESPONSE=$(curl -s "$WORKER_URL/proxy-image")
echo "$ERROR_RESPONSE" | jq '.' 2>/dev/null || echo "$ERROR_RESPONSE"

ERROR=$(echo "$ERROR_RESPONSE" | jq -r '.error' 2>/dev/null || echo "")
if [ "$ERROR" = "missing url" ]; then
  echo "✅ Error handling works"
else
  echo "❌ Error handling unexpected"
fi
echo ""

# Test 7: 404 handling
echo "Test 7: 404 handling"
echo "──────────────────────────────────────────────────────────"
NOT_FOUND_RESPONSE=$(curl -s "$WORKER_URL/nonexistent")
echo "$NOT_FOUND_RESPONSE" | jq '.' 2>/dev/null || echo "$NOT_FOUND_RESPONSE"

# Check CORS headers on 404 responses
HAS_CORS=$(curl -sI "$WORKER_URL/nonexistent" | grep -i "access-control-allow-origin")
if [ -n "$HAS_CORS" ]; then
  echo "✅ 404 responses include CORS headers"
else
  echo "⚠️  404 responses might be missing CORS headers"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Worker tests complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
