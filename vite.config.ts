/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }
import vercel from './vercel.json' with { type: 'json' }

/**
 * The security headers live in vercel.json, the one place they are written. Vercel sends
 * them in production, frame-ancestors included. The built page also carries the CSP in a
 * <meta>, so `vite preview` and the e2e run under it too; a <meta> ignores frame-ancestors
 * (and warns), so it is left out there. Only the build gets it: the dev server injects
 * inline styles and scripts for hot reload. React sets styles through the DOM, which CSP allows.
 */
const CSP = (() => {
  const header = vercel.headers
    .find((rule) => rule.source === '/(.*)')
    ?.headers.find((h) => h.key === 'Content-Security-Policy')?.value
  if (!header) throw new Error('vercel.json has no Content-Security-Policy for "/(.*)"')
  return header
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive && !directive.startsWith('frame-ancestors'))
    .join('; ')
})()

const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
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
