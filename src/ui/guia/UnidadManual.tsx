/**
 * UnidadManual — recuadro «Unidad del manual» que se muestra en cada pantalla
 * (guía integrada, P8). Presenta el bloque del taller, una pista neutra y el texto
 * literal de la unidad del manual (Regla de oro 5: la app no redacta esos textos, los
 * copia literalmente; ver `src/ui/guia/unidades.ts`).
 *
 * Es plegable y recuerda su estado en localStorage por pantalla, para no estorbar
 * al usuario intensivo una vez leído.
 */
import { useState } from 'react'
import type { Ruta } from '../shell/rutas'
import { UNIDADES_MANUAL } from './unidades'

const CLAVE_LS = 'hesperides.unidad-manual.plegado'

function leerPlegado(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LS) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

export function UnidadManual({ ruta }: { ruta: Ruta }) {
  const unidad = UNIDADES_MANUAL[ruta]
  const [plegado, setPlegado] = useState<boolean>(() => leerPlegado()[ruta] ?? false)

  if (!unidad) return null

  const alternar = () => {
    const nuevo = !plegado
    setPlegado(nuevo)
    try {
      localStorage.setItem(CLAVE_LS, JSON.stringify({ ...leerPlegado(), [ruta]: nuevo }))
    } catch {
      /* localStorage puede fallar en modo privado: no es crítico. */
    }
  }

  return (
    <aside
      aria-label="Unidad del manual"
      className="rounded-lg border border-brand-200 bg-brand-50/60 text-sm dark:border-amber-900/50 dark:bg-amber-950/20"
    >
      <button
        type="button"
        onClick={alternar}
        aria-expanded={!plegado}
        className="flex w-full items-center gap-2 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span aria-hidden="true" className="text-brand-600 dark:text-amber-400">
          📘
        </span>
        <span className="font-semibold text-brand-700 dark:text-amber-100">
          Unidad del manual
        </span>
        <span className="text-xs font-normal text-stone-500 dark:text-amber-300/70">
          · {unidad.bloque}
        </span>
        <span aria-hidden="true" className="ml-auto text-brand-600 dark:text-amber-400">
          {plegado ? '▸' : '▾'}
        </span>
      </button>
      {!plegado && (
        <div className="space-y-2 px-3 pb-3 text-stone-700 dark:text-amber-100/80">
          <p className="font-medium">{unidad.pista}</p>
          {unidad.texto ? (
            <p className="text-[13px] leading-relaxed">{unidad.texto}</p>
          ) : (
            <p className="text-xs text-stone-500 dark:text-amber-300/60">
              Texto de la unidad pendiente del literal del manual ({unidad.clave}).
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
