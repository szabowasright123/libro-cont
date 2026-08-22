/**
 * aviso721.ts — aviso del modelo 721 con DOBLE FECHA, exclusión de autocustodia y exclusión
 * del saldo en fiat (derivada D2, P9.4). Capa pura que LEE el motor (`calcularSaldos`) sin
 * tocarlo (Regla de oro 1):
 *
 *  - **Doble corte:** estimación anticipada a 20-oct (margen para anticipar la obligación) y
 *    corte normativo a 31-dic (fecha legal de referencia; presentación 1-ene→31-mar del año
 *    siguiente). Solo el 31-dic refleja la regla; el 20-oct se rotula como estimación.
 *  - **Autocustodia excluida:** las wallets cuyas claves controla el alumno no computan para el
 *    721. Autoridad citada (la misma, y en el mismo orden, que [MT] U10.1 y el Anexo IX):
 *    DGT V2290-23 (28-7-2023, hot/cold wallet) → V0941-24 (29-4-2024, paper wallet) → preguntas
 *    frecuentes del modelo 721 de la Sede de la AEAT. Solo entran ubicaciones `extranjero` que NO
 *    sean `autocustodia`. Cotejado a 19-8-2026.
 *  - **Fiat excluido:** el 721 informa de MONEDAS VIRTUALES. El saldo en moneda fiduciaria de
 *    una cuenta abierta en el extranjero no va al 721, sino al bloque de cuentas del modelo 720
 *    (DGT **V2185-23**, de 25-7-2023). Hasta la v1.5.0 el euro sumaba al total valorado y el
 *    aviso se contradecía con su propio texto, que cita V2185-23 desde la v1.4.0: era el error
 *    «por exceso» que [MT] U10.1 enseña a evitar —informar de un patrimonio en monedas
 *    virtuales que en realidad vale cero—. El fiat se identifica por el catálogo de activos
 *    (`Activo.esFiat`), nunca comparando con la cadena `'EUR'`: hay más monedas de curso legal
 *    que el euro y el alumno puede darlas de alta. Mismo criterio y misma mecánica de catálogo
 *    que `engine/conciliacion.ts`, que tuvo este mismo problema con la cola FIFO.
 *    El importe excluido NO se esconde: viaja en `totalFiatExcluidoEUR` y en
 *    `celdasFiatExcluidas` para que la pantalla pueda decir cuánto se ha dejado fuera y por qué.
 *  - **Precios manuales:** local-first; sin precio la cripto queda «sin valorar» y el total es un
 *    mínimo (el aviso nunca afirma que se supera).
 *
 * Nunca es cálculo de obligación: es un aviso informativo.
 */
import type { Activo, Apunte, RefUbicacion, SimboloActivo, Ubicacion } from '../../engine/types'
import { ACTIVOS_BASE } from '../../engine/types'
import { calcularSaldos } from '../../engine/saldos'
import { D, aCadena, CERO } from '../../engine/decimal'
import {
  UMBRAL_721_EUR,
  type AvisoSaldoExtranjero,
  type SaldoExtranjeroCelda,
} from '../../engine/fiscal'

/** Corte de la estimación anticipada (20 de octubre del ejercicio, inclusive). */
export function corteEstimacion(ejercicio: number): string {
  return `${ejercicio}-10-20T23:59:59`
}

/** Corte normativo (31 de diciembre del ejercicio, inclusive) — la fecha legal de referencia. */
export function corteNormativo(ejercicio: number): string {
  return `${ejercicio}-12-31T23:59:59`
}

/** Precios manuales EUR por activo (cadena decimal interna). EUR vale 1 implícitamente. */
export type PreciosManuales = Readonly<Record<SimboloActivo, string>>

/**
 * Aviso 721 a un corte, con el rastro de lo que se ha dejado fuera por ser fiat.
 *
 * Extiende `AvisoSaldoExtranjero` (la forma que ya conocen la pantalla FISCAL, el informe HTML
 * y el CSV) en lugar de sustituirla, para que quien solo quiera el total valorado siga leyendo
 * los mismos campos.
 */
export interface Aviso721Corte extends AvisoSaldoExtranjero {
  /**
   * Suma en EUR del saldo en fiat de las ubicaciones computables, EXCLUIDA del total del 721.
   * No es un saldo perdido: es el importe que, en su caso, corresponde al bloque de cuentas
   * del modelo 720 (V2185-23). La pantalla debe enseñarlo para que el alumno no crea que la
   * app se ha comido un saldo.
   */
  totalFiatExcluidoEUR: string
  /** Detalle, ubicación a ubicación, del fiat excluido del cómputo. */
  celdasFiatExcluidas: SaldoExtranjeroCelda[]
}

/**
 * Conjunto de símbolos fiat según el catálogo. `ACTIVOS_BASE` va primero y lo que llega por
 * parámetro manda: el repositorio guarda solo los activos que el alumno añade, así que el
 * catálogo que llega puede no traer el euro. Idéntico a `conciliacion.ts` a propósito.
 */
