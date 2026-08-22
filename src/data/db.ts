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
import type { Activo, Posicion, Ubicacion } from '../engine/types'
import { ACTIVOS_BASE, TOLERANCIAS_POR_DEFECTO } from '../engine/types'
import {
  type CierreRegistro,
  type ApunteRegistro,
  type JustificanteRegistro,
  type ParametrosRegistro,
  type PrecioRegistro,
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
  precios!: Table<PrecioRegistro, string>
  posiciones!: Table<Posicion, string>
  cierres!: Table<CierreRegistro, number>

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

    // ── Esquema v6 (P9.2): nueva tabla `precios` para los precios manuales de la pestaña
    //    Cartera (local-first: los teclea el alumno, nunca se obtienen por red). Clave
    //    primaria: `activo`. Tabla nueva y vacía; no requiere migración de datos previos.
    this.version(6).stores({
      apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida',
      ubicaciones: 'id, nombre, kyc',
      justificantes: 'id, apunteUid, rutaConvencional',
      activos: 'simbolo',
      parametros: 'clave',
      precios: 'activo',
    })

    // ── Esquema v7 (derivada D2, P9.4): el subtipo de PÉRDIDA (error/robo/estafa) es un campo
    //    de datos nuevo. Los apuntes PÉRDIDA anteriores no lo tienen: se migran a
    //    `sin-clasificar` con un aviso suave para completarlo. No cambia índices (subtipoPerdida
    //    no se indexa) ni ningún cálculo del motor.
    this.version(7)
      .stores({
        apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida',
        ubicaciones: 'id, nombre, kyc',
        justificantes: 'id, apunteUid, rutaConvencional',
        activos: 'simbolo',
        parametros: 'clave',
        precios: 'activo',
      })
      .upgrade(async (tx) => {
        const previos = await tx.table('apuntes').toArray()
        for (const ap of previos) {
          if (ap.tipo === 'PERDIDA' && ap.subtipoPerdida === undefined) {
            await tx.table('apuntes').update(ap.uid, { subtipoPerdida: 'sin-clasificar' })
          }
        }
      })

    // ── Esquema v8 (D1, eventos DeFi): nueva tabla `posiciones` y nuevo índice
    //    `posicionId` en apuntes, para reconstruir una posición (aportación →
    //    recompensas → retirada) sin recorrer todo el diario.
    //
    //    Los cuatro campos nuevos del apunte (evento, posicionId, protocolo,
    //    criterioAplicado) son OPCIONALES y ortogonales al catálogo cerrado: los
    //    apuntes anteriores quedan válidos sin tocarlos, así que esta versión NO
    //    necesita migración de datos. La tabla `posiciones` nace vacía.
    this.version(8).stores({
      apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida, posicionId',
      ubicaciones: 'id, nombre, kyc',
      justificantes: 'id, apunteUid, rutaConvencional',
      activos: 'simbolo',
      parametros: 'clave',
      precios: 'activo',
      posiciones: 'id, protocolo, tipoPosicion, estado',
    })

    // ── Esquema v9 (ENCARGO Parte 2, importación desde exploradores): las ubicaciones
    //    guardan sus DIRECCIONES on-chain. Se indexan con índice multiEntry (`*direcciones`)
    //    porque la consulta natural de la importación es la inversa —«¿de quién es esta
    //    dirección?»— una vez por cada movimiento del CSV.
    //
    //    El campo es opcional y no altera ningún cálculo: las ubicaciones anteriores quedan
    //    válidas sin tocarlas (Dexie no indexa las que no tienen el array), así que esta
    //    versión NO necesita migración de datos.
    this.version(9).stores({
      apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida, posicionId',
      ubicaciones: 'id, nombre, kyc, *direcciones',
      justificantes: 'id, apunteUid, rutaConvencional',
      activos: 'simbolo',
      parametros: 'clave',
      precios: 'activo',
      posiciones: 'id, protocolo, tipoPosicion, estado',
    })

    // ── Esquema v10 (v1.6.0, pantalla de CIERRE): nueva tabla `cierres`, un registro por
    //    ejercicio. Guarda lo que el alumno MARCA y ESCRIBE al cerrar el año: las casillas
    //    del Anexo D con la razón de cada «no aplica», la memoria del ejercicio, la
    //    conciliación a tres columnas y las cotizaciones de cierre con su fuente.
    //
    //    Va en IndexedDB y no en `localStorage` por una razón concreta: la memoria del
    //    ejercicio es, según el propio manual, «la casilla que más rinde» —«el documento
    //    que un asesor, un heredero o el propio contribuyente dentro de cinco años leerá
    //    antes que ninguna otra cosa»— y tiene que viajar en la copia de seguridad JSON
    //    como viajan los saldos reales del cuadre. En `localStorage` no viajaría.
    //
    //    Tabla nueva y vacía: no migra datos previos y NO necesita `.upgrade()`, igual que
    //    `precios` en la v6 y `posiciones` en la v8.
    this.version(10).stores({
      apuntes: 'uid, id, fechaHora, tipo, activoEntrada, activoSalida, posicionId',
      ubicaciones: 'id, nombre, kyc, *direcciones',
      justificantes: 'id, apunteUid, rutaConvencional',
      activos: 'simbolo',
      parametros: 'clave',
      precios: 'activo',
      posiciones: 'id, protocolo, tipoPosicion, estado',
      cierres: 'ejercicio',
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
 * Pide al navegador ALMACENAMIENTO PERSISTENTE para esta web (P11): con el permiso
 * concedido, el navegador no purga IndexedDB por presión de disco sin acción del usuario.
 * Devuelve true/false según el estado, o null si la API no existe (navegadores antiguos,
 * entornos de test). Nunca lanza; nunca bloquea la apertura de la base.
 */
export async function solicitarAlmacenamientoPersistente(): Promise<boolean | null> {
  try {
    const s = globalThis.navigator?.storage
    if (!s?.persist || !s.persisted) return null
    if (await s.persisted()) return true
    return await s.persist()
  } catch {
    return null
  }
}

/** ¿Está ya concedido el almacenamiento persistente? (null si la API no existe). */
export async function estadoAlmacenamientoPersistente(): Promise<boolean | null> {
  try {
    const s = globalThis.navigator?.storage
    if (!s?.persisted) return null
    return await s.persisted()
  } catch {
    return null
  }
}

/**
 * Abre la base de datos local, la siembra si hace falta y devuelve un resumen de
 * estado. La usa la página de inicio para confirmar que IndexedDB está operativo.
 * De paso solicita almacenamiento persistente (mejor esfuerzo, sin bloquear).
 */
export async function abrirBaseDatos(): Promise<{ nombre: string; version: number }> {
  await db.open()
  await sembrarSiVacia()
  void solicitarAlmacenamientoPersistente()
  return { nombre: db.name, version: db.verno }
}
