/**
 * explorador.ts — lector de CSV de EXPLORADORES DE BLOQUES (ENCARGO, Parte 2).
 *
 * Criterio fijado por el autor el 16-08-2026, opción (a): **la app NO consulta ninguna
 * cadena ni ningún explorador**. El alumno descarga los CSV donde quiera (Etherscan,
 * BscScan, Arbiscan…) y los sube aquí. La Regla de oro 3 queda intacta: cero llamadas de
 * red en runtime, y la dirección del alumno no se revela a ningún tercero.
 *
 * Lo que este módulo produce NO son apuntes, sino MOVIMIENTOS: un explorador sabe qué
 * salió y qué entró de una dirección, pero no sabe si un envío es traslado o transmisión,
 * ni el contravalor en euros, ni cuál de los 12 tipos aplica. Eso lo decide el alumno en la
 * bandeja de triaje (`triaje.ts`), que es además lo pedagógicamente correcto.
 *
 * Funciones PURAS y deterministas (sin Dexie, sin React, sin red).
 *
 * Las tres exportaciones de una misma cadena:
 *  - **normal**: transacciones del activo nativo. Cabecera VERIFICADA en el encargo:
 *    `Txhash, Blockno, UnixTimestamp, DateTime, From, To, ContractAddress, Value_IN(x),
 *     Value_OUT(x), CurrentValue @ $…, TxnFee(x), TxnFee(USD), Historical $Price/x,
 *     Status, ErrCode`.
 *  - **erc20**: transferencias de tokens (la exportación normal NO las trae).
 *  - **internas**: movimientos de contratos que de otro modo se pierden.
 *
 * `TODO-REVISION`: las cabeceras de las exportaciones **erc20** e **internas** están
 * cotejadas contra las variantes públicas conocidas, pero el encargo pide confirmarlas
 * contra una exportación REAL antes de darlas por buenas. Por eso el emparejamiento es
 * tolerante (alias y casación por prefijo) y cualquier columna que falte se reporta como
 * aviso en vez de romper la importación.
 */
import { aDecimalAnglo, instanteAHoraLocal, utcTextoAHoraLocal } from './formatos'
import { parsearCSV } from './csv-generico'

// ────────────────────────────────────────────────────────────────────────────
// 1. Tipos
// ────────────────────────────────────────────────────────────────────────────

/** Qué exportación del explorador es el fichero. */
export type ClaseExportacion = 'normal' | 'erc20' | 'internas'

/** Sentido del movimiento respecto de la dirección exportada. */
export type SentidoMovimiento = 'entrada' | 'salida' | 'ninguno'

/** Un movimiento leído del CSV. Todavía NO es un apunte. */
export interface MovimientoExplorador {
  /** Clave de deduplicación: `txhash#clase#índice dentro de la transacción`. */
  clave: string
  txhash: string
  clase: ClaseExportacion
  /** Índice del movimiento dentro de su transacción y exportación (0, 1, 2…). */
  indice: number
  /** Fecha/hora del dominio: ISO local española (DOMINIO §3.1). */
  fechaHora: string
  /** Fecha/hora UTC original, tal y como venía en el CSV (para la traza). */
  fechaHoraUtc: string
  desde: string
  hacia: string
  sentido: SentidoMovimiento
  activo: string
  /** Cantidad movida, siempre positiva. «0» en una transacción sin valor. */
  cantidad: string
  /** Comisión de red pagada en cripto (solo la trae la exportación normal). */
  comisionCantidad?: string
  comisionActivo?: string
  /** Dirección del contrato (token o contrato invocado), si consta. */
  contrato?: string
  /** Transacción FALLIDA: no movió valor, pero gastó gas. Se importa solo por la comisión. */
  fallida: boolean
  /** Nº de línea en el CSV (1 = cabecera), para poder señalar el origen del dato. */
  linea: number
}

