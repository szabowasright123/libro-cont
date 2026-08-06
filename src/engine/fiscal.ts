/**
 * fiscal.ts — Módulo fiscal (Bloque 3, F7). Agregación anual ORIENTATIVA del motor.
 *
 * Fuente de verdad de los NÚMEROS: el motor FIFO (`fifo.ts`) y los apuntes del diario.
 * Este módulo NO calcula nada nuevo de FIFO: reparte las transmisiones y los ingresos ya
 * calculados en los cinco cajones fiscales del taller y adjunta el estado probatorio de las
 * pérdidas. Las cifras reconcilian con los golden del FIFO (criterio de aceptación P7).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGLA DE ORO 5 — TEXTOS FISCALES: en este módulo los textos con calificación fiscal NO se
 * redactan. Cada ranura de texto vale el marcador `{{TEXTO-MANUAL}}` (MARCADOR_TEXTO); el
 * responsable del taller pegará los literales del manual. El catálogo de ranuras
 * (`RANURAS_TEXTO_MANUAL`) alimenta docs/PENDIENTE_TEXTOS.md. El motor solo calcula números
 * y estructura; las etiquetas estructurales (nombres de los cajones) no son calificaciones.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cajones (DOMINIO §3.3 / §4 FISCAL):
 *   a) AHORRO   — ganancias y pérdidas patrimoniales por transmisión onerosa: VENTA,
 *                 PERMUTA (entregada) y PAGO. Neto por operación desde el FIFO.
 *   b) RCM      — rendimientos del capital mobiliario: RENDIMIENTO (staking, lending) a
 *                 contravalor del día.
 *   c) ACTIVIDAD ECONÓMICA — MINERÍA (total informativo).
 *   d) BASE GENERAL — ganancias no derivadas de transmisión: AIRDROP.
 *   e) PÉRDIDAS — PÉRDIDA (robo/estafa/…) con su estado probatorio del Archivo y aviso de
 *                 deducibilidad condicionada. Se listan APARTE del ahorro: su cómputo está
 *                 condicionado a requisitos y prueba (dualidad DGT) — no se netea sin más.
 *
 * Avisos informativos (nunca cálculo de obligación): modelo 721 (saldo en el extranjero
 * > 50.000 € a 31/12) y nota 172/173.
 *
 * TypeScript puro y determinista (Regla de oro 4): sin React, sin Dexie, sin browser APIs.
 */

import {
  type Apunte,
  type IdApunte,
  type Justificante,
  type RefUbicacion,
  type SimboloActivo,
  type TipoOperacion,
  type Ubicacion,
} from './types'
import { D, aCadena, CERO } from './decimal'
import { transmisionesDelDiario } from './fifo'
import { calcularSaldos } from './saldos'
import {
  estadoProbatorioApunte,
  agruparPorApunte,
  mapaKyc,
  type EstadoProbatorio,
  type RequisitoProbatorio,
} from './archivo'

// ────────────────────────────────────────────────────────────────────────────
// 0. Marcador de texto manual y catálogo de ranuras (Regla de oro 5)
// ────────────────────────────────────────────────────────────────────────────

/** Marcador que ocupa toda ranura de texto fiscal hasta que el responsable pegue el literal. */
export const MARCADOR_TEXTO = '{{TEXTO-MANUAL}}' as const

/** Umbral informativo del modelo 721 (saldo en el extranjero a 31/12). Solo aviso. */
export const UMBRAL_721_EUR = 50000

/** Los cinco cajones fiscales del resumen. */
export type ConceptoFiscal =
  | 'ahorro'
  | 'rcm'
  | 'actividad-economica'
  | 'base-general'
  | 'perdidas'

/**
 * Definición estructural de un cajón fiscal. `etiqueta` y `baseImponible` son terminología
 * estructural (nombres de la base), NO calificaciones: la calificación fiscal literal vive
 * en las ranuras `{{TEXTO-MANUAL}}` (`explicacion`, `fechaCriterio`).
 */
