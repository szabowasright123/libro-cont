/**
 * conciliacion.ts — CONCILIACIÓN entre la COLA FIFO y los SALDOS.
 *
 * El hueco que cierra este módulo, y por qué existe.
 *
 * El Libro lleva dos contabilidades paralelas de la misma realidad:
 *
 *   · los SALDOS  (`saldos.ts`)  responden a «¿cuánto tengo, y dónde?»;
 *   · la COLA FIFO (`fifo.ts`)   responde a «¿cuánto costó lo que tengo?».
 *
 * Las dos se alimentan del mismo diario, así que —salvo que algo esté mal clasificado— la
 * suma de saldos de un activo y las existencias vivas de su cola FIFO tienen que coincidir.
 * Hasta la v1.5.0 nadie comprobaba esa igualdad, y no coincidían: DONACIÓN y AJUSTE llevan
 * flags `'segun'` en el catálogo y el motor los resolvía como «no» al compararlos con
 * `=== true`, de modo que un bitcoin donado bajaba del saldo y seguía vivo en la cola. El
 * caso de ejemplo de la app arrastraba 0,01 BTC de existencias fantasma con su coste, que
 * la siguiente venta habría consumido.
 *
 * Es exactamente el «error invisible» de [MT] U6.2: una clasificación equivocada que NO
 * descuadra el CUADRE, porque el CUADRE compara el saldo calculado con el saldo real
 * declarado por el alumno —y ese sí cuadra—. El descuadre está una capa más abajo.
 *
 * Diferencia con `cuadre.ts` (importante, y conviene explicarla en clase):
 *
 *   · CUADRE       = saldo calculado  vs  saldo REAL declarado  → «¿me falta un apunte?»
 *   · CONCILIACIÓN = saldo calculado  vs  cola FIFO             → «¿está bien clasificado?»
 *
 * El primero mira hacia fuera (contra el exchange o la wallet); el segundo mira hacia
 * dentro, y solo puede fallar por un error de clasificación del propio Libro.
 *
 * Capa PURA: TypeScript, `decimal.js` y nada más (Regla de oro 4). No conoce React, ni
 * Dexie, ni el navegador.
 */

import {
  type Activo,
  type Apunte,
  type SimboloActivo,
  type EstadoSemaforo,
  type Tolerancias,
  ACTIVOS_BASE,
  TOLERANCIAS_POR_DEFECTO,
  resolverFlags,
} from './types'
import { D, aCadena, CERO, Decimal } from './decimal'
import { calcularSaldos } from './saldos'
import { calcularFifo, activosConCola } from './fifo'
import { estadoSemaforo } from './cuadre'

/** Motivo por el que un activo no concilia (para explicarlo, no solo señalarlo). */
export type MotivoDescuadre =
  /** Hay apuntes con flags «según el caso» sin `sentido` que los resuelva. */
  | 'sentido-sin-resolver'
  /** La cola se quedó corta en alguna transmisión (saldo FIFO insuficiente). */
  | 'saldo-fifo-insuficiente'
  /** Descuadre sin causa identificada por el motor: hay que mirar el diario. */
  | 'sin-identificar'

/** Una fila de la conciliación: un activo. */
export interface FilaConciliacion {
  activo: SimboloActivo
  /** Suma de los saldos de todas las ubicaciones para este activo. */
  saldoTotal: string
  /** Existencias vivas en la cola FIFO (adquirido − consumido). */
  existenciasFifo: string
  /** existenciasFifo − saldoTotal. Positivo = sobra cola; negativo = falta cola. */
  diferencia: string
  estado: EstadoSemaforo
  /** Motivos detectados cuando el estado no es OK (vacío si concilia). */
  motivos: MotivoDescuadre[]
  /** Apuntes implicados en los motivos, para el drill-down de la UI. */
  apuntesImplicados: string[]
}

/** Resultado completo de la conciliación. */
export interface ResultadoConciliacion {
  filas: FilaConciliacion[]
  /** Peor estado de todas las filas (verde solo si TODAS concilian). */
  estadoGlobal: EstadoSemaforo
  /** Nº de activos que no concilian (estado distinto de OK). */
  activosDescuadrados: number
}

/** Orden de gravedad para quedarse con el peor semáforo. */
const GRAVEDAD: Readonly<Record<EstadoSemaforo, number>> = { OK: 0, REVISAR: 1, ERROR: 2 }

function peor(a: EstadoSemaforo, b: EstadoSemaforo): EstadoSemaforo {
  return GRAVEDAD[b] > GRAVEDAD[a] ? b : a
}

/** Opciones de la conciliación. */
export interface OpcionesConciliacion {
  /** ISO de corte inclusive para los SALDOS. Omitir para todo el diario. */
  corte?: string
  /** Tolerancias del semáforo (por defecto, las mismas que el CUADRE). */
  tolerancias?: Tolerancias
  /**
   * Catálogo de activos, para saber cuáles son FIAT. El euro tiene saldo y no tiene cola
   * FIFO —es la moneda de cuenta, no un elemento patrimonial cuyo coste se siga—, así que
   * conciliarlo daría siempre un descuadre por el importe entero del saldo. Si no se pasa,
   * se usa `ACTIVOS_BASE` (EUR fiat, BTC no).
   */
  activos?: readonly Activo[]
}

