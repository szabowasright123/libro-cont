// @vitest-environment jsdom
/**
 * integracion.test.ts — puentes import/export contra IndexedDB real (fake-indexeddb).
 *
 * Cubre el bucle completo que ve el alumno: importar → persistir → exportar → borrar →
 * reimportar, y la copia JSON nativa a través de la base. Refuerza los criterios de
 * aceptación P4.1 (CSV reproduce SALDOS) y P4.2 (ciclo XLSX idéntico) end-to-end.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db, sembrarSiVacia } from '../db'
import {
  reemplazarContenido,
  exportarContenidoActual,
  snapshotActual,
  restaurarSnapshot,
  borrarTodo,
  listarApuntes,
  listarActivos,
  listarRegistros,
  crearJustificante,
  listarJustificantes,
  justificantesADominio,
} from '../repositorio'
import { importarCsvGenerico } from './csv-generico'
import { importarXlsx } from './xlsx-import'
import { exportarXlsx } from './xlsx-export'
import { activosDescubiertos, simbolosDeApunte, type ContenidoLibro } from './contenido'
import { exportarJson, parsearSnapshot } from './json-backup'
import { calcularSaldos, saldosTotalesPorActivo } from '../../engine/saldos'
import { D } from '../../engine/decimal'
import { SALDOS_TOTALES_ESPERADOS, CORTE_2024 } from '../../../tests/golden/mini-caso'
import type { Ubicacion } from '../../engine/types'

const raiz = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))
const CSV = readFileSync(raiz('../../../docs/reference/mini_caso_generico.csv'), 'utf8')
const PLANTILLA = readFileSync(raiz('../../assets/plantilla-taller.xlsx'))

/** Construye un ContenidoLibro a partir del CSV del mini-caso. */
function contenidoDesdeCsv(): ContenidoLibro {
  const { apuntes, plataformas } = importarCsvGenerico(CSV)
  const ubicaciones: Ubicacion[] = plataformas.map((nombre) => ({
    id: nombre,
    nombre,
    tipo: nombre === 'Ledger' ? 'wallet' : 'exchange',
    kyc: nombre !== 'Ledger',
    fechaAlta: '2024-01-01T00:00:00',
  }))
  const activos = activosDescubiertos(apuntes.flatMap(simbolosDeApunte))
  return { apuntes, ubicaciones, activos, tolerancias: { verde: 1e-8, ambar: 1e-3 } }
}

/** Comprueba que los saldos de la base reproducen el golden a 31/12/2024. */
async function saldosReproducenGolden(): Promise<void> {
  const apuntes = await listarApuntes()
  const totales = saldosTotalesPorActivo(apuntes, CORTE_2024)
  for (const [activo, esperado] of Object.entries(SALDOS_TOTALES_ESPERADOS)) {
    expect(D(totales.get(activo) ?? '0').equals(D(esperado)), `${activo}`).toBe(true)
  }
  expect(calcularSaldos(apuntes, CORTE_2024).some((c) => c.negativo)).toBe(false)
}

beforeEach(async () => {
  await Promise.all([
    db.apuntes.clear(),
    db.ubicaciones.clear(),
    db.activos.clear(),
    db.justificantes.clear(),
    db.parametros.clear(),
  ])
  await sembrarSiVacia()
})

describe('import CSV → base → SALDOS golden (P4.1 end-to-end)', () => {
  it('reemplazar con el CSV reproduce los saldos y da de alta los activos', async () => {
    await reemplazarContenido(contenidoDesdeCsv())
    await saldosReproducenGolden()

    const activos = (await listarActivos()).map((a) => a.simbolo)
    // BTC y EUR de serie + los descubiertos.
    expect(new Set(activos)).toEqual(new Set(['BTC', 'EUR', 'ETH', 'ADA', 'USDC', 'TOKENX']))
  })
})

