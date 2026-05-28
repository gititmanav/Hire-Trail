/** Client entry: React 18 root, router, global toast host. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import { installGlobalBugReporters } from "./utils/bugReporter.ts";
import "./App.css";

// Capture window-level errors and unhandled promise rejections into the admin
// panel. Complements Sentry (external observability) with in-app visibility so
// the maintainer can triage from /admin/bugs without leaving HireTrail.
installGlobalBugReporters();

// Sentry — empty DSN disables sending; init still runs so we don't have to
// branch the import path. Audit P0 #5: hear about silent UI errors before users do.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || import.meta.env.MODE,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        gutter={10}
        toastOptions={{
          duration: 3500,
          // Theme-aware base styling: pulls from the CSS variables so a theme
          // change (light/dark/custom) flows through automatically.
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "13.5px",
            fontWeight: 500,
            boxShadow: "0 10px 32px -8px hsla(var(--foreground) / 0.18), 0 2px 6px hsla(var(--foreground) / 0.08)",
            maxWidth: 420,
          },
          success: {
            iconTheme: { primary: "hsl(var(--success))", secondary: "white" },
            style: { borderLeft: "3px solid hsl(var(--success))" },
          },
          error: {
            iconTheme: { primary: "hsl(var(--danger))", secondary: "white" },
            style: { borderLeft: "3px solid hsl(var(--danger))" },
            duration: 5000,
          },
          loading: {
            iconTheme: { primary: "hsl(var(--primary))", secondary: "white" },
            style: { borderLeft: "3px solid hsl(var(--primary))" },
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>
);
