/**
 * xlsx-export.ts — exporta el Libro a la PLANTILLA_TALLER.xlsx con exceljs (P4, punto 2).
 *
 * Parte de una COPIA de la plantilla oficial (src/assets/plantilla-taller.xlsx) y escribe
 * SOLO los datos en DIARIO, UBICACIONES y PARÁMETROS (tolerancias), respetando los rangos
 * que las fórmulas esperan (DIARIO desde la fila 3; las hojas SALDOS/FIFO/CUADRE se dejan
 * intactas para que el Excel se recalcule solo y coincida con la app).
 *
 * Límite de la plantilla: sus fórmulas cubren 100 apuntes (filas 3..102). Si hay más, se
 * exporta un fichero por ejercicio (año) y se avisa. Fechas: ISO local → serial de Excel
 * (reloj de pared). Cantidades: cadena decimal → número (el Excel necesita números para
 * sus SUMIFS/SUMPRODUCT); la app conserva la precisión exacta internamente.
 */

import ExcelJS from 'exceljs'
import type { Apunte, Tolerancias, Ubicacion } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import { isoASerialExcel, etiquetaDesdeTipo, boolASiNo } from './formatos'
import { HOJAS, MARCA_EJEMPLO, DIARIO, UBICACIONES, PARAMETROS } from './plantilla-layout'
import type { ContenidoLibro } from './contenido'

/** Un fichero XLSX generado (bytes) con su ejercicio (null = todos en un solo libro). */
export interface ArchivoExportado {
  ejercicio: number | null
  bytes: Uint8Array
}

/** Resultado de la exportación: uno o varios ficheros + avisos. */
export interface ResultadoExportXlsx {
  archivos: ArchivoExportado[]
  avisos: string[]
}

/** Formato de fecha/hora de la plantilla (coincide con la convención es-ES del taller). */
const FMT_FECHA = 'dd/mm/yyyy hh:mm'

