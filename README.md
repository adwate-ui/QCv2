# AuthentiqC - AI-Powered Quality Control & Product Authentication

Professional quality control and product authentication platform powered by AI. Identify products, perform detailed QC inspections, and ensure authenticity with advanced image analysis.

## Repository Structure

This repository is organized as a monorepo with complete separation between frontend and backend:

```
/
├── pages/              # Frontend application (Cloudflare Pages)
│   ├── src/           # React application source code
│   ├── public/        # Static assets
│   ├── index.html     # HTML entry point
│   ├── vite.config.ts # Vite configuration
│   ├── package.json   # Frontend dependencies
│   └── README.md      # Frontend documentation
│
├── workers/           # Backend workers (Cloudflare Workers)
│   ├── image-proxy/   # Image proxy worker
│   │   ├── index.mjs
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── README.md      # Workers documentation
│
├── .github/           # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml            # Build and type check
│       ├── deploy-pages.yml  # Deploy frontend
│       └── deploy-workers.yml # Deploy workers
│
├── package.json       # Root package.json (workspace management)
└── README.md          # This file
```

## Quick Start

### Prerequisites
- Node.js 20 or higher
- npm (comes with Node.js)

### Installation

```bash
# Install all dependencies (root + workspaces)
npm install

# Or install individually
cd pages && npm install
cd workers/image-proxy && npm install
```

### Development

```bash
# Start frontend development server
npm run dev
# Or: cd pages && npm run dev

# Frontend runs at http://localhost:3000
```

### Building

```bash
# Build everything
npm run build

# Build only pages
npm run build:pages
# Or: cd pages && npm run build

# Workers don't need building (deployed as-is)
```

## Deployment

### Frontend (Cloudflare Pages)

**Root Directory:** `pages`
**Build Command:** `npm run build`
**Build Output:** `dist`

**Environment Variables:**
- `GEMINI_API_KEY` - Google Gemini API key
- `VITE_IMAGE_PROXY_URL` - URL to image proxy worker

**Deploy:**
```bash
cd pages
npm run build
npx wrangler pages deploy dist --project-name=qcv2
```

Or use GitHub Actions (automatically deploys on push to `main`).

### Workers (Cloudflare Workers)

**Image Proxy Worker:**

**Working Directory:** `workers/image-proxy`

**Deploy:**
```bash
cd workers/image-proxy
npx wrangler@4 deploy
```

Or use GitHub Actions (automatically deploys on push to `main`).

## Environment Variables

### Pages (.env.local in `/pages`)
```
GEMINI_API_KEY=your_gemini_api_key_here
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.your-subdomain.workers.dev
VITE_SUPABASE_URL=your_supabase_url (optional)
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key (optional)
```

### Workers
Workers use Cloudflare environment variables (set via wrangler or dashboard).

## Cloudflare Configuration

### Pages Project Settings
- **Project Name:** qcv2
- **Build Command:** `npm run build`
- **Build Output Directory:** `dist`
- **Root Directory:** `pages`
- **Environment Variables:** Set `GEMINI_API_KEY` and `VITE_IMAGE_PROXY_URL`

### Worker Settings
- **Worker Name:** authentiqc-worker
- **Worker Directory:** `workers/image-proxy`
- No build step required (deployed as-is)

## Project Structure Details

### Pages (Frontend)
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **Routing:** React Router DOM
- **AI:** Google Gemini API
- **Database:** Supabase (optional, fallback to in-memory)
- **Styling:** Tailwind CSS (CDN)

### Workers (Backend)
- **Platform:** Cloudflare Workers
- **Features:** Image proxy with CORS, retry logic, SSRF protection

## Development Scripts

### Root
```bash
npm run dev          # Start frontend dev server
npm run build        # Build everything
npm run build:pages  # Build only pages
npm run typecheck    # Type check pages
npm run lint         # Lint pages
npm run format       # Format all code
```

### Pages (in `/pages`)
```bash
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production build
npm run typecheck # TypeScript check
npm run lint      # ESLint
npm run format    # Prettier format
```

### Workers (in `/workers/image-proxy`)
```bash
npx wrangler@4 deploy  # Deploy worker
npx wrangler@4 dev     # Local development
```

## GitHub Actions Workflows

### CI Workflow (`ci.yml`)
Runs on every push and PR:
- Installs dependencies
- Type checks pages
- Builds pages
- Verifies build outputs and worker structure

### Pages Deployment (`deploy-pages.yml`)
Runs on push to `main` when pages files change:
- Builds frontend
- Deploys to Cloudflare Pages

### Workers Deployment (`deploy-workers.yml`)
Runs on push to `main` when worker files change:
- Deploys image proxy worker to Cloudflare Workers

## Contributing

1. Make changes in the appropriate directory (`pages/` or `workers/`)
2. Test locally
3. Commit and push
4. GitHub Actions will run CI checks
5. On merge to `main`, deployments happen automatically

## Documentation

- **Frontend:** See `/pages/README.md`
- **Workers:** See `/workers/README.md`
- **Deployment Guides:** Check documentation files in root

## Support

For issues, please create a GitHub issue in this repository.

## License

See LICENSE file for details.
