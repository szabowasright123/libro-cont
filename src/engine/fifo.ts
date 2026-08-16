/**
 * fifo.ts — motor FIFO (traducción de la hoja FIFO de la plantilla).
 *
 * Fuente de verdad: fórmulas de docs/reference/PLANTILLA_TALLER.xlsx, hoja FIFO.
 * Cola ÚNICA global por activo, sin distinguir ubicación (criterio administrativo
 * V0525-25, V0491-26). Regla de oro 8.
 *
 * Abren lote  (columna R = «¿Abre lote?»):  COMPRA, PERMUTA (recibida), RENDIMIENTO,
 *   MINERÍA, AIRDROP → usan activoEntrada/cantidadEntrada. La plantilla solo abre lote
 *   si el activo de entrada coincide con el activo de la cola (columna C).
 *   Coste del lote = contravalorEUR + comisión SI la comisión es en EUR (SUMA al coste).
 *
 * Consumen    (columna S = «¿Consume?»):  VENTA, PERMUTA (entregada), PAGO, PÉRDIDA →
 *   usan activoSalida/cantidadSalida (columna L, si el activo de salida = activo de cola).
 *   Valor de transmisión neto = contravalorEUR − comisión SI la comisión es en EUR (MINORA).
 *   Un consumo que abarca varios lotes toma el coste de los más antiguos (troceo parcial).
 *
 * Resultado por transmisión = valor neto − coste FIFO (columna P = O − N).
 * Totales de cola: adquirido (C), consumido (L), restante y su coste.
 *
 * COMISIONES EN CRIPTO (fase D0 — criterio del autor 16-08-2026, docs/DEFI_EVENTOS_COMPLEJOS.md §8).
 * Este punto se APARTA deliberadamente de la plantilla, que no consumía cola por las
 * comisiones pagadas en cripto y dejaba divergir el restante FIFO del saldo real. Reglas:
 *   1. La comisión en un activo distinto de EUR CONSUME cola de ese activo, por orden de
 *      antigüedad y con troceo parcial, igual que cualquier otro consumo.
 *   2. Ese consumo NO es una transmisión: su resultado es CERO y no aparece en el informe
 *      fiscal (el pago de gas en cripto no se considera transmisión).
 *   3. El COSTE FIFO retirado —no el contravalor en euros del gas— se aplica a la operación
 *      servida: minora el valor de transmisión si el apunte transmite, o suma al coste del
 *      lote si solo adquiere.
 *   4. Si el apunte es un mero traslado (TRANSFERENCIA), el lote se consume igual —para que
 *      SALDOS y FIFO no diverjan— y el coste retirado NO es deducible en ninguna parte
 *      (manual U4.3: la comisión de un traslado entre billeteras propias no es deducible).
 *   5. Las comisiones en EUR mantienen el tratamiento de DOMINIO §4, sin cambios.
 * Consecuencia buscada: el restante de la cola vuelve a coincidir con el saldo real, y el
 * CUADRE pasa a ser exacto. Ver docs/COTEJO_F1.md §Divergencias.
 *
 * Por eso el recorrido es una ÚNICA pasada cronológica sobre TODOS los activos a la vez:
 * una venta de BTC puede pagar su gas en ETH, de modo que el coste de esa comisión depende
 * del estado de la cola de ETH en ese instante. Las colas ya no son independientes.
 *
 * Determinista y TypeScript puro (Regla de oro 4). Exige el diario en orden cronológico.
 */

import {
  type Apunte,
  type SimboloActivo,
  type LoteFifo,
  type ConsumoFifo,
  type ResultadoTransmision,
  type ColaFifoResumen,
  CATALOGO_TIPOS,
} from './types'
import { D, aCadena, CERO, Decimal } from './decimal'

/** Comisión en EUR del apunte (0 si la comisión no es en EUR o no hay). */
function comisionEUR(ap: Apunte): Decimal {
  return ap.comisionActivo === 'EUR' && ap.comisionCantidad ? D(ap.comisionCantidad) : CERO
}

/** Lote vivo en la cola (mutable durante el recorrido). */
interface LoteVivo {
  apunteId: string
  fechaHora: string
  cantidadInicial: Decimal
  cantidadRestante: Decimal
  costeTotalEUR: Decimal
  costeUnitarioEUR: Decimal
}

