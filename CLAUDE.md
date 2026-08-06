# CLAUDE.md — Libro Hespérides

App web local-first del Taller de Contabilidad, Trazabilidad y Fiscalidad en Bitcoin (Universidad de las Hespérides, Ed. 2026). Hace amigable el método del taller: el **Libro** (diario contable con SALDOS, FIFO y CUADRE calculados) y el **Archivo** (expediente probatorio). Herramienta de trabajo real del alumno, no un juguete didáctico.

## Reglas de oro (violarlas es un bug)

1. **La especificación del dominio es `docs/reference/DOMINIO.md`** y, en última instancia, `docs/reference/PLANTILLA_TALLER.xlsx` (las fórmulas del Excel son la fuente de verdad). Ante cualquier duda de cálculo, replicar el Excel.
2. **Nunca aritmética float** para cantidades ni euros: siempre `decimal.js`. BTC con 8 decimales. Tolerancias del cuadre: verde ≤ 1e-8, ámbar ≤ 0,001.
3. **Local-first estricto**: cero llamadas de red en runtime (sin analytics, sin CDNs en producción, sin APIs). Los datos del alumno no salen de su navegador salvo export explícito.
4. **El motor (`src/engine/`) es TypeScript puro**: sin React, sin Dexie, sin browser APIs. Funciones deterministas estado→resultado. Toda lógica de cálculo vive ahí, jamás en componentes.
5. **Textos fiscales**: se copian literales de los manuales del taller (no inventar ni parafrasear calificaciones fiscales). Todo output fiscal lleva disclaimer de carácter orientativo y fecha de criterio.
6. **Idioma**: UI y código-comentarios en español (es-ES). Coma decimal en pantalla, punto interno. Fechas dd/mm/aaaa, hora local española.
7. **Catálogo cerrado de 11 tipos** de operación (ver DOMINIO.md §3.3): COMPRA, VENTA, PERMUTA, TRANSFERENCIA, RENDIMIENTO, MINERÍA, AIRDROP, PAGO, PÉRDIDA, DONACIÓN, AJUSTE/RECTIFICACIÓN. No añadir tipos.
8. **FIFO en cola ÚNICA global por activo** (sin distinguir ubicación). Comisión de adquisición en EUR SUMA al coste del lote; comisión de venta en EUR MINORA el valor de transmisión.
9. **Golden tests intocables**: `tests/golden/` (mini-caso 2024) debe pasar siempre. Saldos finales esperados: BTC 0,4068 · ETH 1,049 · USDC 305 · EUR 4.254 · ADA 0 · TOKENX 0.

## Stack

React 18 + TypeScript + Vite · Dexie.js (IndexedDB) · decimal.js · SheetJS (import xlsx) + exceljs (export) · Tailwind + TanStack Table · Vitest + Playwright · GitHub Pages (PWA).

## Comandos

- `npm run dev` — desarrollo
- `npm test` — Vitest (motor y unidad)
- `npm run test:e2e` — Playwright
- `npm run build && npm run preview` — build de producción
- Deploy: push a `main` → GitHub Actions → Pages

## Flujo de trabajo

- Tests del motor ANTES que implementación (los golden tests mandan).
- Commits pequeños por hito con mensaje en español.
- No refactorizar el motor y la UI en el mismo commit.
- Al terminar una tarea: `npm test` + `npm run build` en verde antes de dar por cerrado.
