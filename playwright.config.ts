import { defineConfig } from '@playwright/test'

/** Runs against the production build (with its CSP) in the Chrome already installed. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    // The suite reads the Spanish texts; e2e/language.e2e.ts covers English.
    locale: 'es-MX',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
