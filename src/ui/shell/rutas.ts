/**
 * rutas.ts — enrutado por hash (local-first, sin dependencias, compatible con
 * GitHub Pages y con recarga de página). Cada sección del Libro es una ruta.
 *
 * La cabecera muestra SIETE pestañas (ENCARGO_CABECERA_E_IMPORTACION.md, Parte 1):
 * `Cartera` agrupa a `Posiciones`, y `Ajustes` agrupa a `Ubicaciones` y `Parámetros`.
 * Agrupar es solo una capa de navegación: **todas las rutas por hash siguen
 * resolviendo igual** (`#/posiciones`, `#/ubicaciones`, `#/parametros`), porque hay
 * enlaces internos y el alumno puede tenerlas guardadas.
 */
import { useEffect, useState } from 'react'

/** Secciones navegables de la app. */
export type Ruta =
  | 'inicio'
  | 'diario'
  | 'panel'
  | 'cartera'
  | 'posiciones'
  | 'archivo'
  | 'trazabilidad'
  | 'fiscal'
  | 'cierre'
  | 'ubicaciones'
  | 'parametros'
  | 'ajustes'
  | 'importar'
  | 'acerca'

/** Una entrada de navegación: la ruta y su etiqueta visible. */
export interface EntradaNav {
  ruta: Ruta
  etiqueta: string
}

/** Rutas de la navegación principal (cabecera): siete pestañas. */
export const RUTAS: EntradaNav[] = [
  { ruta: 'inicio', etiqueta: 'Inicio' },
  { ruta: 'diario', etiqueta: 'Diario' },
  { ruta: 'archivo', etiqueta: 'Archivo' },
  { ruta: 'cartera', etiqueta: 'Cartera' },
  { ruta: 'trazabilidad', etiqueta: 'Trazabilidad' },
  { ruta: 'fiscal', etiqueta: 'Fiscal' },
  { ruta: 'ajustes', etiqueta: 'Ajustes' },
]

/**
 * Subapartados de una pestaña principal (pestañas secundarias DENTRO de la página,
 * nunca un desplegable: esconder obliga a un clic extra en una app de uso diario).
 * La primera entrada de cada grupo es la propia pestaña principal.
 */
export const SUBRUTAS: Partial<Record<Ruta, EntradaNav[]>> = {
  // El Panel cuelga del Diario porque es el Diario visto por el motor: los mismos apuntes
  // convertidos en SALDOS, cola FIFO, CUADRE y conciliación ([MT] U5.4 y U6.3).
  diario: [
    { ruta: 'diario', etiqueta: 'Diario' },
    { ruta: 'panel', etiqueta: 'Panel' },
  ],
  cartera: [
    { ruta: 'cartera', etiqueta: 'Cartera' },
    { ruta: 'posiciones', etiqueta: 'Posiciones' },
  ],
  // El Cierre cuelga de Fiscal porque es el paso siguiente al resumen del ejercicio:
  // del traslado a Renta ([MT] U9) al cierre y archivo del ejercicio ([MT] U10 y Anexo D).
  fiscal: [
    { ruta: 'fiscal', etiqueta: 'Resumen fiscal' },
    { ruta: 'cierre', etiqueta: 'Cierre del ejercicio' },
  ],
  ajustes: [
    { ruta: 'ajustes', etiqueta: 'Ajustes' },
    { ruta: 'importar', etiqueta: 'Importar cadena' },
    { ruta: 'ubicaciones', etiqueta: 'Ubicaciones' },
    { ruta: 'parametros', etiqueta: 'Parámetros' },
  ],
}

/** Rutas válidas fuera de la navegación principal (accesibles por enlace directo). */
const RUTAS_SECUNDARIAS: Ruta[] = ['acerca']

const VALIDAS = new Set<Ruta>([
  ...RUTAS.map((r) => r.ruta),
  ...Object.values(SUBRUTAS).flatMap((subs) => (subs ?? []).map((s) => s.ruta)),
  ...RUTAS_SECUNDARIAS,
])

/**
 * Pestaña principal bajo la que vive una ruta (para marcar la pill activa de la
 * cabecera). `null` si la ruta no cuelga de ninguna (p. ej. `acerca`).
 */
export function rutaPrincipal(ruta: Ruta): Ruta | null {
  for (const { ruta: principal } of RUTAS) {
    if (principal === ruta) return principal
    const subs = SUBRUTAS[principal]
    if (subs?.some((s) => s.ruta === ruta)) return principal
  }
  return null
}

/** Subapartados de la pestaña a la que pertenece esta ruta (vacío si no los tiene). */
export function subrutasDe(ruta: Ruta): EntradaNav[] {
  const principal = rutaPrincipal(ruta)
  return (principal && SUBRUTAS[principal]) || []
}

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
