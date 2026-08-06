/**
 * fifo.test.ts — GyP FIFO del mini-caso (verificación cotejable con la plantilla).
 *
 * Los SALDOS son el golden intocable; estas GyP dependen además de los contravalores
 * (ver tabla PRECIOS/CONTRAVALORES en mini-caso.ts: parte «(CSV)» dura y parte
 * «(supuesto)» de precios de mercado 2024). Cada valor esperado va COMENTADO con los
 * lotes que consume, para cotejarlo a mano contra docs/COTEJO_F1.md y el Excel.
 *
 * Si se cambian los contravalores supuestos, actualícense estos esperados (y COTEJO_F1).
 */

import { describe, it, expect } from 'vitest'
import { calcularFifo, transmisionesDelDiario } from '../../src/engine/fifo'
import { D } from '../../src/engine/decimal'
import { APUNTES_MINICASO } from './mini-caso'

const fifo = calcularFifo(APUNTES_MINICASO)
const trans = (activo: string) => fifo.get(activo)!.transmisiones
const resumen = (activo: string) => fifo.get(activo)!.resumen

/** Localiza una transmisión por id de apunte dentro de un activo. */
function t(activo: string, apunteId: string) {
  const found = trans(activo).find((x) => x.apunteId === apunteId)
  if (!found) throw new Error(`sin transmisión ${apunteId} en ${activo}`)
  return found
}

/** Igualdad decimal exacta. */
const eq = (a: string, b: string) => D(a).equals(D(b))

