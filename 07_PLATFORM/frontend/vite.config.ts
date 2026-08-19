/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Docker Desktop (Windows/macOS) doesn't propagate inotify events from a
      // bind-mounted host directory into the Linux container, so the native
      // watcher never fires on host-side edits. Polling works everywhere.
      usePolling: true,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // Playwright's own spec files also match vitest's default *.spec.ts
    // pattern; they use @playwright/test's fixtures, not vitest's, so they
    // must never be picked up here.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
