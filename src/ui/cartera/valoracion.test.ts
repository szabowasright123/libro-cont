/**
 * valoracion.test.ts — capa pura de valoración de la Cartera (P9.2).
 *
 * Usa el corpus del mini-caso 2024 (tests/golden/mini-caso, la fuente canónica) con los
 * precios manuales de demostración (BTC 100.000 · ETH 3.000 · USDC 0,92) y comprueba:
 *   - valor total 48.361,60 € (BTC 40.680 + ETH 3.147 + USDC 280,60 + EUR 4.254);
 *   - coste FIFO restante cripto y plusvalía latente coherentes con los golden del FIFO;
 *   - EUR EXCLUIDO de la plusvalía latente;
 *   - sin precios, los valores quedan «—» (null) sin NaN.
 */
import { describe, it, expect } from 'vitest'
import { calcularCartera, gypRealizadaPorEjercicio } from './valoracion'
import { D } from '../../engine/decimal'
import {
  APUNTES_MINICASO,
  UBICACIONES_MINICASO,
} from '../../../tests/golden/mini-caso'

const eq = (a: string | null, b: string) => a !== null && D(a).equals(D(b))
/** Tolerancia para las cifras que el prorrateo del gas vuelve periódicas (D0). */
const casi = (a: string | null, b: string) =>
  a !== null && D(a).minus(D(b)).abs().lessThan('1e-9')
const esFiat = (a: string) => a === 'EUR'

const PRECIOS = { BTC: '100000', ETH: '3000', USDC: '0.92' }

describe('Cartera · valoración con precios manuales (mini-caso 2024)', () => {
  const r = calcularCartera(APUNTES_MINICASO, PRECIOS, esFiat)
  const pos = (activo: string) => r.posiciones.find((p) => p.activo === activo)

  it('incluye BTC, ETH, USDC y EUR; omite ADA y TOKENX (saldo y cola a cero)', () => {
    const activos = r.posiciones.map((p) => p.activo).sort()
    expect(activos).toEqual(['BTC', 'ETH', 'EUR', 'USDC'])
  })

  it('valor total = 48.361,60 €', () => {
    expect(eq(r.valorTotalEUR, '48361.60')).toBe(true)
  })

  it('valor por activo = saldo × precio (EUR = saldo)', () => {
    expect(eq(pos('BTC')!.valorEUR, '40680')).toBe(true) // 0,4068 × 100.000
    expect(eq(pos('ETH')!.valorEUR, '3147')).toBe(true) //  1,049 × 3.000
    expect(eq(pos('USDC')!.valorEUR, '280.60')).toBe(true) // 305 × 0,92
    expect(eq(pos('EUR')!.valorEUR, '4254')).toBe(true) //  saldo, sin precio
  })

  it('coste FIFO restante cripto total = 20.627,4845… € (BTC 17.721,7254… + ETH 2.350,7590… + USDC 555)', () => {
    expect(casi(r.costeRestanteCriptoEUR, '20627.4845021645')).toBe(true)
    expect(casi(pos('BTC')!.costeFifoRestanteEUR, '17721.7254545454545')).toBe(true)
    expect(eq(pos('USDC')!.costeFifoRestanteEUR, '555')).toBe(true)
    expect(pos('EUR')!.costeFifoRestanteEUR).toBeNull() // EUR/fiat: sin cola FIFO
  })

  it('plusvalía latente = valor cripto − coste cripto = 44.107,60 − 20.627,4845… = 23.480,1154… € (EUR excluido)', () => {
    expect(casi(r.plusvaliaLatenteEUR, '23480.1154978355')).toBe(true)
  })

  it('pesos coherentes y suma ≈ 100 %', () => {
    expect(pos('BTC')!.pesoPct).toBeCloseTo(84.12, 1)
    const suma = r.posiciones.reduce((acc, p) => acc + (p.pesoPct ?? 0), 0)
    expect(suma).toBeCloseTo(100, 6)
  })

  it('colores fijos por entidad', () => {
    expect(pos('BTC')!.color).toBe('#e8820c')
    expect(pos('ETH')!.color).toBe('#2a78d6')
    expect(pos('USDC')!.color).toBe('#1baf7a')
    expect(pos('EUR')!.color).toBe('#8a857e')
  })
})

describe('Cartera · sin precios manuales', () => {
  const r = calcularCartera(APUNTES_MINICASO, {}, esFiat)
  const pos = (activo: string) => r.posiciones.find((p) => p.activo === activo)

  it('la cripto queda «—» (null) sin NaN; EUR conserva su valor = saldo', () => {
    expect(pos('BTC')!.valorEUR).toBeNull()
    expect(pos('ETH')!.valorEUR).toBeNull()
    expect(pos('USDC')!.valorEUR).toBeNull()
    expect(eq(pos('EUR')!.valorEUR, '4254')).toBe(true)
    // Ningún peso es NaN.
    for (const p of r.posiciones) expect(Number.isNaN(p.pesoPct ?? 0)).toBe(false)
  })

  it('plusvalía latente = «—» (null) si no hay cripto con precio; el coste restante sigue disponible', () => {
    expect(r.plusvaliaLatenteEUR).toBeNull()
    expect(casi(r.costeRestanteCriptoEUR, '20627.4845021645')).toBe(true)
    expect(eq(r.valorTotalEUR, '4254')).toBe(true) // solo EUR
  })
})

describe('Cartera · GyP realizada por ejercicio', () => {
  it('2024 → neto del ahorro 4.723,1590… € (transmisiones onerosas, sin la PÉRDIDA)', () => {
    const gyp = gypRealizadaPorEjercicio(APUNTES_MINICASO, UBICACIONES_MINICASO, [])
    expect(gyp).toHaveLength(1)
    expect(gyp[0]!.ejercicio).toBe(2024)
    expect(casi(gyp[0]!.netoEUR, '4723.1590476190476')).toBe(true)
  })
})
