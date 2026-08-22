/**
 * @vitest-environment node
 *
 * xlsx-roundtrip.test.ts — CRITERIO DE ACEPTACIÓN P4.2:
 * «Ciclo export XLSX → (borrar todo) → import XLSX = datos idénticos.»
 *
 * Se construye un contenido de Libro (apuntes del mini-caso importados del CSV +
 * ubicaciones con tipo/KYC distintos + tolerancias), se exporta a XLSX sobre la
 * plantilla oficial y se vuelve a importar. La comparación es por igualdad DECIMAL
 * exacta (no de cadena) y por conjunto, ignorando el id correlativo (que se recalcula).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { importarCsvGenerico } from './csv-generico'
import { exportarXlsx } from './xlsx-export'
import { importarXlsx } from './xlsx-import'
import type { ContenidoLibro } from './contenido'
import type { Apunte, Ubicacion } from '../../engine/types'
import { D } from '../../engine/decimal'

const raiz = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))
const CSV = readFileSync(raiz('../../../docs/reference/mini_caso_generico.csv'), 'utf8')
const PLANTILLA = readFileSync(raiz('../../assets/plantilla-taller.xlsx'))

/** Contenido de partida: apuntes del CSV + 2 ubicaciones con datos distintos + tolerancias. */
function contenidoOrigen(): ContenidoLibro {
  const { apuntes } = importarCsvGenerico(CSV)
  const ubicaciones: Ubicacion[] = [
    { id: 'Kraken', nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2024-01-01T00:00:00' },
    { id: 'Ledger', nombre: 'Ledger', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-10T00:00:00', notas: 'Cartera fría' },
  ]
  return {
    apuntes,
    ubicaciones,
    activos: [],
    tolerancias: { verde: 1e-8, ambar: 1e-3 },
  }
}

/** Compara dos apuntes por su contenido de negocio (ignorando el id correlativo). */
function apuntesEquivalentes(a: Apunte, b: Apunte): void {
  expect(b.fechaHora).toBe(a.fechaHora)
  expect(b.tipo).toBe(a.tipo)
  expect(b.ubicacionOrigen).toBe(a.ubicacionOrigen)
  expect(b.ubicacionDestino).toBe(a.ubicacionDestino)
  expect(b.activoSalida).toBe(a.activoSalida)
  expect(b.activoEntrada).toBe(a.activoEntrada)
  expect(b.comisionActivo).toBe(a.comisionActivo)
  expect(b.notas).toBe(a.notas)
  expect(b.sentido).toBe(a.sentido)
  const dec = (x?: string) => (x === undefined ? undefined : D(x).toFixed())
  for (const campo of [
    'cantidadSalida',
    'cantidadEntrada',
    'comisionCantidad',
    'contravalorEUR',
    'valorMercadoEntregadoEUR',
    'valorMercadoRecibidoEUR',
  ] as const) {
    const va = a[campo]
    const vb = b[campo]
    if (va === undefined) expect(vb).toBeUndefined()
    else expect(dec(vb), `${campo}: ${vb} ≠ ${va}`).toBe(dec(va))
  }
}

describe('round-trip XLSX (export → import)', () => {
  it('reproduce los apuntes idénticos (igualdad decimal, mismo orden cronológico)', async () => {
    const origen = contenidoOrigen()
    const { archivos, avisos } = await exportarXlsx(origen, PLANTILLA)
    expect(avisos).toEqual([]) // 19 apuntes: cabe en un solo fichero
    expect(archivos).toHaveLength(1)

    const reimportado = importarXlsx(archivos[0]!.bytes)
    expect(reimportado.informe.filasRechazadas).toEqual([])
    expect(reimportado.apuntes).toHaveLength(origen.apuntes.length)

    const orden = (xs: Apunte[]) =>
      [...xs].sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())
    const A = orden(origen.apuntes)
    const B = orden(reimportado.apuntes)
    A.forEach((ap, i) => apuntesEquivalentes(ap, B[i]!))
  })

  it('el SENTIDO de la donación sobrevive al ciclo (columna Q de ampliación)', async () => {
    // Sin esta columna, exportar a Excel y reimportar borraría el `sentido` y devolvería
    // el Libro al defecto de la v1.5.0: saldo abajo, cola FIFO intacta. Ver
    // `engine/conciliacion.ts` y la ampliación O/P/Q de `plantilla-layout.ts`.
    const origen = contenidoOrigen()
    origen.apuntes.push({
      id: '2024-900',
      fechaHora: '2024-12-20T10:00:00',
      tipo: 'DONACION',
      sentido: 'entregada',
      ubicacionOrigen: 'Ledger',
      ubicacionDestino: 'EXTERIOR',
      activoSalida: 'BTC',
      cantidadSalida: '0.01',
      contravalorEUR: '900',
    })
    const { archivos } = await exportarXlsx(origen, PLANTILLA)
    const { apuntes } = importarXlsx(archivos[0]!.bytes)
    const don = apuntes.find((a) => a.tipo === 'DONACION')
    expect(don).toBeDefined()
    expect(don!.sentido).toBe('entregada')
  })

  it('reproduce las ubicaciones (nombre, tipo, KYC, notas)', async () => {
    const origen = contenidoOrigen()
    const { archivos } = await exportarXlsx(origen, PLANTILLA)
    const { ubicaciones } = importarXlsx(archivos[0]!.bytes)

    const porNombre = new Map(ubicaciones.map((u) => [u.nombre, u]))
    for (const u of origen.ubicaciones) {
      const v = porNombre.get(u.nombre)
      expect(v, `falta ubicación ${u.nombre}`).toBeDefined()
      expect(v!.tipo).toBe(u.tipo)
      expect(v!.kyc).toBe(u.kyc)
      expect(v!.notas).toBe(u.notas)
    }
  })

  it('reproduce las tolerancias del cuadre', async () => {
    const origen = contenidoOrigen()
    const { archivos } = await exportarXlsx(origen, PLANTILLA)
    const { tolerancias } = importarXlsx(archivos[0]!.bytes)
    expect(tolerancias).toEqual(origen.tolerancias)
  })

  it('conserva las fórmulas de las hojas calculadas (SALDOS/FIFO/CUADRE recalculan solas)', async () => {
    // Criterio P4.3 (parte automatizable): el Excel debe recalcularse solo, así que las
    // fórmulas de las hojas calculadas NO pueden perderse al escribir los datos.
    const origen = contenidoOrigen()
    const { archivos } = await exportarXlsx(origen, PLANTILLA)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(archivos[0]!.bytes as unknown as ArrayBuffer)

    const tieneFormula = (hoja: string, celda: string) => {
      const c = wb.getWorksheet(hoja)!.getCell(celda)
      return c.type === ExcelJS.ValueType.Formula || typeof (c.value as { formula?: string })?.formula === 'string'
    }
    expect(tieneFormula('SALDOS', 'F5')).toBe(true) // saldo = C−D−E
    expect(tieneFormula('FIFO', 'B4')).toBe(true) // total adquirido
    expect(tieneFormula('CUADRE', 'E4')).toBe(true) // diferencia
    // Y los datos aterrizaron: DIARIO!B3 es una fecha/serial (no una fórmula). En el xlsx
    // se almacena como número con formato de fecha; exceljs lo rehidrata como Date.
    const b3 = wb.getWorksheet('DIARIO')!.getCell('B3')
    expect(typeof b3.value === 'number' || b3.value instanceof Date).toBe(true)
    // 1.er apunte cronológico = ingreso inicial de fiat (deposito_fiat → TRANSFERENCIA).
    expect(wb.getWorksheet('DIARIO')!.getCell('C3').value).toBe('TRANSFERENCIA')
  })

  it('el fichero exportado no arrastra las filas de ejemplo de la plantilla', async () => {
    const origen = contenidoOrigen()
    const { archivos } = await exportarXlsx(origen, PLANTILLA)
    // Al reimportar SIN excluir ejemplos, no debe aparecer ninguno (los limpió el export).
    const { informe } = importarXlsx(archivos[0]!.bytes, { excluirEjemplos: false })
    expect(informe.ejemplosDetectados).toBe(0)
  })

  it('conserva los dos valores de mercado de la permuta (art. 37.1.h) al ir y volver', async () => {
    const origen = contenidoOrigen()
    // Se enriquece la permuta del mini-caso con los dos valores de mercado (columnas O y P,
    // que la plantilla oficial no trae y que la app añade al exportar).
    const i = origen.apuntes.findIndex((a) => a.tipo === 'PERMUTA')
    expect(i).toBeGreaterThanOrEqual(0)
    const original = origen.apuntes[i] as Apunte
    const apuntes = origen.apuntes.map((a, k) =>
      k === i
        ? {
            ...original,
            contravalorEUR: '1653.75',
            valorMercadoEntregadoEUR: '1650',
            valorMercadoRecibidoEUR: '1653.75',
          }
        : a,
    )
    const { archivos } = await exportarXlsx({ ...origen, apuntes }, PLANTILLA)
    const primero = archivos[0]
    expect(primero).toBeDefined()
    const { apuntes: vuelta } = await importarXlsx((primero as { bytes: Uint8Array }).bytes)
    const permuta = vuelta.find((a) => a.tipo === 'PERMUTA') as Apunte | undefined
    expect(permuta).toBeDefined()
    const p = permuta as Apunte
    expect(D(p.valorMercadoEntregadoEUR as string).toFixed()).toBe(D('1650').toFixed())
    expect(D(p.valorMercadoRecibidoEUR as string).toFixed()).toBe(D('1653.75').toFixed())
    expect(D(p.contravalorEUR as string).toFixed()).toBe(D('1653.75').toFixed())
  })
})
