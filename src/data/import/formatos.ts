/**
 * formatos.ts — conversiones de formato para los puentes con Excel y CSV (P4).
 *
 * Cuidado universal con los formatos (enunciado P4, punto 5):
 *  - Fechas: dd/mm/aaaa (es-ES) e ISO se aceptan al importar; internamente el dominio
 *    usa ISO local sin zona («2024-01-16T10:00:00»).
 *  - Decimales: coma o punto al importar (los CSV anglosajones usan punto); internamente
 *    el dominio usa SIEMPRE punto. BTC con 8 decimales.
 *  - Excel guarda fecha/hora como número de serie (días desde 1899-12-30). La conversión
 *    serial↔ISO es de RELOJ DE PARED: no aplica zona horaria (evita el clásico desfase de
 *    ±1 día/hora al leer/escribir con Date). Por eso opera sobre componentes UTC.
 *
 * Funciones PURAS y deterministas (testeable en Node, sin browser APIs).
 *
 * Este módulo vive en la capa de datos (no en el motor, que es aritmética pura): traduce
 * entre representaciones externas (xlsx/csv) y el dominio, pero no calcula saldos ni FIFO.
 */

import {
  type TipoOperacion,
  ETIQUETA_TIPO,
  TIPOS_OPERACION,
} from '../../engine/types'
import { D, aCadena } from '../../engine/decimal'

// ────────────────────────────────────────────────────────────────────────────
// 1. Fecha/hora ↔ número de serie de Excel (reloj de pared, sin zona horaria)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Epoch del sistema de fechas 1900 de Excel: el día 1 es 1900-01-01, pero Excel
 * arrastra el bug del 29-feb-1900 inexistente, de modo que para fechas ≥ 1900-03-01
 * el origen efectivo es 1899-12-30. Todas las fechas del taller (2024+) caen ahí.
 */
const MS_POR_DIA = 86_400_000
const EPOCH_EXCEL_UTC = Date.UTC(1899, 11, 30) // 1899-12-30T00:00:00Z

/** Rellena a 2 dígitos (mes, día, hora…). */
function p2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Número de serie de Excel (p. ej. 45658,5 = 2025-01-01 12:00) → ISO local
 * «AAAA-MM-DDTHH:mm:ss». Interpreta el serial como reloj de pared: usa componentes
 * UTC internamente para no introducir desfase de zona horaria.
 */
export function serialExcelAISO(serial: number): string {
  // Redondeo al segundo: Excel almacena la hora como fracción y arrastra epsilones
  // (p. ej. 0.4451388889); sin redondear saldrían «09:59:59».
  const ms = Math.round(EPOCH_EXCEL_UTC + serial * MS_POR_DIA)
  const segRedondeado = Math.round(ms / 1000) * 1000
  const d = new Date(segRedondeado)
  return (
    `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}` +
    `T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`
  )
}

/**
 * ISO local «AAAA-MM-DDTHH:mm:ss» (u «AAAA-MM-DD») → número de serie de Excel.
 * Reloj de pared: construye el instante en UTC a partir de los componentes escritos,
 * de modo que ida y vuelta (serial→ISO→serial) es exacta salvo redondeo al segundo.
 */
export function isoASerialExcel(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso.trim())
  if (!m) throw new Error(`Fecha ISO no reconocida: «${iso}»`)
  const [, a, mes, dia, hh, mm, ss] = m
  const ms = Date.UTC(
    Number(a),
    Number(mes) - 1,
    Number(dia),
    hh ? Number(hh) : 0,
    mm ? Number(mm) : 0,
    ss ? Number(ss) : 0,
  )
  return (ms - EPOCH_EXCEL_UTC) / MS_POR_DIA
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Fecha de texto (dd/mm/aaaa o ISO) → ISO de dominio
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fecha (+ hora opcional) de texto → ISO local «AAAA-MM-DDTHH:mm:ss».
 * Acepta:
 *  - ISO: «2024-01-16», «2024-01-16T10:00», «2024-01-16 10:00:00».
 *  - es-ES: «16/01/2024», «16/01/2024 10:00», «16-01-2024».
 * La hora, si falta, es 00:00:00. Devuelve undefined si no reconoce el formato.
 */
