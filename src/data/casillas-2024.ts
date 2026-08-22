/**
 * casillas-2024.ts — mapa ORIENTATIVO de cada cajón fiscal a su casilla del modelo de Renta.
 *
 * ⚠ FICHERO DE DATOS QUE MANTIENE EL RESPONSABLE DEL TALLER. Las casillas del modelo cambian
 * cada ejercicio: hay un fichero por año (`casillas-AAAA.ts`). El módulo fiscal (motor + UI)
 * solo calcula los NÚMEROS; la correspondencia con las casillas es dato configurable aquí.
 *
 * Regla de oro 5: los números de casilla y sus notas son textos del manual/AEAT. El manual usa
 * como referencia la campaña Renta 2025; aquí se reutilizan esos mismos bloques para 2024 con la
 * nota de que los números 2024 NO están verificados en fuente primaria. No se inventan casillas.
 */

import type { ConceptoFiscal } from '../engine/fiscal'
import { CASILLAS_2025 } from './casillas-2025'
import { CASILLAS_2026 } from './casillas-2026'

/** Caveat que acompaña a cada nota de 2024 (bloques del manual, números sin verificar). */
const NO_VERIFICADO_2024 =
  ' (bloques según campaña Renta 2025 del manual; números 2024 no verificados en fuente primaria)'

/** Una fila del mapa a casillas: un cajón fiscal → su casilla orientativa de Renta. */
export interface MapaCasilla {
  /** Cajón fiscal del resumen (clave estable del motor). */
  readonly concepto: ConceptoFiscal
  /** Etiqueta de la casilla/apartado para la UI (estructural; sin nº de casilla inventado). */
  readonly apartado: string
  /** Número(s) de casilla del ejercicio (literal del manual/AEAT del año). */
  readonly casilla: string
  /** Nota aclaratoria del apartado (literal del manual). */
  readonly nota: string
}

/**
 * Mapa de casillas del ejercicio 2024 (ORIENTATIVO). Reutiliza los bloques de la campaña Renta
 * 2025 del manual (mismas casillas 1800 y ss., 0033 y 0304 existen desde Renta 2021), con la
 * nota de que los números concretos de 2024 no están verificados en fuente primaria.
 */
export const CASILLAS_2024: readonly MapaCasilla[] = [
  {
    concepto: 'ahorro',
    apartado: 'Ganancias y pérdidas patrimoniales por transmisión (base del ahorro)',
    casilla: 'Apartado F2, casillas 1800 a 1814',
    nota:
      '«Ganancias y pérdidas patrimoniales derivadas de la transmisión o permuta de monedas virtuales por particulares (base del ahorro). Renta WEB pide, por cada transmisión, fechas de adquisición y transmisión y ambos valores: exactamente la estructura de la hoja FIFO.» [MT U9 y CAPA B U9]' +
      NO_VERIFICADO_2024,
  },
  {
    concepto: 'rcm',
    apartado: 'Rendimientos del capital mobiliario (base del ahorro)',
    casilla: 'Bloque de la casilla 0033',
    nota:
      '«Staking, intereses, lending: rendimientos del capital mobiliario de la base del ahorro (cesión a terceros de capitales propios).» [MT CAPA B U9]' +
      NO_VERIFICADO_2024,
  },
  {
    concepto: 'actividad-economica',
    apartado: 'Rendimientos de actividades económicas (base general)',
    casilla:
      'Apartado de rendimientos de actividades económicas (estimación directa) — el manual no cita nº de casilla: verificar en el Manual práctico de Renta del ejercicio',
    nota:
      '«Minería: la suma de apuntes MINERÍA es el ingreso; las facturas archivadas (equipos, electricidad…) son el gasto. Sus obligaciones formales se remiten al Manual de Fiscalidad.» [MT U9 ap. 3]' +
      NO_VERIFICADO_2024,
  },
  {
    concepto: 'base-general',
    apartado: 'Ganancias patrimoniales no derivadas de transmisión (base general)',
    casilla: 'Casilla 0304',
    nota:
      '«Airdrops y análogos: ganancias no derivadas de transmisión, base general, valoradas al día de recepción.» [MT CAPA B U9]' +
      NO_VERIFICADO_2024,
  },
  {
    concepto: 'perdidas',
    apartado: 'Pérdidas patrimoniales (deducibilidad condicionada a requisitos y prueba)',
    casilla:
      'Según su naturaleza: derivadas de transmisión → F2 (1800-1814); robos y estafas computables → bloque de base general (junto a la 0304) — nº exacto a verificar en el Manual práctico',
    nota:
      '«Las derivadas de transmisiones van a la base del ahorro, y las que no derivan de transmisión (robos y estafas computables) al bloque de la base general. Deducibilidad condicionada a expediente probatorio (ver Archivo).» [MF U4 «traducción práctica»]' +
      NO_VERIFICADO_2024,
  },
]

/**
 * Mapa de casillas por ejercicio. El responsable añade aquí cada nuevo año importando su
 * fichero. Si un ejercicio no tiene mapa, la UI lo indica (usa el más reciente como guía).
 */
export const CASILLAS_POR_EJERCICIO: Readonly<Record<number, readonly MapaCasilla[]>> = {
  2024: CASILLAS_2024,
  2025: CASILLAS_2025,
  2026: CASILLAS_2026,
}

/** Devuelve el mapa de casillas del ejercicio, o el más reciente disponible como guía. */
export function casillasDeEjercicio(ejercicio: number): {
  casillas: readonly MapaCasilla[]
  ejercicioMapa: number | null
  esDelEjercicio: boolean
} {
  const directo = CASILLAS_POR_EJERCICIO[ejercicio]
  if (directo) return { casillas: directo, ejercicioMapa: ejercicio, esDelEjercicio: true }
  const anios = Object.keys(CASILLAS_POR_EJERCICIO).map(Number).sort((a, b) => b - a)
  const reciente = anios[0]
  if (reciente === undefined) return { casillas: [], ejercicioMapa: null, esDelEjercicio: false }
  return {
    casillas: CASILLAS_POR_EJERCICIO[reciente]!,
    ejercicioMapa: reciente,
    esDelEjercicio: false,
  }
}
