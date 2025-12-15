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
- Supabase account (for database and authentication)
- Google Gemini API key (for AI features)

### Setup

#### 1. Install Dependencies

```bash
# Install all dependencies (root + workspaces)
npm install

# Or install individually
cd pages && npm install
cd workers/image-proxy && npm install
```

#### 2. Set Up Supabase (Required)

The app uses Supabase for authentication, database, and storage. Follow these steps:

1. Create a Supabase project at https://supabase.com
2. Run the SQL setup script (see **[SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md)** for detailed instructions):
   - Go to your Supabase SQL Editor
   - Copy and run the contents of `SUPABASE_SETUP.sql`
3. Create an "images" storage bucket (see guide for details)
4. Get your Supabase credentials from Project Settings → API
5. Configure environment variables (see below)

**📖 Full Supabase setup guide:** [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md)

#### 3. Get Gemini API Key

Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

You can either:
- Add it to your `.env.local` file (for development)
- Enter it when you first login to the app (stored in your profile)

### Development

#### 4. Configure Environment Variables

Create a `.env.local` file in the `pages` directory:

```bash
cd pages
touch .env.local
```

Add your configuration:

```env
# Supabase (Required - get from Supabase Dashboard → Settings → API)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Gemini API (Optional - can also be set when logging in)
GEMINI_API_KEY=your-gemini-api-key-here

# Image Proxy Worker (Optional - for fetching images from product URLs)
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.your-subdomain.workers.dev
```

#### 5. Start Development Server

```bash
# Start frontend development server
npm run dev
# Or: cd pages && npm run dev

# Frontend runs at http://localhost:5173
```

#### 6. Create an Account

1. Open http://localhost:5173
2. Click "Create Account"
3. Enter your email and password
4. (Optional) Add your Gemini API key during signup or later in your profile
5. Check your email for confirmation (if enabled in Supabase)
6. Start adding products and performing QC inspections!

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

**Required:**
```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Optional:**
```env
# Gemini API Key (can also be set at login time in the app)
GEMINI_API_KEY=your_gemini_api_key_here

# Image Proxy Worker (for fetching product images from URLs)
VITE_IMAGE_PROXY_URL=https://authentiqc-worker.your-subdomain.workers.dev
```

### Workers
Workers use Cloudflare environment variables (set via wrangler or dashboard).

## Cloudflare Configuration

### Pages Project Settings

When deploying to Cloudflare Pages:

- **Project Name:** qcv2
- **Framework Preset:** None (or Vite)
- **Build Command:** `npm run build`
- **Build Output Directory:** `pages/dist`
- **Root Directory:** Leave empty (build command handles it)
- **Node Version:** 20

**Required Environment Variables:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Optional Environment Variables:**
- `GEMINI_API_KEY` - Google Gemini API key (can be set by users at login)
- `VITE_IMAGE_PROXY_URL` - URL to your deployed image proxy worker

**⚠️ Important:** The build command in the root `package.json` is `npm run build`, which builds both pages and workers. Cloudflare Pages should run this command from the repository root.

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
- **Database:** Supabase (for authentication, storage, and data persistence)
- **Authentication:** Supabase Auth
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

- **Supabase Setup:** [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md) - Complete guide for setting up the database
- **SQL Schema:** [SUPABASE_SETUP.sql](./SUPABASE_SETUP.sql) - Database schema and policies
- **Frontend:** See `/pages/README.md`
- **Workers:** See `/workers/README.md`
- **Deployment Guides:** Check documentation files in root

## Features

- **Product Identification:** AI-powered product identification from images or URLs
- **Quality Control:** Comprehensive QC inspections with detailed reports
- **Image Analysis:** Compare inspection images against reference images
- **Multi-tier AI Models:** Choose between FAST (Gemini Flash) and DETAILED (Gemini Pro)
- **Expert Mode:** Get deeper, more detailed analysis
- **User Authentication:** Secure account management with Supabase
- **Cloud Storage:** Store images and data securely in Supabase
- **Account Management:** Users can manage API keys and delete their accounts
- **PDF Export:** Export QC reports as PDFs

## Support

For issues, please create a GitHub issue in this repository.

## License

See LICENSE file for details.
