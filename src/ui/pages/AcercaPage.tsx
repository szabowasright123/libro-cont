/**
 * AcercaPage — «Acerca de» (P8): versión, autoría, licencia, repositorio y la
 * declaración de privacidad (local-first: los datos no salen del navegador).
 *
 * Autoría/licencia/repositorio se leen de `src/ui/acerca/datosAcerca.ts`; mientras
 * estén pendientes se muestran con un marcador visible.
 */
import type { ReactNode } from 'react'
import { irA } from '../shell/rutas'
import { AUTORIA, LICENCIA, LICENCIA_NOTA, REPO_URL, MARCO } from '../acerca/datosAcerca'

/** Marcador visible para un dato pendiente de fijar. */
function Marcador({ children }: { children: string }) {
  return (
    <code className="rounded border border-dashed border-yellow-500 bg-yellow-100 px-1 text-[11px] text-yellow-900 dark:border-yellow-700/70 dark:bg-yellow-900/30 dark:text-yellow-200">
      {children}
    </code>
  )
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4 dark:border-slate-800">
      <dt className="w-40 shrink-0 text-sm text-slate-500">{termino}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

export function AcercaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <header className="space-y-2">
        <button
          type="button"
          onClick={() => irA('inicio')}
          className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ← Volver al inicio
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Acerca de Libro Hespérides</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Libro contable y Archivo probatorio del Taller de Bitcoin. Herramienta de trabajo del
          alumno, no un juguete didáctico.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-base font-semibold">Ficha</h2>
        <dl>
          <Dato termino="Versión">
            <span className="font-mono">v{__APP_VERSION__}</span>
          </Dato>
          <Dato termino="Autoría">
            {AUTORIA ?? <Marcador>{'{{AUTOR}}'}</Marcador>}
          </Dato>
          <Dato termino="Marco académico">{MARCO}</Dato>
          <Dato termino="Licencia">
            {LICENCIA ? (
              <span>
                {LICENCIA}
                {LICENCIA_NOTA ? <span className="text-slate-500"> · {LICENCIA_NOTA}</span> : null}
              </span>
            ) : (
              <Marcador>{'{{LICENCIA}}'}</Marcador>
            )}
          </Dato>
          <Dato termino="Repositorio">
            {REPO_URL ? (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400"
              >
                {REPO_URL}
              </a>
            ) : (
              <span className="text-slate-500">
                Pendiente de publicar <Marcador>{'{{REPO-URL}}'}</Marcador>
              </span>
            )}
          </Dato>
        </dl>
      </section>

      <section className="rounded-lg border border-green-200 bg-green-50/60 p-4 dark:border-green-900/50 dark:bg-green-950/20">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-green-900 dark:text-green-100">
          <span aria-hidden="true">🔒</span> Tus datos no salen de tu navegador
        </h2>
        <div className="space-y-2 text-sm text-green-900/90 dark:text-green-100/80">
          <p>
            Libro Hespérides es <strong>local-first</strong>: todo lo que registras (apuntes,
            ubicaciones, justificantes) se guarda únicamente en el almacenamiento de tu propio
            navegador (IndexedDB), en tu dispositivo.
          </p>
          <p>
            La app <strong>no hace ninguna llamada de red</strong> en funcionamiento: sin
            analítica, sin servidores, sin nube. Nadie —tampoco la Universidad ni el autor— recibe
            tus datos. Funciona igual en modo avión.
          </p>
          <p>
            Tú controlas las copias: los datos solo se comparten cuando{' '}
            <em>tú</em> exportas una copia (JSON, XLSX o CSV) desde{' '}
            <button
              type="button"
              onClick={() => irA('ajustes')}
              className="underline underline-offset-2 hover:text-green-700 dark:hover:text-green-300"
            >
              Ajustes
            </button>
            . Borrar los datos del navegador (o pulsar «borrar todo») los elimina sin dejar rastro
            en ningún otro sitio.
          </p>
        </div>
      </section>

      <section className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          Aviso importante
        </h2>
        <p>
          Los resúmenes y calificaciones fiscales que muestra la app son{' '}
          <strong>orientativos y de carácter docente</strong>. No constituyen asesoramiento fiscal
          ni una declaración. Ante cualquier duda, consulta a un profesional y la normativa vigente.
        </p>
      </section>
    </div>
  )
}
