/**
 * decimal.ts — utilidades de aritmética exacta para el motor.
 *
 * Regla de oro 2: NUNCA aritmética float para cantidades ni euros. Todo importe y
 * toda cantidad se operan con decimal.js. Este módulo centraliza la configuración
 * (precisión alta para no perder dígitos en divisiones de coste unitario) y ofrece
 * atajos para construir y sumar Decimals a partir de las cadenas del dominio.
 *
 * TypeScript puro: sin React, sin Dexie, sin browser APIs (Regla de oro 4).
 */

import Decimal from 'decimal.js'

// Precisión generosa: las divisiones (coste unitario = coste/cantidad) no deben
// truncar. 40 dígitos significativos cubren de sobra BTC (8 decimales) y euros.
Decimal.set({ precision: 40, toExpNeg: -40, toExpPos: 40 })

export { Decimal }

/** Cero como Decimal (constante reutilizable). */
export const CERO = new Decimal(0)

/**
 * Construye un Decimal a partir de una cadena decimal del dominio (o undefined → 0).
 * Acepta ya un Decimal (lo devuelve tal cual) para componer con comodidad.
 */
export function D(x: string | number | Decimal | undefined | null): Decimal {
  if (x === undefined || x === null || x === '') return CERO
  return x instanceof Decimal ? x : new Decimal(x)
}

/** Suma una lista de valores decimales del dominio. */
export function suma(...xs: Array<string | number | Decimal | undefined | null>): Decimal {
  return xs.reduce<Decimal>((acc, x) => acc.plus(D(x)), CERO)
}

/**
 * Serializa un Decimal a cadena decimal exacta con `decimales` posiciones fijas.
 * Se usa para las salidas del motor (CantidadDecimal / EuroDecimal). Sin notación
 * exponencial. Redondeo por defecto: ROUND_HALF_UP (irrelevante en los golden, que
 * son exactos, pero determinista para el resto).
 */
export function aCadena(x: Decimal, decimales?: number): string {
  return decimales === undefined ? x.toFixed() : x.toFixed(decimales)
}
