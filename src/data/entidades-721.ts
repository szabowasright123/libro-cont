/**
 * entidades-721.ts — perímetro «extranjero» del aviso 721 (derivada D2, P9.4).
 *
 * Lista-semilla ORIENTATIVA y editable (de docs/ENTIDADES_721_SEMILLA.md, fecha 8-8-2026) para
 * SUGERIR —nunca imponer— la marca `extranjero` al dar de alta una ubicación custodia. El
 * criterio no es la marca comercial sino el ESTABLECIMIENTO: es «extranjero» a efectos del aviso
 * el custodio NO establecido en España (no obligado a los modelos 172/173). Esta lista caduca:
 * verificar contra el listado oficial de la CNMV a la fecha de uso.
 *
 * Capa de datos pura: sin red, sin cálculo del motor. Solo alimenta una sugerencia de la UI.
 */

/** Fecha de la lista-semilla (para rotular la sugerencia como orientativa y caduca). */
export const FECHA_LISTA_721 = '2026-08-08'

/** Regla previa: la autocustodia NO computa para el 721 (FAQ AEAT del modelo 721). */
export const NOTA_AUTOCUSTODIA_721 =
  'Wallet con tus propias claves: no computa para el 721 (FAQ AEAT). Solo se informa de monedas ' +
  'custodiadas por terceros que gestionan claves ajenas.'

/** Nota de criterio general (el «¿por qué?» de la sugerencia). */
export const NOTA_CRITERIO_721 =
  'El criterio no es la marca comercial sino el establecimiento: es «extranjero» a efectos del aviso ' +
  'el custodio NO establecido en España (no obligado a los modelos 172/173). Tener pasaporte europeo ' +
  'MiCA para operar en España NO equivale a estar establecido en España. Algunas entidades operan ' +
  'mediante filial española: comprueba con qué entidad tienes el contrato. Lista orientativa a ' +
  `${FECHA_LISTA_721.split('-').reverse().join('/')}; verifícala contra el listado vigente de la CNMV.`

/** Una entidad custodia de la lista-semilla. */
export interface EntidadCustodia {
  /** Nombre comercial (clave de coincidencia con el nombre de la ubicación). */
  readonly nombre: string
  /** true si está establecida en España (declara 172/173 → NO se marca «extranjero»). */
  readonly establecidoEspana: boolean
  /** Situación/licencia orientativa (ago-2026). */
  readonly situacion: string
}

/**
 * ENTIDADES_721 — custodios establecidos en España (declaran 172/173) y custodios extranjeros
 * habituales (relevantes para el aviso 721). De docs/ENTIDADES_721_SEMILLA.md.
 */
export const ENTIDADES_721: readonly EntidadCustodia[] = [
  // Establecidos en España → NO marcar «extranjero» (declaran 172/173).
  { nombre: 'Bit2Me', establecidoEspana: true, situacion: 'Autorización MiCA de la CNMV (31-10-2025)' },
  { nombre: 'BBVA', establecidoEspana: true, situacion: 'Autorizada (custodia y compraventa, 2025)' },
  { nombre: 'Openbank', establecidoEspana: true, situacion: 'Autorizada (Santander)' },
  { nombre: 'CaixaBank', establecidoEspana: true, situacion: 'Autorizada (2026)' },
  { nombre: 'KutxaBank', establecidoEspana: true, situacion: 'Autorizada (2026)' },
  { nombre: 'Cecabank', establecidoEspana: true, situacion: 'Autorizada' },
  { nombre: 'Renta 4', establecidoEspana: true, situacion: 'Autorizada (Renta 4 Banco)' },
  { nombre: 'Fazil Crypto', establecidoEspana: true, situacion: 'Licencia MiCA CNMV' },
  { nombre: 'Criptan', establecidoEspana: true, situacion: 'Española de origen — verificar estado en el listado CNMV vigente' },
  { nombre: 'Bitnovo', establecidoEspana: true, situacion: 'Española de origen — verificar estado en el listado CNMV vigente' },
  { nombre: 'BitBase', establecidoEspana: true, situacion: 'Española de origen — verificar estado en el listado CNMV vigente' },

  // Extranjeros habituales → marcar «extranjero» (relevantes para el 721).
  { nombre: 'Coinbase', establecidoEspana: false, situacion: 'MiCA — Luxemburgo' },
  { nombre: 'Kraken', establecidoEspana: false, situacion: 'MiCA — Irlanda' },
  { nombre: 'Crypto.com', establecidoEspana: false, situacion: 'MiCA — Malta' },
  { nombre: 'OKX', establecidoEspana: false, situacion: 'MiCA — Malta' },
  { nombre: 'Bitpanda', establecidoEspana: false, situacion: 'MiCA — Alemania/Austria' },
  { nombre: 'Bitstamp', establecidoEspana: false, situacion: 'MiCA — Luxemburgo' },
  { nombre: 'Bybit', establecidoEspana: false, situacion: 'MiCA — Austria' },
  { nombre: 'Gemini', establecidoEspana: false, situacion: 'MiCA — Malta' },
  { nombre: 'Binance', establecidoEspana: false, situacion: 'Verificar estado (sin establecimiento en España)' },
  { nombre: 'KuCoin', establecidoEspana: false, situacion: 'Fuera de la UE — verificar acceso al mercado español' },
  { nombre: 'Gate', establecidoEspana: false, situacion: 'Fuera de la UE — verificar acceso al mercado español' },
  { nombre: 'MEXC', establecidoEspana: false, situacion: 'Fuera de la UE — verificar acceso al mercado español' },
  { nombre: 'HTX', establecidoEspana: false, situacion: 'Fuera de la UE — verificar acceso al mercado español' },
]

/** Sugerencia derivada de la lista para un nombre de ubicación. */
export interface Sugerencia721 {
  /** Entidad de la lista con la que casa el nombre. */
  readonly entidad: string
  /** true si se sugiere marcar «extranjero» (custodio no establecido en España). */
  readonly sugerirExtranjero: boolean
  /** Situación orientativa de la entidad. */
  readonly situacion: string
}

/** Normaliza un nombre para comparar (minúsculas, sin acentos ni espacios de sobra). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Sugiere, a partir del nombre de una ubicación, si es un custodio conocido de la lista y si
 * procede marcar «extranjero». Coincidencia laxa por inclusión del nombre de la entidad en el de
 * la ubicación (p. ej. «Kraken Pro» → Kraken). Devuelve la primera coincidencia más específica
 * (la de nombre más largo). Nunca impone: es solo una sugerencia editable por el alumno.
 */
export function sugerir721(nombreUbicacion: string): Sugerencia721 | null {
  const n = norm(nombreUbicacion)
  if (n === '') return null
  const candidatas = [...ENTIDADES_721]
    .filter((e) => {
      const en = norm(e.nombre)
      return en.length >= 3 && (n.includes(en) || en.includes(n))
    })
    .sort((a, b) => b.nombre.length - a.nombre.length)
  const e = candidatas[0]
  if (!e) return null
  return { entidad: e.nombre, sugerirExtranjero: !e.establecidoEspana, situacion: e.situacion }
}
