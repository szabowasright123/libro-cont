/**
 * TrazabilidadPage — el corazón docente del Bloque 1 (P6).
 *
 * Dos vistas sobre el origen KYC / no-KYC del patrimonio:
 *  1. Cartera por origen: SALDOS por ubicación × activo descompuestos en la parte de origen
 *     KYC y la de origen no-KYC (con sello visual). Es la hoja SALDOS «con sello».
 *  2. Informe «¿cómo demuestro este saldo?»: al elegir una celda, la cadena probatoria hacia
 *     atrás (apuntes → lotes de origen → justificantes → huecos), exportable a HTML
 *     imprimible (el «expediente modelo» del taller).
 *
 * El cálculo (propagación de origen, cadena probatoria) vive en el motor
 * (`engine/trazabilidad`); aquí solo presentación y el pegamento con la capa de datos.
 */
import { useMemo, useState } from 'react'
import type { RefUbicacion, SimboloActivo } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import {
  calcularTrazabilidad,
  cadenaProbatoria,
  type CarteraOrigenCelda,
} from '../../engine/trazabilidad'
import {
  listarRegistros,
  listarJustificantes,
  listarUbicaciones,
  aDominio,
  justificantesADominio,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { fmtDecimal, fmtUbicacion } from '../formato'
import { descargarTexto } from '../descargas'
import { BTN_PRIMARIO, BTN_SEC, Modal, Banner } from '../comp'
import { SelloKyc } from '../trazabilidad/SelloKyc'
import { SeccionCuadre } from '../trazabilidad/SeccionCuadre'
import { construirInformeHtml } from '../trazabilidad/informeHtml'
import { InformeCadena } from '../trazabilidad/InformeCadena'
import { UnidadManual } from '../guia/UnidadManual'

export function TrazabilidadPage() {
  const registrosQ = useLiveQuery(listarRegistros, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])

  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []
  const justificantes = justificantesQ.estado === 'listo' ? justificantesQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []

  const [seleccion, setSeleccion] = useState<{ ubicacion: RefUbicacion; activo: SimboloActivo } | null>(null)
  const [soloConSaldo, setSoloConSaldo] = useState(true)

  const apuntes = useMemo(() => aDominio([...registros]), [registros])
  const justificantesDom = useMemo(
    () => justificantesADominio(justificantes, registros),
    [justificantes, registros],
  )
  const nombrePorId = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones])
  const nombreUbic = (r: RefUbicacion) => fmtUbicacion(r, nombrePorId)

  // Cálculo de la trazabilidad (protegido: si el orden estuviera roto, no romper la página).
  const { traza, error } = useMemo(() => {
    try {
      return { traza: calcularTrazabilidad(apuntes, ubicaciones), error: null as string | null }
    } catch (e) {
      return { traza: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [apuntes, ubicaciones])

  const celdas = useMemo(() => {
    const todas = traza?.cartera ?? []
    const visibles = soloConSaldo ? todas.filter((c) => Number(c.total) !== 0 || c.deficit) : todas
    return visibles
  }, [traza, soloConSaldo])

  // Totales por origen (para el resumen de cabecera), sumando por activo.
  const resumenPorActivo = useMemo(() => {
    const mapa = new Map<SimboloActivo, { kyc: number; noKyc: number }>()
    for (const c of traza?.cartera ?? []) {
      const acc = mapa.get(c.activo) ?? { kyc: 0, noKyc: 0 }
      acc.kyc += Number(c.kyc)
      acc.noKyc += Number(c.noKyc)
      mapa.set(c.activo, acc)
    }
    return [...mapa.entries()]
      .filter(([, v]) => v.kyc !== 0 || v.noKyc !== 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [traza])

  const cadena = useMemo(() => {
    if (!traza || !seleccion) return null
    return cadenaProbatoria(
      traza,
      apuntes,
      justificantesDom,
      ubicaciones,
      seleccion.ubicacion,
      seleccion.activo,
    )
  }, [traza, seleccion, apuntes, justificantesDom, ubicaciones])

  const descargarInforme = () => {
    if (!cadena) return
    const html = construirInformeHtml(cadena, nombrePorId)
    const nombre = `expediente-${nombreUbic(cadena.ubicacion)}-${cadena.activo}.html`
      .replace(/[^\w.\-]+/g, '_')
    descargarTexto(nombre, html, 'text/html')
  }

  const imprimirInforme = () => {
    if (!cadena) return
    const html = construirInformeHtml(cadena, nombrePorId)
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    // Deja pintar antes de abrir el diálogo de impresión.
    setTimeout(() => win.print(), 250)
  }

  return (
    <div className="space-y-6">
      <UnidadManual ruta="trazabilidad" />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Trazabilidad y cuadre</h1>
        <p className="text-sm text-slate-500">
          Cuadra cada saldo contra su fuente con el semáforo, y mira de dónde procede: qué parte
          es de origen <SelloKyc kyc soloIcono /> KYC y qué parte <SelloKyc kyc={false} soloIcono />{' '}
          no-KYC. Elige una celda para ver «¿cómo demuestro este saldo?».
        </p>
      </header>

      {error && (
        <Banner tono="error">No se pudo calcular la trazabilidad: {error}</Banner>
      )}

      {/* Resumen por origen (patrimonio agregado por activo). */}
      {resumenPorActivo.length > 0 && (
        <section className="flex flex-wrap gap-3" aria-label="Resumen del patrimonio por origen">
          {resumenPorActivo.map(([activo, v]) => {
            const total = v.kyc + v.noKyc
            const pctKyc = total !== 0 ? (v.kyc / total) * 100 : 0
            return (
              <div
                key={activo}
                className="min-w-[13rem] flex-1 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">{activo}</span>
                  <span className="text-xs text-slate-500">
                    {fmtDecimal(String(Math.round(pctKyc * 10) / 10))}% KYC
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full bg-stone-400 dark:bg-stone-500" style={{ width: `${pctKyc}%` }} />
                  <div className="h-full bg-brand-500" style={{ width: `${100 - pctKyc}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                  <span className="text-stone-600 dark:text-stone-400">{fmtDecimal(String(v.kyc))} KYC</span>
                  <span className="text-brand-700 dark:text-amber-400">{fmtDecimal(String(v.noKyc))} no-KYC</span>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* Cuadre (semáforo de la Tabla 5): saldo real declarado vs saldo calculado. */}
      <SeccionCuadre apuntes={apuntes} nombreUbic={nombreUbic} />

      {/* Cartera por origen (SALDOS con sello). */}
      <section
        className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
        aria-labelledby="traz-cartera"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="traz-cartera" className="text-lg font-semibold">Cartera por origen</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={soloConSaldo}
              onChange={(e) => setSoloConSaldo(e.target.checked)}
            />
            Solo con saldo
          </label>
        </div>

        {celdas.length === 0 ? (
          <p className="text-sm text-slate-400">
            No hay saldos que mostrar. Registra apuntes en el Diario para ver su trazabilidad.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-sm" aria-labelledby="traz-cartera">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Ubicación</th>
                  <th scope="col" className="px-3 py-2 font-medium">Activo</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">KYC</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">no-KYC</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                  <th scope="col" className="px-3 py-2 font-medium">Origen</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {celdas.map((c) => (
                  <FilaCartera
                    key={`${c.ubicacion} ${c.activo}`}
                    celda={c}
                    nombreUbic={nombreUbic}
                    onElegir={() => setSeleccion({ ubicacion: c.ubicacion, activo: c.activo })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400">
          El reparto KYC/no-KYC sigue la convención de propagación del proyecto (D1),
          validada fiscalmente el 8-8-2026.
        </p>
      </section>

      {/* Informe «¿cómo demuestro este saldo?» */}
      <Modal
        titulo="¿Cómo demuestro este saldo?"
        abierto={seleccion !== null}
        onCerrar={() => setSeleccion(null)}
        ancho="max-w-3xl"
      >
        {cadena && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-bold tabular-nums">
                  {fmtDecimal(cadena.saldo)} {cadena.activo}
                </div>
                <div className="text-sm text-slate-500">en {nombreUbic(cadena.ubicacion)}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" className={BTN_SEC} onClick={descargarInforme}>
                  Descargar HTML
                </button>
                <button type="button" className={BTN_PRIMARIO} onClick={imprimirInforme}>
                  Imprimir
                </button>
              </div>
            </div>
            <InformeCadena cadena={cadena} nombreUbic={nombreUbic} />
          </div>
        )}
      </Modal>
    </div>
  )
}

/** Fila de la cartera por origen: una celda (ubicación × activo) con su reparto y sello. */
function FilaCartera({
  celda,
  nombreUbic,
  onElegir,
}: {
  celda: CarteraOrigenCelda
  nombreUbic: (r: RefUbicacion) => string
  onElegir: () => void
}) {
  const soloKyc = Number(celda.noKyc) === 0 && Number(celda.kyc) !== 0
  const soloNoKyc = Number(celda.kyc) === 0 && Number(celda.noKyc) !== 0
  const mezcla = Number(celda.kyc) !== 0 && Number(celda.noKyc) !== 0
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <td className="px-3 py-2 font-medium">{nombreUbic(celda.ubicacion)}</td>
      <td className="px-3 py-2">{celda.activo}</td>
      <td className="px-3 py-2 text-right tabular-nums text-stone-600 dark:text-stone-400">
        {fmtDecimal(celda.kyc)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-brand-700 dark:text-amber-400">
        {fmtDecimal(celda.noKyc)}
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">
        {fmtDecimal(celda.total)}
        {celda.deficit && (
          <span
            className="ml-1 text-red-600"
            role="img"
            aria-label="Salida sin origen suficiente (saldo negativo)"
            title="Salida sin origen suficiente (saldo negativo)"
          >
            ⚠
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {mezcla ? (
          <span className="inline-flex items-center gap-1">
            <SelloKyc kyc soloIcono />
            <SelloKyc kyc={false} soloIcono />
            <span className="text-xs text-slate-400">mezcla</span>
          </span>
        ) : soloKyc ? (
          <SelloKyc kyc />
        ) : soloNoKyc ? (
          <SelloKyc kyc={false} />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          className={BTN_SEC}
          aria-label={`¿Cómo demuestro el saldo de ${celda.activo} en ${nombreUbic(celda.ubicacion)}?`}
          onClick={onElegir}
          disabled={celda.ubicacion === UBICACION_EXTERIOR}
        >
          ¿Cómo lo demuestro?
        </button>
      </td>
    </tr>
  )
}
