/**
 * BloqueFifo — bloque 2 del Panel: la cola FIFO, activo por activo, con drill-down.
 *
 * Por activo, los totales de su cola (`calcularFifo`): adquirido, consumido, restante y el
 * coste del restante. Al desplegarlo, las dos mitades de las que salen esos totales:
 *
 *  · los LOTES ABIERTOS —lo que queda vivo, con su fecha, su cantidad inicial, la que aún no
 *    se ha consumido y su coste unitario—, y
 *  · las TRANSMISIONES, cada una con su valor de transmisión neto, su coste FIFO, su
 *    resultado y, al desplegarla, LOS LOTES CONCRETOS QUE CONSUMIÓ (`ConsumoFifo`).
 *
 * Ese último desplegable es el bloque entero: ver que una venta se ha llevado el lote de
 * enero y medio lote de marzo es lo que hace visible el «primero que entra, primero que
 * sale». Sin él, el coste FIFO es un número que hay que creerse.
 *
 * Dos marcas en las transmisiones, ambas del motor:
 *  · `saldoFifoInsuficiente` en rojo — la cola no cubría la cantidad transmitida y la parte
 *    descubierta va a coste cero, que infla el resultado. Es la «trampa del coste cero».
 *  · `lucrativa` — donación entregada. El motor calcula el resultado igual y lo marca; la
 *    pérdida de una transmisión lucrativa ínter vivos no se computa (art. 33.5.c LIRPF).
 */
import { useMemo, useState } from 'react'
import type { ResultadoTransmision, SimboloActivo } from '../../engine/types'
import type { ResultadoFifoActivo } from '../../engine/fifo'
import { fmtCantidad, fmtEuro, fmtFecha } from '../formato'
import { useCuerpoVirtual } from './virtual'

/** Literal del art. 33.5.c LIRPF (Regla de oro 5: se copia, no se parafrasea). */
const LITERAL_33_5_C =
  'No se computarán como pérdidas patrimoniales […] las debidas a transmisiones lucrativas ' +
  'por actos ínter vivos o a liberalidades.'


/** Altos estimados (px) de las filas de transmisión, para el virtualizador. */
const ALTO_TRANSMISION = 34
const ALTO_DETALLE_BASE = 120
const ALTO_CONSUMO = 28

