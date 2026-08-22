/**
 * fases-d3-d6.test.ts — pools (D3), recompra del art. 33.5.e (D4), familias E/F/G y
 * recálculo comparativo (D5), y derivados por diferencias (D6).
 */
import { describe, it, expect } from 'vitest'
import { descomponer, type Pata } from './plantillas'
import { detectarRecompras, avisosRecompra, limiteAnoSiguiente } from './recompra'
import { compararTesis } from './comparativa'
import { validarApunte, hayErrores } from '../validaciones'
import { calcularFifo, transmisionesDelDiario } from '../fifo'
import { saldosTotalesPorActivo } from '../saldos'
import { calcularResumenFiscal } from '../fiscal'
import { D } from '../decimal'
import type { Apunte } from '../types'

const eq = (a: string, b: string) => D(a).equals(D(b))
const numerar = (patas: Pata[], desde = 1): Apunte[] =>
  patas.map((p, i) => ({ ...p, id: `2026-${String(desde + i).padStart(3, '0')}` }))
const COMUN = { fechaHora: '2026-03-01T10:00:00', protocolo: 'Uniswap v3', posicionId: 'pool-1' }

// ════════════════════════════════════════════════════════════════════════════
// D3 · Pools bajo la tesis benévola
// ════════════════════════════════════════════════════════════════════════════

describe('D3 · aportación a pool: no es hecho imponible', () => {
  const patas = descomponer({
    ...COMUN,
    clase: 'pool-aportacion',
    ubicacionOrigen: 'wallet',
    ubicacionPool: 'uniswap',
    aportado: [
      { activo: 'ETH', cantidad: '10', contravalorEUR: '30000' },
      { activo: 'DAI', cantidad: '30000', contravalorEUR: '30000' },
    ],
  })

  it('genera una TRANSFERENCIA por activo aportado, y nada más', () => {
    expect(patas).toHaveLength(2)
    expect(patas.every((p) => p.tipo === 'TRANSFERENCIA')).toBe(true)
    expect(numerar(patas).every((ap) => !hayErrores(validarApunte(ap)))).toBe(true)
  })

  it('no abre ni consume lote: el LP token no entra en la cola', () => {
    const fifo = calcularFifo(numerar(patas))
    // TRANSFERENCIA no toca cola, así que no aparece ningún activo con lotes.
    expect(fifo.get('ETH')).toBeUndefined()
    expect(transmisionesDelDiario(numerar(patas))).toHaveLength(0)
  })

  it('deja escrito que se ha aplicado la tesis benévola', () => {
    expect(patas[0]?.criterioAplicado).toContain('BENÉVOLA')
    expect(patas[0]?.criterioAplicado).toContain('resguardo')
  })
})