/** Resultado del cálculo FIFO de UN activo. */
export interface ResultadoFifoActivo {
  resumen: ColaFifoResumen
  transmisiones: ResultadoTransmision[]
}

/**
 * Comprueba el orden cronológico no decreciente del diario. Lanza si se rompe
 * (la app garantiza el orden por construcción; aquí lo exigimos, DOMINIO §4).
 */
export function exigirOrdenCronologico(apuntes: Apunte[]): void {
  for (let i = 1; i < apuntes.length; i++) {
    const anterior = apuntes[i - 1]!
    const actual = apuntes[i]!
    if (new Date(actual.fechaHora).getTime() < new Date(anterior.fechaHora).getTime()) {
      throw new Error(
        `FIFO exige orden cronológico: el apunte ${actual.id} (${actual.fechaHora}) ` +
          `es anterior a ${anterior.id} (${anterior.fechaHora}).`,
      )
    }
  }
}

/** Comisión pagada en un activo distinto de EUR (la que consume cola). Null si no la hay. */
function comisionCripto(ap: Apunte): { activo: SimboloActivo; cantidad: Decimal } | null {
  if (!ap.comisionActivo || ap.comisionActivo === 'EUR' || !ap.comisionCantidad) return null
  const cantidad = D(ap.comisionCantidad)
  return cantidad.greaterThan(0) ? { activo: ap.comisionActivo, cantidad } : null
}

/** Estado vivo de la cola de UN activo durante la pasada cronológica. */
interface ColaViva {
  lotes: LoteVivo[]
  cursor: number
  adquiridoTotal: Decimal
  consumidoTotal: Decimal
  transmisiones: ResultadoTransmision[]
}

function colaNueva(): ColaViva {
  return {
    lotes: [],
    cursor: 0,
    adquiridoTotal: CERO,
    consumidoTotal: CERO,
    transmisiones: [],
  }
}

/** Resultado de consumir cantidad de una cola: coste FIFO retirado y detalle por lote. */
interface Retirada {
  costeFifo: Decimal
  consumos: ConsumoFifo[]
  /** Cantidad que no encontró lote (cola insuficiente). */
  sinCoste: Decimal
}

/**
 * Retira `cantidad` de la cola por orden de antigüedad, con troceo parcial de lote.
 * Muta la cola. Es la operación común a las transmisiones y a las comisiones en cripto:
 * ambas sacan unidades de la cola; lo que las distingue es qué se hace con el coste.
 */
function retirarDeCola(cola: ColaViva, cantidad: Decimal): Retirada {
  const consumos: ConsumoFifo[] = []
  let porConsumir = cantidad
  let costeFifo = CERO

  while (porConsumir.greaterThan(0) && cola.cursor < cola.lotes.length) {
    const lote = cola.lotes[cola.cursor]!
    if (lote.cantidadRestante.lessThanOrEqualTo(0)) {
      cola.cursor++
      continue
    }
    const toma = Decimal.min(porConsumir, lote.cantidadRestante)
    // Coste imputado exacto: costeTotal × toma / cantidadInicial (sin truncar el unitario).
    const costeImputado = lote.costeTotalEUR.times(toma).div(lote.cantidadInicial)
    consumos.push({
      loteApunteId: lote.apunteId,
      cantidadConsumida: aCadena(toma),
      costeImputadoEUR: aCadena(costeImputado),
    })
    costeFifo = costeFifo.plus(costeImputado)
    lote.cantidadRestante = lote.cantidadRestante.minus(toma)
    porConsumir = porConsumir.minus(toma)
    if (lote.cantidadRestante.lessThanOrEqualTo(0)) cola.cursor++
  }

  cola.consumidoTotal = cola.consumidoTotal.plus(cantidad.minus(porConsumir))
  return { costeFifo, consumos, sinCoste: porConsumir }
}

