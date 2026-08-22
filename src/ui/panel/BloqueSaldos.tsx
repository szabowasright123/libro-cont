/**
 * BloqueSaldos — bloque 1 del Panel: la hoja SALDOS con drill-down.
 *
 * La rejilla ubicación x activo del motor (`calcularSaldos`) con sus cuatro columnas
 * —entradas, salidas, comisiones y saldo— y la alerta roja del saldo negativo, que en el
 * taller significa siempre lo mismo: una salida sin origen registrado ([MT] U7).
 *
 * Lo que lo convierte en Panel y no en tabla es el desplegable: al abrir una celda aparecen
 * los apuntes que la mueven, en orden cronológico, cada uno con su aportación firmada y —la
 * columna que importa— el saldo acumulado tras él. Esa columna es la que deja ver de dónde
 * sale la cifra, que es la diferencia entre explicar el saldo y enseñarlo.
 */
import { useMemo, useState } from 'react'
import type { Apunte, RefUbicacion, SaldoCelda, SimboloActivo } from '../../engine/types'
import { fmtDecimal, fmtFechaHora } from '../formato'
import { claveCelda, type RejillaSaldos } from './modelo'
import { movimientosDeCelda, ETIQUETA_CONCEPTO } from './movimientos'
import { useCuerpoVirtual } from './virtual'

/** Alto de fila del desplegable (px). Sirve al virtualizador para estimar el scroll. */
const ALTO_FILA = 33

interface CeldaAbierta {
  ubicacion: RefUbicacion
  activo: SimboloActivo
}

