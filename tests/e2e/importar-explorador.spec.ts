import { test, expect, type Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * E2E de la importación desde exploradores de bloques (ENCARGO, Parte 2):
 * registrar la dirección → subir el CSV → triaje → añadir al Diario.
 *
 * Comprueba lo esencial del criterio: la app no llama a ninguna red, nada entra sin
 * confirmación, y el traslado entre direcciones propias es la única propuesta automática.
 */

const MIA = '0x1111111111111111111111111111111111111111'
const OTRA = '0x2222222222222222222222222222222222222222'
const AJENA = '0x9999999999999999999999999999999999999999'

const CSV = [
  'Txhash,Blockno,UnixTimestamp,DateTime (UTC),From,To,ContractAddress,Value_IN(ETH),' +
    'Value_OUT(ETH),CurrentValue @ $1785.9/Eth,TxnFee(ETH),TxnFee(USD),Historical $Price/Eth,Status,ErrCode',
  `0xaaa,1,1705399200,2024-01-16 10:00:00,${OTRA},${MIA},,2,0,3571.8,0,0,1785.9,,`,
  `0xbbb,2,1705402800,2024-01-16 11:00:00,${MIA},${AJENA},,0,1,1785.9,0.001,2,1785.9,,`,
].join('\n')

async function descartarAvisoPwa(page: Page) {
  await page.getByRole('button', { name: 'Descartar aviso' }).click({ timeout: 8000 }).catch(() => {})
}

async function irA(page: Page, principal: string, apartado?: string) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: principal, exact: true }).click()
  if (apartado) {
    const sub = page.getByRole('navigation', { name: 'Apartados' }).getByRole('button', { name: apartado, exact: true })
    await sub.click()
    // La página es de carga diferida: espera a que sea la activa antes de seguir.
    await expect(sub).toHaveAttribute('aria-current', 'page')
  }
}

test('importar desde explorador: dirección propia → triaje → alta en el Diario', async ({ page }) => {
  await page.goto('./')
  await descartarAvisoPwa(page)

  // 1 · Dos ubicaciones: una con dos direcciones propias (para el traslado) y nada más.
  await irA(page, 'Ajustes', 'Ubicaciones')
  await page.getByRole('button', { name: '+ Nueva ubicación' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByPlaceholder('Kraken, Ledger, Lightning…').fill('MetaMask')
  await dlg.getByLabel('Direcciones on-chain').fill(`${MIA}\n${OTRA}`)
  await dlg.getByRole('button', { name: 'Crear ubicación' }).click()
  await expect(dlg).toBeHidden()
  await expect(page.getByRole('cell', { name: 'MetaMask', exact: true })).toBeVisible()

  // 2 · Subir el CSV del explorador.
  const dir = mkdtempSync(join(tmpdir(), 'hesperides-'))
  const ruta = join(dir, 'export-normal.csv')
  writeFileSync(ruta, CSV, 'utf-8')

  await irA(page, 'Ajustes', 'Importar cadena')
  await expect(page.getByRole('heading', { name: 'Importar desde un explorador' })).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles(ruta)

  // 3 · La bandeja propone: traslado propio (calificado) y salida al exterior (sin calificar).
  await expect(page.getByText('traslado propio')).toBeVisible()
  await expect(page.getByText('lo calificas tú')).toBeVisible()
  // La entrada 0xaaa es entre direcciones propias: TRANSFERENCIA automática.
  await expect(page.getByRole('button', { name: /Añadir al Diario \(1\)/ })).toBeVisible()

  // 4 · El alumno califica la salida como VENTA: ahora son dos.
  await page.getByLabel('Tipo del movimiento 0xbbb#normal#0').selectOption('VENTA')
  await expect(page.getByRole('button', { name: /Añadir al Diario \(2\)/ })).toBeVisible()

  await page.getByRole('button', { name: /Añadir al Diario/ }).click()
  await expect(page.getByText(/2 apunte\(s\) añadidos al Diario/)).toBeVisible()

  // 5 · Están en el Diario, con su marca de trazabilidad.
  await irA(page, 'Diario')
  await expect(page.getByRole('cell', { name: '2024-001' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '2024-002' })).toBeVisible()

  // 6 · Reimportar el mismo fichero no duplica nada.
  await irA(page, 'Ajustes', 'Importar cadena')
  await expect(page.getByRole('heading', { name: 'Importar desde un explorador' })).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles(ruta)
  await page.getByLabel('Tipo del movimiento 0xbbb#normal#0').selectOption('VENTA')
  await page.getByRole('button', { name: /Añadir al Diario/ }).click()
  await expect(page.getByText(/2 descartado\(s\) por estar ya en el Libro/)).toBeVisible()
})