function simbolosFiat(activos?: readonly Activo[]): Set<SimboloActivo> {
  const fiat = new Set<SimboloActivo>()
  for (const a of [...ACTIVOS_BASE, ...(activos ?? [])]) {
    if (a.esFiat) fiat.add(a.simbolo)
    else fiat.delete(a.simbolo)
  }
  return fiat
}

/**
 * Calcula el aviso 721 a un corte dado sobre las ubicaciones extranjeras NO autocustodia,
 * dejando fuera del cómputo el saldo en fiat. La cripto se valora con precios manuales; sin
 * precio, «sin valorar».
 */
function avisoEnCorte(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  corteISO: string,
  precios: PreciosManuales,
  umbral: number,
  activos?: readonly Activo[],
): Aviso721Corte {
  // Perímetro: extranjero y NO autocustodia (la autocustodia nunca computa para el 721).
  const computables = new Map<RefUbicacion, Ubicacion>()
  for (const u of ubicaciones) if (u.extranjero && !u.autocustodia) computables.set(u.id, u)

  const fiat = simbolosFiat(activos)
  const saldos = calcularSaldos([...apuntes], corteISO)
  const celdas: SaldoExtranjeroCelda[] = []
  const celdasFiatExcluidas: SaldoExtranjeroCelda[] = []
  let total = CERO
  let totalFiat = CERO
  let haySinValorar = false

  for (const s of saldos) {
    const ubic = computables.get(s.ubicacion)
    if (!ubic) continue
    if (D(s.saldo).isZero()) continue

    // El euro es la moneda de cuenta y vale 1; otra divisa necesita precio como la cripto.
    const valorar = (): { valorEUR: string | null; sinValorar: boolean } => {
      if (s.activo === 'EUR') return { valorEUR: s.saldo, sinValorar: false }
      const precio = precios[s.activo]
      if (precio !== undefined && precio !== '') {
        return { valorEUR: aCadena(D(s.saldo).times(D(precio))), sinValorar: false }
      }
      return { valorEUR: null, sinValorar: true }
    }

    const { valorEUR, sinValorar } = valorar()
    const celda: SaldoExtranjeroCelda = {
      ubicacion: s.ubicacion,
      nombre: ubic.nombre,
      ...(ubic.pais ? { pais: ubic.pais } : {}),
      activo: s.activo,
      saldo: s.saldo,
      valorEUR,
      sinValorar,
    }

    if (fiat.has(s.activo)) {
      // Fuera del 721 (V2185-23). Su falta de precio no vuelve «mínimo» el total del 721,
      // porque no forma parte de él: solo deja incompleto el importe informativo del fiat.
      if (valorEUR !== null) totalFiat = totalFiat.plus(D(valorEUR))
      celdasFiatExcluidas.push(celda)
      continue
    }

    if (valorEUR !== null) total = total.plus(D(valorEUR))
    if (sinValorar) haySinValorar = true
    celdas.push(celda)
  }

  const porNombreYActivo = (a: SaldoExtranjeroCelda, b: SaldoExtranjeroCelda): number =>
    a.nombre.localeCompare(b.nombre) || a.activo.localeCompare(b.activo)
  celdas.sort(porNombreYActivo)
  celdasFiatExcluidas.sort(porNombreYActivo)
  return {
    // `aplica` mira solo a las monedas virtuales: una cuenta extranjera con únicamente euros
    // no es un supuesto del 721, y anunciarlo como tal sería el aviso «por exceso».
    aplica: celdas.length > 0,
    supera: total.greaterThan(umbral),
    umbralEUR: umbral,
    totalValoradoEUR: aCadena(total),
    celdas,
    haySinValorar,
    totalFiatExcluidoEUR: aCadena(totalFiat),
    celdasFiatExcluidas,
  }
}

/** Aviso 721 en sus dos cortes (estimación 20-oct y normativo 31-dic). */
export interface Aviso721DobleFecha {
  /** ¿Hay alguna moneda virtual en una ubicación extranjera no autocustodia en algún corte? */
  aplica: boolean
  umbralEUR: number
  /** Corte anticipado a 20 de octubre (estimación; la referencia legal es el 31/12). */
  estimacion: Aviso721Corte
  /** Corte normativo a 31 de diciembre (la fecha legal de referencia del saldo). */
  normativo: Aviso721Corte
}

/**
 * Aviso 721 con doble fecha. Determinista y puro; no hace red. `precios` los teclea el alumno.
 *
 * @param activos catálogo del alumno, para saber qué símbolos son fiat. Se une a
 *   `ACTIVOS_BASE`; si se omite, solo el euro se toma por fiat.
 */
export function calcularAviso721(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  ejercicio: number,
  precios: PreciosManuales,
  umbral: number = UMBRAL_721_EUR,
  activos?: readonly Activo[],
): Aviso721DobleFecha {
  const estimacion = avisoEnCorte(
    apuntes,
    ubicaciones,
    corteEstimacion(ejercicio),
    precios,
    umbral,
    activos,
  )
  const normativo = avisoEnCorte(
    apuntes,
    ubicaciones,
    corteNormativo(ejercicio),
    precios,
    umbral,
    activos,
  )
  return {
    aplica: estimacion.aplica || normativo.aplica,
    umbralEUR: umbral,
    estimacion,
    normativo,
  }
}
