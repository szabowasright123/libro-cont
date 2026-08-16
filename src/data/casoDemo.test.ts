// @vitest-environment jsdom
/**
 * casoDemo.test.ts — carga y borrado del CASO DE EJEMPLO COMPLETO (2024–2025) sobre
 * IndexedDB (fake-indexeddb). Comprueba que:
 *  · el capítulo 2024 reproduce EXACTAMENTE los saldos del golden a 31/12/2024 (Regla 9);
 *  · los saldos finales (2025) y su reparto por ubicación cuadran con el guion del caso;
 *  · se siembra el Archivo COMPLETO AL 100% (62 justificantes), el subtipo de la PÉRDIDA,
 *    la referencia del AJUSTE (rectificaA) y los precios manuales;
 *  · el resumen fiscal de 2024 no cambia y el de 2025 cuenta la historia nueva (pérdida de
 *    transmisión + PAGO, RCM) y el aviso 721 de doble fecha (supera a 20/10, no a 31/12);
 *  · cargar dos veces NO duplica y el borrado deja el Libro vacío.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  cargarCasoDemo,
  borrarCasoDemo,
  estaDemoCargada,
  listarApuntes,
  listarPrecios,
  listarRegistros,
  listarUbicaciones,
  listarJustificantes,
  justificantesADominio,
  obtenerCuadreReal,
} from './repositorio'
import { saldosTotalesPorActivo, calcularSaldos } from '../engine/saldos'
import { calcularCuadre } from '../engine/cuadre'
import { TOLERANCIAS_POR_DEFECTO } from '../engine/types'
import { calcularResumenFiscal } from '../engine/fiscal'
import { informeCompletitud, mapaKyc } from '../engine/archivo'
import { calcularTrazabilidad, celdaCartera } from '../engine/trazabilidad'
import { calcularAviso721 } from '../ui/fiscal/aviso721'
import { D } from '../engine/decimal'

/** Saldos totales del capítulo 2024 a 31/12/2024 (golden intocable, Regla de oro 9). */
const SALDOS_GOLDEN_2024: Record<string, string> = {
  BTC: '0.4068',
  ETH: '1.049',
  USDC: '305',
  EUR: '4254',
}

/** Saldos totales al final del caso completo (31/12/2025, según el guion del capítulo 2025). */
const SALDOS_FINALES: Record<string, string> = {
  BTC: '0.84355',
  ETH: '0.249',
  USDC: '311',
  EUR: '7674',
}

const CORTE_2024 = '2024-12-31T23:59:59'

beforeEach(async () => {
  await borrarCasoDemo() // deja el Libro vacío antes de cada caso
})

