/**
 * casos.test.ts — pruebas del CATÁLOGO DE CASOS del taller.
 *
 * Dos familias de comprobaciones, y las dos importan:
 *
 *  1. **Todo caso es CARGABLE.** Correlativos coherentes con la fecha, diario en orden
 *     cronológico no decreciente (lo exige `calcularFifo`), ubicaciones y activos referidos
 *     que existen, y saldos reales declarados sobre celdas que el Libro conoce. Un caso que
 *     no carga no llega a clase.
 *
 *  2. **Todo caso FALLA COMO PROMETE.** Un ejercicio cuyo defecto no se manifiesta no enseña
 *     nada: si el caso de la Unidad 5 cuadrara, no habría nada que cuadrar. Cada caso tiene
 *     aquí su prueba propia —con el motor, no con cifras copiadas a mano— y, cuando trae
 *     solución cerrada, se APLICA la solución y se comprueba que efectivamente arregla el
 *     caso. Esa segunda mitad es la que evita que la solución del profesor envejezca sin que
 *     nadie se entere.
 *
 * Pruebas de datos y motor: TypeScript puro, sin IndexedDB. La carga en la base la cubre
 * `src/data/repositorio.test.ts` para la función `cargarCaso`, que es la misma para todos.
 */
import { describe, it, expect } from 'vitest'
import { CASOS_TALLER, casoPorId } from './index'
import type { CasoTaller } from './tipos'
import {
  type Apunte,
  ACTIVOS_BASE,
  UBICACION_EXTERIOR,
  CATALOGO_TIPOS,
} from '../../engine/types'
import { calcularSaldos } from '../../engine/saldos'
import { calcularCuadre } from '../../engine/cuadre'
import { conciliarFifoSaldos } from '../../engine/conciliacion'
import { validarDiario, hayErrores } from '../../engine/validaciones'
import { calcularFifo, exigirOrdenCronologico } from '../../engine/fifo'
import { calcularResumenFiscal } from '../../engine/fiscal'

/** Atajo: los apuntes del caso como array mutable (el motor los ordena y recorre). */
function apuntesDe(caso: CasoTaller): Apunte[] {
  return [...caso.datos.apuntes]
}

