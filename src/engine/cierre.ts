/**
 * cierre.ts — CIERRE DEL EJERCICIO. La Unidad 10 del manual convertida en herramienta.
 *
 * Por qué existe este módulo.
 *
 * La app calculaba desde hace tiempo todos los ingredientes del cierre —saldos, cola FIFO,
 * cuadre, conciliación, expediente probatorio, aviso 721— y no tenía dónde cerrarlo: el
 * alumno llegaba al resumen fiscal y se quedaba ahí. El Anexo D del manual es justamente la
 * lista de lo que queda por hacer, y estaba solo en el papel.
 *
 * Lo que este módulo modela es esa lista, con una diferencia importante respecto del papel:
 * **cada casilla que la app puede responder sola, la responde sola**. Ocho de las quince lo
 * son, porque el dato ya está en el Libro; las otras siete describen actos del mundo (bajar
 * un certificado, presentar un modelo, sacar una copia del equipo) que solo el alumno puede
 * afirmar. Distinguirlas no es un detalle de implementación: una herramienta que pide marcar
 * a mano lo que ella misma sabe enseña a marcar sin mirar, que es exactamente el hábito que
 * el checklist pretende evitar.
 *
 * La regla de cierre es literal del Anexo D: «Un ejercicio cerrado es un ejercicio en el que
 * todas las casillas están marcadas y las que no aplican están marcadas como no aplicables,
 * con su razón escrita. La diferencia entre "no lo hice" y "decidí no hacerlo, y aquí está
 * por qué" es toda la diferencia ante una comprobación». De ahí que `cerrado` exija razón
 * escrita en todo «no aplica»: una casilla descartada en blanco NO cierra el ejercicio, y esa
 * es la única severidad de este motor.
 *
 * Regla de oro 5: los textos de la columna «Qué se comprueba» y de la columna «Dónde se
 * explica» son transcripción LITERAL del Anexo D, y las citas fiscales (721, V2185-23) vienen
 * de `engine/fiscal.ts`. Lo que este módulo sí redacta es el `detalle` de cada evaluación
 * automática, que es metodológico —dice qué ha mirado el motor y qué ha encontrado—, nunca
 * una calificación fiscal.
 *
 * Capa PURA (Regla de oro 4): TypeScript, `decimal.js` y el resto del motor. Sin React, sin
 * Dexie, sin API del navegador, sin red. El aviso 721 de doble corte lo produce
 * `src/ui/fiscal/aviso721.ts`, que es capa pura pero vive fuera del motor: para no invertir
 * la dependencia (motor → interfaz), aquí se declara la FORMA que el motor necesita
 * (`EntradaAviso721`) y el resultado se INYECTA ya calculado. `cierre.test.ts` comprueba que
 * la salida real de `calcularAviso721` encaja en esa forma, de modo que un cambio allí rompe
 * la compilación aquí y no en producción.
 */

import {
  type Activo,
  type Apunte,
  type EstadoSemaforo,
  type FechaHoraISO,
  type FilaCuadre,
  type IdApunte,
  type Justificante,
  type RefUbicacion,
  type SaldoCelda,
  type SimboloActivo,
  type Tolerancias,
  type Ubicacion,
  ACTIVOS_BASE,
  TOLERANCIAS_POR_DEFECTO,
} from './types'
import { D, aCadena, CERO } from './decimal'
import { calcularSaldos } from './saldos'
import { calcularCuadre, type SaldoRealDeclarado } from './cuadre'
import { conciliarFifoSaldos, type ResultadoConciliacion } from './conciliacion'
import { informeCompletitud, mapaKyc, type InformeCompletitud } from './archivo'
import { UMBRAL_721_EUR } from './fiscal'

// ────────────────────────────────────────────────────────────────────────────
// 1. Literales del Anexo D (Regla de oro 5: se copian, no se reescriben)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Entradilla del Anexo D, literal. Es la definición de «ejercicio cerrado» que implementa
 * `EstadoCierre.cerrado`, y por eso se muestra íntegra en la pantalla y en el informe.
 */
export const ENCABEZADO_ANEXO_D =
  '«Este anexo recoge, en forma de lista comprobable, lo que las Unidades 5, 9 y 10 explican. ' +
  'Un ejercicio cerrado es un ejercicio en el que todas las casillas están marcadas y las que ' +
  'no aplican están marcadas como no aplicables, con su razón escrita. La diferencia entre ' +
  '«no lo hice» y «decidí no hacerlo, y aquí está por qué» es toda la diferencia ante una ' +
  'comprobación.» — [MT] Anexo D.'

/** Cierre del Anexo D sobre la memoria del ejercicio, literal. */
export const NOTA_MEMORIA_ANEXO_D =
  '«La memoria del ejercicio es la casilla que más rinde. Es una página, se escribe una vez al ' +
  'año y es el documento que un asesor, un heredero o el propio contribuyente dentro de cinco ' +
  'años leerá antes que ninguna otra cosa. Todo lo demás de esta lista se puede reconstruir ' +
  'con trabajo; el porqué de una decisión, no.» — [MT] Anexo D.'

/**
 * Aviso de carácter orientativo del cierre. El checklist ordena el trabajo y cifra lo que el
 * Libro sabe; no declara nada ni determina ninguna obligación (Regla de oro 5, punto 4).
 */
export const AVISO_CIERRE_ORIENTATIVO =
  'Herramienta docente de carácter ORIENTATIVO. El checklist del Anexo D ordena el trabajo de ' +
  'cierre y cifra lo que el Libro ya sabe; no es asesoramiento fiscal, no presenta ningún ' +
  'modelo y no determina obligación alguna. Las casillas automáticas dicen lo que consta en ' +
  'ESTE Libro: si el Libro está incompleto, la casilla también lo está. — [MT] Unidad 10 y Anexo D.'

// ────────────────────────────────────────────────────────────────────────────
// 2. Momentos y casillas del checklist
// ────────────────────────────────────────────────────────────────────────────

/** Momento del calendario de cierre (columna «Momento» del Anexo D). */
export type MomentoCierre =
  | 'cada-mes'
  | 'octubre'
  | '31-diciembre'
  | 'enero-31-marzo'
  | 'marzo'
  | 'abril-30-junio'
  | 'al-presentar'
  | 'al-cerrar'

/** Etiqueta literal del momento, tal y como la escribe el Anexo D. */
export const ETIQUETA_MOMENTO: Readonly<Record<MomentoCierre, string>> = Object.freeze({
  'cada-mes': 'Cada mes',
  octubre: 'Octubre',
  '31-diciembre': '31 de diciembre',
  'enero-31-marzo': 'Enero – 31 de marzo',
  marzo: 'Marzo',
  'abril-30-junio': 'Abril – 30 de junio',
  'al-presentar': 'Al presentar',
  'al-cerrar': 'Al cerrar',
})

/** Momentos en el ORDEN del Anexo D (que es el orden del calendario, no el alfabético). */
export const ORDEN_MOMENTOS: readonly MomentoCierre[] = [
  'cada-mes',
  'octubre',
  '31-diciembre',
  'enero-31-marzo',
  'marzo',
  'abril-30-junio',
  'al-presentar',
  'al-cerrar',
]

/** Identificador estable de casilla. Es la clave con la que se guarda la marca del alumno. */
export type IdCasillaCierre =
  | 'cuadre-mensual'
  | 'justificantes-al-dia'
  | 'estimacion-721-octubre'
  | 'exportar-historicos'
  | 'cuadrar-ubicaciones'
  | 'congelar-diario'
  | 'foto-saldos'
  | 'conciliacion-fifo-saldos'
  | 'modelo-721'
  | 'datos-fiscales-aeat'
  | 'conciliacion-tres-columnas'
  | 'traslado-renta-web'
  | 'justificante-presentacion'
  | 'memoria-ejercicio'
  | 'integridad-copia'

/**
 * Quién puede responder la casilla.
 *  · `automatica` — el motor la evalúa con lo que ya hay en el Libro.
 *  · `manual`     — describe un acto del mundo (descargar, presentar, copiar fuera del
 *                   equipo) que solo el alumno puede afirmar.
 */
export type OrigenCasilla = 'automatica' | 'manual'

/** Estado de una casilla. `no-aplica` solo cierra el ejercicio si trae razón escrita. */
export type EstadoCasilla = 'cumplida' | 'pendiente' | 'no-aplica'

/** Definición de una casilla del Anexo D. Los textos son literales del manual. */
export interface DefinicionCasilla {
  readonly id: IdCasillaCierre
  readonly momento: MomentoCierre
  /** Columna «Qué se comprueba» del Anexo D, LITERAL. */
  readonly queSeComprueba: string
  /** Columna «Dónde se explica» del Anexo D, LITERAL. */
  readonly dondeSeExplica: string
  readonly origen: OrigenCasilla
  /** Qué mira el motor para resolverla sola (solo en las automáticas). */
  readonly comoSeAutomatiza?: string
}

