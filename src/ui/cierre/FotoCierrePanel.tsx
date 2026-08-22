/**
 * FotoCierrePanel — la foto de saldos a 31 de diciembre, con la cotización y su fuente.
 *
 * «Es el dato que alimenta el 721 y el que abrirá el ejercicio siguiente con saldos
 * comprobados en lugar de heredados» ([MT] Anexo D, U10.3). Por eso la fuente de la cotización
 * es un campo de primera y no una nota al pie: una valoración sin fuente no se puede defender
 * cinco años después.
 *
 * Local-first estricto: los precios los teclea el alumno, nunca se piden por red.
 * Presentación pura; la foto la compone `engine/cierre.componerFotoCierre`.
 */
import { useId } from 'react'
import type { SimboloActivo } from '../../engine/types'
import type { CotizacionCierre, CotizacionesCierre, FotoCierre } from '../../engine/cierre'
import { fmtDecimal, fmtEuro } from '../formato'
import { INPUT, Banner } from '../comp'

export function FotoCierrePanel({
  foto,
  ejercicio,
  cotizaciones,
  onCambiar,
}: {
  foto: FotoCierre
  ejercicio: number
  cotizaciones: CotizacionesCierre
  onCambiar: (activo: SimboloActivo, cotizacion: CotizacionCierre) => void
}) {
  const ayuda = useId()
  // Activos que hay que valorar: los que tienen saldo y no son la moneda de cuenta.
  const aValorar = [...new Set(foto.filas.filter((f) => !f.esFiat).map((f) => f.activo))].sort()

  return (
    <section
      className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
      aria-labelledby="cierre-foto"
    >
      <div>
        <h2 id="cierre-foto" className="text-lg font-semibold">
          Foto de cierre a 31/12/{ejercicio}
        </h2>
        <p className="text-xs leading-relaxed text-slate-500">
          Saldos por ubicación y activo al cierre, con la cotización empleada y su fuente. Es el
          dato que alimenta el 721 y el que abrirá el ejercicio siguiente con saldos comprobados
          en lugar de heredados. [MT] U10.3.
        </p>
      </div>

      {aValorar.length > 0 && (
        <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <p className="mb-2 text-sm font-medium">Cotizaciones de cierre</p>
          <div className="space-y-2">
            {aValorar.map((activo) => {
              const cot = cotizaciones[activo]
              return (
                <div key={activo} className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="mr-1 font-mono">{activo}</span>
                    <input
                      className={`${INPUT} inline-block w-32`}
                      inputMode="decimal"
                      value={cot?.precioEUR ?? ''}
                      placeholder="p. ej. 100.000"
                      aria-label={`Cotización de cierre en euros por unidad de ${activo}`}
                      aria-describedby={ayuda}
                      onChange={(e) =>
                        onCambiar(activo, { precioEUR: e.target.value, fuente: cot?.fuente ?? '' })
                      }
                    />
                  </label>
                  <label className="min-w-[16rem] flex-1 text-sm">
                    <span className="sr-only">Fuente de la cotización de {activo}</span>
                    <input
                      className={INPUT}
                      value={cot?.fuente ?? ''}
                      placeholder={`Fuente de la cotización de ${activo} (exchange, fecha y hora)`}
                      aria-label={`Fuente de la cotización de ${activo}`}
                      aria-describedby={ayuda}
                      onChange={(e) =>
                        onCambiar(activo, {
                          precioEUR: cot?.precioEUR ?? '',
                          fuente: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              )
            })}
          </div>
          <p id={ayuda} className="mt-2 text-xs text-slate-400">
            Coma o punto decimal, como prefieras. Sin cotización el activo queda sin valorar y el
            total es un mínimo; sin fuente citada, la foto no está completa.
          </p>
        </div>
      )}

      {!foto.completa && foto.filas.length > 0 && (
        <Banner tono="info">
          La foto está a medias:{' '}
          {foto.activosSinCotizacion.length > 0 && (
            <>sin cotización: {foto.activosSinCotizacion.join(', ')}. </>
          )}
          {foto.activosSinFuente.length > 0 && (
            <>con cotización pero sin fuente citada: {foto.activosSinFuente.join(', ')}.</>
          )}
        </Banner>
      )}

      {foto.filas.length === 0 ? (
        <p className="text-sm text-slate-400">
          No queda saldo a 31/12/{ejercicio} en ninguna ubicación: el ejercicio siguiente abre en
          cero.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Saldos por ubicación y activo a 31 de diciembre de {ejercicio}
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
                  Saldo
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Cotización
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Valor
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Fuente
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {foto.filas.map((f) => (
                <tr key={`${f.ubicacion}-${f.activo}`}>
                  <td className="px-3 py-2">{f.nombreUbicacion}</td>
                  <td className="px-3 py-2">{f.activo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDecimal(f.saldo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.precioEUR === null ? (
                      <span className="text-semaforo-revisar">sin cotización</span>
                    ) : (
                      fmtEuro(f.precioEUR)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.valorEUR === null ? '—' : fmtEuro(f.valorEUR)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {f.fuente && f.fuente.trim() !== '' ? (
                      f.fuente
                    ) : (
                      <span className="text-semaforo-revisar">sin fuente citada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 text-sm font-semibold dark:border-slate-700">
              {foto.totalesPorActivo.map((t) => (
                <tr key={t.activo}>
                  <td className="px-3 py-1.5 text-right text-xs font-normal text-slate-500" colSpan={2}>
                    Total {t.activo}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtDecimal(t.cantidad)}</td>
                  <td />
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {t.valorEUR === null ? '—' : fmtEuro(t.valorEUR)}
                  </td>
                  <td />
                </tr>
              ))}
              <tr>
                <td className="px-3 py-1.5 text-right" colSpan={4}>
                  Total valorado{foto.activosSinCotizacion.length > 0 ? ' (mínimo)' : ''}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtEuro(foto.totalValoradoEUR)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
