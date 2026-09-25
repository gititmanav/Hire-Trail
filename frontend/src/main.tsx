/** Client entry: React 18 root, router, global toast host. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient.ts";
import App from "./App.tsx";
import { installGlobalBugReporters } from "./utils/bugReporter.ts";
import "./App.css";

// Capture window-level errors and unhandled promise rejections into the admin
// panel. Complements Sentry (external observability) with in-app visibility so
// the maintainer can triage from /admin/bugs without leaving HireTrail.
installGlobalBugReporters();

// A deploy replaces the hashed chunk files, so a tab opened before the deploy
// can fail to lazy-load a page ("Failed to fetch dynamically imported module").
// Reload once to pick up the new build; the sessionStorage guard prevents a
// reload loop if the chunk is genuinely gone.
window.addEventListener("vite:preloadError", (event) => {
  if (sessionStorage.getItem("chunk-reload") !== "1") {
    sessionStorage.setItem("chunk-reload", "1");
    event.preventDefault();
    window.location.reload();
  }
});
window.addEventListener("load", () => sessionStorage.removeItem("chunk-reload"));

// Sentry — only when a DSN is configured, and loaded as its own chunk so the
// first paint never waits for it (window errors are also captured by the
// in-app bug reporters above). Audit P0 #5: hear about silent UI errors
// before users do.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || import.meta.env.MODE,
      tracesSampleRate: 0.05,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }).catch(() => { /* reporting is best-effort */ });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
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
