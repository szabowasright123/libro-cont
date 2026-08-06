/**
 * casillas-2025.ts — mapa ORIENTATIVO de cada cajón fiscal a su casilla del modelo de Renta,
 * campaña Renta 2025 (presentada abr–jun 2026).
 *
 * ⚠ FICHERO DE DATOS QUE MANTIENE EL RESPONSABLE DEL TALLER. Es el ejercicio de referencia del
 * manual (recuadro CAPA B verificado 5-8-2026) y el que manejarán los alumnos. El módulo fiscal
 * (motor + UI) solo calcula los NÚMEROS; la correspondencia con las casillas es dato aquí.
 *
 * Regla del manual: «Los números de casilla cambian cada campaña: verificar en el Manual
 * práctico de Renta del ejercicio antes de teclear». Textos literales de [MT] U9 / CAPA B U9 y
 * [MF] U4 (validados a 2026-08-06, ver docs/TEXTOS_MANUAL_RANURAS.md §3).
 */

import type { MapaCasilla } from './casillas-2024'

/**
 * Mapa de casillas del ejercicio 2025 (ORIENTATIVO). Valores literales del manual del taller
 * (campaña Renta 2025). Donde el manual no cita el número exacto, la nota remite al Manual
 * práctico de Renta del ejercicio.
 */
export const CASILLAS_2025: readonly MapaCasilla[] = [
  {
    concepto: 'ahorro',
    apartado: 'Ganancias y pérdidas patrimoniales por transmisión (base del ahorro)',
    casilla: 'Apartado F2, casillas 1800 a 1814',
    nota: '«Ganancias y pérdidas patrimoniales derivadas de la transmisión o permuta de monedas virtuales por particulares (base del ahorro). Renta WEB pide, por cada transmisión, fechas de adquisición y transmisión y ambos valores: exactamente la estructura de la hoja FIFO.» [MT U9 y CAPA B U9]',
  },
  {
    concepto: 'rcm',
    apartado: 'Rendimientos del capital mobiliario (base del ahorro)',
    casilla: 'Bloque de la casilla 0033',
    nota: '«Staking, intereses, lending: rendimientos del capital mobiliario de la base del ahorro (cesión a terceros de capitales propios).» [MT CAPA B U9]',
  },
  {
    concepto: 'actividad-economica',
    apartado: 'Rendimientos de actividades económicas (base general)',
    casilla:
      'Apartado de rendimientos de actividades económicas (estimación directa) — el manual no cita nº de casilla: verificar en el Manual práctico de Renta del ejercicio',
    nota: '«Minería: la suma de apuntes MINERÍA es el ingreso; las facturas archivadas (equipos, electricidad…) son el gasto. Sus obligaciones formales se remiten al Manual de Fiscalidad.» [MT U9 ap. 3]',
  },
  {
    concepto: 'base-general',
    apartado: 'Ganancias patrimoniales no derivadas de transmisión (base general)',
    casilla: 'Casilla 0304',
    nota: '«Airdrops y análogos: ganancias no derivadas de transmisión, base general, valoradas al día de recepción.» [MT CAPA B U9]',
  },
  {
    concepto: 'perdidas',
    apartado: 'Pérdidas patrimoniales (deducibilidad condicionada a requisitos y prueba)',
    casilla:
      'Según su naturaleza: derivadas de transmisión → F2 (1800-1814); robos y estafas computables → bloque de base general (junto a la 0304) — nº exacto a verificar en el Manual práctico',
    nota: '«Las derivadas de transmisiones van a la base del ahorro, y las que no derivan de transmisión (robos y estafas computables) al bloque de la base general. Deducibilidad condicionada a expediente probatorio (ver Archivo).» [MF U4 «traducción práctica»]',
  },
]
