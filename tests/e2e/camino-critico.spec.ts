import { test, expect, type Page, type Dialog } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * E2E del camino crítico (P8):
 *   alta de ubicaciones → registrar 5 apuntes de tipos distintos → verificar panel →
 *   exportar JSON → borrar → restaurar → mismos números. Y el ciclo XLSX.
 *
 * Se conduce la UI real (formularios dinámicos, descargas y selección de fichero),
 * validando la persistencia local y que ningún dato se pierde en el ida y vuelta.
 */

/** Acepta todos los diálogos; en los prompt de confirmación escribe «BORRAR». */
function aceptarDialogos(page: Page) {
  page.on('dialog', (d: Dialog) => {
    if (d.type() === 'prompt') void d.accept('BORRAR')
    else void d.accept()
  })
}

/** Espera y descarta el aviso «Lista sin conexión» de la PWA (aparece al activarse el SW). */
async function descartarAvisoPwa(page: Page) {
  const cerrar = page.getByRole('button', { name: 'Descartar aviso' })
  await cerrar.click({ timeout: 8000 }).catch(() => {})
}

async function irA(page: Page, seccion: string) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: seccion, exact: true }).click()
}

/** Crea una ubicación de tipo exchange con KYC. */
async function crearUbicacion(page: Page, nombre: string) {
  await irA(page, 'Ubicaciones')
  await page.getByRole('button', { name: '+ Nueva ubicación' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByPlaceholder('Kraken, Ledger, Lightning…').fill(nombre)
  await dlg.getByRole('button', { name: 'Crear ubicación' }).click()
  await expect(dlg).toBeHidden()
  await expect(page.getByRole('cell', { name: nombre, exact: true })).toBeVisible()
}

interface Lado {
  cantidad: string
  activo: string
}
interface SpecApunte {
  tipo: string
  fecha: string
  origen: string
  destino: string
  salida?: Lado
  entrada?: Lado
  contravalor?: string
}

/** Registra un apunte rellenando SOLO los campos que su tipo muestra. */
async function registrarApunte(page: Page, s: SpecApunte) {
  await page.getByRole('button', { name: '+ Nuevo apunte' }).click()
  const dlg = page.getByRole('dialog')
  const etiquetaUbic = (u: string) => (u === 'EXTERIOR' ? 'EXTERIOR (frontera)' : u)
  await dlg.getByLabel('Tipo de operación').selectOption(s.tipo)
  await dlg.getByLabel('Fecha y hora').fill(s.fecha)
  await dlg.getByLabel('Ubicación origen').selectOption({ label: etiquetaUbic(s.origen) })
  await dlg.getByLabel('Ubicación destino').selectOption({ label: etiquetaUbic(s.destino) })
  if (s.salida) {
    await dlg.getByLabel('Cantidad de salida').fill(s.salida.cantidad)
    await dlg.getByLabel('Activo de salida').selectOption(s.salida.activo)
  }
  if (s.entrada) {
    await dlg.getByLabel('Cantidad de entrada').fill(s.entrada.cantidad)
    await dlg.getByLabel('Activo de entrada').selectOption(s.entrada.activo)
  }
  if (s.contravalor !== undefined) {
    await dlg.getByLabel('Contravalor en euros').fill(s.contravalor)
  }
  await dlg.getByRole('button', { name: 'Registrar apunte' }).click()
  await expect(dlg).toBeHidden()
}

/** Los 5 apuntes de tipos distintos (FIFO seguro: se compra/recibe más de lo que sale). */
const APUNTES: SpecApunte[] = [
  { tipo: 'TRANSFERENCIA', fecha: '2024-01-15T09:00', origen: 'EXTERIOR', destino: 'Kraken', entrada: { cantidad: '2000', activo: 'EUR' } },
  { tipo: 'COMPRA', fecha: '2024-01-16T10:00', origen: 'Kraken', destino: 'Kraken', salida: { cantidad: '800', activo: 'EUR' }, entrada: { cantidad: '0.02', activo: 'BTC' }, contravalor: '800' },
  { tipo: 'RENDIMIENTO', fecha: '2024-02-15T12:00', origen: 'EXTERIOR', destino: 'Kraken', entrada: { cantidad: '0.001', activo: 'BTC' }, contravalor: '50' },
  { tipo: 'VENTA', fecha: '2024-04-05T10:00', origen: 'Kraken', destino: 'Kraken', salida: { cantidad: '0.005', activo: 'BTC' }, entrada: { cantidad: '300', activo: 'EUR' }, contravalor: '300' },
  { tipo: 'PERDIDA', fecha: '2024-09-01T12:00', origen: 'Kraken', destino: 'EXTERIOR', salida: { cantidad: '0.001', activo: 'BTC' }, contravalor: '0' },
]

/** Resumen estable del Diario para comparar antes/después: [id, tipo, salida, entrada] por fila. */
async function resumenDiario(page: Page): Promise<string[]> {
  await irA(page, 'Diario')
  await expect(page.locator('tr[data-fila]').first()).toBeVisible()
  return page.locator('tr[data-fila]').evaluateAll((filas) =>
    filas
      .map((f) => {
        const c = [...f.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim())
        // [Nº, Fecha, Tipo, KYC, Origen, Destino, Salida, Entrada, ...]
        return [c[0], c[2], c[6], c[7]].join(' | ')
      })
      .sort(),
  )
}

test('camino crítico: alta, 5 apuntes, panel, export JSON, borrar y restaurar', async ({ page }) => {
  aceptarDialogos(page)
  await page.goto('./')
  await expect(page.getByText(/abierta ·/)).toBeVisible()
  await descartarAvisoPwa(page)

  // 1 · Alta de ubicación.
  await crearUbicacion(page, 'Kraken')

  // 2 · Registrar 5 apuntes de tipos distintos.
  await irA(page, 'Diario')
  for (const a of APUNTES) await registrarApunte(page, a)

  // 3 · Verificar el panel: 5 apuntes en el Diario y saldos con sello en Trazabilidad.
  const antes = await resumenDiario(page)
  expect(antes).toHaveLength(5)
  await irA(page, 'Trazabilidad')
  await expect(page.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible()
  await expect(page.getByText('BTC').first()).toBeVisible()

  // 4 · Exportar copia JSON (captura la descarga).
  await irA(page, 'Ajustes')
  const dir = mkdtempSync(join(tmpdir(), 'hesp-'))
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar copia' }).click()
  const jsonPath = join(dir, 'copia.json')
  await (await descarga).saveAs(jsonPath)

  // 5 · Borrar todo (doble confirmación mediante diálogos).
  await page.getByRole('button', { name: 'Borrar todo el Libro…' }).click()
  await irA(page, 'Diario')
  await expect(page.getByText('El diario está vacío. Registra el primer apunte.')).toBeVisible()

  // 6 · Restaurar la copia y comprobar que los números vuelven idénticos.
  await irA(page, 'Ajustes')
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(jsonPath)
  await expect(page.getByText(/[Rr]estaurad|[Cc]opia/).first()).toBeVisible()
  const despues = await resumenDiario(page)
  expect(despues).toEqual(antes)
})

test('ciclo XLSX: exportar, borrar e importar reproduce los mismos apuntes', async ({ page }) => {
  aceptarDialogos(page)
  await page.goto('./')
  await expect(page.getByText(/abierta ·/)).toBeVisible()
  await descartarAvisoPwa(page)

  await crearUbicacion(page, 'Kraken')
  await irA(page, 'Diario')
  for (const a of APUNTES) await registrarApunte(page, a)
  const antes = await resumenDiario(page)
  expect(antes).toHaveLength(5)

  // Exportar a XLSX.
  await irA(page, 'Ajustes')
  const dir = mkdtempSync(join(tmpdir(), 'hesp-'))
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar a XLSX' }).click()
  const xlsxPath = join(dir, 'libro.xlsx')
  await (await descarga).saveAs(xlsxPath)

  // Borrar e importar de vuelta.
  await page.getByRole('button', { name: 'Borrar todo el Libro…' }).click()
  await irA(page, 'Diario')
  await expect(page.getByText('El diario está vacío. Registra el primer apunte.')).toBeVisible()

  await irA(page, 'Ajustes')
  await page.locator('input[type="file"][accept=".xlsx"]').setInputFiles(xlsxPath)
  await expect(page.getByText(/Importación XLSX completada/)).toBeVisible()
  const despues = await resumenDiario(page)
  expect(despues).toEqual(antes)
})

test('teclado en el Diario: flechas navegan a través de la virtualización y Enter edita', async ({ page }) => {
  aceptarDialogos(page)
  // Activa las herramientas de desarrollo antes de cargar la app.
  await page.addInitScript(() => localStorage.setItem('hesperides.dev', '1'))
  await page.goto('./')
  await expect(page.getByText(/abierta ·/)).toBeVisible()
  await descartarAvisoPwa(page)

  // Genera un diario grande (cruza el límite de la virtualización).
  await irA(page, 'Ajustes')
  await page.getByLabel('Nº de apuntes').fill('500')
  await page.getByRole('button', { name: 'Generar dataset sintético' }).click()
  await expect(page.getByText(/Cargados 500 apuntes/)).toBeVisible()

  await irA(page, 'Diario')
  const filas = page.locator('tr[data-fila]')
  await expect(filas.first()).toBeVisible()
  await filas.first().click()

  // 40 pulsaciones de ↓ deben llevar la fila activa a la 40 (más allá de la ventana inicial).
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowDown')
  const activa = page.locator('tr[aria-selected="true"]')
  await expect(activa).toHaveCount(1)
  await expect(activa).toHaveAttribute('data-fila', '40')

  // Enter abre la edición de la fila activa; Esc la cierra.
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})
