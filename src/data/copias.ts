/**
 * copias.ts — recordatorio suave de COPIA DE SEGURIDAD (P11, protección del alumno).
 *
 * IndexedDB puede ser purgada por el navegador si el disco va justo; el alumno puede perder
 * meses de registro sin haber hecho nada mal. Este módulo decide, de forma PURA y testeable,
 * cuándo conviene recordarle que descargue su copia JSON. La marca de la última copia vive en
 * el singleton de parámetros (repositorio.registrarCopiaRealizada / estadoCopia).
 *
 * Criterios (deliberadamente conservadores, para no dar la lata):
 *  · NUNCA hubo copia y el Libro ya tiene ≥ 10 apuntes  → recordar («nunca»).
 *  · Han entrado ≥ 20 apuntes desde la última copia     → recordar («apuntes-nuevos»).
 *  · Han pasado ≥ 30 días desde la última copia Y el nº de apuntes ha cambiado
 *    (si nada cambió, no hay nada nuevo que perder)      → recordar («antiguedad»).
 *
 * La UI añade su propio criterio: el recordatorio NO se muestra mientras está cargado el caso
 * de ejemplo (son datos de demostración, no del alumno) y puede descartarse por sesión.
 *
 * Módulo puro: sin Dexie, sin React, sin browser APIs (la fecha «ahora» entra por parámetro).
 */

/** Días sin copia (con cambios) a partir de los cuales se recuerda. */
export const DIAS_RECORDATORIO = 30
/** Apuntes nuevos desde la última copia a partir de los cuales se recuerda. */
export const APUNTES_NUEVOS_RECORDATORIO = 20
/** Apuntes mínimos en el Libro para recordar la PRIMERA copia. */
export const APUNTES_MINIMOS_PRIMERA_COPIA = 10

/** Marca persistida de la última copia (del singleton de parámetros). */
export interface MarcaCopia {
  ultimaCopiaEn?: string
  apuntesEnUltimaCopia?: number
}

/** Por qué se recomienda hacer copia ahora. */
export type MotivoRecordatorio = 'nunca' | 'apuntes-nuevos' | 'antiguedad'

/** Resultado de la decisión del recordatorio. */
export interface Recordatorio {
  necesita: boolean
  motivo?: MotivoRecordatorio
  /** Días transcurridos desde la última copia (si la hubo). */
  dias?: number
  /** Apuntes nuevos desde la última copia (si la hubo). */
  apuntesNuevos?: number
}

/** Milisegundos de un día. */
const DIA_MS = 24 * 60 * 60 * 1000

/**
 * Decide si toca recordar la copia de seguridad. Pura y determinista: la fecha actual entra
 * como ISO por parámetro (testeable sin relojes).
 */
export function necesitaRecordatorioCopia(
  marca: MarcaCopia,
  apuntesAhora: number,
  ahoraISO: string,
): Recordatorio {
  // Libro vacío: nada que proteger.
  if (apuntesAhora <= 0) return { necesita: false }

  // Nunca hubo copia: recordar solo cuando ya hay trabajo que perder.
  if (!marca.ultimaCopiaEn) {
    return apuntesAhora >= APUNTES_MINIMOS_PRIMERA_COPIA
      ? { necesita: true, motivo: 'nunca' }
      : { necesita: false }
  }

  const dias = Math.floor(
    (new Date(ahoraISO).getTime() - new Date(marca.ultimaCopiaEn).getTime()) / DIA_MS,
  )
  const apuntesNuevos = Math.max(0, apuntesAhora - (marca.apuntesEnUltimaCopia ?? 0))

  if (apuntesNuevos >= APUNTES_NUEVOS_RECORDATORIO) {
    return { necesita: true, motivo: 'apuntes-nuevos', dias, apuntesNuevos }
  }
  if (dias >= DIAS_RECORDATORIO && apuntesAhora !== (marca.apuntesEnUltimaCopia ?? 0)) {
    return { necesita: true, motivo: 'antiguedad', dias, apuntesNuevos }
  }
  return { necesita: false, dias, apuntesNuevos }
}

/** Texto legible del recordatorio para el banner (es-ES). */
export function textoRecordatorio(r: Recordatorio): string {
  switch (r.motivo) {
    case 'nunca':
      return 'Aún no has descargado ninguna copia de seguridad de tu Libro.'
    case 'apuntes-nuevos':
      return `Llevas ${r.apuntesNuevos} apuntes nuevos desde tu última copia de seguridad.`
    case 'antiguedad':
      return `Tu última copia de seguridad tiene ${r.dias} días y el Libro ha cambiado desde entonces.`
    default:
      return ''
  }
}