/** Vuelca una cola viva a su resumen inmutable. */
function resumirCola(activo: SimboloActivo, cola: ColaViva): ColaFifoResumen {
  const lotesAbiertos: LoteFifo[] = cola.lotes
    .filter((l) => l.cantidadRestante.greaterThan(0))
    .map((l) => ({
      apunteId: l.apunteId,
      activo,
      fechaHora: l.fechaHora,
      cantidadInicial: aCadena(l.cantidadInicial),
      cantidadRestante: aCadena(l.cantidadRestante),
      costeTotalEUR: aCadena(l.costeTotalEUR),
      costeUnitarioEUR: aCadena(l.costeUnitarioEUR),
    }))

  // Coste del restante EXACTO: costeTotal × restante / inicial por lote (no usar el
  // coste unitario, que puede ser periódico —p. ej. 550/300— y arrastrar error).
  const costeRestante = cola.lotes.reduce<Decimal>(
    (acc, l) => acc.plus(l.costeTotalEUR.times(l.cantidadRestante).div(l.cantidadInicial)),
    CERO,
  )

  return {
    activo,
    adquiridoTotal: aCadena(cola.adquiridoTotal),
    consumidoTotal: aCadena(cola.consumidoTotal),
    restanteTotal: aCadena(cola.adquiridoTotal.minus(cola.consumidoTotal)),
    costeRestanteEUR: aCadena(costeRestante),
    lotesAbiertos,
  }
}

/**
 * Calcula la cola FIFO y las transmisiones de un activo concreto.
 * Asume `apuntes` en orden cronológico (llama antes a `exigirOrdenCronologico`).
 *
 * Se apoya en la pasada multiactivo: desde D0 las colas no son independientes entre sí
 * (una venta de BTC puede pagar gas en ETH), de modo que aislar un activo exige calcular
 * también los demás. Se conserva por comodidad de uso y de test.
 */
export function calcularFifoActivo(apuntes: Apunte[], activo: SimboloActivo): ResultadoFifoActivo {
  const todas = calcularFifoTodos(apuntes)
  return (
    todas.get(activo) ?? {
      resumen: resumirCola(activo, colaNueva()),
      transmisiones: [],
    }
  )
}

/**
 * Pasada ÚNICA y cronológica sobre todos los activos a la vez. Es el corazón del motor.
 *
 * Orden dentro de cada apunte, y el orden importa:
 *   1. Consumo por transmisión (activoSalida).
 *   2. Consumo por comisión en cripto (comisionActivo) → coste FIFO retirado.
 *   3. Cierre de la transmisión, ya con el coste de la comisión descontado del valor.
 *   4. Apertura de lote (activoEntrada), sumando el coste de la comisión si el apunte
 *      solo adquiere.
 *
 * La transmisión consume ANTES que la comisión: cuando ambas salen del mismo activo, los
 * lotes más antiguos se imputan a la operación principal, que es la que tiene efecto fiscal.
 */
