/**
 * fiscal.test.ts — resumen fiscal orientativo del mini-caso 2024.
 *
 * Verifica que el reparto en cajones (ahorro y derivados / RCM / actividad / base general /
 * pérdidas: seis claves para las cinco salidas de [MT] U9.1)
 * CUADRA con los golden del FIFO (tests/golden/fifo.test.ts): el neto del ahorro más el
 * total de pérdidas reproduce el total de GyP del diario (4.525,10 €). No inventa cifras:
 * todas salen del motor FIFO y de los contravalores del mini-caso.
 */
import { describe, it, expect } from 'vitest'
import {
  calcularResumenFiscal,
  ejerciciosConDatos,
  corteEjercicio,
  RANURAS_TEXTO_MANUAL,
  MARCADOR_TEXTO,
  CONCEPTOS_FISCALES,
  AVISO_721,
  NOTA_172_173,
  UMBRAL_721_EUR,
} from './fiscal'
import { transmisionesDelDiario } from './fifo'
import { D } from './decimal'
import type { Apunte, Justificante, Ubicacion } from './types'
import { UBICACION_EXTERIOR } from './types'
import { APUNTES_MINICASO, UBICACIONES_MINICASO } from '../../tests/golden/mini-caso'

const eq = (a: string, b: string) => D(a).equals(D(b))
/** Tolerancia para las cifras que el prorrateo del gas vuelve periódicas (D0). */
const casi = (a: string, b: string) => D(a).minus(D(b)).abs().lessThan('1e-9')
const SIN_JUST: Justificante[] = []

const resumen2024 = calcularResumenFiscal(APUNTES_MINICASO, UBICACIONES_MINICASO, SIN_JUST, 2024)

describe('fiscal · reparto en cajones (mini-caso 2024)', () => {
  it('ejerciciosConDatos detecta solo 2024', () => {
    expect(ejerciciosConDatos(APUNTES_MINICASO)).toEqual([2024])
  })

  it('AHORRO: 6 transmisiones onerosas (VENTA/PERMUTA), neto 4.725,40 €', () => {
    const { ahorro } = resumen2024
    expect(ahorro.operaciones).toHaveLength(6) // 4 VENTA + 2 PERMUTA (sin PÉRDIDA)
    expect(ahorro.operaciones.every((o) => o.tipo !== 'PERDIDA')).toBe(true)
    // 2484 + 50 + 48 + 1197 + 794,7590… + 149,4 = 4723,1590… (todas ganancias).
    // La permuta 2024-006 aporta 794,7590… y no 797 desde D0: su comisión de 0,001 ETH
    // minora el valor de transmisión por su coste prorrateado (2,240952… €).
    expect(casi(ahorro.gananciasEUR, '4723.1590476190476')).toBe(true)
    expect(eq(ahorro.perdidasEUR, '0')).toBe(true)
    expect(casi(ahorro.netoEUR, '4723.1590476190476')).toBe(true)
  })

  it('RCM (RENDIMIENTO): staking ETH 150 + staking ADA 2 + interés USDC 5 = 157 €', () => {
    const { rcm } = resumen2024
    expect(rcm.partidas).toHaveLength(3)
    expect(eq(rcm.totalEUR, '157')).toBe(true)
    expect(rcm.hayIncompletas).toBe(false)
  })

  it('ACTIVIDAD ECONÓMICA (MINERÍA): 110 € informativo', () => {
    const { actividadEconomica } = resumen2024
    expect(actividadEconomica.partidas).toHaveLength(1)
    expect(eq(actividadEconomica.totalEUR, '110')).toBe(true)
  })

  it('BASE GENERAL (AIRDROP): 100 €', () => {
    const { baseGeneral } = resumen2024
    expect(baseGeneral.partidas).toHaveLength(1)
    expect(eq(baseGeneral.totalEUR, '100')).toBe(true)
  })

  it('PÉRDIDAS (robo BTC 2024-017): −200,30 €, listada aparte', () => {
    const { perdidas } = resumen2024
    expect(perdidas.items).toHaveLength(1)
    expect(perdidas.items[0]!.apunteId).toBe('2024-017')
    expect(eq(perdidas.totalEUR, '-200.3')).toBe(true)
  })

  it('CUADRE con el FIFO: ahorro neto + pérdidas = total de GyP del diario (4.525,10)', () => {
    const totalFifo = transmisionesDelDiario(APUNTES_MINICASO).reduce(
      (acc, x) => acc.plus(D(x.resultadoEUR)),
      D('0'),
    )
    expect(casi(totalFifo.toFixed(), '4522.8590476190476')).toBe(true)
    const suma = D(resumen2024.ahorro.netoEUR).plus(D(resumen2024.perdidas.totalEUR))
    expect(eq(suma.toFixed(), totalFifo.toFixed())).toBe(true)
  })
})