export interface DefinicionConcepto {
  readonly clave: ConceptoFiscal
  /** Nombre del cajón para la UI (estructural). */
  readonly etiqueta: string
  /** Nombre de la base imponible en la que encaja (estructural). */
  readonly baseImponible: string
  /** Tipos de operación que alimentan el cajón. */
  readonly tipos: readonly TipoOperacion[]
  /** Ranura de la explicación fiscal (literal del manual): `{{TEXTO-MANUAL}}`. */
  readonly explicacion: typeof MARCADOR_TEXTO
  /** Ranura de la fecha de criterio de la calificación (literal del manual). */
  readonly fechaCriterio: typeof MARCADOR_TEXTO
}

/**
 * CONCEPTOS_FISCALES — los cinco cajones, con sus tipos y sus ranuras de texto manual.
 * Las etiquetas son estructurales; toda calificación fiscal queda en `{{TEXTO-MANUAL}}`.
 */
export const CONCEPTOS_FISCALES: Readonly<Record<ConceptoFiscal, DefinicionConcepto>> = {
  ahorro: {
    clave: 'ahorro',
    etiqueta: 'Ganancias y pérdidas por transmisión',
    baseImponible: 'Base imponible del ahorro',
    tipos: ['VENTA', 'PERMUTA', 'PAGO'],
    explicacion: MARCADOR_TEXTO,
    fechaCriterio: MARCADOR_TEXTO,
  },
  rcm: {
    clave: 'rcm',
    etiqueta: 'Rendimientos del capital mobiliario',
    baseImponible: 'Base imponible del ahorro',
    tipos: ['RENDIMIENTO'],
    explicacion: MARCADOR_TEXTO,
    fechaCriterio: MARCADOR_TEXTO,
  },
  'actividad-economica': {
    clave: 'actividad-economica',
    etiqueta: 'Actividad económica (minería)',
    baseImponible: 'Base imponible general',
    tipos: ['MINERIA'],
    explicacion: MARCADOR_TEXTO,
    fechaCriterio: MARCADOR_TEXTO,
  },
  'base-general': {
    clave: 'base-general',
    etiqueta: 'Ganancias no derivadas de transmisión (airdrops)',
    baseImponible: 'Base imponible general',
    tipos: ['AIRDROP'],
    explicacion: MARCADOR_TEXTO,
    fechaCriterio: MARCADOR_TEXTO,
  },
  perdidas: {
    clave: 'perdidas',
    etiqueta: 'Pérdidas (robo, estafa, extravío)',
    baseImponible: 'Condicionada a requisitos y prueba',
    tipos: ['PERDIDA'],
    explicacion: MARCADOR_TEXTO,
    fechaCriterio: MARCADOR_TEXTO,
  },
}

/** Una ranura de texto fiscal por rellenar (para docs/PENDIENTE_TEXTOS.md y la UI). */
export interface RanuraTextoManual {
  /** Clave estable (aparece en docs/PENDIENTE_TEXTOS.md). */
  readonly clave: string
  /** Dónde aparece el texto en la app (para que el responsable lo ubique). */
  readonly ubicacion: string
}

/**
 * RANURAS_TEXTO_MANUAL — inventario de todos los `{{TEXTO-MANUAL}}` del módulo fiscal. El
 * grep del criterio de aceptación se apoya en el marcador; este catálogo alimenta el
 * documento de pendientes (docs/PENDIENTE_TEXTOS.md) para el relleno del responsable.
 */
