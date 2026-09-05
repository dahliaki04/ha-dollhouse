import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static demo site (mock hass + sample apartment) for Cloudflare Pages.
export default defineConfig({
  plugins: [react()],
  root: "dev",
  base: "./",
  build: { outDir: "../site-dist", emptyOutDir: true },
});
