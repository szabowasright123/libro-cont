/**
 * permuta-37-1-h.test.ts — art. 37.1.h) LIRPF: la permuta se cuantifica por el MAYOR
 * entre el valor de mercado de lo entregado y el de lo recibido, y ese importe es también
 * el coste del lote que nace. Referencia: [MT] U6.4 y el ejemplo de María.
 */
import { describe, it, expect } from 'vitest'
import type { Apunte } from './types'
import { valorPermutaEUR, calcularFifo, transmisionesDelDiario } from './fifo'
import { validarApunte } from './validaciones'

const A = (a: Partial<Apunte>): Apunte =>
  ({ ubicacionOrigen: 'ex', ubicacionDestino: 'ex', ...a }) as Apunte

const permutaBase = (extra: Partial<Apunte> = {}): Apunte =>
  A({
    id: '2026-005',
    fechaHora: '2026-06-05T10:00:00',
    tipo: 'PERMUTA',
    activoSalida: 'BTC',
    cantidadSalida: '0.01000000',
    activoEntrada: 'USDC',
    cantidadEntrada: '940',
    ...extra,
  })

describe('valorPermutaEUR · art. 37.1.h) LIRPF', () => {
  it('toma el MAYOR cuando lo entregado vale más que lo recibido', () => {
    const ap = permutaBase({
      valorMercadoEntregadoEUR: '875.00',
      valorMercadoRecibidoEUR: '870.00',
      contravalorEUR: '875.00',
    })
    expect(valorPermutaEUR(ap).toString()).toBe('875')
  })

  it('toma el MAYOR cuando lo recibido vale más que lo entregado', () => {
    const ap = permutaBase({
      valorMercadoEntregadoEUR: '860.00',
      valorMercadoRecibidoEUR: '870.00',
      contravalorEUR: '870.00',
    })
    expect(valorPermutaEUR(ap).toString()).toBe('870')
  })

  it('es RETROCOMPATIBLE: sin los dos valores usa el contravalor tal cual', () => {
    const ap = permutaBase({ contravalorEUR: '870.00' })
    expect(valorPermutaEUR(ap).toString()).toBe('870')
  })

  it('no altera los tipos distintos de PERMUTA', () => {
    const venta = A({
      id: '2026-006',
      fechaHora: '2026-09-22T10:00:00',
      tipo: 'VENTA',
      activoSalida: 'BTC',
      cantidadSalida: '0.05',
      activoEntrada: 'EUR',
      cantidadEntrada: '4600',
      contravalorEUR: '4600.00',
      valorMercadoEntregadoEUR: '9999.00', // se ignora fuera de la permuta
    })
    expect(valorPermutaEUR(venta).toString()).toBe('4600')
  })
})

describe('El ejemplo de María ([MT] U6.4): la regla cambia la ganancia y el coste del lote', () => {
  const diario: Apunte[] = [
    A({
      id: '2026-001', fechaHora: '2026-01-12T10:00:00', tipo: 'COMPRA',
      ubicacionOrigen: 'EXTERIOR', ubicacionDestino: 'wallet-p2p',
      activoSalida: 'EUR', cantidadSalida: '4000',
      activoEntrada: 'BTC', cantidadEntrada: '0.05000000', contravalorEUR: '4000.00',
    }),
    permutaBase({
      valorMercadoEntregadoEUR: '875.00',
      valorMercadoRecibidoEUR: '870.00',
      contravalorEUR: '875.00',
    }),
  ]

  it('la ganancia es 75,00 € (875 − 800), no 70,00 €', () => {
    const t = transmisionesDelDiario(diario)
    expect(t).toHaveLength(1)
    expect(t[0]?.costeFifoEUR).toBe('800')
    expect(t[0]?.resultadoEUR).toBe('75')
  })

  it('el lote de USDC nace por ese mismo importe: 875,00 €', () => {
    const colas = calcularFifo(diario)
    const usdc = colas.get('USDC')
    expect(usdc?.resumen.lotesAbiertos).toHaveLength(1)
    expect(usdc?.resumen.lotesAbiertos[0]?.costeTotalEUR).toBe('875')
  })
})

describe('Validaciones de la permuta', () => {
  it('avisa (sin bloquear) cuando solo se declara uno de los dos valores', () => {
    const avisos = validarApunte(permutaBase({ contravalorEUR: '870.00' }))
    const a = avisos.find((x) => x.codigo === 'PERMUTA_UN_SOLO_VALOR')
    expect(a).toBeDefined()
    expect(a?.nivel).toBe('aviso')
  })

  it('avisa cuando el contravalor declarado no es el mayor de los dos', () => {
    const avisos = validarApunte(
      permutaBase({
        valorMercadoEntregadoEUR: '875.00',
        valorMercadoRecibidoEUR: '870.00',
        contravalorEUR: '870.00', // el alumno tecleó lo recibido
      }),
    )
    expect(avisos.map((x) => x.codigo)).toContain('PERMUTA_CONTRAVALOR_NO_ES_EL_MAYOR')
  })

  it('no avisa cuando los dos valores están y el contravalor es el mayor', () => {
    const avisos = validarApunte(
      permutaBase({
        valorMercadoEntregadoEUR: '875.00',
        valorMercadoRecibidoEUR: '870.00',
        contravalorEUR: '875.00',
      }),
    )
    expect(avisos.map((x) => x.codigo)).not.toContain('PERMUTA_UN_SOLO_VALOR')
    expect(avisos.map((x) => x.codigo)).not.toContain('PERMUTA_CONTRAVALOR_NO_ES_EL_MAYOR')
  })
})
