/**
 * autocorreccion.ts — motor de AUTOCORRECCIÓN del Libro.
 *
 * Qué resuelve. El manual del taller trae un banco de ejercicios con solucionario, pero el
 * solucionario vive en el PDF: el alumno hace el ejercicio en la app, cree que lo ha hecho
 * bien y no lo sabe hasta la clase síncrona. Y sin embargo el motor ya calcula todo lo
 * necesario para decírselo —saldos, cola FIFO, cuadre, conciliación, cajones fiscales—:
 * lo único que faltaba era comparar el Libro del alumno con el Libro de la solución y
 * traducir la diferencia a algo que enseñe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ES AUTOEVALUACIÓN, NO CALIFICACIÓN. Este módulo no pone notas, no las guarda y no las
 * envía a ninguna parte: la universidad no ha comunicado todavía las secciones que
 * conforman la nota, y aunque lo hubiera hecho, el objetivo aquí es que el alumno entienda
 * en qué se ha desviado, no puntuarlo. Por eso en todo el fichero —y en la pantalla que lo
 * presenta— no aparece la palabra «nota», ni «puntuación», ni «aprobado»: se habla de
 * hallazgos, de capas que coinciden y de pistas. Un corrector que puntúa se lee una vez;
 * uno que explica se usa hasta que sobra.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LAS CUATRO CAPAS, y por qué en ese orden.
 *
 * Decir «no cuadra» ya lo dice el CUADRE. Lo que hace falta es señalar el apunte y la
 * columna donde se torció. La comparación se organiza de lo más grueso a lo más fino:
 *
 *   1. SALDOS  (ubicación × activo) — «¿tengo lo que debería tener, y dónde?»
 *   2. FIFO    (existencias, coste vivo y resultado de cada transmisión) — «¿a qué coste?»
 *   3. FISCAL  (los cajones del ejercicio) — «¿en qué base acaba?»
 *   4. APUNTES (el emparejamiento apunte a apunte) — «¿en qué línea y en qué columna?»
 *
 * Las tres primeras son SÍNTOMAS; la cuarta es la CAUSA. Dos libros con los mismos apuntes
 * producen forzosamente los mismos saldos, la misma cola y los mismos cajones: si algo
 * difiere arriba, es porque abajo hay un apunte que sobra, falta o diverge. De ahí la regla
 * de presentación que gobierna todo el módulo:
 *
 *   **un error se cuenta UNA vez, y arriba.** Un apunte mal clasificado en enero que
 *   arrastra ocho transmisiones no son nueve hallazgos: es uno, con ocho consecuencias
 *   colgando de él. La cascada silenciada es la mitad del valor de esto — un listado de
 *   cuarenta líneas derivadas de un solo tecleo no enseña, abruma.
 *
 * Ver `absorberCascada`: un hallazgo de las capas 1-3 cuya HUELLA (celdas, activos y
 * cajones que puede tocar) está cubierta por un hallazgo de la capa 4 deja de ser raíz y
 * pasa a colgar de él como `Consecuencia`. No se pierde: se subordina.
 *
 * EMPAREJAMIENTO POR HECHO, NO POR CORRELATIVO. El `id` del apunte (`AAAA-NNN`) se
 * renumera al insertar una línea, así que compararlo sería comparar el azar. Los apuntes se
 * emparejan por lo que describen —fecha, activos y cantidades—, en tres pasadas de rigor
 * decreciente. Consecuencia buscada: barajar el diario no genera ni un hallazgo, y teclear
 * mal una fecha se ve como lo que es (un campo divergente) y no como un apunte que sobra
 * más otro que falta.
 *
 * PISTAS QUE NO DAN LA RESPUESTA. «El coste FIFO de la venta del 12/03 no coincide: revisa
 * las adquisiciones anteriores de ese activo» enseña; «pon 4.312,50 en la celda L7» no.
 * Todas las pistas de este fichero apuntan a DÓNDE mirar y a QUÉ preguntarse, nunca al
 * valor. Y ninguna afirma una calificación fiscal por su cuenta (Regla de oro 5): remiten
 * al catálogo cerrado, al manual o a la letra de la ley, que citar sí se puede.
 *
 * MODO SIN SOLUCIÓN. Un ejercicio abierto —el Libro del propio alumno— no tiene solución
 * contra la que compararse, pero sí se puede contrastar con las reglas del método:
 * `validarDiario` (que ya incorpora la conciliación FIFO↔SALDOS) y el estado probatorio del
 * Archivo. Eso es `revisar()`, y se llama revisión, no corrección: no hay respuesta correcta
 * que enseñar, solo método que cumplir.
 *
 * Determinista y sin estado: mismos libros → misma corrección, siempre. Sin `Date.now()`,
 * sin aleatoriedad, sin orden dependiente de la iteración de un `Set` no ordenado.
 * TypeScript puro (Regla de oro 4): sin React, sin Dexie, sin API del navegador.
 */

import {
  type Activo,
  type Apunte,
  type IdApunte,
  type Justificante,
  type RefUbicacion,
  type ResultadoTransmision,
  type SimboloActivo,
  type TipoOperacion,
  type Tolerancias,
  type Ubicacion,
  ACTIVOS_BASE,
  ETIQUETA_TIPO,
  TOLERANCIAS_POR_DEFECTO,
  UBICACION_EXTERIOR,
} from './types'
import { D, aCadena, Decimal } from './decimal'
import { calcularSaldos } from './saldos'
import { calcularFifo } from './fifo'
import { estadoSemaforo } from './cuadre'
import { validarDiario, type Aviso } from './validaciones'
import { informeCompletitud, mapaKyc } from './archivo'
import {
  calcularResumenFiscal,
  CONCEPTOS_FISCALES,
  type ConceptoFiscal,
  type ResumenFiscal,
} from './fiscal'

// ────────────────────────────────────────────────────────────────────────────
// 1. Entradas
// ────────────────────────────────────────────────────────────────────────────

/**
 * Los dos libros que se comparan tienen que ofrecer lo mismo: apuntes, ubicaciones y —si el
 * ejercicio añade activos al catálogo— los activos. Deliberadamente NO incluye
 * justificantes: el Archivo no se corrige contra una solución (dos alumnos pueden probar
 * el mismo hecho con documentos distintos y ambos tener razón); se revisa contra su
 * checklist, y eso es `revisar()`.
 */
export interface LibroComparable {
  apuntes: readonly Apunte[]
  ubicaciones: readonly Ubicacion[]
  activos?: readonly Activo[]
}

/** Opciones de la corrección. Todas tienen un valor por defecto razonable. */
export interface OpcionesCorreccion {
  /** Tolerancias del semáforo para las CANTIDADES (por defecto, las del cuadre). */
  tolerancias?: Tolerancias
  /**
   * Umbral en euros por debajo del cual una diferencia no se reporta. Por defecto medio
   * céntimo: por debajo de eso no hay nada que aprender, solo ruido de redondeo (desde D0
   * el prorrateo del gas produce importes periódicos).
   */
  toleranciaEUR?: string
  /**
   * Margen en días para emparejar un apunte cuya fecha no coincide con la de la solución.
   * Existe para que una fecha mal tecleada se vea como un campo divergente y no como un
   * apunte que sobra más otro que falta, que es el mismo error contado dos veces y sin
   * decir cuál es. Por defecto, 3 días.
   */
  margenDiasEmparejado?: number
  /** Ejercicios a comparar en la capa fiscal. Por defecto, los de ambos libros. */
  ejercicios?: readonly number[]
  /**
   * Oculta el valor esperado en la capa de APUNTES (el resto de capas son agregados y
   * siguen mostrándose). Con esto activado el alumno sabe QUÉ apunte y QUÉ columna fallan,
   * y tiene que averiguar él el valor: es el modo «solucionario cerrado» del taller.
   */
  ocultarEsperado?: boolean
  /**
   * Desactiva el silenciado de la cascada y devuelve TODOS los hallazgos como raíces.
   * Solo para depurar o para el profesor: al alumno se le presenta la causa, no el reguero.
   */
  sinCascada?: boolean
}

