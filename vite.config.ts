/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Versión de la app, leída de package.json e inyectada como `__APP_VERSION__`
// (se muestra en «Acerca de»). Fuente única: el número de versión del paquete.
const version = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
    version: string
  }
).version

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  // Base para GitHub Pages: el sitio se sirve desde /libro-cont/ en producción.
  // Se ata a `mode` (no a `command`) para que `vite build` y `vite preview` —ambos
  // en modo production— coincidan; en dev (`vite`, modo development) usamos '/'.
  // Sobreescribible con VITE_BASE (p. ej. fork con otro nombre de repo).
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/libro-cont/' : '/'),
  plugins: [
    react(),
    // PWA local-first (Regla de oro 3: cero red en runtime). El service worker
    // precachea TODO el build (cache-first por defecto en precache): la app funciona
    // 100 % sin conexión, incluida la plantilla XLSX y el chunk pesado de Ajustes.
    VitePWA({
      registerType: 'prompt', // el alumno decide cuándo recargar a la nueva versión
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Libro Hespérides',
        short_name: 'Hespérides',
        description:
          'Libro contable y Archivo probatorio del Taller de Bitcoin (Universidad de las Hespérides). App local-first.',
        lang: 'es-ES',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        categories: ['finance', 'education', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Precachea el build completo, incluida la plantilla .xlsx (57 kB) para que
        // el import/export funcione sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,xlsx,woff2}'],
        // El chunk de Ajustes (SheetJS + exceljs) ronda 1,3 MB: subimos el límite.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Router por hash: cualquier navegación cae en index.html (ya precacheado).
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      // En dev el SW está desactivado por defecto: no interfiere con `npm run dev`.
      devOptions: { enabled: false },
    }),
  ],
  build: {
    // Local-first: sin dependencias de red en runtime.
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    // Motor y unidad: TypeScript puro, entorno Node por defecto. Los tests de
    // componentes (.test.tsx) fijan su propio entorno jsdom con un docblock
    // `// @vitest-environment jsdom` en cabecera.
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      // La cobertura que importa (criterio de aceptación P1 ≥ 90 %) es la del MOTOR:
      // funciones deterministas estado→resultado. Se acota a src/engine/ (sin los .test).
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts', 'src/engine/types.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
}))
