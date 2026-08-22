/**
 * conciliacion.test.ts — la comprobación que faltaba, y el defecto que cierra.
 *
 * Hasta la v1.5.0 el motor leía los flags del catálogo con `=== true`, de modo que el
 * «según el caso» de DONACIÓN y AJUSTE se resolvía siempre como «no»: un bitcoin donado
 * bajaba del SALDO y seguía vivo en la COLA FIFO, con su coste, esperando a que la
 * siguiente venta se lo comiera. El CUADRE no lo veía —compara el saldo calculado con el
 * saldo real declarado, y ese cuadra—, así que era un descuadre invisible ([MT] U6.2).
 *
 * Estos tests fijan las tres piezas del arreglo:
 *   1. `resolverFlags` traduce el «según el caso» con el `sentido` del apunte.
 *   2. `conciliarFifoSaldos` compara existencias vivas contra suma de saldos.
 *   3. El caso de ejemplo de la app concilia en CERO (era 0,01 BTC de más).
 */

import { describe, it, expect } from 'vitest'
import {
  type Apunte,
  type Ubicacion,
  UBICACION_EXTERIOR,
  resolverFlags,
  esTransmisionLucrativa,
  CATALOGO_TIPOS,
} from './types'
import { conciliarFifoSaldos } from './conciliacion'
import { calcularFifoActivo } from './fifo'
import { calcularResumenFiscal } from './fiscal'
import { D } from './decimal'
import { APUNTES_CASO_DEMO, ACTIVOS_CASO_DEMO, UBICACIONES_CASO_DEMO } from '../data/demo/caso-demo'

const KRAKEN = 'Kraken'

