/**
 * formato.ts — presentación es-ES (Regla de oro 6).
 *
 * Coma decimal en pantalla, punto interno (las cadenas del dominio usan punto).
 * Fechas dd/mm/aaaa, hora local española. Funciones puras (testeable en Node).
 *
 * NO se hace aritmética aquí: solo formateo de cadenas ya calculadas por el motor
 * (que trabaja con decimal.js). Formatear ≠ calcular.
 */

/** Símbolo especial de la ubicación de frontera (para mostrarla con etiqueta). */
export const ETIQUETA_EXTERIOR = 'EXTERIOR (frontera)'

/**
 * Cadena decimal interna («1234.5») → presentación es-ES («1.234,5»).
 * No redondea ni añade ceros: respeta los decimales que trae la cadena.
 * Cadena vacía/indefinida → «—».
 */
export function fmtDecimal(valor: string | undefined | null): string {
  if (valor === undefined || valor === null || valor === '') return '—'
  const negativo = valor.startsWith('-')
  const limpio = negativo ? valor.slice(1) : valor
  const [entera, decimales] = limpio.split('.')
  const enteraConMiles = (entera ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cuerpo = decimales ? `${enteraConMiles},${decimales}` : enteraConMiles
  return negativo ? `−${cuerpo}` : cuerpo
}

/** Importe en euros → presentación es-ES con el símbolo € (p. ej. «4.254,00 €»). */
export function fmtEuro(valor: string | undefined | null): string {
  if (valor === undefined || valor === null || valor === '') return '—'
  return `${fmtDecimal(valor)} €`
}

/**
 * ISO local («2024-01-16T10:00:00») → «16/01/2024 10:00».
 * Se interpreta como hora local española (convención del taller); no se convierte
 * zona horaria (el motor ya trabaja en local).
 */
export function fmtFechaHora(iso: string | undefined | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso)
  if (!m) return iso
  const [, a, mes, d, hh, mm] = m
  const fecha = `${d}/${mes}/${a}`
  return hh !== undefined && mm !== undefined ? `${fecha} ${hh}:${mm}` : fecha
}

/** Solo la fecha «dd/mm/aaaa» (sin hora). */
export function fmtFecha(iso: string | undefined | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const [, a, mes, d] = m
  return `${d}/${mes}/${a}`
}

/**
 * Entrada del alumno con coma o punto → cadena decimal interna con punto.
 * Elimina separadores de miles «.» solo si hay coma decimal; si no, deja el punto
 * como decimal (tolerante a ambos estilos de tecleo). Devuelve '' si vacío.
 */
export function parseDecimalEntrada(texto: string): string {
  const t = texto.trim()
  if (t === '') return ''
  if (t.includes(',')) {
    // Estilo es-ES: los puntos son miles, la coma es decimal.
    return t.replace(/\./g, '').replace(',', '.')
  }
  return t
}

/**
 * Entrada del alumno → cadena decimal de dominio VÁLIDA, o `undefined` si está
 * vacía o no es un decimal bien formado. Blinda al motor (decimal.js) de recibir
 * texto a medio teclear («0,» ) o inválido, que lo haría lanzar. Nunca lanza.
 */
export function aDecimalDominio(texto: string | undefined | null): string | undefined {
  if (texto === undefined || texto === null) return undefined
  const p = parseDecimalEntrada(texto)
  if (p === '') return undefined
  return /^-?\d+(\.\d+)?$/.test(p) ? p : undefined
}

/** Muestra una ubicación (EXTERIOR con etiqueta legible; el resto, su nombre dado). */
export function fmtUbicacion(ref: string, nombrePorId?: Map<string, string>): string {
  if (ref === 'EXTERIOR') return ETIQUETA_EXTERIOR
  return nombrePorId?.get(ref) ?? ref
}

/**
 * Tamaño en bytes → presentación legible es-ES (B, KB, MB, GB; base 1024).
 * Para avisar del espacio local que ocupan los ficheros del Archivo (P5).
 */
export function fmtBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes < 0) return '0 B'
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < unidades.length - 1) {
    v /= 1024
    i++
  }
  // Sin decimales para bytes; un decimal para KB en adelante.
  const texto = i === 0 ? String(Math.round(v)) : fmtDecimal((Math.round(v * 10) / 10).toString())
  return `${texto} ${unidades[i]}`
}