export function fechaTextoAISO(fecha: string, hora?: string): string | undefined {
  const f = fecha.trim()
  if (f === '') return undefined

  let y: number, mes: number, d: number
  let hh = 0
  let mm = 0
  let ss = 0

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(f)
  const esES = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(f)

  if (iso) {
    y = Number(iso[1]); mes = Number(iso[2]); d = Number(iso[3])
    if (iso[4] !== undefined) { hh = Number(iso[4]); mm = Number(iso[5]); ss = iso[6] ? Number(iso[6]) : 0 }
  } else if (esES) {
    d = Number(esES[1]); mes = Number(esES[2]); y = Number(esES[3])
    if (esES[4] !== undefined) { hh = Number(esES[4]); mm = Number(esES[5]); ss = esES[6] ? Number(esES[6]) : 0 }
  } else {
    return undefined
  }

  // Hora separada (columna «hora» del CSV genérico: «10:00» o «10:00:00»).
  if (hora !== undefined && hora.trim() !== '') {
    const h = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hora.trim())
    if (h) { hh = Number(h[1]); mm = Number(h[2]); ss = h[3] ? Number(h[3]) : 0 }
  }

  if (mes < 1 || mes > 12 || d < 1 || d > 31 || hh > 23 || mm > 59 || ss > 59) return undefined
  return `${y}-${p2(mes)}-${p2(d)}T${p2(hh)}:${p2(mm)}:${p2(ss)}`
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Número (coma o punto) → cadena decimal de dominio (punto)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Valor de celda/CSV → cadena decimal de dominio con punto. Acepta:
 *  - número (celda numérica de xlsx): se serializa sin notación exponencial.
 *  - texto es-ES «1.234,5» (punto miles, coma decimal) o anglosajón «1234.5».
 * Devuelve undefined si está vacío o no es un decimal bien formado (nunca lanza).
 * No redondea: preserva los decimales tal cual (BTC a 8 se respeta si vienen 8).
 */
export function aDecimalDominio(valor: unknown): string | undefined {
  if (valor === undefined || valor === null) return undefined

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return undefined
    // decimal.js serializa el número a su representación decimal más corta y sin
    // notación exponencial (config toExpNeg del motor): «0.00000035», no «3.5e-7».
    return aCadena(D(valor))
  }

  const t = String(valor).trim()
  if (t === '') return undefined

  let limpio: string
  if (t.includes(',')) {
    // es-ES: los puntos son separadores de miles; la coma es la decimal.
    limpio = t.replace(/\./g, '').replace(',', '.')
  } else {
    limpio = t
  }
  return /^-?\d+(\.\d+)?$/.test(limpio) ? limpio : undefined
}

/**
 * Valor ANGLOSAJÓN de un CSV de explorador de bloques → cadena decimal de dominio.
 *
 * Los exploradores (Etherscan y sus clones) escriben siempre punto decimal y, en los
 * importes grandes, coma de miles («1,234.5678»). Por eso NO vale `aDecimalDominio`, que
 * ante una coma asume formato es-ES. Aquí la coma es SIEMPRE separador de miles.
 * Devuelve undefined si está vacío o mal formado (nunca lanza).
 */
export function aDecimalAnglo(valor: unknown): string | undefined {
  if (valor === undefined || valor === null) return undefined
  if (typeof valor === 'number') return Number.isFinite(valor) ? aCadena(D(valor)) : undefined
  const t = String(valor).trim().replace(/,/g, '')
  if (t === '') return undefined
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return undefined
  // Normaliza posible notación exponencial del explorador a decimal plano.
  return aCadena(D(t))
}

// ────────────────────────────────────────────────────────────────────────────
// 3 bis. Instante UTC → hora local española (DOMINIO §3.1)
// ────────────────────────────────────────────────────────────────────────────

/** Zona del taller: el dominio anota SIEMPRE hora local española. */
export const ZONA_TALLER = 'Europe/Madrid' as const

/**
 * Convierte un instante (ms desde epoch, o fecha/hora UTC de un explorador) a la
 * FechaHoraISO del dominio: ISO local sin zona, en hora española («2024-01-16T10:00:00»).
 *
 * Se usa `Intl` con la zona horaria del taller, así que el cambio de hora
 * (CET/CEST) sale bien sin arrastrar ninguna librería: un movimiento a las 10:00 UTC
 * del 16-1 es 11:00 en Madrid, y del 16-7, 12:00.
 */
