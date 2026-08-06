/**
 * ActualizacionPWA — avisos del service worker (Regla de oro 3, local-first):
 *  - «lista sin conexión»: la primera vez que el SW precachea el build.
 *  - «nueva versión»: cuando hay un build más reciente; el alumno decide cuándo
 *    recargar (registerType 'prompt'), para no perder nada a medio registrar.
 *
 * El módulo virtual `virtual:pwa-register/react` lo provee vite-plugin-pwa. En dev
 * el SW está desactivado, así que estos avisos solo aparecen en el build servido.
 */
import { useRegisterSW } from 'virtual:pwa-register/react'

export function ActualizacionPWA() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const cerrar = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 print:hidden"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
        {needRefresh ? (
          <>
            <span className="flex-1">
              <strong className="font-semibold">Nueva versión disponible.</strong>{' '}
              Recarga para actualizar; tus datos locales se conservan.
            </span>
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Actualizar
            </button>
          </>
        ) : (
          <span className="flex-1">
            <strong className="font-semibold">Lista sin conexión.</strong> Ya puedes usar
            el Libro en modo avión.
          </span>
        )}
        <button
          type="button"
          onClick={cerrar}
          aria-label="Descartar aviso"
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
