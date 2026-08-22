/**
 * movimientos.test.ts — el invariante del drill-down de SALDOS.
 *
 * `movimientosDeCelda` replica, movimiento a movimiento, las tres reglas de imputación de
 * `engine/saldos.ts`. Lo que ata las dos implementaciones es un invariante que se puede
 * comprobar: la ÚLTIMA fila del acumulado tiene que ser, cifra por cifra, el `saldo` que
 * devuelve `calcularSaldos` para esa misma celda. Si alguien toca una de las dos y no la otra,
 * este test lo caza — y con él caza la única forma que tiene el Panel de mentir: enseñar un
 * relato que no suma la cifra que hay encima.
 */
import { describe, it, expect } from 'vitest'
import type { Apunte } from '../../engine/types'
import { calcularSaldos } from '../../engine/saldos'
import { movimientosDeCelda } from './movimientos'
import { APUNTES_CASO_DEMO } from '../../data/demo/caso-demo'

const KRAKEN = 'u-kraken'
const LEDGER = 'u-ledger'

/** Diario mínimo con las tres reglas: entrada al destino, salida al origen, comisión al origen. */
const DIARIO: Apunte[] = [
  {
    id: '2024-001',
    fechaHora: '2024-01-15T10:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: 'EXTERIOR',
    ubicacionDestino: KRAKEN,
    activoEntrada: 'EUR',
    cantidadEntrada: '10000',
    contravalorEUR: '10000',
  },
  {
    id: '2024-002',
    fechaHora: '2024-01-16T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '5000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.1',
    comisionCantidad: '10',
    comisionActivo: 'EUR',
    contravalorEUR: '5000',
  },
  {
    id: '2024-003',
    fechaHora: '2024-02-01T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: LEDGER,
    activoSalida: 'BTC',
    cantidadSalida: '0.05',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.0498',
    comisionCantidad: '0.0002',
    comisionActivo: 'BTC',
  },
]

describe('movimientosDeCelda · las tres reglas de imputación', () => {
  it('desagrega salida y comisión del mismo apunte cuando ambas tocan la celda', () => {
    const movs = movimientosDeCelda(DIARIO, KRAKEN, 'BTC')
    // 2024-002 entra 0,1 BTC; 2024-003 sale 0,05 y la comisión de red se lleva 0,0002 más.
    expect(movs.map((m) => [m.apunteId, m.concepto])).toEqual([
      ['2024-002', 'entrada'],
      ['2024-003', 'salida'],
      ['2024-003', 'comision'],
    ])
    expect(movs.map((m) => m.aportacion)).toEqual(['0.1', '-0.05', '-0.0002'])
  })

  it('imputa la comisión al DESTINO cuando el origen es EXTERIOR', () => {
    const conComisionExterior: Apunte[] = [
      {
        ...(DIARIO[0] as Apunte),
        comisionCantidad: '3',
        comisionActivo: 'EUR',
      },
    ]
    const movs = movimientosDeCelda(conComisionExterior, KRAKEN, 'EUR')
    expect(movs.map((m) => m.concepto)).toEqual(['entrada', 'comision'])
    expect(movs[movs.length - 1]?.acumulado).toBe('9997')
  })

  it('EXTERIOR no tiene saldo propio: no devuelve movimientos', () => {
    expect(movimientosDeCelda(DIARIO, 'EXTERIOR', 'EUR')).toEqual([])
  })

  it('respeta la fecha de corte', () => {
    const movs = movimientosDeCelda(DIARIO, KRAKEN, 'BTC', '2024-01-31T23:59:59')
    expect(movs).toHaveLength(1)
    expect(movs[0]?.apunteId).toBe('2024-002')
  })
})

describe('movimientosDeCelda · invariante contra el motor', () => {
  /** El último acumulado de la celda debe ser el saldo que calcula el motor. */
  function comprobarInvariante(apuntes: Apunte[], corte?: string) {
    const saldos = calcularSaldos([...apuntes], corte)
    expect(saldos.length).toBeGreaterThan(0)
    for (const celda of saldos) {
      const movs = movimientosDeCelda(apuntes, celda.ubicacion, celda.activo, corte)
      const ultimo = movs[movs.length - 1]
      expect(
        ultimo?.acumulado ?? '0',
        `celda ${celda.ubicacion} × ${celda.activo}`,
      ).toBe(celda.saldo)
    }
  }

  it('cuadra en el diario mínimo', () => {
    comprobarInvariante(DIARIO)
  })

  it('cuadra en el caso de ejemplo completo (2024–2026)', () => {
    comprobarInvariante([...APUNTES_CASO_DEMO])
  })

  it('cuadra también con fecha de corte a 31/12/2024', () => {
    comprobarInvariante([...APUNTES_CASO_DEMO], '2024-12-31T23:59:59')
  })
})
