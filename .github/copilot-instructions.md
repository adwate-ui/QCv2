# Copilot Instructions for QCv2 (AuthentiqC)

## Project Overview

**AuthentiqC** is a React-based Quality Control (QC) application that uses AI (Google Gemini) to identify products and perform quality control inspections by analyzing images. The application supports both product identification from URLs/images and detailed QC analysis comparing inspection images against reference images.

## Tech Stack

- **Frontend**: React 19.2+ with TypeScript
- **Build Tool**: Vite 6.2+
- **Routing**: React Router DOM 7.10+
- **AI/ML**: Google Gemini API (@google/genai)
- **Database**: Supabase (@supabase/supabase-js)
- **Image Processing**: pixelmatch, pngjs, jpeg-js
- **Icons**: lucide-react
- **Deployment**: Cloudflare Pages (frontend) + Cloudflare Workers (image proxy)

## Architecture

### Project Structure

```
/
├── .github/              # GitHub configs and workflows
├── components/           # Reusable UI components (Input, Layout, Toggle)
├── context/             # React context (AppContext)
├── pages/               # Page components (Auth, Inventory, ProductDetail, AddProduct, etc.)
├── services/            # Business logic and API services
│   ├── geminiService.ts     # Google Gemini AI integration
│   ├── supabase.ts          # Supabase database client
│   ├── db.ts                # In-memory database fallback
│   ├── smartQCService.ts    # QC analysis logic
│   ├── comparisonImageService.ts  # Image comparison
│   └── utils.ts             # Utility functions
├── worker/              # Image proxy worker for fetching external images
├── src/                 # Additional source files
├── types.ts             # TypeScript type definitions
├── App.tsx              # Main application component
└── package.json         # Dependencies and scripts
```

### Key Concepts

1. **Two-Mode Operation**:
   - **IDENTIFY**: Product identification from images/URLs using AI
   - **QC**: Quality control inspection comparing images against reference images

2. **Model Tiers**:
   - `FAST`: Uses Gemini Flash models for quick analysis
   - `DETAILED`: Uses Gemini Pro models for thorough analysis

3. **Expert Modes**:
   - `NORMAL`: Standard QC analysis
   - `EXPERT`: In-depth analysis with detailed observations

4. **Data Model**:
   - `Product`: Contains profile, reference images, QC batches, and reports
   - `QCBatch`: A set of inspection images at a timestamp
   - `QCReport`: Analysis results with sections, scores, and grades
   - `BackgroundTask`: Async task tracking for long-running operations

## TypeScript Configuration

- **Target**: ES2022
- **JSX**: react-jsx
- **Module**: ESNext with bundler resolution
- **Path Alias**: `@/*` resolves to root directory
- Uses experimental decorators

## Coding Conventions

### TypeScript/React Best Practices

1. **Use TypeScript strictly**: All components and services should have proper type definitions
2. **Functional Components**: Use functional components with hooks (no class components)
3. **Type Imports**: Import types from `types.ts` for consistency
4. **Context Pattern**: Use React Context (AppContext) for global state management
5. **Service Layer**: Keep business logic in `/services` separate from UI components
6. **Component Props**: Always define interface for component props

### Naming Conventions

- **Components**: PascalCase (e.g., `ProductDetailPage.tsx`, `Input.tsx`)
- **Services**: camelCase with Service suffix (e.g., `geminiService.ts`, `smartQCService.ts`)
- **Types/Interfaces**: PascalCase (e.g., `Product`, `QCReport`, `AppSettings`)
- **Enums**: PascalCase with UPPERCASE values (e.g., `ModelTier.FAST`, `ExpertMode.EXPERT`)
- **Functions**: camelCase (e.g., `generateQCReport`, `fetchProductImages`)

### File Organization

- Place reusable UI components in `/components`
- Place page-level components in `/pages`
- Place business logic in `/services`
- Keep type definitions in `types.ts`
- Use absolute imports with `@/` prefix when possible

### Styling

- Use Tailwind CSS utility classes for styling
- Follow existing color scheme: slate for backgrounds, green for primary actions, blue for info, red for errors
- Use semantic color classes (e.g., `bg-green-100`, `text-slate-800`)
- Maintain consistent spacing and border radius (e.g., `rounded-lg`, `p-4`, `mb-6`)

## Environment Variables

The application requires the following environment variables:

1. **GEMINI_API_KEY**: Google Gemini API key for AI analysis (required)
   - Get from: https://aistudio.google.com/app/apikey
   - Set in `.env.local` for local dev
   - Set as GitHub secret for production deployment