export function BloqueFifo({ fifo }: { fifo: Map<SimboloActivo, ResultadoFifoActivo> }) {
  const [abierto, setAbierto] = useState<SimboloActivo | null>(null)

  const activos = useMemo(() => [...fifo.keys()].sort((a, b) => a.localeCompare(b, 'es')), [fifo])

  if (activos.length === 0) return null

  return (
    <section
      aria-labelledby="panel-fifo-titulo"
      className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
    >
      <div>
        <h2 id="panel-fifo-titulo" className="text-lg font-semibold">
          2 · Cola FIFO
        </h2>
        <p className="text-sm text-slate-500">
          Cola única global por activo, sin distinguir ubicación. Abre un activo para ver sus
          lotes vivos y sus transmisiones, y abre una transmisión para ver de qué lotes salió
          su coste.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Totales de la cola FIFO por activo. Cada activo se despliega con sus lotes
            abiertos y sus transmisiones.
          </caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Activo
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Adquirido
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Consumido
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Restante
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Coste restante
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Detalle
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {activos.map((activo) => {
              const cola = fifo.get(activo)
              if (!cola) return null
              const desplegado = abierto === activo
              const idDetalle = `panel-fifo-detalle-${activo.replace(/\W+/g, '-')}`
              return (
                <FilaActivo
                  key={activo}
                  activo={activo}
                  cola={cola}
                  desplegado={desplegado}
                  idDetalle={idDetalle}
                  onAlternar={() => setAbierto(desplegado ? null : activo)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Una fila de activo con los totales de su cola y, desplegada, lotes y transmisiones. */
function FilaActivo({
  activo,
  cola,
  desplegado,
  idDetalle,
  onAlternar,
}: {
  activo: SimboloActivo
  cola: ResultadoFifoActivo
  desplegado: boolean
  idDetalle: string
  onAlternar: () => void
}) {
  return (
    <>
      <tr className={desplegado ? 'bg-amber-50 dark:bg-amber-950/30' : ''}>
        <th scope="row" className="px-3 py-2 text-left font-semibold">
          {activo}
        </th>
        <td className="px-3 py-2 text-right tabular-nums" title={cola.resumen.adquiridoTotal}>
          {fmtCantidad(cola.resumen.adquiridoTotal)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums" title={cola.resumen.consumidoTotal}>
          {fmtCantidad(cola.resumen.consumidoTotal)}
        </td>
        <td
          className="px-3 py-2 text-right font-medium tabular-nums"
          title={cola.resumen.restanteTotal}
        >
          {fmtCantidad(cola.resumen.restanteTotal)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {fmtEuro(cola.resumen.costeRestanteEUR)}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={desplegado}
            aria-controls={idDetalle}
            aria-label={`${desplegado ? 'Ocultar' : 'Ver'} la cola FIFO de ${activo}`}
            className="rounded px-2 py-0.5 text-xs underline decoration-dotted underline-offset-4 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
          >
            <span aria-hidden="true">{desplegado ? '▾ ' : '▸ '}</span>
            {cola.resumen.lotesAbiertos.length} lote
            {cola.resumen.lotesAbiertos.length === 1 ? '' : 's'} ·{' '}
            {cola.transmisiones.length} transmisi
            {cola.transmisiones.length === 1 ? 'ón' : 'ones'}
          </button>
        </td>
      </tr>
      {desplegado && (
        <tr id={idDetalle}>
          <td colSpan={6} className="space-y-4 bg-slate-50/70 px-3 py-3 dark:bg-slate-900/50">
            <LotesAbiertos cola={cola} activo={activo} />
            <Transmisiones cola={cola} activo={activo} />
          </td>
        </tr>
      )}
    </>
  )
}

/** Lo que sigue vivo en la cola: fecha, cantidad inicial, restante y coste unitario. */
function LotesAbiertos({ cola, activo }: { cola: ResultadoFifoActivo; activo: SimboloActivo }) {
  const lotes = cola.resumen.lotesAbiertos
  const cuerpo = useCuerpoVirtual(lotes.length, () => 30)

  if (lotes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No queda ningún lote abierto de {activo}: la cola está consumida por completo.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">Lotes abiertos ({lotes.length})</h3>
      <div
        ref={cuerpo.contenedorRef}
        className="max-h-72 overflow-y-auto rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      >
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Lotes de {activo} aún no consumidos.</caption>
          <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Lote (apunte)
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Fecha
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Cantidad inicial
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Cantidad restante
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Coste unitario
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {cuerpo.padTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={5} style={{ height: cuerpo.padTop }} />
              </tr>
            )}
            {cuerpo.indices.map((i) => {
              const l = lotes[i]
              if (!l) return null
              return (
                <tr key={l.apunteId} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <td className="px-2 py-1.5 font-mono">{l.apunteId}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtFecha(l.fechaHora)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" title={l.cantidadInicial}>
                    {fmtCantidad(l.cantidadInicial)}
                  </td>
                  <td
                    className="px-2 py-1.5 text-right font-medium tabular-nums"
                    title={l.cantidadRestante}
                  >
                    {fmtCantidad(l.cantidadRestante)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmtEuro(l.costeUnitarioEUR)}
                  </td>
                </tr>
              )
            })}
            {cuerpo.padBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={5} style={{ height: cuerpo.padBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Las transmisiones del activo; cada una se abre con los lotes que consumió. */
function Transmisiones({ cola, activo }: { cola: ResultadoFifoActivo; activo: SimboloActivo }) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const trans = cola.transmisiones

  const indiceAbierta = trans.findIndex((t) => t.apunteId === abierta)
  const cuerpo = useCuerpoVirtual(
    trans.length,
    (i) => {
      if (i !== indiceAbierta) return ALTO_TRANSMISION
      const consumos = trans[i]?.consumos.length ?? 0
      return ALTO_TRANSMISION + ALTO_DETALLE_BASE + consumos * ALTO_CONSUMO
    },
    [indiceAbierta],
  )

  if (trans.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Todavía no hay ninguna transmisión de {activo}: nada ha salido de la cola.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">Transmisiones ({trans.length})</h3>
      <div
        ref={cuerpo.contenedorRef}
        className="max-h-96 overflow-y-auto rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      >
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">
            Transmisiones de {activo}. Cada una se despliega con los lotes que consumió.
          </caption>
          <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Apunte
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Fecha
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Cantidad
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Valor transmisión neto
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Coste FIFO
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Resultado
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Lotes
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
              const t = trans[i]
              if (!t) return null
              return (
                <FilaTransmision
                  key={t.apunteId}
                  transmision={t}
                  desplegada={t.apunteId === abierta}
                  onAlternar={() => setAbierta(t.apunteId === abierta ? null : t.apunteId)}
                />
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

/** Una transmisión y, desplegada, los lotes concretos que consumió. */
function FilaTransmision({
  transmision: t,
  desplegada,
  onAlternar,
}: {
  transmision: ResultadoTransmision
  desplegada: boolean
  onAlternar: () => void
}) {
  const idDetalle = `panel-fifo-consumos-${t.apunteId.replace(/\W+/g, '-')}`
  const perdida = t.resultadoEUR.startsWith('-')
  return (
    <>
      <tr
        className={
          (t.saldoFifoInsuficiente ? 'bg-red-50 dark:bg-red-950/30 ' : '') +
          (desplegada ? 'font-medium ' : '')
        }
      >
        <td className="px-2 py-1.5 font-mono">
          <span className="flex items-center gap-1">
            {t.apunteId}
            {t.saldoFifoInsuficiente && (
              <span
                title={`Faltaron ${fmtCantidad(t.cantidadSinCoste)} sin lote de coste`}
                className="rounded bg-red-600 px-1 text-[10px] font-semibold text-white"
              >
                SIN COSTE
              </span>
            )}
            {t.lucrativa && (
              <span
                title={LITERAL_33_5_C}
                className="rounded border border-violet-400 px-1 text-[10px] font-semibold text-violet-700 dark:border-violet-700 dark:text-violet-300"
              >
                LUCRATIVA
              </span>
            )}
          </span>
        </td>
        <td className="px-2 py-1.5 whitespace-nowrap">{fmtFecha(t.fechaHora)}</td>
        <td className="px-2 py-1.5 text-right tabular-nums" title={t.cantidad}>
          {fmtCantidad(t.cantidad)}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums">
          {fmtEuro(t.valorTransmisionNetoEUR)}
        </td>
        <td
          className={
            'px-2 py-1.5 text-right tabular-nums ' +
            (t.saldoFifoInsuficiente ? 'font-semibold text-semaforo-error' : '')
          }
        >
          {fmtEuro(t.costeFifoEUR)}
        </td>
        <td
          className={
            'px-2 py-1.5 text-right font-medium tabular-nums ' +
            (perdida ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')
          }
        >
          {fmtEuro(t.resultadoEUR)}
        </td>
        <td className="px-2 py-1.5 text-right">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={desplegada}
            aria-controls={idDetalle}
            aria-label={`${desplegada ? 'Ocultar' : 'Ver'} los lotes consumidos por el apunte ${t.apunteId}`}
            className="rounded px-1.5 py-0.5 underline decoration-dotted underline-offset-4 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
          >
            <span aria-hidden="true">{desplegada ? '▾ ' : '▸ '}</span>
            {t.consumos.length}
          </button>
        </td>
      </tr>
      {desplegada && (
        <tr id={idDetalle}>
          <td colSpan={7} className="bg-slate-50 px-3 py-2 dark:bg-slate-900">
            <ConsumosDeTransmision transmision={t} />
          </td>
        </tr>
      )}
    </>
  )
}

/** El «primero que entra, primero que sale», hecho lista: qué lotes pagó esta transmisión. */
function ConsumosDeTransmision({ transmision: t }: { transmision: ResultadoTransmision }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Lotes consumidos por {t.apunteId}, del más antiguo al más reciente. La suma de sus
        costes imputados es el coste FIFO de la transmisión:{' '}
        <span className="font-medium tabular-nums">{fmtEuro(t.costeFifoEUR)}</span>.
      </p>

      {t.consumos.length > 0 ? (
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Lotes consumidos por el apunte {t.apunteId}.</caption>
          <thead className="text-left uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-2 py-1 font-medium">
                Lote (apunte)
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Cantidad consumida
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Coste imputado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {t.consumos.map((c) => (
              <tr key={c.loteApunteId}>
                <td className="px-2 py-1 font-mono">{c.loteApunteId}</td>
                <td className="px-2 py-1 text-right tabular-nums" title={c.cantidadConsumida}>
                  {fmtCantidad(c.cantidadConsumida)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {fmtEuro(c.costeImputadoEUR)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-slate-500">
          Esta transmisión no consumió ningún lote de la cola.
        </p>
      )}

      {t.saldoFifoInsuficiente && (
        <p className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          La cola no cubría la cantidad transmitida:{' '}
          <span className="tabular-nums font-medium">{fmtCantidad(t.cantidadSinCoste)}</span> se
          quedaron sin lote de coste y van a coste cero, lo que infla el resultado. Falta
          registrar la adquisición que precede a esta salida ([MT] U2.5).
        </p>
      )}

      {t.lucrativa && (
        <p className="rounded border border-violet-300 bg-violet-50 px-2 py-1.5 text-xs text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200">
          Donación entregada: transmisión lucrativa ínter vivos. La ganancia se computa; la
          pérdida no. Art. 33.5.c LIRPF: «{LITERAL_33_5_C}»
        </p>
      )}
    </div>
  )
}
