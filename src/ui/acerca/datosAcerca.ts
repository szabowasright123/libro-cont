/**
 * datosAcerca.ts — datos editables de la página «Acerca de» (P8).
 *
 * Autoría, licencia y repositorio quedan como marcadores hasta que el responsable
 * los fije (misma convención de marcadores que el resto de la app). Sustituye cada
 * `null`/marcador por el valor definitivo:
 *   - AUTORIA: nombre de la persona o entidad titular.
 *   - LICENCIA: identificador o nombre de la licencia (p. ej. «MIT», «Apache-2.0»…).
 *   - REPO_URL: URL pública del repositorio (o `null` para no mostrar enlace).
 */

/** Titular / autoría de la obra. `null` → se muestra el marcador {{AUTOR}}. */
export const AUTORIA: string | null = 'Javier Bravezo Durán'

/** Licencia declarada. `null` → se muestra el marcador {{LICENCIA}}. */
export const LICENCIA: string | null = 'PUSL-1.0'

/** Texto/nota de licencia opcional (una línea). */
export const LICENCIA_NOTA: string | null =
  'Personal Use Source License v1.0 — código fuente público: gratuito para uso personal; ' +
  'el uso profesional, empresarial o institucional requiere licencia (javier@legel.es). ' +
  'Ver el fichero LICENSE del repositorio.'

/** URL del repositorio. `null` → no se muestra enlace (marcador informativo). */
export const REPO_URL: string | null = null

/** Marco del taller (estructural, no es autoría). */
export const MARCO = 'Taller de Contabilidad, Trazabilidad y Fiscalidad en Bitcoin (Ed. 2026)'
