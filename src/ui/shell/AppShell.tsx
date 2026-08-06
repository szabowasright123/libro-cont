/**
 * AppShell.tsx — layout raíz con navegación entre las secciones del Libro.
 * Aloja el enrutado por hash y monta la página activa.
 */
import { lazy, Suspense } from 'react'
import { RUTAS, useRuta, irA, type Ruta } from './rutas'
import { HomePage } from '../pages/HomePage'
import { DiarioPage } from '../pages/DiarioPage'
import { ArchivoPage } from '../pages/ArchivoPage'
import { TrazabilidadPage } from '../pages/TrazabilidadPage'
import { FiscalPage } from '../pages/FiscalPage'
import { UbicacionesPage } from '../pages/UbicacionesPage'
import { ParametrosPage } from '../pages/ParametrosPage'
import { AcercaPage } from '../pages/AcercaPage'

// Ajustes arrastra las librerías pesadas de xlsx (SheetJS) y exceljs: se carga bajo
// demanda para no engordar el arranque (local-first: el resto de la app va ligero).
const AjustesPage = lazy(() =>
  import('../pages/AjustesPage').then((m) => ({ default: m.AjustesPage })),
)

/** Mapea cada ruta a su página. */
function Pagina({ ruta }: { ruta: Ruta }) {
  switch (ruta) {
    case 'inicio':
      return <HomePage />
    case 'diario':
      return <DiarioPage />
    case 'archivo':
      return <ArchivoPage />
    case 'trazabilidad':
      return <TrazabilidadPage />
    case 'fiscal':
      return <FiscalPage />
    case 'ubicaciones':
      return <UbicacionesPage />
    case 'parametros':
      return <ParametrosPage />
    case 'acerca':
      return <AcercaPage />
    case 'ajustes':
      return (
        <Suspense fallback={<p className="text-sm text-slate-500">Cargando Ajustes…</p>}>
          <AjustesPage />
        </Suspense>
      )
  }
}

export function AppShell() {
  const ruta = useRuta()

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <button
            type="button"
            onClick={() => irA('inicio')}
            className="flex items-baseline gap-2 text-left"
          >
            <span className="text-base font-bold tracking-tight">Libro Hespérides</span>
            <span className="hidden text-xs text-slate-400 sm:inline">Taller de Bitcoin 2026</span>
          </button>
          <nav className="ml-auto flex items-center gap-1" aria-label="Secciones">
            {RUTAS.map(({ ruta: r, etiqueta }) => (
              <button
                key={r}
                type="button"
                onClick={() => irA(r)}
                aria-current={ruta === r ? 'page' : undefined}
                className={
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                  (ruta === r
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                {etiqueta}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Pagina ruta={ruta} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-400 print:hidden">
        <button
          type="button"
          onClick={() => irA('acerca')}
          aria-current={ruta === 'acerca' ? 'page' : undefined}
          className="underline underline-offset-2 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:text-slate-300"
        >
          Acerca de
        </button>
        <span className="mx-2">·</span>
        <span>Local-first · tus datos no salen de tu navegador</span>
        <span className="mx-2">·</span>
        <span className="font-mono">v{__APP_VERSION__}</span>
      </footer>
    </div>
  )
}