2. **VITE_IMAGE_PROXY_URL**: Cloudflare Worker URL for fetching external images (optional but recommended)
   - Deploy worker from `/worker` directory
   - Format: `https://authentiqc-worker.your-subdomain.workers.dev`
   - App auto-normalizes URLs, so both base URL and with endpoints work

3. **Supabase Configuration** (optional, falls back to in-memory storage):
   - `VITE_SUPABASE_URL`: Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
   - Set via UI on first launch or in environment variables

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Set your GEMINI_API_KEY in .env.local

# Start development server
npm run dev
```

### Build

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

### Testing

- No formal test suite currently exists
- Manual testing via the UI is primary validation method
- When adding new features, test both FAST and DETAILED model tiers
- Test with and without Supabase configuration

## Deployment

### Cloudflare Worker (Image Proxy)

The image proxy worker is required for fetching images from external product URLs.

```bash
cd worker
npx wrangler@4 deploy index.mjs --name authentiqc-worker
```

### Cloudflare Pages (Frontend)

1. Build command: `npm run build`
2. Output directory: `dist`
3. Environment variables: Set `GEMINI_API_KEY` and `VITE_IMAGE_PROXY_URL` in Cloudflare Pages settings

See `CLOUDFLARE_DEPLOYMENT_GUIDE.md` for detailed deployment instructions.

## Key Services

### geminiService.ts

Handles all interactions with Google Gemini API:
- Product identification from images/URLs
- QC report generation
- Prompt construction for different model tiers and expert modes

### smartQCService.ts

Orchestrates QC analysis workflow:
- Generates detailed QC reports with multiple sections
- Calculates weighted scores across inspection areas
- Integrates with image comparison service

### comparisonImageService.ts

Performs visual image comparison:
- Uses pixelmatch for pixel-level comparison
- Generates diff images with highlighted differences
- Returns similarity scores and difference percentages

### supabase.ts

Database operations:
- Product CRUD operations
- QC batch and report storage
- Image storage and retrieval
- Falls back to in-memory storage if Supabase not configured

## Important Considerations

### Image Handling

- Images are stored as base64 data URLs
- Image fetching from URLs requires the Cloudflare Worker proxy
- Multi-stage fallback for image fetching (metadata → opengraph → direct fetch)
- Large images may cause performance issues; consider compression

### AI Model Selection

- FAST mode uses `gemini-2.0-flash-exp` for quick results
- DETAILED mode uses `gemini-1.5-pro` for comprehensive analysis
- Model selection affects cost, speed, and accuracy
- Users can switch between modes per operation

### Security

- API keys should never be committed to the repository
- Use `.env.local` for local development (gitignored)
- Use GitHub Secrets or Cloudflare environment variables for production
- Supabase Row Level Security (RLS) should be configured for production use

### Performance

- Large batches of QC images may take significant time to analyze
- Background task system tracks long-running operations
- Consider implementing timeouts for AI API calls
- Image comparison can be CPU-intensive for large images

## Common Tasks

### Adding a New Page

1. Create component in `/pages/YourPage.tsx`
2. Define route in `App.tsx`
3. Add navigation link in `Layout.tsx` if needed
4. Update types in `types.ts` if new data structures are needed

### Adding a New Service

1. Create service file in `/services/yourService.ts`
2. Export functions following existing patterns
3. Use TypeScript for all function signatures
4. Handle errors gracefully with try-catch
5. Import and use in components via context or direct import

### Modifying AI Prompts

1. Edit prompt construction in `geminiService.ts`
2. Test with both FAST and DETAILED model tiers
3. Test with both NORMAL and EXPERT modes
4. Consider token limits and response size

### Updating Types

1. Modify `types.ts` with new interfaces or enums
2. Update all files that use those types
3. Check `services/db.ts` for in-memory storage impacts
4. Check `services/supabase.ts` for database schema impacts

## Troubleshooting

- **Images not loading from URLs**: Check `VITE_IMAGE_PROXY_URL` is set and worker is deployed
- **AI not responding**: Verify `GEMINI_API_KEY` is valid and has quota
- **Database errors**: Check Supabase configuration or use in-memory fallback
- **Build failures**: Ensure all environment variables are set during build

See `TROUBLESHOOTING_WORKER_ERROR.md` and `IMAGE_FETCHING_GUIDE.md` for detailed troubleshooting.

## Additional Resources

- **ACTION_REQUIRED.md**: Post-clone setup checklist
- **CLOUDFLARE_DEPLOYMENT_GUIDE.md**: Complete deployment instructions
- **IMAGE_FETCHING_GUIDE.md**: Image fetching troubleshooting
- **VITE_IMAGE_PROXY_URL_SETUP.md**: Environment variable setup guide
- **TROUBLESHOOTING_WORKER_ERROR.md**: Common worker issues and fixes
