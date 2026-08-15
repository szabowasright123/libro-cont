/**
 * repositorio.ts — repositorio fino tipado sobre Dexie.
 *
 * Los componentes NUNCA tocan Dexie directamente: pasan por aquí. Este módulo
 * traduce entre la capa de almacenamiento (`ApunteRegistro`, con `uid` estable) y
 * el dominio de cálculo (`Apunte`, con correlativo `id`), y encapsula la
 * numeración/reordenación automática (numeracion.ts) en cada escritura.
 *
 * Sin lógica de cálculo (esa vive en src/engine). Aquí: CRUD + integridad
 * referencial (no borrar ubicación/activo con apuntes) + renumeración.
 */
import type { Activo, Apunte, Justificante, Ubicacion, Tolerancias } from '../engine/types'
import { UBICACION_EXTERIOR, ACTIVOS_BASE, TOLERANCIAS_POR_DEFECTO } from '../engine/types'
import { db, cryptoRandomId, sembrarSiVacia } from './db'
import {
  type ApunteRegistro,
  type BorradorApunte,
  type JustificanteRegistro,
  type PrecioRegistro,
  CLAVE_PARAMETROS,
} from './tipos'
import {
  APUNTES_CASO_DEMO,
  UBICACIONES_CASO_DEMO,
  ACTIVOS_CASO_DEMO,
  PRECIOS_CASO_DEMO,
  JUSTIFICANTES_CASO_DEMO,
  SUBTIPOS_PERDIDA_CASO_DEMO,
  CUADRE_REAL_CASO_DEMO,
} from './demo/caso-demo'
import { renumerar, type CambioNumero } from './numeracion'
import type { ContenidoLibro } from './import/contenido'
import type {
  EntradaSnapshot,
  JustificanteSerializable,
  SaldoRealDeclarado,
  SnapshotLibro,
} from './import/json-backup'

// ────────────────────────────────────────────────────────────────────────────
// Apuntes
// ────────────────────────────────────────────────────────────────────────────