export const RANURAS_TEXTO_MANUAL: readonly RanuraTextoManual[] = [
  ...(Object.values(CONCEPTOS_FISCALES).flatMap((c) => [
    { clave: `${c.clave}.explicacion`, ubicacion: `Cajón «${c.etiqueta}» — explicación fiscal` },
    { clave: `${c.clave}.fecha-criterio`, ubicacion: `Cajón «${c.etiqueta}» — fecha de criterio` },
  ]) as RanuraTextoManual[]),
  { clave: 'aviso-721', ubicacion: 'Aviso informativo del modelo 721 (saldos en el extranjero)' },
  { clave: 'nota-172-173', ubicacion: 'Nota informativa de los modelos 172/173' },
]

// ────────────────────────────────────────────────────────────────────────────
// 1. Estructuras del resumen
// ────────────────────────────────────────────────────────────────────────────

/** Detalle de una transmisión onerosa para el cajón del ahorro (una línea del desglose). */
export interface DetalleTransmision {
  apunteId: IdApunte
  tipo: TipoOperacion
  activo: SimboloActivo
  fechaHora: string
  cantidad: string
  /** Valor de transmisión neto en EUR (contravalor − comisión EUR). */
  valorTransmisionNetoEUR: string
  /** Coste de adquisición imputado por FIFO. */
  costeFifoEUR: string
  /** Resultado = valor neto − coste FIFO (positivo = ganancia; negativo = pérdida). */
  resultadoEUR: string
  ganancia: boolean
  /** true si el FIFO no tenía lotes suficientes (resultado inflado; aviso). */
  saldoFifoInsuficiente?: boolean
}

/** Cajón del ahorro: transmisiones onerosas con su neto. */
export interface BloqueAhorro {
  operaciones: DetalleTransmision[]
  /** Suma de los resultados positivos (ganancias). */
  gananciasEUR: string
  /** Suma de los resultados negativos (pérdidas de transmisión onerosa; signo negativo). */
  perdidasEUR: string
  /** Neto = ganancias + pérdidas (signed). */
  netoEUR: string
}

/** Una partida de ingreso (RCM / actividad económica / base general) a contravalor del día. */
export interface PartidaIngreso {
  apunteId: IdApunte
  tipo: TipoOperacion
  activo: SimboloActivo
  fechaHora: string
  cantidad: string
  /** Contravalor en EUR a la fecha del apunte (valor de mercado declarado). */
  importeEUR: string
  /** true si el apunte no traía contravalor (importe tomado como 0; revisar). */
  sinContravalor: boolean
}

/** Cajón de ingresos (RCM, actividad económica o base general). */
export interface BloqueIngresos {
  partidas: PartidaIngreso[]
  totalEUR: string
  /** true si alguna partida no tenía contravalor. */
  hayIncompletas: boolean
}

/** Una pérdida (PÉRDIDA) con su estado probatorio del Archivo. */
export interface PerdidaFiscal {
  apunteId: IdApunte
  activo: SimboloActivo
  fechaHora: string
  cantidad: string
  costeFifoEUR: string
  valorTransmisionNetoEUR: string
  /** Resultado (negativo: la minoración potencial si se admitiera). */
  resultadoEUR: string
  /** Estado probatorio del apunte en el Archivo (completo / incompleto / sin justificar). */
  estadoProbatorio: EstadoProbatorio
  /** Requisitos probatorios aún sin cubrir. */
  faltantes: RequisitoProbatorio[]
}

/** Cajón de pérdidas: listado con estado probatorio y deducibilidad condicionada. */
export interface BloquePerdidas {
  items: PerdidaFiscal[]
  /** Suma de los resultados (negativo). Importe POTENCIAL, no admitido sin más. */
  totalEUR: string
  /** true si alguna pérdida no tiene el expediente probatorio completo. */
  hayIncompletas: boolean
}

/** Celda de saldo en una ubicación radicada en el extranjero (para el aviso 721). */
export interface SaldoExtranjeroCelda {
  ubicacion: RefUbicacion
  nombre: string
  pais?: string
  activo: SimboloActivo
  saldo: string
  /** Valor en EUR (EUR = saldo; cripto = saldo × precio de cierre si se aportó). */
  valorEUR: string | null
  /** true si no se pudo valorar (cripto sin precio de cierre aportado). */
  sinValorar: boolean
}

