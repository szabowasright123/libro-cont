/**
 * presentacion.ts — traducción a pantalla de lo que devuelve el motor de autocorrección.
 *
 * Aquí NO se calcula nada (Regla de oro 4: toda la lógica vive en `src/engine/`). Lo único
 * que hay es presentación es-ES: coma decimal, símbolo del euro, fechas dd/mm/aaaa y las
 * etiquetas legibles de los valores que el dominio guarda en ASCII mayúsculas.
 *
 * El motor devuelve cada valor esperado/encontrado con un `formato` que dice cómo hay que
 * pintarlo. Esa indirección existe justamente para que el motor no formatee: una cantidad
 * de BTC, un importe en euros y una marca temporal se escriben distinto, y quien sabe cuál
 * es cuál es el motor, no la hoja de estilos.
 */

import type { CampoApunte, FormatoValor, Gravedad } from '../../engine/autocorreccion'
import { ETIQUETA_TIPO, type TipoOperacion, CATALOGO_TIPOS } from '../../engine/types'
import { fmtDecimal, fmtEuro, fmtFechaHora, redondearCadena } from '../formato'

/** Decimales con los que se pinta una cantidad: la precisión del satoshi. */
const DECIMALES_CANTIDAD = 8

/** Etiquetas del `sentido` del apunte (el dominio lo guarda en minúsculas ASCII). */
const ETIQUETA_SENTIDO: Readonly<Record<string, string>> = Object.freeze({
  entregada: 'entregada',
  recibida: 'recibida',
  'solo-saldos': 'solo saldos (no mueve la cola FIFO)',
})

/** ¿Es este texto uno de los 12 tipos del catálogo cerrado? */
function esTipo(valor: string): valor is TipoOperacion {
  return Object.prototype.hasOwnProperty.call(CATALOGO_TIPOS, valor)
}

/**
 * Pinta un valor del dominio según el formato que indica el motor. El campo se pasa como
 * pista adicional para los dos casos en que el valor es una clave y no un número: el tipo
 * de operación (que se muestra con sus acentos) y el sentido.
 */
export function fmtValor(
  valor: string | undefined,
  formato: FormatoValor,
  campo?: CampoApunte,
): string {
  if (valor === undefined || valor === '') return '—'
  switch (formato) {
    case 'cantidad':
      return fmtDecimal(redondearCadena(valor, DECIMALES_CANTIDAD))
    case 'euro':
      return fmtEuro(valor)
    case 'fecha':
      return fmtFechaHora(valor)
    case 'texto':
      if (campo === 'tipo' && esTipo(valor)) return ETIQUETA_TIPO[valor]
      if (campo === 'sentido') return ETIQUETA_SENTIDO[valor] ?? valor
      return valor
  }
}

/** Presentación del punto de gravedad (mismo lenguaje visual que el semáforo del cuadre). */
export const TONO_GRAVEDAD: Readonly<
  Record<Gravedad, { punto: string; clase: string; etiqueta: string }>
> = Object.freeze({
  error: { punto: '●', clase: 'text-semaforo-error', etiqueta: 'Desviación' },
  aviso: { punto: '●', clase: 'text-semaforo-revisar', etiqueta: 'A revisar' },
  info: { punto: '●', clase: 'text-slate-400', etiqueta: 'Información' },
})

/** El movimiento del apunte en una línea («− 0,1 BTC / + 6.500 EUR»). */
export function fmtMovimiento(resumen: {
  activoSalida?: string
  cantidadSalida?: string
  activoEntrada?: string
  cantidadEntrada?: string
}): string {
  const partes: string[] = []
  if (resumen.activoSalida && resumen.cantidadSalida) {
    partes.push(`− ${fmtValor(resumen.cantidadSalida, 'cantidad')} ${resumen.activoSalida}`)
  }
  if (resumen.activoEntrada && resumen.cantidadEntrada) {
    partes.push(`+ ${fmtValor(resumen.cantidadEntrada, 'cantidad')} ${resumen.activoEntrada}`)
  }
  return partes.length > 0 ? partes.join(' · ') : '—'
}

/** «1 hallazgo» / «3 hallazgos», que en una pantalla se lee mejor que «hallazgo(s)». */
export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`
}
