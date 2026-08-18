/**
 * AppShell.tsx — layout raíz con navegación entre las secciones del Libro.
 * Aloja el enrutado por hash y monta la página activa.
 */
import { lazy, Suspense } from 'react'
import { RUTAS, useRuta, irA, rutaPrincipal, subrutasDe, type Ruta } from './rutas'
import { HomePage } from '../pages/HomePage'
import { DiarioPage } from '../pages/DiarioPage'
import { CarteraPage } from '../pages/CarteraPage'
import { PosicionesPage } from '../pages/PosicionesPage'
import { ArchivoPage } from '../pages/ArchivoPage'
import { TrazabilidadPage } from '../pages/TrazabilidadPage'
import { FiscalPage } from '../pages/FiscalPage'
import { UbicacionesPage } from '../pages/UbicacionesPage'
import { ParametrosPage } from '../pages/ParametrosPage'
import { AcercaPage } from '../pages/AcercaPage'
import { BotonTema } from '../tema-ui'

// Ajustes arrastra las librerías pesadas de xlsx (SheetJS) y exceljs: se carga bajo
// demanda para no engordar el arranque (local-first: el resto de la app va ligero).
const AjustesPage = lazy(() =>
  import('../pages/AjustesPage').then((m) => ({ default: m.AjustesPage })),
)

// La importación desde exploradores de bloques solo se usa a ratos: también bajo demanda.
const ImportarPage = lazy(() =>
  import('../pages/ImportarPage').then((m) => ({ default: m.ImportarPage })),
)

/** Mapea cada ruta a su página. */
function Pagina({ ruta }: { ruta: Ruta }) {
  switch (ruta) {
    case 'inicio':
      return <HomePage />
    case 'diario':
      return <DiarioPage />
    case 'cartera':
      return <CarteraPage />
    case 'posiciones':
      return <PosicionesPage />
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
        <Suspense fallback={<p className="text-sm text-stone-500 dark:text-slate-400">Cargando Ajustes…</p>}>
          <AjustesPage />
        </Suspense>
      )
    case 'importar':
      return (
        <Suspense
          fallback={<p className="text-sm text-stone-500 dark:text-slate-400">Cargando la importación…</p>}
        >
          <ImportarPage />
        </Suspense>
      )
  }
}

export function AppShell() {
  const ruta = useRuta()
  const principal = rutaPrincipal(ruta)
  const subrutas = subrutasDe(ruta)

  return (
    <div className="min-h-full bg-stone-50 text-stone-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <button
            type="button"
            onClick={() => irA('inicio')}
            className="flex items-center gap-2.5 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <IconoApp />
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight text-stone-900 dark:text-slate-50">
                Libro Hespérides
              </span>
              <span className="block text-[11px] text-stone-500 dark:text-slate-400">Taller de Bitcoin 2026</span>
            </span>
          </button>

          <nav
            className="ml-auto flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1 dark:border-slate-700 dark:bg-slate-800/70"
            aria-label="Secciones"
          >
            {RUTAS.map(({ ruta: r, etiqueta }) => (
              <button
                key={r}
                type="button"
                onClick={() => irA(r)}
                aria-current={principal === r ? 'page' : undefined}
                className={
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                  (principal === r
                    ? 'border border-brand-200 bg-white font-semibold text-brand-700 shadow-sm ' +
                      'dark:border-brand-500/60 dark:bg-slate-900 dark:text-brand-200'
                    : 'border border-transparent text-stone-600 hover:bg-white/70 hover:text-stone-900 ' +
                      'dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-slate-50')
                }
              >
                {etiqueta}
              </button>
            ))}
          </nav>

          <BotonTema />

          <span className="hidden shrink-0 font-mono text-xs text-stone-400 sm:inline dark:text-slate-300">
            v{__APP_VERSION__}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {subrutas.length > 1 && <SubNav rutaActual={ruta} entradas={subrutas} />}
        <Pagina ruta={ruta} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-stone-400 print:hidden dark:text-slate-300">
        <button
          type="button"
          onClick={() => irA('acerca')}
          aria-current={ruta === 'acerca' ? 'page' : undefined}
          className="rounded underline underline-offset-2 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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

/**
 * Pestañas secundarias de un apartado (Cartera → Posiciones; Ajustes → Ubicaciones,
 * Parámetros…). Se pintan dentro de la página, no en un desplegable.
 */
function SubNav({ rutaActual, entradas }: { rutaActual: Ruta; entradas: { ruta: Ruta; etiqueta: string }[] }) {
  return (
    <nav
      className="mb-5 flex flex-wrap items-center gap-1 border-b border-stone-200 pb-2 print:hidden dark:border-slate-800"
      aria-label="Apartados"
    >
      {entradas.map(({ ruta: r, etiqueta }) => (
        <button
          key={r}
          type="button"
          onClick={() => irA(r)}
          aria-current={rutaActual === r ? 'page' : undefined}
          className={
            'rounded-md px-3 py-1 text-sm transition-colors ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
            (rutaActual === r
              ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200'
              : 'font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800 ' +
                'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100')
          }
        >
          {etiqueta}
        </button>
      ))}
    </nav>
  )
}

/** Icono de la app (libro + ₿ naranja) para la cabecera. Mismo concepto que el icono PWA. */
function IconoApp() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 512 512"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="512" height="512" rx="110" fill="#1c1917" />
      <g
        fill="none"
        stroke="#f8fafc"
        strokeWidth="20"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M96 140c60-28 120-28 160 0v232c-40-28-100-28-160 0z" />
        <path d="M416 140c-60-28-120-28-160 0v232c40-28 100-28 160 0z" />
        <path d="M256 140v232" />
      </g>
      <text
        x="256"
        y="300"
        fontFamily="system-ui, sans-serif"
        fontSize="150"
        fontWeight="700"
        fill="#e8820c"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        ₿
      </text>
    </svg>
  )
}
