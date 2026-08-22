/**
 * casillas-2026.ts — mapa ORIENTATIVO de cada cajón fiscal a su casilla del modelo de Renta,
 * campaña Renta 2026 (que se presentará en abr–jun 2027).
 *
 * ⚠ FICHERO DE DATOS QUE MANTIENE EL RESPONSABLE DEL TALLER, y que hay que COTEJAR ANTES DE LA
 * CAMPAÑA. El módulo fiscal (motor + UI) solo calcula los NÚMEROS; la correspondencia con las
 * casillas es dato, y vive aquí precisamente para poder actualizarla sin tocar el motor.
 *
 * Estado de este mapa: **los números de casilla están PENDIENTES DE VERIFICACIÓN**. Cuando se
 * escribió este fichero, el Manual práctico de Renta 2026 no estaba publicado, y la Regla de oro
 * 5 no admite atajos: no se inventa ni se extrapola un número de casilla. Los apartados sí se
 * mantienen —la clasificación de cada cajón (ahorro, RCM, actividad económica, base general,
 * pérdidas) es criterio de la ley, no de la campaña—, y por eso el mapa conserva las cinco filas
 * y sus notas literales del manual; lo que queda en blanco es únicamente el número.
 *
 * Cómo se completa: publicado el Manual práctico de Renta 2026, se sustituye el texto de
 * `casilla` de cada fila por el número o rango literal del manual y se retira el caveat de la
 * nota. Mientras eso no ocurra, la pantalla FISCAL enseña el apartado y el aviso de pendiente,
 * que es lo honesto: el alumno debe teclear en Renta WEB mirando el manual del año, no la app.
 *
 * Regla del manual: «Los números de casilla cambian cada campaña: verificar en el Manual
 * práctico de Renta del ejercicio antes de teclear». Notas literales de [MT] U9 / CAPA B U9 y
 * [MF] U4 (validadas a 2026-08-06, ver docs/TEXTOS_MANUAL_RANURAS.md §3).
 */

import type { MapaCasilla } from './casillas-2024'

/** Caveat que acompaña a cada nota de 2026 (la clasificación es del manual; el número, no). */
const PENDIENTE_2026 =
  ' (apartado según el manual del taller; nº de casilla PENDIENTE de verificación en el Manual práctico de Renta 2026)'

/** Fórmula común del campo `casilla` mientras no haya número verificado. */
const SIN_NUMERO = ' — nº de casilla pendiente: verificar en el Manual práctico de Renta 2026'

/**
 * Mapa de casillas del ejercicio 2026 (ORIENTATIVO y con los números pendientes). Mismos
 * apartados que 2025, sin número de casilla: ver la cabecera del fichero.
 */
export const CASILLAS_2026: readonly MapaCasilla[] = [
  {
    concepto: 'ahorro',
    apartado: 'Ganancias y pérdidas patrimoniales por transmisión (base del ahorro)',
    casilla:
      'Apartado de ganancias y pérdidas patrimoniales derivadas de transmisión (base del ahorro)' +
      SIN_NUMERO,
    nota:
      '«Ganancias y pérdidas patrimoniales derivadas de la transmisión o permuta de monedas virtuales por particulares (base del ahorro). Renta WEB pide, por cada transmisión, fechas de adquisición y transmisión y ambos valores: exactamente la estructura de la hoja FIFO.» [MT U9 y CAPA B U9]' +
      PENDIENTE_2026,
  },
  {
    concepto: 'rcm',
    apartado: 'Rendimientos del capital mobiliario (base del ahorro)',
    casilla:
      'Apartado de rendimientos del capital mobiliario por cesión a terceros de capitales propios (base del ahorro)' +
      SIN_NUMERO,
    nota:
      '«Staking, intereses, lending: rendimientos del capital mobiliario de la base del ahorro (cesión a terceros de capitales propios).» [MT CAPA B U9]' +
      PENDIENTE_2026,
  },
  {
    concepto: 'actividad-economica',
    apartado: 'Rendimientos de actividades económicas (base general)',
    casilla:
      'Apartado de rendimientos de actividades económicas (estimación directa)' + SIN_NUMERO,
    nota:
      '«Minería: la suma de apuntes MINERÍA es el ingreso; las facturas archivadas (equipos, electricidad…) son el gasto. Sus obligaciones formales se remiten al Manual de Fiscalidad.» [MT U9 ap. 3]' +
      PENDIENTE_2026,
  },
  {
    concepto: 'base-general',
    apartado: 'Ganancias patrimoniales no derivadas de transmisión (base general)',
    casilla:
      'Apartado de ganancias patrimoniales que no derivan de transmisión (base general)' +
      SIN_NUMERO,
    nota:
      '«Airdrops y análogos: ganancias no derivadas de transmisión, base general, valoradas al día de recepción.» [MT CAPA B U9]' +
      PENDIENTE_2026,
  },
  {
    concepto: 'perdidas',
    apartado: 'Pérdidas patrimoniales (deducibilidad condicionada a requisitos y prueba)',
    casilla:
      'Según su naturaleza: derivadas de transmisión → apartado de la base del ahorro; robos y estafas computables → apartado de la base general' +
      SIN_NUMERO,
    nota:
      '«Las derivadas de transmisiones van a la base del ahorro, y las que no derivan de transmisión (robos y estafas computables) al bloque de la base general. Deducibilidad condicionada a expediente probatorio (ver Archivo).» [MF U4 «traducción práctica»]' +
      PENDIENTE_2026,
  },
]
