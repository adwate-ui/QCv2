/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMAGE_PROXY_URL?: string;
  readonly GEMINI_API_KEY?: string;
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
