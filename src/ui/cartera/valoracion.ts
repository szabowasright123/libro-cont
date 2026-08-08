/**
 * valoracion.ts — capa PURA de valoración de la Cartera (P9.2).
 *
 * NO es un módulo de cálculo nuevo del motor: LEE las salidas que el motor ya expone
 * (saldos totales por activo, coste FIFO restante de la cola) y las combina con el único
 * dato nuevo del usuario —el precio manual (local-first, jamás por red)— para presentar la
 * cartera. El motor (`src/engine`) NO se toca (Regla de oro 1).
 *
 * Determinista y sin efectos: sin React, sin Dexie, sin browser APIs. Aritmética con
 * decimal.js (Regla de oro 2); nunca `number` para euros/cantidades salvo el peso % (que es
 * presentación, no importe del dominio).
 */
import type { Apunte, Ubicacion, Justificante, SimboloActivo } from '../../engine/types'
import { saldosTotalesPorActivo } from '../../engine/saldos'
import { calcularFifo } from '../../engine/fifo'
import { calcularResumenFiscal, ejerciciosConDatos } from '../../engine/fiscal'
import { D, aCadena, CERO } from '../../engine/decimal'

// ────────────────────────────────────────────────────────────────────────────
// Colores de serie FIJOS POR ENTIDAD (P9.2). Nunca por orden de aparición: si un
// filtro quita una serie, las demás no se repintan. Paleta validada para daltonismo
// en modo claro; los dos naranjas (BTC y «ganancia» del otro gráfico) nunca coinciden
// en el mismo gráfico.
// ────────────────────────────────────────────────────────────────────────────

/** Color pinchado por símbolo para BTC/ETH/USDC. */
export const COLOR_POR_ACTIVO: Readonly<Record<string, string>> = {
  BTC: '#e8820c',
  ETH: '#2a78d6',
  USDC: '#1baf7a',
}
/** Color del 4.º activo cripto (el de mayor valor que no sea BTC/ETH/USDC). */
export const COLOR_CUARTO_CRIPTO = '#4a3aa7'
/** Color de EUR y del grupo «Otros» (5.º activo cripto en adelante). */
export const COLOR_OTROS = '#8a857e'

/** Colores de ganancia/pérdida del gráfico de GyP por ejercicio (par cálido/frío seguro). */
export const COLOR_GANANCIA = '#e8820c'
export const COLOR_PERDIDA = '#2a78d6'

/** Una posición de la cartera (una fila de la tabla «Posiciones»). */
export interface PosicionCartera {
  activo: SimboloActivo
  esFiat: boolean
  /** Saldo total (suma de todas las ubicaciones), como cadena decimal del dominio. */
  saldo: string
  /** Coste FIFO restante en EUR (de la cola del motor); `null` para EUR/fiat. */
  costeFifoRestanteEUR: string | null
  /** Precio manual en EUR por unidad; `null` si no se ha introducido (EUR: null, vale 1). */
  precioEur: string | null
  /** Valor en EUR = saldo × precio; para EUR = saldo. `null` si falta el precio. */
  valorEUR: string | null
  /** Peso sobre el valor total, en % (0–100); `null` si no hay valor. */
  pesoPct: number | null
  /** Color fijo de la entidad para gráficos y swatches. */
  color: string
  /** true si en el donut se agrupa en «Otros» (5.º activo cripto en adelante). */
  agrupadaEnOtros: boolean
}

/** Resumen agregado de la cartera. */
export interface ResumenCartera {
  posiciones: PosicionCartera[]
  /** Valor total estimado en EUR (cripto valorada + EUR); `null` si no hay nada valorable. */
  valorTotalEUR: string | null
  /** Coste FIFO restante total de la CRIPTO en EUR (siempre disponible desde el motor). */
  costeRestanteCriptoEUR: string
  /**
   * Plusvalía latente en EUR = valor cripto − coste FIFO restante cripto (EUR EXCLUIDO). Solo
   * cuenta la cripto CON precio; `null` si ninguna cripto tiene precio (no se inventa un número).
   * No realizada: no tributa aún.
   */
  plusvaliaLatenteEUR: string | null
}

/** GyP realizada de un ejercicio (para el gráfico de barras). */
export interface GypEjercicio {
  ejercicio: number
  /** Neto del ahorro (ganancias + pérdidas de transmisión onerosa) del ejercicio, en EUR. */
  netoEUR: string
}

/** Orden de preferencia de los colores pinchados (para elegir el 4.º cripto de forma estable). */
const CRIPTO_PINCHADAS = new Set(['BTC', 'ETH', 'USDC'])

/**
 * Calcula la valoración completa de la cartera a partir del diario, los precios manuales y el
 * catálogo de activos (para saber cuáles son fiat). Todo sale del motor + el precio manual.
 *
 * @param apuntes  diario de dominio en orden cronológico
 * @param precios  precio manual EUR por activo (cadena decimal interna); EUR se ignora (vale 1)
 * @param esFiat   predicado: ¿este activo es fiat (EUR)? Los fiat no tienen coste FIFO ni precio
 */
