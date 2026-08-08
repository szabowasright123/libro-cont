// @vitest-environment jsdom
/**
 * casoDemo.test.ts — carga y borrado del CASO DE EJEMPLO (mini-caso 2024, P9.3) sobre
 * IndexedDB (fake-indexeddb). Comprueba que la demo reproduce los saldos del golden, que se
 * marca como cargada con sus precios manuales, que su borrado deja el Libro vacío y que cargar
 * dos veces NO duplica.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  cargarCasoDemo,
  borrarCasoDemo,
  estaDemoCargada,
  listarApuntes,
  listarPrecios,
} from './repositorio'
import { saldosTotalesPorActivo } from '../engine/saldos'
import { D } from '../engine/decimal'

/** Saldos totales esperados a fin del mini-caso (golden intocable, Regla de oro 9). */
const SALDOS_ESPERADOS: Record<string, string> = {
  BTC: '0.4068',
  ETH: '1.049',
  USDC: '305',
  EUR: '4254',
}

beforeEach(async () => {
  await borrarCasoDemo() // deja el Libro vacío antes de cada caso
})

describe('cargarCasoDemo', () => {
  it('reproduce los saldos del golden y marca la demo con sus precios manuales', async () => {
    await cargarCasoDemo()

    const apuntes = await listarApuntes()
    expect(apuntes).toHaveLength(19)

    const saldos = saldosTotalesPorActivo(apuntes)
    for (const [activo, esperado] of Object.entries(SALDOS_ESPERADOS)) {
      expect(D(saldos.get(activo) ?? '0').equals(D(esperado))).toBe(true)
    }
    // ADA y TOKENX quedan a cero.
    expect(D(saldos.get('ADA') ?? '0').isZero()).toBe(true)
    expect(D(saldos.get('TOKENX') ?? '0').isZero()).toBe(true)

    expect(await estaDemoCargada()).toBe(true)

    const precios = await listarPrecios()
    const porActivo = new Map(precios.map((p) => [p.activo, p.precioEur]))
    expect(porActivo.get('BTC')).toBe('100000')
    expect(porActivo.get('ETH')).toBe('3000')
    expect(porActivo.get('USDC')).toBe('0.92')
  })

  it('cargar dos veces NO duplica (siempre reemplaza)', async () => {
    await cargarCasoDemo()
    await cargarCasoDemo()
    expect(await listarApuntes()).toHaveLength(19)
    expect(await db.precios.count()).toBe(3)
  })
})

describe('borrarCasoDemo', () => {
  it('deja el Libro vacío y quita la marca de demo', async () => {
    await cargarCasoDemo()
    await borrarCasoDemo()

    expect(await listarApuntes()).toHaveLength(0)
    expect(await db.ubicaciones.count()).toBe(0)
    expect(await db.precios.count()).toBe(0)
    expect(await estaDemoCargada()).toBe(false)
    // Los activos de serie (BTC/EUR) se conservan tras el borrado total.
    const activos = (await db.activos.toArray()).map((a) => a.simbolo).sort()
    expect(activos).toEqual(['BTC', 'EUR'])
  })
})
