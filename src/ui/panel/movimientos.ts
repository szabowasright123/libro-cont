/**
 * movimientos.ts — el drill-down de una celda de SALDOS: qué apuntes la mueven y cómo.
 *
 * `calcularSaldos` (engine/saldos.ts) responde «cuánto hay» con los cuatro agregados de la
 * celda —entradas, salidas, comisiones y saldo—, que es lo que pide la hoja SALDOS de la
 * plantilla. Lo que NO devuelve, porque la hoja tampoco lo tiene, es el camino: qué apunte
 * puso cada unidad ahí y cuánto había en la celda después de cada uno. Y ese camino es
 * justamente lo que convierte una cifra en algo que se puede enseñar: la columna de saldo
 * acumulado es la que deja *ver* de dónde sale el número.
 *
 * Este módulo replica —literalmente, movimiento a movimiento— las tres reglas de imputación
 * de `saldos.ts` (entrada al DESTINO, salida al ORIGEN, comisión al ORIGEN salvo que el
 * origen sea EXTERIOR, en cuyo caso al DESTINO) y las emite desagregadas y en orden
 * cronológico. Es una LECTURA del motor, no un cálculo nuevo: el invariante que lo ata es
 * que la última fila del acumulado tiene que ser, cifra por cifra, el `saldo` que devuelve
 * `calcularSaldos` para esa misma celda. `movimientos.test.ts` lo comprueba.
 *
 * Capa PURA: `decimal.js` y tipos del motor, nada más. Sin React, sin Dexie (Regla de oro 2
 * y 4: la aritmética es de decimal.js, nunca de `number`).
 */
import {
  type Apunte,
  type RefUbicacion,
  type SimboloActivo,
  type TipoOperacion,
  type FechaHoraISO,
  UBICACION_EXTERIOR,
} from '../../engine/types'
import { D, aCadena, CERO, Decimal } from '../../engine/decimal'

/** Por qué concepto el apunte toca esta celda (las tres reglas de imputación de SALDOS). */
export type ConceptoMovimiento = 'entrada' | 'salida' | 'comision'

/** Rótulo de cada concepto para la pantalla. */
export const ETIQUETA_CONCEPTO: Readonly<Record<ConceptoMovimiento, string>> = Object.freeze({
  entrada: 'Entrada',
  salida: 'Salida',
  comision: 'Comisión',
})

/** Un movimiento de la celda: un apunte, un concepto, su aportación y el saldo tras él. */
export interface MovimientoCelda {
  apunteId: string
  fechaHora: FechaHoraISO
  tipo: TipoOperacion
  concepto: ConceptoMovimiento
  /**
   * La otra punta del movimiento: de dónde vino lo que entró o a dónde fue lo que salió.
   * `null` en las comisiones, que no tienen contraparte (se las queda la red o la casa).
   */
  contraparte: RefUbicacion | null
  /** Aportación FIRMADA al saldo de la celda: positiva si entra, negativa si sale. */
  aportacion: string
  /** Saldo de la celda DESPUÉS de este movimiento (la columna que se explica sola). */
  acumulado: string
}

/** Un mismo apunte puede tocar la celda dos veces (sale BTC y la comisión también es BTC). */
interface Emision {
  concepto: ConceptoMovimiento
  cantidad: Decimal
  contraparte: RefUbicacion | null
}

/**
 * Apuntes que mueven la celda (ubicación × activo), en orden cronológico, cada uno con su
 * aportación firmada y el saldo acumulado tras él.
 *
 * @param apuntes    diario (se ordena por fecha aquí: no se exige orden previo, porque el
 *                   saldo no depende del orden aunque su relato sí)
 * @param ubicacion  celda a explicar; `EXTERIOR` no tiene saldo propio y devuelve vacío
 * @param activo     activo de la celda
 * @param corte      ISO de corte inclusive, el mismo que se pasó a `calcularSaldos`
 */
export function movimientosDeCelda(
  apuntes: readonly Apunte[],
  ubicacion: RefUbicacion,
  activo: SimboloActivo,
  corte?: FechaHoraISO,
): MovimientoCelda[] {
  // EXTERIOR es la frontera del patrimonio, no un sitio donde haya saldo (DOMINIO §3.2).
  if (ubicacion === UBICACION_EXTERIOR) return []

  const corteMs = corte ? new Date(corte).getTime() : null
  const orden = [...apuntes].sort((a, b) => {
    const d = new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime()
    return d !== 0 ? d : a.id.localeCompare(b.id)
  })

  const salida: MovimientoCelda[] = []
  let acumulado = CERO

  for (const ap of orden) {
    if (corteMs !== null && new Date(ap.fechaHora).getTime() > corteMs) continue

    const emisiones: Emision[] = []

    // 1. Entradas: lo recibido, imputado al DESTINO.
    if (ap.activoEntrada === activo && ap.cantidadEntrada && ap.ubicacionDestino === ubicacion) {
      emisiones.push({
        concepto: 'entrada',
        cantidad: D(ap.cantidadEntrada),
        contraparte: ap.ubicacionOrigen,
      })
    }

    // 2. Salidas: lo entregado, imputado al ORIGEN.
    if (ap.activoSalida === activo && ap.cantidadSalida && ap.ubicacionOrigen === ubicacion) {
      emisiones.push({
        concepto: 'salida',
        cantidad: D(ap.cantidadSalida).negated(),
        contraparte: ap.ubicacionDestino,
      })
    }

    // 3. Comisión: en el ORIGEN; si el origen es EXTERIOR, en el DESTINO.
    if (ap.comisionActivo === activo && ap.comisionCantidad) {
      const ubicComision =
        ap.ubicacionOrigen === UBICACION_EXTERIOR ? ap.ubicacionDestino : ap.ubicacionOrigen
      if (ubicComision === ubicacion) {
        emisiones.push({
          concepto: 'comision',
          cantidad: D(ap.comisionCantidad).negated(),
          contraparte: null,
        })
      }
    }

    for (const e of emisiones) {
      acumulado = acumulado.plus(e.cantidad)
      salida.push({
        apunteId: ap.id,
        fechaHora: ap.fechaHora,
        tipo: ap.tipo,
        concepto: e.concepto,
        contraparte: e.contraparte,
        aportacion: aCadena(e.cantidad),
        acumulado: aCadena(acumulado),
      })
    }
  }

  return salida
}
