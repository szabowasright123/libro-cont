/**
 * numeracion.ts — orden cronológico y numeración correlativa AAAA-NNN (pura).
 *
 * Regla del enunciado P2: la numeración es automática por año y, si una fecha
 * nueva rompe el orden, el diario se reordena y renumera «con aviso». Aquí vive
 * esa lógica como funciones deterministas (sin Dexie, sin React) para poder
 * testearla en aislamiento; el repositorio la aplica en cada escritura.
 *
 * NNN es un correlativo POR AÑO (2024-001, 2024-002, …, 2025-001, …), reiniciado
 * cada ejercicio, tal como los `id` del mini-caso (2024-001..2024-019).
 */

/** Mínimo que necesita la numeración de cada registro. */
export interface Numerable {
  uid: string
  fechaHora: string
  /** Desempate estable cuando dos apuntes comparten `fechaHora`. */
  creadoEn: string
}

/** Cambio de correlativo tras una renumeración (para el aviso al alumno). */
export interface CambioNumero {
  uid: string
  idAnterior: string
  idNuevo: string
}

/** Año (AAAA) de una fecha ISO. */
function anio(fechaHora: string): number {
  return new Date(fechaHora).getFullYear()
}

/** Empareja la parte NNN a 3 dígitos como mínimo (001, 012, 123, 1234). */
function pad(n: number): string {
  return String(n).padStart(3, '0')
}

/**
 * Ordena cronológicamente (fechaHora ascendente). Desempate determinista:
 * a igual fechaHora, por `creadoEn` y, en último extremo, por `uid`. No muta la
 * entrada: devuelve una copia ordenada.
 */
export function ordenarCronologico<T extends Numerable>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.fechaHora).getTime()
    const tb = new Date(b.fechaHora).getTime()
    if (ta !== tb) return ta - tb
    if (a.creadoEn !== b.creadoEn) return a.creadoEn < b.creadoEn ? -1 : 1
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0
  })
}

/**
 * Asigna el correlativo AAAA-NNN a una lista YA ordenada cronológicamente.
 * Devuelve un mapa uid → correlativo. NNN se reinicia en cada año.
 */
export function asignarCorrelativos<T extends Numerable>(
  ordenados: readonly T[],
): Map<string, string> {
  const contadorPorAnio = new Map<number, number>()
  const salida = new Map<string, string>()
  for (const it of ordenados) {
    const a = anio(it.fechaHora)
    const n = (contadorPorAnio.get(a) ?? 0) + 1
    contadorPorAnio.set(a, n)
    salida.set(it.uid, `${a}-${pad(n)}`)
  }
  return salida
}

/**
 * Renumera un conjunto de registros: los ordena y asigna correlativos.
 * Devuelve los registros con su `id` recalculado (orden cronológico) y la lista
 * de cambios respecto a los `id` previos (vacía si nada cambió).
 */
export function renumerar<T extends Numerable & { id: string }>(
  items: readonly T[],
): { ordenados: T[]; cambios: CambioNumero[] } {
  const ordenados = ordenarCronologico(items)
  const correlativos = asignarCorrelativos(ordenados)
  const cambios: CambioNumero[] = []
  const conId = ordenados.map((it) => {
    const idNuevo = correlativos.get(it.uid)!
    if (it.id !== idNuevo) {
      cambios.push({ uid: it.uid, idAnterior: it.id, idNuevo })
    }
    return { ...it, id: idNuevo }
  })
  return { ordenados: conId, cambios }
}

/**
 * ¿Insertar/mover un apunte a `fechaHora` rompería el orden cronológico actual?
 * (es decir, ¿existe algún apunte con fecha POSTERIOR, de modo que el nuevo no
 * quedaría al final?). Sirve para avisar de que habrá reordenación/renumeración.
 * `uidExcluido` permite ignorar el propio apunte al editarlo.
 */
export function rompeOrden(
  existentes: readonly Numerable[],
  fechaHora: string,
  uidExcluido?: string,
): boolean {
  const t = new Date(fechaHora).getTime()
  return existentes.some(
    (e) => e.uid !== uidExcluido && new Date(e.fechaHora).getTime() > t,
  )
}
