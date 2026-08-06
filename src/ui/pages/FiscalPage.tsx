/**
 * FiscalPage — Resumen fiscal orientativo del ejercicio (Bloque 3, P7).
 *
 * Presenta los cinco cajones fiscales (ahorro, RCM, actividad económica, base general,
 * pérdidas) que calcula `engine/fiscal`, el mapa orientativo a casillas de Renta
 * (`data/casillas-AAAA`), los avisos informativos 721 y 172/173, y el disclaimer permanente.
 * Exporta el resumen a HTML imprimible y a CSV.
 *
 * Regla de oro 5: los textos con calificación fiscal se muestran como {{TEXTO-MANUAL}} (los
 * pega el responsable). El motor solo aporta números.
 */
import { useMemo, useState } from 'react'
import type { SimboloActivo } from '../../engine/types'
import {
  calcularResumenFiscal,
  ejerciciosConDatos,
  CONCEPTOS_FISCALES,
  MARCADOR_TEXTO,
  type ConceptoFiscal,
  type ResumenFiscal,
} from '../../engine/fiscal'
import { casillasDeEjercicio, type MapaCasilla } from '../../data/casillas-2024'
import {
  listarRegistros,
  listarJustificantes,
  listarUbicaciones,
  aDominio,
  justificantesADominio,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { fmtDecimal, fmtEuro, fmtFecha, fmtUbicacion, aDecimalDominio } from '../formato'
import { descargarTexto } from '../descargas'
import { BTN_PRIMARIO, BTN_SEC, INPUT, Banner } from '../comp'
import { construirInformeFiscalHtml } from '../fiscal/informeFiscalHtml'
import { resumenFiscalACsv } from '../fiscal/fiscalCsv'
import { UnidadManual } from '../guia/UnidadManual'

/** Marcador de texto manual, resaltado para que se vea que falta el literal. */
function Marcador() {
  return (
    <code className="rounded border border-dashed border-yellow-500 bg-yellow-100 px-1 text-[11px] text-yellow-900 dark:border-yellow-700/70 dark:bg-yellow-900/30 dark:text-yellow-200">
      {MARCADOR_TEXTO}
    </code>
  )
}

/** Etiqueta legible del estado probatorio. */
const ESTADO_PROB: Record<string, { texto: string; clase: string }> = {
  completo: { texto: 'Completo', clase: 'text-semaforo-ok' },
  incompleto: { texto: 'Incompleto', clase: 'text-semaforo-revisar' },
  'sin-justificar': { texto: 'Sin justificar', clase: 'text-red-600 dark:text-red-400' },
}

export function FiscalPage() {
  const registrosQ = useLiveQuery(listarRegistros, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])

  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []
  const justificantes = justificantesQ.estado === 'listo' ? justificantesQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []

  const apuntes = useMemo(() => aDominio([...registros]), [registros])
  const justificantesDom = useMemo(
    () => justificantesADominio(justificantes, registros),
    [justificantes, registros],
  )
  const nombrePorId = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones])
  const nombreUbic = (r: string) => fmtUbicacion(r, nombrePorId)

  const ejercicios = useMemo(() => ejerciciosConDatos(apuntes), [apuntes])
  const [ejercicio, setEjercicio] = useState<number | null>(null)
  const ejercicioActivo = ejercicio ?? ejercicios[0] ?? new Date().getFullYear()

  // Precios de cierre (EUR por activo) para valorar el aviso 721. Local-first: los teclea el
  // alumno. Clave: símbolo; valor: cadena tal cual la escribe (se normaliza al calcular).
  const [precios, setPrecios] = useState<Record<SimboloActivo, string>>({})

  const valoracionCierre = useMemo(() => {
    const out: Record<SimboloActivo, string> = {}
    for (const [k, v] of Object.entries(precios)) {
      const d = aDecimalDominio(v)
      if (d) out[k] = d
    }
    return out
  }, [precios])

  const { resumen, error } = useMemo(() => {
    try {
      return {
        resumen: calcularResumenFiscal(apuntes, ubicaciones, justificantesDom, ejercicioActivo, {
          valoracionCierre,
        }),
        error: null as string | null,
      }
    } catch (e) {
      return { resumen: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [apuntes, ubicaciones, justificantesDom, ejercicioActivo, valoracionCierre])

  const { casillas, ejercicioMapa, esDelEjercicio } = casillasDeEjercicio(ejercicioActivo)

  const descargarHtml = () => {
    if (!resumen) return
    const html = construirInformeFiscalHtml(resumen, casillas, nombrePorId)
    descargarTexto(`resumen-fiscal-${resumen.ejercicio}.html`, html, 'text/html')
  }
  const imprimirHtml = () => {
    if (!resumen) return
    const html = construirInformeFiscalHtml(resumen, casillas, nombrePorId)
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 250)
  }
  const descargarCsv = () => {
    if (!resumen) return
    descargarTexto(`resumen-fiscal-${resumen.ejercicio}.csv`, resumenFiscalACsv(resumen, nombrePorId), 'text/csv')
  }

  return (
    <div className="space-y-6">
      <UnidadManual ruta="fiscal" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiscal</h1>
          <p className="text-sm text-slate-500">
            Resumen <strong>orientativo</strong> del ejercicio: ahorro, RCM, actividad económica,
            base general y pérdidas. Las calificaciones fiscales las fija el responsable
            (<Marcador />).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Ejercicio{' '}
            <select
              className={`${INPUT} inline-block w-auto`}
              value={ejercicioActivo}
              onChange={(e) => setEjercicio(Number(e.target.value))}
            >
              {(ejercicios.length > 0 ? ejercicios : [ejercicioActivo]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* Disclaimer permanente y visible (Regla 5, punto 4). */}
      <Banner tono="info">
        <strong>Resumen orientativo docente.</strong> No es asesoramiento fiscal ni una
        declaración, ni sustituye la revisión de un profesional. Las calificaciones, fechas de
        criterio y casillas marcadas <Marcador /> deben completarse con los literales del manual
        del taller. Los avisos 721 y 172/173 son informativos y nunca determinan una obligación.
      </Banner>

      {error && <Banner tono="error">No se pudo calcular el resumen fiscal: {error}</Banner>}

      {resumen && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_SEC} onClick={descargarHtml}>
              Descargar HTML
            </button>
            <button type="button" className={BTN_SEC} onClick={descargarCsv}>
              Descargar CSV
            </button>
            <button type="button" className={BTN_PRIMARIO} onClick={imprimirHtml}>
              Imprimir
            </button>
          </div>

          {/* KPIs por cajón. */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi etiqueta="Neto del ahorro" valor={resumen.ahorro.netoEUR} />
            <Kpi etiqueta="RCM" valor={resumen.rcm.totalEUR} />
            <Kpi etiqueta="Actividad económica" valor={resumen.actividadEconomica.totalEUR} />
            <Kpi etiqueta="Base general" valor={resumen.baseGeneral.totalEUR} />
            <Kpi etiqueta="Pérdidas (potencial)" valor={resumen.perdidas.totalEUR} tono="perdida" />
          </section>

          <CajonAhorro resumen={resumen} casillas={casillas} />
          <CajonIngresos titulo={CONCEPTOS_FISCALES.rcm.etiqueta} concepto="rcm" bloque={resumen.rcm} casillas={casillas} />
          <CajonIngresos
            titulo={CONCEPTOS_FISCALES['actividad-economica'].etiqueta}
            concepto="actividad-economica"
            bloque={resumen.actividadEconomica}
            casillas={casillas}
          />
          <CajonIngresos
            titulo={CONCEPTOS_FISCALES['base-general'].etiqueta}
            concepto="base-general"
            bloque={resumen.baseGeneral}
            casillas={casillas}
          />
          <CajonPerdidas resumen={resumen} casillas={casillas} />

          {/* Mapa a casillas de Renta. */}
          <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Mapa orientativo a casillas de Renta</h2>
            {!esDelEjercicio && (
              <Banner tono="info">
                No hay mapa de casillas para {ejercicioActivo}
                {ejercicioMapa ? ` (se muestra el de ${ejercicioMapa} como guía)` : ''}. El
                responsable mantiene un fichero <code>casillas-AAAA.ts</code> por ejercicio.
              </Banner>
            )}
            <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Apartado</th>
                    <th className="px-3 py-2 font-medium">Casilla</th>
                    <th className="px-3 py-2 font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {casillas.map((c) => (
                    <tr key={c.concepto}>
                      <td className="px-3 py-2">{c.apartado}</td>
                      <td className="px-3 py-2">{c.casilla.includes('{{') ? <Marcador /> : c.casilla}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {c.nota.includes('{{') ? <Marcador /> : c.nota}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Aviso 721 (saldos en el extranjero). */}
          <Aviso721 resumen={resumen} precios={precios} setPrecios={setPrecios} nombreUbic={nombreUbic} />

          {/* Nota 172/173. */}
          <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Nota informativa · Modelos 172 / 173</h2>
            <p className="text-sm text-slate-500">
              <Marcador /> — texto informativo del manual. Recordatorio: son declaraciones
              informativas de terceros (exchanges); esta app solo lo menciona como referencia.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

/** Tarjeta de KPI de un cajón. */
function Kpi({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: 'perdida' }) {
  const negativo = Number(valor) < 0 || tono === 'perdida'
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-xs text-slate-500">{etiqueta}</div>
      <div className={`text-lg font-bold tabular-nums ${negativo ? 'text-red-600 dark:text-red-400' : ''}`}>
        {fmtEuro(valor)}
      </div>
    </div>
  )
}

/** Fila de casilla orientativa bajo el título de un cajón. */
function CasillaLinea({ concepto, casillas }: { concepto: ConceptoFiscal; casillas: readonly MapaCasilla[] }) {
  const c = casillas.find((x) => x.concepto === concepto)
  if (!c) return null
  return (
    <p className="text-xs text-slate-500">
      Casilla orientativa: {c.casilla.includes('{{') ? <Marcador /> : c.casilla} · {c.apartado}
    </p>
  )
}

/** Línea de calificación fiscal (siempre {{TEXTO-MANUAL}} en este módulo). */
function CalificacionLinea() {
  return (
    <p className="text-xs text-slate-500">
      Calificación fiscal: <Marcador /> · Fecha de criterio: <Marcador />
    </p>
  )
}

/** Cajón del ahorro (transmisiones onerosas). */
function CajonAhorro({ resumen, casillas }: { resumen: ResumenFiscal; casillas: readonly MapaCasilla[] }) {
  const { ahorro } = resumen
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">
        {CONCEPTOS_FISCALES.ahorro.etiqueta}{' '}
        <span className="text-sm font-normal text-slate-400">· {CONCEPTOS_FISCALES.ahorro.baseImponible}</span>
      </h2>
      <CalificacionLinea />
      <CasillaLinea concepto="ahorro" casillas={casillas} />
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Apunte</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Activo</th>
              <th className="px-3 py-2 text-right font-medium">Valor neto</th>
              <th className="px-3 py-2 text-right font-medium">Coste FIFO</th>
              <th className="px-3 py-2 text-right font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {ahorro.operaciones.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                  Sin transmisiones onerosas en el ejercicio.
                </td>
              </tr>
            ) : (
              ahorro.operaciones.map((o) => (
                <tr key={o.apunteId} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{o.apunteId}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtFecha(o.fechaHora)}</td>
                  <td className="px-3 py-2">{o.tipo}</td>
                  <td className="px-3 py-2">{o.activo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(o.valorTransmisionNetoEUR)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(o.costeFifoEUR)}</td>
                  <td className={`px-3 py-2 text-right font-medium tabular-nums ${o.ganancia ? '' : 'text-red-600 dark:text-red-400'}`}>
                    {fmtEuro(o.resultadoEUR)}
                    {o.saldoFifoInsuficiente && (
                      <span className="ml-1 text-red-600" title="FIFO insuficiente: resultado inflado">
                        ⚠
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 text-sm font-semibold dark:border-slate-700">
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right">Ganancias</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtEuro(ahorro.gananciasEUR)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right">Pérdidas de transmisión</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtEuro(ahorro.perdidasEUR)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right">Neto del ahorro</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtEuro(ahorro.netoEUR)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

/** Cajón de ingresos (RCM / actividad económica / base general). */
function CajonIngresos({
  titulo,
  concepto,
  bloque,
  casillas,
}: {
  titulo: string
  concepto: ConceptoFiscal
  bloque: ResumenFiscal['rcm']
  casillas: readonly MapaCasilla[]
}) {
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">
        {titulo}{' '}
        <span className="text-sm font-normal text-slate-400">· {CONCEPTOS_FISCALES[concepto].baseImponible}</span>
      </h2>
      <CalificacionLinea />
      <CasillaLinea concepto={concepto} casillas={casillas} />
      {bloque.hayIncompletas && (
        <Banner tono="info">Alguna operación no traía contravalor EUR: revisa el diario (importe tomado como 0).</Banner>
      )}
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Apunte</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Activo</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="px-3 py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {bloque.partidas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  Sin operaciones en el ejercicio.
                </td>
              </tr>
            ) : (
              bloque.partidas.map((p) => (
                <tr key={p.apunteId} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.apunteId}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtFecha(p.fechaHora)}</td>
                  <td className="px-3 py-2">{p.activo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(p.cantidad)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(p.importeEUR)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 text-sm font-semibold dark:border-slate-700">
            <tr>
              <td colSpan={4} className="px-3 py-1.5 text-right">Total</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtEuro(bloque.totalEUR)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

/** Cajón de pérdidas (con estado probatorio y deducibilidad condicionada). */
function CajonPerdidas({ resumen, casillas }: { resumen: ResumenFiscal; casillas: readonly MapaCasilla[] }) {
  const { perdidas } = resumen
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">{CONCEPTOS_FISCALES.perdidas.etiqueta}</h2>
      <CalificacionLinea />
      <CasillaLinea concepto="perdidas" casillas={casillas} />
      <Banner tono="info">
        <strong>Deducibilidad condicionada</strong> a requisitos y prueba (dualidad DGT): <Marcador />.
        Cada pérdida muestra su estado probatorio del Archivo; sin expediente completo, su cómputo
        es dudoso.
      </Banner>
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Apunte</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Activo</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="px-3 py-2 text-right font-medium">Coste FIFO</th>
              <th className="px-3 py-2 text-right font-medium">Resultado</th>
              <th className="px-3 py-2 font-medium">Prueba</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {perdidas.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                  Sin pérdidas registradas en el ejercicio.
                </td>
              </tr>
            ) : (
              perdidas.items.map((p) => {
                const est = ESTADO_PROB[p.estadoProbatorio]!
                return (
                  <tr key={p.apunteId} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.apunteId}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtFecha(p.fechaHora)}</td>
                    <td className="px-3 py-2">{p.activo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(p.cantidad)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(p.costeFifoEUR)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-red-600 dark:text-red-400">
                      {fmtEuro(p.resultadoEUR)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-medium ${est.clase}`}>{est.texto}</span>
                      {p.faltantes.length > 0 && (
                        <div className="text-xs text-slate-400">
                          Faltan: {p.faltantes.map((f) => f.documento).join(' · ')}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 text-sm font-semibold dark:border-slate-700">
            <tr>
              <td colSpan={5} className="px-3 py-1.5 text-right">Total pérdidas (potencial)</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">
                {fmtEuro(perdidas.totalEUR)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

/** Aviso informativo del modelo 721 (saldos en el extranjero) con valoración de cierre. */
function Aviso721({
  resumen,
  precios,
  setPrecios,
  nombreUbic,
}: {
  resumen: ResumenFiscal
  precios: Record<string, string>
  setPrecios: (f: (p: Record<string, string>) => Record<string, string>) => void
  nombreUbic: (r: string) => string
}) {
  const aviso = resumen.avisoExtranjero
  // Activos no-EUR con saldo en el extranjero (para pedir su precio de cierre).
  const activosAValorar = useMemo(() => {
    const set = new Set<string>()
    for (const c of aviso.celdas) if (c.activo !== 'EUR') set.add(c.activo)
    return [...set].sort()
  }, [aviso.celdas])

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Aviso informativo · Modelo 721 (saldos en el extranjero)</h2>
      <p className="text-sm text-slate-500">
        <Marcador /> — Aviso, nunca cálculo de obligación. Saldos a 31/12/{resumen.ejercicio} en
        ubicaciones marcadas como <strong>extranjeras</strong> (márcalas en «Ubicaciones»). Umbral
        informativo: {fmtEuro(String(aviso.umbralEUR))}.
      </p>

      {!aviso.aplica ? (
        <p className="text-sm text-slate-400">
          No hay ubicaciones extranjeras con saldo. Marca una ubicación como extranjera para
          activar el aviso.
        </p>
      ) : (
        <>
          {activosAValorar.length > 0 && (
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <p className="mb-2 text-sm font-medium">Precios de cierre a 31/12 (EUR por unidad)</p>
              <div className="flex flex-wrap gap-3">
                {activosAValorar.map((a) => (
                  <label key={a} className="text-sm">
                    <span className="mr-1 font-mono">{a}</span>
                    <input
                      className={`${INPUT} inline-block w-32`}
                      inputMode="decimal"
                      placeholder="p. ej. 60.000"
                      value={precios[a] ?? ''}
                      onChange={(e) => setPrecios((p) => ({ ...p, [a]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Sin precio, la cripto queda «sin valorar» y el total del aviso es un mínimo.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                  <th className="px-3 py-2 font-medium">Activo</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo</th>
                  <th className="px-3 py-2 text-right font-medium">Valor EUR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {aviso.celdas.map((c) => (
                  <tr key={`${c.ubicacion} ${c.activo}`}>
                    <td className="px-3 py-2">
                      {nombreUbic(c.ubicacion)}
                      {c.pais && <span className="text-slate-400"> ({c.pais})</span>}
                    </td>
                    <td className="px-3 py-2">{c.activo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(c.saldo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.sinValorar ? <Marcador /> : fmtEuro(c.valorEUR)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 text-sm font-semibold dark:border-slate-700">
                <tr>
                  <td colSpan={3} className="px-3 py-1.5 text-right">Total valorado</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtEuro(aviso.totalValoradoEUR)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <Banner tono={aviso.supera ? 'info' : 'exito'}>
            {aviso.supera ? (
              <>
                El saldo valorado en el extranjero <strong>supera</strong> los{' '}
                {fmtEuro(String(aviso.umbralEUR))}. Revisa si procede presentar el modelo 721
                (aviso informativo, no una obligación determinada por la app).
              </>
            ) : (
              <>El saldo valorado en el extranjero no supera el umbral informativo.</>
            )}
            {aviso.haySinValorar && ' Hay activos sin precio de cierre: el total es un mínimo.'}
          </Banner>
        </>
      )}
    </section>
  )
}
