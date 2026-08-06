/**
 * archivo.ts — El Archivo (expediente probatorio). Motor puro del Bloque 1.
 *
 * La tesis del Bloque 1 del taller es «¿cómo lo demuestro?». Este módulo materializa
 * esa pregunta en datos y funciones deterministas: la CHECKLIST probatoria por tipo de
 * operación, el cálculo del ESTADO probatorio de un apunte (completo / incompleto / sin
 * justificar), la detección de HUÉRFANOS (justificantes sin apunte y apuntes sin
 * justificante) y el INFORME de completitud por ejercicio con los huecos priorizados.
 *
 * TypeScript puro y determinista (estado → resultado). Regla de oro 4: sin React, sin
 * Dexie, sin browser APIs. El hash SHA-256, los Blob y la persistencia viven en la capa
 * de datos/UI. Aquí solo dominio.
 *
 * Regla de oro 5 (textos fiscales/probatorios): los textos de la checklist son de
 * partida y llevan marcador `TODO-REVISION` para que el responsable del taller los fije
 * literalmente contra los manuales. NO son calificaciones fiscales inventadas: describen
 * qué documento aporta la prueba, que es criterio metodológico del Bloque 1.
 */

import type {
  Apunte,
  IdApunte,
  Justificante,
  RefUbicacion,
  RutaConvencional,
  TipoOperacion,
  Ubicacion,
} from './types'
import { UBICACION_EXTERIOR } from './types'

// ────────────────────────────────────────────────────────────────────────────
// 1. Carpetas convencionales del expediente
// ────────────────────────────────────────────────────────────────────────────

/** Carpetas convencionales del Archivo, en orden de expediente, con etiqueta legible. */
export const CARPETAS_ARCHIVO: readonly { ruta: RutaConvencional; etiqueta: string }[] = [
  { ruta: '01-adquisiciones', etiqueta: 'Adquisiciones' },
  { ruta: '02-transferencias', etiqueta: 'Transferencias' },
  { ruta: '03-transmisiones', etiqueta: 'Transmisiones' },
  { ruta: '04-rendimientos', etiqueta: 'Rendimientos' },
  { ruta: '05-perdidas', etiqueta: 'Pérdidas' },
  { ruta: '06-donaciones', etiqueta: 'Donaciones' },
  { ruta: '07-ajustes', etiqueta: 'Ajustes' },
  { ruta: '99-otros', etiqueta: 'Otros' },
]

/** Etiqueta legible de una carpeta convencional. */
export const ETIQUETA_CARPETA: Readonly<Record<RutaConvencional, string>> = Object.freeze(
  Object.fromEntries(CARPETAS_ARCHIVO.map((c) => [c.ruta, c.etiqueta])) as Record<
    RutaConvencional,
    string
  >,
)

/**
 * Carpeta convencional por defecto para un tipo de operación. Es una SUGERENCIA para el
 * formulario: el alumno puede archivar un justificante en otra carpeta. TODO-REVISION:
 * confirmar la taxonomía con el responsable del taller (p. ej. si AIRDROP va a
 * adquisiciones o a rendimientos).
 */
