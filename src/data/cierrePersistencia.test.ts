// @vitest-environment jsdom
/**
 * cierrePersistencia.test.ts — el CIERRE del ejercicio viaja en la copia de seguridad.
 *
 * La razón de esta prueba, y de que el cierre viva en IndexedDB y no en `localStorage`, está
 * en el propio manual: «La memoria del ejercicio es la casilla que más rinde. […] es el
 * documento que un asesor, un heredero o el propio contribuyente dentro de cinco años leerá
 * antes que ninguna otra cosa» ([MT] Anexo D). Una memoria que no está en la copia es una
 * memoria que se pierde el día que el alumno cambia de ordenador, que es justo el día en que
 * hacía falta.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, sembrarSiVacia } from './db'
import {
  obtenerCierre,
  guardarCierre,
  listarCierres,
  snapshotActual,
  restaurarSnapshot,
  borrarTodo,
} from './repositorio'
import { construirSnapshot, parsearSnapshot, exportarJson } from './import/json-backup'
import type { CierreRegistro } from './tipos'

const CIERRE_2026: CierreRegistro = {
  ejercicio: 2026,
  marcas: {
    'memoria-ejercicio': { estado: 'cumplida' },
    'modelo-721': { estado: 'no-aplica', razon: 'El saldo conjunto a 31-12 no llega a 50.000 €.' },
  } as CierreRegistro['marcas'],
  memoria: {
    zonasGrises: 'El envoltorio ETH→WETH se ha tratado como permuta del art. 37.1.h.',
    reconstrucciones: 'Ninguna este ejercicio.',
    diferenciasConciliacion: 'Los datos fiscales no traían la permuta de marzo.',
    obligacionesInformativas: 'No procede el 721: cálculo archivado.',
  } as CierreRegistro['memoria'],
  tresColumnas: [],
  cotizaciones: {} as CierreRegistro['cotizaciones'],
}

beforeEach(async () => {
  await db.cierres.clear()
  await db.apuntes.clear()
  await db.ubicaciones.clear()
  await sembrarSiVacia()
})

describe('cierre del ejercicio · persistencia en el Libro', () => {
  it('se guarda, se relee y queda sellado con la hora', async () => {
    await guardarCierre(CIERRE_2026)
    const leido = await obtenerCierre(2026)
    expect(leido).toBeDefined()
    expect(leido!.memoria).toEqual(CIERRE_2026.memoria)
    // El sello lo pone el repositorio, en hora LOCAL y sin la Z de UTC.
    expect(leido!.actualizadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    expect(leido!.actualizadoEn).not.toContain('Z')
  })

  it('un año no pisa al otro', async () => {
    await guardarCierre(CIERRE_2026)
    await guardarCierre({ ...CIERRE_2026, ejercicio: 2025 })
    expect((await listarCierres()).map((c) => c.ejercicio)).toEqual([2025, 2026])
  })

  it('VIAJA en la copia JSON: exportar → borrar todo → restaurar lo devuelve intacto', async () => {
    await guardarCierre(CIERRE_2026)

    const snap = await snapshotActual()
    expect(snap.cierres).toHaveLength(1)

    // Ida y vuelta por el texto, que es lo que de verdad descarga el alumno.
    const texto = exportarJson(snap)
    expect(texto).toContain('El envoltorio ETH→WETH')
    const restaurado = parsearSnapshot(texto)

    await borrarTodo()
    expect(await obtenerCierre(2026)).toBeUndefined()

    await restaurarSnapshot(restaurado)
    const vuelto = await obtenerCierre(2026)
    expect(vuelto).toBeDefined()
    expect(vuelto!.memoria).toEqual(CIERRE_2026.memoria)
    expect(vuelto!.marcas).toEqual(CIERRE_2026.marcas)
  })

  it('una copia ANTIGUA (sin cierres) se restaura igual, sin romper nada', async () => {
    // Retrocompatibilidad: las copias anteriores a la v1.6.0 no traen el campo.
    const snap = construirSnapshot({
      apuntes: [],
      ubicaciones: [],
      activos: [],
      tolerancias: { verde: 1e-8, ambar: 1e-3 },
    })
    const sinCierres = { ...snap }
    delete (sinCierres as { cierres?: unknown }).cierres
    await restaurarSnapshot(parsearSnapshot(JSON.stringify(sinCierres)))
    expect(await listarCierres()).toEqual([])
  })
})
