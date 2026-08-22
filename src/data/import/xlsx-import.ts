/**
 * xlsx-import.ts — importa la PLANTILLA_TALLER.xlsx con SheetJS (P4, punto 1).
 *
 * Lee las hojas que el alumno rellena a mano — DIARIO, UBICACIONES, PARÁMETROS
 * (tolerancias) — e IGNORA las calculadas (SALDOS, FIFO, CUADRE). Detecta las filas de
 * ejemplo «EJEMPLO — borrar» y permite excluirlas. Devuelve el contenido del Libro y un
 * informe (filas aceptadas, rechazadas con motivo, avisos, ejemplos detectados).
 *
 * Fechas: Excel las guarda como número de serie → `serialExcelAISO` (reloj de pared).
 * Ubicaciones: se identifican por su NOMBRE (id = nombre); los apuntes las referencian
 * por nombre, igual que EXTERIOR. Cantidades: coma o punto vía `aDecimalDominio`.
 */

import * as XLSX from 'xlsx'
import type { Apunte, SentidoApunte, Tolerancias, Ubicacion, TipoUbicacion } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import {
  serialExcelAISO,
  fechaTextoAISO,
  aDecimalDominio,
  siNoABool,
  tipoDesdeEtiqueta,
} from './formatos'
import { HOJAS, MARCA_EJEMPLO, DIARIO, UBICACIONES, PARAMETROS } from './plantilla-layout'
import type { InformeImport } from './mapeo-generico'
import {
  type ResultadoImportacion,
  activosDescubiertos,
  simbolosDeApunte,
} from './contenido'

/** Opciones de importación. */
export interface OpcionesImportXlsx {
  /** Excluir las filas marcadas «EJEMPLO — borrar» (por defecto, sí). */
  excluirEjemplos?: boolean
}

/** Convierte el valor de una celda de fecha (serial numérico o texto) a ISO local. */
function celdaAFecha(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return serialExcelAISO(v)
  if (typeof v === 'string' && v.trim() !== '') return fechaTextoAISO(v)
  return undefined
}

/** ¿La celda contiene la marca de ejemplo de la plantilla? */
function esEjemplo(v: unknown): boolean {
  return typeof v === 'string' && v.includes(MARCA_EJEMPLO)
}

/** Texto de celda saneado (o undefined si vacío). */
function texto(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const t = String(v).trim()
  return t === '' ? undefined : t
}

/**
 * Lee el SENTIDO de la columna Q. Tolerante con lo que teclee el alumno: acepta la clave
 * interna, la etiqueta con acentos y las abreviaturas naturales. Lo que no reconoce se
 * descarta (queda `undefined`) y la validación avisará, que es preferible a inventar un
 * sentido y mover la cola FIFO por una errata.
 */
function sentidoDesdeCelda(v: unknown): SentidoApunte | undefined {
  const t = texto(v)
  if (!t) return undefined
  const n = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-')
  if (n.startsWith('entregad') || n === 'salida' || n === 'entrega') return 'entregada'
  if (n.startsWith('recibid') || n === 'entrada' || n === 'recepcion') return 'recibida'
  if (n.startsWith('solo-saldo') || n === 'solosaldos' || n === 'saldos') return 'solo-saldos'
  return undefined
}

/** Lee una hoja como matriz de filas × celdas (valores crudos: fechas como serial). */
function matriz(wb: XLSX.WorkBook, hoja: string): unknown[][] {
  const ws = wb.Sheets[hoja]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
}

/**
 * Importa un libro XLSX (ArrayBuffer/Uint8Array) con el formato de la plantilla.
 * No toca la base de datos: devuelve el contenido para que la capa de datos lo vuelque.
 */
