/**
 * db.ts — Persistencia local-first con Dexie (IndexedDB).
 *
 * Local-first estricto (Regla 3): los datos del alumno viven en su navegador y no
 * salen de él salvo export explícito. Cero llamadas de red.
 *
 * Esta capa NO contiene lógica de cálculo (esa vive en src/engine, TS puro). Aquí solo
 * el esquema de almacenamiento y la apertura de la base.
 */
import Dexie, { type Table } from 'dexie'
import type { Activo, Apunte, Justificante, Ubicacion } from '../engine/types'

/** Base de datos local del Libro Hespérides. */
export class LibroDB extends Dexie {
  // Tablas tipadas. La clave primaria de cada una es su `id`/`simbolo`.
  apuntes!: Table<Apunte, string>
  ubicaciones!: Table<Ubicacion, string>
  justificantes!: Table<Justificante, string>
  activos!: Table<Activo, string>

  constructor() {
    super('libro-hesperides')
    // Esquema v1. Solo se indexan los campos por los que se consulta/ordena.
    this.version(1).stores({
      // id correlativo; fechaHora para orden cronológico (FIFO); tipo para filtros.
      apuntes: 'id, fechaHora, tipo',
      ubicaciones: 'id, nombre, kyc',
      justificantes: 'id, apunteId, rutaConvencional',
      activos: 'simbolo',
    })
  }
}

/** Instancia única de la base de datos para toda la app. */
export const db = new LibroDB()

/**
 * Abre la base de datos local y devuelve un resumen de estado. La usa la página de
 * inicio para confirmar que IndexedDB está operativo en este navegador.
 */
export async function abrirBaseDatos(): Promise<{ nombre: string; version: number }> {
  await db.open()
  return { nombre: db.name, version: db.verno }
}
