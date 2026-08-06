/**
 * hash.ts — huella SHA-256 de un fichero, calculada en el navegador.
 *
 * Integridad probatoria del Archivo (DOMINIO §3.4): al adjuntar o referenciar un
 * documento, se calcula su hash SHA-256 para poder acreditar que el fichero no ha
 * cambiado. Todo en el navegador del alumno (Web Crypto API), sin red (Regla 3).
 *
 * No es del motor (usa `crypto.subtle`, una API de browser): vive en la capa de datos.
 * `crypto.subtle` requiere contexto seguro (https o localhost), que es el caso en
 * desarrollo (localhost) y en producción (GitHub Pages, https).
 */

/** Bytes de un ArrayBuffer → cadena hexadecimal en minúsculas. */
function aHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/** Calcula el SHA-256 de un Blob/File y lo devuelve en hexadecimal (64 caracteres). */
export async function sha256HexDeBlob(blob: Blob): Promise<string> {
  const datos = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', datos)
  return aHex(digest)
}