export function BloqueSaldos({
  apuntes,
  rejilla,
  nombreUbic,
}: {
  apuntes: Apunte[]
  rejilla: RejillaSaldos
  nombreUbic: (r: RefUbicacion) => string
}) {
  const [abierta, setAbierta] = useState<CeldaAbierta | null>(null)

  // Solo las celdas con movimiento: la rejilla completa de la plantilla estaba llena de
  // huecos porque el Excel tenía un tamaño fijo; aquí no hace falta fingirlo.
  const filas = useMemo<SaldoCelda[]>(() => {
    const out: SaldoCelda[] = []
    for (const u of rejilla.ubicaciones) {
      for (const a of rejilla.activos) {
        const c = rejilla.celdas.get(claveCelda(u, a))
        if (c) out.push(c)
      }
    }
    return out
  }, [rejilla])

  if (filas.length === 0) return null

  return (
    <section
      aria-labelledby="panel-saldos-titulo"
      className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="panel-saldos-titulo" className="text-lg font-semibold">
            1 · Saldos
          </h2>
          <p className="text-sm text-slate-500">
            Saldo = entradas − salidas − comisiones, por ubicación y activo. Abre una fila
            para ver los apuntes que la mueven y el saldo acumulado tras cada uno.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Total por activo">
          {rejilla.activos.map((a) => (
            <li
              key={a}
              className="rounded-full border border-stone-200 px-2.5 py-0.5 dark:border-slate-700"
            >
              <span className="font-semibold">{a}</span>{' '}
              <span className="tabular-nums">{fmtDecimal(rejilla.totalPorActivo.get(a))}</span>
            </li>
          ))}
        </ul>
      </div>

      {rejilla.hayNegativos && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          Hay saldos negativos. Un saldo negativo es siempre una salida sin su origen
          registrado: falta el apunte que trajo esas unidades ([MT] U7).
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Saldos por ubicación y activo. Cada fila se despliega con los apuntes que la
            mueven y su saldo acumulado.
          </caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Ubicación
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Activo
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Entradas
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Salidas
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Comisiones
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filas.map((c) => {
              const clave = claveCelda(c.ubicacion, c.activo)
              const idDetalle = `panel-saldo-detalle-${clave.replace(/\W+/g, '-')}`
              const desplegada =
                abierta !== null && abierta.ubicacion === c.ubicacion && abierta.activo === c.activo
              return (
                <FilaSaldo
                  key={clave}
                  celda={c}
                  apuntes={apuntes}
                  nombreUbic={nombreUbic}
                  desplegada={desplegada}
                  idDetalle={idDetalle}
                  onAlternar={() =>
                    setAbierta(
                      desplegada ? null : { ubicacion: c.ubicacion, activo: c.activo },
                    )
                  }
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Una fila de la rejilla y, si está desplegada, su detalle debajo. */
function FilaSaldo({
  celda,
  apuntes,
  nombreUbic,
  desplegada,
  idDetalle,
  onAlternar,
}: {
  celda: SaldoCelda
  apuntes: Apunte[]
  nombreUbic: (r: RefUbicacion) => string
  desplegada: boolean
  idDetalle: string
  onAlternar: () => void
}) {
  const rotulo = `${celda.activo} en ${nombreUbic(celda.ubicacion)}`
  return (
    <>
      <tr className={desplegada ? 'bg-amber-50 dark:bg-amber-950/30' : ''}>
        <th scope="row" className="px-3 py-2 text-left font-medium">
          {nombreUbic(celda.ubicacion)}
        </th>
        <td className="px-3 py-2">{celda.activo}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(celda.entradas)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(celda.salidas)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(celda.comisiones)}</td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={desplegada}
            aria-controls={idDetalle}
            aria-label={`${desplegada ? 'Ocultar' : 'Ver'} los apuntes que mueven ${rotulo}`}
            className={
              'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 tabular-nums underline ' +
              'decoration-dotted underline-offset-4 hover:bg-slate-100 focus:outline-none ' +
              'focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 ' +
              (celda.negativo ? 'font-semibold text-semaforo-error' : '')
            }
          >
            <span aria-hidden="true" className="text-[10px] text-slate-400">
              {desplegada ? '▾' : '▸'}
            </span>
            {fmtDecimal(celda.saldo)}
          </button>
        </td>
      </tr>
      {desplegada && (
        <tr id={idDetalle}>
          <td colSpan={6} className="bg-slate-50/70 px-3 py-3 dark:bg-slate-900/50">
            <DetalleCelda
              apuntes={apuntes}
              ubicacion={celda.ubicacion}
              activo={celda.activo}
              saldoFinal={celda.saldo}
              nombreUbic={nombreUbic}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/** Los apuntes que mueven una celda, con su aportación y el saldo acumulado tras cada uno. */
function DetalleCelda({
  apuntes,
  ubicacion,
  activo,
  saldoFinal,
  nombreUbic,
}: {
  apuntes: Apunte[]
  ubicacion: RefUbicacion
  activo: SimboloActivo
  saldoFinal: string
  nombreUbic: (r: RefUbicacion) => string
}) {
  const movimientos = useMemo(
    () => movimientosDeCelda(apuntes, ubicacion, activo),
    [apuntes, ubicacion, activo],
  )
  const cuerpo = useCuerpoVirtual(movimientos.length, () => ALTO_FILA)

  if (movimientos.length === 0) {
    return <p className="text-sm text-slate-500">Ningún apunte mueve esta celda.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        {movimientos.length} movimiento{movimientos.length === 1 ? '' : 's'} de {activo} en{' '}
        {nombreUbic(ubicacion)}. La última línea del acumulado es el saldo de la fila:{' '}
        <span className="tabular-nums font-medium">{fmtDecimal(saldoFinal)}</span>.
      </p>
      <div
        ref={cuerpo.contenedorRef}
        className="max-h-80 overflow-y-auto rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      >
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">
            Apuntes que mueven el saldo de {activo} en {nombreUbic(ubicacion)}, en orden
            cronológico, con su aportación y el saldo acumulado.
          </caption>
          <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Apunte
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Fecha
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Tipo
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Concepto
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Contraparte
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Aportación
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Acumulado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {cuerpo.padTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={7} style={{ height: cuerpo.padTop }} />
              </tr>
            )}
            {cuerpo.indices.map((i) => {
              const m = movimientos[i]
              if (!m) return null
              const negativa = m.aportacion.startsWith('-')
              return (
                <tr key={`${m.apunteId}-${m.concepto}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <td className="px-2 py-1.5 font-mono">{m.apunteId}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtFechaHora(m.fechaHora)}</td>
                  <td className="px-2 py-1.5">{m.tipo}</td>
                  <td className="px-2 py-1.5">{ETIQUETA_CONCEPTO[m.concepto]}</td>
                  <td className="px-2 py-1.5">
                    {m.contraparte ? nombreUbic(m.contraparte) : '—'}
                  </td>
                  <td
                    className={
                      'px-2 py-1.5 text-right tabular-nums ' +
                      (negativa
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400')
                    }
                  >
                    {negativa ? '' : '+'}
                    {fmtDecimal(m.aportacion)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                    {fmtDecimal(m.acumulado)}
                  </td>
                </tr>
              )
            })}
            {cuerpo.padBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={7} style={{ height: cuerpo.padBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
