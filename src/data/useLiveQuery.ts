/**
 * useLiveQuery.ts — hook mínimo para consultas reactivas a IndexedDB.
 *
 * Envuelve `liveQuery` de Dexie (Observable) en estado de React, de modo que los
 * componentes se re-renderizan cuando cambian los datos que consultan, sin añadir
 * dependencias (evitamos dexie-react-hooks: local-first, superficie mínima).
 *
 * No es del motor ni contiene cálculo: es infraestructura de la capa de datos/UI.
 */
import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'

/** Estado de una consulta reactiva. */
export type EstadoConsulta<T> =
  | { estado: 'cargando'; datos: undefined; error: undefined }
  | { estado: 'listo'; datos: T; error: undefined }
  | { estado: 'error'; datos: undefined; error: Error }

/**
 * Suscribe un `liveQuery` de Dexie y devuelve su último valor.
 *
 * @param consulta  función async que lee de la base (se re-ejecuta al cambiar los datos)
 * @param deps      dependencias que, al cambiar, reinician la suscripción
 */
export function useLiveQuery<T>(
  consulta: () => Promise<T>,
  deps: readonly unknown[] = [],
): EstadoConsulta<T> {
  const [valor, setValor] = useState<EstadoConsulta<T>>({
    estado: 'cargando',
    datos: undefined,
    error: undefined,
  })

  useEffect(() => {
    const sub = liveQuery(consulta).subscribe({
      next: (datos) => setValor({ estado: 'listo', datos, error: undefined }),
      error: (err: unknown) =>
        setValor({
          estado: 'error',
          datos: undefined,
          error: err instanceof Error ? err : new Error(String(err)),
        }),
    })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return valor
}
