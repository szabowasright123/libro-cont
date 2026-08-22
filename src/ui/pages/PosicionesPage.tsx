/**
 * PosicionesPage — pestaña «Posiciones» (fase D1–D6).
 *
 * Una posición agrupa las patas de un mismo hecho económico a lo largo del tiempo:
 * aportación → recompensas → retirada. Sin esta vista, esas patas quedan desperdigadas por
 * el Diario en orden cronológico y reconstruir qué pasó con un pool es un ejercicio de
 * arqueología. Con ella, la operativa DeFi se vuelve legible.
 *
 * La posición NO participa en SALDOS ni en FIFO: es un índice sobre los apuntes. Todo lo que
 * se muestra aquí sale del motor o de los propios apuntes.
 */
import { useMemo, useState } from 'react'
import {
  listarPosiciones,
  listarApuntes,
  listarUbicaciones,
  actualizarPosicion,
  eliminarPosicion,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import {
  ETIQUETA_EVENTO,
  ETIQUETA_TIPO,
  esZonaGris,
  type Apunte,
  type EstadoPosicion,
} from '../../engine/types'
import { fmtEuro, fmtFechaHora } from '../formato'
import { BTN_PRIMARIO, BTN_PELIGRO, INPUT, Banner } from '../comp'
import { AsistenteEvento } from '../defi/AsistenteEvento'
import { ChipZonaGris } from '../defi/ChipZonaGris'

const ETIQUETA_ESTADO: Record<EstadoPosicion, string> = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  liquidada: 'Liquidada',
}

