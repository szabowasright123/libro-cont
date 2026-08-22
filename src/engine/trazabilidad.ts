/**
 * trazabilidad.ts — El propagador de origen KYC / no-KYC (corazón docente del Bloque 1).
 *
 * Responde a «¿de dónde salió esta cripto y cómo lo demuestro?»: propaga el atributo KYC
 * de la ubicación/vía de adquisición a través de transferencias y permutas, y descompone
 * cada saldo (por ubicación × activo) en la parte de origen KYC y la de origen no-KYC.
 * Sobre esa descomposición construye la cadena probatoria hacia atrás de un saldo elegido
 * (apuntes que lo forman → lotes de origen → justificantes → huecos).
 *
 * CONVENCIÓN DE MEZCLA (documentada y VALIDADA (2026-08-08) en el registro de decisiones del proyecto, D1):
 * es una capa APARTE del motor FIFO oficial (Regla de oro 8: cola única global, sin
 * ubicación). La cola global calcula GyP; la trazabilidad necesita saber en qué ubicación
 * está cada parte, así que mantiene una cola FIFO POR UBICACIÓN de «parcelas», cada una con
 * su origen (KYC/no-KYC) y la cadena de apuntes por los que ha pasado. NO toca fifo.ts ni
 * los golden.
 *
 * TypeScript puro y determinista (estado → resultado). Regla de oro 4: sin React, sin
 * Dexie, sin browser APIs. Exige el diario en orden cronológico (como el motor FIFO).
 */

import {
  type Apunte,
  type IdApunte,
  type Justificante,
  type RefUbicacion,
  type SimboloActivo,
  type Ubicacion,
  UBICACION_EXTERIOR,
  resolverFlags,
} from './types'
import { D, aCadena, CERO, Decimal } from './decimal'
import {
  agruparPorApunte,
  estadoProbatorioApunte,
  mapaKyc,
  type EstadoProbatorio,
  type RequisitoProbatorio,
} from './archivo'

// ────────────────────────────────────────────────────────────────────────────
// 1. Origen (KYC / no-KYC) y catálogo de vías de evidencia (ficha de ubicación)
// ────────────────────────────────────────────────────────────────────────────

/** Origen de una porción de saldo según la vía de adquisición. */
export type Origen = 'KYC' | 'NO_KYC'

/**
 * Vía de evidencia de una ubicación: qué clase de documentación genera de forma natural la
 * vía por la que entran/salen activos. La `cita` es literal de la unidad del manual del taller
 * (Regla de oro 5; validada a 2026-08-06).
 */
export interface ViaEvidencia {
  /** Clave estable (se guarda en `Ubicacion.viaEvidencia`). */
  readonly clave: string
  /** Etiqueta legible para la ficha de ubicación. */
  readonly etiqueta: string
  /** ¿Es una vía típicamente sujeta a KYC? (sugerencia para el alta de la ubicación). */
  readonly kycTipico: boolean
  /** Qué documentación genera esta vía (para la checklist probatoria). */
  readonly documentacion: string
  /** Cita de la unidad del manual del taller (literal, validado a 2026-08-06). */
  readonly cita: string
}

/**
 * VIAS_EVIDENCIA — catálogo de vías de evidencia por ubicación. Cubre las vías canónicas del
 * Bloque 1. Las citas son literales de los manuales del taller (validadas a 2026-08-06, ver
 * docs/TEXTOS_MANUAL_RANURAS.md §6).
 */
