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
/**
 * Comparación con tolerancia. El prorrateo del gas (D0) introduce divisiones periódicas
 * —repartir 0,001 ETH entre 1,05 unidades no tiene representación decimal finita—, así que
 * estas cifras se contrastan con margen en lugar de con una cadena de cuarenta dígitos.
 * La tolerancia (1e-9 €) es tres órdenes de magnitud más fina que el céntimo.
 */
const casi = (a: string, b: string) => D(a).minus(D(b)).abs().lessThan('1e-9')
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

  it('BTC · resumen de cola: adquirido 0,572 · consumido 0,1652 · restante 0,4068 · coste restante 17.722,088', () => {
    const r = resumen('BTC')
    expect(eq(r.adquiridoTotal, '0.572')).toBe(true)
    // 0,165 transmitidos + 0,0002 de la comisión de red de la TRANSFERENCIA 2024-007,
    // que desde D0 también consume cola (docs/DEFI_EVENTOS_COMPLEJOS.md §8).
    expect(eq(r.consumidoTotal, '0.1652')).toBe(true)
    expect(eq(r.restanteTotal, '0.4068')).toBe(true)
    // 17.730,10 menos el coste PRORRATEADO de 0,0002 BTC entre los lotes vivos en esa
    // fecha (2024-002 a 40.060 €/BTC y 2024-006 a 60.000 €/BTC). Ese coste NO es
    // deducible: la comisión sirve a un traslado entre ubicaciones propias (manual U4.3),
    // así que se pierde en lugar de trasladarse a ninguna parte.
    expect(casi(r.costeRestanteEUR, '17721.7254545454545')).toBe(true)
  })

  it('BTC · el restante FIFO COINCIDE con el saldo físico (invariante de D0)', () => {
    // Antes de D0 el restante era 0,407 frente a un saldo real de 0,4068. Que ahora
    // coincidan es justamente lo que hace exacto el CUADRE.
    expect(eq(resumen('BTC').restanteTotal, '0.4068')).toBe(true)
  })

  // ── ETH ────────────────────────────────────────────────────────────────────
  // Cola ETH: Lote 2024-003 COMPRA 2 @2.203 · 2024-004 RENDIMIENTO 0,05 @3.000.
  it('2024-006 PERMUTA entrega 1 ETH · GyP = (3000 − 2,2409…) − 2203 = 794,7590…', () => {
    const x = t('ETH', '2024-006')
    // La comisión de 0,001 ETH minora el valor de transmisión por su coste PRORRATEADO,
    // no por su valor de mercado (D0, regla 3). El prorrateo se calcula DESPUÉS de
    // consumir el ETH transmitido: quedan 1,05 ETH vivos con coste 2.353 €, luego
    // 0,001 × 2.353 / 1,05 = 2,240952… €.
    expect(casi(x.valorTransmisionNetoEUR, '2997.7590476190476')).toBe(true)
    expect(eq(x.costeFifoEUR, '2203')).toBe(true) // 1 × 2.203
    expect(casi(x.resultadoEUR, '794.7590476190476')).toBe(true)
    // 1 ETH transmitido + 0,001 de comisión: la cola queda en 1,049, igual que el saldo.
    expect(eq(resumen('ETH').restanteTotal, '1.049')).toBe(true)
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
  it('total de GyP de todas las transmisiones 2024 = 4522,8590… (7 transmisiones)', () => {
    const todas = transmisionesDelDiario(APUNTES_MINICASO)
    expect(todas).toHaveLength(7)
    const total = todas.reduce((acc, x) => acc.plus(D(x.resultadoEUR)), D('0'))
    // 4.525,10 antes de D0; la diferencia de 2,2409… es el coste prorrateado de la
    // comisión en ETH de la permuta 2024-006, que ahora minora su valor de transmisión.
    expect(casi(total.toFixed(), '4522.8590476190476')).toBe(true)
    // Todas en el ejercicio 2024.
    expect(todas.every((x) => x.ejercicio === 2024)).toBe(true)
  })
})