const UBICS: Ubicacion[] = [
  { id: KRAKEN, nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2026-01-01T00:00:00' },
]

/** Compra de 1 BTC por 50.000 € el 10-1-2026. Punto de partida de casi todos los casos. */
const COMPRA: Apunte = {
  id: '2026-001',
  fechaHora: '2026-01-10T10:00:00',
  tipo: 'COMPRA',
  ubicacionOrigen: KRAKEN,
  ubicacionDestino: KRAKEN,
  activoSalida: 'EUR',
  cantidadSalida: '50000',
  activoEntrada: 'BTC',
  cantidadEntrada: '1',
  contravalorEUR: '50000',
}

function donacion(sentido: Apunte['sentido'], contravalor = '30000'): Apunte {
  return {
    id: '2026-002',
    fechaHora: '2026-02-10T10:00:00',
    tipo: 'DONACION',
    ...(sentido ? { sentido } : {}),
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.5',
    contravalorEUR: contravalor,
  }
}

// ────────────────────────────────────────────────────────────────────────────
describe('resolverFlags · el «según el caso» del catálogo', () => {
  it('un tipo determinista pasa tal cual y nunca queda sin resolver', () => {
    const f = resolverFlags({ tipo: 'VENTA' })
    expect(f.consumeLote).toBe(true)
    expect(f.abreLote).toBe(false)
    expect(f.sinResolver).toBe(false)
  })

  it('DONACIÓN sin sentido: conservadora (no mueve cola) y MARCADA como sin resolver', () => {
    const f = resolverFlags({ tipo: 'DONACION' })
    expect(f.consumeLote).toBe(false)
    expect(f.abreLote).toBe(false)
    expect(f.sinResolver).toBe(true)
  })

  it('DONACIÓN entregada consume cola; recibida la abre', () => {
    const e = resolverFlags({ tipo: 'DONACION', sentido: 'entregada' })
    expect(e.consumeLote).toBe(true)
    expect(e.abreLote).toBe(false)
    expect(e.sinResolver).toBe(false)

    const r = resolverFlags({ tipo: 'DONACION', sentido: 'recibida' })
    expect(r.consumeLote).toBe(false)
    expect(r.abreLote).toBe(true)
  })

  it('un flag ya determinista en el catálogo manda sobre el sentido', () => {
    // DONACIÓN tiene `alteracion: true` fijo: entregada o recibida, es alteración.
    expect(CATALOGO_TIPOS.DONACION.alteracion).toBe(true)
    expect(resolverFlags({ tipo: 'DONACION', sentido: 'entregada' }).alteracion).toBe(true)
  })

  it('AJUSTE por defecto es solo-saldos, y eso NO es «sin resolver»', () => {
    const f = resolverFlags({ tipo: 'AJUSTE' })
    expect(f.consumeLote).toBe(false)
    expect(f.abreLote).toBe(false)
    expect(f.sinResolver).toBe(false)
  })

  it('solo la donación ENTREGADA es transmisión lucrativa', () => {
    expect(esTransmisionLucrativa({ tipo: 'DONACION', sentido: 'entregada' })).toBe(true)
    expect(esTransmisionLucrativa({ tipo: 'DONACION', sentido: 'recibida' })).toBe(false)
    expect(esTransmisionLucrativa({ tipo: 'VENTA' })).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────────
describe('conciliarFifoSaldos · el descuadre que el CUADRE no ve', () => {
  it('una donación SIN sentido descuadra, y la conciliación lo dice y señala al apunte', () => {
    const diario = [COMPRA, donacion(undefined)]
    const r = conciliarFifoSaldos(diario)
    const btc = r.filas.find((f) => f.activo === 'BTC')!

    expect(btc.saldoTotal).toBe('0.5')
    expect(btc.existenciasFifo).toBe('1') // la cola no se movió: 0,5 BTC fantasma
    expect(D(btc.diferencia).equals('0.5')).toBe(true)
    expect(btc.estado).toBe('ERROR')
    expect(btc.motivos).toContain('sentido-sin-resolver')
    expect(btc.apuntesImplicados).toContain('2026-002')
    expect(r.estadoGlobal).toBe('ERROR')
    expect(r.activosDescuadrados).toBe(1)
  })

  it('con el sentido resuelto, concilia en cero y la cola baja de verdad', () => {
    const diario = [COMPRA, donacion('entregada')]
    const r = conciliarFifoSaldos(diario)
    const btc = r.filas.find((f) => f.activo === 'BTC')!

    expect(btc.saldoTotal).toBe('0.5')
    expect(btc.existenciasFifo).toBe('0.5')
    expect(D(btc.diferencia).isZero()).toBe(true)
    expect(btc.estado).toBe('OK')
    expect(btc.motivos).toEqual([])
    expect(r.estadoGlobal).toBe('OK')

    const cola = calcularFifoActivo(diario, 'BTC')
    expect(cola.resumen.restanteTotal).toBe('0.5')
    expect(cola.transmisiones).toHaveLength(1)
    expect(cola.transmisiones[0]!.lucrativa).toBe(true)
  })

  it('una donación RECIBIDA abre lote con el valor del art. 36 LIRPF', () => {
    const recibida: Apunte = {
      id: '2026-010',
      fechaHora: '2026-03-01T10:00:00',
      tipo: 'DONACION',
      sentido: 'recibida',
      ubicacionOrigen: UBICACION_EXTERIOR,
      ubicacionDestino: KRAKEN,
      activoEntrada: 'BTC',
      cantidadEntrada: '0.2',
      contravalorEUR: '18000',
    }
    const cola = calcularFifoActivo([recibida], 'BTC')
    expect(cola.resumen.restanteTotal).toBe('0.2')
    expect(cola.resumen.costeRestanteEUR).toBe('18000')
    expect(conciliarFifoSaldos([recibida]).estadoGlobal).toBe('OK')
  })

  it('el EUR no se concilia: es moneda de cuenta y no tiene cola FIFO', () => {
    const r = conciliarFifoSaldos([COMPRA])
    expect(r.filas.map((f) => f.activo)).not.toContain('EUR')
    expect(r.estadoGlobal).toBe('OK')
  })

  it('una transmisión sin cola suficiente también sale señalada', () => {
    const ventaSinCompra: Apunte = {
      id: '2026-020',
      fechaHora: '2026-04-01T10:00:00',
      tipo: 'VENTA',
      ubicacionOrigen: KRAKEN,
      ubicacionDestino: KRAKEN,
      activoSalida: 'BTC',
      cantidadSalida: '0.3',
      activoEntrada: 'EUR',
      cantidadEntrada: '25000',
      contravalorEUR: '25000',
    }
    const r = conciliarFifoSaldos([ventaSinCompra])
    const btc = r.filas.find((f) => f.activo === 'BTC')!
    expect(btc.estado).toBe('ERROR')
    expect(btc.motivos).toContain('saldo-fifo-insuficiente')
  })

  it('un AJUSTE con cantidades corrige saldo y NO cola: descuadre visible, no silencioso', () => {
    const ajuste: Apunte = {
      id: '2026-030',
      fechaHora: '2026-05-01T10:00:00',
      tipo: 'AJUSTE',
      rectificaA: '2026-001',
      ubicacionOrigen: KRAKEN,
      ubicacionDestino: UBICACION_EXTERIOR,
      activoSalida: 'BTC',
      cantidadSalida: '0.1',
      contravalorEUR: '9000',
    }
    const btc = conciliarFifoSaldos([COMPRA, ajuste]).filas.find((f) => f.activo === 'BTC')!
    expect(btc.saldoTotal).toBe('0.9')
    expect(btc.existenciasFifo).toBe('1')
    expect(btc.estado).toBe('ERROR')
  })
})

// ────────────────────────────────────────────────────────────────────────────
describe('art. 33.5.c LIRPF · la pérdida de la donación no se computa', () => {
  const base = (contravalor: string): Apunte[] => [COMPRA, donacion('entregada', contravalor)]

  it('GANANCIA: sí se computa y entra en el cajón del ahorro', () => {
    // 0,5 BTC donados por valor ISD 30.000 €, con coste FIFO 25.000 € → +5.000 €.
    const r = calcularResumenFiscal(base('30000'), UBICS, [], 2026)
    const don = r.ahorro.operaciones.find((o) => o.tipo === 'DONACION')
    expect(don).toBeDefined()
    expect(don!.resultadoEUR).toBe('5000')
    expect(r.ahorro.gananciasEUR).toBe('5000')
    expect(r.ahorro.perdidasNoComputablesEUR).toBe('0')
  })

  it('PÉRDIDA: se muestra, se explica y NO suma al total', () => {
    // 0,5 BTC donados por valor ISD 20.000 €, con coste FIFO 25.000 € → −5.000 €.
    const r = calcularResumenFiscal(base('20000'), UBICS, [], 2026)
    const don = r.ahorro.operaciones.find((o) => o.tipo === 'DONACION')!
    expect(don.resultadoEUR).toBe('-5000')
    expect(don.perdidaNoComputable).toBe(true)
    expect(don.motivoNoComputable).toContain('33.5.c')

    expect(r.ahorro.perdidasEUR).toBe('0') // no engrosa las pérdidas compensables
    expect(r.ahorro.netoEUR).toBe('0')
    expect(r.ahorro.perdidasNoComputablesEUR).toBe('-5000')
  })

  it('la donación RECIBIDA no produce renta en el IRPF del donatario', () => {
    const recibida: Apunte = {
      id: '2026-011',
      fechaHora: '2026-03-01T10:00:00',
      tipo: 'DONACION',
      sentido: 'recibida',
      ubicacionOrigen: UBICACION_EXTERIOR,
      ubicacionDestino: KRAKEN,
      activoEntrada: 'BTC',
      cantidadEntrada: '0.2',
      contravalorEUR: '18000',
    }
    const r = calcularResumenFiscal([recibida], UBICS, [], 2026)
    expect(r.ahorro.operaciones).toHaveLength(0)
    expect(r.ahorro.netoEUR).toBe('0')
  })
})

// ────────────────────────────────────────────────────────────────────────────
describe('REGRESIÓN · el caso de ejemplo de la app concilia en CERO', () => {
  it('ningún activo del caso demo arrastra existencias fantasma', () => {
    const r = conciliarFifoSaldos([...APUNTES_CASO_DEMO], { activos: ACTIVOS_CASO_DEMO })
    expect(r.estadoGlobal).toBe('OK')
    expect(r.activosDescuadrados).toBe(0)
    for (const fila of r.filas) expect(D(fila.diferencia).isZero()).toBe(true)
  })

  it('en particular el BTC, que arrastraba 0,01 (la donación 2025-007)', () => {
    const btc = conciliarFifoSaldos([...APUNTES_CASO_DEMO], { activos: ACTIVOS_CASO_DEMO }).filas.find(
      (f) => f.activo === 'BTC',
    )!
    expect(btc.saldoTotal).toBe('0.84355')
    expect(btc.existenciasFifo).toBe('0.84355')
  })

  it('y la donación aparece ya en el resumen fiscal de 2025', () => {
    const r = calcularResumenFiscal(APUNTES_CASO_DEMO, UBICACIONES_CASO_DEMO, [], 2025)
    const don = r.ahorro.operaciones.find((o) => o.tipo === 'DONACION')
    expect(don?.resultadoEUR).toBe('499.4')
  })
})