export const VIAS_EVIDENCIA: readonly ViaEvidencia[] = [
  {
    clave: 'exchange-kyc',
    etiqueta: 'Exchange con KYC',
    kycTipico: true,
    documentacion:
      'Identidad verificada por el exchange, órdenes ejecutadas y extractos de operaciones y de fiat.',
    cita: '[MT] Unidad 2, ap. 2, «La vía KYC: el exchange documenta e informa por ti».',
  },
  {
    clave: 'p2p-bancario',
    etiqueta: 'P2P con justificante bancario',
    kycTipico: false,
    documentacion:
      'Justificante de la transferencia/Bizum al vendedor, captura del anuncio o chat con las condiciones y txid on-chain.',
    cita: '[MT] Unidad 2, ap. 3.a, «Compra entre particulares (P2P)» (las cuatro piezas).',
  },
  {
    clave: 'mineria-propia',
    etiqueta: 'Minería propia',
    kycTipico: false,
    documentacion:
      'Liquidaciones del pool o recompensas de bloque, con fecha, cantidad y dirección de cobro propia.',
    cita: '[MT] Unidad 2, ap. 3.c, «Minería» («la vía no-KYC por excelencia»).',
  },
  {
    clave: 'wallet-autocustodia',
    etiqueta: 'Wallet de autocustodia',
    kycTipico: false,
    documentacion:
      'Prueba de titularidad de la dirección/wallet propia y txid de los movimientos entrantes y salientes.',
    cita: '[MT] Unidad 3, ap. 1, «Autocustodia» (titularidad firmando mensajes; regla de no-mezcla, ap. 1.1).',
  },
  {
    clave: 'canal-lightning',
    etiqueta: 'Canal Lightning',
    kycTipico: false,
    documentacion:
      'Registro de apertura/cierre de canal, facturas (invoices) y liquidaciones on-chain de referencia.',
    cita: '[MT] Unidad 3, ap. 1.3, «Lightning en el setup» (factura y preimage; el canal es una ubicación).',
  },
  {
    clave: 'banco-fiat',
    etiqueta: 'Cuenta bancaria (fiat)',
    kycTipico: true,
    documentacion:
      'Extractos bancarios que acreditan los ingresos y retiradas de euros hacia/desde los exchanges.',
    cita: '[MT] Unidad 2, ap. 5 (carga de la prueba, arts. 105-106 LGT) y Unidad 7, ap. 3, capa 2.ª («lo que el banco sabe»).',
  },
  {
    clave: 'otra',
    etiqueta: 'Otra vía',
    kycTipico: false,
    documentacion: 'Documentación específica de la vía (describir en las notas de evidencia).',
    cita: '[MT] Unidad 8, introducción: el método de las cuatro preguntas («¿qué evidencia deja, y en qué carpeta cae?»).',
  },
]

