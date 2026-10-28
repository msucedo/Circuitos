/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }

/**
 * Strict CSP for the built app only: the dev server injects inline styles and
 * scripts for hot reload. React sets styles through the DOM, which CSP allows.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/**
 * Cloudflare Pages headers. A <meta> CSP cannot set frame-ancestors, and only a
 * header can turn on HSTS. Hashed assets never change, so they cache for a year.
 */
const HEADERS = `/*
  Content-Security-Policy: ${CSP}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`

const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), csp()],
  // package.json is the one place the version is written.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    modulePreload: { polyfill: false },
    rolldownOptions: {
      output: {
        // Libraries change less often than the app: their own files stay cached across releases.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'flow', test: /node_modules[\\/](@xyflow|d3-[^\\/]+|classcat|zustand)[\\/]/ },
            { name: 'i18n', test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector|html-parse-stringify|void-elements)[\\/]/ },
          ],
        },
      },
    },
  },
  test: { setupFiles: ['src/test-setup.ts'] },
})
