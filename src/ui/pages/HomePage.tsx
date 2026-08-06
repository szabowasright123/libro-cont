import { useEffect, useState } from 'react'
import { abrirBaseDatos } from '../../data/db'
import { TIPOS_OPERACION } from '../../engine/types'

type EstadoDB =
  | { fase: 'abriendo' }
  | { fase: 'ok'; nombre: string; version: number }
  | { fase: 'error'; mensaje: string }

/**
 * HomePage — página de inicio provisional (P0). Muestra el nombre de la app y
 * confirma que Dexie abre la base de datos local en este navegador.
 */
export function HomePage() {
  const [db, setDb] = useState<EstadoDB>({ fase: 'abriendo' })

  useEffect(() => {
    let vivo = true
    abrirBaseDatos()
      .then((info) => {
        if (vivo) setDb({ fase: 'ok', nombre: info.nombre, version: info.version })
      })
      .catch((err: unknown) => {
        if (vivo) {
          setDb({
            fase: 'error',
            mensaje: err instanceof Error ? err.message : String(err),
          })
        }
      })
    return () => {
      vivo = false
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500">
          Universidad de las Hespérides · Taller de Bitcoin 2026
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Libro Hespérides</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Libro contable y Archivo probatorio. Local-first: tus datos no salen de tu
          navegador.
        </p>
      </header>

      <section
        aria-live="polite"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Estado del sistema
        </h2>

        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Base de datos local (IndexedDB)</dt>
            <dd className="font-mono">
              {db.fase === 'abriendo' && <span className="text-slate-400">abriendo…</span>}
              {db.fase === 'ok' && (
                <span className="text-semaforo-ok">
                  ● abierta · {db.nombre} v{db.version}
                </span>
              )}
              {db.fase === 'error' && (
                <span className="text-semaforo-error">● error: {db.mensaje}</span>
              )}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Catálogo de tipos de operación</dt>
            <dd className="font-mono text-slate-700 dark:text-slate-300">
              {TIPOS_OPERACION.length} tipos
            </dd>
          </div>
        </dl>
      </section>

      <footer className="text-xs text-slate-400">
        P0 · Cimientos del repositorio. Sin lógica de cálculo todavía.
      </footer>
    </main>
  )
}
