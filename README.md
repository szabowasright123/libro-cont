# Libro Hespérides

App web **local-first** del Taller de Contabilidad, Trazabilidad y Fiscalidad en Bitcoin
(Universidad de las Hespérides, Ed. 2026). Hace amigable el método del taller: el **Libro**
(diario contable con SALDOS, FIFO y CUADRE calculados) y el **Archivo** (expediente
probatorio).

> Los datos del alumno **no salen de su navegador** salvo export explícito. Cero llamadas
> de red en runtime.

## Stack

React 18 + TypeScript (estricto) + Vite · Dexie.js (IndexedDB) · decimal.js ·
SheetJS (import xlsx) + exceljs (export) · Tailwind + TanStack Table · Vitest + Playwright ·
GitHub Pages (PWA).

## Estructura

```
src/
  engine/   Motor de cálculo: TypeScript puro (sin React/Dexie/browser). Tipos y lógica.
  data/     Persistencia local (Dexie) e import/export.
  ui/        Componentes y páginas.
  app/       Layout y rutas.
tests/
  golden/   Golden tests intocables (mini-caso 2024).
  e2e/       Playwright.
docs/reference/   Especificación del dominio (DOMINIO.md) y la plantilla oficial.
```

## Comandos

- `npm run dev` — desarrollo (http://localhost:5173)
- `npm test` — Vitest (motor y unidad)
- `npm run test:e2e` — Playwright (requiere `npx playwright install` la primera vez)
- `npm run build && npm run preview` — build de producción y previsualización local
  (se sirve bajo `/libro-cont/`, igual que en GitHub Pages)

## Despliegue

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) ejecuta `npm test` y
`npm run build` y publica `dist/` en GitHub Pages. Requiere activar Pages en el repo con
origen **GitHub Actions** (Settings → Pages → Build and deployment → Source: GitHub Actions).

La base del sitio es `/libro-cont/`; si el repo tuviera otro nombre, ajusta `base` en
[`vite.config.ts`](vite.config.ts) o define `VITE_BASE`.

## Reglas del proyecto

Ver [`CLAUDE.md`](CLAUDE.md) y [`docs/reference/DOMINIO.md`](docs/reference/DOMINIO.md).
La fuente de verdad última del cálculo es `docs/reference/PLANTILLA_TALLER.xlsx`.
