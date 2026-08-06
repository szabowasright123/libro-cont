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
}

/** Borrador de apunte que produce el formulario (sin uid/id/creadoEn todavía). */
export type BorradorApunte = Omit<Apunte, 'id' | 'rectificaA'> & {
  rectificaAUid?: string
}

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
}
