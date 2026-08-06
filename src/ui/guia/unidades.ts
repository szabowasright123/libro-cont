/**
 * unidades.ts — catálogo de las «Unidades del manual» que se muestran en cada
 * pantalla (guía integrada, P8).
 *
 * Regla de oro 5: los textos del manual del taller NO se redactan en la app. Cada
 * unidad deja un marcador `{{TEXTO-MANUAL}}` para que el responsable pegue el literal
 * de la unidad correspondiente (con su cita). Aquí solo vive lo ESTRUCTURAL: a qué
 * bloque pertenece la pantalla y una pista neutra de para qué sirve.
 *
 * Inventario para el responsable: `docs/PENDIENTE_TEXTOS.md` (sección «Guía integrada»).
 */
import type { Ruta } from '../shell/rutas'

/** Mismo marcador que el módulo fiscal (una única convención en toda la app). */
export const MARCADOR_MANUAL = '{{TEXTO-MANUAL}}' as const

export interface UnidadManual {
  /** Clave estable para el inventario de textos pendientes. */
  readonly clave: string
  /** Bloque del taller al que pertenece (estructural, no es calificación). */
  readonly bloque: string
  /** Pista neutra de para qué sirve la pantalla (no sustituye al literal del manual). */
  readonly pista: string
}

/**
 * Unidad del manual por pantalla. El contenido docente real es el marcador; estos
 * campos son andamiaje para orientar mientras el literal está pendiente.
 */
export const UNIDADES_MANUAL: Partial<Record<Ruta, UnidadManual>> = {
  diario: {
    clave: 'manual.diario',
    bloque: 'Bloque 2 · El Libro',
    pista: 'Registrar cada operación como un apunte del diario, en orden cronológico.',
  },
  archivo: {
    clave: 'manual.archivo',
    bloque: 'Bloque 1 · El Archivo probatorio',
    pista: 'Reunir los justificantes que sostienen cada apunte: «¿cómo lo demuestro?».',
  },
  trazabilidad: {
    clave: 'manual.trazabilidad',
    bloque: 'Bloque 1 · Trazabilidad',
    pista: 'Seguir el origen KYC / no-KYC de cada saldo: «¿de dónde salió esta cripto?».',
  },
  fiscal: {
    clave: 'manual.fiscal',
    bloque: 'Bloque 3 · Fiscalidad',
    pista: 'Resumen anual orientativo por cajones. No es asesoramiento ni declaración.',
  },
  ubicaciones: {
    clave: 'manual.ubicaciones',
    bloque: 'Bloque 1 · Ubicaciones',
    pista: 'Declarar dónde está la cripto (exchange, wallet…) y si la vía llevaba KYC.',
  },
  parametros: {
    clave: 'manual.parametros',
    bloque: 'Bloque 2 · Parámetros',
    pista: 'Los 11 tipos de operación, los activos y las tolerancias del cuadre.',
  },
  ajustes: {
    clave: 'manual.ajustes',
    bloque: 'Transversal · Puentes y copias',
    pista: 'Alternar con Excel/CSV sin pérdida y guardar/restaurar tu copia local.',
  },
}
