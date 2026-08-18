/**
 * direcciones.ts — direcciones on-chain de las ubicaciones del alumno (ENCARGO, Parte 2).
 *
 * Funciones PURAS (sin Dexie, sin React): normalizan lo que teclea el alumno y resuelven
 * «¿de quién es esta dirección?» durante la importación desde exploradores de bloques.
 *
 * Es la única automatización fiable de toda la importación: si el origen Y el destino de un
 * movimiento son direcciones registradas del alumno, el movimiento es un traslado
 * (TRANSFERENCIA) y no hay alteración patrimonial. En cuanto una de las dos no consta, hay
 * frontera con el exterior y la calificación la pone el alumno (nunca una heurística).
 *
 * Dato sensible: estas direcciones no salen del navegador (Regla de oro 3). La app NO
 * consulta ninguna cadena ni ningún explorador; el alumno sube los CSV que descarga él.
 */
import type { Ubicacion } from '../../engine/types'

/**
 * Normaliza una dirección para compararla:
 *  - recorta espacios y descarta el sufijo de etiqueta que añaden algunos exploradores
 *    («0xabc… (Uniswap V3: Router)» → «0xabc…»);
 *  - pasa a minúsculas las que son insensibles a mayúsculas: EVM (`0x…`, el checksum
 *    EIP-55 es solo una comprobación) y bech32 de Bitcoin (`bc1…`, `tb1…`, BIP-173);
 *  - deja intactas las demás (base58 de Bitcoin SÍ distingue mayúsculas: 1…, 3…, m/n/2…).
 *
 * Devuelve cadena vacía si no queda nada aprovechable.
 */
export function normalizarDireccion(entrada: string): string {
  const limpia = (entrada ?? '')
    .trim()
    .replace(/\s*\(.*\)\s*$/, '') // etiqueta del explorador entre paréntesis
    .trim()
  if (limpia === '') return ''
  if (/^0x[0-9a-fA-F]{40}$/.test(limpia)) return limpia.toLowerCase()
  if (/^(bc1|tb1|bcrt1)[0-9a-zA-Z]+$/i.test(limpia)) return limpia.toLowerCase()
  return limpia
}

/** Normaliza una lista de direcciones: descarta vacías y duplicadas, conserva el orden. */
export function normalizarDirecciones(entradas: readonly string[]): string[] {
  const vistas = new Set<string>()
  const fuera: string[] = []
  for (const e of entradas) {
    const n = normalizarDireccion(e)
    if (n === '' || vistas.has(n)) continue
    vistas.add(n)
    fuera.push(n)
  }
  return fuera
}

/**
 * Trocea el texto de un campo de direcciones (una por línea, o separadas por comas,
 * puntos y coma o espacios) en una lista normalizada.
 */
export function parsearDirecciones(texto: string): string[] {
  return normalizarDirecciones((texto ?? '').split(/[\s,;]+/))
}

/** Índice dirección normalizada → id de la ubicación que la declara. */
export type IndiceDirecciones = Map<string, string>

/**
 * Construye el índice de direcciones propias. Si dos ubicaciones declararan la misma
 * dirección, gana la primera por orden de nombre y la repetición se ignora (el aviso lo
 * da la ficha de ubicación, no la importación).
 */
export function indexarDirecciones(ubicaciones: readonly Ubicacion[]): IndiceDirecciones {
  const indice: IndiceDirecciones = new Map()
  for (const u of [...ubicaciones].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    for (const d of normalizarDirecciones(u.direcciones ?? [])) {
      if (!indice.has(d)) indice.set(d, u.id)
    }
  }
  return indice
}

/** Ubicación propietaria de una dirección, o `undefined` si no consta (→ EXTERIOR). */
export function ubicacionDeDireccion(
  indice: IndiceDirecciones,
  direccion: string,
): string | undefined {
  const n = normalizarDireccion(direccion)
  return n === '' ? undefined : indice.get(n)
}

/**
 * ¿Tiene esta dirección forma de dirección de una cadena EVM? Solo para avisar al alumno
 * de una errata evidente al teclearla; no valida checksum ni rechaza nada.
 */
export function pareceDireccionEvm(direccion: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(normalizarDireccion(direccion))
}
