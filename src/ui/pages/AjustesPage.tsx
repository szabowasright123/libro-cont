/**
 * AjustesPage — puentes con Excel y CSV, y copia de seguridad (P4).
 *
 * Local-first: todo ocurre en el navegador. Cuatro bloques:
 *  1. Excel: importar la PLANTILLA_TALLER.xlsx y exportar el Libro a esa misma plantilla
 *     (que se recalcula sola: SALDOS/FIFO/CUADRE coinciden con la app).
 *  2. CSV genérico del taller: importar mini_caso_generico.csv y formatos afines. (Los CSV de
 *     exploradores de bloques van a su propio apartado, «Importar cadena», que AÑADE en vez de
 *     reemplazar: ver ImportarPage.)
 *  3. Copia JSON nativa: descargar copia completa y restaurarla.
 *  4. Zona peligrosa: borrado total con doble confirmación.
 *
 * Importar (XLSX/CSV/JSON) REEMPLAZA el Libro actual: se avisa siempre antes.
 */
import { useEffect, useId, useState, type ReactNode } from 'react'
// La plantilla oficial viaja embebida como asset (sin red en runtime, Regla 3).
import plantillaUrl from '../../assets/plantilla-taller.xlsx?url'
import { BTN_PRIMARIO, BTN_SEC, BTN_PELIGRO, Banner } from '../comp'
import {
  descargarBytes,
  descargarTexto,
  leerArchivoBuffer,
  leerArchivoTexto,
  MIME_XLSX,
} from '../descargas'
import {
  reemplazarContenido,
  exportarContenidoActual,
  snapshotActual,
  restaurarSnapshot,
  borrarTodo,
  borrarCasoDemo,
  estaDemoCargada,
  listarJustificantes,
  espacioArchivoUsado,
  estadoCopia,
  registrarCopiaRealizada,
} from '../../data/repositorio'
import { estadoAlmacenamientoPersistente } from '../../data/db'
import { irA } from '../shell/rutas'
import { useLiveQuery } from '../../data/useLiveQuery'
import { fmtBytes, fmtFecha } from '../formato'
import { importarXlsx } from '../../data/import/xlsx-import'
import { exportarXlsx, nombreFicheroXlsx } from '../../data/import/xlsx-export'
import { importarCsvGenerico } from '../../data/import/csv-generico'
import {
  activosDescubiertos,
  simbolosDeApunte,
  type ContenidoLibro,
} from '../../data/import/contenido'
import type { InformeImport } from '../../data/import/mapeo-generico'
import { exportarJson, parsearSnapshot, ErrorRestauracion } from '../../data/import/json-backup'
import type { Ubicacion } from '../../engine/types'
import { UnidadManual } from '../guia/UnidadManual'
import { generarApuntesSinteticos, UBICACIONES_DEMO } from '../../data/dev/generarDataset'
import { SelectorTema } from '../tema-ui'

/**
 * Visibilidad de las herramientas de desarrollo. Ocultas para el alumno: solo en
 * `npm run dev` o si se activa el flag `hesperides.dev` en localStorage (para poder
 * probar el rendimiento sobre el build de producción sin exponerlas por defecto).
 */
function devActivo(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return localStorage.getItem('hesperides.dev') === '1'
  } catch {
    return false
  }
}

type Tono = 'info' | 'exito' | 'error'

