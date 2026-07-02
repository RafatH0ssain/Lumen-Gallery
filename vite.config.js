import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In local dev, /api requests are proxied to `wrangler pages dev` (port 8788)
// so the Cloudflare Functions run alongside Vite HMR. In production, the
// frontend and functions share an origin, so all API calls are relative paths.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
});
