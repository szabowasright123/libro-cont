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
 * VALORACIÓN DE LA PERMUTA (art. 37.1.h LIRPF). La permuta no se cuantifica por lo
 * recibido ni por lo entregado, sino por el MAYOR de los dos valores de mercado, y ese
 * importe es también el coste del lote que nace. Lo resuelve `valorPermutaEUR`, que se
 * usa en el cierre de la transmisión y en la apertura del lote. Ver [MT] U6.4.
 *
 * COMISIONES EN CRIPTO (fase D0 — criterio del autor 16-08-2026, docs/DEFI_EVENTOS_COMPLEJOS.md §8).
 * Este punto se APARTA deliberadamente de la plantilla, que no consumía cola por las
 * comisiones pagadas en cripto y dejaba divergir el restante FIFO del saldo real. Reglas:
 *   1. La comisión en un activo distinto de EUR reduce la cola de ese activo, pero NO por
 *      orden de antigüedad: se reparte PRORRATEADA entre todos los lotes vivos, en
 *      proporción a su cantidad restante (criterio del autor 16-08-2026). El fundamento
 *      es que si el gas no es transmisión fiscal, tampoco puede serlo «de las unidades más
 *      antiguas»: el FIFO es la regla de las TRANSMISIONES (art. 37.2 LIRPF y V0525-25), y
 *      aplicarlo a una reducción que no transmite adelantaría el consumo de los lotes
 *      antiguos y alteraría el coste de las ventas posteriores. Con prorrateo, la
 *      estructura de antigüedad de la cola se conserva intacta. La DGT no se ha
 *      pronunciado sobre el método de conciliación: es zona gris documentada.
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
  resolverFlags,
  esTransmisionLucrativa,
} from './types'
import { D, aCadena, CERO, Decimal } from './decimal'

/** Comisión en EUR del apunte (0 si la comisión no es en EUR o no hay). */
function comisionEUR(ap: Apunte): Decimal {
  return ap.comisionActivo === 'EUR' && ap.comisionCantidad ? D(ap.comisionCantidad) : CERO
}

/**
 * Valor en euros con el que se cuantifica el apunte, ANTES de comisiones.
 *
 * Regla general: el contravalor declarado. Excepción de la PERMUTA (art. 37.1.h LIRPF):
 * la ganancia o pérdida se determina «por la diferencia entre el valor de adquisición del
 * bien o derecho que se cede y el mayor de los dos siguientes: el valor de mercado del
 * bien o derecho entregado; el valor de mercado del bien o derecho que se recibe a
 * cambio». Se toma, por tanto, el MAYOR de los valores declarados, y ese mismo importe es
 * después el coste del lote que nace con lo recibido ([MT] U6.4).
 *
 * Retrocompatible: si el apunte no trae los dos valores de mercado —el caso de todo libro
 * anterior a esta regla—, el máximo se calcula sobre `contravalorEUR` solo y el resultado
 * es idéntico al de antes.
 */
export function valorPermutaEUR(ap: Apunte): Decimal {
  if (ap.tipo !== 'PERMUTA') return D(ap.contravalorEUR)
  const declarados = [
    ap.contravalorEUR,
    ap.valorMercadoEntregadoEUR,
    ap.valorMercadoRecibidoEUR,
  ].filter((v): v is string => v !== undefined && v !== '')
  if (declarados.length === 0) return CERO
  return declarados.map(D).reduce((a, b) => (b.greaterThan(a) ? b : a))
}