export function importarXlsx(
  datos: ArrayBuffer | Uint8Array,
  opciones: OpcionesImportXlsx = {},
): ResultadoImportacion {
  const excluirEjemplos = opciones.excluirEjemplos ?? true
  const wb = XLSX.read(datos, { type: 'array', cellDates: false })

  const informe: InformeImport = {
    filasAceptadas: 0,
    filasRechazadas: [],
    avisos: [],
    ejemplosDetectados: 0,
  }

  const ubicaciones = leerUbicaciones(wb, informe, excluirEjemplos)
  const apuntes = leerDiario(wb, informe, excluirEjemplos)
  const tolerancias = leerTolerancias(wb)

  // Activos: los que aparecen en los apuntes, salvo BTC/EUR (de serie en la base).
  const simbolos = apuntes.flatMap(simbolosDeApunte)
  const activos = activosDescubiertos(simbolos)

  // Aviso si el DIARIO referencia ubicaciones que no están en la hoja UBICACIONES.
  const nombresUbic = new Set(ubicaciones.map((u) => u.nombre))
  const refs = new Set<string>()
  for (const ap of apuntes) {
    for (const r of [ap.ubicacionOrigen, ap.ubicacionDestino]) {
      if (r !== UBICACION_EXTERIOR && !nombresUbic.has(r)) refs.add(r)
    }
  }
  for (const r of refs) {
    informe.avisos.push(
      `La ubicación «${r}» aparece en el DIARIO pero no en la hoja UBICACIONES; ` +
        'se importa como referencia, dala de alta para completar sus datos.',
    )
  }

  informe.filasAceptadas = apuntes.length
  return { apuntes, ubicaciones, activos, tolerancias, informe }
}

/** Lee la hoja UBICACIONES (id = nombre). */
function leerUbicaciones(
  wb: XLSX.WorkBook,
  informe: InformeImport,
  excluirEjemplos: boolean,
): Ubicacion[] {
  const filas = matriz(wb, HOJAS.ubicaciones)
  const c = UBICACIONES.col
  const salida: Ubicacion[] = []
  const vistos = new Set<string>()

  for (let i = UBICACIONES.filaDatos1 - 1; i < filas.length; i++) {
    const fila = filas[i]
    if (!fila) continue
    const nombre = texto(fila[c.nombre])
    if (!nombre) continue // fila vacía
    const nFila = i + 1

    if (esEjemplo(fila[c.notas])) {
      informe.ejemplosDetectados++
      if (excluirEjemplos) continue
    }
    if (nombre === UBICACION_EXTERIOR) continue // EXTERIOR es constante del dominio
    if (vistos.has(nombre)) {
      informe.avisos.push(`Ubicación duplicada «${nombre}» (fila ${nFila}); se conserva la primera.`)
      continue
    }
    vistos.add(nombre)

    const tipoRaw = (texto(fila[c.tipo]) ?? 'exchange').toLowerCase()
    const tipo: TipoUbicacion =
      tipoRaw === 'wallet' || tipoRaw === 'canal' ? (tipoRaw as TipoUbicacion) : 'exchange'
    const fechaAlta = celdaAFecha(fila[c.fechaAlta]) ?? '2000-01-01T00:00:00'
    const fechaCierre = celdaAFecha(fila[c.fechaCierre])
    const notas = esEjemplo(fila[c.notas]) ? undefined : texto(fila[c.notas])

    salida.push({
      id: nombre,
      nombre,
      tipo,
      kyc: siNoABool(fila[c.kyc]),
      fechaAlta,
      ...(fechaCierre ? { fechaCierre } : {}),
      ...(notas ? { notas } : {}),
    })
  }
  return salida
}

