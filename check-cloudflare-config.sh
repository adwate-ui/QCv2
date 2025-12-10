#!/bin/bash

# ============================================================================
# Cloudflare Deployment Configuration Checker
# ============================================================================
# This script helps verify that your Cloudflare configuration is correct
# and can help diagnose the "Missing entry-point" deployment error.
#
# Usage: ./check-cloudflare-config.sh
# ============================================================================

set -e

echo "============================================================================"
echo "Cloudflare Deployment Configuration Checker"
echo "============================================================================"
echo ""

EXIT_CODE=0

# ============================================================================
# Check 1: No wrangler config at root
# ============================================================================

echo "─────────────────────────────────────────────────────────────────"
echo "Check 1: Root directory should NOT have wrangler configuration"
echo "─────────────────────────────────────────────────────────────────"

if [ -f "wrangler.toml" ]; then
    echo "❌ ERROR: wrangler.toml found in root directory"
    echo "   Location: $(pwd)/wrangler.toml"
    echo "   This file should NOT exist at the root"
    echo "   Pages deployment via GitHub Actions doesn't need it"
    echo ""
    echo "   ACTION: Delete this file"
    echo "   Command: rm wrangler.toml"
    echo ""
    EXIT_CODE=1
elif [ -f "wrangler.jsonc" ]; then
    echo "❌ ERROR: wrangler.jsonc found in root directory"
    echo "   Location: $(pwd)/wrangler.jsonc"
    echo "   This file should NOT exist at the root"
    echo "   Pages deployment via GitHub Actions doesn't need it"
    echo ""
    echo "   ACTION: Delete this file"
    echo "   Command: rm wrangler.jsonc"
    echo ""
    EXIT_CODE=1
elif [ -f "wrangler.json" ]; then
    echo "❌ ERROR: wrangler.json found in root directory"
    echo "   Location: $(pwd)/wrangler.json"
    echo "   This file should NOT exist at the root"
    echo "   Pages deployment via GitHub Actions doesn't need it"
    echo ""
    echo "   ACTION: Delete this file"
    echo "   Command: rm wrangler.json"
    echo ""
    EXIT_CODE=1
else
    echo "✓ No wrangler config found at root (correct)"
fi

echo ""

# ============================================================================
# Check 2: Worker has proper configuration
# ============================================================================

echo "─────────────────────────────────────────────────────────────────"
echo "Check 2: Worker directory should have wrangler.toml"
echo "─────────────────────────────────────────────────────────────────"

if [ ! -f "worker/wrangler.toml" ]; then
    echo "❌ ERROR: worker/wrangler.toml not found"
    echo "   The worker MUST have a wrangler.toml configuration"
    echo ""
    echo "   ACTION: Check if worker directory exists"
    echo "   This is a critical file for worker deployment"
    echo ""
    EXIT_CODE=1
else
    echo "✓ Worker wrangler.toml exists"
    
    # Check worker name (flexible pattern to handle various formats)
    WORKER_NAME=$(grep '^name' worker/wrangler.toml | sed -e 's/^name[[:space:]]*=[[:space:]]*["\x27]\(.*\)["\x27].*$/\1/' -e 's/^name[[:space:]]*=[[:space:]]*\([^[:space:]]*\).*$/\1/')
    if [ "$WORKER_NAME" = "authentiqc-worker" ]; then
        echo "✓ Worker name is correct: $WORKER_NAME"
    elif [ -z "$WORKER_NAME" ]; then
        echo "⚠ Warning: Could not detect worker name in wrangler.toml"
        echo "   Expected: 'authentiqc-worker'"
    else
        echo "⚠ Warning: Worker name is '$WORKER_NAME'"
        echo "   Expected: 'authentiqc-worker'"
        echo "   This may cause deployment issues"
        EXIT_CODE=1
    fi
fi

echo ""

# ============================================================================
# Check 3: Safeguard marker exists
# ============================================================================

echo "─────────────────────────────────────────────────────────────────"
echo "Check 3: Safeguard marker file"
echo "─────────────────────────────────────────────────────────────────"

if [ -f ".wrangler-do-not-deploy" ]; then
    echo "✓ Safeguard marker exists (.wrangler-do-not-deploy)"
    echo "  This file warns against deploying workers from root"
else
    echo "⚠ Warning: .wrangler-do-not-deploy marker not found"
    echo "  This is a helpful safeguard to prevent misconfigurations"
fi

echo ""

# ============================================================================
# Check 4: GitHub Actions workflows
# ============================================================================

