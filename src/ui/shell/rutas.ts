/**
 * rutas.ts — enrutado por hash (local-first, sin dependencias, compatible con
 * GitHub Pages y con recarga de página). Cada sección del Libro es una ruta.
 */
import { useEffect, useState } from 'react'

/** Secciones navegables de la app. */
export type Ruta =
  | 'inicio'
  | 'diario'
  | 'cartera'
  | 'posiciones'
  | 'archivo'
  | 'trazabilidad'
  | 'fiscal'
  | 'ubicaciones'
  | 'parametros'
  | 'ajustes'
  | 'acerca'

/** Rutas de la navegación principal (cabecera) y su etiqueta. */
export const RUTAS: { ruta: Ruta; etiqueta: string }[] = [
  { ruta: 'inicio', etiqueta: 'Inicio' },
  { ruta: 'diario', etiqueta: 'Diario' },
  { ruta: 'cartera', etiqueta: 'Cartera' },
  { ruta: 'posiciones', etiqueta: 'Posiciones' },
  { ruta: 'archivo', etiqueta: 'Archivo' },
  { ruta: 'trazabilidad', etiqueta: 'Trazabilidad' },
  { ruta: 'fiscal', etiqueta: 'Fiscal' },
  { ruta: 'ubicaciones', etiqueta: 'Ubicaciones' },
  { ruta: 'parametros', etiqueta: 'Parámetros' },
  { ruta: 'ajustes', etiqueta: 'Ajustes' },
]

/** Rutas válidas fuera de la navegación principal (accesibles por enlace directo). */
const RUTAS_SECUNDARIAS: Ruta[] = ['acerca']

const VALIDAS = new Set<Ruta>([...RUTAS.map((r) => r.ruta), ...RUTAS_SECUNDARIAS])

/** Lee la ruta actual del hash (`#/diario` → 'diario'); por defecto 'inicio'. */
function leerHash(): Ruta {
  const h = window.location.hash.replace(/^#\/?/, '') as Ruta
  return VALIDAS.has(h) ? h : 'inicio'
}

/** Navega a una ruta (actualiza el hash). */
export function irA(ruta: Ruta): void {
  window.location.hash = `#/${ruta}`
}

/** Hook: ruta actual, reactiva a los cambios de hash (atrás/adelante del navegador). */
export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leerHash)
  useEffect(() => {
    const on = () => setRuta(leerHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return ruta
}
