/**
 * datosAcerca.ts — datos editables de la página «Acerca de» (P8).
 *
 * Fichero de datos que mantiene el responsable del taller. Cada constante admite `null`
 * cuando el dato aún no está fijado; la página muestra entonces un marcador visible o
 * simplemente omite la fila:
 *   - AUTORIA: nombre de la persona o entidad titular (`null` → marcador {{AUTOR}}).
 *   - LICENCIA: identificador de la licencia (`null` → marcador {{LICENCIA}}).
 *   - REPO_URL: URL pública del repositorio (`null` → marcador {{REPO-URL}}).
 *   - WEB / RED_SOCIAL / CONTACTO: datos del autor (`null` → la fila no se muestra).
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
export const REPO_URL: string | null = 'https://github.com/szabowasright123/libro-cont'

/** Web del autor. `null` → la fila «Web» no se muestra. */
export const WEB: string | null = 'https://legelbitcoin.com/'

/** Perfil público del autor en X (u otra red). `null` → no se muestra. */
export const RED_SOCIAL: string | null = 'https://x.com/Javibrd'

/** Identificador visible de la red social (lo que se lee en pantalla). */
export const RED_SOCIAL_ETIQUETA = '@Javibrd'

/** Correo de contacto (licencias y consultas). `null` → la fila «Contacto» no se muestra. */
export const CONTACTO: string | null = 'javier@legel.es'

/** Marco del taller (estructural, no es autoría). */
export const MARCO = 'Taller de Contabilidad, Trazabilidad y Fiscalidad en Bitcoin (Ed. 2026)'
