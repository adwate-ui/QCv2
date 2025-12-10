#!/bin/bash
# Validate wrangler configurations to prevent name conflicts
# This script ensures that if a root wrangler config exists, it doesn't conflict
# with the cloudflare-worker/wrangler.toml configuration

set -e

echo "Validating wrangler configurations..."

# Extract name from root wrangler.toml (supports both quoted and unquoted values)
ROOT_NAME=""
if [ -f "wrangler.toml" ]; then
  # Handle both quoted and unquoted TOML values
  ROOT_NAME=$(grep '^name[[:space:]]*=' wrangler.toml | sed 's/^name[[:space:]]*=[[:space:]]*[\"]*\([^\"]*\)[\"]*$/\1/' | tr -d ' ' || echo "")
  
  if [ -n "$ROOT_NAME" ]; then
    echo "✓ Found root wrangler.toml with name: $ROOT_NAME"
  else
    echo "⚠ Warning: Could not extract name from wrangler.toml"
  fi
elif [ -f "wrangler.jsonc" ]; then
  # Use grep/sed to handle JSONC (JSON with comments)
  ROOT_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' wrangler.jsonc | sed 's/"name"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/' || echo "")
  
  if [ -n "$ROOT_NAME" ]; then
    echo "✓ Found root wrangler.jsonc with name: $ROOT_NAME"
  else
    echo "⚠ Warning: Could not extract name from wrangler.jsonc"
  fi
else
  echo "ℹ No root wrangler config found"
fi

# Extract name from cloudflare-worker/wrangler.toml (supports both quoted and unquoted values)
WORKER_NAME=""
if [ -f "cloudflare-worker/wrangler.toml" ]; then
  # Handle both quoted and unquoted TOML values
  WORKER_NAME=$(grep '^name[[:space:]]*=' cloudflare-worker/wrangler.toml | sed 's/^name[[:space:]]*=[[:space:]]*[\"]*\([^\"]*\)[\"]*$/\1/' | tr -d ' ' || echo "")
  
  if [ -n "$WORKER_NAME" ]; then
    echo "✓ Found worker wrangler.toml with name: $WORKER_NAME"
  else
    echo "⚠ Warning: Could not extract name from wrangler.toml"
  fi
fi

# Validate names are different
if [ -n "$ROOT_NAME" ] && [ -n "$WORKER_NAME" ]; then
  if [ "$ROOT_NAME" = "$WORKER_NAME" ]; then
    echo ""
    echo "❌ ERROR: Name conflict detected!"
    echo ""
    echo "Root wrangler config and worker wrangler.toml have the same name: '$ROOT_NAME'"
    echo "This causes the Pages deployment to overwrite the worker deployment."
    echo ""
    echo "Fix:"
    echo "  - Root wrangler config should use name: 'qcv2' (Pages project name)"
    echo "  - Worker wrangler.toml should use name: 'authentiqc-worker'"
    echo ""
    echo "Current values:"
    echo "  Root config:             name = '$ROOT_NAME'"
    echo "  Worker (wrangler.toml):  name = '$WORKER_NAME'"
    echo ""
    exit 1
  else
    echo "✓ Names are different - no conflict"
    echo "  Root config:             $ROOT_NAME"
    echo "  Worker (wrangler.toml):  $WORKER_NAME"
  fi
fi

# Validate root wrangler config name matches Pages project name (only if it exists)
if [ -n "$ROOT_NAME" ]; then
  EXPECTED_PAGES_NAME="qcv2"
  if [ "$ROOT_NAME" != "$EXPECTED_PAGES_NAME" ]; then
    echo ""
    echo "⚠ WARNING: Root wrangler config name does not match Pages project name"
    echo "  Expected: $EXPECTED_PAGES_NAME"
    echo "  Actual:   $ROOT_NAME"
    echo ""
    echo "This may cause deployment issues with Cloudflare Pages."
    echo ""
  fi
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
