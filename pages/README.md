# AuthentiqC - Frontend Application

This directory contains the complete frontend application built with React, TypeScript, and Vite.

## Project Structure

```
/pages
├── public/           # Static assets (logos, manifests, samples)
├── src/
│   ├── components/   # Reusable React components
│   ├── context/      # React context providers
│   ├── services/     # Frontend services (API, database, etc.)
│   ├── pages/        # Page components
│   ├── App.tsx       # Main application component
│   └── main.tsx      # Application entry point
├── index.html        # HTML template
├── vite.config.ts    # Vite configuration
├── tsconfig.json     # TypeScript configuration
├── package.json      # Dependencies and scripts
└── types.ts          # TypeScript type definitions
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

## Environment Variables

Create a `.env.local` file with:

```
GEMINI_API_KEY=your_gemini_api_key
VITE_IMAGE_PROXY_URL=https://your-worker.workers.dev
VITE_SUPABASE_URL=your_supabase_url (optional)
VITE_SUPABASE_ANON_KEY=your_supabase_key (optional)
```

## Deployment

This application is designed to be deployed to **Cloudflare Pages**.

### Build Configuration
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `pages`

### Environment Variables in Cloudflare
Set the following in Cloudflare Pages settings:
- `GEMINI_API_KEY`
- `VITE_IMAGE_PROXY_URL`

See the main repository README for detailed deployment instructions.