/**
 * CHECKLIST_CIERRE — las quince casillas del Anexo D, en su orden, con su momento, su texto
 * literal y su remisión a la unidad del manual.
 *
 * Ocho son automáticas y siete manuales. El reparto no es arbitrario: automática es toda
 * casilla cuya respuesta ya está en el Libro (¿concilia la cola?, ¿cuadran las ubicaciones?,
 * ¿falta algún justificante?, ¿supera el umbral del 721?, ¿está escrita la memoria?) y manual
 * toda la que exige un acto fuera de la app (exportar de un exchange, congelar y copiar,
 * bajar los datos fiscales de la Sede, presentar la declaración).
 */
export const CHECKLIST_CIERRE: readonly DefinicionCasilla[] = Object.freeze([
  {
    id: 'cuadre-mensual',
    momento: 'cada-mes',
    queSeComprueba:
      'Cuadre por ubicación y activo contra el saldo real, anotando fecha, hora y fuente del saldo real. Resolver lo que aparezca mientras la memoria está fresca',
    dondeSeExplica: 'U5.4',
    origen: 'manual',
  },
  {
    id: 'justificantes-al-dia',
    momento: 'cada-mes',
    queSeComprueba:
      'Que ningún apunte ha quedado sin justificante en la carpeta del ejercicio (principio 6)',
    dondeSeExplica: 'U3.1.3, U4.2',
    origen: 'automatica',
    comoSeAutomatiza:
      'Estado probatorio de cada apunte del ejercicio frente a su checklist (engine/archivo.ts): cuántos están completos, cuántos incompletos y cuántos sin un solo justificante.',
  },
  {
    id: 'estimacion-721-octubre',
    momento: 'octubre',
    queSeComprueba:
      'Estimación anticipada del modelo 721 sobre el perímetro de custodia en el extranjero: es el corte de gestión, sin valor normativo, y existe para que todavía haya margen de decisión',
    dondeSeExplica: 'U10.1',
    origen: 'automatica',
    comoSeAutomatiza:
      'Corte de gestión a 20 de octubre del aviso de doble fecha (ui/fiscal/aviso721.ts), sobre ubicaciones extranjeras que no sean de autocustodia y sin computar el fiat.',
  },
  {
    id: 'exportar-historicos',
    momento: '31-diciembre',
    queSeComprueba:
      'Exportar el histórico completo de cada exchange del ejercicio a 05-certificados/ y las etiquetas BIP-329 de cada wallet a 06-etiquetas/',
    dondeSeExplica: 'U10.3',
    origen: 'manual',
  },
  {
    id: 'cuadrar-ubicaciones',
    momento: '31-diciembre',
    queSeComprueba: 'Cuadrar todas las ubicaciones y resolver los descuadres antes de congelar',
    dondeSeExplica: 'U5.4, U7.1',
    origen: 'automatica',
    comoSeAutomatiza:
      'CUADRE a 31 de diciembre (engine/cuadre.ts) de los saldos calculados contra los saldos reales declarados por el alumno, celda a celda y con las tolerancias del Libro.',
  },
  {
    id: 'congelar-diario',
    momento: '31-diciembre',
    queSeComprueba: 'Congelar el DIARIO del ejercicio y guardar copia',
    dondeSeExplica: 'U10.3',
    origen: 'manual',
  },
  {
    id: 'foto-saldos',
    momento: '31-diciembre',
    queSeComprueba:
      'Fijar la foto de saldos por ubicación y activo, con la cotización empleada y su fuente. Es el dato que alimenta el 721 y el que abrirá el ejercicio siguiente con saldos comprobados en lugar de heredados',
    dondeSeExplica: 'U10.3',
    origen: 'automatica',
    comoSeAutomatiza:
      'Saldos por ubicación y activo a 31 de diciembre (engine/saldos.ts) cruzados con las cotizaciones de cierre que el alumno teclea, cada una con su fuente citada.',
  },
  {
    id: 'conciliacion-fifo-saldos',
    momento: '31-diciembre',
    queSeComprueba:
      'Comprobar que la cola FIFO y el saldo dicen lo mismo activo por activo: si difieren, falta aplicar el prorrateo de comisiones',
    dondeSeExplica: 'U7.5',
    origen: 'automatica',
    comoSeAutomatiza:
      'Conciliación activo por activo de las existencias vivas de la cola FIFO contra la suma de saldos (engine/conciliacion.ts), con su semáforo y el motivo de cada descuadre.',
  },
  {
    id: 'modelo-721',
    momento: 'enero-31-marzo',
    queSeComprueba:
      'Modelo 721, si el saldo conjunto en criptoactivos custodiados por proveedores no residentes supera 50.000 € a 31-12. Restar el fiat, que pertenece al bloque de cuentas del 720. Si no procede, dejar escrita la razón y el cálculo',
    dondeSeExplica: 'U10.1',
    origen: 'automatica',
    comoSeAutomatiza:
      'Corte normativo a 31 de diciembre del aviso de doble fecha (ui/fiscal/aviso721.ts). Cuando no procede, el motor escribe la razón Y el cálculo, que es lo que el Anexo D exige dejar por escrito.',
  },
  {
    id: 'datos-fiscales-aeat',
    momento: 'marzo',
    queSeComprueba:
      'Descargar los datos fiscales y leer los avisos cripto: qué han contado de ti los modelos 172/173',
    dondeSeExplica: 'U9.4, U10.2',
    origen: 'manual',
  },
  {
    id: 'conciliacion-tres-columnas',
    momento: 'marzo',
    queSeComprueba:
      'Conciliación a tres columnas —qué dicen los datos fiscales, qué dice el registro, explicación de cada diferencia— y archivarla',
    dondeSeExplica: 'U10.2',
    origen: 'automatica',
    comoSeAutomatiza:
      'Tabla de conciliación a tres columnas de esta misma pantalla: hay al menos una fila y toda diferencia entre los datos fiscales y el registro tiene explicación escrita.',
  },
  {
    id: 'traslado-renta-web',
    momento: 'abril-30-junio',
    queSeComprueba:
      'Traslado a Renta WEB en el orden de la Unidad 9: rendimientos, ganancias del ahorro, base general, y revisión cruzada final',
    dondeSeExplica: 'U9.4',
    origen: 'manual',
  },
  {
    id: 'justificante-presentacion',
    momento: 'al-presentar',
    queSeComprueba: 'El justificante de presentación entra en la carpeta del ejercicio',
    dondeSeExplica: 'U9.4',
    origen: 'manual',
  },
  {
    id: 'memoria-ejercicio',
    momento: 'al-cerrar',
    queSeComprueba:
      'Escribir la memoria del ejercicio: criterios adoptados en las zonas grises, reconstrucciones realizadas, diferencias de conciliación y decisiones sobre obligaciones informativas, incluidas las negativas',
    dondeSeExplica: 'U10.3',
    origen: 'automatica',
    comoSeAutomatiza:
      'Los cuatro apartados que el propio Anexo D enumera están escritos. Un apartado sin nada que contar se cierra diciéndolo («este año no hubo reconstrucciones»): eso también es memoria.',
  },
  {
    id: 'integridad-copia',
    momento: 'al-cerrar',
    queSeComprueba:
      'Comprobar la integridad de lo archivado y guardar una copia fuera del equipo de trabajo',
    dondeSeExplica: 'U10.3',
    origen: 'manual',
  },
] as const)

/** Definición de una casilla por su identificador (o `undefined` si no existe). */
export function definicionCasilla(id: IdCasillaCierre): DefinicionCasilla | undefined {
  return CHECKLIST_CIERRE.find((c) => c.id === id)
}

// ────────────────────────────────────────────────────────────────────────────
// 3. La memoria del ejercicio
// ────────────────────────────────────────────────────────────────────────────

/**
 * Apartados de la memoria del ejercicio. Son los CUATRO que enumera el Anexo D, ni uno más:
 * «criterios adoptados en las zonas grises, reconstrucciones realizadas, diferencias de
 * conciliación y decisiones sobre obligaciones informativas, incluidas las negativas».
 */
export type ApartadoMemoria =
  | 'criterios-zonas-grises'
  | 'reconstrucciones'
  | 'diferencias-conciliacion'
  | 'obligaciones-informativas'

/** Un apartado de la memoria, con el título y la pista que lo sitúan. */
export interface DefinicionApartadoMemoria {
  readonly clave: ApartadoMemoria
  readonly titulo: string
  /** Pista metodológica de qué se escribe aquí (redactada, no es calificación fiscal). */
  readonly pista: string
}

