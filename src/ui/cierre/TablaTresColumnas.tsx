/**
 * TablaTresColumnas — la conciliación de marzo: qué dicen los datos fiscales, qué dice el
 * registro, y la explicación de cada diferencia ([MT] Anexo D, U10.2).
 *
 * No es un cálculo: es una tabla editable. El motor pone la columna del registro (lo que dice
 * el Libro) y calcula la diferencia; el alumno teclea lo que le han informado los modelos
 * 172/173 en sus datos fiscales y explica, una por una, las diferencias. Una diferencia sin
 * explicar hoy es una diferencia que habrá que reconstruir de memoria dentro de cuatro años.
 *
 * Presentación pura; la evaluación es de `engine/cierre.evaluarTresColumnas`.
 */
import { useId } from 'react'
import type {
  FilaTresColumnas,
  FilaTresColumnasEvaluada,
  ResultadoTresColumnas,
} from '../../engine/cierre'
import { fmtEuro } from '../formato'
import { BTN_SEC, INPUT, Banner } from '../comp'

export function TablaTresColumnas({
  filas,
  resultado,
  onCambiarFila,
  onAnadirFila,
  onEliminarFila,
  onProponer,
  hayPropuesta,
}: {
  /**
   * Las filas TAL Y COMO las teclea el alumno. Se pintan estas y no las evaluadas porque el
   * motor recibe los importes ya normalizados a punto decimal: devolver eso al `<input>`
   * reescribiría lo que el alumno está escribiendo mientras escribe.
   */
  filas: readonly FilaTresColumnas[]
  resultado: ResultadoTresColumnas
  onCambiarFila: (id: string, cambio: Partial<FilaTresColumnas>) => void
  onAnadirFila: () => void
  onEliminarFila: (id: string) => void
  onProponer: () => void
  hayPropuesta: boolean
}) {
  const ayuda = useId()
  const evaluada = new Map<string, FilaTresColumnasEvaluada>(
    resultado.filas.map((f) => [f.id, f]),
  )

  return (
    <section
      className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
      aria-labelledby="cierre-tres-columnas"
    >
      <div>
        <h2 id="cierre-tres-columnas" className="text-lg font-semibold">
          Conciliación a tres columnas
        </h2>
        <p id={ayuda} className="text-xs leading-relaxed text-slate-500">
          Qué dicen los datos fiscales, qué dice el registro y la explicación de cada diferencia.
          La primera columna la tecleas tú desde los datos fiscales de la Sede (lo que los
          modelos 172 y 173 han contado de ti); la segunda la propone el Libro y puedes
          corregirla. Cuando esté cerrada, descarga el informe y archívala. [MT] U10.2.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_SEC} onClick={onProponer} disabled={!hayPropuesta}>
          Proponer filas desde el registro
        </button>
        <button type="button" className={BTN_SEC} onClick={onAnadirFila}>
          Añadir fila
        </button>
      </div>
      {!hayPropuesta && (
        <p className="text-xs text-slate-400">
          No hay filas que proponer: los modelos 172 y 173 los presentan los proveedores
          establecidos en España, y no consta ninguna ubicación de tipo «exchange» sin marcar
          como extranjera. Añade las filas a mano.
        </p>
      )}

      {filas.length === 0 ? (
        <p className="text-sm text-slate-400">
          Todavía no hay ninguna fila. La conciliación que sale a cero también se hace y también
          se archiva: es la prueba de que se miró.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Conciliación entre los datos fiscales y el registro, con la explicación de cada
              diferencia
            </caption>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Concepto
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Datos fiscales
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Registro
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Diferencia
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Explicación
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filas.map((f) => {
                const ev = evaluada.get(f.id)
                const hayDiferencia = ev?.hayDiferencia === true
                const sinExplicar = ev?.sinExplicar === true
                return (
                <tr key={f.id}>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${INPUT} min-w-[14rem]`}
                      value={f.concepto}
                      aria-label={`Concepto de la fila ${f.id}`}
                      onChange={(e) => onCambiarFila(f.id, { concepto: e.target.value })}
                    />
                    {f.origen && f.origen !== 'libre' && (
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        Modelo {f.origen}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${INPUT} w-32 text-right`}
                      inputMode="decimal"
                      value={f.segunDatosFiscalesEUR}
                      aria-label={`Importe según los datos fiscales de ${f.concepto}`}
                      onChange={(e) =>
                        onCambiarFila(f.id, { segunDatosFiscalesEUR: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${INPUT} w-32 text-right`}
                      inputMode="decimal"
                      value={f.segunRegistroEUR}
                      aria-label={`Importe según el registro de ${f.concepto}`}
                      onChange={(e) => onCambiarFila(f.id, { segunRegistroEUR: e.target.value })}
                    />
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${
                      hayDiferencia ? 'font-semibold text-semaforo-revisar' : ''
                    }`}
                  >
                    {fmtEuro(ev?.diferenciaEUR ?? '0')}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${INPUT} min-w-[16rem]`}
                      value={f.explicacion}
                      aria-label={`Explicación de la diferencia de ${f.concepto}`}
                      aria-invalid={sinExplicar}
                      placeholder={hayDiferencia ? 'Explica la diferencia' : ''}
                      onChange={(e) => onCambiarFila(f.id, { explicacion: e.target.value })}
                    />
                    {sinExplicar && (
                      <span className="mt-0.5 block text-[11px] font-medium text-semaforo-error">
                        Diferencia sin explicar
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                      aria-label={`Eliminar la fila ${f.concepto}`}
                      onClick={() => onEliminarFila(f.id)}
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 text-sm font-semibold dark:border-slate-700">
              <tr>
                <td className="px-3 py-1.5">Totales</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtEuro(resultado.totalDatosFiscalesEUR)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtEuro(resultado.totalRegistroEUR)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtEuro(resultado.diferenciaTotalEUR)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {resultado.filasSinExplicar > 0 && (
        <Banner tono="info">
          Quedan {resultado.filasSinExplicar} de {resultado.filasConDiferencia} diferencias sin
          explicación escrita.
        </Banner>
      )}
    </section>
  )
}
