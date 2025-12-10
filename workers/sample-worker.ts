/**
 * Sample Cloudflare Worker
 * 
 * This is a simple example worker that demonstrates:
 * - Basic request handling
 * - CORS headers
 * - JSON responses
 * - Using shared types
 * 
 * Deploy this worker with:
 *   npm run build:workers
 *   wrangler deploy dist/workers/sample-worker.js
 */

import type { WorkerHealthResponse } from '../packages/shared/types';

/**
 * Handle incoming requests
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Root endpoint - health check
  if (pathname === '' || pathname === '/') {
    const health: WorkerHealthResponse = {
      name: 'Sample Worker',
      version: '1.0.0',
      status: 'ok',
      endpoints: [
        {
          path: '/',
          method: 'GET',
          description: 'Health check endpoint',
        },
        {
          path: '/hello',
          method: 'GET',
          description: 'Returns a greeting message',
        },
        {
          path: '/echo',
          method: 'POST',
          description: 'Echoes back the request body',
        },
      ],
    };

    return new Response(JSON.stringify(health, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  // Hello endpoint
  if (pathname === '/hello') {
    const name = url.searchParams.get('name') || 'World';
    
    return new Response(
      JSON.stringify({
        message: `Hello, ${name}!`,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Echo endpoint
  if (pathname === '/echo' && request.method === 'POST') {
    try {
      const body = await request.json();
      
      return new Response(
        JSON.stringify({
          echo: body,
          receivedAt: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON',
          message: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  // 404 for unknown endpoints
  return new Response(
    JSON.stringify({
      error: 'Not Found',
      message: `The path '${pathname}' does not exist`,
    }),
    {
      status: 404,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Worker entry point
 */
export default {
  async fetch(request: Request, _env: unknown, _ctx: unknown): Promise<Response> {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
};
