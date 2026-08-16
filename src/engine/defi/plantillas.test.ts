/**
 * plantillas.test.ts — D2: familias A (cesión de capitales) y B (préstamo).
 *
 * Lo que se comprueba no es solo que salgan las patas correctas, sino que al pasarlas por
 * el motor completo (validaciones + FIFO) el resultado fiscal sea el que el manual y las
 * decisiones del autor exigen.
 */
import { describe, it, expect } from 'vitest'
import { descomponer, CRITERIO_POR_DEFECTO, type Pata } from './plantillas'
import { validarApunte, hayErrores } from '../validaciones'
import { calcularFifo, transmisionesDelDiario } from '../fifo'
import { saldosTotalesPorActivo } from '../saldos'
import { D } from '../decimal'
import type { Apunte } from '../types'

const eq = (a: string, b: string) => D(a).equals(D(b))

/** Numera las patas para poder pasarlas por el motor (el repositorio hace esto al guardar). */
const numerar = (patas: Pata[], desde = 1): Apunte[] =>
  patas.map((p, i) => ({ ...p, id: `2026-${String(desde + i).padStart(3, '0')}` }))

/** Toda pata generada debe ser válida por sí sola: la app no genera apuntes con errores. */
const sinErrores = (patas: Pata[]) =>
  numerar(patas).every((ap) => !hayErrores(validarApunte(ap)))

const COMUN = { fechaHora: '2026-03-01T10:00:00', protocolo: 'Aave', posicionId: 'pos-1' }

// ────────────────────────────────────────────────────────────────────────────

describe('D2 · A1/A2 · recompensas de staking', () => {
  it('genera un RENDIMIENTO (RCM) desde EXTERIOR', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'recompensa',
      evento: 'STAKING_CENTRALIZADO',
      ubicacionDestino: 'kraken',
      activo: 'ETH',
      cantidad: '0.05',
      contravalorEUR: '150',
    })
    expect(p?.tipo).toBe('RENDIMIENTO')
    expect(p?.ubicacionOrigen).toBe('EXTERIOR')
    expect(p?.ubicacionDestino).toBe('kraken')
    expect(p?.contravalorEUR).toBe('150')
    expect(sinErrores([p!])).toBe(true)
  })

  it('la minería PoW es actividad económica, no RCM', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'recompensa',
      evento: 'STAKING_NATIVO',
      ubicacionDestino: 'wallet',
      activo: 'BTC',
      cantidad: '0.01',
      contravalorEUR: '400',
      actividadEconomica: true,
    })
    expect(p?.tipo).toBe('MINERIA')
  })

  it('la fecha del apunte es la que se le da: debe ser la de DISPONIBILIDAD (V0612-26)', () => {
    // El criterio del art. 14.1.a mira a cuándo el titular puede disponer, no al devengo.
    const [p] = descomponer({
      ...COMUN,
      fechaHora: '2026-04-15T08:00:00', // fecha del claim
      clase: 'recompensa',
      evento: 'POOL_RECOMPENSA',
      ubicacionDestino: 'wallet',
      activo: 'UNI',
      cantidad: '10',
      contravalorEUR: '60',
    })
    expect(p?.fechaHora).toBe('2026-04-15T08:00:00')
  })

  it('una recompensa NO admite comisión: el RCM no tiene gastos deducibles', () => {
    // La plantilla no ofrece comisión en recompensas, y si alguien la cuela a mano, la
    // validación lo bloquea (art. 26 LIRPF, V0648-24).
    const conComision: Apunte = {
      id: '2026-001',
      fechaHora: '2026-03-01T10:00:00',
      tipo: 'RENDIMIENTO',
      ubicacionOrigen: 'EXTERIOR',
      ubicacionDestino: 'kraken',
      activoEntrada: 'ETH',
      cantidadEntrada: '0.05',
      contravalorEUR: '150',
      comisionCantidad: '2',
      comisionActivo: 'EUR',
    }
    const avisos = validarApunte(conComision)
    expect(avisos.some((a) => a.codigo === 'RCM_CON_GASTO' && a.nivel === 'error')).toBe(true)
  })

  it('pero la MINERÍA sí la admite: en actividad económica los gastos son deducibles', () => {
    const mineria: Apunte = {
      id: '2026-001',
      fechaHora: '2026-03-01T10:00:00',
      tipo: 'MINERIA',
      ubicacionOrigen: 'EXTERIOR',
      ubicacionDestino: 'wallet',
      activoEntrada: 'BTC',
      cantidadEntrada: '0.01',
      contravalorEUR: '400',
      comisionCantidad: '5',
      comisionActivo: 'EUR',
    }
    expect(validarApunte(mineria).some((a) => a.codigo === 'RCM_CON_GASTO')).toBe(false)
  })
})

