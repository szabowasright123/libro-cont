/**
 * types.ts — Tipos del dominio de Libro Hespérides.
 *
 * Fuente de verdad: docs/reference/DOMINIO.md y, en última instancia,
 * docs/reference/PLANTILLA_TALLER.xlsx. Cualquier discrepancia con el Excel es un bug.
 *
 * Reglas de oro que este módulo materializa:
 *  - Nunca aritmética float para cantidades ni euros: los decimales viven como STRING
 *    (`CantidadDecimal` / `EuroDecimal`) y se operan con decimal.js en el motor. (Regla 2)
 *  - Catálogo CERRADO de 11 tipos de operación. No añadir tipos. (Regla 7)
 *  - FIFO en cola ÚNICA global por activo. (Regla 8)
 *
 * Este fichero es solo tipos y catálogos: sin lógica de cálculo (esa vive en el motor,
 * en funciones deterministas estado→resultado). Sin React, sin Dexie, sin browser APIs.
 *
 * Convención de literales: los valores de las uniones (tipos de operación, activos)
 * se escriben en MAYÚSCULAS y ASCII (MINERIA, PERDIDA, DONACION, AJUSTE) para evitar
 * problemas de codificación; las etiquetas con acentos para la UI viven en mapas de
 * presentación aparte (ETIQUETA_TIPO).
 */

// ────────────────────────────────────────────────────────────────────────────
// 0. Primitivos del dominio
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cantidad de un activo, representada como cadena decimal exacta (p. ej. "0.40680000").
 * NUNCA usar `number` para cantidades: se parsea con decimal.js. BTC con 8 decimales.
 */
export type CantidadDecimal = string

/** Importe en euros como cadena decimal exacta (p. ej. "4254.00"). NUNCA `number`. */
export type EuroDecimal = string

/**
 * Marca temporal en formato ISO con hora local española (convención del taller).
 * El UTC se convierte al cargar y se anota. Ej.: "2024-01-16T10:00:00".
 */
export type FechaHoraISO = string

/** Identificador correlativo de apunte con formato `AAAA-NNN` (p. ej. "2026-001"). */
export type IdApunte = string

/** Símbolo de un activo del catálogo (p. ej. "BTC", "EUR", "USDC"). */
export type SimboloActivo = string

/**
 * Ubicación especial de frontera: rendimientos que entran, pagos que salen.
 * No es una ubicación real del alumno; es el "exterior" del patrimonio.
 */
export const UBICACION_EXTERIOR = 'EXTERIOR' as const
export type UbicacionExterior = typeof UBICACION_EXTERIOR

/** Referencia a una ubicación: su `id`, o la ubicación especial EXTERIOR. */
export type RefUbicacion = string | UbicacionExterior

// ────────────────────────────────────────────────────────────────────────────
// 1. Catálogo cerrado de tipos de operación (DOMINIO §3.3, Tabla 7)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Los 11 tipos del catálogo cerrado. Unión literal ASCII en mayúsculas.
 * (MINERÍA→MINERIA, PÉRDIDA→PERDIDA, DONACIÓN→DONACION, AJUSTE/RECTIFICACIÓN→AJUSTE.)
 */
export type TipoOperacion =
  | 'COMPRA'
  | 'VENTA'
  | 'PERMUTA'
  | 'TRANSFERENCIA'
  | 'RENDIMIENTO'
  | 'MINERIA'
  | 'AIRDROP'
  | 'PAGO'
  | 'PERDIDA'
  | 'DONACION'
  | 'AJUSTE'

/**
 * Valor de un flag del catálogo. `true`/`false` cuando es determinista; `'segun'`
 * cuando depende del caso concreto y la app debe preguntar (DONACIÓN, AJUSTE).
 */
export type FlagOperacion = boolean | 'segun'