describe('ciclo XLSX export → borrar todo → import (P4.2 end-to-end)', () => {
  it('tras exportar, borrar y reimportar, los saldos siguen cuadrando con el golden', async () => {
    await reemplazarContenido(contenidoDesdeCsv())
    const contenido = await exportarContenidoActual()

    const { archivos, avisos } = await exportarXlsx(contenido, PLANTILLA)
    expect(avisos).toEqual([])

    await borrarTodo()
    expect(await db.apuntes.count()).toBe(0)

    const reimportado = importarXlsx(archivos[0]!.bytes)
    await reemplazarContenido(reimportado)
    await saldosReproducenGolden()
  })
})

describe('copia JSON nativa a través de la base (P4.4)', () => {
  it('snapshot → JSON → restaurar conserva apuntes y saldos reales del cuadre', async () => {
    await reemplazarContenido(contenidoDesdeCsv())
    // Declara un saldo real del cuadre y guárdalo (vía restaurar, que lo persiste).
    const snap0 = await snapshotActual()
    const conCuadre = { ...snap0, cuadreReal: [{ ubicacion: 'Kraken', activo: 'BTC', saldoReal: '0.1098' }] }
    const texto = exportarJson(conCuadre)

    await borrarTodo()
    await restaurarSnapshot(parsearSnapshot(texto))

    const apuntes = await listarApuntes()
    expect(apuntes).toHaveLength(19)
    await saldosReproducenGolden()

    const snap1 = await snapshotActual()
    expect(snap1.cuadreReal).toEqual([{ ubicacion: 'Kraken', activo: 'BTC', saldoReal: '0.1098' }])
  })
})

describe('copia JSON con Archivo (P5) → restaura justificantes y su fichero', () => {
  // Nota: la persistencia de los BYTES del fichero embebido (base64) y su SHA-256 se
  // verifican en el navegador (fake-indexeddb + jsdom no conserva los bytes de un Blob).
  // Aquí se cubre que el Archivo se exporta, se restaura y su ENLACE al apunte sobrevive.
  it('el export JSON incluye el Archivo y lo restaura enlazado al apunte correcto', async () => {
    await reemplazarContenido(contenidoDesdeCsv())
    const registros = await listarRegistros()
    const primero = registros[0]!
    await crearJustificante({
      apunteUid: primero.uid,
      rutaConvencional: '01-adquisiciones',
      tipoDocumento: 'orden-ejecucion',
      hashSHA256: 'b'.repeat(64),
      referenciaExterna: 'Carpeta local del alumno',
    })

    const texto = exportarJson(await snapshotActual())
    await borrarTodo()
    expect(await listarJustificantes()).toHaveLength(0)

    await restaurarSnapshot(parsearSnapshot(texto))
    await saldosReproducenGolden()

    const registros2 = await listarRegistros()
    const justificantes = await listarJustificantes()
    expect(justificantes).toHaveLength(1)
    const j = justificantes[0]!
    expect(j.hashSHA256).toBe('b'.repeat(64))
    expect(j.referenciaExterna).toBe('Carpeta local del alumno')

    // El enlace apunta al apunte con el correlativo esperado (preservado en la restauración).
    const dominio = justificantesADominio(justificantes, registros2)
    const apunteDelJustificante = registros2.find((r) => r.uid === j.apunteUid)!
    expect(dominio[0]!.apunteId).toBe(apunteDelJustificante.id)
  })
})

describe('borrado total (P4.4)', () => {
  it('vacía el Libro y resiembra solo BTC/EUR y las tolerancias por defecto', async () => {
    await reemplazarContenido(contenidoDesdeCsv())
    await borrarTodo()

    expect(await db.apuntes.count()).toBe(0)
    expect(await db.ubicaciones.count()).toBe(0)
    expect(new Set((await listarActivos()).map((a) => a.simbolo))).toEqual(new Set(['BTC', 'EUR']))
    const p = await db.parametros.get('unico')
    expect(p?.toleranciaVerde).toBe(1e-8)
    expect(p?.toleranciaAmbar).toBe(1e-3)
  })
})