/** Inserta apuntes en el diario y lo devuelve reordenado por fecha (como hace la app). */
function conApuntes(base: readonly Apunte[], ...nuevos: Apunte[]): Apunte[] {
  return [...base, ...nuevos].sort(
    (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime(),
  )
}

/** Sustituye un apunte por su versión corregida, conservando el orden. */
function reemplazando(base: readonly Apunte[], id: string, cambio: Partial<Apunte>): Apunte[] {
  return base.map((a) => (a.id === id ? ({ ...a, ...cambio } as Apunte) : a))
}

/** Filas del cuadre del caso, con sus saldos reales declarados. */
function cuadreDe(caso: CasoTaller, apuntes: readonly Apunte[] = caso.datos.apuntes) {
  return calcularCuadre(calcularSaldos([...apuntes]), [...(caso.datos.cuadreReal ?? [])])
}

/** Conciliación FIFO↔SALDOS del caso, con su catálogo de activos. */
function conciliacionDe(caso: CasoTaller, apuntes: readonly Apunte[] = caso.datos.apuntes) {
  return conciliarFifoSaldos([...apuntes], { activos: caso.datos.activos })
}

/** Todas las transmisiones del diario, aplanadas (activo a activo). */
function transmisionesDe(apuntes: readonly Apunte[]) {
  return [...calcularFifo([...apuntes]).values()].flatMap((r) => r.transmisiones)
}

// ────────────────────────────────────────────────────────────────────────────
// 1. El catálogo
// ────────────────────────────────────────────────────────────────────────────

describe('catálogo de casos del taller', () => {
  it('tiene seis casos, uno por unidad, con identificadores únicos', () => {
    expect(CASOS_TALLER).toHaveLength(6)
    expect(CASOS_TALLER.map((c) => c.unidad)).toEqual([5, 6, 7, 8, 9, 10])
    expect(new Set(CASOS_TALLER.map((c) => c.id)).size).toBe(CASOS_TALLER.length)
  })

  it('los busca por identificador', () => {
    expect(casoPorId('u7-exchange-cerrado')?.unidad).toBe(7)
    expect(casoPorId('no-existe')).toBeUndefined()
  })

  it('ninguno se marca como demo: el caso de ejemplo es otra cosa', () => {
    for (const caso of CASOS_TALLER) expect(caso.datos.marcarDemo).toBeUndefined()
  })

  it('todos son ejercicios de clase: entre 8 y 20 apuntes', () => {
    for (const caso of CASOS_TALLER) {
      expect(caso.datos.apuntes.length).toBeGreaterThanOrEqual(8)
      expect(caso.datos.apuntes.length).toBeLessThanOrEqual(20)
    }
  })

  it('todos traen enunciado de varios párrafos, qué enseñan y duración', () => {
    for (const caso of CASOS_TALLER) {
      expect(caso.titulo.length).toBeGreaterThan(5)
      expect(caso.enunciado.split('\n\n').length).toBeGreaterThanOrEqual(3)
      expect(caso.queEnsena.length).toBeGreaterThanOrEqual(3)
      expect(caso.minutosEstimados).toBeGreaterThan(0)
    }
  })

  it('el enunciado NUNCA contiene la solución', () => {
    for (const caso of CASOS_TALLER) {
      for (const correccion of caso.solucion?.correcciones ?? []) {
        expect(caso.enunciado).not.toContain(correccion)
      }
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 2. Todo caso es cargable
// ────────────────────────────────────────────────────────────────────────────

describe.each(CASOS_TALLER.map((c) => [c.id, c] as const))('caso %s · es cargable', (_id, caso) => {
  it('lleva el diario en orden cronológico no decreciente (lo exige el FIFO)', () => {
    expect(() => exigirOrdenCronologico(apuntesDe(caso))).not.toThrow()
  })

  it('tiene correlativos únicos, con el formato AAAA-NNN y el año de su fecha', () => {
    const vistos = new Set<string>()
    for (const ap of caso.datos.apuntes) {
      expect(ap.id).toMatch(/^\d{4}-\d{3}$/)
      expect(vistos.has(ap.id)).toBe(false)
      vistos.add(ap.id)
      expect(ap.id.slice(0, 4)).toBe(ap.fechaHora.slice(0, 4))
    }
  })

  it('numera correlativamente dentro de cada ejercicio', () => {
    const contador = new Map<string, number>()
    for (const ap of caso.datos.apuntes) {
      const anio = ap.id.slice(0, 4)
      const siguiente = (contador.get(anio) ?? 0) + 1
      contador.set(anio, siguiente)
      expect(ap.id).toBe(`${anio}-${String(siguiente).padStart(3, '0')}`)
    }
  })

  it('solo usa tipos del catálogo cerrado de doce', () => {
    for (const ap of caso.datos.apuntes) expect(CATALOGO_TIPOS[ap.tipo]).toBeDefined()
  })

  it('referencia solo ubicaciones que existen (o EXTERIOR)', () => {
    const ids = new Set([...caso.datos.ubicaciones.map((u) => u.id), UBICACION_EXTERIOR])
    for (const ap of caso.datos.apuntes) {
      expect(ids.has(ap.ubicacionOrigen)).toBe(true)
      expect(ids.has(ap.ubicacionDestino)).toBe(true)
    }
    for (const fila of caso.datos.cuadreReal ?? []) expect(ids.has(fila.ubicacion)).toBe(true)
  })

  it('referencia solo activos del catálogo (los de serie más los suyos)', () => {
    const simbolos = new Set([
      ...ACTIVOS_BASE.map((a) => a.simbolo),
      ...(caso.datos.activos ?? []).map((a) => a.simbolo),
    ])
    for (const ap of caso.datos.apuntes) {
      for (const s of [ap.activoEntrada, ap.activoSalida, ap.comisionActivo]) {
        if (s) expect(simbolos.has(s)).toBe(true)
      }
    }
    for (const fila of caso.datos.cuadreReal ?? []) expect(simbolos.has(fila.activo)).toBe(true)
    for (const p of caso.datos.precios ?? []) expect(simbolos.has(p.activo)).toBe(true)
  })

  it('engancha los justificantes, los subtipos de pérdida y las posiciones a apuntes reales', () => {
    const ids = new Set(caso.datos.apuntes.map((a) => a.id))
    for (const j of caso.datos.justificantes ?? []) {
      // '' = documento de ubicación o de ejercicio (carpetas 05/06): no cuelga de un apunte.
      if (j.apunteId !== '') expect(ids.has(j.apunteId)).toBe(true)
    }
    for (const id of Object.keys(caso.datos.subtiposPerdida ?? {})) {
      expect(ids.has(id)).toBe(true)
      expect(caso.datos.apuntes.find((a) => a.id === id)?.tipo).toBe('PERDIDA')
    }
    const posiciones = new Set((caso.datos.posiciones ?? []).map((p) => p.id))
    for (const ap of caso.datos.apuntes) {
      if (ap.posicionId) expect(posiciones.has(ap.posicionId)).toBe(true)
    }
  })

  it('declara los saldos reales sobre celdas que el Libro conoce', () => {
    const celdas = new Set(calcularSaldos(apuntesDe(caso)).map((s) => `${s.ubicacion}|${s.activo}`))
    for (const fila of caso.datos.cuadreReal ?? []) {
      expect(celdas.has(`${fila.ubicacion}|${fila.activo}`)).toBe(true)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 3. Cada caso falla como promete (y su solución lo arregla)
// ────────────────────────────────────────────────────────────────────────────

describe('U5 · el libro sucio descuadra, y solo el CUADRE lo ve', () => {
  const caso = casoPorId('u5-primer-cuadre')!

  it('deja el CUADRE ENTERO en ERROR: las cuatro celdas declaradas fallan', () => {
    const filas = cuadreDe(caso)
    expect(filas).toHaveLength(4)
    expect(filas.every((f) => f.estado === 'ERROR')).toBe(true)
  })

  it('el descuadre tiene la forma de los tres defectos sembrados', () => {
    const por = (u: string, a: string) =>
      cuadreDe(caso).find((f) => f.ubicacion === u && f.activo === a)!
    // Falta la compra de ETH: sobra euro (−1.502,25 €) y falta medio éter…
    expect(por('Bitpanda', 'ETH').diferencia).toBe('0.5')
    // …y además la comisión de 15 € de la retirada, que suma al desfase del euro.
    expect(por('Bitpanda', 'EUR').diferencia).toBe('-1517.25')
    // El duplicado mueve 0,03008 BTC del exchange a la wallet (0,03 + su comisión).
    expect(por('Bitpanda', 'BTC').diferencia).toBe('0.03008')
    expect(por('BlueWallet', 'BTC').diferencia).toBe('-0.03')
  })

  it('y sin embargo la CONCILIACIÓN FIFO↔SALDOS está en verde: ninguno es de clasificación', () => {
    expect(conciliacionDe(caso).estadoGlobal).toBe('OK')
    expect(validarDiario(apuntesDe(caso), undefined, caso.datos.activos)).toHaveLength(0)
  })

  it('aplicando la solución, el CUADRE se pone entero en verde', () => {
    const compraQueFalta: Apunte = {
      id: '2025-011',
      fechaHora: '2025-06-12T12:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'Bitpanda',
      ubicacionDestino: 'Bitpanda',
      activoSalida: 'EUR',
      cantidadSalida: '1500',
      activoEntrada: 'ETH',
      cantidadEntrada: '0.5',
      comisionCantidad: '2.25',
      comisionActivo: 'EUR',
      contravalorEUR: '1500',
    }
    const corregido = conApuntes(
      // se quita el duplicado y se añade la comisión que faltaba
      reemplazando(caso.datos.apuntes, '2025-008', {
        comisionCantidad: '15',
        comisionActivo: 'EUR',
      }).filter((a) => a.id !== '2025-005'),
      compraQueFalta,
    )
    expect(cuadreDe(caso, corregido).every((f) => f.estado === 'OK')).toBe(true)
    expect(conciliacionDe(caso, corregido).estadoGlobal).toBe('OK')
  })
})

describe('U6 · el error invisible cuadra igual; el sentido de la donación, no', () => {
  const caso = casoPorId('u6-clasificacion')!

  it('el CUADRE sale ENTERO EN VERDE pese a estar el Libro mal', () => {
    const filas = cuadreDe(caso)
    expect(filas).toHaveLength(5)
    expect(filas.every((f) => f.estado === 'OK')).toBe(true)
  })

  it('el error invisible: la minería anotada como RENDIMIENTO cambia de cajón fiscal', () => {
    const r = calcularResumenFiscal(apuntesDe(caso), [...caso.datos.ubicaciones], [], 2025)
    // Los 251,10 € del minero están sumados al RCM (6,00 € del staking real) …
    expect(r.rcm.totalEUR).toBe('257.1')
    // … y el cajón que les corresponde está vacío.
    expect(r.actividadEconomica.totalEUR).toBe('0')
  })

  it('la donación sin sentido descuadra la conciliación FIFO↔SALDOS y lo dice', () => {
    const conc = conciliacionDe(caso)
    expect(conc.estadoGlobal).toBe('ERROR')
    const btc = conc.filas.find((f) => f.activo === 'BTC')!
    expect(btc.diferencia).toBe('0.005') // la cola sobra exactamente lo donado
    expect(btc.motivos).toContain('sentido-sin-resolver')
    expect(btc.apuntesImplicados).toContain('2025-011')
  })

  it('la validación bloquea la donación sin sentido', () => {
    const avisos = validarDiario(apuntesDe(caso), undefined, caso.datos.activos)
    expect(hayErrores(avisos)).toBe(true)
    expect(avisos.map((a) => a.codigo)).toContain('DONACION_SIN_SENTIDO')
  })

  it('aplicando la solución, el RCM se vacía en favor de la actividad y la cola concilia', () => {
    let corregido = [...caso.datos.apuntes]
    for (const id of ['2025-004', '2025-007', '2025-008']) {
      corregido = reemplazando(corregido, id, { tipo: 'MINERIA' })
    }
    corregido = reemplazando(corregido, '2025-011', { sentido: 'entregada' })

    const r = calcularResumenFiscal(corregido, [...caso.datos.ubicaciones], [], 2025)
    expect(r.rcm.totalEUR).toBe('6')
    expect(r.actividadEconomica.totalEUR).toBe('251.1')
    expect(r.baseGeneral.totalEUR).toBe('150')
    expect(conciliacionDe(caso, corregido).estadoGlobal).toBe('OK')
    // El CUADRE no se ha movido ni un satoshi: era, y sigue siendo, verde.
    expect(cuadreDe(caso, corregido).every((f) => f.estado === 'OK')).toBe(true)
  })
})

describe('U7 · el exchange cerrado y la trampa del coste cero', () => {
  const caso = casoPorId('u7-exchange-cerrado')!

  it('deja saldo NEGATIVO en la ubicación del exchange desaparecido', () => {
    const celda = calcularSaldos(apuntesDe(caso)).find(
      (s) => s.ubicacion === 'ExchangeQ' && s.activo === 'BTC',
    )!
    expect(celda.negativo).toBe(true)
    expect(celda.saldo).toBe('-0.5107')
  })

  it('dispara saldoFifoInsuficiente en las transmisiones sin adquisición previa', () => {
    const cortas = transmisionesDe(caso.datos.apuntes).filter((t) => t.saldoFifoInsuficiente)
    expect(cortas.map((t) => t.apunteId)).toEqual(['2019-003', '2021-002', '2025-003'])
    const avisos = validarDiario(apuntesDe(caso), undefined, caso.datos.activos)
    expect(avisos.filter((a) => a.codigo === 'FIFO_INSUFICIENTE')).toHaveLength(3)
  })

  it('infla la ganancia de la venta grande: 0,19007 BTC sin lote de coste', () => {
    const venta = transmisionesDe(caso.datos.apuntes).find((t) => t.apunteId === '2025-003')!
    expect(venta.cantidadSinCoste).toBe('0.19007')
    // Casi diecinueve mil euros de valor de transmisión contra 596,69 € de coste.
    expect(Number(venta.resultadoEUR)).toBeGreaterThan(18000)
  })

  it('la conciliación FIFO↔SALDOS lo atribuye a la causa correcta', () => {
    const btc = conciliacionDe(caso).filas.find((f) => f.activo === 'BTC')!
    expect(btc.estado).toBe('ERROR')
    expect(btc.motivos).toContain('saldo-fifo-insuficiente')
  })

  it('reconstruido el origen, desaparecen el saldo negativo, el aviso y la ganancia inflada', () => {
    const reconstruido = conApuntes(
      caso.datos.apuntes,
      {
        id: '2017-001',
        fechaHora: '2017-11-15T10:00:00',
        tipo: 'TRANSFERENCIA',
        ubicacionOrigen: UBICACION_EXTERIOR,
        ubicacionDestino: 'ExchangeQ',
        activoEntrada: 'EUR',
        cantidadEntrada: '2100',
      },
      {
        id: '2017-002',
        fechaHora: '2017-11-15T11:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'ExchangeQ',
        ubicacionDestino: 'ExchangeQ',
        activoSalida: 'EUR',
        cantidadSalida: '2100',
        activoEntrada: 'BTC',
        cantidadEntrada: '0.3007',
        contravalorEUR: '2100',
      },
      {
        id: '2017-003',
        fechaHora: '2017-12-18T10:00:00',
        tipo: 'TRANSFERENCIA',
        ubicacionOrigen: UBICACION_EXTERIOR,
        ubicacionDestino: 'ExchangeQ',
        activoEntrada: 'EUR',
        cantidadEntrada: '3360',
      },
      {
        id: '2017-004',
        fechaHora: '2017-12-18T11:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'ExchangeQ',
        ubicacionDestino: 'ExchangeQ',
        activoSalida: 'EUR',
        cantidadSalida: '3360',
        activoEntrada: 'BTC',
        cantidadEntrada: '0.21',
        contravalorEUR: '3360',
      },
    )

    const exchange = calcularSaldos(reconstruido).filter((s) => s.ubicacion === 'ExchangeQ')
    expect(exchange.every((s) => !s.negativo)).toBe(true)
    expect(exchange.find((s) => s.activo === 'BTC')!.saldo).toBe('0')

    expect(transmisionesDe(reconstruido).some((t) => t.saldoFifoInsuficiente)).toBe(false)
    expect(conciliacionDe(caso, reconstruido).estadoGlobal).toBe('OK')
    expect(cuadreDe(caso, reconstruido).every((f) => f.estado === 'OK')).toBe(true)

    // Y la venta de septiembre pasa a restar el coste que le corresponde: su resultado baja
    // respecto del que arrojaba el Libro sin reconstruir, que es el sentido del ejercicio.
    const antes = transmisionesDe(caso.datos.apuntes).find((t) => t.apunteId === '2025-003')!
    const despues = transmisionesDe(reconstruido).find((t) => t.apunteId === '2025-003')!
    expect(Number(despues.costeFifoEUR)).toBeGreaterThan(Number(antes.costeFifoEUR))
    expect(Number(despues.resultadoEUR)).toBeLessThan(Number(antes.resultadoEUR))

    // Y en conjunto el Libro deja de contar como ganancia lo que en realidad costó dinero:
    // la suma de resultados de todas las transmisiones baja de forma apreciable.
    const suma = (ts: readonly { resultadoEUR: string }[]) =>
      ts.reduce((acc, t) => acc + Number(t.resultadoEUR), 0)
    expect(suma(transmisionesDe(reconstruido))).toBeLessThan(suma(transmisionesDe(caso.datos.apuntes)))

    // Hasta la pérdida de 2019 cambia de naturaleza: pasa de valer cero —no había coste que
    // perder— a tener detrás un valor de adquisición real.
    const perdida = transmisionesDe(reconstruido).find((t) => t.apunteId === '2019-003')!
    expect(Number(perdida.costeFifoEUR)).toBeGreaterThan(0)
    expect(Number(perdida.resultadoEUR)).toBeLessThan(0)
  })
})

describe('U8 · los eventos DeFi se descomponen en patas, y una está mal', () => {
  const caso = casoPorId('u8-eventos-defi')!

  it('no añade tipos: todas las patas son de los doce del catálogo', () => {
    const tipos = new Set(caso.datos.apuntes.map((a) => a.tipo))
    expect([...tipos].every((t) => CATALOGO_TIPOS[t] !== undefined)).toBe(true)
    // …y hay eventos DeFi nombrados en la dimensión ortogonal.
    const eventos = new Set(caso.datos.apuntes.map((a) => a.evento).filter(Boolean))
    expect(eventos).toEqual(new Set(['STAKING_LIQUIDO', 'LENDING_PRESTATARIO', 'WRAPPING']))
  })

  it('el CUADRE y la conciliación están en VERDE: el error no está en cuánto hay', () => {
    expect(cuadreDe(caso).every((f) => f.estado === 'OK')).toBe(true)
    expect(conciliacionDe(caso).estadoGlobal).toBe('OK')
  })

  it('la recepción del principal como TRANSFERENCIA deja el USDC sin coste de adquisición', () => {
    const devolucion = transmisionesDe(caso.datos.apuntes).find((t) => t.apunteId === '2026-009')!
    expect(devolucion.saldoFifoInsuficiente).toBe(true)
    expect(devolucion.cantidadSinCoste).toBe('1600')
    expect(devolucion.costeFifoEUR).toBe('0')
    // Ganancia patrimonial de 1.472,00 € por devolver exactamente lo que se recibió.
    expect(devolucion.resultadoEUR).toBe('1472')
  })

  it('la regla de identidad se respeta: ETH, rETH y WETH son tres colas distintas', () => {
    const colas = calcularFifo(apuntesDe(caso))
    expect(colas.has('ETH')).toBe(true)
    expect(colas.has('RETH')).toBe(true)
    expect(colas.has('WETH')).toBe(true)
  })

  it('reclasificada la recepción como COMPRA, la ganancia ficticia desaparece', () => {
    const corregido = reemplazando(caso.datos.apuntes, '2026-007', {
      tipo: 'COMPRA',
      contravalorEUR: '1472.00',
    })
    const devolucion = transmisionesDe(corregido).find((t) => t.apunteId === '2026-009')!
    expect(devolucion.saldoFifoInsuficiente).toBeUndefined()
    expect(devolucion.costeFifoEUR).toBe('1472')
    expect(devolucion.resultadoEUR).toBe('0')
    expect(conciliacionDe(caso, corregido).estadoGlobal).toBe('OK')
    expect(cuadreDe(caso, corregido).every((f) => f.estado === 'OK')).toBe(true)
  })
})

describe('U9 · el libro limpio: solo queda trasladarlo a Renta', () => {
  const caso = casoPorId('u9-registro-a-irpf')!
  const apuntes = apuntesDe(caso)

  it('llega sin un solo defecto: cuadre verde, conciliación en cero y sin avisos', () => {
    expect(cuadreDe(caso).every((f) => f.estado === 'OK')).toBe(true)
    expect(conciliacionDe(caso).estadoGlobal).toBe('OK')
    expect(validarDiario(apuntes, undefined, caso.datos.activos)).toHaveLength(0)
  })

  it('tiene las CINCO salidas del registro pobladas, ninguna vacía', () => {
    const r = calcularResumenFiscal(apuntes, [...caso.datos.ubicaciones], [], 2025)
    expect(r.ahorro.operaciones.length).toBe(3) // dos ventas con pérdida y una con ganancia
    expect(r.ahorro.netoEUR).toBe('25.87')
    expect(r.rcm.totalEUR).toBe('114.4')
    expect(r.actividadEconomica.totalEUR).toBe('232.5')
    expect(r.baseGeneral.totalEUR).toBe('120')
    expect(r.perdidas.items).toHaveLength(1)
    expect(r.perdidas.totalEUR).toBe('-72.108')
  })

  it('la pérdida por robo se lista APARTE y no se netea con las ganancias', () => {
    const r = calcularResumenFiscal(apuntes, [...caso.datos.ubicaciones], [], 2025)
    expect(r.ahorro.operaciones.map((o) => o.apunteId)).not.toContain('2025-011')
    expect(r.perdidas.items[0]!.apunteId).toBe('2025-011')
  })

  it('no distrae con el aviso 721: todo está en España o en autocustodia', () => {
    const r = calcularResumenFiscal(apuntes, [...caso.datos.ubicaciones], [], 2025)
    expect(r.avisoExtranjero.aplica).toBe(false)
  })

  it('sus cifras esperadas son las que el motor calcula', () => {
    const r = calcularResumenFiscal(apuntes, [...caso.datos.ubicaciones], [], 2025)
    const real: Record<string, string> = {
      'ahorro.neto': r.ahorro.netoEUR,
      'rcm.total': r.rcm.totalEUR,
      'actividad-economica.total': r.actividadEconomica.totalEUR,
      'base-general.total': r.baseGeneral.totalEUR,
      'perdidas.total': r.perdidas.totalEUR,
    }
    for (const c of caso.solucion?.fiscalEsperado ?? []) expect(real[c.concepto]).toBe(c.importeEUR)
  })
})

describe('U10 · el cierre al borde del umbral del 721', () => {
  const caso = casoPorId('u10-cierre-ejercicio')!
  const apuntes = apuntesDe(caso)
  const precios = Object.fromEntries((caso.datos.precios ?? []).map((p) => [p.activo, p.precioEur]))

  it('llega listo para cerrar: cuadre verde, conciliación en cero y sin avisos', () => {
    expect(cuadreDe(caso).every((f) => f.estado === 'OK')).toBe(true)
    expect(conciliacionDe(caso).estadoGlobal).toBe('OK')
    expect(validarDiario(apuntes, undefined, caso.datos.activos)).toHaveLength(0)
  })

  it('se queda a un pelo del umbral con las cotizaciones del caso', () => {
    const r = calcularResumenFiscal(apuntes, [...caso.datos.ubicaciones], [], 2026, {
      valoracionCierre: precios,
    })
    expect(r.avisoExtranjero.aplica).toBe(true)
    expect(r.avisoExtranjero.haySinValorar).toBe(false)
    expect(r.avisoExtranjero.totalValoradoEUR).toBe('49858.47')
    expect(r.avisoExtranjero.supera).toBe(false)
  })

  it('con una cotización de cierre un 1 % mayor, SUPERA el umbral', () => {
    const r = calcularResumenFiscal(apuntes, [...caso.datos.ubicaciones], [], 2026, {
      valoracionCierre: { ...precios, BTC: '106000' },
    })
    expect(r.avisoExtranjero.supera).toBe(true)
    expect(r.avisoExtranjero.totalValoradoEUR).toBe('50228.38')
  })

  it('la autocustodia no computa, por mucho que sea la mayor parte del patrimonio', () => {
    const r = calcularResumenFiscal(apuntes, [...caso.datos.ubicaciones], [], 2026, {
      valoracionCierre: precios,
    })
    expect(r.avisoExtranjero.celdas.every((c) => c.ubicacion !== 'SeedSigner')).toBe(true)
    // Y lo que queda fuera vale más que lo que entra: 0,6 BTC × 105.000 € = 63.000 €.
    const enWallet = calcularSaldos(apuntes).find(
      (s) => s.ubicacion === 'SeedSigner' && s.activo === 'BTC',
    )!
    expect(enWallet.saldo).toBe('0.6')
  })

  it('el apunte de las 23:40 del 31 de diciembre pertenece al ejercicio que se cierra', () => {
    const hastaElCorte = calcularSaldos(apuntes, '2026-12-31T23:59:59').find(
      (s) => s.ubicacion === 'Bitvavo' && s.activo === 'USDC',
    )!
    expect(hastaElCorte.saldo).toBe('5235') // 20 + 5.200 + los 15 del último minuto
  })
})
