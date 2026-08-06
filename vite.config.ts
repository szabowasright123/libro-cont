/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Base para GitHub Pages: el sitio se sirve desde /libro-cont/ en producción.
  // Se ata a `mode` (no a `command`) para que `vite build` y `vite preview` —ambos
  // en modo production— coincidan; en dev (`vite`, modo development) usamos '/'.
  // Sobreescribible con VITE_BASE (p. ej. fork con otro nombre de repo).
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/libro-cont/' : '/'),
  plugins: [react()],
  build: {
    // Local-first: sin dependencias de red en runtime.
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    // Motor y unidad: TypeScript puro, entorno Node por defecto.
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
}))
