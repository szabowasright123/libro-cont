// @vitest-environment jsdom
/**
 * casoDemo.test.ts — carga y borrado del CASO DE EJEMPLO COMPLETO (2024–2026) sobre
 * IndexedDB (fake-indexeddb). Comprueba que:
 *  · el capítulo 2024 reproduce EXACTAMENTE los saldos del golden a 31/12/2024 (Regla 9);
 *  · los saldos a 31/12/2025 siguen siendo los del guion del capítulo 2025, y los de
 *    31/12/2026 los del capítulo nuevo, con el BTC INTACTO (el capítulo 2026 no lo toca);
 *  · se siembra el Archivo COMPLETO AL 100% (87 justificantes), el subtipo de la PÉRDIDA,
 *    la referencia del AJUSTE (rectificaA) y los precios manuales;
 *  · el resumen fiscal de 2024 y el de 2025 NO CAMBIAN al añadirse el capítulo 2026, y el de
 *    2026 trae el cajón de derivados poblado, la permuta cuantificada por el mayor de los dos
 *    valores del art. 37.1.h y el RCM del pool;
 *  · el caso completo CONCILIA EN CERO (cola FIFO ↔ saldos) y `validarDiario` no arroja
 *    ningún aviso de nivel 'error';
 *  · el aviso 721 de doble fecha sigue contando su historia (supera a 20/10, no a 31/12);
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
  listarActivos,
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
import { conciliarFifoSaldos } from '../engine/conciliacion'
import { validarDiario } from '../engine/validaciones'
import { calcularFifo, valorPermutaEUR } from '../engine/fifo'
import { D } from '../engine/decimal'

/** Saldos totales del capítulo 2024 a 31/12/2024 (golden intocable, Regla de oro 9). */
const SALDOS_GOLDEN_2024: Record<string, string> = {
  BTC: '0.4068',
  ETH: '1.049',
  USDC: '305',
  EUR: '4254',
}

/**
 * Saldos totales al cierre de 2025 (guion del capítulo 2025). El capítulo 2026 SOLO AÑADE
 * apuntes posteriores, así que estas cifras no se mueven: se comprueban ahora a fecha de
 * corte, exactamente igual que las del golden de 2024.
 */
const SALDOS_2025: Record<string, string> = {
  BTC: '0.84355',
  ETH: '0.249',
  USDC: '311',
  EUR: '7674',
}

/**
 * Saldos totales al final del caso completo (31/12/2026, guion del capítulo 2026). El BTC es
 * el MISMO que a 31/12/2025 y no por casualidad: el subyacente del perpetuo es el bitcoin,
 * pero una liquidación por diferencias no entrega el subyacente, y el resto del capítulo se
 * mueve en ETH, USDC y TOKENX.
 */
const SALDOS_2026: Record<string, string> = {
  BTC: '0.84355',
  ETH: '1.097',
  USDC: '631',
  TOKENX: '2500',
  EUR: '4659',
}

const CORTE_2024 = '2024-12-31T23:59:59'
const CORTE_2025 = '2025-12-31T23:59:59'

beforeEach(async () => {
  await borrarCasoDemo() // deja el Libro vacío antes de cada caso
})