/** Los cuatro apartados, en el orden en que los enumera el Anexo D. */
export const APARTADOS_MEMORIA: readonly DefinicionApartadoMemoria[] = Object.freeze([
  {
    clave: 'criterios-zonas-grises',
    titulo: 'Criterios adoptados en las zonas grises',
    pista:
      'Qué tesis se ha aplicado donde no hay criterio administrativo publicado, y por qué se eligió esa y no la contraria.',
  },
  {
    clave: 'reconstrucciones',
    titulo: 'Reconstrucciones realizadas',
    pista:
      'Qué operaciones hubo que reconstruir, con qué fuentes y con qué grado de certeza queda cada una.',
  },
  {
    clave: 'diferencias-conciliacion',
    titulo: 'Diferencias de conciliación',
    pista:
      'Las diferencias entre los datos fiscales y el registro, y la explicación de cada una (la tabla a tres columnas de esta misma pantalla).',
  },
  {
    clave: 'obligaciones-informativas',
    titulo: 'Decisiones sobre obligaciones informativas, incluidas las negativas',
    pista:
      'Por qué se presentó —o por qué NO se presentó— cada modelo informativo. La decisión negativa razonada es tan memoria como la positiva.',
  },
] as const)

/** La memoria del ejercicio: texto libre del alumno, un campo por apartado. */
export type MemoriaEjercicio = Partial<Record<ApartadoMemoria, string>>

/** Evaluación de la memoria (qué está escrito y qué falta). */
export interface ResultadoMemoria {
  /** Apartados con texto. */
  escritos: ApartadoMemoria[]
  /** Apartados todavía en blanco. */
  vacios: ApartadoMemoria[]
  /** ¿Están escritos los cuatro? */
  completa: boolean
  /** Nº aproximado de palabras de toda la memoria (para el «es una página» del manual). */
  palabras: number
}

/** ¿Hay algo escrito en este campo? (blanco o solo espacios = no escrito). */
function escrito(texto: string | undefined | null): boolean {
  return typeof texto === 'string' && texto.trim() !== ''
}

/**
 * Evalúa la memoria del ejercicio. Exige los CUATRO apartados porque son los cuatro que el
 * Anexo D enumera: un apartado sin nada que contar se cierra escribiéndolo («este año no hubo
 * reconstrucciones»), que es información y no un hueco.
 */