export function instanteAHoraLocal(ms: number, zona: string = ZONA_TALLER): string | undefined {
  if (!Number.isFinite(ms)) return undefined
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const g = (t: string) => partes.find((x) => x.type === t)?.value ?? ''
  const hora = g('hour') === '24' ? '00' : g('hour') // Intl puede dar 24 a medianoche
  return `${g('year')}-${g('month')}-${g('day')}T${hora}:${g('minute')}:${g('second')}`
}

/**
 * Fecha/hora UTC tal y como la escriben los exploradores («2024-01-16 10:00:00»,
 * «2024-01-16T10:00:00Z», con o sin sufijo «UTC») → hora local española del dominio.
 * Devuelve undefined si no se puede interpretar.
 */
export function utcTextoAHoraLocal(texto: unknown, zona: string = ZONA_TALLER): string | undefined {
  const t = String(texto ?? '').trim().replace(/\s*UTC$/i, '')
  if (t === '') return undefined
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const [, aa = '0', mm = '1', dd = '1', hh = '0', mi = '0', ss] = m
    const ms = Date.UTC(+aa, +mm - 1, +dd, +hh, +mi, ss ? +ss : 0)
    return instanteAHoraLocal(ms, zona)
  }
  // Formatos con mes en texto o barra («1/16/2024 10:00:00»): último recurso.
  const ms = Date.parse(t.endsWith('Z') ? t : `${t}Z`)
  return Number.isFinite(ms) ? instanteAHoraLocal(ms, zona) : undefined
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Sí/No (KYC de UBICACIONES) ↔ booleano
// ────────────────────────────────────────────────────────────────────────────

/** «sí»/«si»/«true»/«1»/«x» → true; «no»/«false»/«0»/«» → false. Tolerante a mayúsculas/acentos. */
export function siNoABool(valor: unknown): boolean {
  const t = String(valor ?? '').trim().toLowerCase()
  return t === 'sí' || t === 'si' || t === 'true' || t === '1' || t === 'x' || t === 'verdadero'
}

/** true → «sí»; false → «no» (para escribir la columna KYC de la plantilla). */
export function boolASiNo(b: boolean): string {
  return b ? 'sí' : 'no'
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Tipo de operación: etiqueta de plantilla ↔ TipoOperacion del dominio
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mapa etiqueta (como aparece en la plantilla, con acentos: «MINERÍA», «PÉRDIDA»,
 * «DONACIÓN», «AJUSTE/RECTIFICACIÓN») → TipoOperacion ASCII del dominio. Se construye
 * desde ETIQUETA_TIPO e incluye además los propios literales ASCII, por robustez.
 */
const TIPO_POR_ETIQUETA: Readonly<Record<string, TipoOperacion>> = (() => {
  const m: Record<string, TipoOperacion> = {}
  for (const t of TIPOS_OPERACION) {
    m[ETIQUETA_TIPO[t].toUpperCase()] = t // etiqueta con acentos
    m[t] = t // literal ASCII del dominio
  }
  // Alias frecuentes sin acento (por si la fuente los teclea así).
  m['MINERIA'] = 'MINERIA'
  m['PERDIDA'] = 'PERDIDA'
  m['DONACION'] = 'DONACION'
  m['AJUSTE'] = 'AJUSTE'
  m['RECTIFICACION'] = 'AJUSTE'
  m['AJUSTE/RECTIFICACION'] = 'AJUSTE'
  return m
})()

/** Etiqueta de la plantilla → TipoOperacion del dominio (undefined si no es del catálogo). */
export function tipoDesdeEtiqueta(etiqueta: unknown): TipoOperacion | undefined {
  const clave = String(etiqueta ?? '').trim().toUpperCase()
  return TIPO_POR_ETIQUETA[clave]
}

/** TipoOperacion del dominio → etiqueta de la plantilla (la que las fórmulas del Excel esperan). */
export function etiquetaDesdeTipo(tipo: TipoOperacion): string {
  return ETIQUETA_TIPO[tipo]
}
