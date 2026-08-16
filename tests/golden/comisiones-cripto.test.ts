/**
 * comisiones-cripto.test.ts — GOLDEN de la fase D0 (Regla de oro 9).
 *
 * Criterio del autor de 16-08-2026 (docs/DEFI_EVENTOS_COMPLEJOS.md §8): el pago de una
 * comisión en cripto NO es una transmisión, pero SÍ reduce la cola, y el coste retirado
 * —no el contravalor en euros del gas— se traslada a la operación servida.
 *
 * La reducción se reparte PRORRATEADA entre todos los lotes vivos, no en orden FIFO: si el
 * gas no es transmisión fiscal, tampoco puede serlo «de las unidades más antiguas». Así la
 * estructura de antigüedad de la cola queda intacta para las transmisiones posteriores.
 *
 * El invariante que estos tests protegen es el que justifica toda la fase: el restante
 * de la cola FIFO debe COINCIDIR con el saldo real de cada activo. Antes de D0 divergían
 * en el importe de las comisiones pagadas en cripto, y esa divergencia crecía con cada
 * operación en cadena hasta hacer inexacto el CUADRE.
 */

import { describe, it, expect } from 'vitest'
import { calcularFifo, transmisionesDelDiario } from '../../src/engine/fifo'
import { saldosTotalesPorActivo } from '../../src/engine/saldos'
import { D } from '../../src/engine/decimal'
import type { Apunte } from '../../src/engine/types'
import { APUNTES_MINICASO, CORTE_2024 } from './mini-caso'

const eq = (a: string, b: string) => D(a).equals(D(b))
/** Tolerancia para las cifras que el prorrateo vuelve periódicas (ver golden/fifo). */
const casi = (a: string, b: string) => D(a).minus(D(b)).abs().lessThan('1e-9')

describe('GOLDEN · D0 · el restante FIFO coincide con el saldo real (mini-caso 2024)', () => {
  const fifo = calcularFifo(APUNTES_MINICASO)
  const saldos = saldosTotalesPorActivo(APUNTES_MINICASO, CORTE_2024)

  for (const activo of ['BTC', 'ETH', 'USDC', 'ADA', 'TOKENX']) {
    it(`${activo}: restante FIFO = saldo`, () => {
      const restante = fifo.get(activo)?.resumen.restanteTotal ?? '0'
      const saldo = saldos.get(activo) ?? '0'
      expect(eq(restante, saldo), `${activo}: FIFO ${restante} vs saldo ${saldo}`).toBe(true)
    })
  }
})

describe('GOLDEN · D0 · la comisión en cripto consume cola sin ser transmisión', () => {
  const fifo = calcularFifo(APUNTES_MINICASO)

  it('la comisión de red de la TRANSFERENCIA 2024-007 consume 0,0002 BTC', () => {
    // TRANSFERENCIA no transmite: el consumo existe solo para que la cola no diverja.
    expect(eq(fifo.get('BTC')!.resumen.consumidoTotal, '0.1652')).toBe(true)
  })

  it('pero NO genera ninguna transmisión declarable', () => {
    const deTransferencia = transmisionesDelDiario(APUNTES_MINICASO).filter(
      (t) => t.apunteId === '2024-007',
    )
    expect(deTransferencia).toHaveLength(0)
  })

  it('su coste no es deducible: se pierde, no minora ninguna operación', () => {
    // 17.730,10 (coste restante antes de D0) menos el coste prorrateado de 0,0002 BTC
    // entre los lotes vivos. El manual U4.3 excluye la deducción de la comisión de un
    // traslado entre ubicaciones propias: ese coste no reaparece en ningún otro sitio.
    expect(casi(fifo.get('BTC')!.resumen.costeRestanteEUR, '17721.7254545454545')).toBe(true)
  })
})

