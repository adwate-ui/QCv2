#!/bin/bash
# Validate wrangler configurations to prevent name conflicts
# This script ensures that the root wrangler.jsonc and cloudflare-worker/wrangler.toml
# have different names to avoid deployment conflicts

set -e

echo "Validating wrangler configurations..."

# Extract name from root wrangler.jsonc
ROOT_NAME=""
if [ -f "wrangler.jsonc" ]; then
  ROOT_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' wrangler.jsonc | sed 's/"name"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
  echo "✓ Found root wrangler.jsonc with name: $ROOT_NAME"
fi

# Extract name from cloudflare-worker/wrangler.toml
WORKER_NAME=""
if [ -f "cloudflare-worker/wrangler.toml" ]; then
  WORKER_NAME=$(grep '^name[[:space:]]*=' cloudflare-worker/wrangler.toml | sed 's/name[[:space:]]*=[[:space:]]*"\([^"]*\)"/\1/')
  echo "✓ Found worker wrangler.toml with name: $WORKER_NAME"
fi

# Validate names are different
if [ -n "$ROOT_NAME" ] && [ -n "$WORKER_NAME" ]; then
  if [ "$ROOT_NAME" = "$WORKER_NAME" ]; then
    echo ""
    echo "❌ ERROR: Name conflict detected!"
    echo ""
    echo "Root wrangler.jsonc and worker wrangler.toml have the same name: '$ROOT_NAME'"
    echo "This causes the Pages deployment to overwrite the worker deployment."
    echo ""
    echo "Fix:"
    echo "  - Root wrangler.jsonc should use name: 'qcv2' (Pages project name)"
    echo "  - Worker wrangler.toml should use name: 'authentiqc-worker'"
    echo ""
    echo "Current values:"
    echo "  Root (wrangler.jsonc):   name = '$ROOT_NAME'"
    echo "  Worker (wrangler.toml):  name = '$WORKER_NAME'"
    echo ""
    exit 1
  else
    echo "✓ Names are different - no conflict"
    echo "  Root (wrangler.jsonc):   $ROOT_NAME"
    echo "  Worker (wrangler.toml):  $WORKER_NAME"
  fi
fi

# Validate root wrangler.jsonc name matches Pages project name
EXPECTED_PAGES_NAME="qcv2"
if [ -n "$ROOT_NAME" ] && [ "$ROOT_NAME" != "$EXPECTED_PAGES_NAME" ]; then
  echo ""
  echo "⚠ WARNING: Root wrangler.jsonc name does not match Pages project name"
  echo "  Expected: $EXPECTED_PAGES_NAME"
  echo "  Actual:   $ROOT_NAME"
  echo ""
  echo "This may cause deployment issues with Cloudflare Pages."
  echo ""
fi

# Validate worker name
EXPECTED_WORKER_NAME="authentiqc-worker"
if [ -n "$WORKER_NAME" ] && [ "$WORKER_NAME" != "$EXPECTED_WORKER_NAME" ]; then
  echo ""
  echo "⚠ WARNING: Worker name does not match expected value"
  echo "  Expected: $EXPECTED_WORKER_NAME"
  echo "  Actual:   $WORKER_NAME"
  echo ""
  echo "This may cause deployment issues with the worker."
  echo ""
fi

echo ""
echo "✓✓✓ Wrangler configuration validation passed ✓✓✓"