/** Lote vivo en la cola (mutable durante el recorrido). */
interface LoteVivo {
  apunteId: string
  fechaHora: string
  cantidadInicial: Decimal
  /** Restante en la ESCALA `escalaBase`; usa `materializar` antes de leerlo. */
  cantidadRestante: Decimal
  costeTotalEUR: Decimal
  costeUnitarioEUR: Decimal
  /** Escala de la cola cuando este lote se materializó por última vez (ver `escala`). */
  escalaBase: Decimal
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
  /**
   * Agregados de lo que sigue vivo en la cola. Se mantienen de forma incremental para que
   * el prorrateo no necesite recorrer los lotes solo para saber cuánto hay: con 5.000
   * apuntes y una comisión en cripto por traslado, esa pasada extra convertía el motor en
   * cuadrático. Son sumas y restas exactas, sin división: no arrastran error.
   */
  cantidadViva: Decimal
  costeVivo: Decimal
  /**
   * Escala acumulada de los prorrateos aplicados a esta cola.
   *
   * Un prorrateo reduce TODOS los lotes vivos por el MISMO factor, así que aplicarlo lote a
   * lote es innecesario: basta con multiplicar esta escala y materializar cada lote la
   * primera vez que se le toca. Sin esto, cada comisión en cripto recorría toda la cola y
   * el recálculo de 5.000 apuntes pasaba de 166 ms a más de 4 segundos.
   */
  escala: Decimal
}

function colaNueva(): ColaViva {
  return {
    lotes: [],
    cursor: 0,
    adquiridoTotal: CERO,
    consumidoTotal: CERO,
    transmisiones: [],
    cantidadViva: CERO,
    costeVivo: CERO,
    escala: D(1),
  }
}

/**
 * Pone al día el restante de un lote con los prorrateos ocurridos desde la última vez que
 * se le tocó. Hay que llamarla ANTES de leer o escribir `cantidadRestante`.
 */
function materializar(cola: ColaViva, lote: LoteVivo): void {
  if (lote.escalaBase.equals(cola.escala)) return
  lote.cantidadRestante = lote.cantidadRestante.times(cola.escala).div(lote.escalaBase)
  lote.escalaBase = cola.escala
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
    materializar(cola, lote)
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
  cola.cantidadViva = cola.cantidadViva.minus(cantidad.minus(porConsumir))
  cola.costeVivo = cola.costeVivo.minus(costeFifo)
  return { costeFifo, consumos, sinCoste: porConsumir }
}

/**
 * Reduce la cola PRORRATEADA entre todos los lotes vivos, en proporción a su cantidad
 * restante. Muta la cola. Es la regla de las comisiones pagadas en cripto (D0, regla 1):
 * el gas reduce el stock sin ser transmisión, así que no puede imputarse a los lotes más
 * antiguos como si lo fuera.
 *
 * Devuelve el coste medio ponderado retirado —el de las unidades que efectivamente han
 * salido—, que es el que se traslada a la operación servida.
 *
 * El residuo de redondeo se asigna al último lote vivo para que la suma de las partes sea
 * EXACTAMENTE la cantidad pedida: con divisiones periódicas (1/3 de un lote, por ejemplo)
 * la suma de los cocientes no cierra por sí sola, y la cola quedaría descuadrada respecto
 * del saldo, que es justo lo que D0 viene a evitar.
 */
function retirarProrrateado(cola: ColaViva, cantidad: Decimal): Retirada {
  const disponible = cola.cantidadViva
  if (disponible.lessThanOrEqualTo(0)) {
    return { costeFifo: CERO, consumos: [], sinCoste: cantidad }
  }

  // Cola insuficiente: se retira todo lo que hay y se informa del faltante.
  const aRetirar = Decimal.min(cantidad, disponible)

  // Coste medio ponderado de lo retirado, en O(1) sobre los agregados vivos. Es
  // idénticamente igual a repartir lote a lote: Σ(costeUnit_i × rest_i × k) = k × costeVivo,
  // con k = aRetirar / disponible.
  const costeFifo = aRetirar.times(cola.costeVivo).div(disponible)

  // La reducción es UNIFORME: cada lote vivo se queda con la misma fracción
  // (disponible − aRetirar) / disponible. En lugar de recorrer la cola, se acumula ese
  // factor en la escala y cada lote se pone al día cuando se le toca (`materializar`).
  // Así el prorrateo es O(1) y la estructura relativa de la cola no cambia: solo encoge.
  //
  // No se emite detalle por lote: un prorrateo roza TODOS los lotes vivos, de modo que el
  // detalle sería una lista de miles de entradas de importe ínfimo. El hecho relevante es
  // «se pagó gas», no de qué lote salió cada millonésima.
  cola.escala = cola.escala.times(disponible.minus(aRetirar)).div(disponible)
  const asignado = aRetirar
  cola.consumidoTotal = cola.consumidoTotal.plus(asignado)
  cola.cantidadViva = cola.cantidadViva.minus(asignado)
  cola.costeVivo = cola.costeVivo.minus(costeFifo)
  return { costeFifo, consumos: [], sinCoste: cantidad.minus(asignado) }
}

