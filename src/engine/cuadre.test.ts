/**
 * cuadre.test.ts — semáforo del CUADRE (DOMINIO §4, hoja CUADRE).
 */

import { describe, it, expect } from 'vitest'
import { calcularCuadre, estadoSemaforo } from './cuadre'
import { calcularSaldos } from './saldos'
import { type SaldoCelda, TOLERANCIAS_POR_DEFECTO } from './types'
import { D } from './decimal'
import { APUNTES_MINICASO, CORTE_2024, KRAKEN, LEDGER } from '../../tests/golden/mini-caso'

describe('estadoSemaforo · tolerancias por defecto (verde 1e-8, ámbar 0,001)', () => {
  it('|dif| ≤ 1e-8 → OK', () => {
    expect(estadoSemaforo(D('0'), TOLERANCIAS_POR_DEFECTO)).toBe('OK')
    expect(estadoSemaforo(D('1e-9'), TOLERANCIAS_POR_DEFECTO)).toBe('OK')
    expect(estadoSemaforo(D('-1e-8'), TOLERANCIAS_POR_DEFECTO)).toBe('OK')
  })
  it('1e-8 < |dif| ≤ 0,001 → REVISAR', () => {
    expect(estadoSemaforo(D('0.0002'), TOLERANCIAS_POR_DEFECTO)).toBe('REVISAR')
    expect(estadoSemaforo(D('-0.001'), TOLERANCIAS_POR_DEFECTO)).toBe('REVISAR')
  })
  it('|dif| > 0,001 → ERROR', () => {
    expect(estadoSemaforo(D('0.0011'), TOLERANCIAS_POR_DEFECTO)).toBe('ERROR')
    expect(estadoSemaforo(D('-5'), TOLERANCIAS_POR_DEFECTO)).toBe('ERROR')
  })
})

describe('calcularCuadre · diferencia = saldoReal − saldoCalculado', () => {
  const saldos = calcularSaldos(APUNTES_MINICASO, CORTE_2024)

  it('cuadra en verde cuando el saldo real coincide con el calculado', () => {
    const filas = calcularCuadre(saldos, [
      { ubicacion: KRAKEN, activo: 'BTC', saldoReal: '0.1098' },
      { ubicacion: LEDGER, activo: 'BTC', saldoReal: '0.297' },
      { ubicacion: KRAKEN, activo: 'EUR', saldoReal: '4254' },
    ])
    expect(filas.every((f) => f.estado === 'OK')).toBe(true)
    expect(filas.every((f) => D(f.diferencia).equals(D('0')))).toBe(true)
  })

  it('detecta REVISAR con un descuadre de 0,0002 (comisión embebida)', () => {
    const filas = calcularCuadre(saldos, [{ ubicacion: LEDGER, activo: 'BTC', saldoReal: '0.2968' }])
    expect(filas[0]!.estado).toBe('REVISAR')
    expect(D(filas[0]!.diferencia).equals(D('-0.0002'))).toBe(true)
  })

  it('detecta ERROR con un descuadre grande y signo correcto (real − calculado)', () => {
    const filas = calcularCuadre(saldos, [{ ubicacion: KRAKEN, activo: 'EUR', saldoReal: '4000' }])
    expect(filas[0]!.estado).toBe('ERROR')
    expect(D(filas[0]!.diferencia).equals(D('-254'))).toBe(true) // 4000 − 4254
  })

  it('si no hay saldo calculado para la celda, se toma 0', () => {
    const vacio: SaldoCelda[] = []
    const filas = calcularCuadre(vacio, [{ ubicacion: 'Nueva', activo: 'BTC', saldoReal: '0' }])
    expect(filas[0]!.saldoCalculado).toBe('0')
    expect(filas[0]!.estado).toBe('OK')
  })

  it('respeta tolerancias configurables', () => {
    const filas = calcularCuadre(
      saldos,
      [{ ubicacion: KRAKEN, activo: 'EUR', saldoReal: '4254.5' }],
      { verde: 0, ambar: 1 },
    )
    expect(filas[0]!.estado).toBe('REVISAR') // dif 0,5 ≤ ámbar 1
  })
})
