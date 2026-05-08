import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5050";

  return {
    plugins: [react()],
    /** Pre-bundle calendar deps so Vite does not serve stale optimize chunks (504 Outdated Optimize Dep). */
    optimizeDeps: {
      include: [
        "react-big-calendar",
        "react-big-calendar/lib/addons/dragAndDrop",
        "date-fns",
        "date-fns/locale",
      ],
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