/** Todos los registros del diario en orden cronológico (con `uid`). */
export async function listarRegistros(): Promise<ApunteRegistro[]> {
  const todos = await db.apuntes.toArray()
  return todos.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Convierte registros de almacenamiento a apuntes de dominio para el motor y la UI:
 * expone el correlativo como `id` y resuelve `rectificaAUid` → correlativo del
 * apunte referenciado (o lo omite si ya no existe).
 */
export function aDominio(registros: readonly ApunteRegistro[]): Apunte[] {
  const idPorUid = new Map(registros.map((r) => [r.uid, r.id]))
  return registros.map((r) => {
    const { uid: _uid, creadoEn: _creadoEn, rectificaAUid, ...resto } = r
    const ap: Apunte = { ...resto }
    if (rectificaAUid) {
      const ref = idPorUid.get(rectificaAUid)
      if (ref) ap.rectificaA = ref
    }
    return ap
  })
}

/** Diario de dominio (orden cronológico) listo para el motor y las validaciones. */
export async function listarApuntes(): Promise<Apunte[]> {
  return aDominio(await listarRegistros())
}

/**
 * Renumera TODO el diario según orden cronológico y persiste solo los registros
 * cuyo correlativo haya cambiado. Devuelve la lista de cambios (para el aviso).
 * Debe ejecutarse dentro de una transacción rw sobre `apuntes`.
 */
async function renumerarTodo(): Promise<CambioNumero[]> {
  const todos = await db.apuntes.toArray()
  const { ordenados, cambios } = renumerar(todos)
  if (cambios.length > 0) {
    const cambiadosUid = new Set(cambios.map((c) => c.uid))
    await db.apuntes.bulkPut(ordenados.filter((r) => cambiadosUid.has(r.uid)))
  }
  return cambios
}

/** Resultado de una escritura de apunte: el uid afectado + cambios de numeración. */
export interface ResultadoEscritura {
  uid: string
  cambios: CambioNumero[]
}

/**
 * Crea un apunte a partir de un borrador del formulario, le asigna `uid`/`creadoEn`
 * y renumera el diario. Devuelve el uid creado y los cambios de correlativo.
 */
export async function crearApunte(borrador: BorradorApunte): Promise<ResultadoEscritura> {
  const uid = cryptoRandomId()
  return db.transaction('rw', db.apuntes, async () => {
    const registro: ApunteRegistro = {
      ...borrador,
      uid,
      id: '0000-000', // provisional; renumerarTodo asigna el correlativo real
      creadoEn: new Date().toISOString(),
    }
    await db.apuntes.add(registro)
    const cambios = await renumerarTodo()
    return { uid, cambios }
  })
}

/** Actualiza los campos de un apunte existente (por uid) y renumera. */
export async function actualizarApunte(
  uid: string,
  cambiosCampos: Partial<BorradorApunte>,
): Promise<ResultadoEscritura> {
  return db.transaction('rw', db.apuntes, async () => {
    const actual = await db.apuntes.get(uid)
    if (!actual) throw new Error(`Apunte ${uid} no encontrado.`)
    await db.apuntes.put({ ...actual, ...cambiosCampos, uid, creadoEn: actual.creadoEn })
    const cambios = await renumerarTodo()
    return { uid, cambios }
  })
}

/**
 * Elimina un apunte (por uid) y renumera el resto. Borra en cascada sus justificantes
 * del Archivo (integridad referencial: no dejar justificantes huérfanos en silencio) y
 * limpia las referencias de AJUSTE que lo rectificaban.
 */
export async function eliminarApunte(uid: string): Promise<ResultadoEscritura> {
  return db.transaction('rw', db.apuntes, db.justificantes, async () => {
    await db.apuntes.delete(uid)
    // Cascada: los justificantes ligados a este apunte se borran con él.
    await db.justificantes.where('apunteUid').equals(uid).delete()
    // Limpia referencias colgantes de AJUSTE al apunte borrado (rectificaAUid no
    // está indexado: se filtra en memoria).
    const referentes = await db.apuntes.filter((r) => r.rectificaAUid === uid).toArray()
    for (const r of referentes) {
      const { rectificaAUid: _drop, ...resto } = r
      await db.apuntes.put(resto)
    }
    const cambios = await renumerarTodo()
    return { uid, cambios }
  })
}

/**
 * Duplica un apunte: copia sus campos a un borrador nuevo (sin uid/id/creadoEn ni
 * referencia rectificaA), listo para que el formulario lo ajuste y guarde.
 */
export function duplicarComoBorrador(registro: ApunteRegistro): BorradorApunte {
  const { uid: _uid, id: _id, creadoEn: _creadoEn, rectificaAUid: _rect, ...resto } = registro
  return { ...resto }
}

// ────────────────────────────────────────────────────────────────────────────
// Ubicaciones
// ────────────────────────────────────────────────────────────────────────────

/** Todas las ubicaciones del alumno (sin EXTERIOR, que es constante del dominio). */
export async function listarUbicaciones(): Promise<Ubicacion[]> {
  return (await db.ubicaciones.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** Alta de ubicación (genera id estable). */
export async function crearUbicacion(datos: Omit<Ubicacion, 'id'>): Promise<string> {
  const id = cryptoRandomId()
  await db.ubicaciones.add({ ...datos, id })
  return id
}

/** Edición de ubicación por id. */
export async function actualizarUbicacion(
  id: string,
  cambios: Partial<Omit<Ubicacion, 'id'>>,
): Promise<void> {
  await db.ubicaciones.update(id, cambios)
}

/** Nº de apuntes que referencian una ubicación (origen o destino). */
export async function apuntesConUbicacion(id: string): Promise<number> {
  return db.apuntes
    .filter((ap) => ap.ubicacionOrigen === id || ap.ubicacionDestino === id)
    .count()
}

/** Borra una ubicación solo si no tiene apuntes; si los tiene, lanza. */
export async function eliminarUbicacion(id: string): Promise<void> {
  const n = await apuntesConUbicacion(id)
  if (n > 0) {
    throw new Error(
      `No se puede borrar: la ubicación tiene ${n} apunte(s) asociado(s). ` +
        'Reasigna o elimina esos apuntes primero.',
    )
  }
  await db.ubicaciones.delete(id)
}

// ────────────────────────────────────────────────────────────────────────────
// Activos (catálogo editable; BTC y EUR de serie)
// ────────────────────────────────────────────────────────────────────────────

/** Catálogo de activos. */
export async function listarActivos(): Promise<Activo[]> {
  return (await db.activos.toArray()).sort((a, b) => a.simbolo.localeCompare(b.simbolo))
}

/** Alta de activo (clave: símbolo). Falla si el símbolo ya existe. */
export async function crearActivo(activo: Activo): Promise<void> {
  await db.activos.add(activo)
}

/** Edición de activo por símbolo (no cambia el símbolo, que es la clave). */
export async function actualizarActivo(
  simbolo: string,
  cambios: Partial<Omit<Activo, 'simbolo'>>,
): Promise<void> {
  await db.activos.update(simbolo, cambios)
}

/** Nº de apuntes que usan un activo (entrada, salida o comisión). */
export async function apuntesConActivo(simbolo: string): Promise<number> {
  return db.apuntes
    .filter(
      (ap) =>
        ap.activoEntrada === simbolo ||
        ap.activoSalida === simbolo ||
        ap.comisionActivo === simbolo,
    )
    .count()
}

/** Borra un activo si no tiene apuntes; BTC y EUR nunca se borran. */
export async function eliminarActivo(simbolo: string): Promise<void> {
  if (simbolo === 'BTC' || simbolo === 'EUR') {
    throw new Error(`El activo ${simbolo} es de serie y no puede borrarse.`)
  }
  const n = await apuntesConActivo(simbolo)
  if (n > 0) {
    throw new Error(`No se puede borrar: el activo ${simbolo} se usa en ${n} apunte(s).`)
  }
  await db.activos.delete(simbolo)
}

// ────────────────────────────────────────────────────────────────────────────
// Parámetros (tolerancias del cuadre)
// ────────────────────────────────────────────────────────────────────────────

/** Lee las tolerancias del cuadre (verde/ámbar). */
export async function obtenerTolerancias(): Promise<Tolerancias> {
  const p = await db.parametros.get(CLAVE_PARAMETROS)
  return { verde: p?.toleranciaVerde ?? 1e-8, ambar: p?.toleranciaAmbar ?? 1e-3 }
}

/** Guarda las tolerancias del cuadre. */
export async function guardarTolerancias(tol: Tolerancias): Promise<void> {
  const prev = await db.parametros.get(CLAVE_PARAMETROS)
  await db.parametros.put({
    ...(prev ?? { clave: CLAVE_PARAMETROS }),
    clave: CLAVE_PARAMETROS,
    toleranciaVerde: tol.verde,
    toleranciaAmbar: tol.ambar,
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Precios manuales (pestaña Cartera, P9.2) — local-first, NUNCA por red
// ────────────────────────────────────────────────────────────────────────────

/** Todos los precios manuales introducidos por el alumno. */
export async function listarPrecios(): Promise<PrecioRegistro[]> {
  return db.precios.toArray()
}

/**
 * Guarda (o actualiza) el precio manual de un activo en EUR, con su fecha de introducción.
 * EUR no debería llamar aquí (vale 1); si `precioEur` viene vacío, se borra el precio.
 */
export async function guardarPrecio(
  activo: string,
  precioEur: string,
  fechaISO: string,
): Promise<void> {
  if (precioEur === '') {
    await db.precios.delete(activo)
    return
  }
  await db.precios.put({ activo, precioEur, fechaISO })
}

/** Borra el precio manual de un activo. */
export async function borrarPrecio(activo: string): Promise<void> {
  await db.precios.delete(activo)
}

// ────────────────────────────────────────────────────────────────────────────
// Justificantes (el Archivo — expediente probatorio, P5)
// ────────────────────────────────────────────────────────────────────────────

/** Todos los justificantes almacenados (con `apunteUid` estable). */
export async function listarJustificantes(): Promise<JustificanteRegistro[]> {
  return db.justificantes.toArray()
}

/** Justificantes ligados a un apunte (por su uid estable). */
export async function justificantesDeApunte(apunteUid: string): Promise<JustificanteRegistro[]> {
  return db.justificantes.where('apunteUid').equals(apunteUid).toArray()
}

/** Alta de un justificante (genera id estable). Devuelve el id creado. */
export async function crearJustificante(
  datos: Omit<JustificanteRegistro, 'id'>,
): Promise<string> {
  const id = cryptoRandomId()
  await db.justificantes.add({ ...datos, id })
  return id
}

/** Edición de metadatos de un justificante por id. */
export async function actualizarJustificante(
  id: string,
  cambios: Partial<Omit<JustificanteRegistro, 'id' | 'apunteUid'>>,
): Promise<void> {
  await db.justificantes.update(id, cambios)
}

/** Elimina un justificante por id. */
export async function eliminarJustificante(id: string): Promise<void> {
  await db.justificantes.delete(id)
}

/**
 * Espacio local (bytes) que ocupan los ficheros embebidos de los justificantes. Solo
 * cuentan los que guardan el Blob; las referencias externas no ocupan (P5, punto 6).
 */
export async function espacioArchivoUsado(): Promise<number> {
  const todos = await db.justificantes.toArray()
  return todos.reduce((acc, j) => acc + (j.fichero?.size ?? 0), 0)
}

/**
 * Traduce justificantes de almacenamiento (con `apunteUid`) a dominio (con el correlativo
 * `apunteId`, que es lo que consume el motor del Archivo). Un justificante cuyo apunteUid
 * ya no exista queda con `apunteId = ''` → lo detecta `detectarHuerfanos` como huérfano.
 */
export function justificantesADominio(
  justificantes: readonly JustificanteRegistro[],
  registrosApuntes: readonly ApunteRegistro[],
): Justificante[] {
  const correlativoPorUid = new Map(registrosApuntes.map((r) => [r.uid, r.id]))
  return justificantes.map((j) => {
    const { apunteUid, ...resto } = j
    return { ...resto, apunteId: correlativoPorUid.get(apunteUid) ?? '' }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Utilidades varias
// ────────────────────────────────────────────────────────────────────────────

/** ¿Es la ubicación especial de frontera EXTERIOR? */
export function esExterior(ref: string): boolean {
  return ref === UBICACION_EXTERIOR
}

// ────────────────────────────────────────────────────────────────────────────
// Importación / exportación en bloque (P4)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un apunte de dominio (con correlativo) al registro de almacenamiento:
 * genera `uid` estable, marca `creadoEn` determinista (el índice preserva el orden de
 * llegada como desempate a igual fechaHora) y deja el correlativo provisional (lo fija
 * la renumeración). No resuelve `rectificaA` (la importación no arrastra referencias).
 */
function apunteARegistro(ap: Apunte, indice: number): ApunteRegistro {
  const { id: _id, rectificaA: _r, ...resto } = ap
  return {
    ...resto,
    uid: cryptoRandomId(),
    id: '0000-000',
    creadoEn: new Date(0).toISOString().replace(/Z$/, `${String(indice).padStart(6, '0')}Z`),
  }
}

/** Asegura que BTC y EUR de serie estén en un catálogo de activos importado. */
function conActivosBase(activos: readonly Activo[]): Activo[] {
  const porSimbolo = new Map(activos.map((a) => [a.simbolo, a]))
  for (const base of ACTIVOS_BASE) if (!porSimbolo.has(base.simbolo)) porSimbolo.set(base.simbolo, { ...base })
  return [...porSimbolo.values()]
}

/**
 * REEMPLAZA el contenido del Libro (apuntes, ubicaciones, activos, tolerancias) por el
 * importado desde XLSX o CSV. Vacía también los justificantes (un import es un Libro
 * nuevo; sus correlativos cambian y las referencias del Archivo dejarían de casar).
 * Renumera el diario al final. Transacción atómica.
 */
export async function reemplazarContenido(contenido: ContenidoLibro): Promise<CambioNumero[]> {
  return db.transaction(
    'rw',
    [db.apuntes, db.ubicaciones, db.activos, db.justificantes, db.parametros, db.precios],
    async () => {
      await Promise.all([
        db.apuntes.clear(),
        db.ubicaciones.clear(),
        db.activos.clear(),
        db.justificantes.clear(),
        // Un import es un Libro nuevo: sus precios manuales (si los hubiera) dejan de aplicar.
        db.precios.clear(),
      ])
      // Un import limpia también la marca del caso de ejemplo (ya no es la demo).
      await limpiarMarcaDemo()
      await db.activos.bulkAdd(conActivosBase(contenido.activos))
      if (contenido.ubicaciones.length > 0) await db.ubicaciones.bulkAdd(contenido.ubicaciones.map((u) => ({ ...u })))
      if (contenido.apuntes.length > 0) await db.apuntes.bulkAdd(contenido.apuntes.map(apunteARegistro))
      if (contenido.tolerancias) {
        const prev = await db.parametros.get(CLAVE_PARAMETROS)
        await db.parametros.put({
          ...(prev ?? { clave: CLAVE_PARAMETROS }),
          clave: CLAVE_PARAMETROS,
          toleranciaVerde: contenido.tolerancias.verde,
          toleranciaAmbar: contenido.tolerancias.ambar,
        })
      }
      return renumerarTodo()
    },
  )
}

/** Contenido actual del Libro (dominio) listo para exportar a XLSX/CSV. */
export async function exportarContenidoActual(): Promise<ContenidoLibro> {
  const [apuntes, ubicaciones, activos, tolerancias] = await Promise.all([
    listarApuntes(),
    listarUbicaciones(),
    listarActivos(),
    obtenerTolerancias(),
  ])
  return { apuntes, ubicaciones, activos, tolerancias }
}

// ── Copia JSON nativa (versionada) ──────────────────────────────────────────

/** Bytes de un Blob, con reserva por FileReader donde `Blob.arrayBuffer` no exista. */
async function bytesDeBlob(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer())
  // Reserva (algunos entornos sin `Blob.arrayBuffer`): FileReader.
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer))
    fr.onerror = () => reject(fr.error ?? new Error('No se pudo leer el fichero.'))
    fr.readAsArrayBuffer(blob)
  })
}

/** Blob → base64 (para embeber el fichero de un justificante en la copia JSON). */
async function blobABase64(blob: Blob): Promise<string> {
  const bytes = await bytesDeBlob(blob)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

/** base64 → Blob (reconstruye el fichero de un justificante al restaurar). */
function base64ABlob(b64: string, mime?: string): Blob {
  const binario = atob(b64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], mime ? { type: mime } : undefined)
}

/**
 * Justificante de la base (con `apunteUid`) → forma JSON-segura (con fichero en base64).
 * El snapshot enlaza por el correlativo `apunteId` (legible y estable dentro del propio
 * snapshot, cuyo orden se preserva al restaurar), no por el uid interno.
 */
async function justificanteASerializable(
  j: JustificanteRegistro,
  correlativoPorUid: ReadonlyMap<string, string>,
): Promise<JustificanteSerializable> {
  const base: JustificanteSerializable = {
    id: j.id,
    apunteId: correlativoPorUid.get(j.apunteUid) ?? '',
    rutaConvencional: j.rutaConvencional,
    tipoDocumento: j.tipoDocumento,
    ...(j.hashSHA256 ? { hashSHA256: j.hashSHA256 } : {}),
    ...(j.referenciaExterna ? { referenciaExterna: j.referenciaExterna } : {}),
    ...(j.notas ? { notas: j.notas } : {}),
  }
  if (j.fichero) {
    base.ficheroBase64 = await blobABase64(j.fichero)
    if (j.fichero.type) base.ficheroMime = j.fichero.type
  }
  return base
}

/**
 * Forma JSON-segura → JustificanteRegistro de la base: resuelve el correlativo `apunteId`
 * del snapshot al `apunteUid` estable ya asignado a los apuntes restaurados (reconstruye
 * el Blob del fichero desde base64).
 */
function serializableAJustificante(
  s: JustificanteSerializable,
  uidPorCorrelativo: ReadonlyMap<string, string>,
): JustificanteRegistro {
  return {
    id: s.id,
    apunteUid: uidPorCorrelativo.get(s.apunteId) ?? '',
    rutaConvencional: s.rutaConvencional as JustificanteRegistro['rutaConvencional'],
    tipoDocumento: s.tipoDocumento,
    ...(s.hashSHA256 ? { hashSHA256: s.hashSHA256 } : {}),
    ...(s.referenciaExterna ? { referenciaExterna: s.referenciaExterna } : {}),
    ...(s.notas ? { notas: s.notas } : {}),
    ...(s.ficheroBase64 ? { fichero: base64ABlob(s.ficheroBase64, s.ficheroMime) } : {}),
  }
}

/** Lee los saldos reales del cuadre (guardados en el singleton de parámetros). */
export async function obtenerCuadreReal(): Promise<SaldoRealDeclarado[]> {
  const p = await db.parametros.get(CLAVE_PARAMETROS)
  return p?.cuadreReal ?? []
}

/**
 * Declara (o actualiza) el SALDO REAL de una celda del cuadre (ubicación × activo), tal como
 * lo teclea el alumno desde su fuente (exchange, wallet). Un `saldoReal` vacío BORRA la
 * declaración de esa celda (la fila del cuadre vuelve a «sin declarar»). El semáforo no se
 * calcula aquí: eso es del motor (engine/cuadre.ts).
 */
export async function guardarSaldoRealDeclarado(
  ubicacion: string,
  activo: string,
  saldoReal: string,
  notas?: string,
): Promise<void> {
  const prev = await db.parametros.get(CLAVE_PARAMETROS)
  const resto = (prev?.cuadreReal ?? []).filter(
    (c) => !(c.ubicacion === ubicacion && c.activo === activo),
  )
  const cuadreReal =
    saldoReal === ''
      ? resto
      : [...resto, { ubicacion, activo, saldoReal, ...(notas ? { notas } : {}) }]
  await db.parametros.put({
    ...(prev ?? {
      clave: CLAVE_PARAMETROS,
      toleranciaVerde: TOLERANCIAS_POR_DEFECTO.verde,
      toleranciaAmbar: TOLERANCIAS_POR_DEFECTO.ambar,
    }),
    clave: CLAVE_PARAMETROS,
    cuadreReal,
  })
}

// ── Marca de la última copia de seguridad (P11, recordatorio suave) ─────────

/** Lee la marca de la última copia JSON descargada (fecha + nº de apuntes). */
export async function estadoCopia(): Promise<{
  ultimaCopiaEn?: string
  apuntesEnUltimaCopia?: number
}> {
  const p = await db.parametros.get(CLAVE_PARAMETROS)
  return {
    ...(p?.ultimaCopiaEn ? { ultimaCopiaEn: p.ultimaCopiaEn } : {}),
    ...(p?.apuntesEnUltimaCopia !== undefined
      ? { apuntesEnUltimaCopia: p.apuntesEnUltimaCopia }
      : {}),
  }
}

/** Registra que se acaba de descargar una copia JSON con `nApuntes` apuntes. */
export async function registrarCopiaRealizada(fechaISO: string, nApuntes: number): Promise<void> {
  const prev = await db.parametros.get(CLAVE_PARAMETROS)
  await db.parametros.put({
    ...(prev ?? {
      clave: CLAVE_PARAMETROS,
      toleranciaVerde: TOLERANCIAS_POR_DEFECTO.verde,
      toleranciaAmbar: TOLERANCIAS_POR_DEFECTO.ambar,
    }),
    clave: CLAVE_PARAMETROS,
    ultimaCopiaEn: fechaISO,
    apuntesEnUltimaCopia: nApuntes,
  })
}

/** Foto completa del Libro para la copia JSON nativa (incluye justificantes y cuadre). */
export async function snapshotActual(): Promise<EntradaSnapshot> {
  const [contenido, registrosApuntes, justificantesRaw, cuadreReal] = await Promise.all([
    exportarContenidoActual(),
    db.apuntes.toArray(),
    db.justificantes.toArray(),
    obtenerCuadreReal(),
  ])
  const correlativoPorUid = new Map(registrosApuntes.map((r) => [r.uid, r.id]))
  const justificantes = await Promise.all(
    justificantesRaw.map((j) => justificanteASerializable(j, correlativoPorUid)),
  )
  return {
    apuntes: contenido.apuntes,
    ubicaciones: contenido.ubicaciones,
    activos: contenido.activos,
    tolerancias: contenido.tolerancias ?? { ...TOLERANCIAS_POR_DEFECTO },
    justificantes,
    cuadreReal,
  }
}

/**
 * RESTAURA el Libro completo desde una copia JSON: reemplaza TODO (apuntes, ubicaciones,
 * activos, tolerancias, justificantes y saldos reales del cuadre). Renumera al final.
 */
export async function restaurarSnapshot(snapshot: SnapshotLibro): Promise<CambioNumero[]> {
  return db.transaction(
    'rw',
    [db.apuntes, db.ubicaciones, db.activos, db.justificantes, db.parametros, db.precios],
    async () => {
      await Promise.all([
        db.apuntes.clear(),
        db.ubicaciones.clear(),
        db.activos.clear(),
        db.justificantes.clear(),
        db.precios.clear(),
      ])
      await db.activos.bulkAdd(conActivosBase(snapshot.activos))
      if (snapshot.ubicaciones.length > 0) await db.ubicaciones.bulkAdd(snapshot.ubicaciones.map((u) => ({ ...u })))
      if (snapshot.apuntes.length > 0) await db.apuntes.bulkAdd(snapshot.apuntes.map(apunteARegistro))
      // Renumera ANTES de restaurar el Archivo: los justificantes enlazan por el
      // correlativo del snapshot, que se preserva porque el orden cronológico (y los
      // desempates por `creadoEn`) es idéntico. Con el correlativo ya fijado, se resuelve
      // a `apunteUid` estable.
      const cambios = await renumerarTodo()
      if (snapshot.justificantes.length > 0) {
        const registros = await db.apuntes.toArray()
        const uidPorCorrelativo = new Map(registros.map((r) => [r.id, r.uid]))
        await db.justificantes.bulkAdd(
          snapshot.justificantes.map((s) => serializableAJustificante(s, uidPorCorrelativo)),
        )
      }
      await db.parametros.put({
        clave: CLAVE_PARAMETROS,
        toleranciaVerde: snapshot.tolerancias.verde,
        toleranciaAmbar: snapshot.tolerancias.ambar,
        cuadreReal: snapshot.cuadreReal,
      })
      return cambios
    },
  )
}

/**
 * BORRADO TOTAL: vacía todas las tablas y resiembra lo de serie (activos BTC/EUR y las
 * tolerancias por defecto). Operación irreversible; la UI exige doble confirmación.
 */
export async function borrarTodo(): Promise<void> {
  await db.transaction(
    'rw',
    [db.apuntes, db.ubicaciones, db.activos, db.justificantes, db.parametros, db.precios],
    async () => {
      await Promise.all([
        db.apuntes.clear(),
        db.ubicaciones.clear(),
        db.activos.clear(),
        db.justificantes.clear(),
        db.parametros.clear(),
        db.precios.clear(),
      ])
      await db.activos.bulkAdd(ACTIVOS_BASE.map((a) => ({ ...a })))
      await db.parametros.add({
        clave: CLAVE_PARAMETROS,
        toleranciaVerde: TOLERANCIAS_POR_DEFECTO.verde,
        toleranciaAmbar: TOLERANCIAS_POR_DEFECTO.ambar,
      })
    },
  )
  // `sembrarSiVacia` es idempotente: garantiza coherencia si algo quedó a medias.
  await sembrarSiVacia()
}

// ────────────────────────────────────────────────────────────────────────────
// Caso de ejemplo COMPLETO (2024–2025) — onboarding con un clic (P9.3 / P10)
// ────────────────────────────────────────────────────────────────────────────

/** Quita la marca `demoCargada` del singleton de parámetros (si existe). */
async function limpiarMarcaDemo(): Promise<void> {
  const prev = await db.parametros.get(CLAVE_PARAMETROS)
  if (prev?.demoCargada) {
    const { demoCargada: _drop, ...resto } = prev
    await db.parametros.put(resto)
  }
}

/** ¿Está cargado el caso de ejemplo (2024–2025)? */
export async function estaDemoCargada(): Promise<boolean> {
  const p = await db.parametros.get(CLAVE_PARAMETROS)
  return p?.demoCargada === true
}

/** ¿Hay algún apunte en el Libro? (para decidir si se puede cargar la demo sin avisar). */
export async function libroVacio(): Promise<boolean> {
  return (await db.apuntes.count()) === 0
}

/**
 * Carga el CASO DE EJEMPLO COMPLETO (2024–2025): REEMPLAZA el contenido del Libro por los
 * apuntes, ubicaciones y activos de la demo; siembra el Archivo (justificantes), el subtipo de
 * las PÉRDIDAS, la referencia estable de los AJUSTES (rectificaA → rectificaAUid) y los precios
 * manuales; y marca `demoCargada`. Idempotente: llamarla dos veces no duplica (siempre
 * reemplaza). Renumera antes de resolver referencias, para que los correlativos queden como los
 * del dataset (los de 2024, como los del golden). Transacción atómica.
 */
export async function cargarCasoDemo(): Promise<void> {
  await db.transaction(
    'rw',
    [db.apuntes, db.ubicaciones, db.activos, db.justificantes, db.parametros, db.precios],
    async () => {
      await Promise.all([
        db.apuntes.clear(),
        db.ubicaciones.clear(),
        db.activos.clear(),
        db.justificantes.clear(),
        db.precios.clear(),
      ])
      await db.activos.bulkAdd(conActivosBase(ACTIVOS_CASO_DEMO))
      await db.ubicaciones.bulkAdd(UBICACIONES_CASO_DEMO.map((u) => ({ ...u })))
      await db.apuntes.bulkAdd(APUNTES_CASO_DEMO.map(apunteARegistro))
      await renumerarTodo()

      // Con los correlativos ya fijados (idénticos a los del dataset), se resuelven las
      // referencias estables: justificantes (apunteId → apunteUid), rectificaA de los AJUSTES
      // (→ rectificaAUid) y subtipo de las PÉRDIDAS (capa de datos, derivada D2).
      const registros = await db.apuntes.toArray()
      const uidPorId = new Map(registros.map((r) => [r.id, r.uid]))
      for (const ap of APUNTES_CASO_DEMO) {
        if (!ap.rectificaA) continue
        const uid = uidPorId.get(ap.id)
        const refUid = uidPorId.get(ap.rectificaA)
        if (uid && refUid) await db.apuntes.update(uid, { rectificaAUid: refUid })
      }
      for (const [id, subtipoPerdida] of Object.entries(SUBTIPOS_PERDIDA_CASO_DEMO)) {
        const uid = uidPorId.get(id)
        if (uid) await db.apuntes.update(uid, { subtipoPerdida })
      }
      await db.justificantes.bulkAdd(
        JUSTIFICANTES_CASO_DEMO.map((j) => ({
          id: j.id,
          // '' (documento de ubicación/ejercicio, carpetas 05/06) queda sin apunteUid.
          apunteUid: uidPorId.get(j.apunteId) ?? '',
          rutaConvencional: j.rutaConvencional,
          tipoDocumento: j.tipoDocumento,
          ...(j.referenciaExterna ? { referenciaExterna: j.referenciaExterna } : {}),
          ...(j.notas ? { notas: j.notas } : {}),
        })),
      )

      await db.precios.bulkAdd(PRECIOS_CASO_DEMO.map((p) => ({ ...p })))
      const prev = await db.parametros.get(CLAVE_PARAMETROS)
      await db.parametros.put({
        clave: CLAVE_PARAMETROS,
        toleranciaVerde: prev?.toleranciaVerde ?? TOLERANCIAS_POR_DEFECTO.verde,
        toleranciaAmbar: prev?.toleranciaAmbar ?? TOLERANCIAS_POR_DEFECTO.ambar,
        // La demo trae su propio cuadre declarado (todo en verde, listo para enseñar).
        cuadreReal: CUADRE_REAL_CASO_DEMO.map((c) => ({ ...c })),
        ...(prev?.ultimaCopiaEn ? { ultimaCopiaEn: prev.ultimaCopiaEn } : {}),
        ...(prev?.apuntesEnUltimaCopia !== undefined
          ? { apuntesEnUltimaCopia: prev.apuntesEnUltimaCopia }
          : {}),
        demoCargada: true,
      })
    },
  )
}

/**
 * Borra el caso de ejemplo y deja el Libro VACÍO (misma mecánica que el borrado total, que ya
 * reinicia lo de serie y quita la marca de demo). Para el botón «Borrar caso de ejemplo».
 */
export async function borrarCasoDemo(): Promise<void> {
  await borrarTodo()
}
