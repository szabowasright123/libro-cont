/**
 * persistencia.ts — lo que el alumno marca y escribe en el CIERRE, guardado en su Libro.
 *
 * El cierre del ejercicio produce datos del alumno de primera clase: la memoria del
 * ejercicio, la razón escrita de cada «no aplica», la conciliación a tres columnas de marzo
 * y las cotizaciones de cierre con su fuente. El manual es explícito sobre cuál de ellos
 * pesa más: «La memoria del ejercicio es la casilla que más rinde. […] es el documento que
 * un asesor, un heredero o el propio contribuyente dentro de cinco años leerá antes que
 * ninguna otra cosa» ([MT] Anexo D).
 *
 * Por eso vive en **IndexedDB** (tabla `cierres`, esquema v10), junto al resto del Libro, y
 * no en `localStorage`: así viaja en la copia de seguridad JSON como viajan los saldos
 * reales del cuadre. Una memoria que no está en la copia es una memoria que se pierde el
 * día que el alumno cambia de ordenador, que es justo el día en que hacía falta.
 *
 * Una versión intermedia de esta pantalla llegó a guardarla en `localStorage`;
 * `migrarDesdeLocalStorage` recoge lo que hubiera quedado allí y lo sube a la tabla, una
 * vez y sin pérdida.
 */
import type {
  CotizacionesCierre,
  FilaTresColumnas,
  MarcasCierre,
  MemoriaEjercicio,
} from '../../engine/cierre'
import type { CierreRegistro } from '../../data/tipos'
import { obtenerCierre, guardarCierre as guardarCierreEnDb } from '../../data/repositorio'

/** Lo que se guarda de un ejercicio. Es exactamente el registro Dexie `cierres`. */
export interface CierreGuardado {
  ejercicio: number
  marcas: MarcasCierre
  memoria: MemoriaEjercicio
  tresColumnas: FilaTresColumnas[]
  cotizaciones: CotizacionesCierre
  /** Última escritura (ISO local), para el pie del informe. Lo sella el repositorio. */
  actualizadoEn?: string
}

/** Estado inicial de un ejercicio sin nada guardado. */
export function cierreVacio(ejercicio: number): CierreGuardado {
  return { ejercicio, marcas: {}, memoria: {}, tresColumnas: [], cotizaciones: {} }
}

/** Normaliza un registro leído (de la tabla o de una copia antigua) al estado de trabajo. */
function normalizar(ejercicio: number, datos: Partial<CierreGuardado>): CierreGuardado {
  return {
    ejercicio,
    marcas: datos.marcas ?? {},
    memoria: datos.memoria ?? {},
    tresColumnas: Array.isArray(datos.tresColumnas) ? datos.tresColumnas : [],
    cotizaciones: datos.cotizaciones ?? {},
    ...(datos.actualizadoEn ? { actualizadoEn: datos.actualizadoEn } : {}),
  }
}

/** El estado de trabajo, tal cual, es el registro que guarda la tabla. */
function aRegistro(estado: CierreGuardado): CierreRegistro {
  return {
    ejercicio: estado.ejercicio,
    marcas: estado.marcas,
    memoria: estado.memoria,
    tresColumnas: estado.tresColumnas,
    cotizaciones: estado.cotizaciones,
  }
}

// ── Restos de la versión que guardaba en localStorage ────────────────────────

/** Prefijo de las claves que usó la primera versión de esta pantalla. */
const PREFIJO_LEGADO = 'hesperides.cierre'

function claveLegado(ejercicio: number): string {
  return `${PREFIJO_LEGADO}.${ejercicio}`
}

/**
 * Sube a la tabla lo que quedara en `localStorage` de este ejercicio y borra la clave.
 * Solo actúa si la tabla NO tiene todavía registro del año: lo guardado en el Libro manda
 * sobre cualquier resto de la versión anterior. Nunca lanza.
 */
async function migrarDesdeLocalStorage(ejercicio: number): Promise<CierreGuardado | null> {
  try {
    const crudo = localStorage.getItem(claveLegado(ejercicio))
    if (!crudo) return null
    const estado = normalizar(ejercicio, JSON.parse(crudo) as Partial<CierreGuardado>)
    await guardarCierreEnDb(aRegistro(estado))
    localStorage.removeItem(claveLegado(ejercicio))
    return estado
  } catch {
    return null
  }
}

// ── API de la pantalla ───────────────────────────────────────────────────────

/**
 * Lee el cierre guardado de un ejercicio. Nunca lanza: si la base no está disponible
 * devuelve el estado vacío, que es un comienzo válido.
 */
export async function leerCierre(ejercicio: number): Promise<CierreGuardado> {
  try {
    const registro = await obtenerCierre(ejercicio)
    if (registro) return normalizar(ejercicio, registro as Partial<CierreGuardado>)
    return (await migrarDesdeLocalStorage(ejercicio)) ?? cierreVacio(ejercicio)
  } catch {
    return cierreVacio(ejercicio)
  }
}

/**
 * Guarda el cierre de un ejercicio. Devuelve `false` si la base no dejó escribir, para que
 * la pantalla pueda avisar en lugar de mentir al alumno diciéndole que su memoria está a
 * salvo. El sello de hora lo pone el repositorio, en hora local.
 */
export async function guardarCierre(estado: CierreGuardado): Promise<boolean> {
  try {
    await guardarCierreEnDb(aRegistro(estado))
    return true
  } catch {
    return false
  }
}