describe('cargarCasoDemo (caso completo 2024–2025)', () => {
  it('reproduce el golden a 31/12/2024 y los saldos finales del guion', async () => {
    await cargarCasoDemo()

    const apuntes = await listarApuntes()
    expect(apuntes).toHaveLength(29) // 19 (capítulo 2024) + 10 (capítulo 2025)

    // Regla de oro 9: a fecha de corte 31/12/2024, el caso completo ES el mini-caso golden.
    const saldos2024 = saldosTotalesPorActivo(apuntes, CORTE_2024)
    for (const [activo, esperado] of Object.entries(SALDOS_GOLDEN_2024)) {
      expect(D(saldos2024.get(activo) ?? '0').equals(D(esperado))).toBe(true)
    }
    expect(D(saldos2024.get('ADA') ?? '0').isZero()).toBe(true)
    expect(D(saldos2024.get('TOKENX') ?? '0').isZero()).toBe(true)

    // Saldos finales del caso completo.
    const saldos = saldosTotalesPorActivo(apuntes)
    for (const [activo, esperado] of Object.entries(SALDOS_FINALES)) {
      expect(D(saldos.get(activo) ?? '0').equals(D(esperado))).toBe(true)
    }

    // Reparto por ubicación a fin de 2025 (la historia del 721 y la autocustodia).
    const celdas = calcularSaldos(apuntes)
    const saldoDe = (ubic: string, activo: string) =>
      celdas.find((c) => c.ubicacion === ubic && c.activo === activo)?.saldo ?? '0'
    expect(D(saldoDe('Kraken', 'BTC')).equals(D('0.04055'))).toBe(true)
    expect(D(saldoDe('Ledger', 'BTC')).equals(D('0.787'))).toBe(true)
    expect(D(saldoDe('CanalLN', 'BTC')).equals(D('0.016'))).toBe(true)
    expect(celdas.some((c) => c.negativo)).toBe(false) // nada en rojo: el guion cuadra

    expect(await estaDemoCargada()).toBe(true)

    const precios = await listarPrecios()
    const porActivo = new Map(precios.map((p) => [p.activo, p.precioEur]))
    expect(porActivo.get('BTC')).toBe('100000')
    expect(porActivo.get('ETH')).toBe('3000')
    expect(porActivo.get('USDC')).toBe('0.92')
  })

  it('siembra el Archivo, el subtipo de la PÉRDIDA y la referencia del AJUSTE', async () => {
    await cargarCasoDemo()

    // Archivo: 62 justificantes (incluido el certificado anual sin apunte, carpeta 05).
    const justificantes = await listarJustificantes()
    expect(justificantes).toHaveLength(62)

    // Expediente probatorio COMPLETO AL 100% (decisión del responsable del taller).
    const registros = await listarRegistros()
    const apuntes = await listarApuntes()
    const ubicaciones = await listarUbicaciones()
    const dom = justificantesADominio(justificantes, registros)
    const informe = informeCompletitud(apuntes, dom, mapaKyc(ubicaciones))
    expect(informe.total).toBe(29)
    expect(informe.completos).toBe(29)
    expect(informe.incompletos).toBe(0)
    expect(informe.sinJustificar).toBe(0)
    expect(informe.porcentajeCompleto).toBe(100)

    // Subtipo de la pérdida de 2024 (phishing → estafa), capa de datos.
    const perdida = registros.find((r) => r.id === '2024-017')
    expect(perdida?.subtipoPerdida).toBe('estafa')

    // El AJUSTE 2025-010 referencia (por uid estable) al rendimiento 2025-003.
    const ajuste = apuntes.find((a) => a.id === '2025-010')
    expect(ajuste?.tipo).toBe('AJUSTE')
    expect(ajuste?.rectificaA).toBe('2025-003')
  })

  it('fiscal: 2024 intacto; 2025 con pérdida de transmisión, PAGO y RCM', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const ubicaciones = await listarUbicaciones()
    const registros = await listarRegistros()
    const dom = justificantesADominio(await listarJustificantes(), registros)

    // 2024: las mismas cifras que tenía el mini-caso (el capítulo 2025 no las toca).
    const r2024 = calcularResumenFiscal(apuntes, ubicaciones, dom, 2024)
    expect(r2024.ahorro.netoEUR).toBe('4723.197')
    expect(r2024.rcm.totalEUR).toBe('157')
    expect(r2024.actividadEconomica.totalEUR).toBe('110')
    expect(r2024.baseGeneral.totalEUR).toBe('100')
    expect(r2024.perdidas.totalEUR).toBe('-200.3')
    expect(r2024.perdidas.items[0]?.estadoProbatorio).toBe('completo')

    // 2025: venta de ETH con pérdida (−287,4) + PAGO con ganancia (+219,76) → neto −67,64.
    const r2025 = calcularResumenFiscal(apuntes, ubicaciones, dom, 2025)
    expect(r2025.ahorro.operaciones).toHaveLength(2)
    expect(r2025.ahorro.gananciasEUR).toBe('219.76')
    expect(r2025.ahorro.perdidasEUR).toBe('-287.4')
    expect(r2025.ahorro.netoEUR).toBe('-67.64')
    expect(r2025.rcm.totalEUR).toBe('104') // 6 (lending USDC) + 98 (earn BTC)
    expect(r2025.perdidas.items).toHaveLength(0)
  })

  it('aviso 721 de doble fecha (2025): supera a 20/10 y NO a 31/12 tras la autocustodia', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const ubicaciones = await listarUbicaciones()

    const aviso = calcularAviso721(apuntes, ubicaciones, 2025, { BTC: '100000' })
    expect(aviso.aplica).toBe(true)
    // 20/10: 0,54075 BTC × 100.000 + 7.674 € = 61.749 € → supera el umbral.
    expect(aviso.estimacion.supera).toBe(true)
    expect(aviso.estimacion.totalValoradoEUR).toBe('61749')
    expect(aviso.estimacion.haySinValorar).toBe(true) // ETH/USDC sin precio de cierre
    // 31/12: tras retirar 0,5 BTC a autocustodia → 4.055 + 7.674 = 11.729 € → no supera.
    expect(aviso.normativo.supera).toBe(false)
    expect(aviso.normativo.totalValoradoEUR).toBe('11729')
    // Solo Kraken computa: Ledger y el canal Lightning son autocustodia.
    for (const celda of [...aviso.estimacion.celdas, ...aviso.normativo.celdas]) {
      expect(celda.ubicacion).toBe('Kraken')
    }
  })

  it('siembra el CUADRE declarado: 6 celdas, todas en VERDE contra el motor', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const declarados = await obtenerCuadreReal()
    expect(declarados).toHaveLength(6)

    const filas = calcularCuadre(calcularSaldos(apuntes), declarados, TOLERANCIAS_POR_DEFECTO)
    expect(filas).toHaveLength(6)
    for (const fila of filas) {
      expect(fila.estado, `${String(fila.ubicacion)} · ${fila.activo}`).toBe('OK')
      expect(D(fila.diferencia).isZero()).toBe(true)
    }
  })

  it('trazabilidad: el saldo de Ledger es mezcla (KYC transferido + minería no-KYC)', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const ubicaciones = await listarUbicaciones()
    const traza = calcularTrazabilidad(apuntes, ubicaciones)
    const ledgerBtc = celdaCartera(traza, 'Ledger', 'BTC')
    expect(ledgerBtc).toBeDefined()
    expect(D(ledgerBtc!.kyc).equals(D('0.785'))).toBe(true)
    expect(D(ledgerBtc!.noKyc).equals(D('0.002'))).toBe(true)
    expect(ledgerBtc!.deficit).toBe(false)
  })

  it('cargar dos veces NO duplica (siempre reemplaza)', async () => {
    await cargarCasoDemo()
    await cargarCasoDemo()
    expect(await listarApuntes()).toHaveLength(29)
    expect(await db.precios.count()).toBe(3)
    expect(await db.justificantes.count()).toBe(62)
  })
})

describe('borrarCasoDemo', () => {
  it('deja el Libro vacío y quita la marca de demo', async () => {
    await cargarCasoDemo()
    await borrarCasoDemo()

    expect(await listarApuntes()).toHaveLength(0)
    expect(await db.ubicaciones.count()).toBe(0)
    expect(await db.justificantes.count()).toBe(0)
    expect(await db.precios.count()).toBe(0)
    expect(await estaDemoCargada()).toBe(false)
    // Los activos de serie (BTC/EUR) se conservan tras el borrado total.
    const activos = (await db.activos.toArray()).map((a) => a.simbolo).sort()
    expect(activos).toEqual(['BTC', 'EUR'])
  })
})