describe('D3 · retirada de pool: el ejemplo del manual (§C6)', () => {
  // Entran 10 ETH + 30.000 DAI; salen 5 ETH + 60.000 DAI, con el ETH a 12.000 $.
  // El neto es: −5 ETH y +30.000 DAI. Solo eso se transmite.
  const patas = descomponer({
    ...COMUN,
    fechaHora: '2026-09-01T10:00:00',
    clase: 'pool-retirada',
    ubicacionPool: 'uniswap',
    ubicacionDestino: 'wallet',
    aportado: [
      { activo: 'ETH', cantidad: '10', contravalorEUR: '30000' },
      { activo: 'DAI', cantidad: '30000', contravalorEUR: '30000' },
    ],
    recuperado: [
      { activo: 'ETH', cantidad: '5', contravalorEUR: '60000' },
      { activo: 'DAI', cantidad: '60000', contravalorEUR: '60000' },
    ],
  })

  const permutas = patas.filter((p) => p.tipo === 'PERMUTA')

  it('hay UNA sola permuta: 5 ETH por 30.000 DAI', () => {
    expect(permutas).toHaveLength(1)
    expect(permutas[0]?.activoSalida).toBe('ETH')
    expect(eq(permutas[0]!.cantidadSalida!, '5')).toBe(true)
    expect(permutas[0]?.activoEntrada).toBe('DAI')
    expect(eq(permutas[0]!.cantidadEntrada!, '30000')).toBe(true)
  })

  it('se valora por el PRECIO EFECTIVAMENTE OBTENIDO: 30.000, no 60.000', () => {
    // Es la clave del criterio del autor. Con el art. 37.1.h (mayor de los dos valores)
    // saldrían 60.000 y una ganancia de 45.000 sobre valor que nunca se recibió.
    expect(eq(permutas[0]!.contravalorEUR!, '30000')).toBe(true)
  })

  it('pero conserva el importe del art. 37.1.h para poder defender el otro criterio', () => {
    expect(eq(permutas[0]!.contravalorAlternativoEUR!, '60000')).toBe(true)
  })

  it('los 5 ETH y los 30.000 DAI que no se movieron NO generan transmisión', () => {
    // Es lo que la tesis benévola persigue: no computar activos que el titular conserva.
    expect(permutas.filter((p) => p.activoSalida === 'DAI')).toHaveLength(0)
  })

  it('la vuelta de los saldos cierra el CUADRE', () => {
    const transferencias = patas.filter((p) => p.tipo === 'TRANSFERENCIA')
    expect(transferencias).toHaveLength(2)
    expect(numerar(patas).every((ap) => !hayErrores(validarApunte(ap)))).toBe(true)
  })

  it('con coste de 3.000 €/ETH, la ganancia real es 15.000 y no 45.000', () => {
    const diario = numerar([
      {
        fechaHora: '2026-01-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'wallet',
        ubicacionDestino: 'wallet',
        activoSalida: 'EUR',
        cantidadSalida: '30000',
        activoEntrada: 'ETH',
        cantidadEntrada: '10',
        contravalorEUR: '30000',
      },
      ...patas,
    ])
    const t = transmisionesDelDiario(diario).find((x) => x.activo === 'ETH')!
    expect(eq(t.costeFifoEUR, '15000')).toBe(true) // 5 × 3.000
    expect(eq(t.resultadoEUR, '15000')).toBe(true) // 30.000 − 15.000
  })
})

// ════════════════════════════════════════════════════════════════════════════
// D4 · Norma anti-aplicación del art. 33.5.e
// ════════════════════════════════════════════════════════════════════════════

const compra = (id: string, fecha: string, cant: string, eur: string): Apunte => ({
  id,
  fechaHora: fecha,
  tipo: 'COMPRA',
  ubicacionOrigen: 'ex',
  ubicacionDestino: 'ex',
  activoSalida: 'EUR',
  cantidadSalida: eur,
  activoEntrada: 'BTC',
  cantidadEntrada: cant,
  contravalorEUR: eur,
})
const venta = (id: string, fecha: string, cant: string, eur: string): Apunte => ({
  id,
  fechaHora: fecha,
  tipo: 'VENTA',
  ubicacionOrigen: 'ex',
  ubicacionDestino: 'ex',
  activoSalida: 'BTC',
  cantidadSalida: cant,
  activoEntrada: 'EUR',
  cantidadEntrada: eur,
  contravalorEUR: eur,
})