/** Aviso informativo del modelo 721 (nunca cálculo de obligación). */
export interface AvisoSaldoExtranjero {
  /** true si hay ubicaciones marcadas como extranjeras con saldo distinto de cero. */
  aplica: boolean
  /** true si el total valorado supera el umbral (aviso, no obligación). */
  supera: boolean
  umbralEUR: number
  /** Total valorado en EUR (solo las celdas valoradas). */
  totalValoradoEUR: string
  celdas: SaldoExtranjeroCelda[]
  /** true si alguna celda de cripto quedó sin valorar (el total es un mínimo). */
  haySinValorar: boolean
}

/** Resumen fiscal orientativo de un ejercicio. */
export interface ResumenFiscal {
  ejercicio: number
  ahorro: BloqueAhorro
  rcm: BloqueIngresos
  actividadEconomica: BloqueIngresos
  baseGeneral: BloqueIngresos
  perdidas: BloquePerdidas
  avisoExtranjero: AvisoSaldoExtranjero
}

/** Opciones del cálculo fiscal. */
export interface OpcionesFiscal {
  /**
   * Precios de cierre a 31/12 (EUR por unidad de cada activo) para valorar los saldos en el
   * extranjero (aviso 721). EUR vale 1 implícitamente. Sin precio, la cripto queda «sin
   * valorar» y el total del aviso es un mínimo. Local-first: los teclea el alumno.
   */
  valoracionCierre?: Readonly<Record<SimboloActivo, string>>
  /** Umbral del aviso 721 (por defecto 50.000 €). */
  umbralExtranjeroEUR?: number
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Utilidades
// ────────────────────────────────────────────────────────────────────────────

/** Ejercicio (año) de una fecha ISO local. */
function ejercicioDe(fechaHora: string): number {
  return Number(fechaHora.slice(0, 4))
}

/** Fecha de corte del cierre del ejercicio (31/12 23:59:59). */
export function corteEjercicio(ejercicio: number): string {
  return `${ejercicio}-12-31T23:59:59`
}

/**
 * Ejercicios (años) con algún apunte en el diario, de más reciente a más antiguo (para el
 * selector de año de la página FISCAL).
 */
export function ejerciciosConDatos(apuntes: readonly Apunte[]): number[] {
  const set = new Set<number>()
  for (const ap of apuntes) set.add(ejercicioDe(ap.fechaHora))
  return [...set].sort((a, b) => b - a)
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Cálculo de los cajones
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cajón del ahorro: transmisiones onerosas (VENTA, PERMUTA entregada, PAGO) del ejercicio,
 * con su neto. La PÉRDIDA (robo/estafa) se excluye: va a su propio cajón (deducibilidad
 * condicionada). Reconcilia con `transmisionesDelDiario`.
 */
function calcularAhorro(
  transmisiones: ReturnType<typeof transmisionesDelDiario>,
  tipoPorApunte: ReadonlyMap<IdApunte, TipoOperacion>,
  ejercicio: number,
): BloqueAhorro {
  const tiposAhorro = new Set<TipoOperacion>(CONCEPTOS_FISCALES.ahorro.tipos)
  const operaciones: DetalleTransmision[] = []
  let ganancias = CERO
  let perdidas = CERO

  for (const t of transmisiones) {
    if (t.ejercicio !== ejercicio) continue
    const tipo = tipoPorApunte.get(t.apunteId)
    if (!tipo || !tiposAhorro.has(tipo)) continue
    const resultado = D(t.resultadoEUR)
    const ganancia = resultado.greaterThanOrEqualTo(0)
    if (ganancia) ganancias = ganancias.plus(resultado)
    else perdidas = perdidas.plus(resultado)
    operaciones.push({
      apunteId: t.apunteId,
      tipo,
      activo: t.activo,
      fechaHora: t.fechaHora,
      cantidad: t.cantidad,
      valorTransmisionNetoEUR: t.valorTransmisionNetoEUR,
      costeFifoEUR: t.costeFifoEUR,
      resultadoEUR: t.resultadoEUR,
      ganancia,
      ...(t.saldoFifoInsuficiente ? { saldoFifoInsuficiente: true } : {}),
    })
  }

  operaciones.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  return {
    operaciones,
    gananciasEUR: aCadena(ganancias),
    perdidasEUR: aCadena(perdidas),
    netoEUR: aCadena(ganancias.plus(perdidas)),
  }
}

/**
 * Cajón de ingresos (RCM / actividad económica / base general): suma el contravalor EUR de
 * los apuntes del ejercicio cuyo tipo alimenta el concepto.
 */
function calcularIngresos(
  apuntes: readonly Apunte[],
  ejercicio: number,
  tipos: readonly TipoOperacion[],
): BloqueIngresos {
  const acepta = new Set<TipoOperacion>(tipos)
  const partidas: PartidaIngreso[] = []
  let total = CERO
  let hayIncompletas = false

  for (const ap of apuntes) {
    if (!acepta.has(ap.tipo) || ejercicioDe(ap.fechaHora) !== ejercicio) continue
    const sinContravalor = !ap.contravalorEUR || ap.contravalorEUR === ''
    if (sinContravalor) hayIncompletas = true
    const importe = D(ap.contravalorEUR)
    total = total.plus(importe)
    partidas.push({
      apunteId: ap.id,
      tipo: ap.tipo,
      activo: ap.activoEntrada ?? '',
      fechaHora: ap.fechaHora,
      cantidad: ap.cantidadEntrada ?? '',
      importeEUR: aCadena(importe),
      sinContravalor,
    })
  }

  partidas.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  return { partidas, totalEUR: aCadena(total), hayIncompletas }
}

/**
 * Cajón de pérdidas: las transmisiones de tipo PÉRDIDA del ejercicio, con el estado
 * probatorio del Archivo de cada una. Se listan aparte; su deducibilidad está condicionada.
 */
function calcularPerdidas(
  transmisiones: ReturnType<typeof transmisionesDelDiario>,
  apuntePorId: ReadonlyMap<IdApunte, Apunte>,
  justPorApunte: ReadonlyMap<IdApunte, Justificante[]>,
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
  ejercicio: number,
): BloquePerdidas {
  const items: PerdidaFiscal[] = []
  let total = CERO
  let hayIncompletas = false

  for (const t of transmisiones) {
    if (t.ejercicio !== ejercicio) continue
    const ap = apuntePorId.get(t.apunteId)
    if (!ap || ap.tipo !== 'PERDIDA') continue
    const prob = estadoProbatorioApunte(ap, justPorApunte.get(ap.id) ?? [], kycPorUbicacion)
    if (prob.estado !== 'completo') hayIncompletas = true
    total = total.plus(D(t.resultadoEUR))
    items.push({
      apunteId: t.apunteId,
      activo: t.activo,
      fechaHora: t.fechaHora,
      cantidad: t.cantidad,
      costeFifoEUR: t.costeFifoEUR,
      valorTransmisionNetoEUR: t.valorTransmisionNetoEUR,
      resultadoEUR: t.resultadoEUR,
      estadoProbatorio: prob.estado,
      faltantes: prob.faltantes,
    })
  }

  items.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  return { items, totalEUR: aCadena(total), hayIncompletas }
}

/**
 * Aviso informativo del modelo 721: valora en EUR los saldos a 31/12 de las ubicaciones
 * marcadas como extranjeras y avisa si superan el umbral. Nunca calcula obligación.
 */
function calcularAvisoExtranjero(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  ejercicio: number,
  opciones: OpcionesFiscal,
): AvisoSaldoExtranjero {
  const umbral = opciones.umbralExtranjeroEUR ?? UMBRAL_721_EUR
  const valoracion = opciones.valoracionCierre ?? {}
  const extranjeras = new Map<RefUbicacion, Ubicacion>()
  for (const u of ubicaciones) if (u.extranjero) extranjeras.set(u.id, u)

  const saldos = calcularSaldos([...apuntes], corteEjercicio(ejercicio))
  const celdas: SaldoExtranjeroCelda[] = []
  let total = CERO
  let haySinValorar = false

  for (const s of saldos) {
    const ubic = extranjeras.get(s.ubicacion)
    if (!ubic) continue
    if (D(s.saldo).isZero()) continue

    let valorEUR: string | null
    let sinValorar = false
    if (s.activo === 'EUR') {
      valorEUR = s.saldo
    } else {
      const precio = valoracion[s.activo]
      if (precio !== undefined && precio !== '') {
        valorEUR = aCadena(D(s.saldo).times(D(precio)))
      } else {
        valorEUR = null
        sinValorar = true
        haySinValorar = true
      }
    }
    if (valorEUR !== null) total = total.plus(D(valorEUR))
    celdas.push({
      ubicacion: s.ubicacion,
      nombre: ubic.nombre,
      ...(ubic.pais ? { pais: ubic.pais } : {}),
      activo: s.activo,
      saldo: s.saldo,
      valorEUR,
      sinValorar,
    })
  }

  celdas.sort(
    (a, b) => a.nombre.localeCompare(b.nombre) || a.activo.localeCompare(b.activo),
  )
  return {
    aplica: celdas.length > 0,
    supera: total.greaterThan(umbral),
    umbralEUR: umbral,
    totalValoradoEUR: aCadena(total),
    celdas,
    haySinValorar,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Resumen fiscal del ejercicio (entrada principal)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el resumen fiscal ORIENTATIVO de un ejercicio. Determinista. Reparte las
 * transmisiones y los ingresos del FIFO en los cinco cajones y adjunta el estado probatorio
 * de las pérdidas y el aviso 721. Todas las cifras reconcilian con los golden del FIFO.
 *
 * @param apuntes  diario de dominio en orden cronológico (correlativo como `id`)
 * @param ubicaciones  catálogo de ubicaciones (KYC + marca de extranjero)
 * @param justificantes  justificantes de dominio (enlazados por correlativo `apunteId`)
 * @param ejercicio  año fiscal
 * @param opciones  valoración de cierre y umbral del aviso 721
 */
export function calcularResumenFiscal(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  justificantes: readonly Justificante[],
  ejercicio: number,
  opciones: OpcionesFiscal = {},
): ResumenFiscal {
  const transmisiones = transmisionesDelDiario([...apuntes])
  const tipoPorApunte = new Map<IdApunte, TipoOperacion>(apuntes.map((a) => [a.id, a.tipo]))
  const apuntePorId = new Map<IdApunte, Apunte>(apuntes.map((a) => [a.id, a]))
  const justPorApunte = agruparPorApunte(justificantes)
  const kyc = mapaKyc(ubicaciones)

  return {
    ejercicio,
    ahorro: calcularAhorro(transmisiones, tipoPorApunte, ejercicio),
    rcm: calcularIngresos(apuntes, ejercicio, CONCEPTOS_FISCALES.rcm.tipos),
    actividadEconomica: calcularIngresos(
      apuntes,
      ejercicio,
      CONCEPTOS_FISCALES['actividad-economica'].tipos,
    ),
    baseGeneral: calcularIngresos(apuntes, ejercicio, CONCEPTOS_FISCALES['base-general'].tipos),
    perdidas: calcularPerdidas(transmisiones, apuntePorId, justPorApunte, kyc, ejercicio),
    avisoExtranjero: calcularAvisoExtranjero(apuntes, ubicaciones, ejercicio, opciones),
  }
}