/** Número desde una cadena decimal de dominio (o undefined si no hay valor). */
function num(valor: string | undefined): number | undefined {
  if (valor === undefined || valor.trim() === '') return undefined
  const n = Number(valor)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Exporta el contenido del Libro a XLSX sobre la plantilla oficial. `plantilla` son los
 * bytes de src/assets/plantilla-taller.xlsx (la UI los obtiene por fetch; los tests, por fs).
 */
export async function exportarXlsx(
  contenido: ContenidoLibro,
  plantilla: ArrayBuffer | Uint8Array,
): Promise<ResultadoExportXlsx> {
  const avisos: string[] = []
  const apuntes = [...contenido.apuntes].sort(
    (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime(),
  )

  if (apuntes.length <= DIARIO.maxApuntes) {
    const bytes = await escribirLibro(plantilla, { ...contenido, apuntes })
    return { archivos: [{ ejercicio: null, bytes }], avisos }
  }

  // Más de 100 apuntes: un fichero por ejercicio (las fórmulas de la plantilla no dan
  // para más). Se avisa; y si un solo ejercicio supera 100, se avisa aparte.
  avisos.push(
    `El Libro tiene ${apuntes.length} apuntes y la plantilla admite ${DIARIO.maxApuntes} por ` +
      'fichero. Se exporta un fichero por ejercicio.',
  )
  const porAnio = new Map<number, Apunte[]>()
  for (const ap of apuntes) {
    const anio = new Date(ap.fechaHora).getFullYear()
    ;(porAnio.get(anio) ?? porAnio.set(anio, []).get(anio)!).push(ap)
  }
  const archivos: ArchivoExportado[] = []
  for (const [anio, lista] of [...porAnio].sort((a, b) => a[0] - b[0])) {
    if (lista.length > DIARIO.maxApuntes) {
      avisos.push(
        `El ejercicio ${anio} tiene ${lista.length} apuntes (> ${DIARIO.maxApuntes}); ` +
          'la plantilla no los recalculará todos. Divide el ejercicio a mano si es preciso.',
      )
    }
    const bytes = await escribirLibro(plantilla, { ...contenido, apuntes: lista.slice(0, DIARIO.maxApuntes) })
    archivos.push({ ejercicio: anio, bytes })
  }
  return { archivos, avisos }
}

/** Escribe un único libro XLSX (≤ 100 apuntes) sobre una copia fresca de la plantilla. */
async function escribirLibro(
  plantilla: ArrayBuffer | Uint8Array,
  contenido: ContenidoLibro,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(plantilla as ArrayBuffer)

  escribirDiario(wb, contenido.apuntes)
  escribirUbicaciones(wb, contenido.ubicaciones)
  if (contenido.tolerancias) escribirTolerancias(wb, contenido.tolerancias)

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

/** Vuelca los apuntes en DIARIO (filas 3..102), tras limpiar las filas de ejemplo. */
function escribirDiario(wb: ExcelJS.Workbook, apuntes: readonly Apunte[]): void {
  const ws = wb.getWorksheet(HOJAS.diario)
  if (!ws) throw new Error(`La plantilla no tiene la hoja «${HOJAS.diario}».`)
  const c = DIARIO.col
  const fila1 = DIARIO.filaDatos1

  // Limpia todas las filas de datos (A..P), incluidas las de ejemplo de la plantilla.
  for (let r = fila1; r < fila1 + DIARIO.maxApuntes; r++) {
    for (let col = c.id + 1; col <= c.sentido + 1; col++) {
      ws.getCell(r, col).value = null
    }
  }

  // Rótulos de las dos columnas que la plantilla oficial no trae (art. 37.1.h): la app las
  // añade para no perder los dos valores de mercado al exportar. Ver plantilla-layout.
  ws.getCell(1, c.valorMercadoEntregadoEUR + 1).value = DIARIO.rotulosAmpliacion.fila1
  ws.getCell(2, c.valorMercadoEntregadoEUR + 1).value = DIARIO.rotulosAmpliacion.entregado
  ws.getCell(2, c.valorMercadoRecibidoEUR + 1).value = DIARIO.rotulosAmpliacion.recibido
  ws.getCell(1, c.sentido + 1).value = DIARIO.rotulosAmpliacion.sentidoFila1
  ws.getCell(2, c.sentido + 1).value = DIARIO.rotulosAmpliacion.sentido

  apuntes.forEach((ap, i) => {
    const r = fila1 + i
    const set = (col0: number, valor: string | number | undefined | null) => {
      if (valor !== undefined && valor !== null && valor !== '') ws.getCell(r, col0 + 1).value = valor
    }
    set(c.id, ap.id)
    const fecha = ws.getCell(r, c.fechaHora + 1)
    fecha.value = isoASerialExcel(ap.fechaHora)
    fecha.numFmt = FMT_FECHA
    set(c.tipo, etiquetaDesdeTipo(ap.tipo))
    set(c.ubicacionOrigen, ap.ubicacionOrigen)
    set(c.ubicacionDestino, ap.ubicacionDestino)
    set(c.activoSalida, ap.activoSalida)
    set(c.cantidadSalida, num(ap.cantidadSalida))
    set(c.activoEntrada, ap.activoEntrada)
    set(c.cantidadEntrada, num(ap.cantidadEntrada))
    set(c.comisionCantidad, num(ap.comisionCantidad))
    set(c.comisionActivo, ap.comisionActivo)
    set(c.contravalorEUR, num(ap.contravalorEUR))
    set(c.valorMercadoEntregadoEUR, num(ap.valorMercadoEntregadoEUR))
    set(c.valorMercadoRecibidoEUR, num(ap.valorMercadoRecibidoEUR))
    set(c.sentido, ap.sentido)
    set(c.justificante, ap.justificante)
    set(c.notas, ap.notas)
  })
}

/** Vuelca las ubicaciones en UBICACIONES (filas 4..33, columnas A..F; NO toca la col. H). */
function escribirUbicaciones(wb: ExcelJS.Workbook, ubicaciones: readonly Ubicacion[]): void {
  const ws = wb.getWorksheet(HOJAS.ubicaciones)
  if (!ws) throw new Error(`La plantilla no tiene la hoja «${HOJAS.ubicaciones}».`)
  const c = UBICACIONES.col
  const fila1 = UBICACIONES.filaDatos1

  // Limpia solo A..F (la columna H es la lista desplegable auxiliar de la plantilla).
  for (let r = fila1; r < fila1 + UBICACIONES.maxFilas; r++) {
    for (let col = c.nombre + 1; col <= c.notas + 1; col++) ws.getCell(r, col).value = null
  }

  const reales = ubicaciones.filter((u) => u.id !== UBICACION_EXTERIOR).slice(0, UBICACIONES.maxFilas)
  reales.forEach((u, i) => {
    const r = fila1 + i
    ws.getCell(r, c.nombre + 1).value = u.nombre
    ws.getCell(r, c.tipo + 1).value = u.tipo
    ws.getCell(r, c.kyc + 1).value = boolASiNo(u.kyc)
    const alta = ws.getCell(r, c.fechaAlta + 1)
    alta.value = isoASerialExcel(u.fechaAlta)
    alta.numFmt = 'dd/mm/yyyy'
    if (u.fechaCierre) {
      const cierre = ws.getCell(r, c.fechaCierre + 1)
      cierre.value = isoASerialExcel(u.fechaCierre)
      cierre.numFmt = 'dd/mm/yyyy'
    }
    if (u.notas) ws.getCell(r, c.notas + 1).value = u.notas
  })
}

/** Escribe las tolerancias del cuadre (B32 verde, B33 ámbar) que alimentan la hoja CUADRE. */
function escribirTolerancias(wb: ExcelJS.Workbook, tol: Tolerancias): void {
  const ws = wb.getWorksheet(HOJAS.parametros)
  if (!ws) return
  ws.getCell(PARAMETROS.celdaToleranciaVerde).value = tol.verde
  ws.getCell(PARAMETROS.celdaToleranciaAmbar).value = tol.ambar
}

/** Nombre de fichero sugerido para un archivo exportado. */
export function nombreFicheroXlsx(ejercicio: number | null): string {
  return ejercicio === null ? 'libro-hesperides.xlsx' : `libro-hesperides-${ejercicio}.xlsx`
}

/** Referencia a la marca de ejemplo (documenta que se limpia al exportar). */
export const _MARCA_EJEMPLO_LIMPIADA = MARCA_EJEMPLO
