import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two shells share src/core: the HA panel bundle (lib build) and the dev harness (dev server).
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: { entry: "src/panel.tsx", formats: ["es"], fileName: () => "ha-dollhouse.js" },
    outDir: "custom_components/dollhouse/frontend",
    emptyOutDir: true,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  server: { port: 5175, open: "/dev/index.html" },
});
