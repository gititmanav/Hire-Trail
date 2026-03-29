/**
 * Resolved at build time from `VITE_API_BASE_URL` (Vite exposes only `VITE_*` to the client).
 *
 * - **Local dev (default):** omit `VITE_API_BASE_URL` and use relative `/api`; `vite.config` proxies to `VITE_API_PROXY_TARGET`.
 * - **Split deploy (e.g. Vercel + API host):** set `VITE_API_BASE_URL` to the full API base **including** `/api`, e.g. `https://api.example.com/api`.
 */
export function getApiBaseURL(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/$/, "");
  }
  return "/api";
}

/** Start URL for Google OAuth (`/api/auth/google` on the API origin). */
export function getGoogleOAuthUrl(): string {
  const base = getApiBaseURL();
  return `${base}/auth/google`;
}