/** Opciones de la revisión sin solución. */
export interface OpcionesRevision {
  /** Justificantes del Archivo, para el estado probatorio. Sin ellos, esa capa no aplica. */
  justificantes?: readonly Justificante[]
  tolerancias?: Tolerancias
  /** Máximo de huecos probatorios que se listan uno a uno. Por defecto, 8. */
  maxHuecos?: number
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Salida
// ────────────────────────────────────────────────────────────────────────────

/** Las capas en las que se organiza la comparación (y la revisión). */
export type CapaCorreccion = 'saldos' | 'fifo' | 'fiscal' | 'apuntes' | 'metodo' | 'archivo'

/** Orden de presentación de las capas: de lo más grueso a lo más fino. */
const ORDEN_CAPA: Readonly<Record<CapaCorreccion, number>> = Object.freeze({
  saldos: 0,
  fifo: 1,
  fiscal: 2,
  apuntes: 3,
  metodo: 4,
  archivo: 5,
})

/** Nombre de cada capa para la pantalla (estructural, no es calificación). */
export const ETIQUETA_CAPA: Readonly<Record<CapaCorreccion, string>> = Object.freeze({
  saldos: 'Saldos por ubicación y activo',
  fifo: 'Cola FIFO y resultado de las transmisiones',
  fiscal: 'Cajones fiscales del ejercicio',
  apuntes: 'Apuntes del diario',
  metodo: 'Reglas del método',
  archivo: 'Expediente probatorio',
})

/** Una línea de por qué cada capa está donde está (para el encabezado de la pantalla). */
export const DESCRIPCION_CAPA: Readonly<Record<CapaCorreccion, string>> = Object.freeze({
  saldos: '¿Tienes lo que deberías tener, y en la ubicación que toca?',
  fifo: '¿A qué coste? Existencias vivas, coste de la cola y resultado de cada transmisión.',
  fiscal:
    '¿En qué base imponible acaba cada hecho? Ahorro, derivados, RCM, actividad, base general y pérdidas.',
  apuntes: 'La línea y la columna donde se torció: apuntes que sobran, faltan o divergen.',
  metodo: 'Lo que el método exige de cualquier Libro, haya o no solución con la que compararlo.',
  archivo: 'Qué documento falta para que cada apunte sea defendible.',
})

/** Gravedad de un hallazgo. NO es una puntuación: ordena la atención, no califica. */
export type Gravedad = 'error' | 'aviso' | 'info'

const ORDEN_GRAVEDAD: Readonly<Record<Gravedad, number>> = Object.freeze({
  error: 0,
  aviso: 1,
  info: 2,
})

/** Códigos estables de hallazgo (para la UI y para los tests). */
export type CodigoHallazgo =
  | 'SALDO_CELDA'
  | 'FIFO_EXISTENCIAS'
  | 'FIFO_COSTE_RESTANTE'
  | 'FIFO_TRANSMISION'
  | 'FIFO_TRANSMISION_INESPERADA'
  | 'FIFO_TRANSMISION_AUSENTE'
  | 'FISCAL_CAJON'
  | 'APUNTE_SOBRANTE'
  | 'APUNTE_FALTANTE'
  | 'APUNTE_DIVERGENTE'
  | 'METODO_AVISO'
  | 'ARCHIVO_HUECO'

/** Cómo debe pintar la UI un valor esperado/encontrado (el motor no formatea). */
export type FormatoValor = 'cantidad' | 'euro' | 'fecha' | 'texto'

/** Campos del apunte que se cotejan cuando dos apuntes emparejan pero no coinciden. */
export type CampoApunte =
  | 'tipo'
  | 'sentido'
  | 'fechaHora'
  | 'activoSalida'
  | 'cantidadSalida'
  | 'activoEntrada'
  | 'cantidadEntrada'
  | 'contravalorEUR'
  | 'valorMercadoEntregadoEUR'
  | 'valorMercadoRecibidoEUR'
  | 'comisionActivo'
  | 'comisionCantidad'
  | 'ubicacionOrigen'
  | 'ubicacionDestino'
  | 'rectificaA'

/**
 * Orden de cotejo de los campos, que es también su orden de CAUSALIDAD: el tipo manda
 * sobre todo lo demás (decide el cajón fiscal y si la cola se mueve), el sentido resuelve
 * los «según el caso», y las ubicaciones son el detalle más benigno (mueven el reparto,
 * no el total). El primer campo divergente de esta lista es el que la pantalla destaca.
 *
 * `notas` y `justificante` quedan fuera a propósito: son texto libre del alumno, no
 * respuesta del ejercicio. Corregir la prosa de alguien no es corregir su contabilidad.
 */
const ORDEN_CAMPOS: readonly CampoApunte[] = [
  'tipo',
  'sentido',
  'fechaHora',
  'activoSalida',
  'activoEntrada',
  'cantidadSalida',
  'cantidadEntrada',
  'contravalorEUR',
  'valorMercadoEntregadoEUR',
  'valorMercadoRecibidoEUR',
  'comisionActivo',
  'comisionCantidad',
  'ubicacionOrigen',
  'ubicacionDestino',
  'rectificaA',
]

/** Nombre del campo para la pantalla. */
export const ETIQUETA_CAMPO: Readonly<Record<CampoApunte, string>> = Object.freeze({
  tipo: 'Tipo de operación',
  sentido: 'Sentido (entregada / recibida / solo saldos)',
  fechaHora: 'Fecha y hora',
  activoSalida: 'Activo que sale',
  cantidadSalida: 'Cantidad que sale',
  activoEntrada: 'Activo que entra',
  cantidadEntrada: 'Cantidad que entra',
  contravalorEUR: 'Contravalor en euros',
  valorMercadoEntregadoEUR: 'Valor de mercado de lo entregado',
  valorMercadoRecibidoEUR: 'Valor de mercado de lo recibido',
  comisionActivo: 'Activo de la comisión',
  comisionCantidad: 'Cantidad de la comisión',
  ubicacionOrigen: 'Ubicación de origen',
  ubicacionDestino: 'Ubicación de destino',
  rectificaA: 'Apunte que rectifica',
})

/** Cómo se pinta cada campo. */
const FORMATO_CAMPO: Readonly<Record<CampoApunte, FormatoValor>> = Object.freeze({
  tipo: 'texto',
  sentido: 'texto',
  fechaHora: 'fecha',
  activoSalida: 'texto',
  cantidadSalida: 'cantidad',
  activoEntrada: 'texto',
  cantidadEntrada: 'cantidad',
  contravalorEUR: 'euro',
  valorMercadoEntregadoEUR: 'euro',
  valorMercadoRecibidoEUR: 'euro',
  comisionActivo: 'texto',
  comisionCantidad: 'cantidad',
  ubicacionOrigen: 'texto',
  ubicacionDestino: 'texto',
  rectificaA: 'texto',
})

/**
 * PISTA de cada campo: dónde mirar y qué preguntarse. Nunca el valor, y nunca una
 * calificación fiscal redactada aquí (Regla de oro 5): se remite al catálogo cerrado, al
 * manual del taller o a la letra del artículo, que citar sí está permitido.
 */
export const PISTA_CAMPO: Readonly<Record<CampoApunte, string>> = Object.freeze({
  tipo: 'El hecho está anotado, pero no con el tipo que le corresponde. Vuelve al catálogo cerrado (Tabla 7) y reconstruye qué pasó económicamente: qué salió del patrimonio, qué entró y si hubo contraprestación. Es el error más caro de todos porque no descuadra ningún saldo —el CUADRE lo da por bueno— y sin embargo cambia el cajón fiscal en el que acaba.',
  sentido:
    'DONACIÓN y AJUSTE llevan flags «según el caso» en el catálogo: mientras no digas si el apunte entrega o recibe, el motor no sabe si mover la cola FIFO. Relee el enunciado y decide quién da y quién recibe.',
  fechaHora:
    'La fecha no es la del enunciado. El FIFO consume por antigüedad, así que cambiar un apunte de sitio cambia qué lote paga la siguiente transmisión y con qué coste.',
  activoSalida:
    'El activo que sale no es el del enunciado. Recuerda la regla de identidad del método: BTC, WBTC y un saldo en Lightning son activos distintos, con colas distintas.',
  activoEntrada:
    'El activo que entra no es el del enunciado. Recuerda la regla de identidad del método: BTC, WBTC y un saldo en Lightning son activos distintos, con colas distintas.',
  cantidadSalida:
    'La cantidad que sale no coincide. Comprueba si has anotado el bruto donde iba el neto o al revés: la comisión no se resta a mano de la cantidad, va en su propia columna.',
  cantidadEntrada:
    'La cantidad que entra no coincide. Comprueba si has anotado el bruto donde iba el neto o al revés: la comisión no se resta a mano de la cantidad, va en su propia columna.',
  contravalorEUR:
    'El contravalor en euros no coincide. Los saldos no dependen de él —por eso el cuadre lo da por bueno— pero la ganancia o pérdida sí. Vuelve a la cotización del día del enunciado y repasa el tecleo, empezando por dónde has puesto la coma.',
  valorMercadoEntregadoEUR:
    'En la permuta hay DOS valores de mercado y el art. 37.1.h) LIRPF manda cuantificar por el mayor de los dos. Comprueba que has declarado ambos y cuál de ellos es el que aplica.',
  valorMercadoRecibidoEUR:
    'En la permuta hay DOS valores de mercado y el art. 37.1.h) LIRPF manda cuantificar por el mayor de los dos. Comprueba que has declarado ambos y cuál de ellos es el que aplica.',
  comisionActivo:
    'La comisión no está en el activo del enunciado, y el activo decide su tratamiento: en euros suma al coste de adquisición o minora el valor de transmisión; en cripto, además, reduce existencias de su propia cola.',
  comisionCantidad:
    'La comisión no coincide. Búscala en el extracto: casi nunca aparece en la misma línea que la operación, y omitirla deja la cola FIFO por encima del saldo real.',
  ubicacionOrigen:
    'La ubicación de origen no es la del enunciado. El total del activo puede salir igual y estar mal repartido: el saldo se lleva por ubicación × activo, y el Bloque 1 se vertebra sobre la columna KYC de cada una.',
  ubicacionDestino:
    'La ubicación de destino no es la del enunciado. El total del activo puede salir igual y estar mal repartido: el saldo se lleva por ubicación × activo, y el Bloque 1 se vertebra sobre la columna KYC de cada una.',
  rectificaA:
    'Un AJUSTE que no dice a qué apunte rectifica no es auditable, y el principio 7 del método (correcciones auditables, U7.4) exige referencia y causa. Comprueba a qué línea apunta.',
})

/** Ficha mínima de un apunte, para que la pantalla lo reconozca sin volver al diario. */
export interface ResumenApunte {
  id: IdApunte
  fechaHora: string
  tipo: TipoOperacion
  /** Etiqueta del tipo con acentos (la de `ETIQUETA_TIPO`). */
  etiquetaTipo: string
  activoSalida?: SimboloActivo
  cantidadSalida?: string
  activoEntrada?: SimboloActivo
  cantidadEntrada?: string
  contravalorEUR?: string
}

/** Un campo que difiere entre el apunte del alumno y el de la solución. */
export interface Divergencia {
  campo: CampoApunte
  /** Valor de la solución. Ausente con `ocultarEsperado`. */
  esperado?: string
  encontrado?: string
  formato: FormatoValor
  pista: string
}

/**
 * Un hallazgo de las capas 1-3 que otro hallazgo ya explica. No se pierde: cuelga de su
 * causa para que se vea el alcance del error sin convertirlo en una lista de cuarenta
 * líneas.
 */
export interface Consecuencia {
  capa: CapaCorreccion
  codigo: CodigoHallazgo
  titulo: string
  /** Apunte del alumno al que se refiere, si lo hay: sin él, cuatro transmisiones del
   *  mismo activo se pintarían como cuatro líneas idénticas. */
  apunteId?: IdApunte
  esperado?: string
  encontrado?: string
  formato: FormatoValor
}

/** Un hallazgo: en qué se ha desviado el alumno, y qué mirar para entenderlo. */
export interface Hallazgo {
  /** Identificador estable y determinista (mismo libro → mismo id). */
  id: string
  capa: CapaCorreccion
  codigo: CodigoHallazgo
  gravedad: Gravedad
  /** Qué ha pasado, en una línea. */
  titulo: string
  /** Apunte del libro del ALUMNO al que se refiere, si aplica. */
  apunteId?: IdApunte
  /** Apunte de la SOLUCIÓN, si aplica (en los faltantes es el único que hay). */
  apunteSolucionId?: IdApunte
  /** Ficha del apunte del alumno, para pintarlo sin volver al diario. */
  resumenAlumno?: ResumenApunte
  /** Ficha del apunte de la solución. Ausente con `ocultarEsperado`. */
  resumenSolucion?: ResumenApunte
  /** Campos divergentes, en orden de causalidad (solo en APUNTE_DIVERGENTE). */
  campos?: readonly Divergencia[]
  /** Qué esperaba. Ausente con `ocultarEsperado` en la capa de apuntes. */
  esperado?: string
  /** Qué encontró. */
  encontrado?: string
  formato: FormatoValor
  /** La pista: dónde mirar y qué preguntarse. Nunca la respuesta. */
  pista: string
  /** Hallazgos que este explica y que por eso no se listan aparte. */
  consecuencias: readonly Consecuencia[]
}

/** Estado de una capa: si aplica, si coincide y cuánto arrastra. */
export interface EstadoCapa {
  capa: CapaCorreccion
  etiqueta: string
  descripcion: string
  /** false cuando la capa no se ha podido comprobar (p. ej. Archivo sin justificantes). */
  aplica: boolean
  /** true si la capa no ha producido ningún hallazgo, ni raíz ni consecuencia. */
  coincide: boolean
  /** Hallazgos que se presentan como raíz en esta capa. */
  raices: number
  /** Hallazgos de esta capa absorbidos como consecuencia de una causa de otra capa. */
  consecuencias: number
}

/** Clasificación de un apunte tras el emparejamiento. */
export type ClasePareja = 'coincidente' | 'divergente' | 'sobrante' | 'faltante'

/** El resultado del emparejamiento de un apunte (o de su ausencia). */
export interface Pareja {
  clase: ClasePareja
  alumnoId?: IdApunte
  solucionId?: IdApunte
  /** Campos divergentes (vacío salvo en `divergente`). */
  campos: readonly CampoApunte[]
}

/** Recuento del emparejamiento, que es el resumen honesto de la capa 4. */
export interface ResumenEmparejamiento {
  coincidentes: number
  divergentes: number
  sobrantes: number
  faltantes: number
  parejas: readonly Pareja[]
}

/** El resultado de corregir (o de revisar). Sin nota, sin puntuación, sin veredicto. */
export interface Correccion {
  /** `correccion` compara contra una solución; `revision` contrasta contra el método. */
  modo: 'correccion' | 'revision'
  /** true si no hay ni un hallazgo, ni raíz ni silenciado. */
  sinDesviaciones: boolean
  capas: readonly EstadoCapa[]
  /** Hallazgos raíz, ordenados por causa (ver `ordenarPorCausa`). */
  hallazgos: readonly Hallazgo[]
  /** Cuántos hallazgos se han absorbido como consecuencia (la cascada silenciada). */
  consecuenciasSilenciadas: number
  /** El emparejamiento apunte a apunte, para el detalle y para los tests. */
  emparejamiento: ResumenEmparejamiento
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Utilidades internas
// ────────────────────────────────────────────────────────────────────────────

const MARGEN_DIAS_POR_DEFECTO = 3
const TOLERANCIA_EUR_POR_DEFECTO = '0.005'
const MAX_HUECOS_POR_DEFECTO = 8
const MS_POR_DIA = 86_400_000

/** Emparejamiento vacío (revisión, o libros sin apuntes). */
const EMPAREJAMIENTO_VACIO: ResumenEmparejamiento = {
  coincidentes: 0,
  divergentes: 0,
  sobrantes: 0,
  faltantes: 0,
  parejas: [],
}

/**
 * Orden canónico del diario: por fecha y, a igualdad, por correlativo. Se aplica a una
 * COPIA antes de cualquier cálculo, por dos razones que van juntas: `calcularFifo` exige
 * orden cronológico y lanzaría con un diario barajado, y la corrección tiene que ser
 * indiferente al orden en que el alumno tecleó las líneas —lo que se corrige es el
 * contenido del Libro, no el itinerario por el que llegó a él.
 */
function enOrden(apuntes: readonly Apunte[]): Apunte[] {
  return [...apuntes].sort(
    (a, b) => a.fechaHora.localeCompare(b.fechaHora) || a.id.localeCompare(b.id),
  )
}

/** Cadena decimal normalizada («0.50» y «0.5» son la misma cantidad). Vacío → ''. */
function norm(valor: string | undefined): string {
  if (valor === undefined || valor === '') return ''
  return aCadena(D(valor))
}

/** ¿Dos valores decimales del dominio son iguales? (Ausente y vacío se tratan igual.) */
function igualDecimal(a: string | undefined, b: string | undefined): boolean {
  const va = a ?? ''
  const vb = b ?? ''
  if (va === '' || vb === '') return va === vb
  return D(va).equals(D(vb))
}

/** Día ISO («2024-03-10») de una marca temporal. */
function dia(fechaHora: string): string {
  return fechaHora.slice(0, 10)
}

/** Distancia en días entre dos marcas temporales (para el emparejamiento con margen). */
function distanciaDias(a: string, b: string): number {
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY
  return Math.abs(ta - tb) / MS_POR_DIA
}

/** Ejercicio (año) de una marca temporal. */
function ejercicioDe(fechaHora: string): number {
  return Number(fechaHora.slice(0, 4))
}

/** Ficha mínima del apunte para la pantalla. */
function resumir(ap: Apunte): ResumenApunte {
  return {
    id: ap.id,
    fechaHora: ap.fechaHora,
    tipo: ap.tipo,
    etiquetaTipo: ETIQUETA_TIPO[ap.tipo],
    ...(ap.activoSalida ? { activoSalida: ap.activoSalida } : {}),
    ...(ap.cantidadSalida ? { cantidadSalida: ap.cantidadSalida } : {}),
    ...(ap.activoEntrada ? { activoEntrada: ap.activoEntrada } : {}),
    ...(ap.cantidadEntrada ? { cantidadEntrada: ap.cantidadEntrada } : {}),
    ...(ap.contravalorEUR ? { contravalorEUR: ap.contravalorEUR } : {}),
  }
}

/** Clave estable de una celda de saldos. */
function claveCelda(ubicacion: RefUbicacion, activo: SimboloActivo): string {
  return `${ubicacion} ${activo}`
}

/** Cajón fiscal al que alimenta un tipo de operación (o `undefined` si a ninguno). */
function cajonDeTipo(tipo: TipoOperacion): ConceptoFiscal | undefined {
  for (const def of Object.values(CONCEPTOS_FISCALES)) {
    if (def.tipos.includes(tipo)) return def.clave
  }
  return undefined
}

/** Símbolos fiat del catálogo unido de ambos libros (el euro no abre cola FIFO). */
function simbolosFiat(...catalogos: (readonly Activo[] | undefined)[]): Set<SimboloActivo> {
  const fiat = new Set<SimboloActivo>()
  for (const a of [...ACTIVOS_BASE, ...catalogos.flatMap((c) => [...(c ?? [])])]) {
    if (a.esFiat) fiat.add(a.simbolo)
    else fiat.delete(a.simbolo)
  }
  return fiat
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Emparejamiento de apuntes (la capa 4, que es la de las causas)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Firma FUERTE: el hecho económico completo del día —qué sale y qué entra, con sus
 * cantidades—. Deliberadamente NO incluye el tipo: si lo incluyera, un apunte con el tipo
 * mal puesto no emparejaría con nada y se reportaría como «sobra uno y falta otro», que es
 * el mismo error contado dos veces y sin decir cuál es la columna que falla.
 */
function firmaFuerte(ap: Apunte): string {
  return [
    dia(ap.fechaHora),
    ap.activoSalida ?? '',
    norm(ap.cantidadSalida),
    ap.activoEntrada ?? '',
    norm(ap.cantidadEntrada),
  ].join('|')
}

/** Firma MEDIA: mismo día y mismos activos, sin mirar las cantidades. */
function firmaMedia(ap: Apunte): string {
  return [dia(ap.fechaHora), ap.activoSalida ?? '', ap.activoEntrada ?? ''].join('|')
}

/** Firma DÉBIL: mismos activos y cantidades, sin mirar el día (fecha mal tecleada). */
function firmaDebil(ap: Apunte): string {
  return [
    ap.activoSalida ?? '',
    norm(ap.cantidadSalida),
    ap.activoEntrada ?? '',
    norm(ap.cantidadEntrada),
  ].join('|')
}

/** Índice de apuntes por firma, conservando el orden canónico dentro de cada cubeta. */
function indexarPor(
  apuntes: readonly Apunte[],
  firma: (ap: Apunte) => string,
): Map<string, Apunte[]> {
  const mapa = new Map<string, Apunte[]>()
  for (const ap of apuntes) {
    const k = firma(ap)
    const lista = mapa.get(k)
    if (lista) lista.push(ap)
    else mapa.set(k, [ap])
  }
  return mapa
}

/** Valor textual de un campo del apunte (para cotejarlo y para mostrarlo). */
function valorCampo(ap: Apunte, campo: CampoApunte): string | undefined {
  switch (campo) {
    case 'tipo':
      return ap.tipo
    case 'sentido':
      return ap.sentido
    case 'fechaHora':
      return ap.fechaHora
    case 'activoSalida':
      return ap.activoSalida
    case 'cantidadSalida':
      return ap.cantidadSalida
    case 'activoEntrada':
      return ap.activoEntrada
    case 'cantidadEntrada':
      return ap.cantidadEntrada
    case 'contravalorEUR':
      return ap.contravalorEUR
    case 'valorMercadoEntregadoEUR':
      return ap.valorMercadoEntregadoEUR
    case 'valorMercadoRecibidoEUR':
      return ap.valorMercadoRecibidoEUR
    case 'comisionActivo':
      return ap.comisionActivo
    case 'comisionCantidad':
      return ap.comisionCantidad
    case 'ubicacionOrigen':
      return ap.ubicacionOrigen
    case 'ubicacionDestino':
      return ap.ubicacionDestino
    case 'rectificaA':
      return ap.rectificaA
  }
}

/** ¿Coincide este campo entre los dos apuntes? Los decimales se comparan por valor. */
function coincideCampo(campo: CampoApunte, alumno: Apunte, solucion: Apunte): boolean {
  const va = valorCampo(alumno, campo)
  const vs = valorCampo(solucion, campo)
  const fmt = FORMATO_CAMPO[campo]
  if (fmt === 'cantidad' || fmt === 'euro') return igualDecimal(va, vs)
  return (va ?? '') === (vs ?? '')
}

/** Campos que difieren entre dos apuntes emparejados, en orden de causalidad. */
function camposDivergentes(alumno: Apunte, solucion: Apunte): CampoApunte[] {
  return ORDEN_CAMPOS.filter((c) => !coincideCampo(c, alumno, solucion))
}

/** Un par de apuntes emparejados y los campos en los que discrepan. */
interface Par {
  alumno: Apunte
  solucion: Apunte
  campos: CampoApunte[]
}

/** Resultado interno del emparejamiento: parejas + índices para las demás capas. */
interface Emparejamiento {
  parejas: Pareja[]
  /** Pares completos (los que tienen los dos lados), para cotejar transmisiones. */
  pares: Par[]
  sobrantes: Apunte[]
  faltantes: Apunte[]
}

/**
 * Empareja los apuntes del alumno con los de la solución por el HECHO que describen, no
 * por el correlativo (que se renumera al insertar una línea, de modo que compararlo sería
 * comparar el azar). Tres pasadas de rigor decreciente, cada una sobre lo que quedó libre
 * en la anterior:
 *
 *   1. firma FUERTE  — mismo día, mismos activos, mismas cantidades. Es el caso normal.
 *   2. firma MEDIA   — mismo día y mismos activos: la cantidad está mal tecleada.
 *   3. firma DÉBIL   — mismos activos y cantidades dentro del margen de días: la fecha
 *                      está mal tecleada.
 *
 * Lo que sobra en el alumno son apuntes SOBRANTES (típicamente, uno duplicado); lo que
 * sobra en la solución, FALTANTES. Determinista: las listas se recorren en orden canónico
 * y, a igualdad de candidatos, gana el más cercano en fecha y, en último término, el
 * primero del orden canónico.
 */
function emparejar(
  alumnoApuntes: readonly Apunte[],
  solucionApuntes: readonly Apunte[],
  margenDias: number,
): Emparejamiento {
  const alumno = enOrden(alumnoApuntes)
  const solucion = enOrden(solucionApuntes)
  const usados = new Set<IdApunte>()
  const pares: Par[] = []

  const pasadas: { firma: (ap: Apunte) => string; conMargen: boolean }[] = [
    { firma: firmaFuerte, conMargen: false },
    { firma: firmaMedia, conMargen: false },
    { firma: firmaDebil, conMargen: true },
  ]

  let pendientes = alumno
  for (const { firma, conMargen } of pasadas) {
    const indice = indexarPor(
      solucion.filter((s) => !usados.has(s.id)),
      firma,
    )
    const siguientes: Apunte[] = []
    for (const ap of pendientes) {
      const candidatos = (indice.get(firma(ap)) ?? []).filter((s) => !usados.has(s.id))
      const elegibles = conMargen
        ? candidatos.filter((s) => distanciaDias(ap.fechaHora, s.fechaHora) <= margenDias)
        : candidatos
      // A igualdad de firma gana el más cercano en el tiempo y, a igualdad de distancia,
      // el primero del orden canónico (el `sort` de JS es estable desde ES2019).
      const mejor = [...elegibles].sort(
        (x, y) =>
          distanciaDias(ap.fechaHora, x.fechaHora) - distanciaDias(ap.fechaHora, y.fechaHora),
      )[0]
      if (mejor) {
        usados.add(mejor.id)
        pares.push({ alumno: ap, solucion: mejor, campos: camposDivergentes(ap, mejor) })
      } else {
        siguientes.push(ap)
      }
    }
    pendientes = siguientes
  }

  const sobrantes = pendientes
  const faltantes = solucion.filter((s) => !usados.has(s.id))

  // Orden de presentación: cronológico dentro de cada clase, que es como el alumno lee su
  // propio diario. El orden por CAUSA se aplica después, y sobre los hallazgos.
  pares.sort(
    (a, b) =>
      a.alumno.fechaHora.localeCompare(b.alumno.fechaHora) ||
      a.alumno.id.localeCompare(b.alumno.id),
  )

  const parejas: Pareja[] = [
    ...pares.map<Pareja>((p) => ({
      clase: p.campos.length === 0 ? 'coincidente' : 'divergente',
      alumnoId: p.alumno.id,
      solucionId: p.solucion.id,
      campos: p.campos,
    })),
    ...sobrantes.map<Pareja>((a) => ({ clase: 'sobrante', alumnoId: a.id, campos: [] })),
    ...faltantes.map<Pareja>((s) => ({ clase: 'faltante', solucionId: s.id, campos: [] })),
  ]

  return { parejas, pares, sobrantes, faltantes }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Huella de una causa (lo que un apunte mal puesto puede llegar a mover)
// ────────────────────────────────────────────────────────────────────────────

/**
 * HUELLA de un hallazgo de la capa de apuntes: todo lo que ese apunte puede haber movido
 * aguas abajo. Es el mecanismo que silencia la cascada.
 *
 *  · `celdas`  — los pares ubicación × activo que el apunte toca. Un apunte solo mueve el
 *    saldo de las celdas que nombra, así que aquí la atribución es exacta.
 *  · `activos` — los activos cuya cola FIFO puede haber cambiado.
 *  · `cajones` — los cajones fiscales afectados: el de su tipo (y el del tipo esperado, si
 *    el tipo es justamente lo que diverge) y, si toca algún activo con cola, también los
 *    cajones cuyo importe sale del FIFO, porque una adquisición mal registrada repercute
 *    en el coste de TODAS las transmisiones posteriores de ese activo.
 *
 * Se prefiere una huella generosa a una tacaña: pecar de silenciar de más deja al alumno
 * mirando el apunte que tiene que arreglar; pecar de silenciar de menos le devuelve el
 * reguero de cuarenta líneas que este módulo existe para evitar. Y nada se pierde: lo
 * absorbido sigue visible colgando de su causa.
 */
interface Huella {
  celdas: Set<string>
  activos: Set<SimboloActivo>
  cajones: Set<ConceptoFiscal>
}

/** Cajones cuyo importe sale del FIFO y que, por tanto, arrastra cualquier adquisición. */
const CAJONES_DEL_FIFO: readonly ConceptoFiscal[] = ['ahorro', 'perdidas']

function huellaDe(
  apuntes: readonly (Apunte | undefined)[],
  fiat: ReadonlySet<SimboloActivo>,
): Huella {
  const celdas = new Set<string>()
  const activos = new Set<SimboloActivo>()
  const cajones = new Set<ConceptoFiscal>()
  let tocaColaFifo = false

  for (const ap of apuntes) {
    if (!ap) continue
    if (ap.activoEntrada && ap.ubicacionDestino !== UBICACION_EXTERIOR) {
      celdas.add(claveCelda(ap.ubicacionDestino, ap.activoEntrada))
    }
    if (ap.activoSalida && ap.ubicacionOrigen !== UBICACION_EXTERIOR) {
      celdas.add(claveCelda(ap.ubicacionOrigen, ap.activoSalida))
    }
    if (ap.comisionActivo) {
      const ubic =
        ap.ubicacionOrigen === UBICACION_EXTERIOR ? ap.ubicacionDestino : ap.ubicacionOrigen
      if (ubic !== UBICACION_EXTERIOR) celdas.add(claveCelda(ubic, ap.comisionActivo))
    }
    for (const a of [ap.activoEntrada, ap.activoSalida, ap.comisionActivo]) {
      if (!a) continue
      activos.add(a)
      if (!fiat.has(a)) tocaColaFifo = true
    }
    const cajon = cajonDeTipo(ap.tipo)
    if (cajon) cajones.add(cajon)
  }

  if (tocaColaFifo) for (const c of CAJONES_DEL_FIFO) cajones.add(c)
  return { celdas, activos, cajones }
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Construcción de hallazgos
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un hallazgo en construcción: lleva además la REFERENCIA de aquello a lo que se refiere
 * (celda, activo o cajón), que es lo que permite decidir si una causa lo explica.
 */
interface HallazgoInterno extends Hallazgo {
  /** Celda ubicación × activo a la que se refiere (capa de saldos). */
  refCelda?: string
  /** Activo al que se refiere (capa FIFO). */
  refActivo?: SimboloActivo
  /** Cajón fiscal al que se refiere (capa fiscal). */
  refCajon?: ConceptoFiscal
  /** Cuando el hallazgo ES una causa (capa de apuntes), su huella. */
  huella?: Huella
  /**
   * Prioridad propia del hallazgo, cuando quien lo produce ya sabe cuál pesa más. Hoy solo
   * la usa la capa del Archivo, cuyo informe ordena los huecos por exigencia probatoria
   * (PÉRDIDA y DONACIÓN antes que nada, con refuerzo para las adquisiciones sin KYC).
   * Sería un error tirar ese criterio y reordenar por fecha: la denuncia de un robo no
   * espera a que se resuelvan las facturas de enero.
   */
  prioridad?: number
  /** Consecuencias absorbidas (mutable durante el ensamblado). */
  consecuencias: Consecuencia[]
}

/** Marca de «este apunte concreto» dentro de la huella de una causa. */
function marcaApunte(id: IdApunte): string {
  return `apunte ${id}`
}

/** ¿La huella de una causa explica este hallazgo? */
function explicado(h: HallazgoInterno, causa: Huella): boolean {
  if (h.refCelda !== undefined && causa.celdas.has(h.refCelda)) return true
  if (h.refActivo !== undefined && causa.activos.has(h.refActivo)) return true
  if (h.refCajon !== undefined && causa.cajones.has(h.refCajon)) return true
  // Un hallazgo colgado de un apunte que ya es causa tampoco se repite.
  if (h.apunteId !== undefined && causa.celdas.has(marcaApunte(h.apunteId))) return true
  return false
}

/** Convierte un hallazgo absorbido en la consecuencia que colgará de su causa. */
function aConsecuencia(h: HallazgoInterno): Consecuencia {
  return {
    capa: h.capa,
    codigo: h.codigo,
    titulo: h.titulo,
    ...(h.apunteId !== undefined ? { apunteId: h.apunteId } : {}),
    ...(h.esperado !== undefined ? { esperado: h.esperado } : {}),
    ...(h.encontrado !== undefined ? { encontrado: h.encontrado } : {}),
    formato: h.formato,
  }
}

/** Fecha por la que se desempata un hallazgo (la del apunte al que se refiere). */
function fechaDe(h: HallazgoInterno): string {
  return h.resumenAlumno?.fechaHora ?? h.resumenSolucion?.fechaHora ?? ''
}

/**
 * Orden de presentación de los hallazgos raíz: **por causa, no por fecha**.
 *
 *   1. cuánto explica cada uno (los que arrastran cascada, primero: son los que hay que
 *      arreglar antes de volver a mirar nada);
 *   2. la capa, de lo más grueso a lo más fino;
 *   3. la gravedad y, si el propio hallazgo trae prioridad (los huecos del Archivo), esa;
 *   4. la fecha del apunte y, en último término, el id — solo para que el resultado sea
 *      determinista, nunca como criterio de relevancia.
 */
function ordenarPorCausa(a: HallazgoInterno, b: HallazgoInterno): number {
  if (a.consecuencias.length !== b.consecuencias.length) {
    return b.consecuencias.length - a.consecuencias.length
  }
  if (ORDEN_CAPA[a.capa] !== ORDEN_CAPA[b.capa]) return ORDEN_CAPA[a.capa] - ORDEN_CAPA[b.capa]
  if (ORDEN_GRAVEDAD[a.gravedad] !== ORDEN_GRAVEDAD[b.gravedad]) {
    return ORDEN_GRAVEDAD[a.gravedad] - ORDEN_GRAVEDAD[b.gravedad]
  }
  const pa = a.prioridad ?? 0
  const pb = b.prioridad ?? 0
  if (pa !== pb) return pb - pa
  const fa = fechaDe(a)
  const fb = fechaDe(b)
  if (fa !== fb) return fa.localeCompare(fb)
  return a.id.localeCompare(b.id)
}

// ── Capa 1 · SALDOS ─────────────────────────────────────────────────────────

function compararSaldos(
  alumno: readonly Apunte[],
  solucion: readonly Apunte[],
  tol: Tolerancias,
): HallazgoInterno[] {
  const saldoAlumno = new Map<string, string>()
  const saldoSolucion = new Map<string, string>()
  const etiquetas = new Map<string, { ubicacion: RefUbicacion; activo: SimboloActivo }>()

  for (const c of calcularSaldos([...alumno])) {
    const k = claveCelda(c.ubicacion, c.activo)
    saldoAlumno.set(k, c.saldo)
    etiquetas.set(k, { ubicacion: c.ubicacion, activo: c.activo })
  }
  for (const c of calcularSaldos([...solucion])) {
    const k = claveCelda(c.ubicacion, c.activo)
    saldoSolucion.set(k, c.saldo)
    etiquetas.set(k, { ubicacion: c.ubicacion, activo: c.activo })
  }

  const hallazgos: HallazgoInterno[] = []
  for (const k of [...etiquetas.keys()].sort()) {
    const et = etiquetas.get(k)
    if (!et) continue
    const esperado = saldoSolucion.get(k) ?? '0'
    const encontrado = saldoAlumno.get(k) ?? '0'
    const diferencia = D(encontrado).minus(D(esperado))
    const estado = estadoSemaforo(diferencia, tol)
    if (estado === 'OK') continue
    hallazgos.push({
      id: `saldos:${k}`,
      capa: 'saldos',
      codigo: 'SALDO_CELDA',
      gravedad: estado === 'ERROR' ? 'error' : 'aviso',
      titulo: `El saldo de ${et.activo} en ${et.ubicacion} no es el esperado.`,
      esperado,
      encontrado,
      formato: 'cantidad',
      pista:
        'Una celda de saldo solo puede fallar por una cantidad: o falta un movimiento de este activo en esta ubicación, o sobra, o hay uno con la cantidad o la ubicación cambiadas. Filtra el diario por este activo y recorre sus entradas y salidas de arriba abajo sumando: la línea donde tu suma se separa de la del extracto es la línea.',
      consecuencias: [],
      refCelda: k,
      refActivo: et.activo,
    })
  }
  return hallazgos
}

// ── Capa 2 · FIFO ───────────────────────────────────────────────────────────

/** Transmisiones del diario indexadas por apunte (para cotejarlas pareja a pareja). */
function transmisionesPorApunte(apuntes: readonly Apunte[]): Map<IdApunte, ResultadoTransmision> {
  const mapa = new Map<IdApunte, ResultadoTransmision>()
  for (const { transmisiones } of calcularFifo([...apuntes]).values()) {
    for (const t of transmisiones) mapa.set(t.apunteId, t)
  }
  return mapa
}

function compararFifo(
  alumno: readonly Apunte[],
  solucion: readonly Apunte[],
  pares: readonly Par[],
  tol: Tolerancias,
  tolEUR: Decimal,
): HallazgoInterno[] {
  const fifoAlumno = calcularFifo([...alumno])
  const fifoSolucion = calcularFifo([...solucion])
  const hallazgos: HallazgoInterno[] = []

  // 2.a · Existencias vivas y coste de la cola, activo a activo.
  const activos = [...new Set([...fifoAlumno.keys(), ...fifoSolucion.keys()])].sort()
  for (const activo of activos) {
    const ra = fifoAlumno.get(activo)?.resumen
    const rs = fifoSolucion.get(activo)?.resumen
    const existenciasAlumno = ra?.restanteTotal ?? '0'
    const existenciasSolucion = rs?.restanteTotal ?? '0'
    const difCantidad = D(existenciasAlumno).minus(D(existenciasSolucion))
    if (estadoSemaforo(difCantidad, tol) !== 'OK') {
      hallazgos.push({
        id: `fifo:existencias:${activo}`,
        capa: 'fifo',
        codigo: 'FIFO_EXISTENCIAS',
        gravedad: 'error',
        titulo: `Las existencias vivas de ${activo} en la cola FIFO no son las esperadas.`,
        esperado: existenciasSolucion,
        encontrado: existenciasAlumno,
        formato: 'cantidad',
        pista:
          'La cola FIFO solo se mueve con los apuntes que abren o consumen lote. Repasa cuáles de tus apuntes de este activo deberían hacerlo según el catálogo cerrado, y recuerda que DONACIÓN y AJUSTE no lo deciden solos: lo decide el sentido que les hayas puesto.',
        consecuencias: [],
        refActivo: activo,
      })
      // Con las unidades descuadradas, el coste del restante difiere por fuerza: sería
      // el mismo hallazgo contado dos veces.
      continue
    }
    const costeAlumno = ra?.costeRestanteEUR ?? '0'
    const costeSolucion = rs?.costeRestanteEUR ?? '0'
    if (D(costeAlumno).minus(D(costeSolucion)).abs().greaterThan(tolEUR)) {
      hallazgos.push({
        id: `fifo:coste:${activo}`,
        capa: 'fifo',
        codigo: 'FIFO_COSTE_RESTANTE',
        gravedad: 'error',
        titulo: `Tienes las unidades de ${activo} que tocan, pero valoradas a otro coste.`,
        esperado: costeSolucion,
        encontrado: costeAlumno,
        formato: 'euro',
        pista:
          'Las cantidades cuadran y el coste no: el fallo está en los euros de alguna adquisición de este activo, no en sus unidades. Repasa los contravalores de las compras y de las entradas sin contrapartida, y dónde has puesto las comisiones (en euros, la de adquisición suma al coste del lote).',
        consecuencias: [],
        refActivo: activo,
      })
    }
  }

  // 2.b · Transmisión a transmisión, por pareja de apuntes. Es lo que de verdad se
  // pregunta el alumno: «esta venta, ¿me ha dado el resultado que debía?».
  const tAlumno = transmisionesPorApunte(alumno)
  const tSolucion = transmisionesPorApunte(solucion)

  for (const par of pares) {
    const ta = tAlumno.get(par.alumno.id)
    const ts = tSolucion.get(par.solucion.id)
    const activo = ta?.activo ?? ts?.activo ?? par.alumno.activoSalida ?? ''

    if (!ta && ts) {
      hallazgos.push({
        id: `fifo:transmision-ausente:${par.alumno.id}`,
        capa: 'fifo',
        codigo: 'FIFO_TRANSMISION_AUSENTE',
        gravedad: 'error',
        titulo:
          'Este apunte debería consumir cola FIFO y no la consume: no aparece entre tus transmisiones.',
        apunteId: par.alumno.id,
        apunteSolucionId: par.solucion.id,
        resumenAlumno: resumir(par.alumno),
        formato: 'texto',
        pista:
          'Que un apunte transmita o no lo decide su tipo en el catálogo cerrado y, en DONACIÓN y AJUSTE, el sentido. Comprueba con qué tipo lo has anotado y si le falta indicar el sentido.',
        consecuencias: [],
        refActivo: activo,
      })
      continue
    }
    if (ta && !ts) {
      hallazgos.push({
        id: `fifo:transmision-inesperada:${par.alumno.id}`,
        capa: 'fifo',
        codigo: 'FIFO_TRANSMISION_INESPERADA',
        gravedad: 'error',
        titulo:
          'Este apunte consume cola FIFO y no debería: has realizado una ganancia o pérdida que el enunciado no contempla.',
        apunteId: par.alumno.id,
        apunteSolucionId: par.solucion.id,
        resumenAlumno: resumir(par.alumno),
        formato: 'texto',
        pista:
          'No todo movimiento de salida transmite. Repasa la columna «¿Consume lote?» del catálogo para el tipo con el que lo has anotado: mover activos entre billeteras propias, por ejemplo, no realiza nada.',
        consecuencias: [],
        refActivo: activo,
      })
      continue
    }
    if (!ta || !ts) continue

    const difCoste = D(ta.costeFifoEUR).minus(D(ts.costeFifoEUR))
    const difValor = D(ta.valorTransmisionNetoEUR).minus(D(ts.valorTransmisionNetoEUR))
    const difResultado = D(ta.resultadoEUR).minus(D(ts.resultadoEUR))
    if (difResultado.abs().lessThanOrEqualTo(tolEUR)) continue

    // El diagnóstico útil está en CUÁL de los dos sumandos falla. Si el valor de
    // transmisión cuadra y el coste no, el error no está en esta línea: está aguas arriba,
    // en la adquisición que la cola le ha imputado. Es la pista que de verdad enseña.
    const soloCoste = difValor.abs().lessThanOrEqualTo(tolEUR) && difCoste.abs().greaterThan(tolEUR)
    const soloValor = difCoste.abs().lessThanOrEqualTo(tolEUR) && difValor.abs().greaterThan(tolEUR)

    const pista = soloCoste
      ? `El valor de transmisión es el correcto y el coste FIFO no: el error no está en este apunte, está antes. Revisa las adquisiciones anteriores de ${activo} —cuáles hay, en qué orden y por cuántos euros—, porque son las que esta transmisión ha consumido por antigüedad.`
      : soloValor
        ? 'El coste FIFO es el correcto y lo que no cuadra es el valor de transmisión: el fallo está en esta misma línea. Repasa el contravalor en euros y la comisión (en euros, la de venta minora el valor de transmisión).'
        : `Ni el valor de transmisión ni el coste FIFO coinciden. Empieza por el coste: si las adquisiciones anteriores de ${activo} no son las del enunciado, arréglalas primero y vuelve a mirar esta línea, porque puede resolverse sola.`

    hallazgos.push({
      id: `fifo:transmision:${par.alumno.id}`,
      capa: 'fifo',
      codigo: 'FIFO_TRANSMISION',
      gravedad: 'error',
      titulo: `El resultado de esta transmisión de ${activo} no es el esperado.`,
      apunteId: par.alumno.id,
      apunteSolucionId: par.solucion.id,
      resumenAlumno: resumir(par.alumno),
      esperado: ts.resultadoEUR,
      encontrado: ta.resultadoEUR,
      formato: 'euro',
      pista,
      consecuencias: [],
      refActivo: activo,
    })
  }

  return hallazgos
}

// ── Capa 3 · FISCAL ─────────────────────────────────────────────────────────

/** Una cifra comparable de un cajón fiscal. */
interface MetricaFiscal {
  concepto: ConceptoFiscal
  metrica: string
  etiqueta: string
  valor: string
}

/**
 * Las cifras que se cotejan de cada cajón, en orden de relevancia. Se reporta la PRIMERA
 * que difiera y no las demás: cuatro hallazgos sobre el mismo cajón son el mismo hallazgo
 * cuatro veces.
 */
function metricasFiscales(r: ResumenFiscal): MetricaFiscal[] {
  return [
    { concepto: 'ahorro', metrica: 'neto', etiqueta: 'neto', valor: r.ahorro.netoEUR },
    {
      concepto: 'ahorro',
      metrica: 'ganancias',
      etiqueta: 'total de ganancias',
      valor: r.ahorro.gananciasEUR,
    },
    {
      concepto: 'ahorro',
      metrica: 'perdidas',
      etiqueta: 'total de pérdidas',
      valor: r.ahorro.perdidasEUR,
    },
    {
      concepto: 'ahorro',
      metrica: 'no-computables',
      etiqueta: 'importe de las pérdidas que no se computan',
      valor: r.ahorro.perdidasNoComputablesEUR,
    },
    { concepto: 'derivados', metrica: 'total', etiqueta: 'total', valor: r.derivados.totalEUR },
    { concepto: 'rcm', metrica: 'total', etiqueta: 'total', valor: r.rcm.totalEUR },
    {
      concepto: 'actividad-economica',
      metrica: 'total',
      etiqueta: 'total',
      valor: r.actividadEconomica.totalEUR,
    },
    {
      concepto: 'base-general',
      metrica: 'total',
      etiqueta: 'total',
      valor: r.baseGeneral.totalEUR,
    },
    { concepto: 'perdidas', metrica: 'total', etiqueta: 'total', valor: r.perdidas.totalEUR },
  ]
}

/**
 * Pista de cada cajón. Señalan qué alimenta el cajón y remiten al catálogo o al manual:
 * NUNCA afirman aquí una calificación fiscal (Regla de oro 5, que prohíbe parafrasear
 * criterios; la calificación literal vive en `CONCEPTOS_FISCALES`).
 */
const PISTA_CAJON: Readonly<Record<ConceptoFiscal, string>> = Object.freeze({
  ahorro:
    'Este cajón se nutre de las transmisiones y su importe sale del FIFO, así que puede fallar por dos motivos muy distintos: porque alguna operación no debería estar aquí (o porque falta), o porque el coste de adquisición que la cola le ha imputado no es el que tocaba. Mira primero el desglose por operación y localiza cuál se desvía.',
  derivados:
    'Este cajón recoge las posiciones liquidadas por diferencias, cuyo importe es el resultado neto que arroja la plataforma y no una transmisión con FIFO detrás. Comprueba con qué tipo has anotado esas liquidaciones y si el neto declarado es el de la plataforma.',
  rcm: 'Este cajón se alimenta de un tipo concreto del catálogo cerrado y del contravalor del día de cada apunte. Comprueba las dos cosas: qué apuntes has llevado a ese tipo y con qué contravalor.',
  'actividad-economica':
    'Este cajón se alimenta de un tipo concreto del catálogo cerrado y del contravalor del día de cada apunte. Comprueba las dos cosas: qué apuntes has llevado a ese tipo y con qué contravalor.',
  'base-general':
    'Este cajón se alimenta de un tipo concreto del catálogo cerrado y del contravalor del día de cada apunte. Comprueba las dos cosas: qué apuntes has llevado a ese tipo y con qué contravalor.',
  perdidas:
    'Las pérdidas van a un cajón propio, aparte del ahorro, y su importe sale del coste FIFO de lo perdido. Comprueba qué apuntes has anotado con ese tipo y qué adquisiciones tenían detrás.',
})

function compararFiscal(
  alumno: LibroComparable,
  solucion: LibroComparable,
  apuntesAlumno: readonly Apunte[],
  apuntesSolucion: readonly Apunte[],
  ejercicios: readonly number[],
  tolEUR: Decimal,
): HallazgoInterno[] {
  const hallazgos: HallazgoInterno[] = []

  for (const ejercicio of ejercicios) {
    const ra = calcularResumenFiscal([...apuntesAlumno], alumno.ubicaciones, [], ejercicio)
    const rs = calcularResumenFiscal([...apuntesSolucion], solucion.ubicaciones, [], ejercicio)
    const ma = metricasFiscales(ra)
    const ms = metricasFiscales(rs)
    const yaReportado = new Set<ConceptoFiscal>()

    for (let i = 0; i < ms.length; i++) {
      const esperada = ms[i]
      const encontrada = ma[i]
      if (!esperada || !encontrada) continue
      if (yaReportado.has(esperada.concepto)) continue
      if (D(encontrada.valor).minus(D(esperada.valor)).abs().lessThanOrEqualTo(tolEUR)) continue
      yaReportado.add(esperada.concepto)
      const def = CONCEPTOS_FISCALES[esperada.concepto]
      hallazgos.push({
        id: `fiscal:${ejercicio}:${esperada.concepto}:${esperada.metrica}`,
        capa: 'fiscal',
        codigo: 'FISCAL_CAJON',
        gravedad: 'error',
        titulo: `${ejercicio} · «${def.etiqueta}»: el ${esperada.etiqueta} no es el esperado.`,
        esperado: esperada.valor,
        encontrado: encontrada.valor,
        formato: 'euro',
        pista: PISTA_CAJON[esperada.concepto],
        consecuencias: [],
        refCajon: esperada.concepto,
      })
    }
  }
  return hallazgos
}

// ── Capa 4 · APUNTES (las causas) ───────────────────────────────────────────

function compararApuntes(
  emp: Emparejamiento,
  fiat: ReadonlySet<SimboloActivo>,
  ocultarEsperado: boolean,
): HallazgoInterno[] {
  const hallazgos: HallazgoInterno[] = []

  for (const par of emp.pares) {
    if (par.campos.length === 0) continue
    const divergencias: Divergencia[] = par.campos.map((campo) => {
      const esperado = valorCampo(par.solucion, campo)
      const encontrado = valorCampo(par.alumno, campo)
      return {
        campo,
        ...(!ocultarEsperado && esperado !== undefined ? { esperado } : {}),
        ...(encontrado !== undefined ? { encontrado } : {}),
        formato: FORMATO_CAMPO[campo],
        pista: PISTA_CAMPO[campo],
      }
    })
    const principal = divergencias[0]
    if (!principal) continue

    const huella = huellaDe([par.alumno, par.solucion], fiat)
    // Además de su huella de celdas, activos y cajones, la causa se marca a sí misma: un
    // hallazgo de otra capa colgado de este mismo apunte tampoco debe repetirse.
    huella.celdas.add(marcaApunte(par.alumno.id))

    hallazgos.push({
      id: `apuntes:divergente:${par.alumno.id}`,
      capa: 'apuntes',
      codigo: 'APUNTE_DIVERGENTE',
      gravedad: 'error',
      titulo:
        par.campos.length === 1
          ? `El apunte está bien situado, pero «${ETIQUETA_CAMPO[principal.campo]}» no coincide.`
          : `El apunte está bien situado, pero hay ${par.campos.length} columnas que no coinciden; la primera es «${ETIQUETA_CAMPO[principal.campo]}».`,
      apunteId: par.alumno.id,
      apunteSolucionId: par.solucion.id,
      resumenAlumno: resumir(par.alumno),
      ...(ocultarEsperado ? {} : { resumenSolucion: resumir(par.solucion) }),
      campos: divergencias,
      ...(principal.esperado !== undefined ? { esperado: principal.esperado } : {}),
      ...(principal.encontrado !== undefined ? { encontrado: principal.encontrado } : {}),
      formato: principal.formato,
      pista: principal.pista,
      consecuencias: [],
      huella,
    })
  }

  for (const ap of emp.sobrantes) {
    const huella = huellaDe([ap], fiat)
    huella.celdas.add(marcaApunte(ap.id))
    hallazgos.push({
      id: `apuntes:sobrante:${ap.id}`,
      capa: 'apuntes',
      codigo: 'APUNTE_SOBRANTE',
      gravedad: 'error',
      titulo: 'Este apunte no está en la solución: sobra en tu diario.',
      apunteId: ap.id,
      resumenAlumno: resumir(ap),
      formato: 'texto',
      pista:
        'Un apunte de más suele ser el mismo hecho anotado dos veces —la retirada y el depósito de un mismo traslado son UNA transferencia, no dos apuntes— o un movimiento interno de la plataforma que no mueve tu patrimonio. Búscalo en el extracto: si no aparece, o si ya está recogido en otra línea tuya, es este.',
      consecuencias: [],
      huella,
    })
  }

  for (const ap of emp.faltantes) {
    hallazgos.push({
      id: `apuntes:faltante:${ap.id}`,
      capa: 'apuntes',
      codigo: 'APUNTE_FALTANTE',
      gravedad: 'error',
      titulo: 'Falta un apunte: hay un hecho del enunciado que no has anotado.',
      apunteSolucionId: ap.id,
      ...(ocultarEsperado ? {} : { resumenSolucion: resumir(ap) }),
      formato: 'texto',
      pista:
        'El principio de integridad manda anotar TODO movimiento, tenga o no efecto fiscal: las comisiones sueltas, los traslados entre billeteras propias y las entradas sin contrapartida se olvidan con facilidad, y son justamente las que dejan la cola FIFO por encima del saldo. Recorre el extracto línea a línea marcando las que ya tienes.',
      consecuencias: [],
      huella: huellaDe([ap], fiat),
    })
  }

  return hallazgos
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Ensamblado
// ────────────────────────────────────────────────────────────────────────────

/**
 * Silencia la cascada: los hallazgos de las capas 1-3 que una causa de la capa 4 ya
 * explica dejan de ser raíz y pasan a colgar de ella.
 *
 * Se atribuyen a la PRIMERA causa cuya huella los cubra, recorriendo las causas de la más
 * antigua a la más reciente. Si dos apuntes del mismo activo están mal, el que hay que
 * arreglar antes es el de arriba: rehacer el de abajo con la cola equivocada no arregla
 * nada, y volver a mirar después es gratis.
 */
function absorberCascada(
  causas: HallazgoInterno[],
  sintomas: HallazgoInterno[],
): { raices: HallazgoInterno[]; absorbidos: HallazgoInterno[] } {
  if (causas.length === 0) return { raices: sintomas, absorbidos: [] }

  const porAntiguedad = [...causas].sort(
    (a, b) => fechaDe(a).localeCompare(fechaDe(b)) || a.id.localeCompare(b.id),
  )

  const raices: HallazgoInterno[] = []
  const absorbidos: HallazgoInterno[] = []

  for (const s of sintomas) {
    const causa = porAntiguedad.find((c) => c.huella !== undefined && explicado(s, c.huella))
    if (!causa) {
      raices.push(s)
      continue
    }
    causa.consecuencias.push(aConsecuencia(s))
    absorbidos.push(s)
  }

  raices.push(...causas)
  return { raices, absorbidos }
}

/** Estado de cada capa a partir de las raíces y de lo absorbido. */
function estadosDeCapa(
  capas: readonly CapaCorreccion[],
  raices: readonly HallazgoInterno[],
  absorbidos: readonly HallazgoInterno[],
  aplica: (capa: CapaCorreccion) => boolean,
): EstadoCapa[] {
  return capas.map((capa) => {
    const nRaices = raices.filter((h) => h.capa === capa).length
    const nConsecuencias = absorbidos.filter((h) => h.capa === capa).length
    return {
      capa,
      etiqueta: ETIQUETA_CAPA[capa],
      descripcion: DESCRIPCION_CAPA[capa],
      aplica: aplica(capa),
      coincide: nRaices === 0 && nConsecuencias === 0,
      raices: nRaices,
      consecuencias: nConsecuencias,
    }
  })
}

/** Quita los campos internos antes de devolver el hallazgo (la UI no los necesita). */
function limpiar(h: HallazgoInterno): Hallazgo {
  const {
    refCelda: _celda,
    refActivo: _activo,
    refCajon: _cajon,
    huella: _huella,
    prioridad: _prioridad,
    ...publico
  } = h
  return publico
}

/**
 * corregir — compara el Libro del alumno con el Libro de la solución y devuelve en qué se
 * ha desviado, capa a capa, con la cascada silenciada y una pista por hallazgo.
 *
 * Determinista y sin estado: los mismos libros, en cualquier orden de tecleo, dan la misma
 * corrección. No devuelve nota, ni puntuación, ni veredicto: devuelve hallazgos.
 */
export function corregir(
  alumno: LibroComparable,
  solucion: LibroComparable,
  op: OpcionesCorreccion = {},
): Correccion {
  const tol = op.tolerancias ?? TOLERANCIAS_POR_DEFECTO
  const tolEUR = D(op.toleranciaEUR ?? TOLERANCIA_EUR_POR_DEFECTO)
  const margen = op.margenDiasEmparejado ?? MARGEN_DIAS_POR_DEFECTO
  const fiat = simbolosFiat(alumno.activos, solucion.activos)

  const apuntesAlumno = enOrden(alumno.apuntes)
  const apuntesSolucion = enOrden(solucion.apuntes)

  const ejercicios =
    op.ejercicios ??
    [
      ...new Set([...apuntesAlumno, ...apuntesSolucion].map((a) => ejercicioDe(a.fechaHora))),
    ].sort((a, b) => a - b)

  const emp = emparejar(apuntesAlumno, apuntesSolucion, margen)

  const causas = compararApuntes(emp, fiat, op.ocultarEsperado === true)
  const sintomas = [
    ...compararSaldos(apuntesAlumno, apuntesSolucion, tol),
    ...compararFifo(apuntesAlumno, apuntesSolucion, emp.pares, tol, tolEUR),
    ...compararFiscal(alumno, solucion, apuntesAlumno, apuntesSolucion, ejercicios, tolEUR),
  ]

  const { raices, absorbidos } =
    op.sinCascada === true
      ? { raices: [...sintomas, ...causas], absorbidos: [] as HallazgoInterno[] }
      : absorberCascada(causas, sintomas)

  const ordenados = [...raices].sort(ordenarPorCausa)
  const capas = estadosDeCapa(['saldos', 'fifo', 'fiscal', 'apuntes'], raices, absorbidos, () => true)

  return {
    modo: 'correccion',
    sinDesviaciones: ordenados.length === 0 && absorbidos.length === 0,
    capas,
    hallazgos: ordenados.map(limpiar),
    consecuenciasSilenciadas: absorbidos.length,
    emparejamiento: {
      coincidentes: emp.parejas.filter((p) => p.clase === 'coincidente').length,
      divergentes: emp.parejas.filter((p) => p.clase === 'divergente').length,
      sobrantes: emp.sobrantes.length,
      faltantes: emp.faltantes.length,
      parejas: emp.parejas,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Revisión sin solución
// ────────────────────────────────────────────────────────────────────────────

/** Gravedad equivalente de un aviso de `validarDiario`. */
function gravedadDeAviso(a: Aviso): Gravedad {
  return a.nivel === 'error' ? 'error' : 'aviso'
}

/**
 * revisar — el modo SIN SOLUCIÓN. Un ejercicio abierto (el Libro del propio alumno) no
 * tiene solucionario contra el que compararse, pero sí tiene un método que cumplir:
 *
 *   · `validarDiario` comprueba la coherencia campos↔tipo, el contravalor donde hay
 *     alteración, el AJUSTE con su referencia, el consumo sin cola suficiente y —desde la
 *     v1.6.0— la conciliación FIFO↔SALDOS, que es la que caza el error de clasificación
 *     que el CUADRE no puede ver;
 *   · el Archivo aporta qué documento le falta a cada apunte para ser defendible.
 *
 * Se llama REVISIÓN y no corrección a propósito: aquí no hay una respuesta correcta que
 * enseñar, solo reglas que se cumplen o no. Devuelve la misma forma que `corregir` para
 * que la pantalla sea una sola.
 */
export function revisar(libro: LibroComparable, op: OpcionesRevision = {}): Correccion {
  const apuntes = enOrden(libro.apuntes)
  const justificantes = op.justificantes
  const maxHuecos = op.maxHuecos ?? MAX_HUECOS_POR_DEFECTO
  const porId = new Map(apuntes.map((a) => [a.id, a]))

  const hallazgos: HallazgoInterno[] = []

  // Capa «método»: lo que el motor ya sabe exigirle a cualquier Libro.
  const avisos = validarDiario([...apuntes], op.tolerancias, libro.activos)
  avisos.forEach((av, i) => {
    const ap = av.apunteId ? porId.get(av.apunteId) : undefined
    hallazgos.push({
      // El índice entra en el id porque un mismo apunte puede acumular varios avisos del
      // mismo código. El orden de `validarDiario` es determinista, así que el id también.
      id: `metodo:${av.codigo}:${av.apunteId ?? '-'}:${i}`,
      capa: 'metodo',
      codigo: 'METODO_AVISO',
      gravedad: gravedadDeAviso(av),
      titulo: av.mensaje,
      ...(av.apunteId ? { apunteId: av.apunteId } : {}),
      ...(ap ? { resumenAlumno: resumir(ap) } : {}),
      formato: 'texto',
      pista:
        'Esto no lo dice ninguna solución: lo dice el método. El aviso señala la regla y el apunte; el arreglo es tuyo.',
      consecuencias: [],
    })
  })

  // Capa «archivo»: qué documento falta. Solo aplica si hay justificantes que mirar.
  const aplicaArchivo = justificantes !== undefined
  if (justificantes !== undefined) {
    const informe = informeCompletitud(apuntes, justificantes, mapaKyc(libro.ubicaciones))
    for (const hueco of informe.huecos.slice(0, maxHuecos)) {
      const faltan = hueco.faltantes.map((f) => f.documento).join('; ')
      hallazgos.push({
        id: `archivo:${hueco.apunte.id}`,
        capa: 'archivo',
        codigo: 'ARCHIVO_HUECO',
        gravedad: hueco.estado === 'sin-justificar' ? 'error' : 'aviso',
        titulo: `${ETIQUETA_TIPO[hueco.apunte.tipo]}: al expediente le falta ${faltan || 'documentación'}.`,
        apunteId: hueco.apunte.id,
        resumenAlumno: resumir(hueco.apunte),
        prioridad: hueco.prioridad,
        formato: 'texto',
        pista:
          'El Libro dice qué pasó; el Archivo lo prueba. Sin el documento el apunte sigue ahí, pero no es defendible ante una comprobación: repasa la checklist probatoria de este tipo de operación.',
        consecuencias: [],
      })
    }
    if (informe.huecos.length > maxHuecos) {
      hallazgos.push({
        id: 'archivo:resto',
        capa: 'archivo',
        codigo: 'ARCHIVO_HUECO',
        gravedad: 'info',
        titulo: `Hay ${informe.huecos.length - maxHuecos} apuntes más con el expediente incompleto.`,
        formato: 'texto',
        pista:
          'La lista se corta a propósito: se muestran primero los huecos que más pesan (pérdidas, donaciones y adquisiciones sin KYC). El Archivo los tiene todos.',
        consecuencias: [],
      })
    }
  }

  const ordenados = [...hallazgos].sort(ordenarPorCausa)
  const capas = estadosDeCapa(
    ['metodo', 'archivo'],
    hallazgos,
    [],
    (capa) => capa === 'metodo' || aplicaArchivo,
  )

  return {
    modo: 'revision',
    sinDesviaciones: ordenados.length === 0,
    capas,
    hallazgos: ordenados.map(limpiar),
    consecuenciasSilenciadas: 0,
    emparejamiento: EMPAREJAMIENTO_VACIO,
  }
}