describe('fiscal · estado probatorio de las pérdidas', () => {
  it('sin justificantes, la pérdida sale «sin-justificar» con huecos', () => {
    const p = resumen2024.perdidas.items[0]!
    expect(p.estadoProbatorio).toBe('sin-justificar')
    expect(p.faltantes.length).toBeGreaterThan(0)
    expect(resumen2024.perdidas.hayIncompletas).toBe(true)
  })

  it('con el expediente completo (denuncia + atestado + txid), sale «completo»', () => {
    const justificantes: Justificante[] = [
      { id: 'j1', apunteId: '2024-017', rutaConvencional: '07-perdidas-y-donaciones', tipoDocumento: 'denuncia' },
      { id: 'j2', apunteId: '2024-017', rutaConvencional: '07-perdidas-y-donaciones', tipoDocumento: 'expediente-atestado' },
      { id: 'j3', apunteId: '2024-017', rutaConvencional: '07-perdidas-y-donaciones', tipoDocumento: 'txid-perdida' },
    ]
    const r = calcularResumenFiscal(APUNTES_MINICASO, UBICACIONES_MINICASO, justificantes, 2024)
    expect(r.perdidas.items[0]!.estadoProbatorio).toBe('completo')
    expect(r.perdidas.hayIncompletas).toBe(false)
  })
})

