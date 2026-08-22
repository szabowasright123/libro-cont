/**
 * expediente.ts — el EXPEDIENTE DE ENTREGA: reunir el ejercicio entero en un solo resultado.
 *
 * Hasta ahora la app exportaba piezas sueltas —la copia JSON, el XLSX sobre la plantilla, el
 * resumen fiscal en HTML y en CSV— y ninguna de ellas es «el ejercicio». El alumno que tiene
 * que entregar un trabajo evaluable, o el contribuyente que quiere darle a su asesor todo lo
 * que ha hecho en el año, necesitaban un documento único. Esto lo calcula;
 * `ui/entrega/expedienteHtml.ts` lo escribe.
 *
 * Aquí NO hay cálculo propio: cada cifra la produce el motor (`saldos`, `cuadre`,
 * `conciliacion`, `fifo`, `fiscal`, `archivo`, `validaciones`) y este módulo se limita a
 * pedírsela y a fijar los CORTES, que es la única decisión de criterio que hay que tomar:
 *
 *   · SALDOS, CONCILIACIÓN y COLA FIFO se calculan sobre el diario recortado a 31/12 del
 *     ejercicio. Son fotografías del cierre y tienen que ser coherentes entre sí: conciliar
 *     las existencias de la cola al cierre contra los saldos de otro momento no diría nada.
 *   · El CUADRE, en cambio, va sobre el diario COMPLETO. El saldo real lo teclea el alumno
 *     leyéndolo hoy en el exchange o en la wallet, no a 31/12 del ejercicio: compararlo con
 *     un saldo de hace tres años fabricaría descuadres inexistentes. El documento lo dice.
 *   · El RESUMEN FISCAL recibe el diario completo, como en la pantalla Fiscal: filtra el
 *     ejercicio por dentro y necesita la historia entera para imputar el coste FIFO.
 *
 * Capa de datos y función PURA (entra estado, sale resultado): sin Dexie, sin React y sin
 * navegador, para que se pueda probar en Node y llamar desde cualquier pantalla.
 */

import type {
  Activo,
  Apunte,
  FilaCuadre,
  Justificante,
  ResultadoTransmision,
  SaldoCelda,
  SimboloActivo,
  Tolerancias,
  Ubicacion,
} from '../../engine/types'
import { TOLERANCIAS_POR_DEFECTO } from '../../engine/types'
import { calcularSaldos } from '../../engine/saldos'
import { calcularCuadre, type SaldoRealDeclarado } from '../../engine/cuadre'
import { conciliarFifoSaldos, type ResultadoConciliacion } from '../../engine/conciliacion'
import { calcularFifo, type ResultadoFifoActivo } from '../../engine/fifo'
import {
  calcularResumenFiscal,
  corteEjercicio,
  type OpcionesFiscal,
  type ResumenFiscal,
} from '../../engine/fiscal'
import {
  agruparPorApunte,
  estadoProbatorioApunte,
  informeCompletitud,
  mapaKyc,
  type InformeCompletitud,
  type ResultadoProbatorio,
} from '../../engine/archivo'
import { validarDiario, type Aviso } from '../../engine/validaciones'
import { casillasDeEjercicio, type MapaCasilla } from '../casillas-2024'
import { construirIndiceCarpeta, type IndiceCarpeta } from './indiceCarpeta'

/**
 * Datos de entrada del expediente. Todo entra por parámetro —nada se lee de la base de
 * datos— para que el mismo módulo sirva a la pantalla de Cierre, a la de Ajustes y a los
 * tests, y para que la capa de presentación no decida qué se calcula.
 */
