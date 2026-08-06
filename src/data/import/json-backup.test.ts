/**
 * json-backup.test.ts — copia nativa JSON versionada (P4, punto 4).
 */
import { describe, it, expect } from 'vitest'
import {
  exportarJson,
  parsearSnapshot,
  construirSnapshot,
  serializarSnapshot,
  ErrorRestauracion,
  FORMATO_SNAPSHOT,
  VERSION_SNAPSHOT,
  type EntradaSnapshot,
} from './json-backup'
import { importarCsvGenerico } from './csv-generico'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Ubicacion } from '../../engine/types'

const CSV = readFileSync(
  fileURLToPath(new URL('../../../docs/reference/mini_caso_generico.csv', import.meta.url)),
  'utf8',
)

function datosDePrueba(): EntradaSnapshot {
  const { apuntes } = importarCsvGenerico(CSV)
  const ubicaciones: Ubicacion[] = [
    { id: 'Kraken', nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2024-01-01T00:00:00' },
    { id: 'Ledger', nombre: 'Ledger', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-10T00:00:00' },
  ]
  return {
    apuntes,
    ubicaciones,
    activos: [
      { simbolo: 'EUR', nombre: 'Euro', decimales: 2, esFiat: true },
      { simbolo: 'BTC', nombre: 'Bitcoin', decimales: 8, esFiat: false },
    ],
    tolerancias: { verde: 1e-8, ambar: 1e-3 },
    justificantes: [
      { id: 'j1', apunteId: '2024-002', rutaConvencional: '01-adquisiciones', tipoDocumento: 'orden', notas: 'PDF' },
    ],
    cuadreReal: [{ ubicacion: 'Kraken', activo: 'BTC', saldoReal: '0.1098' }],
    exportadoEn: '2026-08-06T12:00:00',
  }
}

describe('json-backup · round-trip exportar → parsear', () => {
  it('conserva íntegramente el contenido', () => {
    const datos = datosDePrueba()
    const texto = exportarJson(datos)
    const snap = parsearSnapshot(texto)

    expect(snap.formato).toBe(FORMATO_SNAPSHOT)
    expect(snap.version).toBe(VERSION_SNAPSHOT)
    expect(snap.apuntes).toEqual(datos.apuntes)
    expect(snap.ubicaciones).toEqual(datos.ubicaciones)
    expect(snap.activos).toEqual(datos.activos)
    expect(snap.tolerancias).toEqual(datos.tolerancias)
    expect(snap.justificantes).toEqual(datos.justificantes)
    expect(snap.cuadreReal).toEqual(datos.cuadreReal)
    expect(snap.exportadoEn).toBe('2026-08-06T12:00:00')
  })

  it('el JSON es legible (con sangría) y sella formato+versión', () => {
    const texto = serializarSnapshot(construirSnapshot(datosDePrueba()))
    expect(texto).toContain('"formato": "libro-hesperides"')
    expect(texto).toContain('"version": 1')
    expect(texto.split('\n').length).toBeGreaterThan(10)
  })
})

describe('json-backup · validación de restauración', () => {
  it('rechaza JSON inválido', () => {
    expect(() => parsearSnapshot('{no-json')).toThrow(ErrorRestauracion)
  })
  it('rechaza un fichero que no es del Libro', () => {
    expect(() => parsearSnapshot(JSON.stringify({ hola: 1 }))).toThrow(/no es una copia del Libro/)
  })
  it('rechaza una versión más nueva que la app', () => {
    const futuro = JSON.stringify({ formato: FORMATO_SNAPSHOT, version: 99 })
    expect(() => parsearSnapshot(futuro)).toThrow(/versión más nueva/)
  })
  it('tolera arrays opcionales ausentes (Libro vacío)', () => {
    const minimo = JSON.stringify({ formato: FORMATO_SNAPSHOT, version: 1 })
    const snap = parsearSnapshot(minimo)
    expect(snap.apuntes).toEqual([])
    expect(snap.justificantes).toEqual([])
    expect(snap.cuadreReal).toEqual([])
    expect(snap.tolerancias).toEqual({ verde: 1e-8, ambar: 1e-3 })
  })
})
