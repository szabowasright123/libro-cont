/**
 * db.ts — Persistencia local-first con Dexie (IndexedDB).
 *
 * Local-first estricto (Regla 3): los datos del alumno viven en su navegador y no
 * salen de él salvo export explícito. Cero llamadas de red.
 *
 * Esta capa NO contiene lógica de cálculo (esa vive en src/engine, TS puro) ni la
 * numeración/reordenación (src/data/numeracion.ts, pura). Aquí solo el esquema de
 * almacenamiento, sus migraciones versionadas y la apertura+siembra de la base.
 *
 * Los componentes NUNCA tocan Dexie directamente: usan el repositorio fino tipado
 * (src/data/repositorio.ts).
 */
import Dexie, { type Table } from 'dexie'
import type { Activo, Ubicacion } from '../engine/types'
import { ACTIVOS_BASE, TOLERANCIAS_POR_DEFECTO } from '../engine/types'
import {
  type ApunteRegistro,
  type JustificanteRegistro,
  type ParametrosRegistro,
  CLAVE_PARAMETROS,
} from './tipos'

/** Base de datos local del Libro Hespérides. */
export class LibroDB extends Dexie {
  // Tablas tipadas. Clave primaria: apuntes por `uid` estable; el correlativo `id`
  // es un índice secundario (único) recalculado en cada escritura por el repo.
  apuntes!: Table<ApunteRegistro, string>
  ubicaciones!: Table<Ubicacion, string>
  justificantes!: Table<JustificanteRegistro, string>
  activos!: Table<Activo, string>
  parametros!: Table<ParametrosRegistro, string>

  constructor() {
    super('libro-hesperides')

    // ── Esquema v1 (P0): apuntes con `id` como clave primaria. ──────────────
    this.version(1).stores({
      apuntes: 'id, fechaHora, tipo',
      ubicaciones: 'id, nombre, kyc',
      justificantes: 'id, apunteId, rutaConvencional',
      activos: 'simbolo',
    })

    // ── Esquema v2 (P2): clave primaria estable `uid`; nueva tabla `parametros`.
    this.version(2)
      .stores({
        apuntes: 'uid, &id, fechaHora, tipo, activoEntrada, activoSalida',
        ubicaciones: 'id, nombre, kyc',
        justificantes: 'id, apunteId, rutaConvencional',
        activos: 'simbolo',
        parametros: 'clave',
      })
      .upgrade(async (tx) => {
        // Migración de apuntes v1 → v2: dotar de `uid` y `creadoEn` a lo existente.
        const previos = await tx.table('apuntes').toArray()
        await tx.table('apuntes').clear()
        const conUid = previos.map((ap, i) => ({
          ...ap,
          uid: cryptoRandomId(),
          // Orden de creación estable a partir del índice previo (desempate).
          creadoEn: new Date(0).toISOString().replace(/Z$/, `${String(i).padStart(6, '0')}Z`),
        }))
        if (conUid.length > 0) await tx.table('apuntes').bulkAdd(conUid)
      })

    // ── Esquema v3 (P2): el correlativo `id` deja de ser índice ÚNICO. Su unicidad
    //    la garantiza la renumeración (numeracion.ts), no la base. El índice único
    //    rompía la reordenación: al renumerar, un `bulkPut` mantiene transitoriamente
    //    dos apuntes con el mismo `id` mientras intercambian correlativos.
    this.version(3).stores({
      apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida',
      ubicaciones: 'id, nombre, kyc',
      justificantes: 'id, apunteId, rutaConvencional',
      activos: 'simbolo',
      parametros: 'clave',
    })

    // ── Esquema v4 (P5): el Archivo enlaza justificantes por `apunteUid` ESTABLE (no por
    //    el correlativo `apunteId`, que se renumera al reordenar y rompería el enlace,
    //    igual que `rectificaAUid` en los apuntes). Se reindexa por `apunteUid`.
    this.version(4)
      .stores({
        apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida',
        ubicaciones: 'id, nombre, kyc',
        justificantes: 'id, apunteUid, rutaConvencional',
        activos: 'simbolo',
        parametros: 'clave',
      })
      .upgrade(async (tx) => {
        // Traduce el `apunteId` (correlativo) de cada justificante previo a `apunteUid`
        // (estable) usando el mapa correlativo→uid de los apuntes existentes.
        const apuntes = await tx.table('apuntes').toArray()
        const uidPorId = new Map<string, string>(apuntes.map((a) => [a.id, a.uid]))
        const previos = await tx.table('justificantes').toArray()
        if (previos.length === 0) return
        await tx.table('justificantes').clear()
        const migrados = previos.map((j) => {
          const { apunteId, ...resto } = j as { apunteId?: string } & Record<string, unknown>
          // Si no casa el correlativo, se conserva el valor como apunteUid: quedará como
          // huérfano detectable (justificante sin apunte) en vez de perderse en silencio.
          return { ...resto, apunteUid: (apunteId && uidPorId.get(apunteId)) || apunteId || '' }
        })
        await tx.table('justificantes').bulkAdd(migrados)
      })

    // ── Esquema v5 (textos del manual): nueva convención de carpetas del Archivo
    //    (VALIDADA 2026-08-06, ver docs/TEXTOS_MANUAL_RANURAS.md §5). Las carpetas antiguas
    //    05-perdidas / 06-donaciones / 07-ajustes desaparecen; sus justificantes se reasignan
    //    a las nuevas rutas (PÉRDIDA y DONACIÓN → 07-perdidas-y-donaciones; AJUSTE → 99-otros).
    //    05-certificados y 06-etiquetas quedan libres para documentos de ubicación/ejercicio.
    this.version(5)
      .stores({
        apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida',
        ubicaciones: 'id, nombre, kyc',
        justificantes: 'id, apunteUid, rutaConvencional',
        activos: 'simbolo',
        parametros: 'clave',
      })
      .upgrade(async (tx) => {
        const REASIGNAR: Record<string, string> = {
          '05-perdidas': '07-perdidas-y-donaciones',
          '06-donaciones': '07-perdidas-y-donaciones',
          '07-ajustes': '99-otros',
        }
        const previos = await tx.table('justificantes').toArray()
        for (const j of previos) {
          const nueva = REASIGNAR[j.rutaConvencional as string]
          if (nueva) await tx.table('justificantes').update(j.id, { rutaConvencional: nueva })
        }
      })
  }
}