/** Flags y metadatos de un tipo de operación (una fila de la Tabla 7). */
export interface DefinicionTipo {
  readonly tipo: TipoOperacion
  /** Etiqueta con acentos para la UI (p. ej. "MINERÍA"). */
  readonly etiqueta: string
  /** ¿Participa en el CUADRE (afecta a saldos)? */
  readonly cuadra: FlagOperacion
  /** ¿Es una alteración patrimonial (relevancia fiscal en la transmisión)? */
  readonly alteracion: FlagOperacion
  /** ¿Abre lote FIFO (entrada que crea coste de adquisición)? */
  readonly abreLote: FlagOperacion
  /** ¿Consume lote FIFO (salida que transmite y realiza GyP)? */
  readonly consumeLote: FlagOperacion
  /** La app debe preguntar al alumno el sentido/tratamiento (no se automatiza). */
  readonly requiereDecisionManual: boolean
  /** AJUSTE exige `rectificaA` + causa (principio 7, U7.4). */
  readonly exigeRectificaA: boolean
  /** Calificación fiscal literal del manual (Regla 5: copiar, no parafrasear). */
  readonly calificacionFiscal: string
}

/**
 * CATÁLOGO_TIPOS — traducción 1:1 de la Tabla 7 del manual (DOMINIO §3.3).
 * Es la fuente de verdad de los flags de cada operación.
 */
export const CATALOGO_TIPOS: Readonly<Record<TipoOperacion, DefinicionTipo>> = {
  COMPRA: {
    tipo: 'COMPRA',
    etiqueta: 'COMPRA',
    cuadra: true,
    alteracion: false,
    abreLote: true,
    consumeLote: false,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal: 'Sin hecho imponible; fija lote FIFO',
  },
  VENTA: {
    tipo: 'VENTA',
    etiqueta: 'VENTA',
    cuadra: true,
    alteracion: true,
    abreLote: false,
    consumeLote: true,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal: 'GyP patrimonial, base del ahorro',
  },
  PERMUTA: {
    tipo: 'PERMUTA',
    etiqueta: 'PERMUTA',
    cuadra: true,
    alteracion: true,
    abreLote: true,
    consumeLote: true,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal:
      'Alteración: se transmite lo entregado; lo recibido nace a valor de mercado',
  },
  TRANSFERENCIA: {
    tipo: 'TRANSFERENCIA',
    etiqueta: 'TRANSFERENCIA',
    cuadra: true,
    alteracion: false,
    abreLote: false,
    consumeLote: false,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal:
      'Sin hecho imponible; la comisión de red sí sale del patrimonio',
  },
  RENDIMIENTO: {
    tipo: 'RENDIMIENTO',
    etiqueta: 'RENDIMIENTO',
    cuadra: false,
    alteracion: true,
    abreLote: true,
    consumeLote: false,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal: 'RCM art. 25.2 LIRPF — V1766-22, V0612-26',
  },
  MINERIA: {
    tipo: 'MINERIA',
    etiqueta: 'MINERÍA',
    cuadra: false,
    alteracion: true,
    abreLote: true,
    consumeLote: false,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal: 'Rendimiento de actividad económica',
  },
  AIRDROP: {
    tipo: 'AIRDROP',
    etiqueta: 'AIRDROP',
    cuadra: false,
    alteracion: true,
    abreLote: true,
    consumeLote: false,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal: 'Ganancia base general — DGT 0018-23 (no vinculante)',
  },
  PAGO: {
    tipo: 'PAGO',
    etiqueta: 'PAGO',
    cuadra: true,
    alteracion: true,
    abreLote: false,
    consumeLote: true,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal: 'Transmisión (como venta cuyo precio es la factura)',
  },
  PERDIDA: {
    tipo: 'PERDIDA',
    etiqueta: 'PÉRDIDA',
    cuadra: false,
    alteracion: true,
    abreLote: false,
    consumeLote: true,
    requiereDecisionManual: false,
    exigeRectificaA: false,
    calificacionFiscal: 'Pérdida condicionada a requisitos y prueba (dualidad DGT)',
  },
  DONACION: {
    tipo: 'DONACION',
    etiqueta: 'DONACIÓN',
    cuadra: 'segun',
    alteracion: true,
    abreLote: 'segun',
    consumeLote: 'segun',
    requiereDecisionManual: true,
    exigeRectificaA: false,
    calificacionFiscal: 'Entregada: alteración en donante; recibida: ISD',
  },
  AJUSTE: {
    tipo: 'AJUSTE',
    etiqueta: 'AJUSTE/RECTIFICACIÓN',
    cuadra: 'segun',
    alteracion: 'segun',
    abreLote: 'segun',
    consumeLote: 'segun',
    requiereDecisionManual: true,
    exigeRectificaA: true,
    calificacionFiscal: '— (exige referencia y causa)',
  },
}