/** Lee la hoja DIARIO (máx. 100 apuntes; renumera cronológicamente al final). */
function leerDiario(
  wb: XLSX.WorkBook,
  informe: InformeImport,
  excluirEjemplos: boolean,
): Apunte[] {
  const filas = matriz(wb, HOJAS.diario)
  const c = DIARIO.col
  const parcial: Array<Omit<Apunte, 'id'> & { fila: number }> = []

  const desde = DIARIO.filaDatos1 - 1
  const hasta = Math.min(filas.length, desde + DIARIO.maxApuntes)
  for (let i = desde; i < hasta; i++) {
    const fila = filas[i]
    if (!fila) continue
    const nFila = i + 1
    const tipoRaw = fila[c.tipo]
    const fechaCruda = fila[c.fechaHora]
    // Fila vacía: ni tipo ni fecha.
    if ((texto(tipoRaw) === undefined) && (fechaCruda === '' || fechaCruda === undefined)) continue

    if (esEjemplo(fila[c.notas])) {
      informe.ejemplosDetectados++
      if (excluirEjemplos) continue
    }

    const fechaHora = celdaAFecha(fechaCruda)
    if (!fechaHora) {
      informe.filasRechazadas.push({ fila: nFila, motivo: `Fecha no reconocida: «${fechaCruda}».` })
      continue
    }
    const tipo = tipoDesdeEtiqueta(tipoRaw)
    if (!tipo) {
      informe.filasRechazadas.push({ fila: nFila, motivo: `Tipo no válido: «${texto(tipoRaw) ?? ''}».` })
      continue
    }

    const notas = esEjemplo(fila[c.notas]) ? undefined : texto(fila[c.notas])
    parcial.push({
      fila: nFila,
      fechaHora,
      tipo,
      ubicacionOrigen: texto(fila[c.ubicacionOrigen]) ?? UBICACION_EXTERIOR,
      ubicacionDestino: texto(fila[c.ubicacionDestino]) ?? UBICACION_EXTERIOR,
      ...campo('activoSalida', texto(fila[c.activoSalida])),
      ...campo('cantidadSalida', aDecimalDominio(fila[c.cantidadSalida])),
      ...campo('activoEntrada', texto(fila[c.activoEntrada])),
      ...campo('cantidadEntrada', aDecimalDominio(fila[c.cantidadEntrada])),
      ...campo('comisionCantidad', aDecimalDominio(fila[c.comisionCantidad])),
      ...campo('comisionActivo', texto(fila[c.comisionActivo])),
      ...campo('contravalorEUR', aDecimalDominio(fila[c.contravalorEUR])),
      // art. 37.1.h): columnas O y P, presentes solo en los ficheros que exporta la app.
      // Un fichero de la plantilla oficial no las trae y quedan sin definir (compatible).
      ...campo('valorMercadoEntregadoEUR', aDecimalDominio(fila[c.valorMercadoEntregadoEUR])),
      ...campo('valorMercadoRecibidoEUR', aDecimalDominio(fila[c.valorMercadoRecibidoEUR])),
      // Sentido de DONACIÓN / AJUSTE: columna Q, misma tolerancia que O y P.
      ...campo('sentido', sentidoDesdeCelda(fila[c.sentido])),
      ...campo('justificante', texto(fila[c.justificante])),
      ...campo('notas', notas),
    })
  }

  // Renumera cronológicamente (AAAA-NNN por año); desempate por fila original.
  const ordenados = parcial.sort((a, b) => {
    const ta = new Date(a.fechaHora).getTime()
    const tb = new Date(b.fechaHora).getTime()
    return ta !== tb ? ta - tb : a.fila - b.fila
  })
  const contador = new Map<number, number>()
  return ordenados.map((p) => {
    const anio = new Date(p.fechaHora).getFullYear()
    const n = (contador.get(anio) ?? 0) + 1
    contador.set(anio, n)
    const { fila: _f, ...resto } = p
    return { ...resto, id: `${anio}-${String(n).padStart(3, '0')}` }
  })
}

/** Añade la propiedad solo si el valor está definido (mantiene el apunte limpio). */
function campo<K extends keyof Apunte>(clave: K, valor: Apunte[K] | undefined): Partial<Apunte> {
  return valor === undefined ? {} : ({ [clave]: valor } as Partial<Apunte>)
}

/** Lee las tolerancias del cuadre de PARÁMETROS (B32 verde, B33 ámbar), si están. */
function leerTolerancias(wb: XLSX.WorkBook): Tolerancias | undefined {
  const ws = wb.Sheets[HOJAS.parametros]
  if (!ws) return undefined
  const verde = ws[PARAMETROS.celdaToleranciaVerde]?.v
  const ambar = ws[PARAMETROS.celdaToleranciaAmbar]?.v
  if (typeof verde !== 'number' || typeof ambar !== 'number') return undefined
  return { verde, ambar }
}