export interface DatosExpediente {
  /** Ejercicio (año) que se entrega. */
  ejercicio: number
  /**
   * Diario COMPLETO del Libro, todos los ejercicios. No basta con el año que se entrega: el
   * coste FIFO de una venta de 2026 puede estar en una compra de 2024.
   */
  apuntes: readonly Apunte[]
  /** Catálogo de ubicaciones (aporta el nombre legible y la columna KYC). */
  ubicaciones: readonly Ubicacion[]
  /** Catálogo de activos (la conciliación necesita saber cuáles son FIAT). */
  activos?: readonly Activo[]
  /** Justificantes de dominio del Libro completo. */
  justificantes?: readonly Justificante[]
  /** Saldos reales declarados por el alumno para el CUADRE. */
  cuadreReal?: readonly SaldoRealDeclarado[]
  /** Tolerancias del semáforo (por defecto verde ≤ 1e-8, ámbar ≤ 0,001). */
  tolerancias?: Tolerancias
  /** Titular del Libro, si consta. Aparece en la portada. */
  titular?: string
  /** Versión de la app; por defecto, la inyectada por Vite en `__APP_VERSION__`. */
  version?: string
  /** Momento de generación (ISO local). Inyectable para que los tests sean deterministas. */
  generadoEn?: string
  /** Mapa de casillas; por defecto, el del ejercicio (`casillasDeEjercicio`). */
  casillas?: readonly MapaCasilla[]
  /** Opciones del cálculo fiscal (valoración de cierre para el aviso 721). */
  opcionesFiscal?: OpcionesFiscal
}

/** El ejercicio entero, ya calculado, listo para escribirlo. */
export interface ExpedienteCalculado {
  ejercicio: number
  /** Corte del cierre: 31/12 del ejercicio a las 23:59:59. */
  corte: string
  generadoEn: string
  version: string
  titular?: string

  /** Apuntes del ejercicio, en orden cronológico. */
  apuntesEjercicio: Apunte[]
  /** Nº de apuntes de todo el Libro. */
  apuntesLibro: number
  /** Nº de apuntes posteriores al cierre (contexto para leer el CUADRE). */
  apuntesPosteriores: number

  saldos: SaldoCelda[]
  cuadre: FilaCuadre[]
  conciliacion: ResultadoConciliacion
  /** Cola FIFO por activo al cierre del ejercicio. */
  fifo: Map<SimboloActivo, ResultadoFifoActivo>
  /** Transmisiones del ejercicio con su coste imputado, en orden cronológico. */
  transmisiones: ResultadoTransmision[]

  resumen: ResumenFiscal
  casillas: readonly MapaCasilla[]
  /** Ejercicio del mapa de casillas usado (puede no ser el del expediente). */
  ejercicioMapa: number | null
  /** true si el mapa de casillas es exactamente el del ejercicio entregado. */
  casillasDelEjercicio: boolean

  /** Estado probatorio de cada apunte del ejercicio. */
  probatorio: ResultadoProbatorio[]
  completitud: InformeCompletitud
  indice: IndiceCarpeta

  /** Avisos abiertos de `validarDiario` sobre el Libro completo. */
  avisos: Aviso[]
  /** Nombre legible de cada ubicación, por id. */
  nombrePorId: Map<string, string>
}

/** Versión de la app inyectada por Vite; fuera del bundle (tests, Node) queda «—». */
function versionApp(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '—'
}

/**
 * Momento actual como ISO **local**, sin sufijo de zona (`AAAA-MM-DDTHH:MM:SS`).
 *
 * `toISOString()` da UTC, y toda la app lee las fechas como hora local española (DOMINIO
 * §3.1, Regla de oro 6): recortar el ISO de UTC y pintarlo con `fmtFechaHora` fecha el
 * expediente una o dos horas antes de lo que marca el reloj del alumno, y un documento de
 * entrega que dice una hora que no es se lee como un fallo de fiabilidad. Se compensa el
 * desfase de zona antes de recortar.
 */
function ahoraLocalISO(): string {
  const ahora = new Date()
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
}

/**
 * Orden cronológico no decreciente, estable para los empates (que conservan el orden del
 * correlativo). El motor FIFO lo EXIGE y lanza si se rompe: el expediente prefiere ordenar
 * una copia a estallar en la cara del alumno el día que entrega.
 */
