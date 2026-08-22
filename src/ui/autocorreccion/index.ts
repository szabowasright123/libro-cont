/**
 * index.ts — punto de entrada de la pantalla de autocorrección.
 *
 * El panel NO está enganchado a ninguna página: se exporta desde aquí y se monta donde el
 * autor decida. La razón es de coordinación: las páginas donde encaja se están tocando en
 * paralelo, y un componente que se monta solo con sus props no obliga a que dos cambios
 * coincidan en el mismo fichero.
 *
 * Montaje mínimo (el cálculo va fuera del componente, Regla de oro 4):
 *
 *     const correccion = useMemo(
 *       () => corregir({ apuntes, ubicaciones, activos }, { apuntes: sol, ubicaciones: solU }),
 *       [apuntes, ubicaciones, activos, sol, solU],
 *     )
 *     <PanelAutocorreccion correccion={correccion} onAbrirApunte={(id) => irA('diario', id)} />
 *
 * Sin libro-solución, `revisar({ apuntes, ubicaciones, activos }, { justificantes })` devuelve
 * la misma forma y el mismo panel la pinta.
 */
export { PanelAutocorreccion, type PropsPanelAutocorreccion } from './PanelAutocorreccion'
export { fmtValor, fmtMovimiento, TONO_GRAVEDAD } from './presentacion'
