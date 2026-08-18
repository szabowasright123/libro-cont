/**
 * tema-ui.tsx — controles para elegir el tema visual.
 *
 *  · `BotonTema`: interruptor claro ↔ oscuro de la cabecera, siempre a mano.
 *  · `SelectorTema`: las tres opciones (claro / oscuro / como el sistema) en Ajustes.
 *
 * La lógica y la persistencia están en `tema.ts`; aquí solo hay presentación.
 */
import { useTema, type Tema } from './tema'

/** Interruptor compacto de la cabecera: alterna entre claro y oscuro. */
export function BotonTema() {
  const { efectivo, setTema } = useTema()
  const aOscuro = efectivo === 'claro'
  const etiqueta = aOscuro ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'

  return (
    <button
      type="button"
      onClick={() => setTema(aOscuro ? 'oscuro' : 'claro')}
      title={etiqueta}
      aria-label={etiqueta}
      className={
        'shrink-0 rounded-md border border-stone-200 bg-stone-100 p-1.5 text-stone-600 ' +
        'transition-colors hover:bg-white hover:text-stone-900 ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
        'dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 ' +
        'dark:hover:bg-slate-700/60 dark:hover:text-slate-50'
      }
    >
      {aOscuro ? <IconoLuna /> : <IconoSol />}
    </button>
  )
}

/** Las tres opciones de tema, para la página de Ajustes. */
const OPCIONES: { valor: Tema; etiqueta: string; pista: string }[] = [
  { valor: 'claro', etiqueta: 'Claro', pista: 'Fondo claro, siempre.' },
  { valor: 'oscuro', etiqueta: 'Oscuro', pista: 'Fondo oscuro, siempre.' },
  { valor: 'sistema', etiqueta: 'Como el sistema', pista: 'Sigue la preferencia de tu equipo.' },
]

/** Selector de tema con las tres opciones. */
export function SelectorTema() {
  const { tema, efectivo, setTema } = useTema()

  return (
    <div className="w-full space-y-2">
      <div role="radiogroup" aria-label="Tema de la interfaz" className="flex flex-wrap gap-2">
        {OPCIONES.map(({ valor, etiqueta, pista }) => {
          const activa = tema === valor
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={activa}
              title={pista}
              onClick={() => setTema(valor)}
              className={
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ' +
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                (activa
                  ? 'border-brand-200 bg-brand-50 text-brand-700 shadow-sm ' +
                    'dark:border-brand-500/60 dark:bg-brand-700/25 dark:text-brand-100'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 ' +
                    'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
              }
            >
              {etiqueta}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-stone-500">
        {tema === 'sistema'
          ? `Ahora mismo tu equipo pide el tema ${efectivo}.`
          : 'La preferencia se guarda en este navegador; no viaja a ninguna parte.'}
      </p>
    </div>
  )
}

/** Sol: se muestra cuando ya estás en oscuro (pulsar te devuelve al claro). */
function IconoSol() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

/** Luna: se muestra cuando estás en claro (pulsar te lleva al oscuro). */
function IconoLuna() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
