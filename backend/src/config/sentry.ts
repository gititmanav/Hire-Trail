/**
 * Sentry initialization. Called as the very first thing in server.ts so the
 * SDK is on the stack before any of our other modules import (and side-effect).
 *
 * No DSN means Sentry is disabled — the init still runs but never sends events.
 * Audit P0 #5: capture unknown errors so we hear about them before users do.
 */
import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    // Conservative defaults for a solo-SaaS free tier — bumps the signal-to-noise on
    // the dashboard. Bump tracesSampleRate when you actually look at performance data.
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  });
}

export { Sentry };
