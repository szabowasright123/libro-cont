/**
 * cuadre.ts — motor de CUADRE (traducción de la hoja CUADRE de la plantilla).
 *
 * Fuente de verdad: fórmulas de docs/reference/PLANTILLA_TALLER.xlsx, hoja CUADRE.
 * Por ubicación × activo:
 *
 *   diferencia = saldo real declarado − saldo calculado          (columna E = D − C)
 *   estado:  |dif| ≤ tolerancia verde  → OK
 *            |dif| ≤ tolerancia ámbar  → REVISAR
 *            mayor                     → ERROR                    (columna F)
 *
 * El saldo real lo teclea el alumno desde la fuente (exchange/wallet). Tolerancias
 * por defecto: verde ≤ 1e-8, ámbar ≤ 0,001 (configurables, DOMINIO §4).
 *
 * Determinista y TypeScript puro (Regla de oro 4).
 */

import {
  type SaldoCelda,
  type FilaCuadre,
  type EstadoSemaforo,
  type Tolerancias,
  type RefUbicacion,
  type SimboloActivo,
  TOLERANCIAS_POR_DEFECTO,
} from './types'
import { D, aCadena, Decimal } from './decimal'

/** Saldo real declarado por el alumno para una celda (ubicación × activo). */
export interface SaldoRealDeclarado {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  saldoReal: string
}

/** Clasifica una diferencia absoluta según las tolerancias del semáforo. */
export function estadoSemaforo(diferencia: Decimal, tol: Tolerancias): EstadoSemaforo {
  const abs = diferencia.abs()
  if (abs.lessThanOrEqualTo(tol.verde)) return 'OK'
  if (abs.lessThanOrEqualTo(tol.ambar)) return 'REVISAR'
  return 'ERROR'
}

/**
 * Cruza los saldos calculados por el motor con los saldos reales declarados y
 * produce el semáforo del cuadre. Solo se generan filas para las celdas con saldo
 * real declarado (como en la hoja CUADRE, donde la diferencia queda vacía sin dato).
 *
 * @param saldosCalculados  salida de `calcularSaldos`
 * @param saldosReales      lo tecleado por el alumno
 * @param tol               tolerancias (por defecto: verde 1e-8, ámbar 0,001)
 */
export function calcularCuadre(
  saldosCalculados: SaldoCelda[],
  saldosReales: SaldoRealDeclarado[],
  tol: Tolerancias = TOLERANCIAS_POR_DEFECTO,
): FilaCuadre[] {
  const calc = new Map<string, SaldoCelda>()
  for (const c of saldosCalculados) calc.set(`${c.ubicacion} ${c.activo}`, c)

  const filas: FilaCuadre[] = []
  for (const real of saldosReales) {
    const k = `${real.ubicacion} ${real.activo}`
    const saldoCalculado = calc.get(k)?.saldo ?? '0'
    const diferencia = D(real.saldoReal).minus(D(saldoCalculado))
    filas.push({
      ubicacion: real.ubicacion,
      activo: real.activo,
      saldoReal: real.saldoReal,
      saldoCalculado,
      diferencia: aCadena(diferencia),
      estado: estadoSemaforo(diferencia, tol),
    })
  }
  return filas
}
