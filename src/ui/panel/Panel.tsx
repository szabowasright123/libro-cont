/**
 * Panel — los cuatro bloques del Panel, ya calculados.
 *
 * Separado de `PanelPage` a propósito: la página se ocupa de la capa de datos (Dexie, hooks
 * y estado vacío) y esto solo de pintar lo que el motor ha devuelto. Así el Panel entero se
 * puede montar en un test con un diario de tres apuntes, sin base de datos de por medio, que
 * es lo que hace `Panel.test.tsx`.
 *
 * El orden de los bloques es el del método del taller: primero cuánto hay (SALDOS), luego
 * cuánto costó (FIFO), luego la comprobación hacia fuera (CUADRE) y por último la que mira
 * hacia dentro (CONCILIACIÓN), que es la que caza lo que ninguna de las anteriores ve.
 */
import type { Apunte, RefUbicacion } from '../../engine/types'
import { Banner } from '../comp'
import { SeccionCuadre } from '../trazabilidad/SeccionCuadre'
import { BloqueSaldos } from './BloqueSaldos'
import { BloqueFifo } from './BloqueFifo'
import { BloqueConciliacion } from './BloqueConciliacion'
import type { VistaPanel } from './modelo'

export function Panel({
  apuntes,
  vista,
  nombreUbic,
}: {
  apuntes: Apunte[]
  vista: VistaPanel
  nombreUbic: (r: RefUbicacion) => string
}) {
  return (
    <div className="space-y-6">
      {vista.error && (
        <Banner tono="error">
          No se ha podido calcular la cola FIFO: {vista.error} Los saldos siguen siendo
          válidos —no dependen del orden—, pero la cola y la conciliación necesitan el diario
          ordenado.
        </Banner>
      )}

      <BloqueSaldos apuntes={apuntes} rejilla={vista.rejilla} nombreUbic={nombreUbic} />

      <BloqueFifo fifo={vista.fifo} />

      {/* Bloque 3: el CUADRE ya tenía pantalla dentro de Trazabilidad y se reutiliza tal
          cual (mismo componente, mismos saldos declarados, misma persistencia). Duplicarlo
          habría significado dos sitios donde teclear el mismo saldo real. */}
      {vista.saldos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-200">3 · Cuadre.</span>{' '}
            La comprobación que mira hacia fuera: el saldo calculado contra el que lees en el
            exchange o en la wallet. Es la misma pantalla que hay en Trazabilidad, con los
            mismos saldos declarados.
          </p>
          <SeccionCuadre apuntes={apuntes} nombreUbic={nombreUbic} />
        </div>
      )}

      <BloqueConciliacion conciliacion={vista.conciliacion} apuntes={apuntes} />
    </div>
  )
}