/** Instancia única de la base de datos para toda la app. */
export const db = new LibroDB()

/**
 * Genera un identificador estable (UUID v4 si está disponible; si no, un aleatorio
 * suficientemente único). Vive aquí, en la capa de datos, no en el motor (que es
 * puro y sin browser APIs).
 */
export function cryptoRandomId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Reserva: no criptográfico, pero determinista en formato.
  return 'id-' + Math.abs(hashCadena(String(performance.now()) + ':' + Math.random())).toString(36)
}

/** Hash simple (djb2) para el generador de reserva. */
function hashCadena(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h | 0
}

/**
 * Siembra los datos de serie si la base está vacía: activos BTC y EUR (Regla del
 * dominio) y el registro de tolerancias por defecto. Idempotente.
 */
export async function sembrarSiVacia(): Promise<void> {
  await db.transaction('rw', db.activos, db.parametros, async () => {
    if ((await db.activos.count()) === 0) {
      await db.activos.bulkAdd(ACTIVOS_BASE.map((a) => ({ ...a })))
    }
    if ((await db.parametros.get(CLAVE_PARAMETROS)) === undefined) {
      await db.parametros.add({
        clave: CLAVE_PARAMETROS,
        toleranciaVerde: TOLERANCIAS_POR_DEFECTO.verde,
        toleranciaAmbar: TOLERANCIAS_POR_DEFECTO.ambar,
      })
    }
  })
}

/**
 * Abre la base de datos local, la siembra si hace falta y devuelve un resumen de
 * estado. La usa la página de inicio para confirmar que IndexedDB está operativo.
 */
export async function abrirBaseDatos(): Promise<{ nombre: string; version: number }> {
  await db.open()
  await sembrarSiVacia()
  return { nombre: db.name, version: db.verno }
}
