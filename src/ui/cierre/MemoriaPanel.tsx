/**
 * MemoriaPanel — la memoria del ejercicio, «la casilla que más rinde» ([MT] Anexo D).
 *
 * Cuatro apartados, que son los cuatro que el anexo enumera. Texto libre: aquí la app no
 * calcula nada ni sugiere nada, solo pregunta y guarda. Un apartado sin nada que contar se
 * cierra escribiéndolo («este año no hubo reconstrucciones»): eso también es memoria, y es
 * justamente el tipo de frase que dentro de cinco años ahorra una tarde de arqueología.
 */
import { useId } from 'react'
import {
  APARTADOS_MEMORIA,
  NOTA_MEMORIA_ANEXO_D,
  type ApartadoMemoria,
  type MemoriaEjercicio,
  type ResultadoMemoria,
} from '../../engine/cierre'
import { INPUT } from '../comp'

export function MemoriaPanel({
  memoria,
  resultado,
  ejercicio,
  onCambiar,
}: {
  memoria: MemoriaEjercicio
  resultado: ResultadoMemoria
  ejercicio: number
  onCambiar: (apartado: ApartadoMemoria, texto: string) => void
}) {
  const idBase = useId()

  return (
    <section
      className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
      aria-labelledby="cierre-memoria"
    >
      <div>
        <h2 id="cierre-memoria" className="text-lg font-semibold">
          Memoria del ejercicio {ejercicio}
        </h2>
        <p className="text-xs leading-relaxed text-slate-500">{NOTA_MEMORIA_ANEXO_D}</p>
      </div>

      <div className="space-y-4">
        {APARTADOS_MEMORIA.map((a, i) => {
          const id = `${idBase}-${i}`
          const ayuda = `${id}-ayuda`
          const vacio = resultado.vacios.includes(a.clave)
          return (
            <div key={a.clave}>
              <label htmlFor={id} className="block text-sm font-medium">
                {a.titulo}
                {vacio && (
                  <span className="ml-2 text-xs font-normal text-semaforo-revisar">
                    sin escribir
                  </span>
                )}
              </label>
              <p id={ayuda} className="mb-1 text-xs text-slate-500">
                {a.pista}
              </p>
              <textarea
                id={id}
                rows={3}
                className={INPUT}
                value={memoria[a.clave] ?? ''}
                aria-describedby={ayuda}
                onChange={(e) => onCambiar(a.clave, e.target.value)}
              />
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400">
        {resultado.escritos.length} de {APARTADOS_MEMORIA.length} apartados escritos ·{' '}
        {resultado.palabras} palabras.
      </p>
    </section>
  )
}