describe('D4 · detector del art. 33.5.e', () => {
  it('el límite es un año natural desde la transmisión, «de fecha a fecha»', () => {
    expect(limiteAnoSiguiente('2026-03-01T10:00:00')).toBe('2027-03-01T10:00:00')
    expect(limiteAnoSiguiente('2026-12-31T23:59:59')).toBe('2027-12-31T23:59:59')
  })

  it('NO depende de la zona horaria del equipo', () => {
    // Regresión: la primera versión pasaba por `new Date` + `toISOString()`, que convierte
    // a UTC. En un equipo en Europe/Madrid el límite salía desplazado una o dos horas según
    // el horario de verano, y con él la frontera del año: el mismo Libro daba un resultado
    // fiscal distinto en Madrid que en un servidor en UTC. Las marcas del Libro son ISO en
    // hora LOCAL y aquí no se sale nunca del calendario local.
    const original = process.env.TZ
    try {
      for (const tz of ['UTC', 'Europe/Madrid', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = tz
        expect(limiteAnoSiguiente('2026-03-01T10:00:00')).toBe('2027-03-01T10:00:00')
      }
    } finally {
      process.env.TZ = original
    }
  })

  it('el 29 de febrero vence el 28 si el año siguiente no es bisiesto', () => {
    expect(limiteAnoSiguiente('2024-02-29T10:00:00')).toBe('2025-02-28T10:00:00')
    // Y se mantiene el 29 cuando el año de vencimiento sí lo es.
    expect(limiteAnoSiguiente('2099-02-28T10:00:00')).toBe('2100-02-28T10:00:00')
  })

  it('recompra a los 11 meses → pérdida DIFERIDA', () => {
    const diario = [
      compra('2026-001', '2026-01-01T10:00:00', '1', '40000'),
      venta('2026-002', '2026-02-01T10:00:00', '1', '30000'), // pérdida de 10.000
      compra('2026-003', '2027-01-01T10:00:00', '1', '31000'), // 11 meses después
    ]
    const [p] = detectarRecompras(diario)
    expect(p).toBeDefined()
    expect(eq(p!.perdidaEUR, '10000')).toBe(true)
    expect(eq(p!.importeDiferidoEUR, '10000')).toBe(true)
    expect(eq(p!.importeComputableEUR, '0')).toBe(true)
  })

  it('recompra a los 13 meses → la pérdida SÍ se computa', () => {
    const diario = [
      compra('2026-001', '2026-01-01T10:00:00', '1', '40000'),
      venta('2026-002', '2026-02-01T10:00:00', '1', '30000'),
      compra('2026-003', '2027-03-05T10:00:00', '1', '31000'), // fuera del año
    ]
    expect(detectarRecompras(diario)).toHaveLength(0)
  })

  it('compra ANTERIOR a la venta: no activa la regla (la letra e solo mira hacia delante)', () => {
    // Es la asimetría del precepto frente a las letras f) y g), que sí miran hacia atrás.
    const diario = [
      compra('2026-001', '2026-01-01T10:00:00', '1', '40000'),
      compra('2026-002', '2026-01-15T10:00:00', '1', '38000'), // previa a la venta
      venta('2026-003', '2026-02-01T10:00:00', '1', '30000'),
    ]
    expect(detectarRecompras(diario)).toHaveLength(0)
  })

  it('recompra PARCIAL: se difiere solo la parte proporcional', () => {
    const diario = [
      compra('2026-001', '2026-01-01T10:00:00', '2', '80000'),
      venta('2026-002', '2026-02-01T10:00:00', '2', '60000'), // pérdida de 20.000
      compra('2026-003', '2026-06-01T10:00:00', '0.5', '16000'), // recompra 1/4
    ]
    const [p] = detectarRecompras(diario)
    expect(eq(p!.cantidadReadquirida, '0.5')).toBe(true)
    expect(eq(p!.importeDiferidoEUR, '5000')).toBe(true) // 20.000 × 0,25
    expect(eq(p!.importeComputableEUR, '15000')).toBe(true)
  })

  it('una sola recompra no puede diferir dos ventas por la misma cantidad', () => {
    const diario = [
      compra('2026-001', '2026-01-01T10:00:00', '2', '80000'),
      venta('2026-002', '2026-02-01T10:00:00', '1', '30000'),
      venta('2026-003', '2026-03-01T10:00:00', '1', '30000'),
      compra('2026-004', '2026-06-01T10:00:00', '1', '31000'), // solo cubre una
    ]
    const ps = detectarRecompras(diario)
    expect(ps).toHaveLength(1)
    expect(ps[0]?.apunteId).toBe('2026-002') // la primera en el tiempo
  })

  it('una ganancia nunca activa la regla', () => {
    const diario = [
      compra('2026-001', '2026-01-01T10:00:00', '1', '30000'),
      venta('2026-002', '2026-02-01T10:00:00', '1', '40000'), // ganancia
      compra('2026-003', '2026-06-01T10:00:00', '1', '41000'),
    ]
    expect(detectarRecompras(diario)).toHaveLength(0)
  })

  it('el aviso explica que la pérdida se aplaza, no se pierde', () => {
    const diario = [
      compra('2026-001', '2026-01-01T10:00:00', '1', '40000'),
      venta('2026-002', '2026-02-01T10:00:00', '1', '30000'),
      compra('2026-003', '2026-06-01T10:00:00', '1', '31000'),
    ]
    const [a] = avisosRecompra(diario)
    expect(a?.nivel).toBe('aviso') // avisa, no bloquea
    expect(a?.codigo).toBe('RECOMPRA_33_5_E')
    expect(a?.mensaje).toContain('se aplaza')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// D5 · Familias E, F, G y recálculo comparativo
// ════════════════════════════════════════════════════════════════════════════

describe('D5 · hard fork: decisión manual entre las dos posturas', () => {
  const comunFork = {
    ...COMUN,
    protocolo: 'Bitcoin',
    clase: 'hard-fork' as const,
    ubicacionDestino: 'wallet',
    activo: 'BCH',
    cantidad: '1',
    contravalorEUR: '300',
  }

  it('postura airdrop: ganancia a valor de mercado, base general', () => {
    const [p] = descomponer({ ...comunFork, postura: 'airdrop' })
    expect(p?.tipo).toBe('AIRDROP')
    expect(eq(p!.contravalorEUR!, '300')).toBe(true)
    expect(eq(p!.contravalorAlternativoEUR!, '0')).toBe(true)
  })

  it('postura coste cero: COMPRA a 0, con la tributación diferida a la venta', () => {
    const [p] = descomponer({ ...comunFork, postura: 'coste-cero' })
    expect(p?.tipo).toBe('COMPRA')
    expect(eq(p!.contravalorEUR!, '0')).toBe(true)
    expect(eq(p!.contravalorAlternativoEUR!, '300')).toBe(true)
  })
})

describe('D5 · airdrop condicionado', () => {
  const comunAd = {
    ...COMUN,
    protocolo: 'Protocolo X',
    clase: 'airdrop-condicionado' as const,
    ubicacionDestino: 'wallet',
    activo: 'TKN',
    cantidad: '500',
    contravalorEUR: '750',
  }

  it('sin contraprestación sigue el régimen del art. 37.1.l', () => {
    expect(descomponer({ ...comunAd, hayContraprestacion: false })[0]?.tipo).toBe('AIRDROP')
  })

  it('con contraprestación se aleja de la incorporación gratuita', () => {
    expect(descomponer({ ...comunAd, hayContraprestacion: true })[0]?.tipo).toBe('RENDIMIENTO')
  })
})

describe('D5 · recálculo comparativo de la zona gris', () => {
  const diario = numerar([
    {
      fechaHora: '2026-01-01T10:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'wallet',
      ubicacionDestino: 'wallet',
      activoSalida: 'EUR',
      cantidadSalida: '30000',
      activoEntrada: 'ETH',
      cantidadEntrada: '10',
      contravalorEUR: '30000',
    },
    ...descomponer({
      ...COMUN,
      fechaHora: '2026-09-01T10:00:00',
      clase: 'pool-retirada',
      ubicacionPool: 'uniswap',
      ubicacionDestino: 'wallet',
      aportado: [
        { activo: 'ETH', cantidad: '10', contravalorEUR: '30000' },
        { activo: 'DAI', cantidad: '30000', contravalorEUR: '30000' },
      ],
      recuperado: [
        { activo: 'ETH', cantidad: '5', contravalorEUR: '60000' },
        { activo: 'DAI', cantidad: '60000', contravalorEUR: '60000' },
      ],
    }),
  ])

  const c = compararTesis(diario)

  it('mide cuánto mueve aplicar el art. 37.1.h en lugar del precio efectivo', () => {
    expect(c.apuntesConAlternativa).toBe(1)
    expect(eq(c.totalAplicadoEUR, '15000')).toBe(true)
    expect(eq(c.totalAlternativoEUR, '45000')).toBe(true)
    // 30.000 € de diferencia: exactamente el valor que el titular nunca recibió.
    expect(eq(c.diferenciaEUR, '30000')).toBe(true)
  })

  it('el detalle identifica el apunte y su criterio', () => {
    expect(c.detalle).toHaveLength(1)
    expect(c.detalle[0]?.criterioAplicado).toContain('precio efectivamente obtenido')
    expect(eq(c.detalle[0]!.diferenciaEUR, '30000')).toBe(true)
  })

  it('sin apuntes de zona gris, no hay diferencia que enseñar', () => {
    const simple = numerar([
      {
        fechaHora: '2026-01-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'w',
        ubicacionDestino: 'w',
        activoSalida: 'EUR',
        cantidadSalida: '100',
        activoEntrada: 'BTC',
        cantidadEntrada: '1',
        contravalorEUR: '100',
      },
    ])
    expect(compararTesis(simple).apuntesConAlternativa).toBe(0)
    expect(eq(compararTesis(simple).diferenciaEUR, '0')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// D6 · Derivados liquidados por diferencias (12.º tipo)
// ════════════════════════════════════════════════════════════════════════════

describe('D6 · cierre de posición con GANANCIA', () => {
  const patas = descomponer({
    ...COMUN,
    protocolo: 'Binance Futures',
    posicionId: 'perp-1',
    clase: 'derivado',
    ubicacion: 'binance',
    resultadoNetoEUR: '300',
    activo: 'USDT',
    cantidad: '300',
  })

  it('una sola pata LIQUIDACION_DERIVADO', () => {
    expect(patas).toHaveLength(1)
    expect(patas[0]?.tipo).toBe('LIQUIDACION_DERIVADO')
    expect(numerar(patas).every((ap) => !hayErrores(validarApunte(ap)))).toBe(true)
  })

  it('abre lote por lo acreditado y NO consume ninguno', () => {
    const diario = numerar(patas)
    const usdt = calcularFifo(diario).get('USDT')!.resumen
    expect(eq(usdt.restanteTotal, '300')).toBe(true)
    expect(eq(usdt.costeRestanteEUR, '300')).toBe(true)
    // En una liquidación por diferencias no se entrega el subyacente.
    expect(transmisionesDelDiario(diario)).toHaveLength(0)
  })

  it('el resultado va al cajón de derivados, en la base del ahorro', () => {
    const r = calcularResumenFiscal(numerar(patas), [], [], 2026)
    expect(eq(r.derivados.totalEUR, '300')).toBe(true)
    // No contamina el bloque de transmisiones ni el de RCM.
    expect(eq(r.ahorro.netoEUR, '0')).toBe(true)
    expect(eq(r.rcm.totalEUR, '0')).toBe(true)
  })

  it('deja constancia de que el art. 37.1.m no aplica', () => {
    expect(patas[0]?.notas).toContain('37.1.m')
    expect(patas[0]?.notas).toContain('1814/1991')
  })
})

describe('D6 · cierre de posición con PÉRDIDA: el doble efecto del manual', () => {
  const patas = descomponer({
    ...COMUN,
    protocolo: 'Binance Futures',
    posicionId: 'perp-2',
    clase: 'derivado',
    ubicacion: 'binance',
    resultadoNetoEUR: '-300',
    activo: 'USDT',
    cantidad: '300',
    contravalorActivoEUR: '300',
  })

  it('genera DOS patas: la pérdida de la posición y la entrega que la salda', () => {
    expect(patas).toHaveLength(2)
    expect(patas[0]?.tipo).toBe('LIQUIDACION_DERIVADO')
    expect(patas[1]?.tipo).toBe('PAGO')
    expect(patas[1]?.notas).toContain('doble efecto')
  })

  it('la entrega consume cola FIFO con su propia GyP', () => {
    const diario = numerar([
      {
        fechaHora: '2026-01-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'binance',
        ubicacionDestino: 'binance',
        activoSalida: 'EUR',
        cantidadSalida: '290',
        activoEntrada: 'USDT',
        cantidadEntrada: '300',
        contravalorEUR: '290',
      },
      ...patas,
    ])
    const t = transmisionesDelDiario(diario)
    expect(t).toHaveLength(1)
    // 300 de valor menos 290 de coste: 10 € de ganancia por la variación del USDT.
    expect(eq(t[0]!.resultadoEUR, '10')).toBe(true)

    const r = calcularResumenFiscal(diario, [], [], 2026)
    expect(eq(r.derivados.totalEUR, '-300')).toBe(true)
    expect(eq(r.ahorro.netoEUR, '10')).toBe(true)
  })

  it('el saldo de USDT queda a cero y la cola con él: el invariante de D0 se mantiene', () => {
    const diario = numerar([
      {
        fechaHora: '2026-01-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'binance',
        ubicacionDestino: 'binance',
        activoSalida: 'EUR',
        cantidadSalida: '290',
        activoEntrada: 'USDT',
        cantidadEntrada: '300',
        contravalorEUR: '290',
      },
      ...patas,
    ])
    const saldo = saldosTotalesPorActivo(diario, '2026-12-31T23:59:59').get('USDT') ?? '0'
    const cola = calcularFifo(diario).get('USDT')!.resumen.restanteTotal
    expect(eq(saldo, '0')).toBe(true)
    expect(eq(cola, saldo)).toBe(true)
  })
})

describe('D6 · el tipo nuevo rechaza lo que no le corresponde', () => {
  it('una LIQUIDACION_DERIVADO con lado de salida es un error', () => {
    const mal: Apunte = {
      id: '2026-001',
      fechaHora: '2026-03-01T10:00:00',
      tipo: 'LIQUIDACION_DERIVADO',
      ubicacionOrigen: 'binance',
      ubicacionDestino: 'binance',
      activoSalida: 'BTC',
      cantidadSalida: '1',
      contravalorEUR: '-300',
    }
    const avisos = validarApunte(mal)
    expect(avisos.some((a) => a.codigo === 'DERIVADO_CON_SALIDA' && a.nivel === 'error')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// D6 bis · el art. 33.5 no alcanza a los derivados (V2770-19) — revisión 20-8-2026
// ════════════════════════════════════════════════════════════════════════════

describe('D6 · una pérdida en derivados no se difiere aunque se reabra posición', () => {
  // La DGT (V2770-19, con precedente para futuros en V3755-16) declara que las letras e),
  // f) y g) del art. 33.5 no se aplican a los contratos por diferencias: no son valores y
  // no son elementos susceptibles de ser transmitidos y posteriormente adquiridos. El motor
  // lo cumple por construcción —LIQUIDACION_DERIVADO tiene `consumeLote: false`, luego no
  // genera transmisión en la cola FIFO—, y este test lo fija para que no se rompa al tocar
  // el detector.
  const cierreConPerdida = descomponer({
    fechaHora: '2026-06-01T10:00:00',
    protocolo: 'Binance Futures',
    clase: 'derivado',
    ubicacion: 'binance',
    resultadoNetoEUR: '-500',
  })
  const reapertura = descomponer({
    fechaHora: '2026-06-15T10:00:00',
    protocolo: 'Binance Futures',
    clase: 'derivado',
    ubicacion: 'binance',
    resultadoNetoEUR: '400',
    activo: 'USDT',
    cantidad: '400',
  })
  const diario = numerar([...cierreConPerdida, ...reapertura])

  it('no produce ninguna transmisión que el detector pueda mirar', () => {
    expect(transmisionesDelDiario(diario)).toHaveLength(0)
  })

  it('no genera diferimiento del art. 33.5.e ni aviso de recompra', () => {
    expect(detectarRecompras(diario)).toHaveLength(0)
    expect(avisosRecompra(diario)).toHaveLength(0)
  })
})
