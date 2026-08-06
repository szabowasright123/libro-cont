// @vitest-environment jsdom
/**
 * repositorio.test.ts — integración del repositorio sobre IndexedDB (fake-indexeddb).
 *
 * Cubre la persistencia de la numeración/reordenación (incluido el caso que rompía
 * cuando el índice `id` era único: renumerar intercambia correlativos con un
 * bulkPut) y la integridad referencial (no borrar ubicación/activo con apuntes).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, sembrarSiVacia } from './db'
import {
  crearApunte,
  actualizarApunte,
  eliminarApunte,
  listarRegistros,
  listarApuntes,
  crearUbicacion,
  eliminarUbicacion,
  eliminarActivo,
  crearJustificante,
  justificantesDeApunte,
  listarJustificantes,
  espacioArchivoUsado,
  justificantesADominio,
} from './repositorio'
import type { BorradorApunte } from './tipos'

function compra(fechaHora: string): BorradorApunte {
  return {
    fechaHora,
    tipo: 'COMPRA',
    ubicacionOrigen: 'u1',
    ubicacionDestino: 'u1',
    activoSalida: 'EUR',
    cantidadSalida: '20000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.5',
    contravalorEUR: '20000',
  }
}

beforeEach(async () => {
  await db.apuntes.clear()
  await db.ubicaciones.clear()
  await db.justificantes.clear()
})

describe('crearApunte · numeración y reordenación', () => {
  it('numera en orden de creación cuando las fechas ya van ordenadas', async () => {
    await crearApunte(compra('2024-01-16T10:00:00'))
    await crearApunte(compra('2024-02-16T10:00:00'))
    const ids = (await listarRegistros()).map((r) => r.id)
    expect(ids).toEqual(['2024-001', '2024-002'])
  })

  it('inserta una fecha anterior y renumera (sin romper el índice)', async () => {
    const primero = await crearApunte(compra('2024-01-16T10:00:00'))
    // El único cambio es el correlativo del propio apunte recién creado.
    expect(primero.cambios.filter((c) => c.uid !== primero.uid)).toEqual([])

    const segundo = await crearApunte(compra('2024-01-15T09:00:00')) // ¡anterior!
    // El apunte previo (2024-001) pasa a 2024-002 (renumeración de OTRO apunte).
    expect(segundo.cambios.some((c) => c.idAnterior === '2024-001' && c.idNuevo === '2024-002')).toBe(true)

    const registros = await listarRegistros()
    expect(registros.map((r) => `${r.id}:${r.fechaHora.slice(0, 10)}`)).toEqual([
      '2024-001:2024-01-15',
      '2024-002:2024-01-16',
    ])
  })
})

describe('AJUSTE · la referencia por uid sobrevive a la renumeración', () => {
  it('rectificaAUid sigue apuntando al mismo apunte tras renumerar', async () => {
    const compraRes = await crearApunte(compra('2024-02-01T10:00:00'))
    // AJUSTE que rectifica la compra, con fecha posterior.
    await crearApunte({
      fechaHora: '2024-03-01T10:00:00',
      tipo: 'AJUSTE',
      ubicacionOrigen: 'u1',
      ubicacionDestino: 'u1',
      notas: 'Corrijo contravalor.',
      rectificaAUid: compraRes.uid,
    })
    // Inserta un apunte ANTERIOR a todo → renumera compra y ajuste.
    await crearApunte(compra('2024-01-01T09:00:00'))

    const dominio = await listarApuntes()
    const ajuste = dominio.find((a) => a.tipo === 'AJUSTE')!
    const compraActual = (await listarRegistros()).find((r) => r.uid === compraRes.uid)!
    // La referencia de dominio (correlativo) coincide con el correlativo ACTUAL de la compra.
    expect(ajuste.rectificaA).toBe(compraActual.id)
  })
})

describe('actualizar y eliminar', () => {
  it('mover la fecha de un apunte lo reordena', async () => {
    const a = await crearApunte(compra('2024-01-16T10:00:00'))
    await crearApunte(compra('2024-02-16T10:00:00'))
    await actualizarApunte(a.uid, { fechaHora: '2024-03-16T10:00:00' }) // pasa a ser el último
    const registros = await listarRegistros()
    const movido = registros.find((r) => r.uid === a.uid)!
    expect(movido.id).toBe('2024-002')
  })

  it('eliminar renumera el resto', async () => {
    const a = await crearApunte(compra('2024-01-16T10:00:00'))
    await crearApunte(compra('2024-02-16T10:00:00'))
    await eliminarApunte(a.uid)
    const ids = (await listarRegistros()).map((r) => r.id)
    expect(ids).toEqual(['2024-001'])
  })
})

describe('integridad referencial de ubicaciones', () => {
  it('no permite borrar una ubicación con apuntes', async () => {
    await crearUbicacion({ nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2024-01-01T00:00:00' })
    const ubics = await db.ubicaciones.toArray()
    const krakenId = ubics[0]!.id
    await crearApunte({ ...compra('2024-01-16T10:00:00'), ubicacionOrigen: krakenId, ubicacionDestino: krakenId })
    await expect(eliminarUbicacion(krakenId)).rejects.toThrow(/apunte/i)
  })
})

describe('integridad del catálogo de activos', () => {
  it('BTC y EUR de serie no se pueden borrar', async () => {
    await sembrarSiVacia()
    await expect(eliminarActivo('BTC')).rejects.toThrow(/de serie/i)
    await expect(eliminarActivo('EUR')).rejects.toThrow(/de serie/i)
  })
})

describe('Archivo · justificantes ligados por uid estable', () => {
  it('crea, lista por apunte y resuelve el correlativo de dominio', async () => {
    const c = await crearApunte(compra('2024-02-01T10:00:00'))
    await crearJustificante({
      apunteUid: c.uid,
      rutaConvencional: '01-adquisiciones',
      tipoDocumento: 'orden-ejecucion',
      hashSHA256: 'a'.repeat(64),
    })
    const propios = await justificantesDeApunte(c.uid)
    expect(propios).toHaveLength(1)

    const registros = await listarRegistros()
    const dominio = justificantesADominio(await listarJustificantes(), registros)
    expect(dominio[0]!.apunteId).toBe('2024-001')
  })

  it('el enlace sobrevive a la renumeración (como rectificaAUid)', async () => {
    const c = await crearApunte(compra('2024-02-01T10:00:00'))
    await crearJustificante({
      apunteUid: c.uid,
      rutaConvencional: '01-adquisiciones',
      tipoDocumento: 'orden-ejecucion',
    })
    // Inserta un apunte anterior → el correlativo de la compra pasa de 2024-001 a 2024-002.
    await crearApunte(compra('2024-01-01T09:00:00'))

    const registros = await listarRegistros()
    const compraActual = registros.find((r) => r.uid === c.uid)!
    expect(compraActual.id).toBe('2024-002')
    const dominio = justificantesADominio(await listarJustificantes(), registros)
    expect(dominio[0]!.apunteId).toBe('2024-002') // sigue apuntando a la compra
  })

  it('borrar el apunte borra en cascada sus justificantes', async () => {
    const c = await crearApunte(compra('2024-02-01T10:00:00'))
    await crearJustificante({
      apunteUid: c.uid,
      rutaConvencional: '01-adquisiciones',
      tipoDocumento: 'orden-ejecucion',
    })
    await eliminarApunte(c.uid)
    expect(await listarJustificantes()).toHaveLength(0)
  })

  it('espacio usado no cuenta las referencias externas (sin blob → 0 bytes)', async () => {
    // Nota: fake-indexeddb + jsdom no conserva los bytes de un Blob al almacenarlo, así
    // que el tamaño real de un fichero embebido se verifica en el navegador. Aquí se
    // comprueba que una referencia externa (sin blob) no ocupa espacio local.
    const c = await crearApunte(compra('2024-02-01T10:00:00'))
    await crearJustificante({
      apunteUid: c.uid,
      rutaConvencional: '99-otros',
      tipoDocumento: 'orden-ejecucion',
      referenciaExterna: 'Carpeta local del alumno',
    })
    expect(await espacioArchivoUsado()).toBe(0)
  })
})
