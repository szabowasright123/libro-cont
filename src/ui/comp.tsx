/**
 * comp.tsx — piezas de UI reutilizables (modal, banner de aviso) y clases comunes.
 * Sin lógica de dominio: presentación pura para las páginas del Libro.
 */
import { type ReactNode, useEffect } from 'react'

/** Clases de botón reutilizables (Tailwind). */
export const BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'
export const BTN_PRIMARIO = `${BTN} bg-amber-600 text-white hover:bg-amber-700`
export const BTN_SEC =
  `${BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ` +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
export const BTN_PELIGRO = `${BTN} border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400`

/** Clases para una tecla (`<kbd>`) en textos de ayuda. */
export const KBD =
  'rounded border border-slate-300 bg-slate-100 px-1 font-mono text-[10px] text-slate-600 ' +
  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'

/** Clases de input/select reutilizables. */
export const INPUT =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 ' +
  'shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-60'

/** Ventana modal accesible sencilla (cierra con Escape y clic en el fondo). */
export function Modal({
  titulo,
  abierto,
  onCerrar,
  children,
  ancho = 'max-w-lg',
}: {
  titulo: string
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
  ancho?: string
}) {
  useEffect(() => {
    if (!abierto) return
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full ${ancho} rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/** Banner de aviso (info / éxito / error). */
export function Banner({
  tono,
  children,
  onCerrar,
}: {
  tono: 'info' | 'exito' | 'error'
  children: ReactNode
  onCerrar?: () => void
}) {
  const clases = {
    info: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
    exito: 'border-green-300 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200',
    error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200',
  }[tono]
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${clases}`}
    >
      <div>{children}</div>
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Descartar aviso" className="shrink-0 opacity-60 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  )
}
