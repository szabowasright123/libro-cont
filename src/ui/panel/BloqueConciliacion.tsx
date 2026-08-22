/**
 * BloqueConciliacion — bloque 4 del Panel, y el corazón del Panel.
 *
 * `conciliarFifoSaldos` compara, activo a activo, las existencias vivas de la cola FIFO
 * contra la suma de saldos. Las dos cifras salen del mismo diario, así que —salvo error de
 * clasificación— tienen que coincidir.
 *
 * Por qué hay dos comprobaciones y no una, que es lo que la pantalla debe dejar claro de un
 * vistazo:
 *
 *   · el CUADRE mira hacia FUERA: saldo calculado contra el saldo real que el alumno lee en
 *     el exchange. Contesta «¿me falta un apunte?» y por eso NO puede ver un error de
 *     clasificación: si el bitcoin donado bajó del saldo, el saldo cuadra igual;
 *   · la CONCILIACIÓN mira hacia DENTRO: ese mismo saldo contra la cola FIFO. Contesta
 *     «¿está bien clasificado?» y solo falla por eso.
 *
 * Es el «error invisible» de [MT] U6.2 y la casilla de cierre a 31 de diciembre del Anexo D.
 *
 * Cada fila descuadrada muestra su motivo con el texto que exporta el propio motor
 * (`TEXTO_MOTIVO`, Regla de oro 5: el texto no se reescribe aquí) y despliega los apuntes
 * implicados, que es donde el alumno tiene que ir a arreglarlo.
 */
import { useMemo, useState } from 'react'
import type { Apunte, EstadoSemaforo } from '../../engine/types'
import {
  TEXTO_MOTIVO,
  type FilaConciliacion,
  type ResultadoConciliacion,
} from '../../engine/conciliacion'
import { irA } from '../shell/rutas'
import { fmtCantidad, fmtDecimal, fmtFechaHora } from '../formato'
import { BTN_SEC } from '../comp'


/** Presentación del semáforo (la misma que el CUADRE: mismo lenguaje visual). */
const SEMAFORO: Record<EstadoSemaforo, { texto: string; clase: string }> = {
  OK: { texto: '● OK', clase: 'text-semaforo-ok' },
  REVISAR: { texto: '● REVISAR', clase: 'text-semaforo-revisar' },
  ERROR: { texto: '● ERROR', clase: 'text-semaforo-error' },
}

