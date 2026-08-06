/**
 * contenido.ts — el «contenido del Libro» que viaja por los puentes de import/export (P4).
 *
 * Estructura común a XLSX, CSV y JSON: apuntes de dominio + catálogos (ubicaciones,
 * activos) + tolerancias. Es lo que el importador produce y el exportador consume; el
 * repositorio la vuelca a IndexedDB (o la extrae de ella) en la capa de UI/datos.
 */

import type { Activo, Apunte, Tolerancias, Ubicacion } from '../../engine/types'
import type { InformeImport } from './mapeo-generico'

/** Fotografía completa (o parcial) del contenido del Libro. */
export interface ContenidoLibro {
  apuntes: Apunte[]
  ubicaciones: Ubicacion[]
  activos: Activo[]
  tolerancias?: Tolerancias
}

/** Resultado de una importación: el contenido + su informe (aceptadas/rechazadas/avisos). */
export interface ResultadoImportacion extends ContenidoLibro {
  informe: InformeImport
}

/**
 * Da de alta como Activo cada símbolo visto en los apuntes que no sea ya de serie
 * (BTC/EUR) ni figure en `existentes`. Decimales por defecto 8 (cripto); el alumno
 * los ajusta en Parámetros. EUR se marca fiat. Determinista.
 */
export function activosDescubiertos(
  simbolos: readonly string[],
  existentes: readonly Activo[] = [],
): Activo[] {
  const yaHay = new Set(existentes.map((a) => a.simbolo))
  const salida: Activo[] = []
  for (const s of new Set(simbolos)) {
    const simbolo = s.trim()
    if (simbolo === '' || yaHay.has(simbolo)) continue
    yaHay.add(simbolo)
    salida.push({
      simbolo,
      nombre: simbolo,
      decimales: simbolo === 'EUR' ? 2 : 8,
      esFiat: simbolo === 'EUR',
    })
  }
  return salida
}

/** Todos los símbolos de activo que aparecen en un apunte (entrada, salida, comisión). */
export function simbolosDeApunte(ap: Apunte): string[] {
  return [ap.activoEntrada, ap.activoSalida, ap.comisionActivo].filter(
    (x): x is string => !!x && x.trim() !== '',
  )
}

export type { InformeImport }