/** Vía de evidencia por su clave (o undefined si no existe / sin asignar). */
export function viaEvidencia(clave: string | undefined): ViaEvidencia | undefined {
  if (!clave) return undefined
  return VIAS_EVIDENCIA.find((v) => v.clave === clave)
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Origen de un apunte (para el sello discreto del DIARIO / SALDOS)
// ────────────────────────────────────────────────────────────────────────────

/** Devuelve el origen (KYC/no-KYC) de una ubicación real; no-KYC prudente si se desconoce. */
function origenDeUbicacion(
  ubic: RefUbicacion,
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
): Origen {
  if (ubic && ubic !== UBICACION_EXTERIOR && kycPorUbicacion.get(ubic)) return 'KYC'
  return 'NO_KYC'
}

/** Sello de origen de un apunte (para el distintivo visual del DIARIO). */
export interface SelloOrigen {
  /** true si la ubicación relevante del apunte es KYC. */
  kyc: boolean
  /** false si el apunte no toca ninguna ubicación real (p. ej. EXTERIOR↔EXTERIOR). */
  aplica: boolean
  /** Ubicación relevante que determina el sello. */
  ubicacion?: RefUbicacion
}

/**
 * Origen del apunte para el sello discreto: se fija por la ubicación relevante (destino si
 * es real; en su defecto, origen). Es una guía visual «esta operación pasó por una vía
 * KYC / no-KYC»; la descomposición fina del saldo la da `calcularTrazabilidad`.
 */
export function selloOrigenApunte(
  apunte: Pick<Apunte, 'ubicacionOrigen' | 'ubicacionDestino'>,
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
): SelloOrigen {
  const candidatas: RefUbicacion[] = [apunte.ubicacionDestino, apunte.ubicacionOrigen]
  for (const ref of candidatas) {
    if (ref && ref !== UBICACION_EXTERIOR) {
      return { kyc: origenDeUbicacion(ref, kycPorUbicacion) === 'KYC', aplica: true, ubicacion: ref }
    }
  }
  return { kyc: false, aplica: false }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Parcelas: la cola FIFO POR UBICACIÓN con memoria de origen y cadena
// ────────────────────────────────────────────────────────────────────────────

/** Parcela viva de saldo en una ubicación (mutable durante el recorrido). */
interface ParcelaViva {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  cantidad: Decimal
  origen: Origen
  /** Apunte que abrió el lote de origen (adquisición / entrada). */
  loteApunteId: IdApunte
  /** Cadena de apuntes por los que ha pasado: [adquisición, …transferencias]. */
  cadena: IdApunte[]
}

/** Parcela de saldo (salida del motor): porción homogénea de un saldo por su origen. */
export interface Parcela {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadTexto
  origen: Origen
  loteApunteId: IdApunte
  /** Cadena de apuntes: [adquisición, …transferencias]. La cadena probatoria del saldo. */
  cadena: IdApunte[]
}

/** Alias para claridad: cantidad como cadena decimal del dominio. */
type CantidadTexto = string

/** Clave estable ubicación|activo. */
function clave(ubic: RefUbicacion, activo: SimboloActivo): string {
  return `${ubic}\u0000${activo}`
}

/**
 * Cola de parcelas por (ubicación × activo). Encapsula las operaciones FIFO de la
 * trazabilidad: agregar, consumir (lo más antiguo primero, con troceo) y mover.
 */
class Colas {
  private readonly mapa = new Map<string, ParcelaViva[]>()

  private cola(ubic: RefUbicacion, activo: SimboloActivo): ParcelaViva[] {
    const k = clave(ubic, activo)
    let c = this.mapa.get(k)
    if (!c) {
      c = []
      this.mapa.set(k, c)
    }
    return c
  }

  /** Añade una parcela nueva al final de la cola de su ubicación. */
  agregar(p: ParcelaViva): void {
    this.cola(p.ubicacion, p.activo).push(p)
  }

  /**
   * Consume `cantidad` de (ubicación × activo), lo más antiguo primero, troceando la última
   * parcela si hace falta. Devuelve las porciones consumidas (para moverlas o registrarlas)
   * y la cantidad que no se pudo cubrir (déficit; parcela insuficiente, aviso).
   */
  consumir(
    ubic: RefUbicacion,
    activo: SimboloActivo,
    cantidad: Decimal,
  ): { porciones: ParcelaViva[]; deficit: Decimal } {
    const cola = this.cola(ubic, activo)
    const porciones: ParcelaViva[] = []
    let porConsumir = cantidad
    while (porConsumir.greaterThan(0) && cola.length > 0) {
      const cabeza = cola[0]!
      const toma = Decimal.min(porConsumir, cabeza.cantidad)
      porciones.push({ ...cabeza, cantidad: toma })
      cabeza.cantidad = cabeza.cantidad.minus(toma)
      porConsumir = porConsumir.minus(toma)
      if (cabeza.cantidad.lessThanOrEqualTo(0)) cola.shift()
    }
    return { porciones, deficit: porConsumir }
  }

  /** Parcelas vivas (cantidad > 0) por (ubicación × activo), en orden FIFO. */
  vivasDe(ubic: RefUbicacion, activo: SimboloActivo): ParcelaViva[] {
    return this.cola(ubic, activo).filter((p) => p.cantidad.greaterThan(0))
  }

  /** Todas las claves (ubicación × activo) con alguna parcela (viva o ya consumida). */
  claves(): { ubicacion: RefUbicacion; activo: SimboloActivo }[] {
    return [...this.mapa.keys()].map((k) => {
      const [ubicacion, activo] = k.split('\u0000') as [RefUbicacion, SimboloActivo]
      return { ubicacion, activo }
    })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Cálculo de la trazabilidad (recorrido cronológico del diario)
// ────────────────────────────────────────────────────────────────────────────

/** Celda de la cartera por origen: un saldo (ubicación × activo) descompuesto por origen. */
export interface CarteraOrigenCelda {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  /** Suma de las parcelas de origen KYC. */
  kyc: CantidadTexto
  /** Suma de las parcelas de origen no-KYC. */
  noKyc: CantidadTexto
  /** Total (kyc + noKyc); reconcilia con la hoja SALDOS. */
  total: CantidadTexto
  /** Parcelas vivas (para el drill-down y la cadena probatoria), FIFO. */
  parcelas: Parcela[]
  /** true si alguna transmisión/salida no tuvo parcela suficiente (saldo negativo). */
  deficit: boolean
}

/** Resultado del cálculo de trazabilidad de todo el diario. */
export interface ResultadoTrazabilidad {
  /** Cartera por origen: una celda por (ubicación × activo) con parcela (incluye saldo 0). */
  cartera: CarteraOrigenCelda[]
  /** Índice por clave ubicación|activo para acceso directo. */
  porCelda: Map<string, CarteraOrigenCelda>
}

/** ¿Es una fecha < que la anterior? (validación de orden, como el motor FIFO). */
function exigirOrden(apuntes: readonly Apunte[]): void {
  for (let i = 1; i < apuntes.length; i++) {
    if (new Date(apuntes[i]!.fechaHora).getTime() < new Date(apuntes[i - 1]!.fechaHora).getTime()) {
      throw new Error(
        `La trazabilidad exige orden cronológico: ${apuntes[i]!.id} es anterior a ${apuntes[i - 1]!.id}.`,
      )
    }
  }
}

/** Cantidad de comisión de un apunte (0 si no hay). */
function comisionCant(ap: Apunte): Decimal {
  return ap.comisionCantidad ? D(ap.comisionCantidad) : CERO
}

/**
 * Calcula la trazabilidad por origen de todo el diario. Recorre los apuntes en orden
 * cronológico manteniendo la cola FIFO por ubicación (ver convención D1). Determinista.
 *
 * @param apuntes  diario en orden cronológico (el correlativo `id` como identidad)
 * @param ubicaciones  catálogo de ubicaciones (aporta el KYC de cada una)
 * @param corteMs  opcional: solo apuntes con fechaHora ≤ corte (para el drill-down temporal)
 */
export function calcularTrazabilidad(
  apuntes: readonly Apunte[],
  ubicaciones: readonly Ubicacion[],
  corteMs?: number,
): ResultadoTrazabilidad {
  exigirOrden(apuntes)
  const kyc = mapaKyc(ubicaciones)
  const colas = new Colas()
  const conDeficit = new Set<string>()

  for (const ap of apuntes) {
    if (corteMs !== undefined && new Date(ap.fechaHora).getTime() > corteMs) continue

    const esTransferencia = ap.tipo === 'TRANSFERENCIA'
    const abre = resolverFlags(ap).abreLote
    const origenReal = ap.ubicacionOrigen !== UBICACION_EXTERIOR
    const destinoReal = ap.ubicacionDestino !== UBICACION_EXTERIOR

    // (1) SALIDA: consume de la ubicación de origen, lo más antiguo primero.
    let movidas: ParcelaViva[] = []
    if (ap.activoSalida && ap.cantidadSalida && origenReal) {
      const { porciones, deficit } = colas.consumir(
        ap.ubicacionOrigen,
        ap.activoSalida,
        D(ap.cantidadSalida),
      )
      movidas = porciones
      if (deficit.greaterThan(0)) conDeficit.add(clave(ap.ubicacionOrigen, ap.activoSalida))
    }

    // (2) COMISIÓN: se quema del origen (o del destino si el origen es EXTERIOR).
    if (ap.comisionActivo && comisionCant(ap).greaterThan(0)) {
      const ubicComision = origenReal ? ap.ubicacionOrigen : ap.ubicacionDestino
      if (ubicComision !== UBICACION_EXTERIOR) {
        const { deficit } = colas.consumir(ubicComision, ap.comisionActivo, comisionCant(ap))
        if (deficit.greaterThan(0)) conDeficit.add(clave(ubicComision, ap.comisionActivo))
      }
    }

    // (3) ENTRADA: mueve el origen (transferencia interna) o abre parcela nueva.
    if (ap.activoEntrada && ap.cantidadEntrada && destinoReal) {
      const entrada = D(ap.cantidadEntrada)
      if (esTransferencia && origenReal) {
        // Movimiento interno: el origen viaja con la cripto (preserva marca y cadena).
        // Se depositan en destino las porciones movidas, hasta la cantidad que llega.
        let porColocar = entrada
        for (const m of movidas) {
          if (porColocar.lessThanOrEqualTo(0)) break
          const toma = Decimal.min(porColocar, m.cantidad)
          colas.agregar({
            ubicacion: ap.ubicacionDestino,
            activo: ap.activoEntrada,
            cantidad: toma,
            origen: m.origen,
            loteApunteId: m.loteApunteId,
            cadena: [...m.cadena, ap.id],
          })
          porColocar = porColocar.minus(toma)
        }
        // Si llegó más de lo que salió (raro), el excedente nace en destino.
        if (porColocar.greaterThan(0)) {
          colas.agregar(nuevaParcela(ap, ap.activoEntrada, porColocar, kyc))
        }
      } else {
        // Apertura de lote (COMPRA/PERMUTA recibida/RENDIMIENTO/MINERÍA/AIRDROP), entrada de
        // fiat recibido en una venta, o depósito desde EXTERIOR: nace una parcela nueva cuyo
        // origen hereda el KYC de la ubicación de aterrizaje (convención D1).
        void abre // el flag documenta la intención; la rama cubre también entradas no-lote.
        colas.agregar(nuevaParcela(ap, ap.activoEntrada, entrada, kyc))
      }
    }
  }

  // Volcado de la cartera por origen.
  const porCelda = new Map<string, CarteraOrigenCelda>()
  for (const { ubicacion, activo } of colas.claves()) {
    const vivas = colas.vivasDe(ubicacion, activo)
    let kycTot = CERO
    let noKycTot = CERO
    const parcelas: Parcela[] = vivas.map((p) => {
      if (p.origen === 'KYC') kycTot = kycTot.plus(p.cantidad)
      else noKycTot = noKycTot.plus(p.cantidad)
      return {
        ubicacion: p.ubicacion,
        activo: p.activo,
        cantidad: aCadena(p.cantidad),
        origen: p.origen,
        loteApunteId: p.loteApunteId,
        cadena: p.cadena,
      }
    })
    const celda: CarteraOrigenCelda = {
      ubicacion,
      activo,
      kyc: aCadena(kycTot),
      noKyc: aCadena(noKycTot),
      total: aCadena(kycTot.plus(noKycTot)),
      parcelas,
      deficit: conDeficit.has(clave(ubicacion, activo)),
    }
    porCelda.set(clave(ubicacion, activo), celda)
  }

  const cartera = [...porCelda.values()].sort(
    (a, b) =>
      String(a.ubicacion).localeCompare(String(b.ubicacion)) ||
      a.activo.localeCompare(b.activo),
  )
  return { cartera, porCelda }
}

/** Crea una parcela nueva cuyo origen hereda el KYC de la ubicación de aterrizaje (destino). */
function nuevaParcela(
  ap: Apunte,
  activo: SimboloActivo,
  cantidad: Decimal,
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
): ParcelaViva {
  return {
    ubicacion: ap.ubicacionDestino,
    activo,
    cantidad,
    origen: origenDeUbicacion(ap.ubicacionDestino, kycPorUbicacion),
    loteApunteId: ap.id,
    cadena: [ap.id],
  }
}

/** Acceso directo a una celda de la cartera por (ubicación × activo). */
export function celdaCartera(
  resultado: ResultadoTrazabilidad,
  ubicacion: RefUbicacion,
  activo: SimboloActivo,
): CarteraOrigenCelda | undefined {
  return resultado.porCelda.get(clave(ubicacion, activo))
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Cadena probatoria de un saldo: «¿cómo demuestro este saldo?»
// ────────────────────────────────────────────────────────────────────────────

/** Papel de un apunte dentro de la cadena de una parcela. */
export type PapelEslabon = 'adquisicion' | 'transferencia' | 'otro'

/** Un eslabón de la cadena probatoria: un apunte con su estado probatorio y justificantes. */
export interface EslabonProbatorio {
  apunteId: IdApunte
  /** Papel en la cadena (el primero es la adquisición; el resto, transferencias). */
  papel: PapelEslabon
  apunte?: Apunte
  estado: EstadoProbatorio
  /** Justificantes ligados a este apunte. */
  justificantes: Justificante[]
  /** Requisitos aún sin cubrir (los «huecos» de este eslabón). */
  faltantes: RequisitoProbatorio[]
  /** true si el apunte referenciado ya no existe (cadena rota). */
  huerfano: boolean
}

/** Una rama de la cadena probatoria: una parcela viva del saldo y su cadena hacia atrás. */
export interface RamaProbatoria {
  cantidad: CantidadTexto
  origen: Origen
  loteApunteId: IdApunte
  eslabones: EslabonProbatorio[]
  /** Nº de eslabones con huecos (incompleto / sin justificar / huérfano). */
  eslabonesConHueco: number
}

/** Informe «¿cómo demuestro este saldo?» de una celda (ubicación × activo). */
export interface CadenaProbatoria {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  saldo: CantidadTexto
  kyc: CantidadTexto
  noKyc: CantidadTexto
  /** Una rama por parcela viva (del más antiguo al más reciente). */
  ramas: RamaProbatoria[]
  /** true si el saldo tuvo déficit (salida sin origen registrado). */
  deficit: boolean
  /** Total de eslabones únicos con hueco probatorio en toda la cadena. */
  huecos: number
}

/** Determina el papel de un apunte en la cadena por su posición y tipo. */
function papelDe(indice: number, apunte: Apunte | undefined): PapelEslabon {
  if (indice === 0) return 'adquisicion'
  if (apunte?.tipo === 'TRANSFERENCIA') return 'transferencia'
  return 'otro'
}

/**
 * Construye la cadena probatoria de un saldo elegido (ubicación × activo): por cada parcela
 * viva, recorre su cadena de apuntes hacia atrás (adquisición → transferencias) y adjunta,
 * a cada eslabón, su estado probatorio, sus justificantes y sus huecos. Es el «expediente
 * modelo» del taller.
 *
 * @param resultado  salida de `calcularTrazabilidad` (para no recalcular)
 * @param apuntes  diario de dominio (para resolver cada apunte de la cadena)
 * @param justificantes  justificantes de dominio (enlazados por correlativo `apunteId`)
 * @param ubicaciones  catálogo de ubicaciones (KYC, para el estado probatorio)
 */
export function cadenaProbatoria(
  resultado: ResultadoTrazabilidad,
  apuntes: readonly Apunte[],
  justificantes: readonly Justificante[],
  ubicaciones: readonly Ubicacion[],
  ubicacion: RefUbicacion,
  activo: SimboloActivo,
): CadenaProbatoria {
  const celda = celdaCartera(resultado, ubicacion, activo)
  const kyc = mapaKyc(ubicaciones)
  const apuntePorId = new Map(apuntes.map((a) => [a.id, a]))
  const justPorApunte = agruparPorApunte(justificantes)

  const eslabonesConHueco = new Set<IdApunte>()

  const ramas: RamaProbatoria[] = (celda?.parcelas ?? []).map((p) => {
    let conHueco = 0
    const eslabones: EslabonProbatorio[] = p.cadena.map((apId, i) => {
      const apunte = apuntePorId.get(apId)
      const justis = justPorApunte.get(apId) ?? []
      if (!apunte) {
        conHueco++
        eslabonesConHueco.add(apId)
        return {
          apunteId: apId,
          papel: papelDe(i, undefined),
          estado: 'sin-justificar' as EstadoProbatorio,
          justificantes: [],
          faltantes: [],
          huerfano: true,
        }
      }
      const r = estadoProbatorioApunte(apunte, justis, kyc)
      if (r.estado !== 'completo') {
        conHueco++
        eslabonesConHueco.add(apId)
      }
      return {
        apunteId: apId,
        papel: papelDe(i, apunte),
        apunte,
        estado: r.estado,
        justificantes: justis,
        faltantes: r.faltantes,
        huerfano: false,
      }
    })
    return {
      cantidad: p.cantidad,
      origen: p.origen,
      loteApunteId: p.loteApunteId,
      eslabones,
      eslabonesConHueco: conHueco,
    }
  })

  return {
    ubicacion,
    activo,
    saldo: celda?.total ?? '0',
    kyc: celda?.kyc ?? '0',
    noKyc: celda?.noKyc ?? '0',
    ramas,
    deficit: celda?.deficit ?? false,
    huecos: eslabonesConHueco.size,
  }
}