export function calcularCartera(
  apuntes: Apunte[],
  precios: Readonly<Record<string, string>>,
  esFiat: (activo: string) => boolean,
): ResumenCartera {
  const saldos = saldosTotalesPorActivo(apuntes)
  const fifo = calcularFifo(apuntes)

  // 1) Reúne los activos con saldo o cola distintos de cero.
  const costeRestante = new Map<string, string>()
  for (const [activo, res] of fifo) costeRestante.set(activo, res.resumen.costeRestanteEUR)

  interface Bruta {
    activo: string
    esFiat: boolean
    saldo: string
    coste: string | null
    precio: string | null
    valor: string | null
  }
  const brutas: Bruta[] = []
  for (const [activo, saldo] of saldos) {
    const coste = costeRestante.get(activo) ?? null
    const saldoNoCero = !D(saldo).isZero()
    const costeNoCero = coste !== null && !D(coste).isZero()
    if (!saldoNoCero && !costeNoCero) continue // ADA/TOKENX a 0, etc.: se omiten

    const fiat = esFiat(activo)
    let precio: string | null = null
    let valor: string | null = null
    if (fiat) {
      // EUR (y otros fiat): sin precio; su valor en EUR es el propio saldo.
      valor = saldo
    } else {
      const p = precios[activo]
      if (p !== undefined && p !== '') {
        precio = p
        valor = aCadena(D(saldo).times(D(p)))
      }
    }
    brutas.push({ activo, esFiat: fiat, saldo, coste: fiat ? null : coste, precio, valor })
  }

  // 2) Valor total (suma de los valores disponibles) para los pesos.
  let valorTotal = CERO
  let hayValor = false
  for (const b of brutas)
    if (b.valor !== null) {
      valorTotal = valorTotal.plus(D(b.valor))
      hayValor = true
    }

  // 3) Coste restante cripto (siempre) y plusvalía latente (solo cripto con precio).
  let costeCripto = CERO
  let valorCriptoConPrecio = CERO
  let costeCriptoConPrecio = CERO
  let hayCriptoConPrecio = false
  for (const b of brutas) {
    if (b.esFiat) continue
    if (b.coste !== null) costeCripto = costeCripto.plus(D(b.coste))
    if (b.valor !== null) {
      hayCriptoConPrecio = true
      valorCriptoConPrecio = valorCriptoConPrecio.plus(D(b.valor))
      if (b.coste !== null) costeCriptoConPrecio = costeCriptoConPrecio.plus(D(b.coste))
    }
  }

  // 4) Asigna el color fijo por entidad. El 4.º cripto (el de mayor valor que no sea
  //    BTC/ETH/USDC) toma su color; el resto de cripto se agrupan en «Otros».
  const otrosCripto = brutas
    .filter((b) => !b.esFiat && !CRIPTO_PINCHADAS.has(b.activo))
    .sort((a, b) => Number(b.valor ?? '0') - Number(a.valor ?? '0') || a.activo.localeCompare(b.activo))
  const cuartoCripto = otrosCripto[0]?.activo

  const posiciones: PosicionCartera[] = brutas.map((b) => {
    let color: string
    let agrupada = false
    if (b.esFiat) {
      color = COLOR_OTROS
    } else if (COLOR_POR_ACTIVO[b.activo]) {
      color = COLOR_POR_ACTIVO[b.activo]!
    } else if (b.activo === cuartoCripto) {
      color = COLOR_CUARTO_CRIPTO
    } else {
      color = COLOR_OTROS
      agrupada = true // 5.º cripto en adelante → «Otros» en el donut
    }
    return {
      activo: b.activo,
      esFiat: b.esFiat,
      saldo: b.saldo,
      costeFifoRestanteEUR: b.coste,
      precioEur: b.precio,
      valorEUR: b.valor,
      pesoPct: b.valor !== null && hayValor && !valorTotal.isZero()
        ? D(b.valor).div(valorTotal).times(100).toNumber()
        : null,
      color,
      agrupadaEnOtros: agrupada,
    }
  })

  // Orden de presentación: por valor descendente; los «—» (sin valor) al final; EUR incluido.
  posiciones.sort((a, b) => {
    const va = a.valorEUR === null ? -1 : Number(a.valorEUR)
    const vb = b.valorEUR === null ? -1 : Number(b.valorEUR)
    return vb - va || a.activo.localeCompare(b.activo)
  })

  return {
    posiciones,
    valorTotalEUR: hayValor ? aCadena(valorTotal) : null,
    costeRestanteCriptoEUR: aCadena(costeCripto),
    plusvaliaLatenteEUR: hayCriptoConPrecio
      ? aCadena(valorCriptoConPrecio.minus(costeCriptoConPrecio))
      : null,
  }
}

/**
 * GyP realizada por ejercicio (para el gráfico de barras). Reutiliza el cálculo del módulo
 * fiscal (el mismo neto del ahorro que usa la pestaña Fiscal), por ejercicio con datos, de más
 * antiguo a más reciente (izquierda → derecha en el gráfico).
 */
export function gypRealizadaPorEjercicio(
  apuntes: Apunte[],
  ubicaciones: readonly Ubicacion[],
  justificantes: readonly Justificante[],
): GypEjercicio[] {
  const ejercicios = ejerciciosConDatos(apuntes).sort((a, b) => a - b)
  return ejercicios.map((ejercicio) => {
    const resumen = calcularResumenFiscal(apuntes, ubicaciones, justificantes, ejercicio)
    return { ejercicio, netoEUR: resumen.ahorro.netoEUR }
  })
}