describe('D2 · A1 · bloqueo de tokens', () => {
  it('no genera pata si el activo no cambia de ubicación', () => {
    const patas = descomponer({
      ...COMUN,
      clase: 'bloqueo',
      evento: 'STAKING_CENTRALIZADO',
      ubicacionOrigen: 'kraken',
      ubicacionDestino: 'kraken',
      activo: 'ETH',
      cantidad: '1',
    })
    // No hay alteración patrimonial y tampoco movimiento: no hay nada que anotar.
    expect(patas).toHaveLength(0)
  })

  it('genera TRANSFERENCIA si cambia de ubicación', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'bloqueo',
      evento: 'STAKING_CENTRALIZADO',
      ubicacionOrigen: 'kraken',
      ubicacionDestino: 'lido',
      activo: 'ETH',
      cantidad: '1',
    })
    expect(p?.tipo).toBe('TRANSFERENCIA')
    expect(p?.activoEntrada).toBe(p?.activoSalida)
    expect(sinErrores([p!])).toBe(true)
  })
})

describe('D2 · A3 · staking líquido', () => {
  it('el canje es PERMUTA y deja escrito el criterio por defecto (zona gris)', () => {
    const [p] = descomponer({
      ...COMUN,
      protocolo: 'Lido',
      clase: 'canje-liquido',
      evento: 'STAKING_LIQUIDO',
      ubicacion: 'wallet',
      activoEntregado: 'ETH',
      cantidadEntregada: '1',
      activoRecibido: 'rETH',
      cantidadRecibida: '0.95',
      contravalorEUR: '3000',
    })
    expect(p?.tipo).toBe('PERMUTA')
    expect(p?.criterioAplicado).toBe(CRITERIO_POR_DEFECTO.STAKING_LIQUIDO)
    expect(p?.criterioAplicado).toContain('37.1.h')
    expect(sinErrores([p!])).toBe(true)
  })

  it('ETH y rETH son activos distintos: dos colas FIFO independientes', () => {
    const diario = numerar([
      {
        fechaHora: '2026-01-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'wallet',
        ubicacionDestino: 'wallet',
        activoSalida: 'EUR',
        cantidadSalida: '2000',
        activoEntrada: 'ETH',
        cantidadEntrada: '1',
        contravalorEUR: '2000',
      },
      ...descomponer({
        ...COMUN,
        fechaHora: '2026-02-01T10:00:00',
        protocolo: 'Lido',
        clase: 'canje-liquido',
        evento: 'STAKING_LIQUIDO',
        ubicacion: 'wallet',
        activoEntregado: 'ETH',
        cantidadEntregada: '1',
        activoRecibido: 'rETH',
        cantidadRecibida: '0.95',
        contravalorEUR: '3000',
      }),
    ])

    const fifo = calcularFifo(diario)
    // El ETH se consume entero; nace un lote de rETH a 3.000 €.
    expect(eq(fifo.get('ETH')!.resumen.restanteTotal, '0')).toBe(true)
    expect(eq(fifo.get('rETH')!.resumen.restanteTotal, '0.95')).toBe(true)
    expect(eq(fifo.get('rETH')!.resumen.costeRestanteEUR, '3000')).toBe(true)
    // Y la permuta aflora la ganancia: 3.000 − 2.000 = 1.000.
    expect(eq(transmisionesDelDiario(diario)[0]!.resultadoEUR, '1000')).toBe(true)
  })
})

