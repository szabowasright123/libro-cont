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

/** Decimales con los que se PINTA una cantidad de activo (la precisión del satoshi). */
export const DECIMALES_CANTIDAD = 8

/**
 * Cantidad de un activo, recortada a la precisión del satoshi para pintarla.
 *
 * Hace falta desde D0: cuando una comisión se paga en cripto, su coste se retira PRORRATEADO
 * entre los lotes vivos, y ese prorrateo produce cantidades periódicas. Sin recortar, la
 * columna «cantidad restante» de un lote enseña cuarenta cifras decimales
 * —«0,3207226017822168148965534586449619129358»— que no son un número, son un accidente
 * aritmético: ilegible en pantalla e imposible de cotejar contra una wallet.
 *
 * Se recorta la PRESENTACIÓN, nunca el dominio: el valor exacto sigue en el apunte, y quien
 * lo pinte debe dejarlo a mano (el `title` de la celda) para que se pueda cotejar.
 */
export function fmtCantidad(valor: string | undefined | null): string {
  if (valor === undefined || valor === null || valor === '') return '—'
  return fmtDecimal(redondearCadena(valor, DECIMALES_CANTIDAD))
}

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

/**
 * Recorta una cadena decimal a `maxDecimales` cifras, redondeando al más cercano.
 *
 * Existe porque desde D0 el motor produce importes PERIÓDICOS: el prorrateo del gas divide
 * entre cantidades que no dan decimal finito, y un KPI con «29.411,6409523809523809…» no es
 * un número, es un accidente. El dominio conserva la precisión completa; lo que se recorta
 * es la presentación, que es donde debe recortarse.
 *
 * Redondeo half-up sobre la cadena, sin pasar por `number`: convertir a float aquí sería
 * exactamente lo que la regla de oro 2 prohíbe.
 */
export function redondearCadena(valor: string, maxDecimales: number): string {
  const negativo = valor.startsWith('-') || valor.startsWith('−')
  const limpio = negativo ? valor.slice(1) : valor
  const [enteraRaw, decimales = ''] = limpio.split('.')
  const entera = enteraRaw ?? '0'
  if (decimales.length <= maxDecimales) return valor

  const conservados = decimales.slice(0, maxDecimales)
  const siguiente = decimales.charCodeAt(maxDecimales) - 48
  let cuerpo = entera + conservados

  if (siguiente >= 5) {
    // Suma 1 a la última cifra propagando el acarreo, en base 10 sobre la cadena.
    const cifras = cuerpo.split('')
    let i = cifras.length - 1
    for (; i >= 0; i--) {
      if (cifras[i] === '9') {
        cifras[i] = '0'
      } else {
        cifras[i] = String(Number(cifras[i]) + 1)
        break
      }
    }
    cuerpo = (i < 0 ? '1' : '') + cifras.join('')
  }

  const corte = cuerpo.length - maxDecimales
  const nuevaEntera = cuerpo.slice(0, corte) || '0'
  const nuevaDecimal = cuerpo.slice(corte)
  const salida = maxDecimales > 0 ? `${nuevaEntera}.${nuevaDecimal}` : nuevaEntera
  return negativo ? `-${salida}` : salida
}

/**
 * Importe en euros → presentación es-ES con el símbolo € (p. ej. «4.254,00 €»).
 * Se muestran como mucho DOS decimales: son euros.
 */
export function fmtEuro(valor: string | undefined | null): string {
  if (valor === undefined || valor === null || valor === '') return '—'
  return `${fmtDecimal(redondearCadena(valor, 2))} €`
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
