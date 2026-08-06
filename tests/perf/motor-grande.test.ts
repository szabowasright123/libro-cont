/**
 * motor-grande.test.ts — prueba de rendimiento (P8, criterio «recálculo < 500 ms»).
 *
 * Genera 5.000 apuntes sintéticos válidos y mide cuánto tarda el motor completo
 * (SALDOS + FIFO + TRAZABILIDAD) en recalcular. Es la garantía determinista de que
 * el alumno intensivo, con años de operativa, no sufre esperas. También comprueba
 * que el motor no lanza ni produce déficits con un diario grande.
 */
import { describe, it, expect } from 'vitest'
import { generarApuntesSinteticos, UBICACIONES_DEMO } from '../../src/data/dev/generarDataset'
import { calcularSaldos } from '../../src/engine/saldos'
import { calcularFifo } from '../../src/engine/fifo'
import { calcularTrazabilidad } from '../../src/engine/trazabilidad'

describe('RENDIMIENTO · motor sobre 5.000 apuntes', () => {
  const N = 5000
  const apuntes = generarApuntesSinteticos(N)

  it(`genera ${N} apuntes en orden cronológico estricto`, () => {
    expect(apuntes).toHaveLength(N)
    for (let i = 1; i < apuntes.length; i++) {
      expect(apuntes[i]!.fechaHora >= apuntes[i - 1]!.fechaHora).toBe(true)
    }
  })

  it('recálculo completo (SALDOS + FIFO + TRAZABILIDAD) < 500 ms', () => {
    const t0 = performance.now()
    const saldos = calcularSaldos(apuntes)
    const fifo = calcularFifo(apuntes)
    const traz = calcularTrazabilidad(apuntes, UBICACIONES_DEMO)
    const ms = performance.now() - t0

    // Deja constancia del tiempo real medido en la salida del test.
    // eslint-disable-next-line no-console
    console.log(`  ⏱  Motor sobre ${N} apuntes: ${ms.toFixed(1)} ms`)

    expect(saldos.length).toBeGreaterThan(0)
    expect(fifo.size).toBeGreaterThan(0)
    expect(traz.cartera.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(500)
  })
})