describe('GOLDEN · D0 · comisión en un activo DISTINTO al de la operación', () => {
  // Es el caso que obligó a recorrer todas las colas en una sola pasada cronológica:
  // el coste de la comisión en ETH depende del estado de la cola de ETH en ese instante.
  const diario: Apunte[] = [
    {
      id: '2026-001',
      fechaHora: '2026-01-01T10:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'ex',
      ubicacionDestino: 'ex',
      activoSalida: 'EUR',
      cantidadSalida: '1000',
      activoEntrada: 'ETH',
      cantidadEntrada: '1',
      contravalorEUR: '1000',
    },
    {
      id: '2026-002',
      fechaHora: '2026-02-01T10:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'ex',
      ubicacionDestino: 'ex',
      activoSalida: 'EUR',
      cantidadSalida: '20000',
      activoEntrada: 'BTC',
      cantidadEntrada: '0.5',
      contravalorEUR: '20000',
    },
    {
      // Venta de BTC pagando el gas en ETH: 0,1 ETH con coste FIFO 100 €.
      id: '2026-003',
      fechaHora: '2026-03-01T10:00:00',
      tipo: 'VENTA',
      ubicacionOrigen: 'ex',
      ubicacionDestino: 'ex',
      activoSalida: 'BTC',
      cantidadSalida: '0.25',
      activoEntrada: 'EUR',
      cantidadEntrada: '15000',
      comisionCantidad: '0.1',
      comisionActivo: 'ETH',
      contravalorEUR: '15000',
    },
  ]

  const fifo = calcularFifo(diario)
  const venta = transmisionesDelDiario(diario).find((t) => t.apunteId === '2026-003')!

  it('el valor de transmisión se minora por el COSTE FIFO del gas (100 €), no por su valor de mercado', () => {
    expect(eq(venta.valorTransmisionNetoEUR, '14900')).toBe(true)
  })

  it('la GyP resultante es 14.900 − 10.000 = 4.900 €', () => {
    expect(eq(venta.costeFifoEUR, '10000')).toBe(true) // 0,25 × 40.000 €/BTC
    expect(eq(venta.resultadoEUR, '4900')).toBe(true)
  })

  it('la cola de ETH se reduce en el gas aunque el ETH no fuera el activo de la operación', () => {
    const eth = fifo.get('ETH')!.resumen
    expect(eq(eth.restanteTotal, '0.9')).toBe(true)
    expect(eq(eth.costeRestanteEUR, '900')).toBe(true)
  })

  it('el gas en ETH no genera transmisión propia: solo hay una operación declarable', () => {
    expect(transmisionesDelDiario(diario)).toHaveLength(1)
  })
})

describe('GOLDEN · D0 · comisión en cripto sobre una ADQUISICIÓN', () => {
  // Sin transmisión que minorar, el coste del gas SUMA al coste del lote adquirido.
  const diario: Apunte[] = [
    {
      id: '2026-001',
      fechaHora: '2026-01-01T10:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'ex',
      ubicacionDestino: 'ex',
      activoSalida: 'EUR',
      cantidadSalida: '1000',
      activoEntrada: 'ETH',
      cantidadEntrada: '1',
      contravalorEUR: '1000',
    },
    {
      id: '2026-002',
      fechaHora: '2026-02-01T10:00:00',
      tipo: 'AIRDROP',
      ubicacionOrigen: 'EXTERIOR',
      ubicacionDestino: 'ex',
      activoEntrada: 'TKN',
      cantidadEntrada: '100',
      comisionCantidad: '0.1',
      comisionActivo: 'ETH',
      contravalorEUR: '200',
    },
  ]

  const fifo = calcularFifo(diario)

  it('el lote de TKN cuesta 200 + 100 = 300 € (contravalor + coste FIFO del gas)', () => {
    expect(eq(fifo.get('TKN')!.resumen.costeRestanteEUR, '300')).toBe(true)
  })

  it('y la cola de ETH baja a 0,9 con coste 900 €', () => {
    expect(eq(fifo.get('ETH')!.resumen.restanteTotal, '0.9')).toBe(true)
    expect(eq(fifo.get('ETH')!.resumen.costeRestanteEUR, '900')).toBe(true)
  })
})