describe('D2 · B1 · préstamo desde el lado del prestamista', () => {
  it('la entrega al protocolo es neutra (TRANSFERENCIA)', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'movimiento-prestamo',
      evento: 'LENDING_PRESTAMISTA',
      ubicacionOrigen: 'wallet',
      ubicacionDestino: 'aave',
      activo: 'USDC',
      cantidad: '10000',
    })
    expect(p?.tipo).toBe('TRANSFERENCIA')
    expect(sinErrores([p!])).toBe(true)
  })

  it('la devolución en activo DISTINTO rompe el mutuo neutro: es PERMUTA', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'devolucion-distinta',
      ubicacion: 'aave',
      activoEntregado: 'USDC',
      cantidadEntregada: '10000',
      activoRecibido: 'ETH',
      cantidadRecibida: '3',
      contravalorEUR: '9200',
    })
    expect(p?.tipo).toBe('PERMUTA')
    expect(p?.criterioAplicado).toContain('1753 CC')
    expect(sinErrores([p!])).toBe(true)
  })

  it('la ejecución de la garantía es COMPRA a valor de mercado en la FECHA DE EJECUCIÓN', () => {
    const [p] = descomponer({
      ...COMUN,
      fechaHora: '2026-09-01T12:00:00',
      clase: 'ejecucion-garantia',
      ubicacionDestino: 'wallet',
      activo: 'BTC',
      cantidad: '0.2',
      contravalorEUR: '18000',
    })
    expect(p?.tipo).toBe('COMPRA')
    expect(p?.contravalorEUR).toBe('18000')
    expect(p?.evento).toBe('EJECUCION_GARANTIA')
    // El crédito queda satisfecho en especie: no sigue el art. 14.2.k.
    expect(p?.notas).toContain('14.2.k')
    // COMPRA sin lado de salida: la contrapartida es la extinción del crédito.
    expect(p?.activoSalida).toBeUndefined()
    expect(sinErrores([p!])).toBe(true)
  })

  it('el colateral adquirido abre lote con la base actualizada', () => {
    const diario = numerar(
      descomponer({
        ...COMUN,
        fechaHora: '2026-09-01T12:00:00',
        clase: 'ejecucion-garantia',
        ubicacionDestino: 'wallet',
        activo: 'BTC',
        cantidad: '0.2',
        contravalorEUR: '18000',
      }),
    )
    const btc = calcularFifo(diario).get('BTC')!.resumen
    expect(eq(btc.restanteTotal, '0.2')).toBe(true)
    expect(eq(btc.costeRestanteEUR, '18000')).toBe(true)
    // Y no es renta: no genera ninguna transmisión declarable.
    expect(transmisionesDelDiario(diario)).toHaveLength(0)
  })
})

describe('D2 · B2 · préstamo desde el lado del prestatario', () => {
  it('la recepción del principal es COMPRA sin salida: la deuda vive en la posición', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'principal-recibido',
      ubicacionDestino: 'wallet',
      activo: 'USDC',
      cantidad: '10000',
      contravalorEUR: '9200',
    })
    expect(p?.tipo).toBe('COMPRA')
    expect(p?.activoSalida).toBeUndefined()
    expect(p?.criterioAplicado).toBe(CRITERIO_POR_DEFECTO.LENDING_PRESTATARIO)
    expect(sinErrores([p!])).toBe(true)
  })

  it('sin ese lote, vender lo prestado computaría ganancia por el 100 %: con él, no', () => {
    const diario = numerar([
      ...descomponer({
        ...COMUN,
        fechaHora: '2026-03-01T10:00:00',
        clase: 'principal-recibido',
        ubicacionDestino: 'wallet',
        activo: 'USDC',
        cantidad: '10000',
        contravalorEUR: '9200',
      }),
      {
        fechaHora: '2026-04-01T10:00:00',
        tipo: 'VENTA',
        ubicacionOrigen: 'wallet',
        ubicacionDestino: 'wallet',
        activoSalida: 'USDC',
        cantidadSalida: '10000',
        activoEntrada: 'EUR',
        cantidadEntrada: '9300',
        contravalorEUR: '9300',
      },
    ])
    const venta = transmisionesDelDiario(diario)[0]!
    expect(eq(venta.costeFifoEUR, '9200')).toBe(true)
    // 9.300 − 9.200 = 100, no 9.300.
    expect(eq(venta.resultadoEUR, '100')).toBe(true)
  })

  it('el interés pagado en cripto es PAGO: no deducible, pero sí transmisión', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'salida-prestamo',
      motivo: 'interes',
      ubicacionOrigen: 'wallet',
      activo: 'ETH',
      cantidad: '0.05',
      contravalorEUR: '150',
    })
    expect(p?.tipo).toBe('PAGO')
    expect(p?.notas).toContain('no es deducible')
    expect(sinErrores([p!])).toBe(true)
  })

  it('la liquidación forzosa es una dación en pago, y lo dice', () => {
    const [p] = descomponer({
      ...COMUN,
      clase: 'salida-prestamo',
      motivo: 'liquidacion-forzosa',
      ubicacionOrigen: 'aave',
      activo: 'BTC',
      cantidad: '0.2',
      contravalorEUR: '18000',
    })
    expect(p?.tipo).toBe('PAGO')
    expect(p?.notas).toContain('LIQUIDACIÓN FORZOSA')
    expect(p?.notas).toContain('deuda')
  })
})

