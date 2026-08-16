/**
 * formato.test.ts — presentación es-ES (coma decimal, miles, fechas dd/mm/aaaa).
 */
import { describe, it, expect } from 'vitest'
import {
  fmtDecimal,
  fmtEuro,
  fmtFechaHora,
  fmtFecha,
  fmtBytes,
  parseDecimalEntrada,
  redondearCadena,
} from './formato'

describe('fmtDecimal', () => {
  it('usa coma decimal y punto de miles', () => {
    expect(fmtDecimal('4254')).toBe('4.254')
    expect(fmtDecimal('1234567.89')).toBe('1.234.567,89')
    expect(fmtDecimal('0.5')).toBe('0,5')
    expect(fmtDecimal('0.40680000')).toBe('0,40680000')
  })
  it('respeta el signo negativo con menos tipográfico', () => {
    expect(fmtDecimal('-200.3')).toBe('−200,3')
  })
  it('vacío o nulo → raya', () => {
    expect(fmtDecimal('')).toBe('—')
    expect(fmtDecimal(undefined)).toBe('—')
  })
})

describe('fmtEuro', () => {
  it('añade el símbolo €', () => {
    expect(fmtEuro('4254')).toBe('4.254 €')
    expect(fmtEuro('')).toBe('—')
  })
})

describe('fmtFechaHora / fmtFecha', () => {
  it('ISO local → dd/mm/aaaa hh:mm', () => {
    expect(fmtFechaHora('2024-01-16T10:00:00')).toBe('16/01/2024 10:00')
  })
  it('acepta datetime-local sin segundos', () => {
    expect(fmtFechaHora('2024-03-20T14:30')).toBe('20/03/2024 14:30')
  })
  it('solo fecha', () => {
    expect(fmtFecha('2024-12-31T23:59:59')).toBe('31/12/2024')
  })
})

describe('fmtBytes', () => {
  it('bytes sin decimales', () => {
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(512)).toBe('512 B')
  })
  it('KB y MB con un decimal y coma es-ES', () => {
    expect(fmtBytes(1024)).toBe('1 KB')
    expect(fmtBytes(1536)).toBe('1,5 KB')
    expect(fmtBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
  it('nulos/negativos → 0 B', () => {
    expect(fmtBytes(undefined)).toBe('0 B')
    expect(fmtBytes(-3)).toBe('0 B')
  })
})

describe('parseDecimalEntrada', () => {
  it('coma decimal es-ES → punto interno, quita miles', () => {
    expect(parseDecimalEntrada('1.234,5')).toBe('1234.5')
    expect(parseDecimalEntrada('0,5')).toBe('0.5')
  })
  it('deja el punto como decimal si no hay coma', () => {
    expect(parseDecimalEntrada('0.5')).toBe('0.5')
  })
  it('vacío → vacío', () => {
    expect(parseDecimalEntrada('  ')).toBe('')
  })
})

describe('redondeo de presentación (D0: el prorrateo produce periódicos)', () => {
  it('recorta a dos decimales redondeando al más cercano', () => {
    expect(redondearCadena('29411.640952380952380952', 2)).toBe('29411.64')
    expect(redondearCadena('2350.759047619047619', 2)).toBe('2350.76')
    expect(redondearCadena('0.005', 2)).toBe('0.01')
    expect(redondearCadena('-2.345', 2)).toBe('-2.35')
  })

  it('propaga el acarreo hasta crear una cifra nueva', () => {
    expect(redondearCadena('9.999', 2)).toBe('10.00')
    expect(redondearCadena('0.999', 2)).toBe('1.00')
  })

  it('no toca lo que ya cabe', () => {
    expect(redondearCadena('4254.00', 2)).toBe('4254.00')
    expect(redondearCadena('100', 2)).toBe('100')
  })

  it('fmtEuro muestra euros, no una tira de dígitos', () => {
    expect(fmtEuro('29411.640952380952380952')).toBe('29.411,64 €')
    expect(fmtEuro('4522.859047619047619')).toBe('4.522,86 €')
  })
})
