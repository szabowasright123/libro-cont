// @vitest-environment jsdom
/**
 * altaAditiva.test.ts — alta EN MODO AÑADIR de la importación desde exploradores
 * (ENCARGO, Parte 2): deduplicación por `[tx:…]` y renumeración al insertar en medio.
 *
 * La importación de XLSX/CSV/JSON REEMPLAZA el Libro; esta no puede, porque se está
 * sumando una cadena a un Libro que ya tiene otras.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, sembrarSiVacia } from './db'
import { agregarApuntes, crearApunte, listarApuntes, listarRegistros } from './repositorio'
import type { BorradorApunte } from './tipos'
import { marcaTx } from './import/triaje'

function importado(fechaHora: string, clave: string): BorradorApunte {
  return {
    fechaHora,
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: 'u1',
    ubicacionDestino: 'u2',
    activoSalida: 'BTC',
    cantidadSalida: '0.1',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.1',
    notas: `${marcaTx(clave)} · importado de explorador`,
  }
}

beforeEach(async () => {
  await db.apuntes.clear()
  await db.ubicaciones.clear()
  await sembrarSiVacia()
})

describe('alta aditiva', () => {
  it('añade sin borrar lo que ya había', async () => {
    await crearApunte({
      fechaHora: '2024-01-10T09:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'u1',
      ubicacionDestino: 'u1',
      activoSalida: 'EUR',
      cantidadSalida: '1000',
      activoEntrada: 'BTC',
      cantidadEntrada: '0.02',
      contravalorEUR: '1000',
    })
    const res = await agregarApuntes([
      importado('2024-02-01T10:00:00', '0xaaa#normal#0'),
      importado('2024-03-01T10:00:00', '0xbbb#normal#0'),
    ])
    expect(res.anadidos).toBe(2)
    expect(res.duplicados).toBe(0)
    expect(await db.apuntes.count()).toBe(3)
  })

  it('reimportar el mismo movimiento NO duplica (misma marca [tx:…])', async () => {
    await agregarApuntes([importado('2024-02-01T10:00:00', '0xaaa#normal#0')])
    const segunda = await agregarApuntes([
      importado('2024-02-01T10:00:00', '0xaaa#normal#0'),
      importado('2024-02-02T10:00:00', '0xccc#normal#0'),
    ])
    expect(segunda.duplicados).toBe(1)
    expect(segunda.anadidos).toBe(1)
    expect(await db.apuntes.count()).toBe(2)
  })

  it('deduplica también DENTRO del mismo lote (dos exportaciones solapadas)', async () => {
    const res = await agregarApuntes([
      importado('2024-02-01T10:00:00', '0xaaa#normal#0'),
      importado('2024-02-01T10:00:00', '0xaaa#normal#0'),
    ])
    expect(res.anadidos).toBe(1)
    expect(res.duplicados).toBe(1)
  })

  it('renumera al insertar en medio del orden cronológico, y avisa del cambio', async () => {
    await agregarApuntes([
      importado('2024-05-01T10:00:00', '0x1#normal#0'),
      importado('2024-06-01T10:00:00', '0x2#normal#0'),
    ])
    const antes = await listarApuntes()
    expect(antes.map((a) => a.id)).toEqual(['2024-001', '2024-002'])

    const res = await agregarApuntes([importado('2024-01-15T10:00:00', '0x0#normal#0')])
    expect(res.cambios.length).toBeGreaterThan(0)
    const despues = await listarApuntes()
    expect(despues.map((a) => a.id)).toEqual(['2024-001', '2024-002', '2024-003'])
    expect(despues[0]?.fechaHora).toBe('2024-01-15T10:00:00')
  })

  it('conserva el orden de llegada de las patas de una misma transacción', async () => {
    await agregarApuntes([
      importado('2024-02-01T10:00:00', '0xaaa#normal#0'),
      importado('2024-02-01T10:00:00', '0xaaa#erc20#0'),
    ])
    const registros = (await listarRegistros()).sort((a, b) => a.id.localeCompare(b.id))
    expect(registros[0]?.notas).toContain('0xaaa#normal#0')
    expect(registros[1]?.notas).toContain('0xaaa#erc20#0')
  })
})
