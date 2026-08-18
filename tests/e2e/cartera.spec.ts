import { test, expect, type Page, type Dialog } from '@playwright/test'

/**
 * E2E de la pestaña Cartera y el caso de ejemplo (P9.2 / P9.3):
 *   Inicio → «Cargar caso de ejemplo» → Cartera → editar un precio → el valor se recalcula.
 * Verifica el camino local-first completo (precios manuales, sin red) y la reactividad.
 */

function aceptarDialogos(page: Page) {
  page.on('dialog', (d: Dialog) => void d.accept())
}

async function descartarAvisoPwa(page: Page) {
  const cerrar = page.getByRole('button', { name: 'Descartar aviso' })
  await cerrar.click({ timeout: 8000 }).catch(() => {})
}

/**
 * Navega a una sección. Desde la reestructuración de la cabecera (ENCARGO, Parte 1) hay
 * SIETE pestañas principales y algunas secciones son subapartados: se llega a ellas por la
 * pestaña que las agrupa y luego por su pestaña secundaria.
 */
const SUBAPARTADO_DE: Record<string, string> = {
  Posiciones: 'Cartera',
  Ubicaciones: 'Ajustes',
  'Parámetros': 'Ajustes',
  'Importar cadena': 'Ajustes',
}

async function irA(page: Page, seccion: string) {
  const padre = SUBAPARTADO_DE[seccion]
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('button', { name: padre ?? seccion, exact: true })
    .click()
  if (padre) {
    await page
      .getByRole('navigation', { name: 'Apartados' })
      .getByRole('button', { name: seccion, exact: true })
      .click()
  }
}

test('Cartera: cargar caso de ejemplo, ver la valoración y recalcular al editar un precio', async ({
  page,
}) => {
  aceptarDialogos(page)
  await page.goto('./')
  await expect(page.getByText(/abierta ·/)).toBeVisible()
  await descartarAvisoPwa(page)

  // 1 · Cargar el caso de ejemplo desde Inicio (navega al Diario).
  await page.getByRole('button', { name: 'Cargar caso de ejemplo', exact: true }).click()
  await expect(page.locator('tr[data-fila]').first()).toBeVisible()

  // 2 · Ir a Cartera: valor estimado 93.062,12 € con los precios de demostración
  //     (BTC 0,84355 × 100.000 + ETH 0,249 × 3.000 + USDC 311 × 0,92 + EUR 7.674).
  await irA(page, 'Cartera')
  await expect(page.getByRole('heading', { name: 'Cartera' })).toBeVisible()
  await expect(page.getByText('93.062,12 €').first()).toBeVisible()

  // 3 · Editar el precio manual de BTC: 100.000 → 120.000. El valor de BTC pasa a 101.226 €.
  const precioBtc = page.getByLabel('Precio manual de BTC en euros')
  await precioBtc.fill('120000')
  await precioBtc.press('Enter')

  // La fila de BTC (0,84355 × 120.000 = 101.226) y el nuevo total (109.933,12) se reflejan.
  // Se afirma sobre la celda de la tabla y la tarjeta (visibles), no sobre el <title> del SVG.
  await expect(page.getByRole('cell', { name: '101.226 €', exact: true })).toBeVisible()
  await expect(
    page.getByText('Valor estimado').locator('..').getByText('109.933,12 €'),
  ).toBeVisible()

  // 4 · El caso de ejemplo se puede borrar desde Ajustes (deja el Libro vacío).
  await irA(page, 'Ajustes')
  await page.getByRole('button', { name: 'Borrar caso de ejemplo' }).click()
  await expect(page.getByText(/Caso de ejemplo borrado/)).toBeVisible()
})