/** Lista ordenada de los 11 tipos (para selectores y validaciones). */
export const TIPOS_OPERACION = Object.keys(CATALOGO_TIPOS) as TipoOperacion[]

/** Etiqueta con acentos para presentar un tipo en la UI. */
export const ETIQUETA_TIPO: Readonly<Record<TipoOperacion, string>> = Object.freeze(
  Object.fromEntries(
    TIPOS_OPERACION.map((t) => [t, CATALOGO_TIPOS[t].etiqueta]),
  ) as Record<TipoOperacion, string>,
)

// ────────────────────────────────────────────────────────────────────────────
// 2. Ubicaciones (DOMINIO §3.2) — la columna KYC vertebra el Bloque 1
// ────────────────────────────────────────────────────────────────────────────

/** Naturaleza de una ubicación. */
export type TipoUbicacion = 'exchange' | 'wallet' | 'canal'

/** Ubicación donde el alumno custodia o mueve activos. */
export interface Ubicacion {
  readonly id: string
  nombre: string
  tipo: TipoUbicacion
  /** ¿Está sujeta a KYC? Columna clave del Bloque 1. */
  kyc: boolean
  fechaAlta: FechaHoraISO
  fechaCierre?: FechaHoraISO
  notas?: string
  /**
   * Vía de evidencia de la ubicación (ficha ampliada, P6): qué clase de documentación
   * genera de forma natural la vía por la que entran/salen activos aquí (KYC del exchange,
   * P2P con justificante bancario, minería propia…). Clave del catálogo `VIAS_EVIDENCIA`
   * (src/engine/trazabilidad.ts). Opcional: es orientación probatoria, no cálculo.
   */
  viaEvidencia?: string
  /** Nota libre del alumno sobre la evidencia de esta ubicación (ficha ampliada). */
  notasEvidencia?: string
  /**
   * ¿La ubicación está radicada en el EXTRANJERO? (Bloque 3, P7.) Relevante SOLO para el
   * aviso informativo del modelo 721 (saldos de exchanges extranjeros > 50.000 € a 31/12).
   * Opcional: no altera ningún cálculo del Libro; es un atributo declarativo del alumno.
   */
  extranjero?: boolean
  /** País de radicación (informativo, para el aviso 721). Texto libre del alumno. */
  pais?: string
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Activos (catálogo editable; BTC y EUR de serie)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Definición de un activo del catálogo. Regla de identidad: BTC ≠ WBTC ≠ saldo
 * Lightning se modelan como activos (o ubicaciones) distintos.
 */
export interface Activo {
  /** Símbolo único (clave). */
  readonly simbolo: SimboloActivo
  nombre: string
  /** Nº de decimales significativos (BTC = 8). */
  decimales: number
  /** ¿Es moneda fiat de cuenta (EUR)? Los fiat no abren cola FIFO cripto. */
  esFiat: boolean
}

/** Activos de serie (DOMINIO §3.3): BTC y EUR. El resto los añade el alumno. */
export const ACTIVOS_BASE: readonly Activo[] = [
  { simbolo: 'EUR', nombre: 'Euro', decimales: 2, esFiat: true },
  { simbolo: 'BTC', nombre: 'Bitcoin', decimales: 8, esFiat: false },
]

// ────────────────────────────────────────────────────────────────────────────
// 4. Apunte (fila del DIARIO — DOMINIO §3.1)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un apunte del Libro (diario contable). El orden cronológico es obligatorio para FIFO;
 * la app lo garantiza por construcción.
 *
 * Convención de comisión: se descuenta en ORIGEN; si origen = EXTERIOR, en destino.
 * Los campos activo/cantidad de entrada y salida son opcionales según el tipo.
 */
export interface Apunte {
  readonly id: IdApunte
  fechaHora: FechaHoraISO
  tipo: TipoOperacion