export function BloqueConciliacion({
  conciliacion,
  apuntes,
}: {
  conciliacion: ResultadoConciliacion
  apuntes: Apunte[]
}) {
  const [abierta, setAbierta] = useState<string | null>(null)

  const porId = useMemo(() => new Map(apuntes.map((a) => [a.id, a])), [apuntes])
  const global = SEMAFORO[conciliacion.estadoGlobal]

  return (
    <section
      aria-labelledby="panel-conciliacion-titulo"
      className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="panel-conciliacion-titulo" className="text-lg font-semibold">
            4 · Conciliación FIFO ↔ saldos
          </h2>
          <p className="text-sm text-slate-500">
            El cuadre mira hacia fuera («¿me falta un apunte?»); la conciliación mira hacia
            dentro y compara ese mismo saldo con la cola FIFO («¿está bien clasificado?»).
          </p>
        </div>
        <span className={`text-sm font-semibold ${global.clase}`}>
          {global.texto}
          {conciliacion.activosDescuadrados > 0 && (
            <span className="ml-2 font-normal text-slate-500">
              {conciliacion.activosDescuadrados} activo
              {conciliacion.activosDescuadrados === 1 ? '' : 's'} sin conciliar
            </span>
          )}
        </span>
      </div>

      {conciliacion.filas.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay ningún activo con cola FIFO ni saldo que conciliar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Conciliación por activo entre las existencias vivas de la cola FIFO y la suma de
              saldos. Las filas descuadradas se despliegan con su motivo y sus apuntes.
            </caption>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Activo
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Existencias FIFO
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Suma de saldos
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Diferencia
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Estado
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Motivo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {conciliacion.filas.map((f) => (
                <FilaConciliacionVista
                  key={f.activo}
                  fila={f}
                  porId={porId}
                  desplegada={abierta === f.activo}
                  onAlternar={() => setAbierta(abierta === f.activo ? null : f.activo)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        El euro y las demás monedas fiat del catálogo quedan fuera: son moneda de cuenta y no
        abren cola FIFO, de modo que conciliarlas daría siempre un descuadre por el importe
        entero del saldo.
      </p>
    </section>
  )
}

/** Una fila de la conciliación y, desplegada, su motivo y los apuntes implicados. */
function FilaConciliacionVista({
  fila,
  porId,
  desplegada,
  onAlternar,
}: {
  fila: FilaConciliacion
  porId: Map<string, Apunte>
  desplegada: boolean
  onAlternar: () => void
}) {
  const est = SEMAFORO[fila.estado]
  const idDetalle = `panel-conciliacion-detalle-${fila.activo.replace(/\W+/g, '-')}`
  const descuadra = fila.estado !== 'OK'

  return (
    <>
      <tr
        className={
          (descuadra ? 'bg-red-50/60 dark:bg-red-950/20 ' : '') +
          (desplegada ? 'font-medium ' : '')
        }
      >
        <th scope="row" className="px-3 py-2 text-left font-semibold">
          {fila.activo}
        </th>
        <td className="px-3 py-2 text-right tabular-nums" title={fila.existenciasFifo}>
          {fmtCantidad(fila.existenciasFifo)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums" title={fila.saldoTotal}>
          {fmtCantidad(fila.saldoTotal)}
        </td>
        <td
          title={fila.diferencia}
          className={
            'px-3 py-2 text-right tabular-nums ' + (descuadra ? 'font-semibold text-semaforo-error' : '')
          }
        >
          {fmtCantidad(fila.diferencia)}
        </td>
        <td className="px-3 py-2">
          <span className={`font-semibold ${est.clase}`}>{est.texto}</span>
        </td>
        <td className="px-3 py-2">
          {descuadra ? (
            <button
              type="button"
              onClick={onAlternar}
              aria-expanded={desplegada}
              aria-controls={idDetalle}
              aria-label={`${desplegada ? 'Ocultar' : 'Ver'} el motivo del descuadre de ${fila.activo}`}
              className="rounded px-1.5 py-0.5 text-xs underline decoration-dotted underline-offset-4 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
            >
              <span aria-hidden="true">{desplegada ? '▾ ' : '▸ '}</span>
              Ver por qué
            </button>
          ) : (
            <span className="text-xs text-slate-400">Concilia</span>
          )}
        </td>
      </tr>

      {desplegada && descuadra && (
        <tr id={idDetalle}>
          <td colSpan={6} className="space-y-3 bg-slate-50/70 px-3 py-3 dark:bg-slate-900/50">
            <ul className="space-y-2">
              {fila.motivos.map((m) => (
                <li
                  key={m}
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {TEXTO_MOTIVO[m]}
                </li>
              ))}
            </ul>

            <ApuntesImplicados ids={fila.apuntesImplicados} porId={porId} />
          </td>
        </tr>
      )}
    </>
  )
}

/** Los apuntes que el motor señala como causa, con lo justo para reconocerlos. */
function ApuntesImplicados({
  ids,
  porId,
}: {
  ids: readonly string[]
  porId: Map<string, Apunte>
}) {
  if (ids.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        El motor no ha podido señalar apuntes concretos: hay que revisar el diario de este
        activo apunte a apunte.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">
        Apuntes implicados ({ids.length})
      </h3>
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">Apuntes que causan el descuadre.</caption>
        <thead className="text-left uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-2 py-1 font-medium">
              Apunte
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Fecha
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Tipo
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Sentido
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Movimiento
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {ids.map((id) => {
            const ap = porId.get(id)
            return (
              <tr key={id}>
                <td className="px-2 py-1 font-mono">{id}</td>
                <td className="px-2 py-1 whitespace-nowrap">{fmtFechaHora(ap?.fechaHora)}</td>
                <td className="px-2 py-1">{ap?.tipo ?? '—'}</td>
                <td className="px-2 py-1">
                  {ap?.sentido ?? (
                    <span className="text-semaforo-error">sin indicar</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  {ap?.cantidadSalida && ap.activoSalida
                    ? `− ${fmtDecimal(ap.cantidadSalida)} ${ap.activoSalida}`
                    : ''}
                  {ap?.cantidadEntrada && ap.activoEntrada
                    ? ` + ${fmtDecimal(ap.cantidadEntrada)} ${ap.activoEntrada}`
                    : ''}
                  {!ap && '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button type="button" className={`${BTN_SEC} mt-1`} onClick={() => irA('diario')}>
        Abrir el Diario para corregirlos
      </button>
    </div>
  )
}
