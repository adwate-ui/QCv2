#!/bin/bash
# Validate wrangler configurations to ensure proper separation
# This script enforces that:
# 1. If a root wrangler config exists, it MUST have a different name than the worker
# 2. Worker wrangler.toml exists in cloudflare-worker/ directory
# 3. The two deployments use different names to prevent conflicts

set -e

echo "Validating deployment configuration separation..."
echo ""

# Check for root wrangler configurations
ROOT_NAME=""
ROOT_CONFIG_FILE=""

if [ -f "wrangler.toml" ]; then
  ROOT_CONFIG_FILE="wrangler.toml"
  # Handle both quoted and unquoted TOML values
  ROOT_NAME=$(grep '^name[[:space:]]*=' wrangler.toml | sed 's/^name[[:space:]]*=[[:space:]]*[\"]*\([^\"]*\)[\"]*$/\1/' | tr -d ' ' || echo "")
  
  if [ -n "$ROOT_NAME" ]; then
    echo "✓ Found root wrangler.toml with name: $ROOT_NAME"
  else
    echo "⚠ Warning: Could not extract name from wrangler.toml"
  fi
elif [ -f "wrangler.jsonc" ]; then
  ROOT_CONFIG_FILE="wrangler.jsonc"
  # Use grep/sed to handle JSONC (JSON with comments)
  ROOT_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' wrangler.jsonc | sed 's/"name"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/' || echo "")
  
  if [ -n "$ROOT_NAME" ]; then
    echo "✓ Found root wrangler.jsonc with name: $ROOT_NAME"
  else
    echo "⚠ Warning: Could not extract name from wrangler.jsonc"
  fi
elif [ -f "wrangler.json" ]; then
  ROOT_CONFIG_FILE="wrangler.json"
  ROOT_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' wrangler.json | sed 's/"name"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/' || echo "")
  
  if [ -n "$ROOT_NAME" ]; then
    echo "✓ Found root wrangler.json with name: $ROOT_NAME"
  else
    echo "⚠ Warning: Could not extract name from wrangler.json"
  fi
else
  echo "ℹ No root wrangler config found (GitHub Actions will handle Pages deployment)"
fi


# Check for worker wrangler.toml (must exist)
echo ""
WORKER_NAME=""
EXPECTED_WORKER_NAME="authentiqc-worker"
EXPECTED_PAGES_NAME="qcv2"

if [ ! -f "cloudflare-worker/wrangler.toml" ]; then
  echo "❌ ERROR: Worker wrangler configuration missing!"
  echo ""
  echo "File expected: cloudflare-worker/wrangler.toml"
  echo ""
  echo "The worker deployment requires a wrangler.toml configuration."
  echo ""
  echo "FIX:"
  echo "  Ensure cloudflare-worker/wrangler.toml exists with:"
  echo "  name = \"$EXPECTED_WORKER_NAME\""
  echo ""
  exit 1
fi

# Extract worker name
WORKER_NAME=$(grep '^name[[:space:]]*=' cloudflare-worker/wrangler.toml | sed 's/^name[[:space:]]*=[[:space:]]*[\"]*\([^\"]*\)[\"]*$/\1/' | tr -d ' ' || echo "")

if [ -z "$WORKER_NAME" ]; then
  echo "❌ ERROR: Could not extract name from cloudflare-worker/wrangler.toml"
  exit 1
else
  echo "✓ Found worker wrangler.toml with name: $WORKER_NAME"
fi

# CRITICAL: Validate names are different to prevent conflicts
if [ -n "$ROOT_NAME" ] && [ -n "$WORKER_NAME" ]; then
  if [ "$ROOT_NAME" = "$WORKER_NAME" ]; then
    echo ""
    echo "❌❌❌ CRITICAL ERROR: NAME CONFLICT DETECTED! ❌❌❌"
    echo ""
    echo "Root wrangler config and worker wrangler.toml have the SAME name: '$ROOT_NAME'"
    echo ""
    echo "This causes one deployment to OVERWRITE the other!"
    echo ""
    echo "IMPACT:"
    echo "  • Both deployments try to use the same URL"
    echo "  • The last deployment overwrites the previous one"
    echo "  • Either Pages OR Worker will be broken (not both working)"
    echo "  • Worker may serve HTML instead of API responses"
    echo ""
    echo "FIX IMMEDIATELY:"
    echo "  1. Root config ($ROOT_CONFIG_FILE) must use:  name = \"$EXPECTED_PAGES_NAME\""
    echo "  2. Worker (cloudflare-worker/wrangler.toml) must use:  name = \"$EXPECTED_WORKER_NAME\""
    echo ""
    echo "Current values:"
    echo "  Root config:   name = \"$ROOT_NAME\"   ← MUST BE DIFFERENT"
    echo "  Worker config: name = \"$WORKER_NAME\" ← MUST BE DIFFERENT"
    echo ""
    exit 1
  else
    echo "✓ Names are different - no conflict"
    echo "  Root config:   $ROOT_NAME"
    echo "  Worker config: $WORKER_NAME"
  fi
fi

# Validate root config name matches Pages project (if it exists)
if [ -n "$ROOT_NAME" ]; then
  if [ "$ROOT_NAME" != "$EXPECTED_PAGES_NAME" ]; then
    echo ""
    echo "⚠ WARNING: Root wrangler config name does not match Pages project name"
    echo "  Expected: $EXPECTED_PAGES_NAME"
    echo "  Actual:   $ROOT_NAME"
    echo ""
    echo "This may cause deployment issues with Cloudflare Pages."
    echo "The Pages project expects name = \"$EXPECTED_PAGES_NAME\""
    echo ""
  fi
fi

# Validate worker name
if [ "$WORKER_NAME" != "$EXPECTED_WORKER_NAME" ]; then
  echo ""
  echo "⚠ WARNING: Worker name does not match expected value"
  echo "  Expected: $EXPECTED_WORKER_NAME"
  echo "  Actual:   $WORKER_NAME"
  echo ""
  echo "This may cause deployment issues or broken URLs."
  echo "The frontend expects the worker at: https://$EXPECTED_WORKER_NAME.adwate.workers.dev"
  echo ""
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✓✓✓ DEPLOYMENT SEPARATION VALIDATED ✓✓✓"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Deployment Architecture:"
if [ -n "$ROOT_NAME" ]; then
  echo "  • Pages ($ROOT_NAME):"
  echo "    - Primary: GitHub Actions → cloudflare/pages-action@v1"
  echo "    - Fallback: Dashboard deploy command → wrangler (uses $ROOT_CONFIG_FILE)"
else
  echo "  • Pages (qcv2):"
  echo "    - GitHub Actions ONLY → cloudflare/pages-action@v1"
fi
echo "  • Worker ($WORKER_NAME):"
echo "    - GitHub Actions ONLY → wrangler deploy (cloudflare-worker/)"
echo ""
echo "Path-based triggers ensure deployments are independent:"
echo "  • Pages workflow triggers on frontend code changes"
echo "  • Worker workflow triggers on cloudflare-worker/ changes"
echo "════════════════════════════════════════════════════════════════"
