/**
 * csv-generico.test.ts — CRITERIO DE ACEPTACIÓN P4.1:
 * «Importar mini_caso_generico.csv reproduce los golden tests.»
 *
 * Los SALDOS son el golden intocable (Regla 9) y dependen SOLO de cantidades, que el CSV
 * sí trae: la importación debe reproducirlos exactos. (Las GyP FIFO dependen además de
 * contravalores que el CSV genérico no trae para permutas/rendimientos —ver COTEJO_F1—,
 * por lo que aquí solo se exige la reproducción de SALDOS, más la estructura de apuntes.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { importarCsvGenerico } from './csv-generico'
import { calcularSaldos, saldosTotalesPorActivo } from '../../engine/saldos'
import { D } from '../../engine/decimal'
import {
  SALDOS_TOTALES_ESPERADOS,
  SALDOS_POR_UBICACION_ESPERADOS,
  CORTE_2024,
} from '../../../tests/golden/mini-caso'

const CSV = readFileSync(
  fileURLToPath(new URL('../../../docs/reference/mini_caso_generico.csv', import.meta.url)),
  'utf8',
)

const { apuntes, plataformas, activos, informe } = importarCsvGenerico(CSV)

describe('import CSV genérico · estructura', () => {
  it('acepta las 20 filas y produce 19 apuntes (retirada+depósito 20/03 → 1 TRANSFERENCIA)', () => {
    expect(informe.filasRechazadas).toEqual([])
    expect(apuntes).toHaveLength(19)
    expect(informe.filasAceptadas).toBe(19)
  })

  it('descubre las plataformas Kraken y Ledger', () => {
    expect(new Set(plataformas)).toEqual(new Set(['Kraken', 'Ledger']))
  })

  it('descubre los activos del caso', () => {
    expect(new Set(activos)).toEqual(new Set(['EUR', 'BTC', 'ETH', 'TOKENX', 'ADA', 'USDC']))
  })

  it('correlativos AAAA-NNN en orden cronológico, sin huecos', () => {
    expect(apuntes.map((a) => a.id)).toEqual(
      Array.from({ length: 19 }, (_, i) => `2024-${String(i + 1).padStart(3, '0')}`),
    )
  })

  it('casa la transferencia interna Kraken→Ledger del 20/03 en un solo apunte', () => {
    const tr = apuntes.find((a) => a.fechaHora.startsWith('2024-03-20'))!
    expect(tr.tipo).toBe('TRANSFERENCIA')
    expect(tr.ubicacionOrigen).toBe('Kraken')
    expect(tr.ubicacionDestino).toBe('Ledger')
    expect(tr.activoSalida).toBe('BTC')
    expect(tr.activoEntrada).toBe('BTC')
    expect(D(tr.cantidadSalida!).equals(D('0.3'))).toBe(true)
    expect(D(tr.cantidadEntrada!).equals(D('0.3'))).toBe(true)
    expect(tr.comisionActivo).toBe('BTC')
    expect(D(tr.comisionCantidad!).equals(D('0.0002'))).toBe(true)
    // No quedan piernas cripto sueltas pendientes de revisión.
    expect(informe.avisos).toEqual([])
  })

  it('mapea los tipos del catálogo cerrado (staking→RENDIMIENTO, robo→PÉRDIDA, etc.)', () => {
    const porId = new Map(apuntes.map((a) => [a.fechaHora.slice(0, 10) + ' ' + a.tipo, a]))
    expect(porId.has('2024-02-15 RENDIMIENTO')).toBe(true) // staking
    expect(porId.has('2024-06-01 MINERIA')).toBe(true) // minería
    expect(porId.has('2024-03-01 AIRDROP')).toBe(true) // airdrop
    expect(porId.has('2024-09-01 PERDIDA')).toBe(true) // robo
    expect(porId.has('2024-03-10 PERMUTA')).toBe(true) // permuta
  })

  it('deriva el contravalor EUR de compras y ventas (pierna en EUR)', () => {
    const compraBTC = apuntes.find((a) => a.tipo === 'COMPRA' && a.activoEntrada === 'BTC')!
    expect(D(compraBTC.contravalorEUR!).equals(D('20000'))).toBe(true)
    const ventaBTC = apuntes.find((a) => a.fechaHora.startsWith('2024-04-05'))!
    expect(D(ventaBTC.contravalorEUR!).equals(D('6500'))).toBe(true)
  })
})

describe('import CSV genérico · reproduce el golden de SALDOS (Regla 9)', () => {
  const totales = saldosTotalesPorActivo(apuntes, CORTE_2024)

  for (const [activo, esperado] of Object.entries(SALDOS_TOTALES_ESPERADOS)) {
    it(`saldo total ${activo} = ${esperado}`, () => {
      const obtenido = totales.get(activo) ?? '0'
      expect(D(obtenido).equals(D(esperado)), `${activo}: ${obtenido} ≠ ${esperado}`).toBe(true)
    })
  }

  it('no aparecen activos inesperados', () => {
    expect(new Set(totales.keys())).toEqual(new Set(Object.keys(SALDOS_TOTALES_ESPERADOS)))
  })

  const celdas = calcularSaldos(apuntes, CORTE_2024)
  const porClave = new Map(celdas.map((c) => [`${c.ubicacion} ${c.activo}`, c]))
  for (const esp of SALDOS_POR_UBICACION_ESPERADOS) {
    it(`reparto ${esp.ubicacion} · ${esp.activo} = ${esp.saldo}`, () => {
      const celda = porClave.get(`${esp.ubicacion} ${esp.activo}`)
      expect(celda, `falta ${esp.ubicacion} ${esp.activo}`).toBeDefined()
      expect(D(celda!.saldo).equals(D(esp.saldo))).toBe(true)
    })
  }

  it('ningún saldo negativo', () => {
    expect(celdas.filter((c) => c.negativo)).toHaveLength(0)
  })
})
