# NPM Workspace Configuration

This repository uses **npm workspaces** to manage multiple packages in a single repository.

## Workspace Structure

```
/
├── package.json              # Root package.json (workspace manager)
├── package-lock.json         # Single lock file for all workspaces
│
├── pages/                    # Frontend workspace
│   ├── package.json
│   └── (no package-lock.json - uses root)
│
└── workers/image-proxy/      # Worker workspace
    ├── package.json
    └── (no package-lock.json - uses root)
```

## Key Points

### Single Lock File
- **One `package-lock.json` at root** for all workspaces
- Workspace directories do **NOT** have their own lock files
- This ensures consistent dependency versions across all packages

### Dependency Installation

**From Root (Recommended):**
```bash
npm install        # Installs all workspace dependencies
npm ci             # Clean install from lock file
```

**From Workspace Directory:**
```bash
cd pages
npm install        # Still uses root package-lock.json
```

### Why Workspaces?

1. **Single Lock File**: All packages use the same dependency versions
2. **Shared Dependencies**: Common dependencies are hoisted to root
3. **Cross-Workspace Links**: Workspaces can depend on each other
4. **Unified Scripts**: Run commands across all workspaces from root

## GitHub Actions Configuration

### ⚠️ Critical: Cache Configuration

Both deployment workflows MUST use the **root package-lock.json** for caching:

**✅ Correct:**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    cache: 'npm'
    cache-dependency-path: package-lock.json  # Root lock file
```

**❌ Incorrect:**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    cache: 'npm'
    cache-dependency-path: pages/package-lock.json  # Doesn't exist!
```

### Dependency Installation in Workflows

**✅ Correct:**
```yaml
- name: Install Dependencies
  run: npm ci  # Runs from root, installs all workspaces
```

**❌ Incorrect:**
```yaml
- name: Install Dependencies
  working-directory: pages
  run: npm ci  # Wrong! Lock file is at root
```

### Building Workspaces in Workflows

Use the root workspace scripts:

```yaml
- name: Build Pages
  run: npm run build:pages  # Uses workspace script from root

- name: Deploy Worker
  working-directory: workers/image-proxy
  run: npx wrangler@4 deploy  # Worker deployment from workspace dir
```

## Workspace Scripts (Root package.json)

```json
{
  "scripts": {
    "dev": "npm run dev --workspace=pages",
    "build": "npm run build:pages && npm run build:workers",
    "build:pages": "npm run build --workspace=pages",
    "build:workers": "echo 'Workers are deployed directly using wrangler'"
  },
  "workspaces": [
    "pages",
    "workers/image-proxy"
  ]
}
```

## Common Issues

### Issue: "Cannot find package-lock.json"

**Problem:** Workflow tries to cache using workspace-specific lock file
```yaml
cache-dependency-path: pages/package-lock.json  # ❌ Doesn't exist
```

**Solution:** Use root lock file
```yaml
cache-dependency-path: package-lock.json  # ✅ Exists at root
```

### Issue: Dependencies not found during build

**Problem:** Installing from workspace directory without understanding workspace setup
```bash
cd pages
npm ci  # May work but uses root lock file anyway
```

**Solution:** Install from root
```bash
npm ci  # Installs all workspace dependencies
```

### Issue: Workflow fails on npm ci

**Problem:** Lock file referenced in workflow doesn't exist

**Solution:** 
1. Verify `package-lock.json` exists at repository root
2. Update workflow `cache-dependency-path` to `package-lock.json`
3. Ensure install step runs from root directory

## Deployment Workflows

### Pages Deployment (.github/workflows/deploy-pages.yml)

```yaml
- name: Setup Node.js
  with:
    cache-dependency-path: package-lock.json  # Root lock file

- name: Install Dependencies
  run: npm ci  # From root

- name: Build Pages
  run: npm run build:pages  # Root workspace script
```

### Workers Deployment (.github/workflows/deploy-workers.yml)

```yaml
- name: Setup Node.js
  with:
    cache-dependency-path: package-lock.json  # Root lock file

- name: Install Dependencies
  run: npm ci  # From root

- name: Deploy Worker
  working-directory: workers/image-proxy
  run: npx wrangler@4 deploy  # Deploy from workspace dir
```

## Benefits

1. **Consistent Dependencies**: All packages use the same versions
2. **Faster Installs**: Shared dependencies are hoisted to root
3. **Easier Maintenance**: One lock file to update, not three
4. **Better CI/CD**: Single cache for all dependencies
5. **Monorepo Best Practice**: Industry standard for multi-package repos

## Migration Notes

If you had individual lock files before:
1. Delete workspace lock files: `pages/package-lock.json`, `workers/*/package-lock.json`
2. Ensure root `package-lock.json` exists
3. Update workflows to use root lock file
4. Run `npm install` from root to regenerate lock file if needed

## References

- [npm workspaces documentation](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [GitHub Actions npm caching](https://github.com/actions/setup-node#caching-global-packages-data)
