import { defineConfig } from "vitest/config"

// Business-logic tests only (pure lib + zustand stores). No React rendering, so
// we deliberately don't load the app's vite plugins here. The persistence layer
// is best-effort and falls back to localStorage, which jsdom provides.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
})
