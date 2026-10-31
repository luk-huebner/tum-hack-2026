import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API is the Pay-on-Proof service (cardano/, npm run service) on port 4022.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.SERVICE_URL ?? "http://127.0.0.1:4022", changeOrigin: true },
      "/health": { target: process.env.SERVICE_URL ?? "http://127.0.0.1:4022", changeOrigin: true },
    },
  },
});