function calcularFifoTodos(apuntes: Apunte[]): Map<SimboloActivo, ResultadoFifoActivo> {
  const colas = new Map<SimboloActivo, ColaViva>()
  const cola = (a: SimboloActivo): ColaViva => {
    let c = colas.get(a)
    if (!c) {
      c = colaNueva()
      colas.set(a, c)
    }
    return c
  }

  for (const ap of apuntes) {
    const def = CATALOGO_TIPOS[ap.tipo]
    const transmite = def.consumeLote === true && !!ap.activoSalida && !!ap.cantidadSalida
    const adquiere = def.abreLote === true && !!ap.activoEntrada && !!ap.cantidadEntrada

    // 1. Consumo por transmisión.
    let retiradaTransmision: Retirada | null = null
    let cantidadTransmitida = CERO
    if (transmite) {
      cantidadTransmitida = D(ap.cantidadSalida)
      if (cantidadTransmitida.greaterThan(0)) {
        retiradaTransmision = retirarDeCola(cola(ap.activoSalida!), cantidadTransmitida)
      }
    }

    // 2. Consumo por comisión en cripto. NO es transmisión: resultado cero, fuera del
    //    informe fiscal. Solo se retira para que SALDOS y FIFO no diverjan (D0, regla 1-2).
    let costeComision = CERO
    const com = comisionCripto(ap)
    if (com) costeComision = retirarDeCola(cola(com.activo), com.cantidad).costeFifo

    // 3. Cierre de la transmisión. El coste FIFO de la comisión minora el valor de
    //    transmisión (gasto inherente, art. 35.2 LIRPF) — D0, regla 3.
    if (retiradaTransmision && cantidadTransmitida.greaterThan(0)) {
      const valorNeto = D(ap.contravalorEUR).minus(comisionEUR(ap)).minus(costeComision)
      const resultado = valorNeto.minus(retiradaTransmision.costeFifo)
      const t: ResultadoTransmision = {
        apunteId: ap.id,
        activo: ap.activoSalida!,
        fechaHora: ap.fechaHora,
        ejercicio: new Date(ap.fechaHora).getFullYear(),
        cantidad: aCadena(cantidadTransmitida),
        valorTransmisionNetoEUR: aCadena(valorNeto),
        costeFifoEUR: aCadena(retiradaTransmision.costeFifo),
        resultadoEUR: aCadena(resultado),
        consumos: retiradaTransmision.consumos,
      }
      if (retiradaTransmision.sinCoste.greaterThan(0)) {
        t.saldoFifoInsuficiente = true
        t.cantidadSinCoste = aCadena(retiradaTransmision.sinCoste)
      }
      cola(ap.activoSalida!).transmisiones.push(t)
    }

    // 4. Apertura de lote. Si el apunte NO transmite, el coste de la comisión suma al
    //    coste de adquisición (D0, regla 3). Si transmite, ya se aplicó arriba y no se
    //    cuenta dos veces. Si es un traslado (ni transmite ni adquiere), el coste se
    //    pierde: no es deducible en ninguna parte (D0, regla 4).
    if (adquiere) {
      const cantidad = D(ap.cantidadEntrada)
      if (cantidad.greaterThan(0)) {
        const coste = D(ap.contravalorEUR)
          .plus(comisionEUR(ap))
          .plus(transmite ? CERO : costeComision)
        const c = cola(ap.activoEntrada!)
        c.lotes.push({
          apunteId: ap.id,
          fechaHora: ap.fechaHora,
          cantidadInicial: cantidad,
          cantidadRestante: cantidad,
          costeTotalEUR: coste,
          costeUnitarioEUR: coste.div(cantidad),
        })
        c.adquiridoTotal = c.adquiridoTotal.plus(cantidad)
      }
    }
  }

  const salida = new Map<SimboloActivo, ResultadoFifoActivo>()
  for (const [activo, c] of colas) {
    salida.set(activo, { resumen: resumirCola(activo, c), transmisiones: c.transmisiones })
  }
  return salida
}

/**
 * Descubre todos los activos que participan en la cola FIFO (los que abren o
 * consumen lote en algún apunte), excluyendo los que solo aparecen como fiat de
 * contravalor. Se determina por presencia en activoEntrada/activoSalida de apuntes
 * que abren o consumen lote.
 */
export function activosConCola(apuntes: Apunte[]): SimboloActivo[] {
  const set = new Set<SimboloActivo>()
  for (const ap of apuntes) {
    if (CATALOGO_TIPOS[ap.tipo].abreLote === true && ap.activoEntrada) set.add(ap.activoEntrada)
    if (CATALOGO_TIPOS[ap.tipo].consumeLote === true && ap.activoSalida) set.add(ap.activoSalida)
    // Desde D0, la comisión pagada en cripto también consume cola de su activo.
    const com = comisionCripto(ap)
    if (com) set.add(com.activo)
  }
  return [...set]
}

/**
 * Calcula la cola FIFO de TODOS los activos del diario a la vez (la app supera al
 * Excel: cola para todos los activos simultáneamente). Exige orden cronológico.
 */
export function calcularFifo(apuntes: Apunte[]): Map<SimboloActivo, ResultadoFifoActivo> {
  exigirOrdenCronologico(apuntes)
  return calcularFifoTodos(apuntes)
}

/**
 * Todas las transmisiones (resultados de GyP) del diario, ordenadas por fecha y
 * agrupables por ejercicio. Atajo sobre `calcularFifo`.
 */
export function transmisionesDelDiario(apuntes: Apunte[]): ResultadoTransmision[] {
  const fifo = calcularFifo(apuntes)
  const todas: ResultadoTransmision[] = []
  for (const { transmisiones } of fifo.values()) todas.push(...transmisiones)
  todas.sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())
  return todas
}
