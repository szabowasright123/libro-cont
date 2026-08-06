/**
 * plantilla-layout.ts — mapa de la PLANTILLA_TALLER.xlsx (P4).
 *
 * Constantes de posición (hojas, columnas, filas) que comparten el importador (SheetJS)
 * y el exportador (exceljs). Fuente: docs/reference/PLANTILLA_TALLER.xlsx, verificada
 * celda a celda. Cualquier cambio de la plantilla oficial debe reflejarse aquí.
 *
 * Convención de columnas: índice 0-based (A=0, B=1, …) para SheetJS; el exportador usa
 * la letra (exceljs indexa columnas desde 1, con notación de celda «A3»).
 */

/** Nombres exactos de las hojas (con acentos). Las calculadas se ignoran al importar. */
export const HOJAS = {
  diario: 'DIARIO',
  ubicaciones: 'UBICACIONES',
  parametros: 'PARÁMETROS',
} as const

/** Marca de las filas de ejemplo de la plantilla oficial. */
export const MARCA_EJEMPLO = 'EJEMPLO — borrar'

/**
 * DIARIO: los datos empiezan en la fila 3 (1-based) y las fórmulas de SALDOS/FIFO
 * abarcan hasta la fila 102 → máximo 100 apuntes. Columnas (0-based):
 */
export const DIARIO = {
  filaDatos1: 3, // primera fila de datos (1-based)
  maxApuntes: 100,
  col: {
    id: 0, // A · Nº (AAAA-NNN)
    fechaHora: 1, // B · Fecha y hora (serial de Excel)
    tipo: 2, // C · Tipo (etiqueta con acentos)
    ubicacionOrigen: 3, // D
    ubicacionDestino: 4, // E
    activoSalida: 5, // F
    cantidadSalida: 6, // G
    activoEntrada: 7, // H
    cantidadEntrada: 8, // I
    comisionCantidad: 9, // J
    comisionActivo: 10, // K
    contravalorEUR: 11, // L
    justificante: 12, // M
    notas: 13, // N · Notas / rectifica a (aquí va la marca de ejemplo)
  },
} as const

/**
 * UBICACIONES: cabecera en la fila 3, datos desde la fila 4. La columna H es la lista
 * desplegable auxiliar de la plantilla (NO tocar al exportar). Columnas (0-based):
 */
export const UBICACIONES = {
  filaDatos1: 4,
  maxFilas: 30, // filas 4..33 en la plantilla
  col: {
    nombre: 0, // A
    tipo: 1, // B (exchange / wallet / canal)
    kyc: 2, // C (sí / no)
    fechaAlta: 3, // D (serial de Excel)
    fechaCierre: 4, // E
    notas: 5, // F (aquí va la marca de ejemplo)
  },
} as const

/**
 * PARÁMETROS: el catálogo de tipos (filas 5..15) es CERRADO y de solo lectura. Las
 * tolerancias del cuadre viven en celdas fijas (1-based):
 */
export const PARAMETROS = {
  celdaToleranciaVerde: 'B32',
  celdaToleranciaAmbar: 'B33',
} as const
