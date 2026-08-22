/**
 * tipos.ts — tipos de la capa de PERSISTENCIA (no del dominio de cálculo).
 *
 * El motor (`src/engine`) trabaja con el tipo `Apunte`, cuya clave `id` es el
 * correlativo AAAA-NNN. Ese correlativo NO es estable: al insertar un apunte con
 * fecha anterior, el diario se reordena y todos los `id` posteriores cambian
 * (Regla del enunciado P2: «reordena y renumera con aviso»).
 *
 * Para que las referencias entre apuntes (p. ej. AJUSTE → apunte rectificado)
 * sobrevivan a la renumeración, cada registro almacenado lleva un `uid` estable
 * (UUID) que es la clave primaria real en IndexedDB. El correlativo `id` es un
 * campo derivado e indexado que el repositorio recalcula en cada escritura.
 *
 * Frontera limpia: hacia el motor se exponen siempre `Apunte` de dominio (con el
 * correlativo como `id` y `rectificaA` resuelto a correlativo). El `uid` no cruza
 * esa frontera.
 */
import type { Apunte, Justificante } from '../engine/types'
import type {
  CotizacionesCierre,
  FilaTresColumnas,
  MarcasCierre,
  MemoriaEjercicio,
} from '../engine/cierre'
import type { SaldoRealDeclarado } from './import/json-backup'

/**
 * Registro de apunte tal y como se guarda en IndexedDB.
 *  - `uid`: clave primaria estable (UUID). Nunca se muestra al alumno.
 *  - `id`: correlativo AAAA-NNN derivado del orden cronológico (indexado).
 *  - `rectificaAUid`: referencia ESTABLE (por `uid`) al apunte rectificado en un
 *    AJUSTE. Se resuelve a correlativo al exponer el dominio.
 *  - `creadoEn`: marca de creación, usada solo como desempate determinista cuando
 *    dos apuntes comparten `fechaHora`.
 */
export type ApunteRegistro = Omit<Apunte, 'id' | 'rectificaA'> & {
  uid: string
  id: string
  rectificaAUid?: string
  creadoEn: string
  subtipoPerdida?: SubtipoPerdida
}

/** Borrador de apunte que produce el formulario (sin uid/id/creadoEn todavía). */
export type BorradorApunte = Omit<Apunte, 'id' | 'rectificaA'> & {
  rectificaAUid?: string
  subtipoPerdida?: SubtipoPerdida
}

/**
 * Subtipo de una PÉRDIDA (derivada D2, P9.4). Es un campo de la CAPA DE DATOS, NO del motor:
 * determina el aviso de criterio fiscal y el checklist probatorio que se muestran, pero no
 * altera ningún cálculo (saldos, FIFO ni cuadre). `sin-clasificar` es el valor de los apuntes
 * PÉRDIDA anteriores a esta versión (migración v7) y de los nuevos hasta que el alumno elige.
 */
export type SubtipoPerdida = 'error' | 'robo' | 'estafa' | 'sin-clasificar'

/**
 * Registro de justificante tal y como se guarda en IndexedDB.
 *
 * El dominio (`Justificante`, en el motor) enlaza con el apunte por su correlativo
 * `apunteId` (AAAA-NNN). Pero ese correlativo NO es estable (se renumera al reordenar el
 * diario), así que en almacenamiento se enlaza por `apunteUid` (el uid ESTABLE del
 * apunte), exactamente igual que `rectificaAUid`. La frontera hacia el motor resuelve
 * `apunteUid` → correlativo (repositorio.justificantesADominio).
 */
export type JustificanteRegistro = Omit<Justificante, 'apunteId'> & {
  apunteUid: string
}

/** Clave del registro singleton de parámetros (tolerancias) en IndexedDB. */
export const CLAVE_PARAMETROS = 'unico' as const

/** Registro singleton de parámetros configurables (tolerancias del cuadre). */
export interface ParametrosRegistro {
  clave: typeof CLAVE_PARAMETROS
  toleranciaVerde: number
  toleranciaAmbar: number
  /**
   * Saldos reales declarados para el cuadre. Se guardan aquí (en el singleton de
   * parámetros) hasta que la fase del CUADRE tenga su propia tabla; así la copia JSON
   * los conserva sin pérdida (P4, punto 4). No indexado: es un campo de datos.
   */
  cuadreReal?: SaldoRealDeclarado[]
  /**
   * Marca de que el Libro contiene el CASO DE EJEMPLO (P9.3). Permite avisar en Inicio de
   * que se está viendo la demo y ofrecer su borrado limpio en Ajustes.
   */
  demoCargada?: boolean
  /**
   * Marca de la última COPIA DE SEGURIDAD JSON descargada (P11): fecha ISO y nº de apuntes
   * que contenía. Alimenta el recordatorio suave de copia (src/data/copias.ts). Sin marca,
   * nunca se descargó una copia desde este navegador.
   */
  ultimaCopiaEn?: string
  apuntesEnUltimaCopia?: number
}

/**
 * Registro de un PRECIO MANUAL de un activo (pestaña Cartera, P9.2). Local-first: lo teclea
 * el alumno; NUNCA se obtiene por red. EUR no tiene precio (vale 1 implícitamente).
 *  - `activo`: símbolo (clave primaria).
 *  - `precioEur`: precio en EUR por unidad, como cadena decimal interna (punto).
 *  - `fechaISO`: fecha en que se introdujo el precio (para el chip «introducidos el …»).
 */
export interface PrecioRegistro {
  activo: string
  precioEur: string
  fechaISO: string
}

/**
 * Registro del CIERRE de un ejercicio (v1.6.0, pantalla de Cierre). Un registro por año,
 * con `ejercicio` de clave primaria.
 *
 * Es todo contenido del ALUMNO, no de cálculo: el motor (`engine/cierre.ts`) lo recibe como
 * entrada y lo evalúa contra lo que el Libro dice. Guarda las casillas marcadas del
 * checklist del Anexo D —con la razón escrita de cada «no aplica», que es lo que separa
 * «no lo hice» de «decidí no hacerlo, y aquí está por qué»—, la memoria del ejercicio, la
 * conciliación a tres columnas de marzo y las cotizaciones de cierre con su fuente.
 *
 * Vive en IndexedDB, y no en `localStorage`, para que viaje en la copia de seguridad JSON.
 */
export interface CierreRegistro {
  /** Año del ejercicio. Clave primaria. */
  ejercicio: number
  /** Casillas del Anexo D marcadas por el alumno, con su razón cuando es «no aplica». */
  marcas: MarcasCierre
  /** Los cuatro apartados de la memoria del ejercicio. */
  memoria: MemoriaEjercicio
  /** Filas de la conciliación a tres columnas (datos fiscales / registro / explicación). */
  tresColumnas: FilaTresColumnas[]
  /** Cotizaciones de cierre por activo, con su fuente. */
  cotizaciones: CotizacionesCierre
  /** Última escritura (ISO local), para el pie del informe de cierre. */
  actualizadoEn?: string
}
