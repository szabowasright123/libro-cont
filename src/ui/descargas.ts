/**
 * descargas.ts — utilidades de navegador para leer y descargar ficheros (P4).
 *
 * Local-first: todo ocurre en el navegador del alumno (sin red). Descargar crea un
 * enlace temporal `blob:`; leer usa la File API. No hay lógica de dominio aquí.
 */

/** Descarga un Blob con el nombre indicado (crea y revoca un enlace temporal). */
export function descargarBlob(nombre: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoca en el siguiente tick para no cancelar la descarga en curso.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Descarga bytes como fichero binario (p. ej. un XLSX exportado). */
export function descargarBytes(nombre: string, bytes: Uint8Array, mime: string): void {
  descargarBlob(nombre, new Blob([bytes as BlobPart], { type: mime }))
}

/** Descarga texto como fichero (p. ej. la copia JSON). */
export function descargarTexto(nombre: string, texto: string, mime = 'application/json'): void {
  descargarBlob(nombre, new Blob([texto], { type: `${mime};charset=utf-8` }))
}

/** MIME de un libro XLSX. */
export const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Lee un fichero elegido por el alumno como texto UTF-8. */
export function leerArchivoTexto(file: File): Promise<string> {
  return file.text()
}

/** Lee un fichero elegido por el alumno como ArrayBuffer (para xlsx). */
export function leerArchivoBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}
