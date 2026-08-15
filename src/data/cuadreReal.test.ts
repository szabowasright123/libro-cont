// @vitest-environment jsdom
/**
 * cuadreReal.test.ts — persistencia del CUADRE (saldos reales declarados) y de la marca de
 * copia de seguridad (P11) sobre IndexedDB (fake-indexeddb). El semáforo en sí es del motor
 * (engine/cuadre.test.ts); aquí se prueba el repositorio: alta, edición, borrado con cadena
 * vacía y convivencia con las tolerancias del singleton de parámetros.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  borrarTodo,
  guardarSaldoRealDeclarado,
  obtenerCuadreReal,
  obtenerTolerancias,
  registrarCopiaRealizada,
  estadoCopia,
} from './repositorio'

beforeEach(async () => {
  await borrarTodo()
})

describe('guardarSaldoRealDeclarado', () => {
  it('declara, actualiza (upsert) y borra con cadena vacía', async () => {
    await guardarSaldoRealDeclarado('Kraken', 'BTC', '0.5')
    await guardarSaldoRealDeclarado('Ledger', 'BTC', '0.25', 'Leído en el dispositivo.')
    let real = await obtenerCuadreReal()
    expect(real).toHaveLength(2)

    // Upsert: re-declarar la misma celda no duplica, actualiza.
    await guardarSaldoRealDeclarado('Kraken', 'BTC', '0.51')
    real = await obtenerCuadreReal()
    expect(real).toHaveLength(2)
    expect(real.find((c) => c.ubicacion === 'Kraken' && c.activo === 'BTC')?.saldoReal).toBe('0.51')
    expect(real.find((c) => c.ubicacion === 'Ledger')?.notas).toBe('Leído en el dispositivo.')

    // Cadena vacía = quitar la declaración de esa celda (y solo de esa).
    await guardarSaldoRealDeclarado('Kraken', 'BTC', '')
    real = await obtenerCuadreReal()
    expect(real).toHaveLength(1)
    expect(real[0]?.ubicacion).toBe('Ledger')
  })

  it('no pisa las tolerancias del singleton de parámetros', async () => {
    await guardarSaldoRealDeclarado('Kraken', 'EUR', '1000')
    const tol = await obtenerTolerancias()
    expect(tol.verde).toBe(1e-8)
    expect(tol.ambar).toBe(1e-3)
  })
})

describe('marca de copia de seguridad', () => {
  it('sin copia previa no hay marca; registrar la fija y se puede releer', async () => {
    expect(await estadoCopia()).toEqual({})
    await registrarCopiaRealizada('2026-08-15T10:00:00', 29)
    expect(await estadoCopia()).toEqual({
      ultimaCopiaEn: '2026-08-15T10:00:00',
      apuntesEnUltimaCopia: 29,
    })
    // Y convive con lo demás del singleton (p. ej. declarar cuadre después).
    await guardarSaldoRealDeclarado('Kraken', 'BTC', '0.1')
    expect((await estadoCopia()).ultimaCopiaEn).toBe('2026-08-15T10:00:00')
    expect(await obtenerCuadreReal()).toHaveLength(1)
  })
})