export function AjustesPage() {
  const [banner, setBanner] = useState<{ tono: Tono; texto: string } | null>(null)
  const [informe, setInforme] = useState<InformeImport | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const aviso = (tono: Tono, texto: string) => setBanner({ tono, texto })
  const limpiar = () => { setBanner(null); setInforme(null) }

  /** Envuelve una acción asíncrona: bloquea, captura errores y los muestra. */
  async function accion(fn: () => Promise<void>) {
    if (ocupado) return
    limpiar()
    setOcupado(true)
    try {
      await fn()
    } catch (e) {
      aviso('error', e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-8">
      <UnidadManual ruta="ajustes" />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-slate-500">
          Puentes con Excel y CSV, y copia de seguridad. Todo en tu navegador: nada sale
          de aquí salvo cuando descargas un fichero.
        </p>
      </header>

      {banner && (
        <Banner tono={banner.tono} onCerrar={limpiar}>
          <div className="space-y-1">
            <div>{banner.texto}</div>
            {informe && <DetalleInforme informe={informe} />}
          </div>
        </Banner>
      )}

      <SeccionApariencia />
      <SeccionAlmacenamiento />
      <SeccionCasoDemo accion={accion} ocupado={ocupado} aviso={aviso} />
      <SeccionExcel accion={accion} ocupado={ocupado} setInforme={setInforme} aviso={aviso} />
      <SeccionCsv accion={accion} ocupado={ocupado} setInforme={setInforme} aviso={aviso} />
      <SeccionCopia accion={accion} ocupado={ocupado} aviso={aviso} />
      <SeccionPeligro accion={accion} ocupado={ocupado} aviso={aviso} />
      {devActivo() && <SeccionDesarrollo accion={accion} ocupado={ocupado} aviso={aviso} />}
    </div>
  )
}

/**
 * Herramientas de desarrollo (ocultas para el alumno). Genera un dataset sintético
 * grande para probar la virtualización y el rendimiento (P8). REEMPLAZA el Libro.
 */
function SeccionDesarrollo({ accion, ocupado, aviso }: Props) {
  const [n, setN] = useState(5000)
  const cargar = () =>
    accion(async () => {
      if (
        !window.confirm(
          `Esto BORRA el Libro actual y lo reemplaza por ${n} apuntes sintéticos. ¿Continuar?`,
        )
      )
        return
      await reemplazarContenido({
        apuntes: generarApuntesSinteticos(n),
        ubicaciones: UBICACIONES_DEMO,
        activos: [],
      })
      aviso('exito', `Cargados ${n} apuntes sintéticos. Abre el Diario para probar.`)
    })

  return (
    <section
      className="space-y-3 rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700"
      aria-labelledby="ajustes-desarrollo"
    >
      <div>
        <h2 id="ajustes-desarrollo" className="text-lg font-semibold">Herramientas de desarrollo</h2>
        <p className="text-sm text-slate-500">
          Solo para pruebas. Genera un diario grande para comprobar el rendimiento y la
          virtualización de la tabla. <strong>Reemplaza</strong> el contenido actual.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Nº de apuntes</span>
          <input
            type="number"
            min={1}
            max={50000}
            step={500}
            value={n}
            onChange={(e) => setN(Math.max(1, Math.min(50000, Number(e.target.value) || 0)))}
            className="w-32 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <button type="button" className={BTN_SEC} onClick={cargar} disabled={ocupado}>
          Generar dataset sintético
        </button>
      </div>
    </section>
  )
}

// ── Caso de ejemplo (completo, 2024–2025) ───────────────────────────────────

/**
 * Borrado limpio del CASO DE EJEMPLO (P9.3): deja el Libro vacío (misma mecánica que el
 * borrado total). La sección solo se muestra cuando la demo está cargada.
 */
function SeccionCasoDemo({ accion, ocupado, aviso }: Props) {
  const demoQ = useLiveQuery(() => estaDemoCargada(), [])
  const cargada = demoQ.estado === 'listo' ? demoQ.datos : false
  if (!cargada) return null

  const borrar = () =>
    accion(async () => {
      if (
        !window.confirm(
          'Se borrará el caso de ejemplo y el Libro quedará vacío. ¿Continuar?',
        )
      )
        return
      await borrarCasoDemo()
      aviso('exito', 'Caso de ejemplo borrado. El Libro está vacío y listo para tus datos.')
    })

  return (
    <Seccion
      titulo="Caso de ejemplo cargado"
      desc="Estás viendo el caso de ejemplo completo (2024–2025) de demostración. Bórralo cuando quieras empezar con tus propios datos; el Libro quedará vacío."
    >
      <button type="button" className={BTN_SEC} onClick={borrar} disabled={ocupado}>
        Borrar caso de ejemplo
      </button>
    </Seccion>
  )
}

// ── Utilidades compartidas ──────────────────────────────────────────────────

interface Props {
  accion: (fn: () => Promise<void>) => Promise<void>
  ocupado: boolean
  aviso: (tono: Tono, texto: string) => void
  setInforme?: (i: InformeImport | null) => void
}

/** Resumen legible del informe de importación. */
function DetalleInforme({ informe }: { informe: InformeImport }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
      <li>{informe.filasAceptadas} apunte(s) aceptado(s).</li>
      {informe.ejemplosDetectados > 0 && (
        <li>{informe.ejemplosDetectados} fila(s) de ejemplo detectada(s).</li>
      )}
      {informe.filasRechazadas.length > 0 && (
        <li className="text-red-700 dark:text-red-400">
          {informe.filasRechazadas.length} fila(s) rechazada(s):
          <ul className="list-[circle] pl-5">
            {informe.filasRechazadas.slice(0, 8).map((r) => (
              <li key={r.fila}>Línea {r.fila}: {r.motivo}</li>
            ))}
            {informe.filasRechazadas.length > 8 && <li>…</li>}
          </ul>
        </li>
      )}
      {informe.avisos.slice(0, 8).map((a, i) => (
        <li key={i} className="text-amber-700 dark:text-amber-300">{a}</li>
      ))}
    </ul>
  )
}

/** Tarjeta de una sección con título y descripción. */
function Seccion({ titulo, desc, children }: { titulo: string; desc: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800" aria-labelledby={id}>
      <div>
        <h2 id={id} className="text-lg font-semibold">{titulo}</h2>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

/** Botón que abre el selector de fichero y entrega el File elegido. */
function BotonArchivo({
  children,
  accept,
  onArchivo,
  disabled,
  clase = BTN_PRIMARIO,
}: {
  children: ReactNode
  accept: string
  onArchivo: (file: File) => void
  disabled?: boolean
  clase?: string
}) {
  return (
    <label
      className={
        `${clase} cursor-pointer focus-within:ring-2 focus-within:ring-brand-500 ` +
        (disabled ? 'pointer-events-none opacity-50' : '')
      }
    >
      {children}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // permite reelegir el mismo fichero
          if (f) onArchivo(f)
        }}
      />
    </label>
  )
}

// ── 0 · Almacenamiento local (Archivo probatorio) ──────────────────────────

/**
 * Tema visual. No toca los datos del Libro: es una preferencia de este navegador, guardada
 * en `localStorage` (ver `src/ui/tema.ts`). El interruptor rápido está en la cabecera.
 */
function SeccionApariencia() {
  return (
    <Seccion
      titulo="Apariencia"
      desc="Elige el tema de la interfaz. El interruptor rápido claro/oscuro está siempre en la cabecera, junto al número de versión."
    >
      <SelectorTema />
    </Seccion>
  )
}

function SeccionAlmacenamiento() {
  const resumen = useLiveQuery(
    async () => {
      const justificantes = await listarJustificantes()
      const conFichero = justificantes.filter((j) => j.fichero).length
      return { n: justificantes.length, conFichero, bytes: await espacioArchivoUsado() }
    },
    [],
  )
  const datos = resumen.estado === 'listo' ? resumen.datos : { n: 0, conFichero: 0, bytes: 0 }

  return (
    <Seccion
      titulo="Almacenamiento local del Archivo"
      desc="Los ficheros que adjuntas a los justificantes se guardan en tu navegador (IndexedDB). Por defecto, un justificante es solo referencia + hash; adjuntar el fichero ocupa espacio local."
    >
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <div>
          <div className="text-2xl font-bold tabular-nums">{fmtBytes(datos.bytes)}</div>
          <div className="text-xs text-slate-500">ocupados por ficheros embebidos</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">{datos.n}</div>
          <div className="text-xs text-slate-500">
            justificante(s) · {datos.conFichero} con fichero adjunto
          </div>
        </div>
      </div>
    </Seccion>
  )
}

// ── 1 · Excel (plantilla del taller) ────────────────────────────────────────

function SeccionExcel({ accion, ocupado, setInforme, aviso }: Props) {
  const importar = (file: File) =>
    accion(async () => {
      const buffer = await leerArchivoBuffer(file)
      // Sonda: cuántas filas de ejemplo hay, para preguntar si excluirlas.
      const sonda = importarXlsx(buffer, { excluirEjemplos: false })
      let excluir = true
      if (sonda.informe.ejemplosDetectados > 0) {
        excluir = window.confirm(
          `Se han detectado ${sonda.informe.ejemplosDetectados} fila(s) de ejemplo ` +
            '(«EJEMPLO — borrar»). ¿Excluirlas de la importación?\n\n' +
            'Aceptar = excluirlas · Cancelar = importarlas también.',
        )
      }
      if (!window.confirm('Importar REEMPLAZA el Libro actual por el del fichero. ¿Continuar?')) return

      const contenido = importarXlsx(buffer, { excluirEjemplos: excluir })
      await reemplazarContenido(contenido)
      setInforme?.(contenido.informe)
      aviso('exito', `Importación XLSX completada (${contenido.informe.filasAceptadas} apuntes).`)
    })

  const exportar = () =>
    accion(async () => {
      const contenido = await exportarContenidoActual()
      const plantilla = await (await fetch(plantillaUrl)).arrayBuffer()
      const { archivos, avisos } = await exportarXlsx(contenido, plantilla)
      for (const a of archivos) descargarBytes(nombreFicheroXlsx(a.ejercicio), a.bytes, MIME_XLSX)
      aviso(
        avisos.length ? 'info' : 'exito',
        avisos.length
          ? `Exportados ${archivos.length} fichero(s). ${avisos.join(' ')}`
          : 'Libro exportado a la plantilla del taller. Ábrelo en Excel/LibreOffice: se recalcula solo.',
      )
    })

  return (
    <Seccion
      titulo="Excel — plantilla del taller"
      desc="Importa la PLANTILLA_TALLER.xlsx (hojas DIARIO, UBICACIONES y PARÁMETROS; las calculadas se ignoran) o exporta tu Libro a esa plantilla, que recalcula SALDOS, FIFO y CUADRE por sí misma."
    >
      <BotonArchivo
        accept=".xlsx"
        onArchivo={importar}
        disabled={ocupado}
        clase={BTN_SEC}
      >
        Importar XLSX…
      </BotonArchivo>
      <button type="button" className={BTN_PRIMARIO} onClick={exportar} disabled={ocupado}>
        Exportar a XLSX
      </button>
    </Seccion>
  )
}

// ── 2 · CSV genérico del taller ─────────────────────────────────────────────

function SeccionCsv({ accion, ocupado, setInforme, aviso }: Props) {
  const importar = (file: File) =>
    accion(async () => {
      const texto = await leerArchivoTexto(file)
      const res = importarCsvGenerico(texto)
      if (res.apuntes.length === 0) {
        aviso('error', 'El CSV no ha producido ningún apunte. Revisa el formato de columnas.')
        return
      }
      if (!window.confirm(
        `Se importarán ${res.apuntes.length} apunte(s) y REEMPLAZARÁN el Libro actual. ¿Continuar?`,
      )) return

      const ubicaciones = res.plataformas.map<Ubicacion>((nombre) => ({
        id: nombre, nombre, tipo: 'exchange', kyc: false, fechaAlta: '2000-01-01T00:00:00',
      }))
      const activos = activosDescubiertos(res.apuntes.flatMap(simbolosDeApunte))
      const contenido: ContenidoLibro = { apuntes: res.apuntes, ubicaciones, activos }
      await reemplazarContenido(contenido)
      setInforme?.(res.informe)
      aviso('exito', `Importación CSV completada (${res.informe.filasAceptadas} apuntes). Revisa ubicaciones y contravalores.`)
    })

  return (
    <Seccion
      titulo="CSV genérico del taller"
      desc="Importa el CSV genérico (mini_caso_generico.csv y afines). Casa automáticamente las parejas retirada/depósito de cripto en una TRANSFERENCIA. Tolera coma o punto decimal y fechas dd/mm/aaaa o ISO."
    >
      <BotonArchivo accept=".csv,text/csv" onArchivo={importar} disabled={ocupado}>
        Importar CSV…
      </BotonArchivo>
      <p className="w-full text-xs text-slate-500">
        ¿Vienes de un explorador de bloques (Etherscan, BscScan…)? Esos CSV van al apartado{' '}
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => irA('importar')}
        >
          Importar cadena
        </button>
        : ahí no se reemplaza el Libro, se AÑADE, y cada movimiento pasa por tu confirmación.
      </p>
    </Seccion>
  )
}

