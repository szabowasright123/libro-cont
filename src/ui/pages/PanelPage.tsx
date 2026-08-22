/**
 * PanelPage — «El Panel» (F3): el Diario visto por el motor.
 *
 * Los mismos apuntes que el alumno teclea en el Diario, convertidos en las cuatro miradas del
 * método del taller: SALDOS (cuánto hay), cola FIFO (cuánto costó), CUADRE (la comprobación
 * hacia fuera) y CONCILIACIÓN FIFO↔SALDOS (la que mira hacia dentro). Por eso cuelga del
 * Diario como subpestaña y no de una sección propia.
 *
 * Esta página es SOLO la capa de datos: lee de Dexie con los mismos hooks que Trazabilidad y
 * Cartera, pide al motor —de una sola vez— la `VistaPanel` (`ui/panel/modelo.ts`) y monta
 * `<Panel />`, que es quien pinta. La separación no es cosmética: gracias a ella el Panel
 * entero se prueba con un diario de tres apuntes y sin base de datos (`ui/panel/Panel.test.tsx`).
 *
 * Regla de oro 4: aquí no hay ni un cálculo. Lo único que se decide es qué se le pasa al motor.
 */
import { useMemo } from 'react'
import type { RefUbicacion } from '../../engine/types'
import {
  listarApuntes,
  listarUbicaciones,
  listarActivos,
  listarJustificantes,
  listarRegistros,
  justificantesADominio,
  cargarCasoDemo,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { revisar } from '../../engine/autocorreccion'
import { PanelAutocorreccion } from '../autocorreccion'
import { construirVistaPanel } from '../panel/modelo'
import { Panel } from '../panel/Panel'
import { fmtUbicacion } from '../formato'
import { irA } from '../shell/rutas'
import { BTN_PRIMARIO, BTN_SEC, Banner } from '../comp'
import { UnidadManual } from '../guia/UnidadManual'

export function PanelPage() {
  const apuntesQ = useLiveQuery(listarApuntes, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])
  const activosQ = useLiveQuery(listarActivos, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])
  const registrosQ = useLiveQuery(listarRegistros, [])

  const apuntes = apuntesQ.estado === 'listo' ? apuntesQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []
  const activos = activosQ.estado === 'listo' ? activosQ.datos : []
  const justificantesReg = justificantesQ.estado === 'listo' ? justificantesQ.datos : []
  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []

  const nombrePorId = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones],
  )
  // Estable entre renders: `BloqueSaldos` la usa dentro de un `useMemo` para ordenar la rejilla.
  const nombreUbic = useMemo(
    () => (r: RefUbicacion) => fmtUbicacion(String(r), nombrePorId),
    [nombrePorId],
  )

  /**
   * UNA llamada al motor por cambio de datos, no cuatro. Los bloques reciben resultados ya
   * calculados; sin este `useMemo` cada uno recalcularía la cola FIFO entera en cada render.
   *
   * Se pasa el catálogo de activos porque la conciliación necesita saber cuáles son moneda de
   * cuenta: sin él trataría cualquier fiat distinta del euro como cripto descuadrada.
   */
  const vista = useMemo(() => construirVistaPanel(apuntes, activos), [apuntes, activos])

  /**
   * REVISIÓN DEL MÉTODO — la misma máquina de la autocorrección, en su modo «sin solución».
   *
   * Un ejercicio con solución se corrige comparando dos libros; el Libro propio del alumno no
   * tiene contra qué compararse, pero sí se le puede exigir el método: las validaciones del
   * diario (que desde la v1.6.0 incluyen la conciliación FIFO↔SALDOS) y el estado probatorio
   * del Archivo. De ahí que se llame revisión y no corrección, y que no ponga ninguna nota:
   * es autoevaluación, y las secciones que conformarán la calificación no están comunicadas.
   */
  const justificantes = useMemo(
    () => justificantesADominio(justificantesReg, registros),
    [justificantesReg, registros],
  )
  const revision = useMemo(
    () => revisar({ apuntes, ubicaciones, activos }, { justificantes }),
    [apuntes, ubicaciones, activos, justificantes],
  )

  const cargando = apuntesQ.estado === 'cargando'
  const fallo = apuntesQ.estado === 'error' ? apuntesQ.error : null

  return (
    <div className="space-y-6">
      <UnidadManual ruta="panel" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Panel</h1>
        <p className="text-sm text-slate-500">
          El Diario visto por el motor: saldos, cola FIFO, cuadre y conciliación, calculados sobre
          los mismos apuntes. Puedes <strong>pinchar cualquier cifra</strong> para ver los apuntes
          que la componen.
        </p>
      </header>

      {fallo && <Banner tono="error">No se han podido leer los apuntes: {fallo.message}</Banner>}

      {apuntesQ.estado === 'listo' && apuntes.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-stone-600 dark:text-slate-300">
            Aún no hay apuntes: no hay nada que el motor pueda mirar. Registra operaciones en el
            Diario o carga el caso de ejemplo para ver el Panel en acción.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className={BTN_PRIMARIO} onClick={() => irA('diario')}>
              Ir al Diario
            </button>
            <button type="button" className={BTN_SEC} onClick={() => void cargarCasoDemo()}>
              Cargar caso de ejemplo
            </button>
          </div>
        </div>
      ) : cargando ? (
        <p className="text-sm text-slate-500" role="status">
          Calculando el Panel…
        </p>
      ) : (
        <>
          <Panel apuntes={apuntes} vista={vista} nombreUbic={nombreUbic} />
          <PanelAutocorreccion
            correccion={revision}
            onAbrirApunte={() => irA('diario')}
          />
        </>
      )}
    </div>
  )
}
