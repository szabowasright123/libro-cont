/**
 * ChecklistCierre — el Anexo D en pantalla, agrupado por momento del calendario.
 *
 * Cada casilla enseña su texto LITERAL del anexo, su remisión a la unidad del manual y —si el
 * motor la ha podido resolver solo— la cifra y el detalle que lo justifican. Las controla el
 * alumno con dos casillas de verificación: «hecho» y «no aplica». La segunda abre el campo de
 * la razón, porque sin razón escrita el ejercicio no cierra ([MT] Anexo D).
 *
 * Presentación pura: no calcula nada. Todo viene evaluado de `engine/cierre.ts`.
 */
import { useId } from 'react'
import type {
  CasillaEvaluada,
  CifraCasilla,
  EstadoCasilla,
  GrupoMomento,
  IdCasillaCierre,
  MarcaCasilla,
} from '../../engine/cierre'
import { fmtDecimal, fmtEuro } from '../formato'
import { INPUT } from '../comp'

/** Semáforo de la casilla: el mismo lenguaje visual que el CUADRE y la conciliación. */
const SEMAFORO: Readonly<Record<EstadoCasilla, { punto: string; texto: string; clase: string }>> = {
  cumplida: { punto: '●', texto: 'Hecha', clase: 'text-semaforo-ok' },
  pendiente: { punto: '●', texto: 'Pendiente', clase: 'text-semaforo-error' },
  'no-aplica': { punto: '●', texto: 'No aplica', clase: 'text-semaforo-revisar' },
}

/** Presenta la cifra que respalda una casilla automática, con su unidad (Regla de oro 6). */
function textoCifra(cifra: CifraCasilla): string {
  if (cifra.unidad === 'EUR') return fmtEuro(cifra.valor)
  if (cifra.unidad === 'porcentaje') return `${fmtDecimal(cifra.valor)} %`
  return fmtDecimal(cifra.valor)
}

/** Una casilla del checklist con sus controles. */
function Casilla({
  casilla,
  marca,
  onCambiar,
}: {
  casilla: CasillaEvaluada
  marca: MarcaCasilla | undefined
  onCambiar: (id: IdCasillaCierre, marca: MarcaCasilla) => void
}) {
  const idHecho = useId()
  const idNoAplica = useId()
  const idRazon = useId()
  const idDetalle = useId()
  const sem = SEMAFORO[casilla.estado]
  const noAplica = marca?.noAplica === true

  return (
    <li
      className="rounded-md border border-stone-200 p-3 dark:border-slate-800"
      aria-label={`Casilla: ${casilla.queSeComprueba}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className={`shrink-0 text-sm font-semibold ${sem.clase}`}>
          <span aria-hidden="true">{sem.punto}</span> {sem.texto}
        </span>
        <span className="rounded-full border border-stone-300 px-2 text-[11px] leading-5 text-stone-600 dark:border-slate-700 dark:text-slate-300">
          {casilla.origen === 'automatica' ? 'La responde la app' : 'La respondes tú'}
        </span>
        <span className="ml-auto shrink-0 text-xs text-slate-400">{casilla.dondeSeExplica}</span>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed">{casilla.queSeComprueba}</p>

      {casilla.comoSeAutomatiza && (
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{casilla.comoSeAutomatiza}</p>
      )}

      <p id={idDetalle} className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {casilla.detalle}
        {casilla.cifra && (
          <>
            {' '}
            <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              {textoCifra(casilla.cifra)}
            </span>
          </>
        )}
      </p>

      {casilla.razon && casilla.resueltaPor === 'motor' && (
        <p className="mt-1.5 rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          <span className="font-medium">Razón y cálculo:</span> {casilla.razon}
        </p>
      )}

      {casilla.discrepanciaConMotor && (
        <p className="mt-1.5 text-xs font-medium text-semaforo-revisar">
          La has dado por hecha, pero la app no lo ve así. Márcala si sabes algo que el Libro no;
          no la marques para taparlo.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5">
          <input
            id={idHecho}
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={marca?.marcada === true}
            disabled={noAplica}
            aria-describedby={idDetalle}
            onChange={(e) =>
              onCambiar(casilla.id, {
                ...marca,
                marcada: e.target.checked,
                ...(e.target.checked
                  ? { marcadaEn: new Date().toISOString().slice(0, 19) }
                  : {}),
              })
            }
          />
          <label htmlFor={idHecho} className="text-sm">
            Hecho
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            id={idNoAplica}
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={noAplica}
            aria-describedby={idDetalle}
            onChange={(e) =>
              onCambiar(casilla.id, { ...marca, noAplica: e.target.checked, marcada: false })
            }
          />
          <label htmlFor={idNoAplica} className="text-sm">
            No aplica
          </label>
        </div>

        {casilla.marcadaEn && casilla.resueltaPor === 'alumno' && (
          <span className="text-xs text-slate-400">Marcada por ti</span>
        )}
      </div>

      {noAplica && (
        <div className="mt-2">
          <label htmlFor={idRazon} className="block text-xs font-medium">
            Razón por la que no aplica <span aria-hidden="true">·</span>{' '}
            <span className="font-normal text-slate-500">
              obligatoria: sin ella el ejercicio no se cierra
            </span>
          </label>
          <textarea
            id={idRazon}
            rows={2}
            className={`${INPUT} mt-1`}
            value={marca?.razonNoAplica ?? ''}
            aria-invalid={casilla.motivoBloqueo === 'no-aplica-sin-razon'}
            placeholder="p. ej.: no operé en ningún exchange este año, así que no hay histórico que exportar."
            onChange={(e) => onCambiar(casilla.id, { ...marca, razonNoAplica: e.target.value })}
          />
          {casilla.motivoBloqueo === 'no-aplica-sin-razon' && (
            <p className="mt-1 text-xs font-medium text-semaforo-error">
              Falta la razón. «No lo hice» y «decidí no hacerlo, y aquí está por qué» no son lo
              mismo ante una comprobación.
            </p>
          )}
        </div>
      )}
    </li>
  )
}

/** El checklist completo, agrupado por momento del calendario de cierre. */
export function ChecklistCierre({
  grupos,
  marcas,
  onCambiar,
}: {
  grupos: readonly GrupoMomento[]
  marcas: Partial<Record<IdCasillaCierre, MarcaCasilla>>
  onCambiar: (id: IdCasillaCierre, marca: MarcaCasilla) => void
}) {
  return (
    <div className="space-y-5">
      {grupos.map((g) => (
        <section key={g.momento} aria-labelledby={`cierre-momento-${g.momento}`}>
          <h3
            id={`cierre-momento-${g.momento}`}
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-amber-300"
          >
            {g.etiqueta}
          </h3>
          <ul className="space-y-2">
            {g.casillas.map((c) => (
              <Casilla key={c.id} casilla={c} marca={marcas[c.id]} onCambiar={onCambiar} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