describe('cargarCasoDemo (caso completo 2024–2026)', () => {
  it('reproduce el golden a 31/12/2024 y los saldos de cada cierre del guion', async () => {
    await cargarCasoDemo()

    const apuntes = await listarApuntes()
    expect(apuntes).toHaveLength(39) // 19 (2024) + 10 (2025) + 10 (2026)

    // Regla de oro 9: a fecha de corte 31/12/2024, el caso completo ES el mini-caso golden.
    const saldos2024 = saldosTotalesPorActivo(apuntes, CORTE_2024)
    for (const [activo, esperado] of Object.entries(SALDOS_GOLDEN_2024)) {
      expect(D(saldos2024.get(activo) ?? '0').equals(D(esperado))).toBe(true)
    }
    expect(D(saldos2024.get('ADA') ?? '0').isZero()).toBe(true)
    expect(D(saldos2024.get('TOKENX') ?? '0').isZero()).toBe(true)

    // A 31/12/2025, los saldos del capítulo 2025, INTACTOS: el capítulo 2026 solo añade
    // apuntes posteriores y no puede mover ni un decimal de lo anterior.
    const saldos2025 = saldosTotalesPorActivo(apuntes, CORTE_2025)
    for (const [activo, esperado] of Object.entries(SALDOS_2025)) {
      expect(D(saldos2025.get(activo) ?? '0').equals(D(esperado))).toBe(true)
    }
    expect(D(saldos2025.get('TOKENX') ?? '0').isZero()).toBe(true)

    // Saldos finales del caso completo (31/12/2026).
    const saldos = saldosTotalesPorActivo(apuntes)
    for (const [activo, esperado] of Object.entries(SALDOS_2026)) {
      expect(D(saldos.get(activo) ?? '0').equals(D(esperado))).toBe(true)
    }

    // Reparto por ubicación al final (la historia del 721 y la autocustodia sigue en pie:
    // el BTC está donde estaba, porque el capítulo 2026 no lo toca).
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
    expect(porActivo.get('TOKENX')).toBe('0.26') // del capítulo 2026
  })

  it('capítulo 2026: el reparto por ubicación, con el pool y la donación recibida', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const celdas = calcularSaldos(apuntes)
    const saldoDe = (ubic: string, activo: string) =>
      celdas.find((c) => c.ubicacion === ubic && c.activo === activo)?.saldo ?? '0'

    // Kraken, tras la compra, la permuta, el pago del corte negativo y la aportación.
    expect(D(saldoDe('Kraken', 'EUR')).equals(D('4659'))).toBe(true)
    expect(D(saldoDe('Kraken', 'ETH')).equals(D('0.897'))).toBe(true)
    expect(D(saldoDe('Kraken', 'USDC')).equals(D('161'))).toBe(true)
    expect(D(saldoDe('Kraken', 'TOKENX')).equals(D('2500'))).toBe(true)

    // El POOL: bajo la tesis benévola los activos aportados NO salieron del patrimonio, así
    // que tienen que seguir viéndose en algún sitio. El sitio es la ubicación del pool, con
    // la recompensa de septiembre ya acreditada (430 + 40 = 470 USDC).
    expect(D(saldoDe('PoolUniV3', 'ETH')).equals(D('0.1'))).toBe(true)
    expect(D(saldoDe('PoolUniV3', 'USDC')).equals(D('470'))).toBe(true)

    // Y los 0,10 ETH de la donación RECIBIDA, en autocustodia.
    expect(D(saldoDe('Ledger', 'ETH')).equals(D('0.1'))).toBe(true)
  })

  it('siembra el Archivo, el subtipo de la PÉRDIDA y la referencia del AJUSTE', async () => {
    await cargarCasoDemo()

    // Archivo: 87 justificantes (incluido el certificado anual sin apunte, carpeta 05).
    const justificantes = await listarJustificantes()
    expect(justificantes).toHaveLength(87)

    // Expediente probatorio COMPLETO AL 100% (decisión del responsable del taller).
    const registros = await listarRegistros()
    const apuntes = await listarApuntes()
    const ubicaciones = await listarUbicaciones()
    const dom = justificantesADominio(justificantes, registros)
    const informe = informeCompletitud(apuntes, dom, mapaKyc(ubicaciones))
    expect(informe.total).toBe(39)
    expect(informe.completos).toBe(39)
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
    expect(D(r2024.ahorro.netoEUR).minus(D('4723.1590476190476')).abs().lessThan('1e-9')).toBe(true)
    expect(r2024.rcm.totalEUR).toBe('157')
    expect(r2024.actividadEconomica.totalEUR).toBe('110')
    expect(r2024.baseGeneral.totalEUR).toBe('100')
    expect(r2024.perdidas.totalEUR).toBe('-200.3')
    expect(r2024.perdidas.items[0]?.estadoProbatorio).toBe('completo')

    // 2025 · TRES transmisiones desde la v1.6.0. La DONACIÓN entregada entró en el cajón
    // del ahorro al resolverse su `sentido`: hasta la 1.5.0 no consumía cola FIFO, así que
    // ni generaba ganancia ni bajaba las existencias, y el Libro arrastraba 0,01 BTC
    // fantasma. Ahora: venta de ETH (−287,40) + PAGO (+219,76) + donación de 0,01 BTC
    // valorada en 900 € con coste FIFO 400,60 € (+499,40) → ganancias 719,16 y neto 431,76.
    const r2025 = calcularResumenFiscal(apuntes, ubicaciones, dom, 2025)
    expect(r2025.ahorro.operaciones).toHaveLength(3)
    expect(r2025.ahorro.gananciasEUR).toBe('719.16')
    expect(r2025.ahorro.perdidasEUR).toBe('-287.4')
    expect(r2025.ahorro.netoEUR).toBe('431.76')
    // La donación arrojó GANANCIA, luego no hay nada excluido por el art. 33.5.c.
    expect(r2025.ahorro.perdidasNoComputablesEUR).toBe('0')
    const don = r2025.ahorro.operaciones.find((o) => o.tipo === 'DONACION')
    expect(don?.resultadoEUR).toBe('499.4')
    expect(don?.perdidaNoComputable).toBeUndefined()
    expect(r2025.rcm.totalEUR).toBe('104') // 6 (lending USDC) + 98 (earn BTC)
    expect(r2025.perdidas.items).toHaveLength(0)
  })

  it('fiscal 2026: el cajón de DERIVADOS poblado, con la posición viva a 31/12', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const ubicaciones = await listarUbicaciones()
    const r = calcularResumenFiscal(apuntes, ubicaciones, [], 2026)

    // Los TRES cortes de liquidación del perpetuo, en su cajón propio: 211,60 − 92,00 + 138,00.
    // Van a la base del AHORRO por el art. 46.b) LIRPF, pero se presentan aparte porque no
    // proceden de una transmisión con FIFO: la cifra la fija la liquidación de la plataforma.
    expect(r.derivados.partidas).toHaveLength(3)
    expect(r.derivados.totalEUR).toBe('257.6')
    expect(r.derivados.hayIncompletas).toBe(false)

    // El corte de junio fue EN CONTRA: el contravalor de una liquidación por diferencias es
    // el resultado neto y puede ser negativo, sin lado de salida ni activo movido.
    const enContra = r.derivados.partidas.find((pt) => D(pt.importeEUR).isNegative())!
    expect(enContra.apunteId).toBe('2026-004')
    expect(enContra.importeEUR).toBe('-92')
    expect(enContra.activo).toBe('')

    // El último corte es el del 31/12 con la posición TODAVÍA ABIERTA: la imputación es
    // DIARIA cuando el contrato liquida periódicamente (art. 14.1.c LIRPF; V2115-21).
    const ultimo = r.derivados.partidas[r.derivados.partidas.length - 1]!
    expect(ultimo.apunteId).toBe('2026-010')
    expect(ultimo.fechaHora.startsWith('2026-12-31')).toBe(true)

    // NINGUNA liquidación de derivado tiene lado de salida: no se entrega el subyacente.
    const liquidaciones = apuntes.filter((a) => a.tipo === 'LIQUIDACION_DERIVADO')
    expect(liquidaciones).toHaveLength(3)
    for (const liq of liquidaciones) {
      expect(liq.activoSalida).toBeUndefined()
      expect(liq.cantidadSalida).toBeUndefined()
    }
    // Y el BTC, que es el subyacente del perpetuo, no aparece en ninguna de ellas.
    expect(liquidaciones.some((l) => l.activoEntrada === 'BTC')).toBe(false)

    // Ahorro por transmisiones: la permuta del art. 37.1.h y el PAGO que salda el corte
    // negativo (que sí es transmisión y sí consume cola FIFO).
    expect(r.ahorro.operaciones).toHaveLength(2)
    expect(D(r.ahorro.netoEUR).minus(D('67.29261904761904761905')).abs().lessThan('1e-9')).toBe(true)
    const pago = r.ahorro.operaciones.find((o) => o.tipo === 'PAGO')!
    expect(pago.apunteId).toBe('2026-005')
    expect(pago.valorTransmisionNetoEUR).toBe('92')
    expect(D(pago.resultadoEUR).minus(D('-91.33333333333333333333')).abs().lessThan('1e-9')).toBe(true)

    // El pool produce DOS rentas distintas y el informe las separa: aquí, de momento, solo
    // el RCM del art. 25.2 (V0648-24). La ganancia patrimonial aflorará en la retirada.
    expect(r.rcm.totalEUR).toBe('36.8')
    expect(r.rcm.partidas).toHaveLength(1)
    expect(r.rcm.partidas[0]?.apunteId).toBe('2026-008')

    // La donación RECIBIDA no genera renta en el IRPF del donatario (tributa por el ISD):
    // ni ahorro, ni base general, ni pérdidas.
    expect(r.baseGeneral.totalEUR).toBe('0')
    expect(r.actividadEconomica.totalEUR).toBe('0')
    expect(r.perdidas.items).toHaveLength(0)
    expect(r.ahorro.operaciones.some((o) => o.tipo === 'DONACION')).toBe(false)
  })

  it('la PERMUTA de 2026 se cuantifica por el MAYOR de los dos valores (art. 37.1.h)', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const permuta = apuntes.find((a) => a.id === '2026-002')!

    // Los dos valores de mercado, distintos, y el mayor es el de lo ENTREGADO.
    expect(permuta.valorMercadoEntregadoEUR).toBe('750.00')
    expect(permuta.valorMercadoRecibidoEUR).toBe('655.00')
    expect(valorPermutaEUR(permuta).equals(D('750'))).toBe(true)

    // El motor transmite por 750,00 € y NO por los 655,00 € efectivamente recibidos.
    const ubicaciones = await listarUbicaciones()
    const r = calcularResumenFiscal(apuntes, ubicaciones, [], 2026)
    const op = r.ahorro.operaciones.find((o) => o.apunteId === '2026-002')!
    expect(op.tipo).toBe('PERMUTA')
    expect(op.activo).toBe('ETH')
    expect(op.valorTransmisionNetoEUR).toBe('750')
    expect(D(op.costeFifoEUR).minus(D('591.37404761904761904762')).abs().lessThan('1e-9')).toBe(true)
    expect(D(op.resultadoEUR).minus(D('158.62595238095238095238')).abs().lessThan('1e-9')).toBe(true)

    // Y ese MISMO importe es el coste del lote que nace: los 2.500 TOKENX entran con
    // 750,00 € de coste, no con los 655,00 € que valían. Es lo que impide que esos 95,00 €
    // vuelvan a tributar cuando se vendan.
    const cola = calcularFifo([...apuntes]).get('TOKENX')!
    const lote = cola.resumen.lotesAbiertos.find((l) => l.apunteId === '2026-002')!
    expect(D(lote.costeTotalEUR).equals(D('750'))).toBe(true)
    expect(D(lote.cantidadRestante).equals(D('2500'))).toBe(true)
  })

  it('el caso completo CONCILIA EN CERO y no arroja ningún error de validación', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const activos = await listarActivos()

    // Cola FIFO ↔ SALDOS, activo a activo. Es la comprobación que el CUADRE no puede hacer:
    // mira hacia dentro, y solo puede fallar por un error de clasificación del propio Libro.
    const conc = conciliarFifoSaldos([...apuntes], { activos })
    expect(conc.estadoGlobal).toBe('OK')
    expect(conc.activosDescuadrados).toBe(0)
    for (const fila of conc.filas) {
      expect(D(fila.diferencia).isZero(), `${fila.activo}`).toBe(true)
    }

    // Ningún aviso de nivel 'error' en todo el diario. Los apuntes DeFi de zona gris llevan
    // su `criterioAplicado`, así que tampoco arrastran el aviso ámbar de la zona gris.
    const avisos = validarDiario([...apuntes], undefined, activos)
    expect(avisos.filter((a) => a.nivel === 'error')).toHaveLength(0)
    expect(avisos.filter((a) => a.apunteId?.startsWith('2026-'))).toHaveLength(0)
  })

  it('aviso 721 de doble fecha (2025): supera a 20/10 y NO a 31/12 tras la autocustodia', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const ubicaciones = await listarUbicaciones()

    const aviso = calcularAviso721(apuntes, ubicaciones, 2025, { BTC: '100000' })
    expect(aviso.aplica).toBe(true)
    // 20/10: 0,54075 BTC × 100.000 = 54.075 € → supera el umbral.
    //
    // ATENCIÓN al importe: el saldo en EUR de Kraken (7.674 €) NO suma, porque el 721 informa
    // de MONEDAS VIRTUALES y el fiat de una cuenta en el extranjero va al bloque de cuentas
    // del modelo 720 (V2185-23). Hasta que `aviso721.ts` excluyó el fiat, aquí se esperaban
    // 61.749 € (= 54.075 + 7.674) y 11.729 € (= 4.055 + 7.674). El cambio de cifra viene de
    // esa exclusión, NO del capítulo 2026: el aviso de 2025 se calcula a corte 31/12/2025 y
    // los apuntes de 2026 son todos posteriores.
    expect(aviso.estimacion.supera).toBe(true)
    expect(aviso.estimacion.totalValoradoEUR).toBe('54075')
    expect(aviso.estimacion.haySinValorar).toBe(true) // ETH/USDC sin precio de cierre
    // 31/12: tras retirar 0,5 BTC a autocustodia → 4.055 € → no supera.
    expect(aviso.normativo.supera).toBe(false)
    expect(aviso.normativo.totalValoradoEUR).toBe('4055')
    // Solo Kraken computa: Ledger y el canal Lightning son autocustodia.
    for (const celda of [...aviso.estimacion.celdas, ...aviso.normativo.celdas]) {
      expect(celda.ubicacion).toBe('Kraken')
    }
  })

  it('siembra el CUADRE declarado: 10 celdas, todas en VERDE contra el motor', async () => {
    await cargarCasoDemo()
    const apuntes = await listarApuntes()
    const declarados = await obtenerCuadreReal()
    // Las 6 celdas de 2025 más las 4 que abre el capítulo 2026 (TOKENX en Kraken, el ETH
    // donado en el Ledger y las dos del pool).
    expect(declarados).toHaveLength(10)

    const filas = calcularCuadre(calcularSaldos(apuntes), declarados, TOLERANCIAS_POR_DEFECTO)
    expect(filas).toHaveLength(10)
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
    expect(await listarApuntes()).toHaveLength(39)
    expect(await db.precios.count()).toBe(4)
    expect(await db.justificantes.count()).toBe(87)
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
