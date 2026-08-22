/**
 * PanelAutocorreccion — la pantalla de la autoevaluación.
 *
 * Presenta lo que devuelve `corregir()` (o `revisar()`), y NADA más: aquí no se calcula un
 * solo número (Regla de oro 4). Todo lo que se ve —capas, hallazgos, consecuencias,
 * pistas— viene ya decidido por el motor; el componente solo lo ordena en la página y lo
 * escribe en español de España, con coma decimal y fechas dd/mm/aaaa.
 *
 * Tres decisiones de diseño que conviene no deshacer sin pensarlo:
 *
 *  1. **No hay nota.** Ni número, ni porcentaje, ni barra de progreso hacia el diez. El
 *     resumen dice cuántas CAPAS coinciden, que es una descripción del estado del Libro y
 *     no una calificación del alumno. La universidad no ha comunicado las secciones que
 *     conforman la nota y, aunque lo hubiera hecho, esto corrige para que se entienda.
 *
 *  2. **La pista va antes que el valor.** En cada hallazgo se lee primero qué mirar y qué
 *     preguntarse; el «esperaba X, encontré Y» está debajo y, en la capa de apuntes, puede
 *     venir sin el esperado (opción `ocultarEsperado` del motor). Un corrector que empieza
 *     por el número correcto se lee como una fe de erratas: se copia y no se aprende.
 *
 *  3. **Lo que ya coincide se pliega.** Una capa verde ocupa una línea. El foco es lo que
 *     hay que arreglar, y el orden en que el motor lo devuelve ya es el orden en que
 *     conviene arreglarlo: primero la causa, después lo que la causa arrastra.
 *
 * No se engancha a ninguna página: se exporta y se monta donde haga falta (ver README).
 */
import { useId, useMemo, useState } from 'react'
import {
  ETIQUETA_CAMPO,
  type CampoApunte,
  type Consecuencia,
  type Correccion,
  type EstadoCapa,
  type FormatoValor,
  type Hallazgo,
} from '../../engine/autocorreccion'
import { BTN_SEC } from '../comp'
import { fmtFechaHora } from '../formato'
import { fmtMovimiento, fmtValor, plural, TONO_GRAVEDAD } from './presentacion'

// ────────────────────────────────────────────────────────────────────────────

export interface PropsPanelAutocorreccion {
  /** Lo que devuelve `corregir()` o `revisar()`. */
  correccion: Correccion
  /**
   * Nombre del ejercicio, para el encabezado. Opcional: sin él, el panel se titula por su
   * modo («Autocorrección» o «Revisión del método»).
   */
  nombreEjercicio?: string
  /**
   * Salto al Diario para arreglar un apunte. Si no se pasa, el apunte se muestra igual
   * pero sin botón: el panel no conoce el enrutador ni debe conocerlo.
   */
  onAbrirApunte?: (apunteId: string) => void
}