function enOrden(apuntes: readonly Apunte[]): Apunte[] {
  return [...apuntes].sort(
    (a, b) => a.fechaHora.localeCompare(b.fechaHora) || a.id.localeCompare(b.id),
  )
}

/** Nombre de fichero sugerido del expediente de un ejercicio. */
export function nombreFicheroExpediente(ejercicio: number): string {
  return `expediente-${ejercicio}.html`
}

/**
 * Calcula el expediente de entrega de un ejercicio. Determinista salvo por `generadoEn`,
 * que se puede fijar por parámetro.
 */
export function calcularExpediente(datos: DatosExpediente): ExpedienteCalculado {
  const { ejercicio } = datos
  const corte = corteEjercicio(ejercicio)
  const tolerancias = datos.tolerancias ?? TOLERANCIAS_POR_DEFECTO
  const justificantes = datos.justificantes ?? []
  const activos = datos.activos ?? []

  const apuntes = enOrden(datos.apuntes)
  const hastaCierre = apuntes.filter((a) => a.fechaHora <= corte)
  const apuntesEjercicio = apuntes.filter((a) => a.fechaHora.slice(0, 4) === String(ejercicio))

  // Fotografías del cierre, todas sobre el mismo diario recortado (ver cabecera).
  const saldos = calcularSaldos([...hastaCierre], corte)
  const conciliacion = conciliarFifoSaldos([...hastaCierre], { corte, tolerancias, activos })
  const fifo = calcularFifo([...hastaCierre])

  const transmisiones: ResultadoTransmision[] = []
  for (const { transmisiones: ts } of fifo.values()) {
    for (const t of ts) if (t.ejercicio === ejercicio) transmisiones.push(t)
  }
  transmisiones.sort(
    (a, b) => a.fechaHora.localeCompare(b.fechaHora) || a.apunteId.localeCompare(b.apunteId),
  )

  // El CUADRE va contra el saldo declarado HOY: diario completo (ver cabecera).
  const cuadre = calcularCuadre(calcularSaldos([...apuntes]), [...(datos.cuadreReal ?? [])], tolerancias)

  const resumen = calcularResumenFiscal(
    apuntes,
    datos.ubicaciones,
    justificantes,
    ejercicio,
    datos.opcionesFiscal ?? {},
  )

  const mapa = casillasDeEjercicio(ejercicio)
  const kyc = mapaKyc(datos.ubicaciones)
  const porApunte = agruparPorApunte(justificantes)
  const probatorio = apuntesEjercicio.map((ap) =>
    estadoProbatorioApunte(ap, porApunte.get(ap.id) ?? [], kyc),
  )

  return {
    ejercicio,
    corte,
    generadoEn: datos.generadoEn ?? ahoraLocalISO(),
    version: datos.version ?? versionApp(),
    ...(datos.titular ? { titular: datos.titular } : {}),

    apuntesEjercicio,
    apuntesLibro: apuntes.length,
    apuntesPosteriores: apuntes.length - hastaCierre.length,

    saldos,
    cuadre,
    conciliacion,
    fifo,
    transmisiones,

    resumen,
    casillas: datos.casillas ?? mapa.casillas,
    ejercicioMapa: datos.casillas ? null : mapa.ejercicioMapa,
    casillasDelEjercicio: datos.casillas ? true : mapa.esDelEjercicio,

    probatorio,
    completitud: informeCompletitud(apuntes, justificantes, kyc, ejercicio),
    indice: construirIndiceCarpeta(
      apuntesEjercicio,
      justificantes,
      kyc,
      ejercicio,
      new Set(apuntes.map((a) => a.id)),
    ),

    avisos: validarDiario([...apuntes], tolerancias, activos),
    nombrePorId: new Map(datos.ubicaciones.map((u) => [u.id, u.nombre])),
  }
}
