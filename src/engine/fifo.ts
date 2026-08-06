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
 * Nota de fidelidad al Excel: la comisión de una TRANSFERENCIA (p. ej. 0,0002 BTC de
 * red) NO consume cola —TRANSFERENCIA no consume lote—, aunque sí reduce el saldo
 * físico. Por eso el «restante» de la cola puede superar al saldo real en el importe
 * de esas comisiones. Es el comportamiento de la plantilla y se documenta en COTEJO_F1.
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

/** ¿Este apunte abre lote de `activo`? (flag del catálogo + activoEntrada coincide). */
function abreLoteDe(ap: Apunte, activo: SimboloActivo): boolean {
  return (
    CATALOGO_TIPOS[ap.tipo].abreLote === true &&
    ap.activoEntrada === activo &&
    !!ap.cantidadEntrada &&
    D(ap.cantidadEntrada).greaterThan(0)
  )
}

/** ¿Este apunte consume lote de `activo`? (flag del catálogo + activoSalida coincide). */
function consumeLoteDe(ap: Apunte, activo: SimboloActivo): boolean {
  return (
    CATALOGO_TIPOS[ap.tipo].consumeLote === true &&
    ap.activoSalida === activo &&
    !!ap.cantidadSalida &&
    D(ap.cantidadSalida).greaterThan(0)
  )
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

/**
 * Calcula la cola FIFO y las transmisiones de un activo concreto.
 * Asume `apuntes` en orden cronológico (llama antes a `exigirOrdenCronologico`).
 */
export function calcularFifoActivo(apuntes: Apunte[], activo: SimboloActivo): ResultadoFifoActivo {
  const lotes: LoteVivo[] = []
  const transmisiones: ResultadoTransmision[] = []
  let adquiridoTotal = CERO
  let consumidoTotal = CERO
  let cursor = 0 // índice del primer lote con restante > 0 (avanza, nunca retrocede)

  for (const ap of apuntes) {
    // --- Apertura de lote (columna C/D/E de la plantilla) ---
    if (abreLoteDe(ap, activo)) {
      const cantidad = D(ap.cantidadEntrada)
      const coste = D(ap.contravalorEUR).plus(comisionEUR(ap)) // contravalor + comisión EUR
      lotes.push({
        apunteId: ap.id,
        fechaHora: ap.fechaHora,
        cantidadInicial: cantidad,
        cantidadRestante: cantidad,
        costeTotalEUR: coste,
        costeUnitarioEUR: coste.div(cantidad),
      })
      adquiridoTotal = adquiridoTotal.plus(cantidad)
    }

    // --- Consumo por transmisión (columnas L/N/O/P) ---
    if (consumeLoteDe(ap, activo)) {
      const cantidad = D(ap.cantidadSalida)
      const valorNeto = D(ap.contravalorEUR).minus(comisionEUR(ap)) // contravalor − comisión EUR
      const consumos: ConsumoFifo[] = []
      let porConsumir = cantidad
      let costeFifo = CERO

      // Consumir lotes más antiguos primero, con troceo parcial.
      while (porConsumir.greaterThan(0) && cursor < lotes.length) {
        const lote = lotes[cursor]!
        if (lote.cantidadRestante.lessThanOrEqualTo(0)) {
          cursor++
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
        if (lote.cantidadRestante.lessThanOrEqualTo(0)) cursor++
      }

      const insuficiente = porConsumir.greaterThan(0)
      const resultado = valorNeto.minus(costeFifo)
      consumidoTotal = consumidoTotal.plus(cantidad.minus(porConsumir))

      const t: ResultadoTransmision = {
        apunteId: ap.id,
        activo,
        fechaHora: ap.fechaHora,
        ejercicio: new Date(ap.fechaHora).getFullYear(),
        cantidad: aCadena(cantidad),
        valorTransmisionNetoEUR: aCadena(valorNeto),
        costeFifoEUR: aCadena(costeFifo),
        resultadoEUR: aCadena(resultado),
        consumos,
      }
      if (insuficiente) {
        t.saldoFifoInsuficiente = true
        t.cantidadSinCoste = aCadena(porConsumir)
      }
      transmisiones.push(t)
    }
  }

  // --- Resumen de la cola ---
  const lotesAbiertos: LoteFifo[] = lotes
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
  const costeRestante = lotes.reduce<Decimal>(
    (acc, l) => acc.plus(l.costeTotalEUR.times(l.cantidadRestante).div(l.cantidadInicial)),
    CERO,
  )

  const resumen: ColaFifoResumen = {
    activo,
    adquiridoTotal: aCadena(adquiridoTotal),
    consumidoTotal: aCadena(consumidoTotal),
    restanteTotal: aCadena(adquiridoTotal.minus(consumidoTotal)),
    costeRestanteEUR: aCadena(costeRestante),
    lotesAbiertos,
  }

  return { resumen, transmisiones }
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
  }
  return [...set]
}

/**
 * Calcula la cola FIFO de TODOS los activos del diario a la vez (la app supera al
 * Excel: cola para todos los activos simultáneamente). Exige orden cronológico.
 */
export function calcularFifo(apuntes: Apunte[]): Map<SimboloActivo, ResultadoFifoActivo> {
  exigirOrdenCronologico(apuntes)
  const out = new Map<SimboloActivo, ResultadoFifoActivo>()
  for (const activo of activosConCola(apuntes)) {
    out.set(activo, calcularFifoActivo(apuntes, activo))
  }
  return out
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