/** Vuelca una cola viva a su resumen inmutable. */
function resumirCola(activo: SimboloActivo, cola: ColaViva): ColaFifoResumen {
  for (const l of cola.lotes) materializar(cola, l)

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

  // Coste del restante: se toma del agregado incremental `costeVivo`, no de la suma lote a
  // lote. Ambos coinciden en la operativa FIFO pura, pero el agregado es el valor EXACTO
  // cuando hay prorrateos de por medio: se construye restando exactamente los costes
  // retirados, sin volver a dividir por cantidades que ya vienen de una división.
  const costeRestante = cola.costeVivo

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
    // Los flags se leen SIEMPRE resueltos para este apunte: el catálogo marca DONACIÓN y
    // AJUSTE con `'segun'`, y compararlos con `=== true` equivalía a resolver el «según el
    // caso» como «no» en silencio, dejando la cola FIFO por encima del saldo real.
    const flags = resolverFlags(ap)
    const transmite = flags.consumeLote && !!ap.activoSalida && !!ap.cantidadSalida
    const adquiere = flags.abreLote && !!ap.activoEntrada && !!ap.cantidadEntrada

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
    //    informe fiscal. Se retira PRORRATEADO, no en orden FIFO, porque el FIFO es la
    //    regla de las transmisiones y esto no lo es (D0, regla 1).
    let costeComision = CERO
    const com = comisionCripto(ap)
    if (com) costeComision = retirarProrrateado(cola(com.activo), com.cantidad).costeFifo

    // 3. Cierre de la transmisión. El coste FIFO de la comisión minora el valor de
    //    transmisión (gasto inherente, art. 35.2 LIRPF) — D0, regla 3.
    if (retiradaTransmision && cantidadTransmitida.greaterThan(0)) {
      const valorNeto = valorPermutaEUR(ap).minus(comisionEUR(ap)).minus(costeComision)
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
      // Donación ENTREGADA: transmisión lucrativa ínter vivos. La ganancia se computa; la
      // pérdida no (art. 33.5.c LIRPF). El motor la calcula igual y la marca; quien decide
      // qué hacer con ella es `fiscal.ts`.
      if (esTransmisionLucrativa(ap)) t.lucrativa = true
      cola(ap.activoSalida!).transmisiones.push(t)
    }

    // 4. Apertura de lote. Si el apunte NO transmite, el coste de la comisión suma al
    //    coste de adquisición (D0, regla 3). Si transmite, ya se aplicó arriba y no se
    //    cuenta dos veces. Si es un traslado (ni transmite ni adquiere), el coste se
    //    pierde: no es deducible en ninguna parte (D0, regla 4).
    if (adquiere) {
      const cantidad = D(ap.cantidadEntrada)
      if (cantidad.greaterThan(0)) {
        const coste = valorPermutaEUR(ap)
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
          // Nace en la escala actual: los prorrateos anteriores no le afectan.
          escalaBase: c.escala,
        })
        c.adquiridoTotal = c.adquiridoTotal.plus(cantidad)
        c.cantidadViva = c.cantidadViva.plus(cantidad)
        c.costeVivo = c.costeVivo.plus(coste)
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
    const flags = resolverFlags(ap)
    if (flags.abreLote && ap.activoEntrada) set.add(ap.activoEntrada)
    if (flags.consumeLote && ap.activoSalida) set.add(ap.activoSalida)
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