describe('FIFO · GyP por transmisión (mini-caso 2024)', () => {
  // ── BTC ────────────────────────────────────────────────────────────────────
  // Cola BTC (orden): Lote A 2024-002 COMPRA 0,5 @40.060 · B 2024-006 PERMUTA 0,05 @60.000
  //                   · C 2024-012 MINERÍA 0,002 @55.000 · D 2024-014 COMPRA 0,02 @60.000.
  // Todas las ventas/permuta/pérdida caben en el Lote A (el más antiguo).
  it('2024-008 VENTA 0,1 BTC → consume 0,1 del Lote A · GyP = 6490 − 4006 = 2484', () => {
    const x = t('BTC', '2024-008')
    expect(eq(x.valorTransmisionNetoEUR, '6490')).toBe(true) // 6500 − 10 comisión EUR
    expect(eq(x.costeFifoEUR, '4006')).toBe(true) // 0,1 × 40.060
    expect(eq(x.resultadoEUR, '2484')).toBe(true)
    expect(x.consumos).toEqual([
      { loteApunteId: '2024-002', cantidadConsumida: '0.1', costeImputadoEUR: '4006' },
    ])
  })

  it('2024-015 PERMUTA entrega 0,01 BTC → consume 0,01 del Lote A · GyP = 550 − 400,6 = 149,4', () => {
    const x = t('BTC', '2024-015')
    expect(eq(x.valorTransmisionNetoEUR, '550')).toBe(true) // contravalor permuta
    expect(eq(x.costeFifoEUR, '400.6')).toBe(true) // 0,01 × 40.060
    expect(eq(x.resultadoEUR, '149.4')).toBe(true)
  })

  it('2024-017 PÉRDIDA 0,005 BTC → consume 0,005 del Lote A · GyP = 0 − 200,3 = −200,3', () => {
    const x = t('BTC', '2024-017')
    expect(eq(x.valorTransmisionNetoEUR, '0')).toBe(true)
    expect(eq(x.costeFifoEUR, '200.3')).toBe(true) // 0,005 × 40.060
    expect(eq(x.resultadoEUR, '-200.3')).toBe(true)
  })

  it('2024-019 VENTA 0,05 BTC → consume 0,05 del Lote A · GyP = 3200 − 2003 = 1197', () => {
    const x = t('BTC', '2024-019')
    expect(eq(x.valorTransmisionNetoEUR, '3200')).toBe(true)
    expect(eq(x.costeFifoEUR, '2003')).toBe(true) // 0,05 × 40.060
    expect(eq(x.resultadoEUR, '1197')).toBe(true)
  })

  it('BTC · resumen de cola: adquirido 0,572 · consumido 0,165 · restante 0,407 · coste restante 17.730,1', () => {
    const r = resumen('BTC')
    expect(eq(r.adquiridoTotal, '0.572')).toBe(true)
    expect(eq(r.consumidoTotal, '0.165')).toBe(true)
    expect(eq(r.restanteTotal, '0.407')).toBe(true)
    expect(eq(r.costeRestanteEUR, '17730.1')).toBe(true)
    // El restante FIFO (0,407) supera el saldo físico (0,4068) en 0,0002: la comisión
    // de red de la TRANSFERENCIA 2024-007, que sale del patrimonio pero no consume cola.
    expect(eq(r.restanteTotal, '0.4068')).toBe(false)
  })

  // ── ETH ────────────────────────────────────────────────────────────────────
  // Cola ETH: Lote 2024-003 COMPRA 2 @2.203 · 2024-004 RENDIMIENTO 0,05 @3.000.
  it('2024-006 PERMUTA entrega 1 ETH → consume 1 del lote 2024-003 · GyP = 3000 − 2203 = 797', () => {
    const x = t('ETH', '2024-006')
    expect(eq(x.valorTransmisionNetoEUR, '3000')).toBe(true)
    expect(eq(x.costeFifoEUR, '2203')).toBe(true) // 1 × 2.203
    expect(eq(x.resultadoEUR, '797')).toBe(true)
    // La comisión 0,001 ETH NO consume cola (permuta consume solo lo entregado).
    expect(eq(resumen('ETH').restanteTotal, '1.05')).toBe(true)
  })

  // ── ADA ────────────────────────────────────────────────────────────────────
  // Cola ADA: Lote 2024-009 COMPRA 500 @0,6 · 2024-010 RENDIMIENTO 5 @0,4.
  it('2024-013 VENTA 505 ADA → consume 500 (@0,6) + 5 (@0,4) · GyP = 350 − 302 = 48', () => {
    const x = t('ADA', '2024-013')
    expect(eq(x.valorTransmisionNetoEUR, '350')).toBe(true)
    expect(eq(x.costeFifoEUR, '302')).toBe(true) // 300 + 2
    expect(eq(x.resultadoEUR, '48')).toBe(true)
    expect(x.consumos).toEqual([
      { loteApunteId: '2024-009', cantidadConsumida: '500', costeImputadoEUR: '300' },
      { loteApunteId: '2024-010', cantidadConsumida: '5', costeImputadoEUR: '2' },
    ])
    expect(eq(resumen('ADA').restanteTotal, '0')).toBe(true)
  })

  // ── TOKENX ─────────────────────────────────────────────────────────────────
  it('2024-011 VENTA 100 TOKENX → consume el airdrop (coste 100) · GyP = 150 − 100 = 50', () => {
    const x = t('TOKENX', '2024-011')
    expect(eq(x.costeFifoEUR, '100')).toBe(true)
    expect(eq(x.resultadoEUR, '50')).toBe(true)
    expect(eq(resumen('TOKENX').restanteTotal, '0')).toBe(true)
  })

  // ── USDC ───────────────────────────────────────────────────────────────────
  it('USDC no tiene transmisiones; restante 305 con coste 555 (permuta 550 + interés 5)', () => {
    expect(trans('USDC')).toHaveLength(0)
    const r = resumen('USDC')
    expect(eq(r.restanteTotal, '305')).toBe(true)
    expect(eq(r.costeRestanteEUR, '555')).toBe(true)
  })

  // ── Totales ──────────────────────────────────────────────────────────────────
  it('total de GyP de todas las transmisiones 2024 = 4525,10 (7 transmisiones)', () => {
    const todas = transmisionesDelDiario(APUNTES_MINICASO)
    expect(todas).toHaveLength(7)
    const total = todas.reduce((acc, x) => acc.plus(D(x.resultadoEUR)), D('0'))
    expect(eq(total.toFixed(), '4525.1')).toBe(true)
    // Todas en el ejercicio 2024.
    expect(todas.every((x) => x.ejercicio === 2024)).toBe(true)
  })
})
