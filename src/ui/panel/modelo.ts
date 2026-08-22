/**
 * modelo.ts — capa PURA del Panel: UNA sola llamada al motor por cambio de datos.
 *
 * El Panel es el Diario visto por el motor: los mismos apuntes convertidos en SALDOS, cola
 * FIFO, CUADRE y conciliación. Sus cuatro bloques miran la misma verdad desde ángulos
 * distintos, así que si cada uno llamase al motor por su cuenta el recálculo se haría cuatro
 * veces por render. Aquí se hace una vez y se reparte: la página memoiza `construirVistaPanel`
 * con `useMemo` y los bloques reciben resultados, no diarios.
 *
 * NO hay cálculo nuevo: se leen `calcularSaldos`, `calcularFifo` y `conciliarFifoSaldos`
 * (Regla de oro 4 — la lógica vive en `src/engine`, jamás en un componente). Lo único que se
 * añade es la forma de rejilla que la pantalla necesita, que es presentación.
 */
import type {
  Activo,
  Apunte,
  RefUbicacion,
  SaldoCelda,
  SimboloActivo,
  FechaHoraISO,
} from '../../engine/types'
import { calcularSaldos } from '../../engine/saldos'
import { calcularFifo, type ResultadoFifoActivo } from '../../engine/fifo'
import { conciliarFifoSaldos, type ResultadoConciliacion } from '../../engine/conciliacion'
import { D, aCadena, CERO } from '../../engine/decimal'

/** Todo lo que el Panel necesita del motor, calculado de una vez. */
export interface VistaPanel {
  saldos: SaldoCelda[]
  rejilla: RejillaSaldos
  fifo: Map<SimboloActivo, ResultadoFifoActivo>
  conciliacion: ResultadoConciliacion
  /**
   * Mensaje del motor si el cálculo no pudo hacerse (el FIFO exige orden cronológico y
   * lanza si el diario está roto). Con error, `fifo` y `conciliacion` van vacíos y la
   * pantalla lo dice en vez de quedarse en blanco.
   */
  error: string | null
}

/** La rejilla ubicación x activo de la hoja SALDOS, ya ordenada para pintarla. */
export interface RejillaSaldos {
  ubicaciones: RefUbicacion[]
  activos: SimboloActivo[]
  /** Celdas indexadas por `claveCelda`; una celda ausente es «sin movimiento». */
  celdas: Map<string, SaldoCelda>
  /** Suma de todas las ubicaciones por activo (la fila de totales). */
  totalPorActivo: Map<SimboloActivo, string>
  /** ¿Alguna celda con saldo negativo? (alerta roja de la Unidad 7). */
  hayNegativos: boolean
}

/** Clave estable de una celda de la rejilla. */
export function claveCelda(ubicacion: RefUbicacion, activo: SimboloActivo): string {
  return `${ubicacion} ${activo}`
}

/**
 * Ordena las celdas de `calcularSaldos` en la rejilla ubicación x activo.
 *
 * @param saldos    salida de `calcularSaldos`
 * @param etiqueta  cómo se llama cada ubicación en pantalla (para ordenar por lo que se ve,
 *                  no por el id interno, que el alumno no conoce)
 */
export function rejillaSaldos(
  saldos: readonly SaldoCelda[],
  etiqueta: (u: RefUbicacion) => string = String,
): RejillaSaldos {
  const celdas = new Map<string, SaldoCelda>()
  const ubicaciones = new Set<RefUbicacion>()
  const activos = new Set<SimboloActivo>()
  let hayNegativos = false

  for (const c of saldos) {
    celdas.set(claveCelda(c.ubicacion, c.activo), c)
    ubicaciones.add(c.ubicacion)
    activos.add(c.activo)
    if (c.negativo) hayNegativos = true
  }

  const totalPorActivo = new Map<SimboloActivo, string>()
  for (const activo of activos) {
    let total = CERO
    for (const u of ubicaciones) {
      const c = celdas.get(claveCelda(u, activo))
      if (c) total = total.plus(D(c.saldo))
    }
    totalPorActivo.set(activo, aCadena(total))
  }

  return {
    ubicaciones: [...ubicaciones].sort((a, b) => etiqueta(a).localeCompare(etiqueta(b), 'es')),
    activos: [...activos].sort((a, b) => a.localeCompare(b, 'es')),
    celdas,
    totalPorActivo,
    hayNegativos,
  }
}

/** Cola FIFO vacía, para los activos que aún no tienen ninguna (nunca `undefined` en la UI). */
const SIN_COLA: ResultadoFifoActivo = {
  resumen: {
    activo: '',
    adquiridoTotal: '0',
    consumidoTotal: '0',
    restanteTotal: '0',
    costeRestanteEUR: '0',
    lotesAbiertos: [],
  },
  transmisiones: [],
}

/**
 * Calcula, de una sola vez, todo lo que pintan los cuatro bloques del Panel.
 *
 * @param apuntes  diario completo en orden cronológico (lo garantiza el repositorio)
 * @param activos  catálogo de activos del alumno. Es imprescindible pasarlo: sin él la
 *                 conciliación solo conoce el euro como fiat (`ACTIVOS_BASE`) y trataría
 *                 cualquier otra moneda de cuenta como cripto descuadrada.
 * @param corte    ISO de corte inclusive para los SALDOS (opcional)
 */
export function construirVistaPanel(
  apuntes: Apunte[],
  activos: readonly Activo[],
  corte?: FechaHoraISO,
): VistaPanel {
  const saldos = calcularSaldos([...apuntes], corte)
  try {
    return {
      saldos,
      rejilla: rejillaSaldos(saldos),
      fifo: calcularFifo([...apuntes]),
      conciliacion: conciliarFifoSaldos([...apuntes], { activos, corte }),
      error: null,
    }
  } catch (e) {
    // El diario desordenado hace lanzar a `exigirOrdenCronologico`: los SALDOS no dependen
    // del orden y siguen siendo válidos, así que se conservan y solo se pierde el FIFO.
    return {
      saldos,
      rejilla: rejillaSaldos(saldos),
      fifo: new Map(),
      conciliacion: { filas: [], estadoGlobal: 'OK', activosDescuadrados: 0 },
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Cola de un activo, o una cola vacía con su símbolo (evita el `undefined` en la UI). */
export function colaDe(
  fifo: Map<SimboloActivo, ResultadoFifoActivo>,
  activo: SimboloActivo,
): ResultadoFifoActivo {
  return fifo.get(activo) ?? { ...SIN_COLA, resumen: { ...SIN_COLA.resumen, activo } }
}