export const RUTA_POR_TIPO: Readonly<Record<TipoOperacion, RutaConvencional>> = {
  COMPRA: '01-adquisiciones',
  VENTA: '03-transmisiones',
  PERMUTA: '03-transmisiones',
  TRANSFERENCIA: '02-transferencias',
  RENDIMIENTO: '04-rendimientos',
  MINERIA: '04-rendimientos',
  AIRDROP: '04-rendimientos',
  PAGO: '03-transmisiones',
  PERDIDA: '05-perdidas',
  DONACION: '06-donaciones',
  AJUSTE: '07-ajustes',
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Checklist probatoria por tipo (TODO-REVISION en cada texto)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un requisito documental de la checklist. `clave` es el identificador estable que casa
 * con `Justificante.tipoDocumento` (el formulario ofrece estas claves): así el motor sabe
 * qué requisito cubre cada justificante sin depender de texto libre.
 */
export interface RequisitoProbatorio {
  /** Identificador estable del documento (casa con `tipoDocumento`). */
  readonly clave: string
  /** Nombre del documento a aportar (TODO-REVISION: fijar literal del manual). */
  readonly documento: string
  /** Aclaración de qué prueba y por qué (TODO-REVISION). */
  readonly detalle: string
  /** El requisito solo aplica si la adquisición fue en ubicación CON KYC. */
  readonly soloKyc?: boolean
  /** El requisito solo aplica si la adquisición fue en ubicación SIN KYC (P2P, etc.). */
  readonly soloNoKyc?: boolean
}

/** Checklist probatoria de un tipo de operación. */
export interface ChecklistTipo {
  readonly tipo: TipoOperacion
  /** «¿Cómo lo demuestro?» en una línea (tesis del Bloque 1). */
  readonly tesis: string
  /**
   * Nivel de exigencia probatoria (1..5). Ordena los huecos del informe: 5 = máxima
   * (PÉRDIDA), 4 = alta (DONACIÓN). TODO-REVISION: calibrar con el responsable.
   */
  readonly exigencia: number
  readonly requisitos: readonly RequisitoProbatorio[]
}

/**
 * CHECKLIST_PROBATORIA — qué documentos exige el manual para cada tipo. Textos DE PARTIDA
 * (TODO-REVISION): el responsable del taller los fijará literalmente. Clave metodológica
 * en PÉRDIDA (denuncia + expediente) y en adquisiciones no-KYC (pago + anuncio + txid).
 */
export const CHECKLIST_PROBATORIA: Readonly<Record<TipoOperacion, ChecklistTipo>> = {
  COMPRA: {
    tipo: 'COMPRA',
    tesis: '¿De dónde salió el euro y a qué precio compré?',
    exigencia: 3,
    requisitos: [
      {
        clave: 'orden-ejecucion',
        documento: 'Orden de compra / justificante de ejecución',
        detalle: 'TODO-REVISION: orden ejecutada del exchange KYC (fecha, cantidad, precio, comisión).',
        soloKyc: true,
      },
      {
        clave: 'extracto-exchange',
        documento: 'Extracto o histórico del exchange',
        detalle: 'TODO-REVISION: extracto que muestre el cargo en EUR y el abono en cripto.',
        soloKyc: true,
      },
      {
        clave: 'justificante-pago',
        documento: 'Justificante de pago (transferencia / Bizum)',
        detalle: 'TODO-REVISION: prueba del pago al vendedor en operación no-KYC (P2P).',
        soloNoKyc: true,
      },
      {
        clave: 'captura-anuncio',
        documento: 'Captura del anuncio / acuerdo P2P',
        detalle: 'TODO-REVISION: anuncio o chat con las condiciones acordadas (precio, cantidad).',
        soloNoKyc: true,
      },
      {
        clave: 'txid-entrada',
        documento: 'txid / hash de la transacción on-chain',
        detalle: 'TODO-REVISION: identificador de la transacción que acredita la recepción de la cripto.',
        soloNoKyc: true,
      },
    ],
  },
  VENTA: {
    tipo: 'VENTA',
    tesis: '¿A qué precio vendí y qué comisión pagué?',
    exigencia: 3,
    requisitos: [
      {
        clave: 'orden-ejecucion',
        documento: 'Orden de venta / justificante de ejecución',
        detalle: 'TODO-REVISION: orden ejecutada con cantidad, precio y comisión.',
      },
      {
        clave: 'extracto-exchange',
        documento: 'Extracto del exchange / abono de fiat',
        detalle: 'TODO-REVISION: extracto que muestre el abono en EUR de la venta.',
      },
    ],
  },
  PERMUTA: {
    tipo: 'PERMUTA',
    tesis: '¿Qué entregué, qué recibí y a qué valor de mercado?',
    exigencia: 3,
    requisitos: [
      {
        clave: 'orden-permuta',
        documento: 'Orden / comprobante de la permuta (swap)',
        detalle: 'TODO-REVISION: comprobante del intercambio cripto-cripto con ambas patas.',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle: 'TODO-REVISION: cotización de referencia a la fecha (fuente y captura) del activo permutado.',
      },
      {
        clave: 'txid-permuta',
        documento: 'txid / hash de la operación',
        detalle: 'TODO-REVISION: identificador on-chain o de la DEX que acredita el swap.',
      },
    ],
  },
  TRANSFERENCIA: {
    tipo: 'TRANSFERENCIA',
    tesis: '¿Cómo pruebo que origen y destino son míos (no es una venta)?',
    exigencia: 1,
    requisitos: [
      {
        clave: 'txid-transferencia',
        documento: 'txid / hash del envío',
        detalle: 'TODO-REVISION: identificador on-chain del movimiento entre ubicaciones propias.',
      },
      {
        clave: 'titularidad-destino',
        documento: 'Prueba de titularidad de la ubicación destino',
        detalle: 'TODO-REVISION: captura de la dirección/wallet propia de destino.',
      },
    ],
  },
  RENDIMIENTO: {
    tipo: 'RENDIMIENTO',
    tesis: '¿Qué generó el rendimiento y a qué valor entró (RCM)?',
    exigencia: 2,
    requisitos: [
      {
        clave: 'liquidacion-rendimiento',
        documento: 'Liquidación / histórico de recompensas',
        detalle: 'TODO-REVISION: extracto de staking/lending con fecha, cantidad y activo.',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle: 'TODO-REVISION: cotización a la fecha de cada abono (RCM art. 25.2 LIRPF).',
      },
    ],
  },
  MINERIA: {
    tipo: 'MINERIA',
    tesis: '¿Qué acredita la actividad de minería y su valor?',
    exigencia: 2,
    requisitos: [
      {
        clave: 'liquidacion-pool',
        documento: 'Liquidación del pool / recompensas de bloque',
        detalle: 'TODO-REVISION: histórico de payouts del pool con fecha y cantidad.',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle: 'TODO-REVISION: cotización a la fecha del abono (rendimiento de actividad económica).',
      },
    ],
  },
  AIRDROP: {
    tipo: 'AIRDROP',
    tesis: '¿De qué airdrop procede y a qué valor entró?',
    exigencia: 2,
    requisitos: [
      {
        clave: 'prueba-recepcion',
        documento: 'Prueba de la recepción del airdrop',
        detalle: 'TODO-REVISION: txid o captura de la recepción y de la campaña del airdrop.',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle: 'TODO-REVISION: cotización del token a la fecha de recepción (ganancia base general).',
      },
    ],
  },
  PAGO: {
    tipo: 'PAGO',
    tesis: '¿Qué pagué (factura) y con qué transmisión de cripto?',
    exigencia: 3,
    requisitos: [
      {
        clave: 'factura-recibo',
        documento: 'Factura o recibo del bien/servicio pagado',
        detalle: 'TODO-REVISION: documento que fija el precio (valor de transmisión).',
      },
      {
        clave: 'txid-pago',
        documento: 'txid / hash del pago',
        detalle: 'TODO-REVISION: identificador on-chain del pago en cripto.',
      },
    ],
  },
  PERDIDA: {
    tipo: 'PERDIDA',
    tesis: '¿Cómo pruebo la pérdida y que no fue una venta encubierta?',
    exigencia: 5,
    requisitos: [
      {
        clave: 'denuncia',
        documento: 'Denuncia ante policía / juzgado',
        detalle: 'TODO-REVISION: denuncia del robo, estafa o pérdida (imprescindible según la dualidad DGT).',
      },
      {
        clave: 'expediente-atestado',
        documento: 'Expediente / atestado / resolución',
        detalle: 'TODO-REVISION: actuaciones posteriores que sostienen la efectividad de la pérdida.',
      },
      {
        clave: 'txid-perdida',
        documento: 'txid del movimiento no autorizado',
        detalle: 'TODO-REVISION: identificador on-chain de la salida de los fondos.',
      },
    ],
  },
  DONACION: {
    tipo: 'DONACION',
    tesis: '¿Qué acredita la donación y su tributación (ISD)?',
    exigencia: 4,
    requisitos: [
      {
        clave: 'documento-donacion',
        documento: 'Documento de la donación (contrato / escritura)',
        detalle: 'TODO-REVISION: documento que acredita la transmisión lucrativa y las partes.',
      },
      {
        clave: 'liquidacion-isd',
        documento: 'Liquidación del ISD (donatario)',
        detalle: 'TODO-REVISION: modelo del Impuesto sobre Sucesiones y Donaciones cuando proceda.',
      },
      {
        clave: 'txid-donacion',
        documento: 'txid / hash de la transferencia',
        detalle: 'TODO-REVISION: identificador on-chain de la entrega de la cripto.',
      },
    ],
  },
  AJUSTE: {
    tipo: 'AJUSTE',
    tesis: '¿Qué error corrijo y con qué soporte auditable?',
    exigencia: 2,
    requisitos: [
      {
        clave: 'soporte-correccion',
        documento: 'Soporte de la corrección',
        detalle: 'TODO-REVISION: documento o cálculo que justifica la rectificación (principio 7, U7.4).',
      },
    ],
  },
}

// ────────────────────────────────────────────────────────────────────────────
// 3. KYC relevante y requisitos aplicables
// ────────────────────────────────────────────────────────────────────────────

/**
 * ¿La ubicación relevante del apunte está sujeta a KYC? Para adquisiciones (donde entra
 * la cripto) la ubicación relevante es el DESTINO; en su defecto, el ORIGEN. Si la
 * ubicación relevante es EXTERIOR o se desconoce, se asume SIN KYC (criterio prudente:
 * exige más prueba, que es lo deseable en la duda).
 */
export function ubicacionRelevanteConKyc(
  apunte: Pick<Apunte, 'ubicacionOrigen' | 'ubicacionDestino'>,
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
): boolean {
  const candidatas: RefUbicacion[] = [apunte.ubicacionDestino, apunte.ubicacionOrigen]
  for (const ref of candidatas) {
    if (ref && ref !== UBICACION_EXTERIOR && kycPorUbicacion.has(ref)) {
      return kycPorUbicacion.get(ref) ?? false
    }
  }
  return false
}

/** Construye el mapa ubicación→KYC a partir del catálogo de ubicaciones. */
export function mapaKyc(ubicaciones: readonly Ubicacion[]): Map<RefUbicacion, boolean> {
  return new Map(ubicaciones.map((u) => [u.id, u.kyc]))
}

/**
 * Requisitos aplicables a un tipo de operación según el KYC de su ubicación relevante.
 * Filtra las ramas `soloKyc` / `soloNoKyc` (p. ej. una COMPRA en exchange KYC pide orden
 * + extracto; una no-KYC pide pago + anuncio + txid).
 */
export function requisitosAplicables(
  tipo: TipoOperacion,
  conKyc: boolean,
): RequisitoProbatorio[] {
  return CHECKLIST_PROBATORIA[tipo].requisitos.filter((r) => {
    if (r.soloKyc && !conKyc) return false
    if (r.soloNoKyc && conKyc) return false
    return true
  })
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Estado probatorio de un apunte
// ────────────────────────────────────────────────────────────────────────────

/** Estado probatorio de un apunte frente a su checklist. */
export type EstadoProbatorio = 'completo' | 'incompleto' | 'sin-justificar'

/** Resultado del cálculo del estado probatorio de un apunte. */
export interface ResultadoProbatorio {
  apunteId: IdApunte
  tipo: TipoOperacion
  estado: EstadoProbatorio
  /** ¿La ubicación relevante era KYC? (determina qué rama de la checklist aplica). */
  conKyc: boolean
  /** Requisitos aplicables (tras filtrar por KYC). */
  requisitos: RequisitoProbatorio[]
  /** Claves de requisito ya cubiertas por algún justificante. */
  cubiertos: string[]
  /** Requisitos aún sin cubrir. */
  faltantes: RequisitoProbatorio[]
  /** Nº de justificantes ligados al apunte (cubran requisito o no). */
  nJustificantes: number
}

/**
 * Calcula el estado probatorio de un apunte dados SUS justificantes (ya filtrados a los
 * de ese apunte). Un justificante cubre un requisito si su `tipoDocumento` coincide con
 * la `clave` del requisito. Reglas:
 *   - 0 justificantes                     → «sin-justificar»
 *   - todos los requisitos cubiertos      → «completo»
 *   - hay justificantes pero faltan reqs. → «incompleto»
 */
export function estadoProbatorioApunte(
  apunte: Apunte,
  justificantesDelApunte: readonly Justificante[],
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
): ResultadoProbatorio {
  const conKyc = ubicacionRelevanteConKyc(apunte, kycPorUbicacion)
  const requisitos = requisitosAplicables(apunte.tipo, conKyc)
  const claves = new Set(justificantesDelApunte.map((j) => j.tipoDocumento))
  const cubiertos = requisitos.filter((r) => claves.has(r.clave)).map((r) => r.clave)
  const faltantes = requisitos.filter((r) => !claves.has(r.clave))

  let estado: EstadoProbatorio
  if (justificantesDelApunte.length === 0) estado = 'sin-justificar'
  else if (faltantes.length === 0) estado = 'completo'
  else estado = 'incompleto'

  return {
    apunteId: apunte.id,
    tipo: apunte.tipo,
    estado,
    conKyc,
    requisitos,
    cubiertos,
    faltantes,
    nJustificantes: justificantesDelApunte.length,
  }
}

/** Agrupa justificantes por `apunteId` (para no recorrer la lista por cada apunte). */
export function agruparPorApunte(
  justificantes: readonly Justificante[],
): Map<IdApunte, Justificante[]> {
  const mapa = new Map<IdApunte, Justificante[]>()
  for (const j of justificantes) {
    const lista = mapa.get(j.apunteId)
    if (lista) lista.push(j)
    else mapa.set(j.apunteId, [j])
  }
  return mapa
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Huérfanos (justificantes sin apunte · apuntes sin justificante)
// ────────────────────────────────────────────────────────────────────────────

/** Resultado de la detección de huérfanos del Archivo. */
export interface Huerfanos {
  /** Justificantes cuyo `apunteId` ya no existe en el diario. */
  justificantesSinApunte: Justificante[]
  /** Apuntes sin ningún justificante ligado. */
  apuntesSinJustificante: Apunte[]
}

/** Detecta justificantes sin apunte y apuntes sin justificante. */
export function detectarHuerfanos(
  apuntes: readonly Apunte[],
  justificantes: readonly Justificante[],
): Huerfanos {
  const idsApunte = new Set(apuntes.map((a) => a.id))
  const apuntesConJustificante = new Set(justificantes.map((j) => j.apunteId))
  return {
    justificantesSinApunte: justificantes.filter((j) => !idsApunte.has(j.apunteId)),
    apuntesSinJustificante: apuntes.filter((a) => !apuntesConJustificante.has(a.id)),
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Informe de completitud probatoria por ejercicio
// ────────────────────────────────────────────────────────────────────────────

/** Un hueco probatorio: un apunte incompleto o sin justificar, con su prioridad. */
export interface HuecoProbatorio {
  apunte: Apunte
  estado: EstadoProbatorio
  /** Prioridad efectiva = exigencia del tipo + refuerzo si la adquisición es no-KYC. */
  prioridad: number
  faltantes: RequisitoProbatorio[]
}

/** Informe de completitud probatoria (por ejercicio o global). */
export interface InformeCompletitud {
  /** Ejercicio (año) del informe; ausente = todo el diario. */
  ejercicio?: number
  total: number
  completos: number
  incompletos: number
  sinJustificar: number
  /** % de apuntes con expediente completo (0..100, redondeado a 1 decimal). */
  porcentajeCompleto: number
  /** Huecos priorizados: PÉRDIDA, DONACIÓN y no-KYC primero; luego por fecha. */
  huecos: HuecoProbatorio[]
}

/** Refuerzo de prioridad de una adquisición no-KYC (los huecos más sensibles). */
const REFUERZO_NO_KYC = 0.5

/** ¿El apunte es una adquisición (abre lote)? (COMPRA, PERMUTA, RENDIMIENTO, MINERÍA, AIRDROP.) */
function esAdquisicion(tipo: TipoOperacion): boolean {
  return (
    tipo === 'COMPRA' ||
    tipo === 'PERMUTA' ||
    tipo === 'RENDIMIENTO' ||
    tipo === 'MINERIA' ||
    tipo === 'AIRDROP'
  )
}

/**
 * Informe de completitud probatoria. Recorre los apuntes (opcionalmente filtrados por
 * ejercicio), calcula su estado y ordena los huecos por prioridad decreciente: los tipos
 * de mayor exigencia (PÉRDIDA 5, DONACIÓN 4) primero, con refuerzo para las adquisiciones
 * no-KYC, y a igualdad de prioridad, por fecha ascendente (los más antiguos antes).
 */
export function informeCompletitud(
  apuntes: readonly Apunte[],
  justificantes: readonly Justificante[],
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
  ejercicio?: number,
): InformeCompletitud {
  const delEjercicio =
    ejercicio === undefined
      ? apuntes
      : apuntes.filter((a) => Number(a.fechaHora.slice(0, 4)) === ejercicio)

  const porApunte = agruparPorApunte(justificantes)

  let completos = 0
  let incompletos = 0
  let sinJustificar = 0
  const huecos: HuecoProbatorio[] = []

  for (const ap of delEjercicio) {
    const r = estadoProbatorioApunte(ap, porApunte.get(ap.id) ?? [], kycPorUbicacion)
    if (r.estado === 'completo') {
      completos++
      continue
    }
    if (r.estado === 'incompleto') incompletos++
    else sinJustificar++

    const noKyc = esAdquisicion(ap.tipo) && !r.conKyc
    huecos.push({
      apunte: ap,
      estado: r.estado,
      prioridad: CHECKLIST_PROBATORIA[ap.tipo].exigencia + (noKyc ? REFUERZO_NO_KYC : 0),
      faltantes: r.faltantes,
    })
  }

  huecos.sort((a, b) => {
    if (b.prioridad !== a.prioridad) return b.prioridad - a.prioridad
    return a.apunte.fechaHora.localeCompare(b.apunte.fechaHora)
  })

  const total = delEjercicio.length
  const porcentajeCompleto = total === 0 ? 0 : Math.round((completos / total) * 1000) / 10

  return {
    ...(ejercicio !== undefined ? { ejercicio } : {}),
    total,
    completos,
    incompletos,
    sinJustificar,
    porcentajeCompleto,
    huecos,
  }
}
