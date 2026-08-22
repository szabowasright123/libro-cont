/**
 * rutas.spec.ts — prueba de humo de las CATORCE rutas de la app (v1.6.0).
 *
 * Barata y desproporcionadamente útil: carga el caso de ejemplo, visita todas las rutas por
 * hash y exige que cada una pinte algo y que la consola quede LIMPIA. Una pantalla que revienta
 * al montarse no la caza ningún test de motor —el motor está bien—, y sin embargo es lo primero
 * que ve el alumno. Con cuatro pantallas nuevas en esta versión, conviene tenerla.
 */
import { test, expect, type Page } from '@playwright/test'

/** Las rutas navegables, en el orden del método del taller. */
const RUTAS = [
  'inicio',
  'diario',
  'panel',
  'archivo',
  'cartera',
  'posiciones',
  'trazabilidad',
  'fiscal',
  'cierre',
  'ajustes',
  'ubicaciones',
  'parametros',
  'importar',
  'acerca',
] as const

function recogerErrores(page: Page): string[] {
  const errores: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text())
  })
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))
  return errores
}

test('las catorce rutas cargan con el caso de ejemplo y sin errores de consola', async ({ page }) => {
  const errores = recogerErrores(page)
  page.on('dialog', (d) => void d.accept())

  await page.goto('./')
  await page.getByRole('button', { name: 'Cargar caso de ejemplo', exact: true }).click()
  await expect(page.locator('tr[data-fila]').first()).toBeVisible()

  for (const ruta of RUTAS) {
    await page.goto(`./#/${ruta}`)
    // El contenido de cada página se monta tras leer de Dexie: se espera a que haya texto.
    await expect
      .poll(async () => (await page.locator('main').innerText().catch(() => '')).length, {
        message: `la ruta #/${ruta} no pintó contenido`,
        timeout: 5000,
      })
      .toBeGreaterThan(40)
  }

  // Los casos del taller viven en Inicio, junto al caso de ejemplo (no lo sustituyen).
  await page.goto('./#/inicio')
  await expect(page.getByRole('heading', { name: /casos del taller/i })).toBeVisible()

  expect(errores, `errores de consola:\n${errores.join('\n')}`).toEqual([])
})
