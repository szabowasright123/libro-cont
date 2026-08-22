/**
 * virtual.ts — virtualización de las listas largas del Panel.
 *
 * El drill-down de una celda de SALDOS puede tener tantas filas como apuntes tenga el
 * diario, y la cola FIFO de un activo activo tantas transmisiones como ventas se hayan hecho:
 * con el libro de 5.000 apuntes de Ajustes eso son miles de `<tr>` por celda abierta. El
 * Diario ya resolvió esto con `@tanstack/react-virtual` (solo se pinta lo visible) y aquí se
 * hace igual.
 *
 * Con una diferencia deliberada: por debajo del umbral NO se virtualiza. Una lista de doce
 * movimientos no gana nada con un virtualizador y sí pierde —no se puede buscar con Ctrl+F
 * ni imprimir, que en clase se hace—, así que la virtualización se enciende solo cuando de
 * verdad hace falta.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

/** A partir de tantas filas se virtualiza. Por debajo se pinta la lista entera. */
export const UMBRAL_VIRTUALIZACION = 60

/** Lo que hay que pintar: los índices visibles y el relleno que simula el resto. */
export interface CuerpoVirtual {
  /** Índices de las filas a renderizar (todos si no se virtualiza). */
  indices: number[]
  /** Alto en píxeles del hueco de arriba (0 si no se virtualiza). */
  padTop: number
  /** Alto en píxeles del hueco de abajo (0 si no se virtualiza). */
  padBottom: number
  virtualizado: boolean
  /** Hay que ponerlo en el contenedor con scroll que envuelve la tabla. */
  contenedorRef: RefObject<HTMLDivElement>
}

/**
 * Devuelve las filas visibles de una lista larga.
 *
 * @param total      número de filas de la lista
 * @param estimar    alto estimado de la fila `i`. Como el desplegable de una transmisión
 *                   crece hacia abajo, la estimación depende del índice: la fila abierta
 *                   mide más. No hace falta que sea exacta, solo verosímil.
 * @param remedir    valores que, al cambiar, obligan a rehacer las medidas (típicamente,
 *                   cuál es la fila desplegada).
 */
export function useCuerpoVirtual(
  total: number,
  estimar: (indice: number) => number,
  remedir: readonly unknown[] = [],
): CuerpoVirtual {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const virtualizado = total > UMBRAL_VIRTUALIZACION

  const virtualizador = useVirtualizer({
    count: virtualizado ? total : 0,
    getScrollElement: () => contenedorRef.current,
    estimateSize: estimar,
    overscan: 10,
  })

  useEffect(() => {
    if (virtualizado) virtualizador.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, remedir)

  const items = virtualizador.getVirtualItems()

  if (!virtualizado) {
    return {
      indices: Array.from({ length: total }, (_, i) => i),
      padTop: 0,
      padBottom: 0,
      virtualizado: false,
      contenedorRef,
    }
  }

  const primero = items[0]
  const ultimo = items[items.length - 1]
  return {
    indices: items.map((it) => it.index),
    padTop: primero?.start ?? 0,
    padBottom: ultimo ? virtualizador.getTotalSize() - ultimo.end : 0,
    virtualizado: true,
    contenedorRef,
  }
}