export function evaluarMemoria(memoria: MemoriaEjercicio): ResultadoMemoria {
  const escritos: ApartadoMemoria[] = []
  const vacios: ApartadoMemoria[] = []
  let palabras = 0
  for (const a of APARTADOS_MEMORIA) {
    const texto = memoria[a.clave]
    if (escrito(texto)) {
      escritos.push(a.clave)
      palabras += (texto as string).trim().split(/\s+/).length
    } else {
      vacios.push(a.clave)
    }
  }
  return { escritos, vacios, completa: vacios.length === 0, palabras }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. La conciliación a tres columnas (U10.2)
// ────────────────────────────────────────────────────────────────────────────

/**
 * De qué modelo informativo procede la fila propuesta. El 172 declara SALDOS y el 173
 * OPERACIONES: separarlos es lo que permite entender de dónde sale cada cifra de los datos
 * fiscales, en vez de comparar un total contra otro total y no saber qué mirar.
 */
export type OrigenFilaTresColumnas = '172' | '173' | 'libre'

/** Una fila de la conciliación a tres columnas. */
export interface FilaTresColumnas {
  /** Identificador estable de la fila (lo genera la capa que la crea). */
  id: string
  /** Qué se concilia («Saldo a 31/12 · Kraken · BTC», «Operaciones del ejercicio · Kraken»). */
  concepto: string
  /** Columna 1 — qué dicen los datos fiscales. En EUR, cadena decimal interna. La teclea el alumno. */
  segunDatosFiscalesEUR: string
  /** Columna 2 — qué dice el registro. En EUR. La propone el motor; el alumno puede corregirla. */
  segunRegistroEUR: string
  /** Columna 3 — explicación de la diferencia. Texto libre del alumno. */
  explicacion: string
  /** Modelo del que procede la fila, cuando la propuso el motor. */
  origen?: OrigenFilaTresColumnas
  /**
   * true si el motor no pudo poner cifra en la columna del registro por faltar cotización.
   * La fila se conserva igualmente: un hueco visible vale más que una fila que no existe.
   */
  sinValorar?: boolean
}

/** Una fila ya evaluada: con su diferencia y si está o no explicada. */
export interface FilaTresColumnasEvaluada extends FilaTresColumnas {
  /** datos fiscales − registro. Positivo: la AEAT dice más de lo que dice el Libro. */
  diferenciaEUR: string
  hayDiferencia: boolean
  /** Hay diferencia y NO está explicada por escrito. */
  sinExplicar: boolean
}

/** Resultado de la conciliación a tres columnas. */
export interface ResultadoTresColumnas {
  filas: FilaTresColumnasEvaluada[]
  totalDatosFiscalesEUR: string
  totalRegistroEUR: string
  diferenciaTotalEUR: string
  filasConDiferencia: number
  filasSinExplicar: number
  /** Hay al menos una fila y toda diferencia tiene explicación escrita. */
  completa: boolean
}

/**
 * Evalúa la conciliación a tres columnas: calcula cada diferencia y marca las que se han
 * quedado sin explicar.
 *
 * `toleranciaEUR` existe para el céntimo de redondeo, y por defecto es CERO a propósito: el
 * Anexo D pide «explicación de cada diferencia», no de las grandes. Quien quiera perdonar el
 * céntimo tiene que decidirlo explícitamente.
 */
export function evaluarTresColumnas(
  filas: readonly FilaTresColumnas[],
  toleranciaEUR = '0',
): ResultadoTresColumnas {
  const tol = D(toleranciaEUR).abs()
  let totalFiscal = CERO
  let totalRegistro = CERO
  let conDiferencia = 0
  let sinExplicar = 0

  const evaluadas: FilaTresColumnasEvaluada[] = filas.map((f) => {
    const fiscal = D(f.segunDatosFiscalesEUR === '' ? '0' : f.segunDatosFiscalesEUR)
    const registro = D(f.segunRegistroEUR === '' ? '0' : f.segunRegistroEUR)
    totalFiscal = totalFiscal.plus(fiscal)
    totalRegistro = totalRegistro.plus(registro)

    const dif = fiscal.minus(registro)
    const hayDiferencia = dif.abs().greaterThan(tol)
    const noExplicada = hayDiferencia && !escrito(f.explicacion)
    if (hayDiferencia) conDiferencia++
    if (noExplicada) sinExplicar++

    return {
      ...f,
      diferenciaEUR: aCadena(dif),
      hayDiferencia,
      sinExplicar: noExplicada,
    }
  })

  return {
    filas: evaluadas,
    totalDatosFiscalesEUR: aCadena(totalFiscal),
    totalRegistroEUR: aCadena(totalRegistro),
    diferenciaTotalEUR: aCadena(totalFiscal.minus(totalRegistro)),
    filasConDiferencia: conDiferencia,
    filasSinExplicar: sinExplicar,
    completa: evaluadas.length > 0 && sinExplicar === 0,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Cotizaciones de cierre y foto de saldos
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cotización empleada para un activo al cierre, con su FUENTE. La fuente no es decorativa:
 * el manual exige anotarla siempre que se cruza una frontera de valoración, y sin ella la
 * foto de cierre no es una foto sino una estimación sin autor.
 */
export interface CotizacionCierre {
  /** EUR por unidad, cadena decimal interna (punto). */
  precioEUR: string
  /** De dónde sale el precio (exchange, agregador, fecha y hora de la toma…). */
  fuente: string
}

/** Cotizaciones de cierre por activo. EUR no la necesita: es la moneda de cuenta. */
export type CotizacionesCierre = Readonly<Record<SimboloActivo, CotizacionCierre>>

/** Una fila de la foto de cierre: ubicación × activo a 31 de diciembre. */
export interface FilaFotoCierre {
  ubicacion: RefUbicacion
  /** Nombre legible de la ubicación (o su referencia, si no está en el catálogo). */
  nombreUbicacion: string
  activo: SimboloActivo
  saldo: string
  /** Cotización empleada; `null` si el alumno aún no la ha fijado. */
  precioEUR: string | null
  /** Fuente citada de la cotización; `null` si falta. */
  fuente: string | null
  /** saldo × precio; `null` si no hay cotización. */
  valorEUR: string | null
  /** true si es fiat: vale su propio importe y no precisa cotización. */
  esFiat: boolean
}

/** Total de un activo en toda la cartera a 31 de diciembre. */
export interface TotalActivoFoto {
  activo: SimboloActivo
  cantidad: string
  valorEUR: string | null
}

/** La foto de cierre: saldos a 31-12 con la cotización empleada y su fuente. */
export interface FotoCierre {
  /** Corte de la foto (31 de diciembre del ejercicio, inclusive). */
  corte: FechaHoraISO
  filas: FilaFotoCierre[]
  totalesPorActivo: TotalActivoFoto[]
  /** Suma de lo que sí se ha podido valorar. Es un MÍNIMO si falta alguna cotización. */
  totalValoradoEUR: string
  /** Activos con saldo y sin cotización fijada. */
  activosSinCotizacion: SimboloActivo[]
  /** Activos con cotización pero sin fuente citada (el manual la exige). */
  activosSinFuente: SimboloActivo[]
  /** Todo saldo distinto de cero tiene cotización Y fuente. */
  completa: boolean
}

/** Símbolos fiat según el catálogo (misma mecánica que conciliacion.ts y aviso721.ts). */
function simbolosFiat(activos?: readonly Activo[]): Set<SimboloActivo> {
  const fiat = new Set<SimboloActivo>()
  for (const a of [...ACTIVOS_BASE, ...(activos ?? [])]) {
    if (a.esFiat) fiat.add(a.simbolo)
    else fiat.delete(a.simbolo)
  }
  return fiat
}

/** Corte normativo del cierre: 31 de diciembre del ejercicio, inclusive. */
export function corteCierre(ejercicio: number): FechaHoraISO {
  return `${ejercicio}-12-31T23:59:59`
}

/**
 * Compone la foto de cierre: saldos por ubicación y activo a 31-12, con la cotización
 * empleada y su fuente. Las celdas a cero no entran (una foto de saldos es de lo que hay).
 */
export function componerFotoCierre(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  ejercicio: number,
  cotizaciones: CotizacionesCierre = {},
  activos?: readonly Activo[],
): FotoCierre {
  const corte = corteCierre(ejercicio)
  const fiat = simbolosFiat(activos)
  const nombrePorId = new Map(ubicaciones.map((u) => [u.id, u.nombre]))
  const saldos = calcularSaldos([...apuntes], corte).filter((s) => !D(s.saldo).isZero())

  const filas: FilaFotoCierre[] = []
  const cantidadPorActivo = new Map<SimboloActivo, ReturnType<typeof D>>()
  const valorPorActivo = new Map<SimboloActivo, ReturnType<typeof D> | null>()
  const sinCotizacion = new Set<SimboloActivo>()
  const sinFuente = new Set<SimboloActivo>()
  let totalValorado = CERO

  for (const s of ordenarSaldos(saldos, nombrePorId)) {
    const esFiat = fiat.has(s.activo)
    const cot = cotizaciones[s.activo]
    // El fiat es la moneda de cuenta: vale su propio importe y no necesita cotización ni
    // fuente. Exigírsela sería pedir la fuente del euro.
    // Una cotización en blanco es una cotización que no está: si se dejara pasar como cadena
    // vacía valdría cero, y un activo valorado en cero es peor que un activo sin valorar.
    const bruto = esFiat ? '1' : (cot?.precioEUR ?? null)
    const precioEUR = bruto === null || bruto.trim() === '' ? null : bruto
    const fuente = esFiat ? 'Moneda de cuenta (no precisa cotización)' : (cot?.fuente ?? null)
    const valorEUR = precioEUR === null ? null : aCadena(D(s.saldo).times(D(precioEUR)))

    if (!esFiat) {
      if (precioEUR === null) sinCotizacion.add(s.activo)
      else if (!escrito(fuente)) sinFuente.add(s.activo)
    }

    filas.push({
      ubicacion: s.ubicacion,
      nombreUbicacion: nombrePorId.get(s.ubicacion) ?? String(s.ubicacion),
      activo: s.activo,
      saldo: s.saldo,
      precioEUR,
      fuente,
      valorEUR,
      esFiat,
    })

    cantidadPorActivo.set(s.activo, (cantidadPorActivo.get(s.activo) ?? CERO).plus(D(s.saldo)))
    if (valorEUR === null) {
      valorPorActivo.set(s.activo, null)
    } else {
      const previo = valorPorActivo.get(s.activo)
      // Un `null` previo manda: si una celda del activo no se pudo valorar, el total del
      // activo tampoco es un total, y decir lo contrario sería inventar la parte que falta.
      if (previo !== null) valorPorActivo.set(s.activo, (previo ?? CERO).plus(D(valorEUR)))
      totalValorado = totalValorado.plus(D(valorEUR))
    }
  }

  const totalesPorActivo: TotalActivoFoto[] = [...cantidadPorActivo.keys()]
    .sort()
    .map((activo) => {
      const v = valorPorActivo.get(activo)
      return {
        activo,
        cantidad: aCadena(cantidadPorActivo.get(activo) ?? CERO),
        valorEUR: v === null || v === undefined ? null : aCadena(v),
      }
    })

  return {
    corte,
    filas,
    totalesPorActivo,
    totalValoradoEUR: aCadena(totalValorado),
    activosSinCotizacion: [...sinCotizacion].sort(),
    activosSinFuente: [...sinFuente].sort(),
    completa: sinCotizacion.size === 0 && sinFuente.size === 0,
  }
}

/** Ordena las celdas de la foto por nombre de ubicación y activo (lectura, no cálculo). */
function ordenarSaldos(
  saldos: SaldoCelda[],
  nombrePorId: ReadonlyMap<string, string>,
): SaldoCelda[] {
  return [...saldos].sort((a, b) => {
    const na = nombrePorId.get(a.ubicacion) ?? String(a.ubicacion)
    const nb = nombrePorId.get(b.ubicacion) ?? String(b.ubicacion)
    return na.localeCompare(nb) || a.activo.localeCompare(b.activo)
  })
}

// ────────────────────────────────────────────────────────────────────────────
// 6. El CUADRE de cierre (31 de diciembre)
// ────────────────────────────────────────────────────────────────────────────

/** Una celda con saldo a 31-12 para la que el alumno no ha declarado saldo real. */
export interface CeldaSinDeclarar {
  ubicacion: RefUbicacion
  nombreUbicacion: string
  activo: SimboloActivo
  saldoCalculado: string
}

/** Resultado del cuadre a 31 de diciembre, con lo que falta por declarar. */
export interface ResultadoCuadreCierre {
  corte: FechaHoraISO
  filas: FilaCuadre[]
  /**
   * Celdas con saldo distinto de cero y SIN saldo real declarado. El cuadre del motor solo
   * genera fila para lo declarado (como la hoja CUADRE del Excel, que deja la diferencia en
   * blanco sin dato); pero «cuadrar todas las ubicaciones» exige mirar también lo que nadie
   * ha declarado todavía, que es donde de verdad se esconde el descuadre.
   */
  celdasSinDeclarar: CeldaSinDeclarar[]
  estadoGlobal: EstadoSemaforo
  celdasDescuadradas: number
  /** Todas las celdas con saldo están declaradas y todas cuadran. */
  completo: boolean
}

/** Orden de gravedad del semáforo, para quedarse con el peor. */
const GRAVEDAD: Readonly<Record<EstadoSemaforo, number>> = { OK: 0, REVISAR: 1, ERROR: 2 }

/** Cuadre a 31 de diciembre del ejercicio contra los saldos reales declarados. */
export function cuadreDeCierre(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  saldosReales: readonly SaldoRealDeclarado[],
  ejercicio: number,
  tolerancias: Tolerancias = TOLERANCIAS_POR_DEFECTO,
): ResultadoCuadreCierre {
  const corte = corteCierre(ejercicio)
  const nombrePorId = new Map(ubicaciones.map((u) => [u.id, u.nombre]))
  const calculados = calcularSaldos([...apuntes], corte)
  const filas = calcularCuadre(calculados, [...saldosReales], tolerancias)

  const declaradas = new Set(saldosReales.map((s) => `${s.ubicacion} ${s.activo}`))
  const celdasSinDeclarar: CeldaSinDeclarar[] = calculados
    .filter((c) => !D(c.saldo).isZero() && !declaradas.has(`${c.ubicacion} ${c.activo}`))
    .map((c) => ({
      ubicacion: c.ubicacion,
      nombreUbicacion: nombrePorId.get(c.ubicacion) ?? String(c.ubicacion),
      activo: c.activo,
      saldoCalculado: c.saldo,
    }))

  let estadoGlobal: EstadoSemaforo = 'OK'
  for (const f of filas) if (GRAVEDAD[f.estado] > GRAVEDAD[estadoGlobal]) estadoGlobal = f.estado

  const celdasDescuadradas = filas.filter((f) => f.estado !== 'OK').length
  return {
    corte,
    filas,
    celdasSinDeclarar,
    estadoGlobal,
    celdasDescuadradas,
    completo: celdasSinDeclarar.length === 0 && celdasDescuadradas === 0 && filas.length > 0,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 7. El aviso 721, inyectado (ver cabecera del módulo)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Celda del aviso 721 que este motor necesita leer. Es un SUBCONJUNTO estructural de
 * `SaldoExtranjeroCelda` (engine/fiscal.ts), no una copia con vida propia.
 */
export interface CeldaAviso721 {
  ubicacion: RefUbicacion
  nombre: string
  activo: SimboloActivo
  saldo: string
  valorEUR: string | null
  sinValorar: boolean
}

/** Un corte del aviso 721 (estimación de octubre o normativo de diciembre). */
export interface CorteAviso721 {
  aplica: boolean
  supera: boolean
  umbralEUR: number
  totalValoradoEUR: string
  celdas: readonly CeldaAviso721[]
  haySinValorar: boolean
  /** Fiat excluido del cómputo del 721 (V2185-23): informativo, nunca «perdido». */
  totalFiatExcluidoEUR: string
  celdasFiatExcluidas: readonly CeldaAviso721[]
}

/**
 * Forma del aviso 721 de doble corte que el cierre consume. La cumple exactamente
 * `Aviso721DobleFecha` de `src/ui/fiscal/aviso721.ts`, que es quien lo calcula; el motor
 * declara aquí lo que necesita para no invertir la dependencia con la capa de interfaz.
 */
export interface EntradaAviso721 {
  aplica: boolean
  umbralEUR: number
  /** Corte de gestión a 20 de octubre. */
  estimacion: CorteAviso721
  /** Corte normativo a 31 de diciembre. */
  normativo: CorteAviso721
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Estado del alumno y evaluación de las casillas
// ────────────────────────────────────────────────────────────────────────────

/** Lo que el alumno marca y escribe en una casilla. */
export interface MarcaCasilla {
  /** La ha dado por hecha. */
  marcada?: boolean
  /** La ha descartado por no aplicable. */
  noAplica?: boolean
  /** Razón escrita del «no aplica». Sin ella, el ejercicio NO cierra (Anexo D). */
  razonNoAplica?: string
  /** Nota libre del alumno sobre esta casilla. */
  nota?: string
  /** Cuándo la marcó (ISO local), para el informe de cierre. */
  marcadaEn?: FechaHoraISO
}

/** Marcas del alumno, por casilla. */
export type MarcasCierre = Partial<Record<IdCasillaCierre, MarcaCasilla>>

/** Unidad de la cifra que justifica una casilla automática (la formatea la interfaz). */
export type UnidadCifra = 'EUR' | 'porcentaje' | 'recuento'

/** Cifra que respalda la evaluación de una casilla automática. */
export interface CifraCasilla {
  /** Valor como cadena decimal interna (punto). Nunca formateado: eso es de la interfaz. */
  valor: string
  unidad: UnidadCifra
}

/** Una casilla del checklist ya evaluada, con su estado y con el porqué. */
export interface CasillaEvaluada extends DefinicionCasilla {
  estado: EstadoCasilla
  /** Quién la ha dejado en ese estado. */
  resueltaPor: 'motor' | 'alumno' | 'nadie'
  /** Qué ha mirado el motor y qué ha encontrado (o el recordatorio de lo que falta). */
  detalle: string
  cifra?: CifraCasilla
  /** Identificadores implicados (apuntes, activos, ubicaciones) para el drill-down. */
  implicados?: string[]
  /** Razón escrita del «no aplica»: la del alumno o, en las automáticas, la del motor. */
  razon?: string
  nota?: string
  marcadaEn?: FechaHoraISO
  /** Impide el cierre del ejercicio. */
  bloquea: boolean
  motivoBloqueo?: 'pendiente' | 'no-aplica-sin-razon'
  /**
   * El alumno ha dado por cumplida una casilla que el motor ve pendiente. No es un error
   * —el alumno sabe cosas que el Libro no—, pero la pantalla debe decirlo: marcar a mano
   * sobre un descuadre de conciliación o de cuadre es taparlo.
   */
  discrepanciaConMotor?: boolean
}

/** Un grupo de casillas del checklist bajo su momento del calendario. */
export interface GrupoMomento {
  momento: MomentoCierre
  etiqueta: string
  casillas: CasillaEvaluada[]
}

/** Resumen del expediente probatorio del ejercicio para el cierre. */
export interface ResumenArchivoCierre extends InformeCompletitud {
  /** Apuntes del ejercicio sin expediente completo (ids), para el drill-down. */
  apuntesConHueco: IdApunte[]
}

/** Entradas del cálculo de cierre: todo lo que el Libro sabe, más lo que el alumno escribe. */
export interface EntradasCierre {
  ejercicio: number
  /** Diario COMPLETO (no solo el del ejercicio): la cola FIFO arrastra lotes de años previos. */
  apuntes: readonly Apunte[]
  ubicaciones: readonly Ubicacion[]
  justificantes: readonly Justificante[]
  /** Saldos reales declarados por el alumno (los del CUADRE). */
  saldosReales?: readonly SaldoRealDeclarado[]
  /** Catálogo de activos del alumno (para saber cuáles son fiat). */
  activos?: readonly Activo[]
  tolerancias?: Tolerancias
  /** Cotizaciones de cierre por activo, con su fuente. */
  cotizaciones?: CotizacionesCierre
  /** Aviso 721 de doble corte ya calculado (ver `EntradaAviso721`). */
  aviso721?: EntradaAviso721
  /** Filas de la conciliación a tres columnas tal y como están en pantalla. */
  tresColumnas?: readonly FilaTresColumnas[]
  /** Tolerancia en euros de la conciliación a tres columnas (por defecto, cero). */
  toleranciaTresColumnasEUR?: string
  memoria?: MemoriaEjercicio
  marcas?: MarcasCierre
}

/** El cierre del ejercicio: el checklist evaluado y todo lo que lo respalda. */
export interface EstadoCierre {
  ejercicio: number
  /** Las quince casillas evaluadas, en el orden del Anexo D. */
  casillas: CasillaEvaluada[]
  /** Las mismas casillas agrupadas por momento del calendario. */
  porMomento: GrupoMomento[]
  cumplidas: number
  pendientes: number
  noAplicables: number
  /** «No aplica» sin razón escrita: el caso que el Anexo D señala expresamente. */
  noAplicaSinRazon: number
  /** ¿Ejercicio CERRADO? Todas marcadas, o no aplicables CON su razón escrita. */
  cerrado: boolean
  /** Casillas que impiden el cierre, en el orden del checklist. */
  bloqueos: CasillaEvaluada[]
  /** 0..100 con un decimal: casillas resueltas sobre el total. */
  porcentaje: number
  // ── Lo que respalda a las casillas automáticas (para pintarlo y para el informe) ──
  foto: FotoCierre
  cuadre: ResultadoCuadreCierre
  conciliacionFifo: ResultadoConciliacion
  archivo: ResumenArchivoCierre
  tresColumnas: ResultadoTresColumnas
  memoria: ResultadoMemoria
}

/** Evaluación interna de una casilla automática, antes de cruzarla con la marca del alumno. */
interface EvaluacionAutomatica {
  estado: EstadoCasilla
  detalle: string
  cifra?: CifraCasilla
  implicados?: string[]
  /** Razón del «no aplica» escrita por el motor (que es también «el cálculo» del Anexo D). */
  razon?: string
}

/** Ejercicio (año) de una marca temporal ISO. */
function ejercicioDe(fechaHora: FechaHoraISO): number {
  return Number(fechaHora.slice(0, 4))
}

/** Enumera una lista de identificadores en texto, recortando la cola («A, B y 3 más»). */
function enumerar(xs: readonly string[], maximo = 8): string {
  if (xs.length === 0) return ''
  const visibles = xs.slice(0, maximo)
  const cola = xs.length > maximo ? ` y ${xs.length - maximo} más` : ''
  return visibles.join(', ') + cola
}

/** Fecha dd/mm/aaaa de un corte ISO, para los textos del motor (Regla de oro 6). */
function fechaCorta(iso: FechaHoraISO): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// ────────────────────────────────────────────────────────────────────────────
// 9. Las ocho casillas que el motor responde solo
// ────────────────────────────────────────────────────────────────────────────

/**
 * «Que ningún apunte ha quedado sin justificante en la carpeta del ejercicio.»
 *
 * Se mira el estado probatorio de cada apunte del ejercicio frente a SU checklist, no la mera
 * existencia de un fichero: un apunte con un justificante de los tres que exige su tipo está
 * documentado a medias, y a medias no es principio 6.
 */
function evaluarJustificantes(archivo: ResumenArchivoCierre, ejercicio: number): EvaluacionAutomatica {
  if (archivo.total === 0) {
    return {
      estado: 'no-aplica',
      detalle: `El ejercicio ${ejercicio} no tiene ningún apunte en el Libro.`,
      razon: `No hay ningún apunte con fecha de ${ejercicio}: no hay expediente que completar.`,
    }
  }
  const cifra: CifraCasilla = { valor: String(archivo.porcentajeCompleto), unidad: 'porcentaje' }
  if (archivo.incompletos === 0 && archivo.sinJustificar === 0) {
    return {
      estado: 'cumplida',
      detalle: `Los ${archivo.total} apuntes del ejercicio tienen su expediente probatorio completo.`,
      cifra,
    }
  }
  const partes: string[] = []
  if (archivo.sinJustificar > 0) partes.push(`${archivo.sinJustificar} sin ningún justificante`)
  if (archivo.incompletos > 0) partes.push(`${archivo.incompletos} con el expediente incompleto`)
  return {
    estado: 'pendiente',
    detalle:
      `De los ${archivo.total} apuntes del ejercicio, ${partes.join(' y ')}. ` +
      `Apuntes afectados: ${enumerar(archivo.apuntesConHueco)}.`,
    cifra,
    implicados: archivo.apuntesConHueco,
  }
}

/**
 * «Estimación anticipada del modelo 721 sobre el perímetro de custodia en el extranjero.»
 *
 * Es el corte de GESTIÓN del 20 de octubre: no tiene valor normativo y su único fin es que
 * todavía quede margen de decisión. Por eso basta con que la estimación esté hecha y sea
 * completa; que supere o no el umbral no la deja pendiente, la informa.
 */
function evaluarEstimacion721(
  aviso: EntradaAviso721 | undefined,
  ejercicio: number,
): EvaluacionAutomatica {
  if (!aviso) {
    return {
      estado: 'pendiente',
      detalle: 'No se ha aportado el aviso 721 de doble corte: no se puede estimar el perímetro.',
    }
  }
  const c = aviso.estimacion
  const cifra: CifraCasilla = { valor: c.totalValoradoEUR, unidad: 'EUR' }
  const notaFiat = D(c.totalFiatExcluidoEUR).isZero()
    ? ''
    : ` Fiat excluido del cómputo: ${c.totalFiatExcluidoEUR} € (V2185-23: el saldo en moneda fiduciaria de una cuenta abierta en el extranjero pertenece al bloque de cuentas del modelo 720, no al 721).`

  if (!c.aplica) {
    return {
      estado: 'no-aplica',
      detalle: `A 20/10/${ejercicio} no consta ninguna moneda virtual custodiada por un proveedor no residente.`,
      razon:
        `A 20/10/${ejercicio} no hay ninguna moneda virtual en ubicaciones marcadas como extranjeras ` +
        `que no sean de autocustodia, así que no hay perímetro que estimar.${notaFiat}`,
      cifra,
    }
  }
  if (c.haySinValorar) {
    const sin = c.celdas.filter((x) => x.sinValorar).map((x) => x.activo)
    return {
      estado: 'pendiente',
      detalle:
        `La estimación está incompleta: faltan cotizaciones (${enumerar([...new Set(sin)])}), ` +
        `así que el total estimado (${c.totalValoradoEUR} €) es un mínimo.${notaFiat}`,
      cifra,
      implicados: [...new Set(sin)],
    }
  }
  return {
    estado: 'cumplida',
    detalle:
      `Estimación anticipada a 20/10/${ejercicio}: ${c.totalValoradoEUR} € en monedas virtuales ` +
      `custodiadas por terceros no residentes, frente al umbral informativo de ${c.umbralEUR} €. ` +
      (c.supera
        ? 'A esta fecha lo supera: todavía hay margen para decidir antes del 31 de diciembre.'
        : 'A esta fecha no lo supera.') +
      ' Corte de gestión, sin valor normativo.' +
      notaFiat,
    cifra,
  }
}

/**
 * «Modelo 721, si el saldo conjunto […] supera 50.000 € a 31-12. […] Si no procede, dejar
 * escrita la razón y el cálculo.»
 *
 * Cuando no procede, el motor escribe la razón Y el cálculo: eso es exactamente lo que el
 * Anexo D pide dejar por escrito, y es lo que convierte esta casilla en un «no aplica» que sí
 * cierra el ejercicio. Cuando el total es un mínimo porque falta alguna cotización, el motor
 * NO concluye: un «no procede» apoyado en un total incompleto es peor que no tenerlo.
 */
function evaluarModelo721(
  aviso: EntradaAviso721 | undefined,
  ejercicio: number,
): EvaluacionAutomatica {
  if (!aviso) {
    return {
      estado: 'pendiente',
      detalle: 'No se ha aportado el aviso 721 de doble corte: no se puede concluir si procede.',
    }
  }
  const c = aviso.normativo
  const cifra: CifraCasilla = { valor: c.totalValoradoEUR, unidad: 'EUR' }
  const calculoFiat = D(c.totalFiatExcluidoEUR).isZero()
    ? ' No hay saldo en fiat que restar.'
    : ` Fiat restado del cómputo: ${c.totalFiatExcluidoEUR} € (V2185-23: pertenece al bloque de cuentas del modelo 720).`

  if (!c.aplica) {
    return {
      estado: 'no-aplica',
      detalle: `A 31/12/${ejercicio} no consta ninguna moneda virtual custodiada por proveedores no residentes.`,
      razon:
        `Cálculo a 31/12/${ejercicio}: 0,00 € en monedas virtuales custodiadas por proveedores no ` +
        `residentes (las ubicaciones de autocustodia no computan: V2290-23, V0941-24 y las preguntas ` +
        `frecuentes del modelo 721 de la Sede de la AEAT).${calculoFiat} Umbral: ${c.umbralEUR} €. ` +
        'No procede presentar el modelo 721.',
      cifra,
    }
  }
  if (c.haySinValorar) {
    const sin = [...new Set(c.celdas.filter((x) => x.sinValorar).map((x) => x.activo))]
    return {
      estado: 'pendiente',
      detalle:
        `No se puede concluir: faltan cotizaciones a 31/12 (${enumerar(sin)}), así que el total ` +
        `valorado (${c.totalValoradoEUR} €) es un MÍNIMO y podría superar los ${c.umbralEUR} €. ` +
        'Fija las cotizaciones de la foto de cierre y vuelve a mirar.',
      cifra,
      implicados: sin,
    }
  }
  if (!c.supera) {
    return {
      estado: 'no-aplica',
      detalle: `El saldo conjunto a 31/12/${ejercicio} no supera el umbral informativo.`,
      razon:
        `Cálculo a 31/12/${ejercicio}: ${c.totalValoradoEUR} € en monedas virtuales custodiadas por ` +
        `proveedores no residentes (autocustodia excluida).${calculoFiat} Umbral: ${c.umbralEUR} €. ` +
        'No supera el umbral, luego no procede presentar el modelo 721.',
      cifra,
    }
  }
  return {
    estado: 'pendiente',
    detalle:
      `El saldo conjunto valorado a 31/12/${ejercicio} (${c.totalValoradoEUR} €) supera los ` +
      `${c.umbralEUR} €.${calculoFiat} Revisa si procede presentar el modelo 721 entre el 1 de enero ` +
      'y el 31 de marzo y marca la casilla cuando lo hayas presentado y archivado el justificante. ' +
      'Aviso informativo: la app no determina la obligación.',
    cifra,
  }
}

/** «Cuadrar todas las ubicaciones y resolver los descuadres antes de congelar.» */
function evaluarCuadre(cuadre: ResultadoCuadreCierre, ejercicio: number): EvaluacionAutomatica {
  const conSaldo = cuadre.filas.length + cuadre.celdasSinDeclarar.length
  if (conSaldo === 0) {
    return {
      estado: 'no-aplica',
      detalle: `No hay saldo a 31/12/${ejercicio} en ninguna ubicación.`,
      razon: `A 31/12/${ejercicio} no queda saldo en ninguna ubicación: no hay nada que cuadrar.`,
    }
  }
  if (cuadre.celdasSinDeclarar.length > 0) {
    const faltan = cuadre.celdasSinDeclarar.map((c) => `${c.nombreUbicacion}·${c.activo}`)
    return {
      estado: 'pendiente',
      detalle:
        `Faltan ${cuadre.celdasSinDeclarar.length} celda(s) por declarar en el CUADRE: ` +
        `${enumerar(faltan)}. Un saldo sin declarar no cuadra ni descuadra: no se ha comprobado.`,
      cifra: { valor: String(cuadre.celdasSinDeclarar.length), unidad: 'recuento' },
      implicados: faltan,
    }
  }
  if (cuadre.celdasDescuadradas > 0) {
    const malas = cuadre.filas
      .filter((f) => f.estado !== 'OK')
      .map((f) => `${f.ubicacion}·${f.activo} (${f.estado}, ${f.diferencia})`)
    return {
      estado: 'pendiente',
      detalle: `${cuadre.celdasDescuadradas} celda(s) no cuadran: ${enumerar(malas)}.`,
      cifra: { valor: String(cuadre.celdasDescuadradas), unidad: 'recuento' },
      implicados: malas,
    }
  }
  return {
    estado: 'cumplida',
    detalle: `Las ${cuadre.filas.length} celdas con saldo a 31/12/${ejercicio} están declaradas y cuadran (semáforo OK).`,
    cifra: { valor: String(cuadre.filas.length), unidad: 'recuento' },
  }
}

/**
 * «Fijar la foto de saldos por ubicación y activo, con la cotización empleada y su fuente.»
 *
 * La fuente cuenta tanto como el precio: una foto con cotizaciones sin fuente no es la foto
 * que alimenta el 721 ni la que abre el ejercicio siguiente con saldos comprobados.
 */
function evaluarFoto(foto: FotoCierre, ejercicio: number): EvaluacionAutomatica {
  if (foto.filas.length === 0) {
    return {
      estado: 'no-aplica',
      detalle: `No hay saldo a 31/12/${ejercicio} en ninguna ubicación.`,
      razon:
        `A 31/12/${ejercicio} no queda saldo en ninguna ubicación: la foto de cierre está vacía y ` +
        'el ejercicio siguiente abre en cero.',
    }
  }
  const cifra: CifraCasilla = { valor: foto.totalValoradoEUR, unidad: 'EUR' }
  if (foto.activosSinCotizacion.length > 0 || foto.activosSinFuente.length > 0) {
    const partes: string[] = []
    if (foto.activosSinCotizacion.length > 0) {
      partes.push(`sin cotización: ${enumerar(foto.activosSinCotizacion)}`)
    }
    if (foto.activosSinFuente.length > 0) {
      partes.push(`con cotización pero sin fuente citada: ${enumerar(foto.activosSinFuente)}`)
    }
    return {
      estado: 'pendiente',
      detalle:
        `La foto de cierre está a medias (${partes.join('; ')}). El total valorado ` +
        `(${foto.totalValoradoEUR} €) es un mínimo.`,
      cifra,
      implicados: [...foto.activosSinCotizacion, ...foto.activosSinFuente],
    }
  }
  return {
    estado: 'cumplida',
    detalle:
      `Foto fijada a 31/12/${ejercicio}: ${foto.filas.length} celda(s) de saldo por ubicación y ` +
      `activo, todas con su cotización y su fuente. Total valorado: ${foto.totalValoradoEUR} €.`,
    cifra,
  }
}

/**
 * «Comprobar que la cola FIFO y el saldo dicen lo mismo activo por activo.»
 *
 * La casilla que el manual exigía desde el principio y que la app no comprobaba en ninguna
 * parte hasta la v1.6.0. Es el «error invisible» de [MT] U6.2: el CUADRE mira hacia fuera y
 * cuadra, mientras el descuadre está una capa más abajo, en la clasificación.
 */
function evaluarConciliacion(
  conciliacion: ResultadoConciliacion,
  ejercicio: number,
): EvaluacionAutomatica {
  if (conciliacion.filas.length === 0) {
    return {
      estado: 'no-aplica',
      detalle: `No hay ningún activo con cola FIFO ni saldo a 31/12/${ejercicio}.`,
      razon:
        `A 31/12/${ejercicio} no hay ningún activo con cola FIFO ni con saldo que conciliar. ` +
        'El fiat no entra: es la moneda de cuenta, no un elemento patrimonial cuyo coste se siga.',
    }
  }
  if (conciliacion.estadoGlobal === 'OK') {
    return {
      estado: 'cumplida',
      detalle:
        `Los ${conciliacion.filas.length} activos concilian: las existencias vivas de la cola FIFO ` +
        'y la suma de saldos dicen lo mismo activo por activo.',
      cifra: { valor: String(conciliacion.filas.length), unidad: 'recuento' },
    }
  }
  const malos = conciliacion.filas.filter((f) => f.estado !== 'OK')
  return {
    estado: 'pendiente',
    detalle:
      `${conciliacion.activosDescuadrados} activo(s) no concilian: ` +
      `${enumerar(malos.map((f) => `${f.activo} (${f.estado}, ${f.diferencia})`))}. ` +
      'Mientras difieran, la cola FIFO y el saldo cuentan historias distintas del mismo patrimonio.',
    cifra: { valor: String(conciliacion.activosDescuadrados), unidad: 'recuento' },
    implicados: malos.flatMap((f) => f.apuntesImplicados),
  }
}

/** «Conciliación a tres columnas […] y archivarla.» */
function evaluarCasillaTresColumnas(t: ResultadoTresColumnas): EvaluacionAutomatica {
  if (t.filas.length === 0) {
    return {
      estado: 'pendiente',
      detalle:
        'La conciliación a tres columnas está vacía. Teclea lo que dicen tus datos fiscales frente ' +
        'a lo que dice el registro, aunque coincidan: la conciliación que sale a cero también se archiva.',
    }
  }
  if (t.filasSinExplicar > 0) {
    return {
      estado: 'pendiente',
      detalle:
        `${t.filasSinExplicar} de las ${t.filasConDiferencia} diferencias siguen sin explicación ` +
        'escrita. Una diferencia sin explicar es la que habrá que reconstruir de memoria dentro de cuatro años.',
      cifra: { valor: String(t.filasSinExplicar), unidad: 'recuento' },
      implicados: t.filas.filter((f) => f.sinExplicar).map((f) => f.concepto),
    }
  }
  return {
    estado: 'cumplida',
    detalle:
      `${t.filas.length} fila(s) conciliadas; ${t.filasConDiferencia} con diferencia y todas ` +
      `explicadas (diferencia total: ${t.diferenciaTotalEUR} €). Descarga el informe de cierre y ` +
      'archívalo en la carpeta del ejercicio: la casilla pide conciliar Y archivar.',
    cifra: { valor: t.diferenciaTotalEUR, unidad: 'EUR' },
  }
}

/** «Escribir la memoria del ejercicio.» */
function evaluarCasillaMemoria(m: ResultadoMemoria): EvaluacionAutomatica {
  if (m.completa) {
    return {
      estado: 'cumplida',
      detalle: `Los cuatro apartados de la memoria están escritos (${m.palabras} palabras).`,
      cifra: { valor: String(m.palabras), unidad: 'recuento' },
    }
  }
  const titulos = m.vacios.map(
    (v) => APARTADOS_MEMORIA.find((a) => a.clave === v)?.titulo ?? v,
  )
  return {
    estado: 'pendiente',
    detalle:
      `Faltan ${m.vacios.length} de los cuatro apartados: ${enumerar(titulos)}. ` +
      'Un apartado sin nada que contar se cierra diciéndolo; eso también es memoria.',
    cifra: { valor: String(m.escritos.length), unidad: 'recuento' },
    implicados: m.vacios,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 10. Propuesta de filas de la conciliación a tres columnas
// ────────────────────────────────────────────────────────────────────────────

/**
 * Propone las filas de la conciliación a tres columnas con la columna del REGISTRO ya puesta.
 *
 * El perímetro son las ubicaciones de tipo `exchange` NO marcadas como extranjeras, porque los
 * modelos 172 (saldos) y 173 (operaciones) los presentan los proveedores establecidos en
 * España: son esos los que han contado algo de ti a la Administración. Se propone una fila de
 * saldo por ubicación y activo (172) y una fila de operaciones por ubicación (173).
 *
 * Es una PROPUESTA para no partir de un folio en blanco, no un cálculo del modelo: el alumno
 * corrige la columna del registro cuando su criterio de agrupación no coincide con el del
 * proveedor, y añade las filas libres que necesite. La columna de operaciones suma los
 * contravalores en euros de los apuntes del ejercicio que tocan la ubicación, contando cada
 * apunte una sola vez aunque su origen y su destino sean la misma ubicación.
 */
export function proponerFilasTresColumnas(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  ejercicio: number,
  cotizaciones: CotizacionesCierre = {},
  activos?: readonly Activo[],
): FilaTresColumnas[] {
  const perimetro = ubicaciones.filter((u) => u.tipo === 'exchange' && !u.extranjero)
  if (perimetro.length === 0) return []

  const fiat = simbolosFiat(activos)
  const corte = corteCierre(ejercicio)
  const nombrePorId = new Map(perimetro.map((u) => [u.id, u.nombre]))
  const filas: FilaTresColumnas[] = []

  // Modelo 172 — SALDOS a 31 de diciembre, valorados en euros.
  const saldos = calcularSaldos([...apuntes], corte).filter(
    (s) => nombrePorId.has(s.ubicacion) && !D(s.saldo).isZero(),
  )
  for (const s of saldos) {
    const precio = fiat.has(s.activo) ? '1' : cotizaciones[s.activo]?.precioEUR
    const valor = precio ? aCadena(D(s.saldo).times(D(precio))) : ''
    filas.push({
      id: `172-${s.ubicacion}-${s.activo}`,
      concepto: `Saldo a ${fechaCorta(corte)} · ${nombrePorId.get(s.ubicacion)} · ${s.activo}`,
      segunDatosFiscalesEUR: '',
      segunRegistroEUR: valor,
      explicacion: '',
      origen: '172',
      ...(valor === '' ? { sinValorar: true } : {}),
    })
  }

  // Modelo 173 — OPERACIONES del ejercicio, por ubicación.
  for (const u of perimetro) {
    let total = CERO
    let n = 0
    for (const ap of apuntes) {
      if (ejercicioDe(ap.fechaHora) !== ejercicio) continue
      if (ap.ubicacionOrigen !== u.id && ap.ubicacionDestino !== u.id) continue
      n++
      if (ap.contravalorEUR) total = total.plus(D(ap.contravalorEUR))
    }
    if (n === 0) continue
    filas.push({
      id: `173-${u.id}`,
      concepto: `Operaciones del ejercicio ${ejercicio} · ${u.nombre} (${n} apuntes, contravalor EUR)`,
      segunDatosFiscalesEUR: '',
      segunRegistroEUR: aCadena(total),
      explicacion: '',
      origen: '173',
    })
  }

  return filas
}

// ────────────────────────────────────────────────────────────────────────────
// 11. El cálculo del cierre
// ────────────────────────────────────────────────────────────────────────────

/** Cruza la evaluación automática con la marca del alumno y resuelve el estado final. */
function resolverCasilla(
  def: DefinicionCasilla,
  auto: EvaluacionAutomatica | undefined,
  marca: MarcaCasilla | undefined,
): CasillaEvaluada {
  const base = {
    ...def,
    ...(auto?.cifra ? { cifra: auto.cifra } : {}),
    ...(auto?.implicados && auto.implicados.length > 0 ? { implicados: auto.implicados } : {}),
    ...(marca?.nota ? { nota: marca.nota } : {}),
    ...(marca?.marcadaEn ? { marcadaEn: marca.marcadaEn } : {}),
  }

  // 1. El «no aplica» del alumno manda sobre todo lo demás: es una decisión, y las decisiones
  //    del alumno no las revoca la herramienta. Lo que sí exige el Anexo D es su razón escrita.
  if (marca?.noAplica) {
    const razon = marca.razonNoAplica ?? ''
    const conRazon = escrito(razon)
    return {
      ...base,
      estado: 'no-aplica',
      resueltaPor: 'alumno',
      detalle: conRazon
        ? 'Descartada por el alumno, con su razón escrita.'
        : 'Descartada por el alumno SIN razón escrita: el ejercicio no puede cerrarse así.',
      razon,
      bloquea: !conRazon,
      ...(conRazon ? {} : { motivoBloqueo: 'no-aplica-sin-razon' as const }),
    }
  }

  // 2. La marca a mano da la casilla por cumplida. Si el motor la veía pendiente, se deja
  //    constancia: el alumno sabe cosas que el Libro no, pero marcar sobre un descuadre de
  //    conciliación o de cuadre es taparlo, y la pantalla tiene que poder decirlo.
  if (marca?.marcada) {
    const discrepa = auto !== undefined && auto.estado === 'pendiente'
    return {
      ...base,
      estado: 'cumplida',
      resueltaPor: 'alumno',
      detalle: discrepa
        ? `Marcada por el alumno. El motor, en cambio, la ve pendiente: ${auto.detalle}`
        : 'Marcada por el alumno.',
      bloquea: false,
      ...(discrepa ? { discrepanciaConMotor: true } : {}),
    }
  }

  // 3. Sin marca del alumno, manda la evaluación automática (si la casilla la tiene).
  if (auto) {
    const bloquea =
      auto.estado === 'pendiente' || (auto.estado === 'no-aplica' && !escrito(auto.razon))
    return {
      ...base,
      estado: auto.estado,
      resueltaPor: auto.estado === 'pendiente' ? 'nadie' : 'motor',
      detalle: auto.detalle,
      ...(auto.razon ? { razon: auto.razon } : {}),
      bloquea,
      ...(bloquea
        ? {
            motivoBloqueo:
              auto.estado === 'pendiente'
                ? ('pendiente' as const)
                : ('no-aplica-sin-razon' as const),
          }
        : {}),
    }
  }

  // 4. Casilla manual sin marcar.
  return {
    ...base,
    estado: 'pendiente',
    resueltaPor: 'nadie',
    detalle: 'Solo tú puedes responderla: márcala cuando esté hecha, o descártala con su razón.',
    bloquea: true,
    motivoBloqueo: 'pendiente',
  }
}

/**
 * Calcula el CIERRE del ejercicio: evalúa las quince casillas del Anexo D, resuelve sola las
 * ocho que puede y devuelve, junto al checklist, todo lo que lo respalda (la foto de cierre,
 * el cuadre, la conciliación FIFO↔saldos, el estado del expediente, la conciliación a tres
 * columnas y la memoria).
 *
 * `cerrado` implementa el Anexo D al pie de la letra: todas las casillas marcadas, o marcadas
 * como no aplicables CON su razón escrita. Un «no aplica» en blanco no cierra el ejercicio.
 *
 * Determinista y puro: la misma entrada da siempre la misma salida.
 */
export function calcularCierre(entradas: EntradasCierre): EstadoCierre {
  const {
    ejercicio,
    apuntes,
    ubicaciones,
    justificantes,
    saldosReales = [],
    activos,
    tolerancias = TOLERANCIAS_POR_DEFECTO,
    cotizaciones = {},
    aviso721,
    tresColumnas = [],
    toleranciaTresColumnasEUR = '0',
    memoria = {},
    marcas = {},
  } = entradas

  const corte = corteCierre(ejercicio)

  // La conciliación FIFO↔saldos se calcula sobre el diario RECORTADO al cierre: la cola FIFO
  // se construye siempre con los apuntes que se le pasan, así que dejar dentro los de enero
  // del año siguiente compararía una cola de mañana con un saldo de hoy.
  const hastaCierre = [...apuntes].filter((a) => a.fechaHora <= corte)

  const foto = componerFotoCierre(apuntes, ubicaciones, ejercicio, cotizaciones, activos)
  const cuadre = cuadreDeCierre(apuntes, ubicaciones, saldosReales, ejercicio, tolerancias)
  const conciliacionFifo = conciliarFifoSaldos(hastaCierre, {
    corte,
    tolerancias,
    ...(activos ? { activos } : {}),
  })

  const informe = informeCompletitud(apuntes, justificantes, mapaKyc(ubicaciones), ejercicio)
  const archivo: ResumenArchivoCierre = {
    ...informe,
    apuntesConHueco: informe.huecos.map((h) => h.apunte.id),
  }

  const tres = evaluarTresColumnas(tresColumnas, toleranciaTresColumnasEUR)
  const mem = evaluarMemoria(memoria)

  const automaticas: Partial<Record<IdCasillaCierre, EvaluacionAutomatica>> = {
    'justificantes-al-dia': evaluarJustificantes(archivo, ejercicio),
    'estimacion-721-octubre': evaluarEstimacion721(aviso721, ejercicio),
    'cuadrar-ubicaciones': evaluarCuadre(cuadre, ejercicio),
    'foto-saldos': evaluarFoto(foto, ejercicio),
    'conciliacion-fifo-saldos': evaluarConciliacion(conciliacionFifo, ejercicio),
    'modelo-721': evaluarModelo721(aviso721, ejercicio),
    'conciliacion-tres-columnas': evaluarCasillaTresColumnas(tres),
    'memoria-ejercicio': evaluarCasillaMemoria(mem),
  }

  const casillas = CHECKLIST_CIERRE.map((def) =>
    resolverCasilla(def, automaticas[def.id], marcas[def.id]),
  )

  const porMomento: GrupoMomento[] = ORDEN_MOMENTOS.map((momento) => ({
    momento,
    etiqueta: ETIQUETA_MOMENTO[momento],
    casillas: casillas.filter((c) => c.momento === momento),
  })).filter((g) => g.casillas.length > 0)

  const cumplidas = casillas.filter((c) => c.estado === 'cumplida').length
  const pendientes = casillas.filter((c) => c.estado === 'pendiente').length
  const noAplicables = casillas.filter((c) => c.estado === 'no-aplica').length
  const noAplicaSinRazon = casillas.filter(
    (c) => c.motivoBloqueo === 'no-aplica-sin-razon',
  ).length
  const bloqueos = casillas.filter((c) => c.bloquea)
  const resueltas = casillas.length - bloqueos.length

  return {
    ejercicio,
    casillas,
    porMomento,
    cumplidas,
    pendientes,
    noAplicables,
    noAplicaSinRazon,
    cerrado: bloqueos.length === 0,
    bloqueos,
    porcentaje:
      casillas.length === 0 ? 0 : Math.round((resueltas / casillas.length) * 1000) / 10,
    foto,
    cuadre,
    conciliacionFifo,
    archivo,
    tresColumnas: tres,
    memoria: mem,
  }
}

/** Umbral informativo del modelo 721, reexportado para la pantalla y el informe de cierre. */
export { UMBRAL_721_EUR }
