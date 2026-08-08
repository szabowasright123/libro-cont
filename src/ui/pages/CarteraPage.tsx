/**
 * CarteraPage — pestaña «Cartera» (P9.2). Vista «enseña» de la cartera: TODO sale del motor
 * (saldos, cola FIFO, GyP por ejercicio) + un único dato nuevo del usuario, el PRECIO MANUAL.
 *
 * Local-first estricto (Regla de oro 3): los precios los teclea el alumno; PROHIBIDO cualquier
 * fetch/API de cotizaciones. El motor (src/engine) no se toca: esta página LEE sus resultados a
 * través de la capa pura `ui/cartera/valoracion`.
 */
import { useMemo, useRef, useState, type RefObject } from 'react'
import type { SimboloActivo } from '../../engine/types'
import {
  listarApuntes,
  listarUbicaciones,
  listarActivos,
  listarPrecios,
  listarRegistros,
  listarJustificantes,
  justificantesADominio,
  guardarPrecio,
  cargarCasoDemo,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { ejerciciosConDatos } from '../../engine/fiscal'
import {
  calcularCartera,
  gypRealizadaPorEjercicio,
  type ResumenCartera,
} from '../cartera/valoracion'
import { DonutDistribucion, type SegmentoDonut } from '../cartera/DonutDistribucion'
import { BarrasGyp } from '../cartera/BarrasGyp'
import { fmtDecimal, fmtEuro, fmtFecha, parseDecimalEntrada } from '../formato'
import { BTN_PRIMARIO, BTN_SEC, INPUT, Banner } from '../comp'

export function CarteraPage() {
  const apuntesQ = useLiveQuery(listarApuntes, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])
  const activosQ = useLiveQuery(listarActivos, [])
  const preciosQ = useLiveQuery(listarPrecios, [])
  const registrosQ = useLiveQuery(listarRegistros, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])

  const apuntes = apuntesQ.estado === 'listo' ? apuntesQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []
  const activos = activosQ.estado === 'listo' ? activosQ.datos : []
  const precios = preciosQ.estado === 'listo' ? preciosQ.datos : []
  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []
  const justificantes = justificantesQ.estado === 'listo' ? justificantesQ.datos : []

  // Predicado esFiat desde el catálogo de activos (EUR de serie es fiat).
  const esFiat = useMemo(() => {
    const set = new Set(activos.filter((a) => a.esFiat).map((a) => a.simbolo))
    set.add('EUR')
    return (a: string) => set.has(a)
  }, [activos])

  // Precios manuales como Record<activo, precioEur> para la capa de valoración.
  const preciosRecord = useMemo(() => {
    const out: Record<string, string> = {}
    for (const p of precios) out[p.activo] = p.precioEur
    return out
  }, [precios])

  const { resumen, error } = useMemo(() => {
    try {
      return { resumen: calcularCartera(apuntes, preciosRecord, esFiat), error: null as string | null }
    } catch (e) {
      return { resumen: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [apuntes, preciosRecord, esFiat])

  const justificantesDom = useMemo(
    () => justificantesADominio(justificantes, registros),
    [justificantes, registros],
  )
  const gyp = useMemo(
    () => gypRealizadaPorEjercicio(apuntes, ubicaciones, justificantesDom),
    [apuntes, ubicaciones, justificantesDom],
  )

  const ejercicios = useMemo(() => ejerciciosConDatos(apuntes), [apuntes])
  const [ejercicio, setEjercicio] = useState<number | null>(null)
  const ejercicioActivo = ejercicio ?? ejercicios[0] ?? new Date().getFullYear()
  const gypEjercicio = gyp.find((g) => g.ejercicio === ejercicioActivo)?.netoEUR ?? '0'

  // Fecha de introducción de los precios (la más reciente) para el chip.
  const fechaPrecios = precios.reduce<string | null>(
    (acc, p) => (acc === null || p.fechaISO > acc ? p.fechaISO : acc),
    null,
  )

  // Foco a la columna de precios («Actualizar precios…»).
  const primerPrecioRef = useRef<HTMLInputElement>(null)
  const enfocarPrecios = () => {
    primerPrecioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    primerPrecioRef.current?.focus()
  }

  const cargarDemo = async () => {
    await cargarCasoDemo()
  }

  // Estado vacío: sin apuntes.
  if (apuntesQ.estado === 'listo' && apuntes.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Cartera</h1>
        </header>
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-600">
            Aún no hay apuntes: no hay cartera que valorar. Registra operaciones en el Diario o
            carga el caso de ejemplo para verla en acción.
          </p>
          <button type="button" className={`${BTN_PRIMARIO} mt-4`} onClick={cargarDemo}>
            Cargar caso de ejemplo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Fila superior. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Cartera</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700">
            Precios manuales
            {fechaPrecios ? ` · introducidos el ${fmtFecha(fechaPrecios)}` : ''} · nada sale de tu
            navegador
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600">
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
          <button type="button" className={BTN_SEC} onClick={enfocarPrecios}>
            Actualizar precios…
          </button>
        </div>
      </header>

      {error && <Banner tono="error">No se pudo calcular la cartera: {error}</Banner>}

      {resumen && (
        <>
          {/* 4 tarjetas de resumen. */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta
              etiqueta="Valor estimado"
              valor={resumen.valorTotalEUR}
              acentuada
            />
            <Tarjeta etiqueta="Coste FIFO restante (cripto)" valor={resumen.costeRestanteCriptoEUR} />
            <Tarjeta etiqueta={`GyP realizada · ${ejercicioActivo}`} valor={gypEjercicio} signo />
            <Tarjeta
              etiqueta="Plusvalía latente (cripto)"
              valor={resumen.plusvaliaLatenteEUR}
              signo
              subtitulo="no realizada — no tributa aún"
            />
          </section>

          {/* Gráficos. */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-stone-700">Distribución por activo</h2>
              <GraficoDistribucion resumen={resumen} />
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-stone-700">
                GyP realizada por ejercicio
              </h2>
              {gyp.length > 0 ? (
                <BarrasGyp datos={gyp} />
              ) : (
                <p className="py-8 text-center text-sm text-stone-400">Sin transmisiones aún.</p>
              )}
            </div>
          </section>

          {/* Tabla de posiciones (vista accesible de los gráficos). */}
          <TablaPosiciones resumen={resumen} onGuardar={guardarPrecio} primerRef={primerPrecioRef} />
        </>
      )}

      {/* Pie. */}
      <p className="text-center text-xs text-stone-400">
        Valoración orientativa a precios manuales. No es asesoramiento ni declaración.
      </p>
    </div>
  )
}

/** Una tarjeta de resumen. La acentuada lleva borde naranja suave. */
function Tarjeta({
  etiqueta,
  valor,
  acentuada,
  signo,
  subtitulo,
}: {
  etiqueta: string
  valor: string | null
  acentuada?: boolean
  signo?: boolean
  subtitulo?: string
}) {
  const negativo = valor !== null && Number(valor) < 0
  const positivo = signo && valor !== null && Number(valor) > 0
  return (
    <div
      className={
        'rounded-lg border bg-white p-3 ' + (acentuada ? 'border-brand-200' : 'border-stone-200')
      }
    >
      <div className="text-xs text-stone-500">{etiqueta}</div>
      <div
        className={
          'text-lg font-bold tabular-nums ' +
          (negativo ? 'text-semaforo-error' : positivo ? 'text-brand-600' : 'text-stone-900')
        }
      >
        {valor === null ? '—' : `${positivo ? '+' : ''}${fmtEuro(valor)}`}
      </div>
      {subtitulo && <div className="mt-0.5 text-[11px] text-stone-400">{subtitulo}</div>}
    </div>
  )
}

/** Donut + leyenda (etiquetado directo). Agrupa el 5.º cripto en adelante en «Otros». */
function GraficoDistribucion({ resumen }: { resumen: ResumenCartera }) {
  const conValor = resumen.posiciones.filter((p) => p.valorEUR !== null)
  const totalNum = conValor.reduce((acc, p) => acc + Number(p.valorEUR), 0)

  const normales = conValor.filter((p) => !p.agrupadaEnOtros)
  const agrupadas = conValor.filter((p) => p.agrupadaEnOtros)
  const segmentos: SegmentoDonut[] = normales.map((p) => ({
    label: p.activo,
    valor: Number(p.valorEUR),
    valorTexto: fmtEuro(p.valorEUR),
    pct: p.pesoPct ?? 0,
    color: p.color,
  }))
  if (agrupadas.length > 0) {
    const valor = agrupadas.reduce((acc, p) => acc + Number(p.valorEUR), 0)
    segmentos.push({
      label: 'Otros',
      valor,
      valorTexto: fmtEuro(String(valor)),
      pct: totalNum > 0 ? (valor / totalNum) * 100 : 0,
      color: '#8a857e',
    })
  }

  if (conValor.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-stone-400">
        Introduce precios para valorar la cartera.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <DonutDistribucion segmentos={segmentos} totalTexto={fmtEuro(resumen.valorTotalEUR)} />
      <ul className="min-w-0 flex-1 space-y-1 text-sm">
        {segmentos.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="font-medium text-stone-700">{s.label}</span>
            <span className="ml-auto tabular-nums text-stone-600">{s.valorTexto}</span>
            <span className="w-12 text-right tabular-nums text-stone-400">
              {s.pct.toFixed(1).replace('.', ',')} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tabla «Posiciones» con precio manual editable en línea. */
function TablaPosiciones({
  resumen,
  onGuardar,
  primerRef,
}: {
  resumen: ResumenCartera
  onGuardar: (activo: SimboloActivo, precioEur: string, fechaISO: string) => Promise<void>
  primerRef: RefObject<HTMLInputElement>
}) {
  // Estado de edición en curso por activo (texto tal cual lo teclea el alumno, es-ES).
  const [edicion, setEdicion] = useState<Record<string, string>>({})

  const confirmar = async (activo: string) => {
    const bruto = edicion[activo]
    if (bruto === undefined) return
    const normal = parseDecimalEntrada(bruto)
    const valido = normal === '' || /^-?\d+(\.\d+)?$/.test(normal)
    await onGuardar(activo, valido ? normal : '', new Date().toISOString().slice(0, 10))
    setEdicion((e) => {
      const { [activo]: _drop, ...resto } = e
      return resto
    })
  }

  // El primer input cripto recibe la ref (para «Actualizar precios…»).
  let primerAsignado = false

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-stone-900">Posiciones</h2>
      <div className="overflow-x-auto rounded-md border border-stone-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">Activo</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2 text-right font-medium">Coste FIFO restante</th>
              <th className="px-3 py-2 text-right font-medium">Precio manual (EUR)</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">Peso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {resumen.posiciones.map((p) => {
              const editable = !p.esFiat
              const asignarRef = editable && !primerAsignado
              if (asignarRef) primerAsignado = true
              const valorInput = edicion[p.activo] ?? (p.precioEur ? fmtDecimal(p.precioEur) : '')
              return (
                <tr key={p.activo} className="hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="font-medium text-stone-800">{p.activo}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(p.saldo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                    {p.costeFifoRestanteEUR === null ? '—' : fmtEuro(p.costeFifoRestanteEUR)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editable ? (
                      <input
                        ref={asignarRef ? primerRef : undefined}
                        className={`${INPUT} inline-block w-28 text-right`}
                        inputMode="decimal"
                        aria-label={`Precio manual de ${p.activo} en euros`}
                        placeholder="p. ej. 60.000"
                        value={valorInput}
                        onChange={(e) => setEdicion((s) => ({ ...s, [p.activo]: e.target.value }))}
                        onBlur={() => void confirmar(p.activo)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void confirmar(p.activo)
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                      />
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-stone-800">
                    {p.valorEUR === null ? '—' : fmtEuro(p.valorEUR)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                    {p.pesoPct === null ? '—' : `${p.pesoPct.toFixed(1).replace('.', ',')} %`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
