/**
 * TablaConciliacionFifo — la conciliación cola FIFO ↔ saldos, activo por activo.
 *
 * Es la casilla que el manual exigía desde el principio ([MT] Anexo D, octava fila; U7.5) y
 * que la app no comprobaba en ninguna parte hasta la v1.6.0. Merece tabla propia y no una
 * línea de resumen: cuando falla, lo que hay que ver es QUÉ activo y POR QUÉ, no un semáforo
 * global. Presentación pura; el cálculo es de `engine/conciliacion.ts`.
 */
import type { EstadoSemaforo } from '../../engine/types'
import { TEXTO_MOTIVO, type ResultadoConciliacion } from '../../engine/conciliacion'
import { fmtDecimal } from '../formato'

/** Semáforo con el mismo lenguaje visual que el resto del Libro. */
const SEMAFORO: Readonly<Record<EstadoSemaforo, { texto: string; clase: string }>> = {
  OK: { texto: 'OK', clase: 'text-semaforo-ok' },
  REVISAR: { texto: 'REVISAR', clase: 'text-semaforo-revisar' },
  ERROR: { texto: 'ERROR', clase: 'text-semaforo-error' },
}

export function TablaConciliacionFifo({
  conciliacion,
  corte,
}: {
  conciliacion: ResultadoConciliacion
  corte: string
}) {
  const global = SEMAFORO[conciliacion.estadoGlobal]
  const motivos = [...new Set(conciliacion.filas.flatMap((f) => f.motivos))]

  return (
    <section
      className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
      aria-labelledby="cierre-conciliacion"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cierre-conciliacion" className="text-lg font-semibold">
          La cola FIFO y el saldo, activo por activo
        </h2>
        <span className={`text-sm font-semibold ${global.clase}`}>
          <span aria-hidden="true">●</span> {global.texto}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        El CUADRE mira hacia fuera —el saldo calculado contra el que declara el exchange— y por
        eso no puede ver un error de clasificación. Esta comprobación mira hacia dentro: las
        existencias vivas de la cola FIFO contra la suma de saldos, a {corte}. Si difieren, la
        misma cripto tiene dos historias distintas en el mismo Libro. [MT] U7.5 y Anexo D.
      </p>

      {conciliacion.filas.length === 0 ? (
        <p className="text-sm text-slate-400">
          No hay ningún activo con cola FIFO ni con saldo a esta fecha. El euro no entra: es la
          moneda de cuenta, no un elemento patrimonial cuyo coste se siga.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Conciliación entre las existencias de la cola FIFO y la suma de saldos, por activo
              </caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Activo
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Suma de saldos
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Existencias FIFO
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Diferencia
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Semáforo
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Apuntes implicados
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {conciliacion.filas.map((f) => {
                  const s = SEMAFORO[f.estado]
                  return (
                    <tr key={f.activo}>
                      <td className="px-3 py-2 font-medium">{f.activo}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(f.saldoTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtDecimal(f.existenciasFifo)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          f.estado === 'OK' ? '' : 'font-semibold ' + s.clase
                        }`}
                      >
                        {fmtDecimal(f.diferencia)}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${s.clase}`}>
                        <span aria-hidden="true">●</span> {s.texto}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">
                        {f.apuntesImplicados.length > 0 ? f.apuntesImplicados.join(', ') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {motivos.length > 0 && (
            <ul className="space-y-1 text-xs leading-relaxed text-slate-500">
              {motivos.map((m) => (
                <li key={m}>
                  <span className="font-medium text-slate-600 dark:text-slate-300">Motivo:</span>{' '}
                  {TEXTO_MOTIVO[m]}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
