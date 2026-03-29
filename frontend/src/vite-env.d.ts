/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full API base path including `/api`, e.g. `https://your-api.onrender.com/api`. Omit for local dev + Vite proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