export function PosicionesPage() {
  const posicionesQ = useLiveQuery(listarPosiciones, [])
  const apuntesQ = useLiveQuery(listarApuntes, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])

  const posiciones = posicionesQ.estado === 'listo' ? posicionesQ.datos : []
  const apuntes = apuntesQ.estado === 'listo' ? apuntesQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []

  const [asistente, setAsistente] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Patas de cada posición, en orden cronológico. */
  const patasPorPosicion = useMemo(() => {
    const m = new Map<string, Apunte[]>()
    for (const ap of apuntes) {
      if (!ap.posicionId) continue
      const lista = m.get(ap.posicionId) ?? []
      lista.push(ap)
      m.set(ap.posicionId, lista)
    }
    for (const lista of m.values()) lista.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
    return m
  }, [apuntes])

  async function cerrarPosicion(id: string, estado: EstadoPosicion) {
    const patas = patasPorPosicion.get(id) ?? []
    const ultima = patas[patas.length - 1]?.fechaHora
    await actualizarPosicion(id, {
      estado,
      ...(estado !== 'abierta' && ultima ? { fechaCierre: ultima } : {}),
    })
  }

  async function borrar(id: string) {
    setError(null)
    try {
      await eliminarPosicion(id)
    } catch (e) {
      // Con apuntes colgando no se borra en silencio: se pide confirmación explícita.
      const msg = e instanceof Error ? e.message : String(e)
      if (
        window.confirm(
          `${msg}\n\n¿Borrar la posición de todos modos? Los apuntes NO se borran: ` +
            'solo se les quita la referencia.',
        )
      ) {
        await eliminarPosicion(id, true)
      } else {
        setError(msg)
      }
    }
  }

  const abiertas = posiciones.filter((p) => p.estado === 'abierta')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pos-titulo" className="text-2xl font-bold">Posiciones</h2>
          <p className="text-sm text-slate-500">
            {posiciones.length} posición(es) · {abiertas.length} abierta(s). Agrupan las patas de
            un mismo evento a lo largo del tiempo.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARIO} onClick={() => setAsistente(true)}>
          + Nuevo evento DeFi
        </button>
      </div>

      <Banner tono="info">
        El valor de una posición abierta es <strong>informativo, no fiscal</strong>. La pérdida no
        permanente de un pool es lucro cesante y no se computa mientras la posición siga viva:
        solo al retirar la liquidez nace, en su caso, una pérdida patrimonial, calculada por
        diferencia entre lo aportado y lo recuperado.
      </Banner>

      {error && <Banner tono="error" onCerrar={() => setError(null)}>{error}</Banner>}

      {posiciones.length === 0 ? (
        <div className="rounded-md border border-dashed border-stone-300 p-8 text-center dark:border-slate-700">
          <p className="text-slate-500">Todavía no hay posiciones.</p>
          <p className="mt-1 text-sm text-slate-400">
            Empieza por un evento: staking, préstamo, pool o derivado.
          </p>
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-labelledby="pos-titulo">
          {posiciones.map((p) => {
            const patas = patasPorPosicion.get(p.id) ?? []
            const desplegada = abierta === p.id
            return (
              <div
                key={p.id}
                role="listitem"
                className="rounded-md border border-stone-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    aria-expanded={desplegada}
                    aria-controls={`pos-patas-${p.id}`}
                    onClick={() => setAbierta(desplegada ? null : p.id)}
                  >
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{p.protocolo}</span>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {p.tipoPosicion}
                      </span>
                      <span
                        className={
                          'rounded px-1.5 py-0.5 text-xs font-medium ' +
                          (p.estado === 'abierta'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                            : 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-300')
                        }
                      >
                        {ETIQUETA_ESTADO[p.estado]}
                      </span>
                      <span className="text-xs text-slate-400">
                        {patas.length} apunte(s) · desde {fmtFechaHora(p.fechaApertura)}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <select
                      className={`${INPUT} w-32`}
                      value={p.estado}
                      aria-label={`Estado de la posición ${p.protocolo}`}
                      onChange={(e) => cerrarPosicion(p.id, e.target.value as EstadoPosicion)}
                    >
                      <option value="abierta">Abierta</option>
                      <option value="cerrada">Cerrada</option>
                      <option value="liquidada">Liquidada</option>
                    </select>
                    <button
                      type="button"
                      className={BTN_PELIGRO}
                      aria-label={`Borrar la posición ${p.protocolo}`}
                      onClick={() => borrar(p.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </div>

                {desplegada && (
                  <div
                    id={`pos-patas-${p.id}`}
                    className="border-t border-stone-200 px-4 py-3 dark:border-slate-700"
                  >
                    {patas.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        Sin apuntes vinculados todavía.
                      </p>
                    ) : (
                      <table className="w-full text-sm" aria-label={`Apuntes de la posición ${p.protocolo}`}>
                        <thead className="text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th scope="col" className="py-1 text-left">Nº</th>
                            <th scope="col" className="py-1 text-left">Fecha</th>
                            <th scope="col" className="py-1 text-left">Tipo</th>
                            <th scope="col" className="py-1 text-left">Evento</th>
                            <th scope="col" className="py-1 text-right">Movimiento</th>
                            <th scope="col" className="py-1 text-right">Contravalor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patas.map((ap) => (
                            <tr key={ap.id} className="border-t border-stone-100 dark:border-slate-800">
                              <td className="py-1.5 font-mono text-xs">{ap.id}</td>
                              <td className="py-1.5 whitespace-nowrap">{fmtFechaHora(ap.fechaHora)}</td>
                              <td className="py-1.5 whitespace-nowrap font-medium">
                                {ETIQUETA_TIPO[ap.tipo]}
                              </td>
                              <td className="py-1.5">
                                <span className="flex items-center gap-1.5">
                                  {ap.evento ? ETIQUETA_EVENTO[ap.evento] : '—'}
                                  {esZonaGris(ap.evento) && <ChipZonaGris apunte={ap} />}
                                </span>
                              </td>
                              <td className="py-1.5 whitespace-nowrap text-right tabular-nums">
                                {ap.activoSalida && `− ${ap.cantidadSalida} ${ap.activoSalida} `}
                                {ap.activoEntrada && `+ ${ap.cantidadEntrada} ${ap.activoEntrada}`}
                              </td>
                              <td className="py-1.5 whitespace-nowrap text-right tabular-nums">
                                {fmtEuro(ap.contravalorEUR)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {p.notas && <p className="mt-2 text-sm text-slate-500">{p.notas}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AsistenteEvento
        abierto={asistente}
        onCerrar={() => setAsistente(false)}
        ubicaciones={ubicaciones}
      />
    </div>
  )
}
