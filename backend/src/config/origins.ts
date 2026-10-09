import { env } from "./env.js";

/** The web app's origins — the only pages allowed to call the API with the
 *  signed-in person's cookie (CORS in server.ts, the same-site guard). */
export const ALLOWED_ORIGINS: readonly string[] = [
  env.CLIENT_URL,
  "https://hiretrail.manavkaneria.me",
  "http://localhost:5173",
];