/** Resultado de leer un fichero de explorador. */
export interface LecturaExplorador {
  clase: ClaseExportacion
  /** Símbolo del activo nativo deducido de la cabecera (ETH, BNB, MATIC…). */
  activoNativo: string
  movimientos: MovimientoExplorador[]
  avisos: string[]
  filasRechazadas: { linea: number; motivo: string }[]
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Cabeceras
// ────────────────────────────────────────────────────────────────────────────

/** Normaliza un nombre de columna: minúsculas, sin espacios ni guiones bajos. */
function normCol(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_"']/g, '')
}

/** Índice de columnas normalizadas → posición. La primera aparición manda. */
function indexarCabecera(cabecera: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  cabecera.forEach((h, i) => {
    const n = normCol(h)
    if (n !== '' && !m.has(n)) m.set(n, i)
  })
  return m
}

/** Posición de la primera columna cuyo nombre normalizado empieza por el prefijo dado. */
function posPorPrefijo(indice: Map<string, number>, prefijo: string): number | undefined {
  for (const [nombre, pos] of indice) if (nombre.startsWith(prefijo)) return pos
  return undefined
}

/** Posición de la primera columna que case con alguno de los alias exactos. */
function posPorAlias(indice: Map<string, number>, alias: readonly string[]): number | undefined {
  for (const a of alias) {
    const p = indice.get(normCol(a))
    if (p !== undefined) return p
  }
  return undefined
}

/**
 * Símbolo del activo nativo, incrustado en el nombre de la columna: `Value_IN(ETH)`,
 * `TxnFee(BNB)`… Se casa por PREFIJO, nunca por igualdad: los nombres de las columnas de
 * precio llevan la cotización dentro (`CurrentValue @ $1785.9/Eth`).
 */
export function simboloNativoDeCabecera(cabecera: readonly string[]): string | undefined {
  for (const h of cabecera) {
    const m = normCol(h).match(/^(?:value(?:in|out)|txnfee)\(([a-z0-9]+)\)$/)
    const simbolo = m?.[1]
    if (simbolo && simbolo !== 'usd') return simbolo.toUpperCase()
  }
  return undefined
}

/**
 * ¿Qué exportación es? Se decide por las columnas presentes, no por el nombre del fichero:
 *  - `tokensymbol`/`tokenvalue` → **erc20**;
 *  - columnas de la transacción padre (`parenttxfrom`, `partxfrom`…) → **internas**;
 *  - `value_in(x)`/`txnfee(x)` sin las anteriores → **normal**.
 */
export function detectarClaseExportacion(cabecera: readonly string[]): ClaseExportacion | undefined {
  const idx = indexarCabecera(cabecera)
  const tiene = (n: string) => idx.has(normCol(n))
  if (tiene('TokenSymbol') || tiene('TokenValue') || tiene('TokenName')) return 'erc20'
  if (tiene('ParentTxFrom') || tiene('ParTxFrom') || tiene('ParentTxETH_Value') || tiene('TxTo')) {
    return 'internas'
  }
  if (posPorPrefijo(idx, 'valuein(') !== undefined || posPorPrefijo(idx, 'txnfee(') !== undefined) {
    return 'normal'
  }
  return undefined
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Lectura
// ────────────────────────────────────────────────────────────────────────────

const ALIAS_TXHASH = ['Txhash', 'Transaction Hash', 'TxHash', 'Hash']
const ALIAS_FECHA = ['DateTime (UTC)', 'DateTime', 'Date', 'Human Readable Time']
const ALIAS_TS = ['UnixTimestamp', 'Unix Timestamp', 'Timestamp']
const ALIAS_DESDE = ['From', 'FromAddress']
const ALIAS_HACIA = ['To', 'ToAddress', 'TxTo']
const ALIAS_CONTRATO = ['ContractAddress', 'Contract Address', 'TokenContractAddress']
const ALIAS_STATUS = ['Status']
const ALIAS_ERRCODE = ['ErrCode', 'Error Code']
const ALIAS_TOKEN_VALOR = ['TokenValue', 'Value', 'Quantity', 'Amount']
const ALIAS_TOKEN_SIMBOLO = ['TokenSymbol', 'Token Symbol', 'Symbol']

/** Detecta el separador de la línea de cabecera (coma o punto y coma). */
function detectarSeparador(primeraLinea: string): ',' | ';' {
  const comas = (primeraLinea.match(/,/g) ?? []).length
  const puntoYComa = (primeraLinea.match(/;/g) ?? []).length
  return puntoYComa > comas ? ';' : ','
}

/**
 * ¿Es una transacción FALLIDA? El explorador la marca con un código de error o con un
 * estado que contiene «error». Las fallidas **no mueven valor pero sí gastan gas**: se
 * importan solo por la comisión (encargo, tabla de mapeo).
 */
function esFallida(status: string, errCode: string): boolean {
  const s = status.trim().toLowerCase()
  const e = errCode.trim()
  if (e !== '' && e !== '0') return true
  return s.includes('error') || s.includes('fail')
}

/** Limpia una dirección del CSV (algunos exploradores añaden la etiqueta entre paréntesis). */
function limpiarDireccion(v: string): string {
  return (v ?? '').trim().replace(/\s*\(.*\)\s*$/, '').trim()
}

/**
 * Lee un CSV de explorador y devuelve sus movimientos. No decide tipos ni ubicaciones:
 * eso es del triaje. `nombreFichero` solo se usa para los mensajes de aviso.
 */
export function leerCsvExplorador(texto: string, nombreFichero = 'CSV'): LecturaExplorador {
  const filas = parsearCSV(texto, detectarSeparador(texto.split(/\r?\n/, 1)[0] ?? ''))
  if (filas.length === 0) throw new Error(`«${nombreFichero}» está vacío.`)

  const cabecera = filas[0] ?? []
  const clase = detectarClaseExportacion(cabecera)
  if (!clase) {
    throw new Error(
      `No reconozco «${nombreFichero}» como exportación de un explorador de bloques: ` +
        'faltan las columnas Value_IN(…)/TxnFee(…) o TokenSymbol.',
    )
  }

  const idx = indexarCabecera(cabecera)
  const avisos: string[] = []
  const filasRechazadas: { linea: number; motivo: string }[] = []

  const activoNativo = simboloNativoDeCabecera(cabecera) ?? ''
  if (clase !== 'erc20' && activoNativo === '') {
    avisos.push(
      'No he podido deducir el activo nativo de la cabecera; reviso las columnas ' +
        'Value_IN(…)/TxnFee(…) del fichero.',
    )
  }

  const pTx = posPorAlias(idx, ALIAS_TXHASH)
  const pFecha = posPorAlias(idx, ALIAS_FECHA)
  const pTs = posPorAlias(idx, ALIAS_TS)
  const pDesde = posPorAlias(idx, ALIAS_DESDE)
  const pHacia = posPorAlias(idx, ALIAS_HACIA)
  const pContrato = posPorAlias(idx, ALIAS_CONTRATO)
  const pStatus = posPorAlias(idx, ALIAS_STATUS)
  const pErr = posPorAlias(idx, ALIAS_ERRCODE)
  const pIn = posPorPrefijo(idx, 'valuein(')
  const pOut = posPorPrefijo(idx, 'valueout(')
  const pFee = posPorPrefijo(idx, 'txnfee(')
  const pTokenValor = posPorAlias(idx, ALIAS_TOKEN_VALOR)
  const pTokenSimbolo = posPorAlias(idx, ALIAS_TOKEN_SIMBOLO)

  if (pTx === undefined) avisos.push('El fichero no trae Txhash: no podré deduplicar por transacción.')
  if (pFecha === undefined && pTs === undefined) {
    throw new Error(`«${nombreFichero}» no trae ni DateTime ni UnixTimestamp: sin fecha no hay apunte.`)
  }

  const campo = (fila: string[], pos: number | undefined): string =>
    pos === undefined ? '' : (fila[pos] ?? '').trim()

  const contador = new Map<string, number>()
  const movimientos: MovimientoExplorador[] = []

  for (let f = 1; f < filas.length; f++) {
    const fila = filas[f] ?? []
    const linea = f + 1

    const tsTexto = campo(fila, pTs)
    const fechaUtc = campo(fila, pFecha)
    const segundos = Number(tsTexto)
    const fechaHora =
      tsTexto !== '' && Number.isFinite(segundos) && segundos > 0
        ? instanteAHoraLocal(segundos * 1000)
        : utcTextoAHoraLocal(fechaUtc)
    if (!fechaHora) {
      filasRechazadas.push({ linea, motivo: 'fecha ilegible' })
      continue
    }

    const status = campo(fila, pStatus)
    const errCode = campo(fila, pErr)
    const fallida = esFallida(status, errCode)

    let activo = activoNativo
    let cantidad = '0'
    let sentido: SentidoMovimiento = 'ninguno'

    if (clase === 'erc20') {
      activo = campo(fila, pTokenSimbolo).toUpperCase() || 'TOKEN'
      cantidad = aDecimalAnglo(campo(fila, pTokenValor)) ?? '0'
      sentido = cantidad === '0' ? 'ninguno' : 'salida' // el triaje lo afina con las direcciones
    } else {
      const entra = aDecimalAnglo(campo(fila, pIn)) ?? '0'
      const sale = aDecimalAnglo(campo(fila, pOut)) ?? '0'
      if (entra !== '0') {
        cantidad = entra
        sentido = 'entrada'
      } else if (sale !== '0') {
        cantidad = sale
        sentido = 'salida'
      }
    }

    // Una transacción fallida no mueve valor: solo consume gas (encargo, tabla de mapeo).
    if (fallida) {
      cantidad = '0'
      sentido = 'ninguno'
    }

    const comision = clase === 'normal' ? aDecimalAnglo(campo(fila, pFee)) : undefined
    const txhash = campo(fila, pTx) || `sin-hash-l${linea}`
    const claveTx = `${txhash}#${clase}`
    const indice = contador.get(claveTx) ?? 0
    contador.set(claveTx, indice + 1)

    if (cantidad === '0' && (!comision || comision === '0')) {
      filasRechazadas.push({ linea, motivo: 'sin valor ni comisión' })
      continue
    }

    movimientos.push({
      clave: `${claveTx}#${indice}`,
      txhash,
      clase,
      indice,
      fechaHora,
      fechaHoraUtc: fechaUtc || (tsTexto !== '' ? `${tsTexto} (unix)` : ''),
      desde: limpiarDireccion(campo(fila, pDesde)),
      hacia: limpiarDireccion(campo(fila, pHacia)),
      sentido,
      activo,
      cantidad,
      comisionCantidad: comision && comision !== '0' ? comision : undefined,
      comisionActivo: comision && comision !== '0' ? activoNativo || undefined : undefined,
      contrato: campo(fila, pContrato) || undefined,
      fallida,
      linea,
    })
  }

  if (clase === 'normal' && movimientos.length > 0) {
    avisos.push(
      'La exportación normal solo trae el activo nativo: los tokens van en la exportación ' +
        'ERC-20 y los movimientos de contratos en la de transacciones internas. Súbelas también ' +
        'si esta dirección los tuvo.',
    )
  }

  return { clase, activoNativo, movimientos, avisos, filasRechazadas }
}

/**
 * Une las lecturas de varios ficheros (normal + ERC-20 + internas de una o varias cadenas),
 * ordena por fecha y **deduplica por clave**: reimportar el mismo fichero, o solapar dos
 * exportaciones de la misma transacción, no duplica nada.
 */
export function unirLecturas(lecturas: readonly LecturaExplorador[]): {
  movimientos: MovimientoExplorador[]
  duplicados: number
} {
  const vistos = new Set<string>()
  const movimientos: MovimientoExplorador[] = []
  let duplicados = 0
  for (const l of lecturas) {
    for (const m of l.movimientos) {
      if (vistos.has(m.clave)) {
        duplicados++
        continue
      }
      vistos.add(m.clave)
      movimientos.push(m)
    }
  }
  movimientos.sort((a, b) =>
    a.fechaHora === b.fechaHora ? a.clave.localeCompare(b.clave) : a.fechaHora < b.fechaHora ? -1 : 1,
  )
  return { movimientos, duplicados }
}
