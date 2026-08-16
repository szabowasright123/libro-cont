/**
 * ArchivoPage — El Archivo (expediente probatorio, P5).
 *
 * Cuatro vistas sobre los justificantes del Libro:
 *  1. Resumen: nº de justificantes y espacio local que ocupan sus ficheros.
 *  2. Informe de completitud probatoria por ejercicio: % de apuntes con expediente
 *     completo y lista de huecos priorizada (PÉRDIDA, DONACIÓN y no-KYC primero).
 *  3. Explorador por carpeta convencional, con buscador.
 *  4. Huérfanos: justificantes sin apunte y apuntes sin justificante.
 *
 * El cálculo (checklist, estado, huecos, huérfanos) vive en el motor (`engine/archivo`);
 * aquí solo presentación y acciones sobre la base (borrar/descargar justificantes).
 */
import { useMemo, useState } from 'react'
import type { RutaConvencional, TipoOperacion } from '../../engine/types'
import { ETIQUETA_TIPO } from '../../engine/types'
import {
  CARPETAS_ARCHIVO,
  CHECKLIST_PROBATORIA,
  ETIQUETA_CARPETA,
  detectarHuerfanos,
  informeCompletitud,
  mapaKyc,
  type HuecoProbatorio,
} from '../../engine/archivo'
import type { JustificanteRegistro } from '../../data/tipos'
import {
  listarRegistros,
  listarJustificantes,
  listarUbicaciones,
  aDominio,
  justificantesADominio,
  eliminarJustificante,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { descargarBlob } from '../descargas'
import { fmtBytes, fmtFecha, fmtFechaHora } from '../formato'
import { BadgeEstadoProbatorio } from '../archivo/EstadoProbatorio'
import { BTN_SEC, BTN_PELIGRO, INPUT, Banner } from '../comp'
import { UnidadManual } from '../guia/UnidadManual'

/** Etiqueta legible de un documento a partir de su clave y el tipo del apunte. */
function etiquetaDocumento(tipo: TipoOperacion | undefined, clave: string): string {
  if (clave === 'otros') return 'Otro documento'
  const req = tipo ? CHECKLIST_PROBATORIA[tipo].requisitos.find((r) => r.clave === clave) : undefined
  return req?.documento ?? clave
}

export function ArchivoPage() {
  const registrosQ = useLiveQuery(listarRegistros, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])

  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []
  const justificantes = justificantesQ.estado === 'listo' ? justificantesQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []

  const [busqueda, setBusqueda] = useState('')
  const [ejercicio, setEjercicio] = useState<string>('')
  const [aviso, setAviso] = useState<string | null>(null)

  // Dominio para el motor.
  const apuntes = useMemo(() => aDominio([...registros]), [registros])
  const justificantesDom = useMemo(
    () => justificantesADominio(justificantes, registros),
    [justificantes, registros],
  )
  const kyc = useMemo(() => mapaKyc(ubicaciones), [ubicaciones])

  const apuntePorUid = useMemo(
    () => new Map(registros.map((r) => [r.uid, r])),
    [registros],
  )

  const espacioUsado = useMemo(
    () => justificantes.reduce((acc, j) => acc + (j.fichero?.size ?? 0), 0),
    [justificantes],
  )

  const ejercicios = useMemo(
    () => [...new Set(registros.map((r) => r.fechaHora.slice(0, 4)))].sort(),
    [registros],
  )

  const informe = useMemo(
    () => informeCompletitud(apuntes, justificantesDom, kyc, ejercicio ? Number(ejercicio) : undefined),
    [apuntes, justificantesDom, kyc, ejercicio],
  )

  const huerfanos = useMemo(
    () => detectarHuerfanos(apuntes, justificantesDom),
    [apuntes, justificantesDom],
  )

  // Justificantes agrupados por carpeta, con el apunte resuelto y filtro de búsqueda.
  const porCarpeta = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const mapa = new Map<RutaConvencional, FilaJustificante[]>()
    for (const j of justificantes) {
      const apRegistro = apuntePorUid.get(j.apunteUid)
      const tipo = apRegistro?.tipo
      const fila: FilaJustificante = {
        registro: j,
        apunteCorrelativo: apRegistro?.id ?? '(huérfano)',
        apunteTipo: tipo,
        documento: etiquetaDocumento(tipo, j.tipoDocumento),
        fechaApunte: apRegistro?.fechaHora,
      }
      if (q) {
        const heno = [
          fila.apunteCorrelativo,
          fila.documento,
          j.tipoDocumento,
          j.rutaConvencional,
          ETIQUETA_CARPETA[j.rutaConvencional],
          j.referenciaExterna,
          j.notas,
          j.hashSHA256,
          tipo ? ETIQUETA_TIPO[tipo] : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!heno.includes(q)) continue
      }
      const lista = mapa.get(j.rutaConvencional)
      if (lista) lista.push(fila)
      else mapa.set(j.rutaConvencional, [fila])
    }
    return mapa
  }, [justificantes, apuntePorUid, busqueda])

  const totalFiltrado = useMemo(
    () => [...porCarpeta.values()].reduce((n, l) => n + l.length, 0),
    [porCarpeta],
  )

  const borrar = async (j: JustificanteRegistro) => {
    if (!window.confirm('¿Borrar este justificante del Archivo?')) return
    await eliminarJustificante(j.id)
    setAviso('Justificante borrado.')
  }

  const descargar = (j: JustificanteRegistro) => {
    if (!j.fichero) return
    const nombre = (j.tipoDocumento || 'justificante') + nombreExtension(j.fichero.type)
    descargarBlob(nombre, j.fichero)
  }

  return (
    <div className="space-y-6">
      <UnidadManual ruta="archivo" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Archivo</h1>
          <p className="text-sm text-slate-500">
            El expediente probatorio: «¿cómo lo demuestro?». {justificantes.length} justificante(s) ·{' '}
            {fmtBytes(espacioUsado)} en tu navegador.
          </p>
        </div>
      </header>

      {aviso && (
        <Banner tono="exito" onCerrar={() => setAviso(null)}>
          {aviso}
        </Banner>
      )}

      {/* 1 · Informe de completitud */}
      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Completitud probatoria</h2>
          <label className="text-sm">
            <span className="mr-2 text-xs text-slate-500">Ejercicio</span>
            <select
              className={`${INPUT} w-32`}
              value={ejercicio}
              onChange={(e) => setEjercicio(e.target.value)}
              aria-label="Ejercicio del informe"
            >
              <option value="">Todos</option>
              {ejercicios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>

        <BarraCompletitud informe={informe} />

        {informe.huecos.length === 0 ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            {informe.total === 0
              ? 'No hay apuntes en este ejercicio.'
              : 'Todos los apuntes tienen su expediente completo. 🎉'}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-sm text-slate-500">
              Huecos priorizados ({informe.huecos.length}) — primero los de mayor exigencia
              probatoria (PÉRDIDA, DONACIÓN) y las adquisiciones sin KYC:
            </p>
            <ul className="space-y-1.5">
              {informe.huecos.slice(0, 30).map((h) => (
                <ListaHueco key={h.apunte.id} hueco={h} />
              ))}
              {informe.huecos.length > 30 && (
                <li className="text-xs text-slate-400">… y {informe.huecos.length - 30} más.</li>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* 2 · Explorador por carpeta */}
      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Explorador por carpeta</h2>
          <input
            className={`${INPUT} w-64`}
            placeholder="Buscar documento, apunte, hash, carpeta…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en el Archivo"
          />
        </div>

        {justificantes.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aún no hay justificantes. Adjúntalos desde el formulario de cada apunte (Diario).
          </p>
        ) : totalFiltrado === 0 ? (
          <p className="text-sm text-slate-400">Ningún justificante coincide con la búsqueda.</p>
        ) : (
          <div className="space-y-4">
            {CARPETAS_ARCHIVO.map((c) => {
              const filas = porCarpeta.get(c.ruta)
              if (!filas || filas.length === 0) return null
              return (
                <div key={c.ruta}>
                  <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                    <span className="font-mono text-xs text-slate-400">{c.ruta}/</span>
                    {c.etiqueta}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {filas.length}
                    </span>
                  </h3>
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {filas.map((f) => (
                      <FilaJustificanteVista
                        key={f.registro.id}
                        fila={f}
                        onBorrar={() => borrar(f.registro)}
                        onDescargar={() => descargar(f.registro)}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 3 · Huérfanos */}
      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Huérfanos</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-medium text-red-700 dark:text-red-400">
              Justificantes sin apunte ({huerfanos.justificantesSinApunte.length})
            </h3>
            {huerfanos.justificantesSinApunte.length === 0 ? (
              <p className="text-xs text-slate-400">Ninguno. Todo justificante está ligado a un apunte.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {huerfanos.justificantesSinApunte.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-300">
                      {etiquetaDocumento(undefined, j.tipoDocumento)} · {ETIQUETA_CARPETA[j.rutaConvencional]}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => {
                        const reg = justificantes.find((r) => r.id === j.id)
                        if (reg) void borrar(reg)
                      }}
                    >
                      Borrar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium text-amber-700 dark:text-amber-400">
              Apuntes sin justificante ({huerfanos.apuntesSinJustificante.length})
            </h3>
            {huerfanos.apuntesSinJustificante.length === 0 ? (
              <p className="text-xs text-slate-400">Ninguno. Todos los apuntes tienen algún justificante.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {huerfanos.apuntesSinJustificante.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{a.id}</span>
                    <span>{ETIQUETA_TIPO[a.tipo]}</span>
                    <span className="text-xs text-slate-400">{fmtFecha(a.fechaHora)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

/** Fila de justificante ya resuelta contra su apunte. */
interface FilaJustificante {
  registro: JustificanteRegistro
  apunteCorrelativo: string
  apunteTipo?: TipoOperacion
  documento: string
  fechaApunte?: string
}

/** Barra de progreso del % de completitud + contadores. */
function BarraCompletitud({ informe }: { informe: ReturnType<typeof informeCompletitud> }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{informe.porcentajeCompleto}% con expediente completo</span>
        <span className="text-xs text-slate-500">
          {informe.completos} completos · {informe.incompletos} incompletos ·{' '}
          {informe.sinJustificar} sin justificar · {informe.total} apuntes
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${informe.porcentajeCompleto}%` }}
        />
      </div>
    </div>
  )
}

/** Un hueco del informe (apunte incompleto o sin justificar). */
function ListaHueco({ hueco }: { hueco: HuecoProbatorio }) {
  const { apunte, estado, faltantes } = hueco
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-800">
      <span className="font-mono text-xs text-slate-400">{apunte.id}</span>
      <span className="font-medium">{ETIQUETA_TIPO[apunte.tipo]}</span>
      <span className="text-xs text-slate-400">{fmtFecha(apunte.fechaHora)}</span>
      <BadgeEstadoProbatorio estado={estado} />
      <span className="text-xs text-slate-500">
        Falta: {faltantes.map((f) => f.documento).join(', ') || '—'}
      </span>
    </li>
  )
}

/** Fila del explorador: un justificante con sus acciones. */
function FilaJustificanteVista({
  fila,
  onBorrar,
  onDescargar,
}: {
  fila: FilaJustificante
  onBorrar: () => void
  onDescargar: () => void
}) {
  const j = fila.registro
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
      <span className="font-medium">{fila.documento}</span>
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <span className="font-mono">{fila.apunteCorrelativo}</span>
        {fila.apunteTipo && <span>· {ETIQUETA_TIPO[fila.apunteTipo]}</span>}
        {fila.fechaApunte && <span>· {fmtFechaHora(fila.fechaApunte)}</span>}
      </span>
      {j.fichero ? (
        <span className="text-xs text-green-700 dark:text-green-400">📎 {fmtBytes(j.fichero.size)}</span>
      ) : j.referenciaExterna ? (
        <span className="max-w-[16rem] truncate text-xs text-slate-500" title={j.referenciaExterna}>
          🔗 {j.referenciaExterna}
        </span>
      ) : (
        <span className="text-xs text-amber-600">sin fichero ni referencia</span>
      )}
      {j.hashSHA256 && (
        <span className="font-mono text-[10px] text-slate-400" title={`SHA-256: ${j.hashSHA256}`}>
          {j.hashSHA256.slice(0, 12)}…
        </span>
      )}
      <span className="ml-auto flex items-center gap-1">
        {j.fichero && (
          <button type="button" className={BTN_SEC} onClick={onDescargar}>
            Descargar
          </button>
        )}
        <button type="button" className={BTN_PELIGRO} onClick={onBorrar}>
          Borrar
        </button>
      </span>
    </li>
  )
}

// ── Utilidades locales ──────────────────────────────────────────────────────

/** Extensión de fichero según el MIME (mínima; para nombrar la descarga). */
function nombreExtension(mime: string | undefined): string {
  if (!mime) return ''
  if (mime === 'application/pdf') return '.pdf'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/jpeg') return '.jpg'
  if (mime.startsWith('text/')) return '.txt'
  return ''
}
