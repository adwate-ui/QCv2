# Shared Types and Utilities

This package contains shared TypeScript types and utility functions that are used across both the Cloudflare Pages frontend and Cloudflare Workers.

## Purpose

By centralizing shared code in `packages/shared/`, we:
- **Avoid duplication**: Write type definitions once, use them everywhere
- **Maintain consistency**: Ensure frontend and workers use the same data structures
- **Simplify refactoring**: Changes to shared types propagate automatically
- **Enable type safety**: TypeScript can verify cross-boundary contracts

## Structure

```
packages/shared/
├── README.md          # This file
├── types.ts           # Shared TypeScript type definitions
├── utils.ts           # Shared utility functions (optional)
└── tsconfig.json      # TypeScript configuration for shared code
```

## Usage

### In Pages (Frontend)

```typescript
// Import shared types
import type { ImageProxyResponse, MetadataResponse } from '@shared/types';

// Use in your code
const response: ImageProxyResponse = await fetch(...);
```

### In Workers

```typescript
// Import shared types
import type { ImageProxyResponse, MetadataResponse } from '../packages/shared/types';

// Use to ensure response structure matches frontend expectations
export default {
  async fetch(request: Request): Promise<Response> {
    const response: ImageProxyResponse = {
      images: [...],
      // TypeScript will ensure this matches the type
    };
    return new Response(JSON.stringify(response));
  }
};
```

## Type Definitions

### Core Types

The `types.ts` file includes:
- **Request/Response types** for worker endpoints
- **Image metadata types** for product images
- **Error response types** for consistent error handling
- **Configuration types** shared between frontend and backend

## Best Practices

1. **Add types here when**:
   - The type is used by both frontend and workers
   - The type defines a contract between frontend and backend
   - The type represents shared domain knowledge

2. **Don't add types here when**:
   - The type is specific to UI components (put in frontend)
   - The type is specific to worker internals (put in workers)
   - The type is third-party (import from npm)

3. **Naming conventions**:
   - Use PascalCase for type names
   - Suffix request types with `Request`
   - Suffix response types with `Response`
   - Be descriptive but concise

## Building and Type Checking

The shared package is type-checked independently:

```bash
# Type-check all projects including shared
npm run typecheck

# Type-check only shared package
cd packages/shared && npx tsc --noEmit
```

## Adding New Shared Code

1. Add your type or utility to the appropriate file
2. Export it properly
3. Run `npm run typecheck` to ensure no errors
4. Import in your pages or workers code
5. Build and test

## Migration Notes

When migrating existing code:
- Move shared types from root `types.ts` to `packages/shared/types.ts`
- Update import paths in all consuming code
- Ensure both pages and workers can import successfully
