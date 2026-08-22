/**
 * index.ts — el CATÁLOGO DE CASOS del taller.
 *
 * Seis ejercicios, uno por unidad, cargables con un clic desde Inicio. No pretenden ser
 * exhaustivos ni cubrir todo el manual: cada uno es pequeño —entre nueve y doce apuntes— y
 * lleva dentro EL defecto o la dificultad que su unidad enseña, porque un caso perfecto no
 * se puede depurar y un caso enorme no se puede corregir en clase.
 *
 * El orden es el de las unidades, que es el orden en que se dan. La pantalla los presenta
 * tal cual.
 *
 * Ninguno marca `marcarDemo`: el caso de ejemplo (`data/demo/caso-demo.ts`) es el onboarding
 * de la aplicación y los casos del taller son trabajo del alumno. Con un caso cargado, el
 * recordatorio de copia de seguridad debe seguir funcionando.
 */
import type { CasoTaller } from './tipos'
import { CASO_U5 } from './u5-primer-cuadre'
import { CASO_U6 } from './u6-clasificacion'
import { CASO_U7 } from './u7-exchange-cerrado'
import { CASO_U8 } from './u8-eventos-defi'
import { CASO_U9 } from './u9-irpf'
import { CASO_U10 } from './u10-cierre'

export type { CasoTaller, DificultadCaso, SolucionCaso } from './tipos'
export { ETIQUETA_DIFICULTAD } from './tipos'

/** Los casos del taller, en orden de unidad. */
export const CASOS_TALLER: readonly CasoTaller[] = Object.freeze([
  CASO_U5,
  CASO_U6,
  CASO_U7,
  CASO_U8,
  CASO_U9,
  CASO_U10,
])

/** Busca un caso por su identificador estable. */
export function casoPorId(id: string): CasoTaller | undefined {
  return CASOS_TALLER.find((c) => c.id === id)
}
