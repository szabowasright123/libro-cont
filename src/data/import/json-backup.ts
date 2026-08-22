/**
 * json-backup.ts — copia nativa versionada del Libro en JSON (P4, punto 4).
 *
 * Formato PROPIO (no la plantilla): captura íntegra del Libro para copia de seguridad y
 * restauración sin pérdida. Versionado para poder migrar formatos antiguos. Incluye los
 * justificantes del Archivo (con su fichero embebido en base64 si lo hay) y los saldos
 * reales declarados del cuadre.
 *
 * Módulo PURO (serializar/parsear cadenas): la conversión Blob↔base64 y el volcado a
 * IndexedDB viven en la capa de datos/UI (browser). Aquí solo estructura JSON-segura.
 */

import type {
  Activo,
  Apunte,
  Posicion,
  RefUbicacion,
  SimboloActivo,
  Tolerancias,
  Ubicacion,
} from '../../engine/types'
import type { CierreRegistro } from '../tipos'

/** Marca de formato y versión del snapshot (para validar y migrar). */
export const FORMATO_SNAPSHOT = 'libro-hesperides' as const
export const VERSION_SNAPSHOT = 1 as const

/** Justificante en forma JSON-segura (el Blob va como base64 en `ficheroBase64`). */
export interface JustificanteSerializable {
  id: string
  apunteId: string
  rutaConvencional: string
  tipoDocumento: string
  hashSHA256?: string
  /** Contenido del fichero embebido, en base64 (opcional). */
  ficheroBase64?: string
  /** Tipo MIME del fichero embebido (para reconstruir el Blob). */
  ficheroMime?: string
  referenciaExterna?: string
  notas?: string
}

/** Saldo real declarado por el alumno para el cuadre (por ubicación × activo). */
export interface SaldoRealDeclarado {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  saldoReal: string
  notas?: string
}

/** Snapshot completo del Libro (JSON-seguro, sin Blobs ni tipos del browser). */
export interface SnapshotLibro {
  formato: typeof FORMATO_SNAPSHOT
  version: number
  /** Fecha de exportación (ISO). La aporta la capa de UI; opcional para no romper la pureza. */
  exportadoEn?: string
  apuntes: Apunte[]
  ubicaciones: Ubicacion[]
  activos: Activo[]
  tolerancias: Tolerancias
  justificantes: JustificanteSerializable[]
  /** Saldos reales del cuadre (declarados por el alumno). */
  cuadreReal: SaldoRealDeclarado[]
  /**
   * Posiciones DeFi (D1). Opcional en el tipo para que las copias v1 —anteriores a los
   * eventos DeFi— sigan restaurándose sin tocarlas; `migrar` la normaliza a [].
   */
  posiciones?: Posicion[]
  /**
   * Cierres del ejercicio (v1.6.0): checklist del Anexo D con la razón escrita de cada «no
   * aplica», memoria del ejercicio, conciliación a tres columnas y cotizaciones de cierre.
   * Opcional por la misma razón que `posiciones`: las copias anteriores no lo traen y se
   * restauran igual; `migrar` lo normaliza a [].
   */
  cierres?: CierreRegistro[]
}

/** Datos mínimos para construir un snapshot (los opcionales se rellenan por defecto). */
export interface EntradaSnapshot {
  apuntes: Apunte[]
  ubicaciones: Ubicacion[]
  activos: Activo[]
  tolerancias: Tolerancias
  justificantes?: JustificanteSerializable[]
  cuadreReal?: SaldoRealDeclarado[]
  posiciones?: Posicion[]
  cierres?: CierreRegistro[]
  exportadoEn?: string
}

/** Construye un snapshot versionado a partir de los datos del Libro. */
export function construirSnapshot(datos: EntradaSnapshot): SnapshotLibro {
  return {
    formato: FORMATO_SNAPSHOT,
    version: VERSION_SNAPSHOT,
    ...(datos.exportadoEn ? { exportadoEn: datos.exportadoEn } : {}),
    apuntes: datos.apuntes,
    ubicaciones: datos.ubicaciones,
    activos: datos.activos,
    tolerancias: datos.tolerancias,
    justificantes: datos.justificantes ?? [],
    cuadreReal: datos.cuadreReal ?? [],
    posiciones: datos.posiciones ?? [],
    cierres: datos.cierres ?? [],
  }
}

/** Serializa un snapshot a texto JSON (con sangría, para que sea legible/diffable). */
export function serializarSnapshot(snapshot: SnapshotLibro): string {
  return JSON.stringify(snapshot, null, 2)
}

/** Atajo: construye y serializa en un solo paso. */
export function exportarJson(datos: EntradaSnapshot): string {
  return serializarSnapshot(construirSnapshot(datos))
}

/** Error de restauración con mensaje legible para el alumno. */
export class ErrorRestauracion extends Error {}

/**
 * Parsea y valida un snapshot JSON. Comprueba el formato y la versión; rellena arrays
 * opcionales ausentes. Lanza `ErrorRestauracion` con un mensaje claro si el fichero no
 * es una copia válida del Libro o su versión es más nueva que la soportada.
 */
export function parsearSnapshot(texto: string): SnapshotLibro {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    throw new ErrorRestauracion('El fichero no es un JSON válido.')
  }
  if (typeof bruto !== 'object' || bruto === null) {
    throw new ErrorRestauracion('El fichero no contiene una copia del Libro.')
  }
  const o = bruto as Record<string, unknown>
  if (o.formato !== FORMATO_SNAPSHOT) {
    throw new ErrorRestauracion('El fichero no es una copia del Libro Hespérides.')
  }
  const version = typeof o.version === 'number' ? o.version : 0
  if (version > VERSION_SNAPSHOT) {
    throw new ErrorRestauracion(
      `La copia es de una versión más nueva (v${version}) que esta app (v${VERSION_SNAPSHOT}). ` +
        'Actualiza la aplicación para restaurarla.',
    )
  }

  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : [])
  const apuntes = arr<Apunte>(o.apuntes)
  const ubicaciones = arr<Ubicacion>(o.ubicaciones)
  const activos = arr<Activo>(o.activos)
  if (apuntes.length === 0 && ubicaciones.length === 0 && activos.length === 0) {
    // Un snapshot totalmente vacío es válido (Libro nuevo), pero avisamos por estructura
    // mínima: al menos debe traer tolerancias bien formadas.
  }
  const tol = o.tolerancias as Partial<Tolerancias> | undefined
  const tolerancias: Tolerancias = {
    verde: typeof tol?.verde === 'number' ? tol.verde : 1e-8,
    ambar: typeof tol?.ambar === 'number' ? tol.ambar : 1e-3,
  }

  return migrar({
    formato: FORMATO_SNAPSHOT,
    version,
    ...(typeof o.exportadoEn === 'string' ? { exportadoEn: o.exportadoEn } : {}),
    apuntes,
    ubicaciones,
    activos,
    tolerancias,
    justificantes: arr<JustificanteSerializable>(o.justificantes),
    cuadreReal: arr<SaldoRealDeclarado>(o.cuadreReal),
    posiciones: arr<Posicion>(o.posiciones),
    cierres: arr<CierreRegistro>(o.cierres),
  })
}

/**
 * Migra un snapshot de una versión anterior a la actual. Hoy solo existe la v1, así que
 * es la identidad salvo el sello de versión; el punto de extensión queda listo.
 */
function migrar(snapshot: SnapshotLibro): SnapshotLibro {
  // if (snapshot.version < 2) { …transformaciones v1→v2… }
  return { ...snapshot, version: VERSION_SNAPSHOT }
}
