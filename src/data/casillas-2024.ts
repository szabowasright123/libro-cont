/**
 * casillas-2024.ts — mapa ORIENTATIVO de cada cajón fiscal a su casilla del modelo de Renta.
 *
 * ⚠ FICHERO DE DATOS QUE MANTIENE EL RESPONSABLE DEL TALLER. Las casillas del modelo cambian
 * cada ejercicio: hay un fichero por año (`casillas-AAAA.ts`). El módulo fiscal (motor + UI)
 * solo calcula los NÚMEROS; la correspondencia con las casillas es dato configurable aquí.
 *
 * Regla de oro 5: los números de casilla y sus notas son textos del manual/AEAT — se dejan
 * con el marcador `{{TEXTO-MANUAL}}` hasta que el responsable pegue el literal del ejercicio.
 * No se inventan casillas.
 */

import type { ConceptoFiscal } from '../engine/fiscal'
import { MARCADOR_TEXTO } from '../engine/fiscal'

/** Una fila del mapa a casillas: un cajón fiscal → su casilla orientativa de Renta. */
export interface MapaCasilla {
  /** Cajón fiscal del resumen (clave estable del motor). */
  readonly concepto: ConceptoFiscal
  /** Etiqueta de la casilla/apartado para la UI (estructural; sin nº de casilla inventado). */
  readonly apartado: string
  /** Número(s) de casilla del ejercicio. `{{TEXTO-MANUAL}}` hasta que lo fije el responsable. */
  readonly casilla: string
  /** Nota aclaratoria del apartado. `{{TEXTO-MANUAL}}` hasta relleno. */
  readonly nota: string
}

/**
 * Mapa de casillas del ejercicio 2024 (ORIENTATIVO). Rellenar `casilla` y `nota` con los
 * literales del manual/AEAT del ejercicio. Añadir un fichero análogo por cada año.
 */
export const CASILLAS_2024: readonly MapaCasilla[] = [
  {
    concepto: 'ahorro',
    apartado: 'Ganancias y pérdidas patrimoniales por transmisión (base del ahorro)',
    casilla: MARCADOR_TEXTO,
    nota: MARCADOR_TEXTO,
  },
  {
    concepto: 'rcm',
    apartado: 'Rendimientos del capital mobiliario (base del ahorro)',
    casilla: MARCADOR_TEXTO,
    nota: MARCADOR_TEXTO,
  },
  {
    concepto: 'actividad-economica',
    apartado: 'Rendimientos de actividades económicas (base general)',
    casilla: MARCADOR_TEXTO,
    nota: MARCADOR_TEXTO,
  },
  {
    concepto: 'base-general',
    apartado: 'Ganancias patrimoniales no derivadas de transmisión (base general)',
    casilla: MARCADOR_TEXTO,
    nota: MARCADOR_TEXTO,
  },
  {
    concepto: 'perdidas',
    apartado: 'Pérdidas patrimoniales (deducibilidad condicionada a requisitos y prueba)',
    casilla: MARCADOR_TEXTO,
    nota: MARCADOR_TEXTO,
  },
]

/**
 * Mapa de casillas por ejercicio. El responsable añade aquí cada nuevo año importando su
 * fichero. Si un ejercicio no tiene mapa, la UI lo indica (usa el más reciente como guía).
 */
export const CASILLAS_POR_EJERCICIO: Readonly<Record<number, readonly MapaCasilla[]>> = {
  2024: CASILLAS_2024,
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