/**
 * Concilia, activo a activo, la suma de saldos con las existencias vivas de la cola FIFO.
 *
 * @param apuntes  diario completo, en orden cronológico (lo exige `calcularFifo`)
 * @param op       ver `OpcionesConciliacion`
 *
 * La cola FIFO se calcula siempre sobre el diario que se le pasa: para conciliar a una
 * fecha pasada hay que pasar el diario ya recortado, no solo el `corte`.
 */
export function conciliarFifoSaldos(
  apuntes: Apunte[],
  op: OpcionesConciliacion = {},
): ResultadoConciliacion {
  const tol = op.tolerancias ?? TOLERANCIAS_POR_DEFECTO
  // BTC y EUR son «de serie» (ACTIVOS_BASE) y el repositorio guarda solo los que el alumno
  // añade, así que el catálogo que llega puede no traer el euro: se une siempre, y lo que
  // venga por parámetro manda sobre la definición de serie.
  const catalogo = [...ACTIVOS_BASE, ...(op.activos ?? [])]
  const esFiat = new Set<SimboloActivo>()
  for (const a of catalogo) {
    if (a.esFiat) esFiat.add(a.simbolo)
    else esFiat.delete(a.simbolo)
  }

  const saldos = calcularSaldos([...apuntes], op.corte)
  const fifo = calcularFifo([...apuntes])

  // Activos a conciliar: los que tienen cola + los que tienen saldo, MENOS los fiat. La
  // unión y no la intersección, porque un activo con saldo y SIN cola —una cripto que
  // entró sin registrar su adquisición— es justamente uno de los casos a cazar.
  const activos = new Set<SimboloActivo>(activosConCola([...apuntes]))
  const saldoPorActivo = new Map<SimboloActivo, Decimal>()
  for (const s of saldos) {
    saldoPorActivo.set(s.activo, (saldoPorActivo.get(s.activo) ?? CERO).plus(D(s.saldo)))
    activos.add(s.activo)
  }
  for (const f of esFiat) activos.delete(f)

  // Índice de causas: apuntes con sentido sin resolver, por activo implicado.
  const sinResolverPorActivo = new Map<SimboloActivo, string[]>()
  for (const ap of apuntes) {
    if (!resolverFlags(ap).sinResolver) continue
    for (const a of [ap.activoSalida, ap.activoEntrada]) {
      if (!a) continue
      const lista = sinResolverPorActivo.get(a) ?? []
      if (!lista.includes(ap.id)) lista.push(ap.id)
      sinResolverPorActivo.set(a, lista)
    }
  }

  const filas: FilaConciliacion[] = []
  let estadoGlobal: EstadoSemaforo = 'OK'

  for (const activo of [...activos].sort()) {
    const saldoTotal = saldoPorActivo.get(activo) ?? CERO
    const cola = fifo.get(activo)
    const existencias = cola ? D(cola.resumen.restanteTotal) : CERO
    const diferencia = existencias.minus(saldoTotal)
    const estado = estadoSemaforo(diferencia, tol)

    const motivos: MotivoDescuadre[] = []
    const apuntesImplicados: string[] = []

    if (estado !== 'OK') {
      const sinResolver = sinResolverPorActivo.get(activo) ?? []
      if (sinResolver.length > 0) {
        motivos.push('sentido-sin-resolver')
        apuntesImplicados.push(...sinResolver)
      }
      const cortos = (cola?.transmisiones ?? []).filter((t) => t.saldoFifoInsuficiente)
      if (cortos.length > 0) {
        motivos.push('saldo-fifo-insuficiente')
        for (const t of cortos) if (!apuntesImplicados.includes(t.apunteId)) apuntesImplicados.push(t.apunteId)
      }
      if (motivos.length === 0) motivos.push('sin-identificar')
    }

    filas.push({
      activo,
      saldoTotal: aCadena(saldoTotal),
      existenciasFifo: aCadena(existencias),
      diferencia: aCadena(diferencia),
      estado,
      motivos,
      apuntesImplicados,
    })
    estadoGlobal = peor(estadoGlobal, estado)
  }

  return {
    filas,
    estadoGlobal,
    activosDescuadrados: filas.filter((f) => f.estado !== 'OK').length,
  }
}

/** Texto llano del motivo, para la UI y para el informe de cierre. */
export const TEXTO_MOTIVO: Readonly<Record<MotivoDescuadre, string>> = Object.freeze({
  'sentido-sin-resolver':
    'Hay apuntes de DONACIÓN o AJUSTE sin indicar si son entregados o recibidos. Mientras no se indique, el motor no mueve la cola FIFO y las existencias quedan por encima del saldo.',
  'saldo-fifo-insuficiente':
    'Alguna transmisión consumió más cantidad de la que había en la cola: falta registrar la adquisición que la precede (la «trampa del coste cero» de [MT] U2.5).',
  'sin-identificar':
    'El motor no ha podido atribuir el descuadre a una causa conocida. Revisa el diario del activo apunte a apunte.',
})
