/** Client entry: React 18 root, router, global toast host. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.tsx";
import "./App.css";

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