describe('fiscal · aviso 721 (saldo en el extranjero)', () => {
  it('no se dispara en el mini-caso (ninguna ubicación es extranjera)', () => {
    expect(resumen2024.avisoExtranjero.aplica).toBe(false)
    expect(resumen2024.avisoExtranjero.supera).toBe(false)
  })

  it('caso sintético > 50.000 € en EUR: se dispara', () => {
    const exchangeExt: Ubicacion = {
      id: 'BinanceEU',
      nombre: 'Exchange extranjero',
      tipo: 'exchange',
      kyc: true,
      fechaAlta: '2024-01-01T00:00:00',
      extranjero: true,
      pais: 'Malta',
    }
    const apuntes: Apunte[] = [
      {
        id: '2024-001',
        fechaHora: '2024-02-01T10:00:00',
        tipo: 'TRANSFERENCIA',
        ubicacionOrigen: UBICACION_EXTERIOR,
        ubicacionDestino: 'BinanceEU',
        activoEntrada: 'EUR',
        cantidadEntrada: '60000',
      },
    ]
    const r = calcularResumenFiscal(apuntes, [exchangeExt], SIN_JUST, 2024)
    expect(r.avisoExtranjero.aplica).toBe(true)
    expect(r.avisoExtranjero.supera).toBe(true)
    expect(eq(r.avisoExtranjero.totalValoradoEUR, '60000')).toBe(true)
    expect(r.avisoExtranjero.umbralEUR).toBe(UMBRAL_721_EUR)
  })

  it('caso sintético con cripto valorada al cierre supera el umbral', () => {
    const walletExt: Ubicacion = {
      id: 'ColdExt',
      nombre: 'Custodio extranjero',
      tipo: 'wallet',
      kyc: false,
      fechaAlta: '2024-01-01T00:00:00',
      extranjero: true,
    }
    const apuntes: Apunte[] = [
      {
        id: '2024-001',
        fechaHora: '2024-03-01T10:00:00',
        tipo: 'MINERIA',
        ubicacionOrigen: UBICACION_EXTERIOR,
        ubicacionDestino: 'ColdExt',
        activoEntrada: 'BTC',
        cantidadEntrada: '2',
        contravalorEUR: '40000',
      },
    ]
    // 2 BTC × 60.000 €/BTC (precio de cierre) = 120.000 € > 50.000.
    const r = calcularResumenFiscal(apuntes, [walletExt], SIN_JUST, 2024, {
      valoracionCierre: { BTC: '60000' },
    })
    expect(r.avisoExtranjero.supera).toBe(true)
    expect(eq(r.avisoExtranjero.totalValoradoEUR, '120000')).toBe(true)
    expect(r.avisoExtranjero.haySinValorar).toBe(false)
  })

  it('cripto sin precio de cierre queda «sin valorar» y el total es un mínimo', () => {
    const walletExt: Ubicacion = {
      id: 'ColdExt',
      nombre: 'Custodio extranjero',
      tipo: 'wallet',
      kyc: false,
      fechaAlta: '2024-01-01T00:00:00',
      extranjero: true,
    }
    const apuntes: Apunte[] = [
      {
        id: '2024-001',
        fechaHora: '2024-03-01T10:00:00',
        tipo: 'MINERIA',
        ubicacionOrigen: UBICACION_EXTERIOR,
        ubicacionDestino: 'ColdExt',
        activoEntrada: 'BTC',
        cantidadEntrada: '2',
        contravalorEUR: '40000',
      },
    ]
    const r = calcularResumenFiscal(apuntes, [walletExt], SIN_JUST, 2024)
    expect(r.avisoExtranjero.haySinValorar).toBe(true)
    expect(r.avisoExtranjero.supera).toBe(false) // sin valorar, no puede afirmar que supera
    expect(r.avisoExtranjero.celdas[0]!.sinValorar).toBe(true)
  })
})

describe('fiscal · textos manuales (Regla de oro 5)', () => {
  it('todas las ranuras de concepto llevan el literal del manual (ya no el marcador)', () => {
    for (const c of Object.values(CONCEPTOS_FISCALES)) {
      expect(c.explicacion).not.toBe(MARCADOR_TEXTO)
      expect(c.fechaCriterio).not.toBe(MARCADOR_TEXTO)
      expect(c.explicacion.length).toBeGreaterThan(0)
      // La fecha de criterio lleva la marca de verificación del responsable. Los cajones
      // originales se verificaron el 6-8-2026; el de derivados nació el 16-8 y se
      // revisó el 20-8-2026 (base 46.b, imputación diaria, intereses percibidos, MiCA).
      // Redacción previa: con D6, el 16-8-2026.
      expect(c.fechaCriterio).toMatch(/Verificado a (6|16|20)-8-2026/)
    }
  })

  it('los avisos 721 y 172/173 llevan su literal', () => {
    expect(AVISO_721).toContain('modelo 721')
    expect(NOTA_172_173).toContain('172')
  })

  it('el catálogo de ranuras cubre los 6 cajones (×2) + 721 + 172/173', () => {
    // 5 conceptos × 2 ranuras + aviso-721 + nota-172-173 = 12
    expect(RANURAS_TEXTO_MANUAL).toHaveLength(14) // 6 cajones × 2 + 721 + 172/173
    expect(RANURAS_TEXTO_MANUAL.some((r) => r.clave === 'aviso-721')).toBe(true)
    expect(RANURAS_TEXTO_MANUAL.some((r) => r.clave === 'nota-172-173')).toBe(true)
  })

  it('corteEjercicio devuelve el 31/12 a las 23:59:59', () => {
    expect(corteEjercicio(2024)).toBe('2024-12-31T23:59:59')
  })
})