describe('D2 · ciclo completo de un préstamo con colateral (prestatario)', () => {
  // Aporta 0,5 BTC de colateral (comprados a 20.000 €), recibe 10.000 USDC (9.200 €),
  // paga 100 USDC de interés, devuelve el principal y recupera el colateral.
  const diario = numerar([
    {
      fechaHora: '2026-01-01T10:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'wallet',
      ubicacionDestino: 'wallet',
      activoSalida: 'EUR',
      cantidadSalida: '20000',
      activoEntrada: 'BTC',
      cantidadEntrada: '0.5',
      contravalorEUR: '20000',
    },
    ...descomponer({
      ...COMUN,
      fechaHora: '2026-02-01T10:00:00',
      clase: 'movimiento-prestamo',
      evento: 'LENDING_PRESTATARIO',
      ubicacionOrigen: 'wallet',
      ubicacionDestino: 'aave',
      activo: 'BTC',
      cantidad: '0.5',
    }),
    ...descomponer({
      ...COMUN,
      fechaHora: '2026-02-01T10:05:00',
      clase: 'principal-recibido',
      ubicacionDestino: 'wallet',
      activo: 'USDC',
      cantidad: '10000',
      contravalorEUR: '9200',
    }),
    ...descomponer({
      ...COMUN,
      fechaHora: '2026-06-01T10:00:00',
      clase: 'salida-prestamo',
      motivo: 'interes',
      ubicacionOrigen: 'wallet',
      activo: 'USDC',
      cantidad: '100',
      contravalorEUR: '93',
    }),
    ...descomponer({
      ...COMUN,
      fechaHora: '2026-07-01T10:00:00',
      clase: 'salida-prestamo',
      motivo: 'devolucion-principal',
      ubicacionOrigen: 'wallet',
      activo: 'USDC',
      cantidad: '9900',
      contravalorEUR: '9500',
    }),
    ...descomponer({
      ...COMUN,
      fechaHora: '2026-07-01T10:05:00',
      clase: 'movimiento-prestamo',
      evento: 'LENDING_PRESTATARIO',
      ubicacionOrigen: 'aave',
      ubicacionDestino: 'wallet',
      activo: 'BTC',
      cantidad: '0.5',
    }),
  ])

  it('todas las patas son válidas', () => {
    expect(diario.every((ap) => !hayErrores(validarApunte(ap)))).toBe(true)
  })

  it('el colateral vuelve intacto: mismo saldo, misma antigüedad, mismo coste', () => {
    const btc = calcularFifo(diario).get('BTC')!.resumen
    expect(eq(btc.restanteTotal, '0.5')).toBe(true)
    expect(eq(btc.costeRestanteEUR, '20000')).toBe(true)
    // Aportar y recuperar el colateral no transmite: sigue siendo del titular.
    expect(transmisionesDelDiario(diario).some((t) => t.activo === 'BTC')).toBe(false)
  })

  it('el USDC prestado se consume entero y su cola queda a cero', () => {
    const usdc = calcularFifo(diario).get('USDC')!.resumen
    expect(eq(usdc.adquiridoTotal, '10000')).toBe(true)
    expect(eq(usdc.consumidoTotal, '10000')).toBe(true)
    expect(eq(usdc.restanteTotal, '0')).toBe(true)
  })

  it('aflora la variación de valor del activo prestado: 393 € de ganancia', () => {
    // Coste del lote: 9.200 € por 10.000 USDC → 0,92 €/USDC.
    // Interés:    93 − (100 × 0,92 = 92)     =   1 €
    // Devolución: 9.500 − (9.900 × 0,92 = 9.108) = 392 €
    const ts = transmisionesDelDiario(diario).filter((t) => t.activo === 'USDC')
    expect(ts).toHaveLength(2)
    expect(eq(ts[0]!.resultadoEUR, '1')).toBe(true)
    expect(eq(ts[1]!.resultadoEUR, '392')).toBe(true)
    const total = ts.reduce((a, t) => a.plus(D(t.resultadoEUR)), D('0'))
    expect(eq(total.toFixed(), '393')).toBe(true)
  })

  it('los saldos cierran donde deben', () => {
    const saldos = saldosTotalesPorActivo(diario, '2026-12-31T23:59:59')
    expect(eq(saldos.get('BTC') ?? '0', '0.5')).toBe(true)
    expect(eq(saldos.get('USDC') ?? '0', '0')).toBe(true)
  })
})