  ubicacionOrigen: RefUbicacion
  ubicacionDestino: RefUbicacion

  /** Lo que SALE del patrimonio/ubicación (venta, permuta entregada, pago…). */
  activoSalida?: SimboloActivo
  cantidadSalida?: CantidadDecimal

  /** Lo que ENTRA (compra, permuta recibida, rendimiento…). */
  activoEntrada?: SimboloActivo
  cantidadEntrada?: CantidadDecimal

  /** Comisión de la operación (cantidad + activo). */
  comisionCantidad?: CantidadDecimal
  comisionActivo?: SimboloActivo

  /** Contravalor en euros. Obligatorio en tipos con relevancia fiscal. */
  contravalorEUR?: EuroDecimal

  /** Referencia al Archivo (justificante). Enlaza Libro ↔ Archivo. */
  justificante?: string

  notas?: string

  /** AJUSTE: apunte al que rectifica (+ causa en notas). Obligatorio en AJUSTE. */
  rectificaA?: IdApunte
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Justificante (el Archivo — DOMINIO §3.4)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Carpetas convencionales del Archivo probatorio. Prefijo numérico estable para
 * mantener el orden del expediente.
 */
export type RutaConvencional =
  | '01-adquisiciones'
  | '02-transferencias'
  | '03-transmisiones'
  | '04-rendimientos'
  | '05-perdidas'
  | '06-donaciones'
  | '07-ajustes'
  | '99-otros'

/** Documento probatorio ligado a un apunte del Libro. */
export interface Justificante {
  readonly id: string
  apunteId: IdApunte
  rutaConvencional: RutaConvencional
  tipoDocumento: string
  /** Hash SHA-256 para integridad probatoria (opcional hasta adjuntar fichero). */
  hashSHA256?: string
  /** Blob del fichero en IndexedDB (opcional) o solo referencia externa. */
  fichero?: Blob
  /** Ruta/URL externa si el fichero no se guarda embebido. */
  referenciaExterna?: string
  notas?: string
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Parámetros (catálogos + tolerancias del cuadre)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tolerancias del semáforo de CUADRE (DOMINIO §4). |dif| ≤ verde → OK;
 * ≤ ambar → REVISAR; mayor → ERROR. Configurables.
 */
export interface Tolerancias {
  /** Umbral verde (OK). Por defecto 1e-8. */
  verde: number
  /** Umbral ámbar (REVISAR). Por defecto 0,001. */
  ambar: number
}

/** Tolerancias por defecto (Regla 2): verde ≤ 1e-8, ámbar ≤ 0,001. */
export const TOLERANCIAS_POR_DEFECTO: Tolerancias = { verde: 1e-8, ambar: 1e-3 }

/**
 * Parámetros de la instancia del Libro: catálogos editables y tolerancias.
 * El catálogo de tipos es cerrado (referencia constante), aquí solo se listan
 * los tipos activos por si en el futuro se quisieran ocultar (no añadir).
 */
export interface Parametros {
  activos: Activo[]
  tolerancias: Tolerancias
  /** Referencia al catálogo cerrado de tipos (no editable). */
  readonly tipos: Readonly<Record<TipoOperacion, DefinicionTipo>>
}

/** Parámetros iniciales de una instancia nueva del Libro. */
export const PARAMETROS_POR_DEFECTO: Parametros = {
  activos: [...ACTIVOS_BASE],
  tolerancias: { ...TOLERANCIAS_POR_DEFECTO },
  tipos: CATALOGO_TIPOS,
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Tipos de resultado del motor (salidas de cálculo)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Celda de SALDOS: por ubicación × activo a una fecha de corte.
 * saldo = entradas − salidas − comisiones. Saldo negativo ⇒ alerta roja.
 */
export interface SaldoCelda {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  entradas: CantidadDecimal
  salidas: CantidadDecimal
  comisiones: CantidadDecimal
  saldo: CantidadDecimal
  /** true si saldo < 0 (salida sin origen registrado — Unidad 7). */
  negativo: boolean
}

/**
 * Lote FIFO abierto por una adquisición (cola ÚNICA global por activo).
 * Coste del lote = contravalor EUR + comisión si es en EUR.
 */
export interface LoteFifo {
  /** Id del apunte que abrió el lote. */
  apunteId: IdApunte
  activo: SimboloActivo
  fechaHora: FechaHoraISO
  /** Cantidad con la que nació el lote. */
  cantidadInicial: CantidadDecimal
  /** Cantidad aún no consumida. */
  cantidadRestante: CantidadDecimal
  /** Coste total de adquisición en EUR (contravalor + comisión EUR). */
  costeTotalEUR: EuroDecimal
  /** Coste unitario en EUR (costeTotalEUR / cantidadInicial). */
  costeUnitarioEUR: EuroDecimal
}

/** Consumo (total o parcial) de un lote por una transmisión. */
export interface ConsumoFifo {
  /** Apunte del lote consumido. */
  loteApunteId: IdApunte
  cantidadConsumida: CantidadDecimal
  /** Coste FIFO imputado a esta porción (cantidadConsumida × costeUnitario). */
  costeImputadoEUR: EuroDecimal
}

/**
 * Resultado de una transmisión (VENTA, PERMUTA entregada, PAGO, PÉRDIDA).
 * Valor de transmisión neto = contravalor EUR − comisión si es en EUR.
 * Resultado = valor neto − coste FIFO.
 */
export interface ResultadoTransmision {
  apunteId: IdApunte
  activo: SimboloActivo
  fechaHora: FechaHoraISO
  /** Ejercicio fiscal (año) de la transmisión. */
  ejercicio: number
  cantidad: CantidadDecimal
  valorTransmisionNetoEUR: EuroDecimal
  costeFifoEUR: EuroDecimal
  resultadoEUR: EuroDecimal
  /** Lotes consumidos, del más antiguo al más reciente. */
  consumos: ConsumoFifo[]
  /**
   * true si la cola no tenía lotes suficientes para cubrir la cantidad transmitida
   * (venta/pago/pérdida sin saldo FIFO): la porción sin lote se imputa a coste 0 y
   * el resultado queda inflado. Es un aviso, no un error (DOMINIO §4, validaciones).
   */
  saldoFifoInsuficiente?: boolean
  /** Cantidad transmitida que quedó sin lote de coste (0 si la cola cubría todo). */
  cantidadSinCoste?: CantidadDecimal
}

/** Totales de la cola FIFO de un activo. */
export interface ColaFifoResumen {
  activo: SimboloActivo
  adquiridoTotal: CantidadDecimal
  consumidoTotal: CantidadDecimal
  restanteTotal: CantidadDecimal
  costeRestanteEUR: EuroDecimal
  lotesAbiertos: LoteFifo[]
}

/** Estado del semáforo de CUADRE (DOMINIO §4, Tabla 5). */
export type EstadoSemaforo = 'OK' | 'REVISAR' | 'ERROR'

/**
 * Fila del CUADRE: por ubicación × activo, dif = saldo real declarado − saldo calculado.
 * |dif| ≤ 1e-8 → OK; ≤ 0,001 → REVISAR; mayor → ERROR.
 */
export interface FilaCuadre {
  ubicacion: RefUbicacion
  activo: SimboloActivo
  /** Saldo real tecleado por el alumno desde la fuente (exchange, wallet). */
  saldoReal: CantidadDecimal
  /** Saldo calculado por el motor. */
  saldoCalculado: CantidadDecimal
  diferencia: CantidadDecimal
  estado: EstadoSemaforo
}
