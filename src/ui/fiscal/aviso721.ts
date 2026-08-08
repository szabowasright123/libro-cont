/**
 * aviso721.ts — aviso del modelo 721 con DOBLE FECHA y exclusión de autocustodia (derivada D2,
 * P9.4). Capa pura que LEE el motor (`calcularSaldos`) sin tocarlo (Regla de oro 1):
 *
 *  - **Doble corte:** estimación anticipada a 20-oct (margen para anticipar la obligación) y
 *    corte normativo a 31-dic (fecha legal de referencia; presentación 1-ene→31-mar del año
 *    siguiente). Solo el 31-dic refleja la regla; el 20-oct se rotula como estimación.
 *  - **Autocustodia excluida:** las wallets cuyas claves controla el alumno no computan para el
 *    721 (FAQ AEAT). Solo entran ubicaciones `extranjero` que NO sean `autocustodia`.
 *  - **Precios manuales:** local-first; sin precio la cripto queda «sin valorar» y el total es un
 *    mínimo (el aviso nunca afirma que se supera).
 *
 * Nunca es cálculo de obligación: es un aviso informativo.
 */
import type { Apunte, RefUbicacion, SimboloActivo, Ubicacion } from '../../engine/types'
import { calcularSaldos } from '../../engine/saldos'
import { D, aCadena, CERO } from '../../engine/decimal'
import {
  UMBRAL_721_EUR,
  type AvisoSaldoExtranjero,
  type SaldoExtranjeroCelda,
} from '../../engine/fiscal'

/** Corte de la estimación anticipada (20 de octubre del ejercicio, inclusive). */
export function corteEstimacion(ejercicio: number): string {
  return `${ejercicio}-10-20T23:59:59`
}

/** Corte normativo (31 de diciembre del ejercicio, inclusive) — la fecha legal de referencia. */
export function corteNormativo(ejercicio: number): string {
  return `${ejercicio}-12-31T23:59:59`
}

/** Precios manuales EUR por activo (cadena decimal interna). EUR vale 1 implícitamente. */
export type PreciosManuales = Readonly<Record<SimboloActivo, string>>

/**
 * Calcula el aviso 721 a un corte dado sobre las ubicaciones extranjeras NO autocustodia.
 * Estructura idéntica a la del motor (`AvisoSaldoExtranjero`), pero a una fecha arbitraria y
 * excluyendo la autocustodia. La cripto se valora con precios manuales; sin precio, «sin valorar».
 */
function avisoEnCorte(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  corteISO: string,
  precios: PreciosManuales,
  umbral: number,
): AvisoSaldoExtranjero {
  // Perímetro: extranjero y NO autocustodia (la autocustodia nunca computa para el 721).
  const computables = new Map<RefUbicacion, Ubicacion>()
  for (const u of ubicaciones) if (u.extranjero && !u.autocustodia) computables.set(u.id, u)

  const saldos = calcularSaldos([...apuntes], corteISO)
  const celdas: SaldoExtranjeroCelda[] = []
  let total = CERO
  let haySinValorar = false

  for (const s of saldos) {
    const ubic = computables.get(s.ubicacion)
    if (!ubic) continue
    if (D(s.saldo).isZero()) continue

    let valorEUR: string | null
    let sinValorar = false
    if (s.activo === 'EUR') {
      valorEUR = s.saldo
    } else {
      const precio = precios[s.activo]
      if (precio !== undefined && precio !== '') {
        valorEUR = aCadena(D(s.saldo).times(D(precio)))
      } else {
        valorEUR = null
        sinValorar = true
        haySinValorar = true
      }
    }
    if (valorEUR !== null) total = total.plus(D(valorEUR))
    celdas.push({
      ubicacion: s.ubicacion,
      nombre: ubic.nombre,
      ...(ubic.pais ? { pais: ubic.pais } : {}),
      activo: s.activo,
      saldo: s.saldo,
      valorEUR,
      sinValorar,
    })
  }

  celdas.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.activo.localeCompare(b.activo))
  return {
    aplica: celdas.length > 0,
    supera: total.greaterThan(umbral),
    umbralEUR: umbral,
    totalValoradoEUR: aCadena(total),
    celdas,
    haySinValorar,
  }
}

/** Aviso 721 en sus dos cortes (estimación 20-oct y normativo 31-dic). */
export interface Aviso721DobleFecha {
  /** ¿Hay alguna ubicación extranjera no autocustodia con saldo en algún corte? */
  aplica: boolean
  umbralEUR: number
  /** Corte anticipado a 20 de octubre (estimación; la referencia legal es el 31/12). */
  estimacion: AvisoSaldoExtranjero
  /** Corte normativo a 31 de diciembre (la fecha legal de referencia del saldo). */
  normativo: AvisoSaldoExtranjero
}

/**
 * Aviso 721 con doble fecha. Determinista y puro; no hace red. `precios` los teclea el alumno.
 */
export function calcularAviso721(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  ejercicio: number,
  precios: PreciosManuales,
  umbral: number = UMBRAL_721_EUR,
): Aviso721DobleFecha {
  const estimacion = avisoEnCorte(apuntes, ubicaciones, corteEstimacion(ejercicio), precios, umbral)
  const normativo = avisoEnCorte(apuntes, ubicaciones, corteNormativo(ejercicio), precios, umbral)
  return {
    aplica: estimacion.aplica || normativo.aplica,
    umbralEUR: umbral,
    estimacion,
    normativo,
  }
}
