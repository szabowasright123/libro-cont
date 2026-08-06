/**
 * csv-generico.ts — importa el CSV genérico del taller (P4, punto 3).
 *
 * Parsea el texto CSV (formato del taller: docs/reference/mini_caso_generico.csv) y lo
 * pasa por `mapearFilasGenericas` (mapeo-generico.ts) para producir apuntes de dominio.
 *
 * Cuidado con los formatos (punto 5 del enunciado):
 *  - Separador: coma «,» (por defecto) o punto y coma «;» (autodetectado por la cabecera).
 *  - Comillas: campos entrecomillados con «"» y comillas escapadas «""» (RFC 4180).
 *  - Decimales: coma o punto (los resuelve `aDecimalDominio` aguas abajo).
 *  - BOM UTF-8 inicial: se descarta.
 */

import {
  type FilaGenerica,
  type ResultadoMapeoGenerico,
  CABECERAS_GENERICO,
  mapearFilasGenericas,
} from './mapeo-generico'

/** Descarta el BOM UTF-8 si está presente. */
function sinBOM(texto: string): string {
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
}

/** Detecta el separador de la cabecera (« ; » si aparece más que la coma). */
function detectarSeparador(primeraLinea: string): ',' | ';' {
  const comas = (primeraLinea.match(/,/g) ?? []).length
  const puntoYComa = (primeraLinea.match(/;/g) ?? []).length
  return puntoYComa > comas ? ';' : ','
}

/**
 * Parser CSV RFC 4180 (comillas, comillas escapadas, saltos de línea dentro de comillas).
 * Devuelve una matriz de filas × campos. Ignora una posible fila final vacía.
 */
export function parsearCSV(texto: string, separador: ',' | ';'): string[][] {
  const filas: string[][] = []
  let campo = ''
  let fila: string[] = []
  let enComillas = false
  const t = sinBOM(texto)

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ } // comilla escapada
        else enComillas = false
      } else {
        campo += c
      }
      continue
    }
    if (c === '"') { enComillas = true; continue }
    if (c === separador) { fila.push(campo); campo = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue }
    campo += c
  }
  // Último campo/fila si el texto no termina en salto de línea.
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila) }

  // Descarta filas totalmente vacías (p. ej. línea final en blanco).
  return filas.filter((f) => f.some((v) => v.trim() !== ''))
}

/**
 * Importa el CSV genérico del taller. Empareja las columnas por su nombre de cabecera
 * (tolerante a mayúsculas/espacios), construye las filas y delega en el mapeo genérico.
 * Lanza si faltan columnas imprescindibles (fecha, tipo).
 */
export function importarCsvGenerico(texto: string): ResultadoMapeoGenerico {
  const filasCrudas = parsearCSV(texto, detectarSeparador(texto.split(/\r?\n/, 1)[0] ?? ''))
  if (filasCrudas.length === 0) {
    return {
      apuntes: [],
      plataformas: [],
      activos: [],
      informe: { filasAceptadas: 0, filasRechazadas: [], avisos: ['CSV vacío.'], ejemplosDetectados: 0 },
    }
  }

  const cabecera = (filasCrudas[0] ?? []).map((h) => h.trim().toLowerCase())
  const indice = new Map<string, number>()
  cabecera.forEach((h, i) => { if (!indice.has(h)) indice.set(h, i) })

  // Imprescindibles.
  for (const req of ['fecha', 'tipo'] as const) {
    if (!indice.has(req)) throw new Error(`El CSV no tiene la columna «${req}».`)
  }

  const val = (campos: string[], col: keyof FilaGenerica): string => {
    const i = indice.get(col)
    return i === undefined ? '' : (campos[i] ?? '').trim()
  }

  const filas: FilaGenerica[] = filasCrudas.slice(1).map((campos) => {
    const f = {} as FilaGenerica
    for (const col of CABECERAS_GENERICO) f[col] = val(campos, col)
    return f
  })

  // filaBase = 2: la línea 1 del CSV es la cabecera.
  return mapearFilasGenericas(filas, 2)
}
