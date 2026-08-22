/**
 * tipos.ts — el CASO DE TALLER: un ejercicio de clase cargable en el Libro con un clic.
 *
 * El caso de ejemplo de la app (`data/demo/caso-demo.ts`) enseña la aplicación: es completo,
 * es largo y está bien. Precisamente por eso no sirve para dar clase. Cuando el profesor
 * explica la Unidad 7 —depuración y reconstrucción— necesita repartir un libro SUCIO, con
 * los errores típicos dentro, porque un caso perfecto no se puede depurar.
 *
 * Un caso de taller es, por tanto, tres cosas a la vez:
 *
 *   · un DATASET cargable (`datos`, de la forma `CasoCargable` del repositorio, que es la
 *     misma que usa el caso de ejemplo: los carga la misma función);
 *   · un ENUNCIADO, escrito para el alumno, que plantea sin resolver;
 *   · una SOLUCIÓN opcional, que NO se muestra en el enunciado y vive aquí para que la
 *     pantalla pueda ofrecer «comprobar» más adelante y para que las pruebas verifiquen que
 *     el caso falla exactamente como promete.
 *
 * Módulo de datos puro: sin React, sin Dexie. `CasoCargable` se importa SOLO como tipo, de
 * modo que este árbol no arrastra la capa de almacenamiento a los tests del motor.
 */
import type { CasoCargable } from '../repositorio'

/** Nivel del ejercicio, para que el profesor ordene la sesión. */
export type DificultadCaso = 'introductorio' | 'medio' | 'avanzado'

/**
 * Un saldo esperado tras corregir el caso (ubicación × activo), en cadena decimal interna
 * (punto). Es la referencia contra la que se comprobará el trabajo del alumno.
 */
export interface SaldoEsperado {
  ubicacion: string
  activo: string
  saldo: string
}

/** Una cifra fiscal esperada tras corregir el caso, por ejercicio y cajón. */
export interface CifraFiscalEsperada {
  ejercicio: number
  /** Cajón de `CONCEPTOS_FISCALES` o concepto reconocible ('ahorro.neto', 'rcm.total'…). */
  concepto: string
  importeEUR: string
}

/**
 * La solución cerrada de un caso. **Nunca se muestra en el enunciado.** Existe para el
 * futuro botón «comprobar» de la pantalla y, hoy, para que `casos.test.ts` verifique que el
 * ejercicio tiene la salida que promete.
 */
export interface SolucionCaso {
  /** Lo que hay que hacer, en orden, redactado para el profesor. */
  correcciones: readonly string[]
  /** Saldos que deben quedar una vez corregido (los que declara el CUADRE del caso). */
  saldosEsperados?: readonly SaldoEsperado[]
  /** Cifras fiscales que deben salir una vez corregido. */
  fiscalEsperado?: readonly CifraFiscalEsperada[]
}

/**
 * Un caso del taller: el ejercicio de una unidad, listo para repartir en clase.
 *
 * `datos` es exactamente lo que `repositorio.cargarCaso` espera. Ninguno de estos casos
 * marca `marcarDemo`: el caso de ejemplo es el onboarding de la app y los casos del taller
 * son otra cosa —trabajo del alumno—, de modo que el recordatorio de copia de seguridad
 * debe seguir funcionando con ellos cargados.
 */
export interface CasoTaller {
  /** Identificador estable ('u5-primer-cuadre'). Es también la clave de la lista. */
  id: string
  /** Unidad del manual a la que acompaña. */
  unidad: number
  titulo: string
  /**
   * El enunciado, en varios párrafos: qué le ha pasado al alumno de la historia, qué se le
   * pide y qué debería obtener. PLANTEA, no resuelve.
   */
  enunciado: string
  /** Los puntos que el caso enseña, para la tarjeta de la pantalla. */
  queEnsena: readonly string[]
  dificultad: DificultadCaso
  /** Duración estimada del ejercicio en clase. */
  minutosEstimados: number
  datos: CasoCargable
  solucion?: SolucionCaso
}

/** Etiqueta de presentación de la dificultad (es-ES). */
export const ETIQUETA_DIFICULTAD: Readonly<Record<DificultadCaso, string>> = Object.freeze({
  introductorio: 'Introductorio',
  medio: 'Medio',
  avanzado: 'Avanzado',
})
