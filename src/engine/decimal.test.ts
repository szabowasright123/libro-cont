/**
 * decimal.test.ts — utilidades de aritmética exacta.
 */

import { describe, it, expect } from 'vitest'
import { D, suma, aCadena, CERO, Decimal } from './decimal'

describe('decimal · helpers', () => {
  it('D() convierte cadenas, números y undefined/null/"" → 0', () => {
    expect(D('1.5').equals(new Decimal('1.5'))).toBe(true)
    expect(D(2).equals(new Decimal(2))).toBe(true)
    expect(D(undefined).equals(CERO)).toBe(true)
    expect(D(null).equals(CERO)).toBe(true)
    expect(D('').equals(CERO)).toBe(true)
    const d = new Decimal('3')
    expect(D(d)).toBe(d) // devuelve el mismo Decimal
  })

  it('suma() acumula valores heterogéneos con exactitud', () => {
    expect(suma('0.1', '0.2', 0.7, undefined).equals(D('1'))).toBe(true)
    expect(suma().equals(CERO)).toBe(true)
  })

  it('aCadena() serializa con y sin decimales fijos, sin notación exponencial', () => {
    expect(aCadena(D('0.40680000'))).toBe('0.4068')
    expect(aCadena(D('1'), 8)).toBe('1.00000000')
    expect(aCadena(D('0.00000001'))).toBe('0.00000001') // no exponencial
  })
})