// ── 3 · Copia de seguridad JSON nativa ──────────────────────────────────────

function SeccionCopia({ accion, ocupado, aviso }: Props) {
  // Marca de la última copia (para el «última copia: …» y el recordatorio de Inicio).
  const copiaQ = useLiveQuery(estadoCopia, [])
  const marca = copiaQ.estado === 'listo' ? copiaQ.datos : {}

  // Estado del almacenamiento persistente del navegador (API fuera de Dexie).
  const [persistente, setPersistente] = useState<boolean | null>(null)
  useEffect(() => {
    let vivo = true
    void estadoAlmacenamientoPersistente().then((v) => vivo && setPersistente(v))
    return () => {
      vivo = false
    }
  }, [])

  const descargar = () =>
    accion(async () => {
      const snap = await snapshotActual()
      // Dato SENSIBLE (ENCARGO, Parte 2): la copia incluye las direcciones on-chain de las
      // ubicaciones —por defecto sí, porque una copia debe restaurar el Libro completo—, y
      // una dirección revela todo el historial de la cadena. Se avisa antes de descargar.
      const nDirecciones = snap.ubicaciones.reduce((n, u) => n + (u.direcciones?.length ?? 0), 0)
      if (nDirecciones > 0) {
        const seguir = window.confirm(
          `La copia incluye ${nDirecciones} dirección(es) on-chain de tus ubicaciones. ` +
            'Una dirección permite reconstruir todo tu historial en la cadena: guarda el fichero ' +
            'como guardarías un extracto bancario. ¿Descargar?',
        )
        if (!seguir) {
          aviso('info', 'Copia cancelada.')
          return
        }
      }
      const fecha = new Date().toISOString().slice(0, 10)
      descargarTexto(`libro-hesperides-copia-${fecha}.json`, exportarJson({ ...snap, exportadoEn: new Date().toISOString() }))
      // Registra la marca: alimenta el recordatorio suave de copia (P11).
      await registrarCopiaRealizada(new Date().toISOString(), snap.apuntes.length)
      aviso('exito', 'Copia de seguridad descargada (formato JSON nativo, versionado).')
    })

  const restaurar = (file: File) =>
    accion(async () => {
      const texto = await leerArchivoTexto(file)
      let snapshot
      try {
        snapshot = parsearSnapshot(texto)
      } catch (e) {
        aviso('error', e instanceof ErrorRestauracion ? e.message : 'No se pudo leer la copia.')
        return
      }
      if (!window.confirm('Restaurar SUSTITUYE por completo el Libro actual por la copia. ¿Continuar?')) return
      await restaurarSnapshot(snapshot)
      aviso('exito', `Libro restaurado (${snapshot.apuntes.length} apuntes).`)
    })

  return (
    <Seccion
      titulo="Copia de seguridad (JSON nativo)"
      desc="Formato propio y versionado: guarda TODO sin pérdida (apuntes, ubicaciones, activos, tolerancias, justificantes y saldos reales del cuadre). Ideal para respaldo y traslado entre navegadores."
    >
      <button type="button" className={BTN_PRIMARIO} onClick={descargar} disabled={ocupado}>
        Descargar copia
      </button>
      <BotonArchivo accept=".json,application/json" onArchivo={restaurar} disabled={ocupado} clase={BTN_SEC}>
        Restaurar copia…
      </BotonArchivo>
      <div className="w-full space-y-0.5 text-xs text-slate-500">
        <p>
          Incluye también las <strong>direcciones on-chain</strong> de tus ubicaciones (dato
          sensible): se avisa al descargar.
        </p>
        <p>
          {marca.ultimaCopiaEn
            ? `Última copia descargada: ${fmtFecha(marca.ultimaCopiaEn)} (${marca.apuntesEnUltimaCopia ?? 0} apuntes).`
            : 'Aún no has descargado ninguna copia desde este navegador.'}
        </p>
        <p>
          Almacenamiento persistente del navegador:{' '}
          {persistente === true && (
            <span className="text-semaforo-ok">concedido (el navegador no purgará tus datos por falta de espacio).</span>
          )}
          {persistente === false && (
            <span className="text-semaforo-revisar">
              no concedido todavía — con más uso, el navegador suele concederlo; mientras tanto, la copia JSON es tu red de seguridad.
            </span>
          )}
          {persistente === null && 'no disponible en este navegador.'}
        </p>
      </div>
    </Seccion>
  )
}

// ── 4 · Zona peligrosa: borrado total (doble confirmación) ──────────────────

function SeccionPeligro({ accion, ocupado, aviso }: Props) {
  const borrar = () =>
    accion(async () => {
      if (!window.confirm('BORRADO TOTAL: se eliminarán TODOS los apuntes, ubicaciones y justificantes. ¿Seguro?')) return
      const escrito = window.prompt('Esta acción es irreversible. Escribe BORRAR para confirmar:')
      if (escrito?.trim().toUpperCase() !== 'BORRAR') {
        aviso('info', 'Borrado cancelado.')
        return
      }
      await borrarTodo()
      aviso('exito', 'Libro vaciado. Se han conservado los activos de serie (BTC/EUR) y las tolerancias por defecto.')
    })

  return (
    <Seccion
      titulo="Zona peligrosa"
      desc="Borrado total del Libro. Antes de borrar, descarga una copia de seguridad. Requiere doble confirmación."
    >
      <button type="button" className={BTN_PELIGRO} onClick={borrar} disabled={ocupado}>
        Borrar todo el Libro…
      </button>
    </Seccion>
  )
}
