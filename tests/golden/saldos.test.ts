/**
 * saldos.test.ts — GOLDEN TESTS INTOCABLES (Regla de oro 9).
 *
 * Reproducen el mini-caso 2024 y comprueban los saldos finales a 31/12/2024 contra
 * los valores oficiales del taller. Si alguno falla, el motor de saldos está mal.
 */

import { describe, it, expect } from 'vitest'
import { calcularSaldos, saldosTotalesPorActivo } from '../../src/engine/saldos'
import { D } from '../../src/engine/decimal'
import {
  APUNTES_MINICASO,
  CORTE_2024,
  SALDOS_TOTALES_ESPERADOS,
  SALDOS_POR_UBICACION_ESPERADOS,
} from './mini-caso'

describe('GOLDEN · saldos totales a 31/12/2024 (mini-caso)', () => {
  const totales = saldosTotalesPorActivo(APUNTES_MINICASO, CORTE_2024)

  for (const [activo, esperado] of Object.entries(SALDOS_TOTALES_ESPERADOS)) {
    it(`${activo} = ${esperado}`, () => {
      const obtenido = totales.get(activo) ?? '0'
      expect(D(obtenido).equals(D(esperado)), `${activo}: obtenido ${obtenido}, esperado ${esperado}`).toBe(
        true,
      )
    })
  }

  it('no aparecen activos inesperados en los totales', () => {
    const activosCalculados = new Set([...totales.keys()])
    const activosEsperados = new Set(Object.keys(SALDOS_TOTALES_ESPERADOS))
    expect(activosCalculados).toEqual(activosEsperados)
  })
})

describe('GOLDEN · reparto por ubicación × activo a 31/12/2024', () => {
  const celdas = calcularSaldos(APUNTES_MINICASO, CORTE_2024)
  const porClave = new Map(celdas.map((c) => [`${c.ubicacion} ${c.activo}`, c]))

  for (const esperado of SALDOS_POR_UBICACION_ESPERADOS) {
    it(`${esperado.ubicacion} · ${esperado.activo} = ${esperado.saldo}`, () => {
      const celda = porClave.get(`${esperado.ubicacion} ${esperado.activo}`)
      expect(celda, `falta la celda ${esperado.ubicacion} ${esperado.activo}`).toBeDefined()
      expect(D(celda!.saldo).equals(D(esperado.saldo))).toBe(true)
    })
  }

  it('EXTERIOR no genera celdas de saldo', () => {
    expect(celdas.some((c) => c.ubicacion === 'EXTERIOR')).toBe(false)
  })

  it('ningún saldo es negativo en el mini-caso (no hay ventas sin origen)', () => {
    expect(celdas.filter((c) => c.negativo)).toHaveLength(0)
  })
})

describe('saldos · corte temporal', () => {
  it('a 15/01/2024 solo hay el ingreso inicial de EUR en Kraken', () => {
    const celdas = calcularSaldos(APUNTES_MINICASO, '2024-01-15T23:59:59')
    expect(celdas).toHaveLength(1)
    expect(celdas[0]).toMatchObject({ ubicacion: 'Kraken', activo: 'EUR', saldo: '25000' })
  })

  it('marca negativo un saldo cuando se vende sin origen registrado', () => {
    // Venta de 1 BTC en una ubicación sin compra previa → saldo −1 (alerta roja).
    const celdas = calcularSaldos([
      {
        id: 'x-001',
        fechaHora: '2024-01-01T00:00:00',
        tipo: 'VENTA',
        ubicacionOrigen: 'Kraken',
        ubicacionDestino: 'Kraken',
        activoSalida: 'BTC',
        cantidadSalida: '1',
        activoEntrada: 'EUR',
        cantidadEntrada: '30000',
        contravalorEUR: '30000',
      },
    ])
    const btc = celdas.find((c) => c.activo === 'BTC')
    expect(btc?.negativo).toBe(true)
    expect(D(btc!.saldo).equals(D('-1'))).toBe(true)
  })
})
