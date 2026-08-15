/**
 * saldos.ts — motor de SALDOS (traducción de la hoja SALDOS de la plantilla).
 *
 * Fuente de verdad: fórmulas de docs/reference/PLANTILLA_TALLER.xlsx, hoja SALDOS.
 * Por cada celda (ubicación × activo) a una fecha de corte:
 *
 *   entradas   = Σ cantidadEntrada  con  destino = ubicación  y  activoEntrada = activo
 *   salidas    = Σ cantidadSalida   con  origen  = ubicación  y  activoSalida  = activo
 *   comisiones = Σ comisión con origen = ubicación y comisionActivo = activo
 *              + Σ comisión con origen = EXTERIOR y destino = ubicación y comisionActivo = activo
 *   saldo      = entradas − salidas − comisiones
 *
 * (Comisión: se descuenta en el ORIGEN; si el origen es EXTERIOR, en el DESTINO.
 *  Réplica exacta de la doble SUMIFS de la columna E de la hoja SALDOS.)
 *
 * Solo cuentan los apuntes con fechaHora ≤ corte. Saldo negativo ⇒ alerta roja
 * (venta o salida sin origen registrado, Unidad 7).
 *
 * TypeScript puro y determinista (estado → resultado). Regla de oro 4.
 */

import {
  type Apunte,
  type RefUbicacion,
  type SimboloActivo,
  type SaldoCelda,
  type FechaHoraISO,
  UBICACION_EXTERIOR,
} from './types'
import { D, aCadena, CERO, Decimal } from './decimal'

/** Acumulador mutable interno de una celda. */
interface Acum {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  entradas: Decimal
  salidas: Decimal
  comisiones: Decimal
}

/** Clave estable ubicación|activo para el mapa de celdas. */
function clave(ubicacion: RefUbicacion, activo: SimboloActivo): string {
  return `${ubicacion}\u0000${activo}`
}

/** Devuelve (creando si hace falta) el acumulador de una celda. */
function celda(mapa: Map<string, Acum>, ubicacion: RefUbicacion, activo: SimboloActivo): Acum {
  const k = clave(ubicacion, activo)
  let c = mapa.get(k)
  if (!c) {
    c = { ubicacion, activo, entradas: CERO, salidas: CERO, comisiones: CERO }
    mapa.set(k, c)
  }
  return c
}

/** ¿El apunte entra en el corte? (fechaHora ≤ corte; si no hay corte, siempre.) */
function dentroDeCorte(apunte: Apunte, corteMs: number | null): boolean {
  if (corteMs === null) return true
  const t = new Date(apunte.fechaHora).getTime()
  return t <= corteMs
}

/**
 * Calcula los saldos por ubicación × activo hasta la fecha de corte (inclusive).
 *
 * @param apuntes  diario completo (en cualquier orden; el saldo no depende del orden)
 * @param corte    ISO de fecha de corte inclusive; omitir para incluir todo el diario
 * @returns una celda por cada par (ubicación, activo) que haya tenido movimiento;
 *          `EXTERIOR` no genera celdas propias (es la frontera, no un saldo real).
 */
export function calcularSaldos(apuntes: Apunte[], corte?: FechaHoraISO): SaldoCelda[] {
  const corteMs = corte ? new Date(corte).getTime() : null
  const mapa = new Map<string, Acum>()

  for (const ap of apuntes) {
    if (!dentroDeCorte(ap, corteMs)) continue

    // Entradas: lo recibido, imputado al DESTINO (salvo que el destino sea EXTERIOR).
    if (ap.activoEntrada && ap.cantidadEntrada && ap.ubicacionDestino !== UBICACION_EXTERIOR) {
      const c = celda(mapa, ap.ubicacionDestino, ap.activoEntrada)
      c.entradas = c.entradas.plus(D(ap.cantidadEntrada))
    }

    // Salidas: lo entregado, imputado al ORIGEN (salvo que el origen sea EXTERIOR).
    if (ap.activoSalida && ap.cantidadSalida && ap.ubicacionOrigen !== UBICACION_EXTERIOR) {
      const c = celda(mapa, ap.ubicacionOrigen, ap.activoSalida)
      c.salidas = c.salidas.plus(D(ap.cantidadSalida))
    }

    // Comisión: en el ORIGEN; si el origen es EXTERIOR, en el DESTINO.
    if (ap.comisionActivo && ap.comisionCantidad) {
      const ubicComision =
        ap.ubicacionOrigen === UBICACION_EXTERIOR ? ap.ubicacionDestino : ap.ubicacionOrigen
      if (ubicComision !== UBICACION_EXTERIOR) {
        const c = celda(mapa, ubicComision, ap.comisionActivo)
        c.comisiones = c.comisiones.plus(D(ap.comisionCantidad))
      }
    }
  }

  const filas: SaldoCelda[] = []
  for (const c of mapa.values()) {
    const saldo = c.entradas.minus(c.salidas).minus(c.comisiones)
    filas.push({
      ubicacion: c.ubicacion,
      activo: c.activo,
      entradas: aCadena(c.entradas),
      salidas: aCadena(c.salidas),
      comisiones: aCadena(c.comisiones),
      saldo: aCadena(saldo),
      negativo: saldo.isNegative(),
    })
  }
  return filas
}

/**
 * Suma los saldos de todas las ubicaciones por activo (total del patrimonio por
 * activo a la fecha de corte). Útil para los golden tests (que comprueban totales).
 */
export function saldosTotalesPorActivo(
  apuntes: Apunte[],
  corte?: FechaHoraISO,
): Map<SimboloActivo, string> {
  const celdas = calcularSaldos(apuntes, corte)
  const tot = new Map<SimboloActivo, Decimal>()
  for (const c of celdas) {
    tot.set(c.activo, (tot.get(c.activo) ?? CERO).plus(D(c.saldo)))
  }
  const out = new Map<SimboloActivo, string>()
  for (const [activo, v] of tot) out.set(activo, aCadena(v))
  return out
}