/** Panel de autoevaluación: resumen por capas, hallazgos con su pista y su cascada. */
export function PanelAutocorreccion({
  correccion,
  nombreEjercicio,
  onAbrirApunte,
}: PropsPanelAutocorreccion) {
  const idBase = useId()
  const [plegarCoincidentes, setPlegarCoincidentes] = useState(true)

  const esRevision = correccion.modo === 'revision'
  const capasAplicables = useMemo(
    () => correccion.capas.filter((k) => k.aplica),
    [correccion.capas],
  )
  const capasQueCoinciden = capasAplicables.filter((k) => k.coincide).length

  // Los hallazgos vienen ya ordenados por causa. Agruparlos por capa conserva ese orden
  // dentro de cada grupo: la causa sigue siendo lo primero que se lee en su capa.
  const porCapa = useMemo(() => {
    const mapa = new Map<string, Hallazgo[]>()
    for (const h of correccion.hallazgos) {
      const lista = mapa.get(h.capa)
      if (lista) lista.push(h)
      else mapa.set(h.capa, [h])
    }
    return mapa
  }, [correccion.hallazgos])

  return (
    <section
      aria-labelledby={`${idBase}-titulo`}
      className="space-y-4 rounded-lg border border-stone-200 p-4 text-stone-900 dark:border-slate-800 dark:text-slate-100"
    >
      <header className="space-y-2">
        <h2 id={`${idBase}-titulo`} className="text-lg font-semibold">
          {nombreEjercicio ?? (esRevision ? 'Revisión del método' : 'Autocorrección')}
        </h2>
        <p className="text-sm text-stone-600 dark:text-slate-400">
          {esRevision
            ? 'Este ejercicio no tiene solución con la que compararse, así que el Libro se contrasta con las reglas del método: lo que el diario exige de cualquier apunte y lo que el Archivo exige de cualquier prueba.'
            : 'Comparación de tu Libro con el del enunciado, de lo más grueso a lo más fino. Cada hallazgo dice dónde mirar; el arreglo lo haces tú.'}
        </p>
        <p
          role="note"
          className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-brand-700/50 dark:bg-brand-700/10 dark:text-brand-200"
        >
          Esto es <strong>autoevaluación, no calificación</strong>: aquí no se califica, no se
          guarda ningún resultado y no se envía nada a ninguna parte. Sirve para que entiendas
          en qué te has desviado antes de la clase síncrona.
        </p>
      </header>

      <ResumenCapas
        capas={capasAplicables}
        capasQueCoinciden={capasQueCoinciden}
        silenciadas={correccion.consecuenciasSilenciadas}
        sinDesviaciones={correccion.sinDesviaciones}
      />

      {correccion.sinDesviaciones ? (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
          {esRevision
            ? 'El Libro cumple todas las reglas que el motor sabe comprobar y no le falta ningún justificante de los exigidos.'
            : 'Tu Libro coincide con el del enunciado en las cuatro capas: mismos saldos, misma cola FIFO, mismos cajones y los mismos apuntes.'}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`${idBase}-plegar`}
              checked={plegarCoincidentes}
              onChange={(e) => setPlegarCoincidentes(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
            />
            <label htmlFor={`${idBase}-plegar`} className="text-sm text-stone-700 dark:text-slate-300">
              Plegar las capas que ya coinciden
            </label>
          </div>

          <div className="space-y-4">
            {capasAplicables.map((capa) => (
              <BloqueCapa
                key={capa.capa}
                capa={capa}
                hallazgos={porCapa.get(capa.capa) ?? []}
                plegada={plegarCoincidentes && capa.coincide}
                idBase={`${idBase}-${capa.capa}`}
                {...(onAbrirApunte ? { onAbrirApunte } : {})}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * El resumen de arriba: cuántas capas coinciden. Deliberadamente NO es un porcentaje ni
 * una puntuación — es el estado del Libro, no un juicio sobre quien lo lleva.
 */
function ResumenCapas({
  capas,
  capasQueCoinciden,
  silenciadas,
  sinDesviaciones,
}: {
  capas: readonly EstadoCapa[]
  capasQueCoinciden: number
  silenciadas: number
  sinDesviaciones: boolean
}) {
  return (
    <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-sm font-medium">
        Coinciden {capasQueCoinciden} de {plural(capas.length, 'capa', 'capas')}.
        {!sinDesviaciones && silenciadas > 0 && (
          <span className="ml-1 font-normal text-stone-600 dark:text-slate-400">
            {plural(silenciadas, 'desviación derivada', 'desviaciones derivadas')} de otra causa
            no se listan aparte: cuelgan del hallazgo que las explica.
          </span>
        )}
      </p>
      <ul className="flex flex-wrap gap-2">
        {capas.map((k) => (
          <li key={k.capa}>
            <span
              className={
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ' +
                (k.coincide
                  ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200'
                  : 'border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200')
              }
            >
              <span aria-hidden="true">{k.coincide ? '✓' : '●'}</span>
              <span>{k.etiqueta}</span>
              <span className="sr-only">
                {k.coincide
                  ? ': coincide'
                  : `: ${plural(k.raices, 'hallazgo', 'hallazgos')}${
                      k.consecuencias > 0
                        ? ` y ${plural(k.consecuencias, 'desviación derivada', 'desviaciones derivadas')}`
                        : ''
                    }`}
              </span>
              {!k.coincide && k.raices > 0 && (
                <span aria-hidden="true" className="font-semibold">
                  {k.raices}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

/** Una capa con sus hallazgos. Plegada, ocupa una línea. */
function BloqueCapa({
  capa,
  hallazgos,
  plegada,
  idBase,
  onAbrirApunte,
}: {
  capa: EstadoCapa
  hallazgos: readonly Hallazgo[]
  plegada: boolean
  idBase: string
  onAbrirApunte?: (apunteId: string) => void
}) {
  if (plegada) {
    return (
      <section
        aria-labelledby={`${idBase}-titulo`}
        className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
      >
        <span aria-hidden="true">✓</span>
        <h3 id={`${idBase}-titulo`} className="font-medium">
          {capa.etiqueta}
        </h3>
        <span className="text-green-800/80 dark:text-green-300/80">— coincide</span>
      </section>
    )
  }

  return (
    <section
      aria-labelledby={`${idBase}-titulo`}
      className="space-y-3 rounded-md border border-stone-200 p-3 dark:border-slate-800"
    >
      <div className="space-y-0.5">
        <h3 id={`${idBase}-titulo`} className="flex items-center gap-2 font-semibold">
          <span aria-hidden="true" className={capa.coincide ? 'text-semaforo-ok' : 'text-semaforo-error'}>
            {capa.coincide ? '✓' : '●'}
          </span>
          {capa.etiqueta}
        </h3>
        <p className="text-sm text-stone-600 dark:text-slate-400">{capa.descripcion}</p>
      </div>

      {hallazgos.length === 0 ? (
        <p className="text-sm text-stone-600 dark:text-slate-400">
          {capa.coincide
            ? 'Esta capa coincide.'
            : 'Esta capa no coincide, pero sus desviaciones se explican por una causa de otra capa: están recogidas allí.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {hallazgos.map((h) => (
            <li key={h.id}>
              <TarjetaHallazgo
                hallazgo={h}
                idBase={`${idBase}-${h.id.replace(/\W+/g, '-')}`}
                {...(onAbrirApunte ? { onAbrirApunte } : {})}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────

/** Un hallazgo: qué pasa, en qué apunte, qué esperaba, y la pista. */
function TarjetaHallazgo({
  hallazgo,
  idBase,
  onAbrirApunte,
}: {
  hallazgo: Hallazgo
  idBase: string
  onAbrirApunte?: (apunteId: string) => void
}) {
  const [verConsecuencias, setVerConsecuencias] = useState(false)
  const tono = TONO_GRAVEDAD[hallazgo.gravedad]
  const idConsecuencias = `${idBase}-consecuencias`

  return (
    <article className="space-y-2 rounded-md border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <h4 className="flex items-start gap-2 text-sm font-semibold">
        <span aria-hidden="true" className={`mt-0.5 shrink-0 ${tono.clase}`}>
          {tono.punto}
        </span>
        <span className="sr-only">{tono.etiqueta}: </span>
        <span>{hallazgo.titulo}</span>
      </h4>

      {hallazgo.resumenAlumno && (
        <FichaApunte
          etiqueta="En tu Libro"
          resumen={hallazgo.resumenAlumno}
          {...(onAbrirApunte ? { onAbrirApunte } : {})}
        />
      )}
      {hallazgo.resumenSolucion && !hallazgo.resumenAlumno && (
        <FichaApunte etiqueta="En el enunciado" resumen={hallazgo.resumenSolucion} />
      )}

      {/* La pista, primero: es lo que enseña. El valor va debajo. */}
      <p className="rounded border-l-4 border-brand-500 bg-brand-50 px-3 py-2 text-sm text-stone-800 dark:bg-brand-700/10 dark:text-slate-200">
        <span className="font-medium">Pista. </span>
        {hallazgo.pista}
      </p>

      {hallazgo.campos && hallazgo.campos.length > 0 ? (
        // Con un solo campo divergente, su pista ES la del hallazgo y ya está arriba:
        // repetirla palabra por palabra a dos centímetros de distancia es ruido.
        <ListaCampos campos={hallazgo.campos} conPista={hallazgo.campos.length > 1} />
      ) : (
        (hallazgo.esperado !== undefined || hallazgo.encontrado !== undefined) && (
          <ParEsperadoEncontrado
            {...(hallazgo.esperado !== undefined ? { esperado: hallazgo.esperado } : {})}
            {...(hallazgo.encontrado !== undefined ? { encontrado: hallazgo.encontrado } : {})}
            formato={hallazgo.formato}
          />
        )
      )}

      {hallazgo.consecuencias.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setVerConsecuencias(!verConsecuencias)}
            aria-expanded={verConsecuencias}
            aria-controls={idConsecuencias}
            className="rounded px-1 text-xs underline decoration-dotted underline-offset-4 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
          >
            <span aria-hidden="true">{verConsecuencias ? '▾ ' : '▸ '}</span>
            {verConsecuencias ? 'Ocultar' : 'Ver'} lo que este error arrastra (
            {plural(hallazgo.consecuencias.length, 'desviación', 'desviaciones')})
          </button>
          {verConsecuencias && (
            <ListaConsecuencias id={idConsecuencias} consecuencias={hallazgo.consecuencias} />
          )}
        </div>
      )}
    </article>
  )
}

// ────────────────────────────────────────────────────────────────────────────

/** Ficha compacta de un apunte, con el salto al Diario si la página lo ofrece. */
function FichaApunte({
  etiqueta,
  resumen,
  onAbrirApunte,
}: {
  etiqueta: string
  resumen: NonNullable<Hallazgo['resumenAlumno']>
  onAbrirApunte?: (apunteId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-stone-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
      <span className="text-stone-500 dark:text-slate-400">{etiqueta}:</span>
      <span className="font-mono">{resumen.id}</span>
      <span className="whitespace-nowrap">{fmtFechaHora(resumen.fechaHora)}</span>
      <span className="font-medium">{resumen.etiquetaTipo}</span>
      <span className="tabular-nums">{fmtMovimiento(resumen)}</span>
      {onAbrirApunte && (
        <button
          type="button"
          className={`${BTN_SEC} ml-auto !px-2 !py-0.5 !text-xs`}
          onClick={() => onAbrirApunte(resumen.id)}
          aria-label={`Abrir el apunte ${resumen.id} en el Diario`}
        >
          Abrir en el Diario
        </button>
      )}
    </div>
  )
}

/** «Esperaba / has puesto» de un único valor. */
function ParEsperadoEncontrado({
  esperado,
  encontrado,
  formato,
  campo,
}: {
  esperado?: string
  encontrado?: string
  formato: FormatoValor
  campo?: CampoApunte
}) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <div className="flex gap-2">
        <dt className="text-stone-500 dark:text-slate-400">Has puesto</dt>
        <dd className="font-medium tabular-nums">{fmtValor(encontrado, formato, campo)}</dd>
      </div>
      {esperado !== undefined && (
        <div className="flex gap-2">
          <dt className="text-stone-500 dark:text-slate-400">Se esperaba</dt>
          <dd className="font-medium tabular-nums">{fmtValor(esperado, formato, campo)}</dd>
        </div>
      )}
    </dl>
  )
}

/** Los campos divergentes de un apunte, cada uno con su propia pista. */
function ListaCampos({
  campos,
  conPista,
}: {
  campos: NonNullable<Hallazgo['campos']>
  conPista: boolean
}) {
  return (
    <ul className="space-y-2">
      {campos.map((d) => (
        <li
          key={d.campo}
          className="rounded border border-stone-200 px-2.5 py-2 dark:border-slate-800"
        >
          <p className="text-sm font-medium">{ETIQUETA_CAMPO[d.campo]}</p>
          <ParEsperadoEncontrado
            {...(d.esperado !== undefined ? { esperado: d.esperado } : {})}
            {...(d.encontrado !== undefined ? { encontrado: d.encontrado } : {})}
            formato={d.formato}
            campo={d.campo}
          />
          {conPista && (
            <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">{d.pista}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Lo que un error arrastra, plegado por defecto. */
function ListaConsecuencias({
  id,
  consecuencias,
}: {
  id: string
  consecuencias: readonly Consecuencia[]
}) {
  return (
    <div id={id} className="overflow-x-auto rounded border border-stone-200 dark:border-slate-800">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          Desviaciones que este hallazgo explica y que por eso no se listan aparte.
        </caption>
        <thead className="bg-stone-50 text-left uppercase tracking-wide text-stone-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-2 py-1 font-medium">
              Dónde aparece
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Apunte
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Has puesto
            </th>
            <th scope="col" className="px-2 py-1 text-right font-medium">
              Se esperaba
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
          {consecuencias.map((k, i) => (
            <tr key={`${k.capa}-${k.codigo}-${k.apunteId ?? i}`}>
              <td className="px-2 py-1">{k.titulo}</td>
              <td className="px-2 py-1 font-mono">{k.apunteId ?? '—'}</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {fmtValor(k.encontrado, k.formato)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {fmtValor(k.esperado, k.formato)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
