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
      className="rounded-lg border border-amber-200 bg-amber-50/60 text-sm dark:border-amber-900/50 dark:bg-amber-950/20"
    >
      <button
        type="button"
        onClick={alternar}
        aria-expanded={!plegado}
        className="flex w-full items-center gap-2 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <span aria-hidden="true" className="text-amber-600 dark:text-amber-400">
          📘
        </span>
        <span className="font-semibold text-amber-900 dark:text-amber-100">
          Unidad del manual
        </span>
        <span className="text-xs font-normal text-amber-700/80 dark:text-amber-300/70">
          · {unidad.bloque}
        </span>
        <span aria-hidden="true" className="ml-auto text-amber-600 dark:text-amber-400">
          {plegado ? '▸' : '▾'}
        </span>
      </button>
      {!plegado && (
        <div className="space-y-2 px-3 pb-3 text-amber-900/90 dark:text-amber-100/80">
          <p className="font-medium">{unidad.pista}</p>
          {unidad.texto ? (
            <p className="text-[13px] leading-relaxed">{unidad.texto}</p>
          ) : (
            <p className="text-xs text-amber-700/70 dark:text-amber-300/60">
              Texto de la unidad pendiente del literal del manual ({unidad.clave}).
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