echo "─────────────────────────────────────────────────────────────────"
echo "Check 4: GitHub Actions workflows"
echo "─────────────────────────────────────────────────────────────────"

if [ ! -f ".github/workflows/deploy.yml" ]; then
    echo "❌ ERROR: .github/workflows/deploy.yml not found"
    echo "   Pages deployment workflow is missing"
    EXIT_CODE=1
else
    echo "✓ Pages deployment workflow exists"
fi

if [ ! -f ".github/workflows/deploy-worker.yml" ]; then
    echo "❌ ERROR: .github/workflows/deploy-worker.yml not found"
    echo "   Worker deployment workflow is missing"
    EXIT_CODE=1
else
    echo "✓ Worker deployment workflow exists"
fi

echo ""

# ============================================================================
# Check 5: Package.json scripts
# ============================================================================

echo "─────────────────────────────────────────────────────────────────"
echo "Check 5: Package.json build scripts"
echo "─────────────────────────────────────────────────────────────────"

# More flexible check for build script - allows for spacing variations
if grep -q '"build"' package.json && grep -q 'tsc.*vite build' package.json; then
    echo "✓ Build script configured correctly"
else
    echo "⚠ Warning: Build script may not be configured correctly"
    echo "  Expected: \"build\": \"tsc && vite build\" (or similar)"
fi

echo ""

# ============================================================================
# Check 6: Documentation files
# ============================================================================

echo "─────────────────────────────────────────────────────────────────"
echo "Check 6: Documentation files"
echo "─────────────────────────────────────────────────────────────────"

# Check for key documentation files (warnings only, not errors)
IMPORTANT_DOCS=(
    "CLOUDFLARE_PAGES_DEPLOY_COMMAND_FIX.md"
    "PAGES_DEPLOYMENT_FIX_README.md"
    "CLOUDFLARE_DEPLOYMENT_GUIDE.md"
    "URGENT_WORKER_BUILD_FIX.md"
)

DOC_COUNT=0
for DOC in "${IMPORTANT_DOCS[@]}"; do
    if [ -f "$DOC" ]; then
        echo "✓ $DOC exists"
        DOC_COUNT=$((DOC_COUNT + 1))
    fi
done

if [ $DOC_COUNT -eq 0 ]; then
    echo "⚠ Warning: No deployment documentation files found"
    echo "  Consider adding documentation for deployment troubleshooting"
fi

echo ""

# ============================================================================
# Summary and Recommendations
# ============================================================================

echo "============================================================================"
echo "SUMMARY AND RECOMMENDATIONS"
echo "============================================================================"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All critical checks passed!"
    echo ""
    echo "Your repository configuration looks correct."
    echo ""
    echo "If you're still seeing deployment errors, the issue is likely in the"
    echo "Cloudflare Pages dashboard configuration (not in the repository)."
    echo ""
    echo "Next steps:"
    echo "1. Check Cloudflare Dashboard → Workers & Pages → qcv2"
    echo "2. Go to Settings → Builds & deployments"
    echo "3. Verify 'Deploy command' field is EMPTY"
    echo "4. See: CLOUDFLARE_PAGES_DEPLOY_COMMAND_FIX.md for detailed instructions"
else
    echo "❌ Configuration issues found (see above)"
    echo ""
    echo "Please fix the issues identified above before deploying."
    echo ""
    echo "For help, see:"
    echo "- CLOUDFLARE_PAGES_DEPLOY_COMMAND_FIX.md"
    echo "- PAGES_DEPLOYMENT_FIX_README.md"
    echo "- CLOUDFLARE_DEPLOYMENT_GUIDE.md"
fi

echo ""
echo "============================================================================"
echo "CLOUDFLARE DASHBOARD CHECKLIST"
echo "============================================================================"
echo ""
echo "Manual verification required in Cloudflare Dashboard:"
echo ""
echo "[ ] Navigate to: Dashboard → Workers & Pages → qcv2"
echo "[ ] Go to: Settings → Builds & deployments"
echo "[ ] Verify settings:"
echo "    Build command:              npm run build"
echo "    Build output directory:     dist"
echo "    Deploy command:             [MUST BE EMPTY]"
echo "    Root directory:             / (or blank)"
echo ""
echo "[ ] If deploy command is set, DELETE IT and save"
echo "[ ] Retry deployment after saving"
echo ""
echo "This CANNOT be automated and MUST be done manually in the dashboard!"
echo ""
echo "============================================================================"

exit $EXIT_CODE
