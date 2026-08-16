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
 * Regla de oro 5 (textos fiscales/probatorios): los textos de la checklist son literales
 * de los manuales del taller (validados a 2026-08-06, ver docs/TEXTOS_MANUAL_RANURAS.md §5).
 * NO son calificaciones fiscales inventadas: describen qué documento aporta la prueba, que es
 * criterio metodológico del Bloque 1.
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

/**
 * Carpetas convencionales del Archivo, en orden de expediente, con etiqueta legible.
 * Convención VALIDADA (2026-08-06): las seis carpetas del manual [MT U3.3] (01–06) más
 * `07-perdidas-y-donaciones` y `99-otros` como extensión de la app.
 */
export const CARPETAS_ARCHIVO: readonly { ruta: RutaConvencional; etiqueta: string }[] = [
  { ruta: '01-adquisiciones', etiqueta: 'Adquisiciones' },
  { ruta: '02-transferencias', etiqueta: 'Transferencias' },
  { ruta: '03-transmisiones', etiqueta: 'Transmisiones' },
  { ruta: '04-rendimientos', etiqueta: 'Rendimientos' },
  { ruta: '05-certificados', etiqueta: 'Certificados' },
  { ruta: '06-etiquetas', etiqueta: 'Etiquetas' },
  { ruta: '07-perdidas-y-donaciones', etiqueta: 'Pérdidas y donaciones' },
  { ruta: '99-otros', etiqueta: 'Otros' },
]

/**
 * Carpetas que admiten justificantes SIN apunte asociado (documentos de ubicación o de
 * ejercicio: certificados anuales del exchange, exportaciones CSV y etiquetas BIP-329). No se
 * cuentan como huérfanos [MT U3.3].
 */
export const CARPETAS_SIN_APUNTE: readonly RutaConvencional[] = ['05-certificados', '06-etiquetas']

/** Etiqueta legible de una carpeta convencional. */
export const ETIQUETA_CARPETA: Readonly<Record<RutaConvencional, string>> = Object.freeze(
  Object.fromEntries(CARPETAS_ARCHIVO.map((c) => [c.ruta, c.etiqueta])) as Record<
    RutaConvencional,
    string
  >,
)

/**
 * Carpeta convencional por defecto para un tipo de operación. Es una SUGERENCIA para el
 * formulario: el alumno puede archivar un justificante en otra carpeta. Mapeo VALIDADO
 * (2026-08-06) según [MT U3.3] y la extensión de la app: ventas, permutas y pagos a
 * `03-transmisiones`; rendimientos, minería y airdrops a `04-rendimientos`; PÉRDIDA y DONACIÓN
 * a `07-perdidas-y-donaciones`; AJUSTE/RECTIFICACIÓN a `99-otros`.
 */
export const RUTA_POR_TIPO: Readonly<Record<TipoOperacion, RutaConvencional>> = {
  // D6: la liquidación de un derivado documenta una GyP, como las transmisiones.
  LIQUIDACION_DERIVADO: '03-transmisiones',
  COMPRA: '01-adquisiciones',
  VENTA: '03-transmisiones',
  PERMUTA: '03-transmisiones',
  TRANSFERENCIA: '02-transferencias',
  RENDIMIENTO: '04-rendimientos',
  MINERIA: '04-rendimientos',
  AIRDROP: '04-rendimientos',
  PAGO: '03-transmisiones',
  PERDIDA: '07-perdidas-y-donaciones',
  DONACION: '07-perdidas-y-donaciones',
  AJUSTE: '99-otros',
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Checklist probatoria por tipo (literales del manual, §5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un requisito documental de la checklist. `clave` es el identificador estable que casa
 * con `Justificante.tipoDocumento` (el formulario ofrece estas claves): así el motor sabe
 * qué requisito cubre cada justificante sin depender de texto libre.
 */
export interface RequisitoProbatorio {
  /** Identificador estable del documento (casa con `tipoDocumento`). */
  readonly clave: string
  /** Nombre del documento a aportar. */
  readonly documento: string
  /** Aclaración de qué prueba y por qué (literal del manual, con su cita). */
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
   * (PÉRDIDA), 4 = alta (DONACIÓN).
   */
  readonly exigencia: number
  readonly requisitos: readonly RequisitoProbatorio[]
}

/**
 * CHECKLIST_PROBATORIA — qué documentos exige el manual para cada tipo. Textos literales de
 * los manuales del taller (validados a 2026-08-06, §5), con su cita al final. Clave
 * metodológica en PÉRDIDA (denuncia + expediente) y en adquisiciones no-KYC (pago + anuncio +
 * txid).
 */
export const CHECKLIST_PROBATORIA: Readonly<Record<TipoOperacion, ChecklistTipo>> = {
  LIQUIDACION_DERIVADO: {
    tipo: 'LIQUIDACION_DERIVADO',
    tesis: '¿Qué posición se cerró, con qué resultado neto y quién lo liquidó?',
    exigencia: 3,
    requisitos: [
      {
        clave: 'extracto-posicion',
        documento: 'Extracto de la posición en la plataforma',
        detalle:
          'Apertura, cierre y resultado neto liquidado. Es el documento que fija la cifra: ' +
          'en las liquidaciones por diferencias no hay entrega del subyacente que probar.',
      },
      {
        clave: 'movimientos-margen',
        documento: 'Movimientos de margen',
        detalle:
          'Aportación y devolución del colateral, para separar lo que es traslado de lo que ' +
          'es resultado.',
      },
      {
        clave: 'cotizacion',
        documento: 'Fuente de la cotización EUR aplicada',
        detalle: 'Con fecha y hora, si la liquidación se produjo en un activo distinto del euro.',
      },
    ],
  },
  COMPRA: {
    tipo: 'COMPRA',
    tesis: '¿De dónde salió el euro y a qué precio compré?',
    exigencia: 3,
    requisitos: [
      {
        clave: 'orden-ejecucion',
        documento: 'Orden de compra / justificante de ejecución',
        detalle:
          '«Histórico completo de órdenes con fecha, hora, contravalor en euros y comisiones» del CASP; exportar periódicamente, «como mínimo, al cierre de cada ejercicio» — si la plataforma cierra, «la prueba desaparece con ella». [MT U2.2]',
        soloKyc: true,
      },
      {
        clave: 'extracto-exchange',
        documento: 'Extracto o histórico del exchange',
        detalle:
          'Extracto del CASP con el cargo en EUR y el abono en cripto (el CASP «fabrica evidencia de calidad de forma automática»). [MT U2.2]',
        soloKyc: true,
      },
      {
        clave: 'justificante-pago',
        documento: 'Justificante de pago (transferencia / Bizum)',
        detalle:
          'Justificante del pago al vendedor (transferencia, Bizum o efectivo documentado). Una de las «cuatro piezas» del P2P. [MT U2.3.a]',
        soloNoKyc: true,
      },
      {
        clave: 'captura-anuncio',
        documento: 'Captura del anuncio / acuerdo P2P',
        detalle:
          '«La evidencia disponible es la que las partes fabriquen mediante algún tipo de acuerdo (aunque sea un chat: cantidad, precio y fecha)». [MT U2.3.a]',
        soloNoKyc: true,
      },
      {
        clave: 'txid-entrada',
        documento: 'txid / hash de la transacción on-chain',
        detalle:
          '«El txid de la recepción y la cotización del día guardada de una fuente verificable». [MT U2.3.a]',
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
        detalle:
          'Orden ejecutada con cantidad, precio y comisión (carpeta de transmisiones: «orden ejecutada, contravalor, comisión»). [MT U3.3]',
      },
      {
        clave: 'extracto-exchange',
        documento: 'Extracto del exchange / abono de fiat',
        detalle: 'Extracto con el abono en EUR de la venta. [MT U2.2]',
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
        detalle:
          'Comprobante del intercambio con ambas patas; el registro anota el contravalor EUR de la operación con su fuente. [MT U3.3 y U4 principio 5]',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle:
          '«Contravalor en euros en toda frontera: […] se anota su contravalor en EUR a esa fecha, con la fuente de la cotización». [MT U4 principio 5]',
      },
      {
        clave: 'txid-permuta',
        documento: 'txid / hash de la operación',
        detalle:
          'Txid o identificador de la operación (DEX/exchange) que acredita el intercambio. [MT U2.3.a por analogía]',
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
        detalle:
          '«Txids y capturas de los movimientos entre ubicaciones propias, con sus comisiones de red». [MT U3.3, carpeta 02]',
      },
      {
        clave: 'titularidad-destino',
        documento: 'Prueba de titularidad de la ubicación destino',
        detalle:
          'Acreditación de que el destino es propio: primera dirección de recepción asociada al titular; la titularidad puede demostrarse «firmando mensajes». [MT U2.4 y U3.1]',
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
        detalle:
          '«Staking, intereses, recompensas: fecha y valor al percibirse» (carpeta 04). [MT U3.3]',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle:
          'Contravalor del día al acreditarse en monedero disponible (imputación: V0612-26). [MT U8.1]',
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
        detalle:
          '«Informes del pool con las recompensas y sus fechas»; facturas de equipos y electricidad («que además serán gasto deducible»). [MT U2.3.c]',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle: 'Contravalor del día de cada recompensa, con fuente citada. [MT U4 principio 5]',
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
        detalle:
          'Txid o captura de la recepción y de la campaña; «los tokens sin mercado líquido en el momento de la recepción: se documenta la mejor valoración disponible y su fuente». [MT U8.3]',
      },
      {
        clave: 'valor-mercado',
        documento: 'Prueba del valor de mercado en EUR',
        detalle:
          'Valor de mercado al día de recepción (es renta ahora y coste del lote después: 0018-23). [MF U3]',
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
        detalle:
          '«Quien factura en bitcoin genera, al facturar, el mejor documento de adquisición posible: causa, contraparte, importe y fecha». Para el pagador: factura del bien/servicio recibido (fija el valor de transmisión). [MT U2.3.d]',
      },
      {
        clave: 'txid-pago',
        documento: 'txid / hash del pago',
        detalle:
          'Txid del pago vinculado a la factura («documentar su vinculación a una txid específica»). [MT U2.3.d]',
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
        detalle:
          '«La denuncia ante las Fuerzas y Cuerpos de Seguridad con identificación precisa de los activos sustraídos»; «condición necesaria y no suficiente». [MF U2, V1174-25]',
      },
      {
        clave: 'expediente-atestado',
        documento: 'Expediente / atestado / resolución',
        detalle:
          '«Los hashes de las transacciones de salida y las direcciones de destino; la acreditación de la titularidad previa de las direcciones vaciadas; los justificantes de adquisición originales; en su caso, informes periciales; y la trazabilidad posterior de los fondos». [MF U2]',
      },
      {
        clave: 'txid-perdida',
        documento: 'txid del movimiento no autorizado',
        detalle: 'Txids del drenaje y capturas del incidente, reunidos «ese día». [MT U8.7]',
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
        detalle:
          '«Documento de la donación, parentesco, valoración a la fecha. Además fija el valor y la fecha de adquisición del receptor». [MT U2.3.e]',
      },
      {
        clave: 'liquidacion-isd',
        documento: 'Liquidación del ISD (donatario)',
        detalle: 'Autoliquidación del ISD cuando proceda. [MT U2.3.e y MF U1-U2]',
      },
      {
        clave: 'txid-donacion',
        documento: 'txid / hash de la transferencia',
        detalle: 'Txid de la entrega. [MT U3.3]',
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
        detalle:
          '«El apunte original se conserva y la corrección entra como apunte nuevo de AJUSTE/RECTIFICACIÓN, con referencia al apunte corregido» y su causa documentada. [MT U7.4]',
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

/**
 * Detecta justificantes sin apunte y apuntes sin justificante. Los justificantes archivados en
 * las carpetas `CARPETAS_SIN_APUNTE` (certificados anuales, exportaciones CSV, etiquetas
 * BIP-329) son documentos de ubicación/ejercicio y NO se cuentan como huérfanos aunque no
 * tengan apunte asociado [MT U3.3].
 */
export function detectarHuerfanos(
  apuntes: readonly Apunte[],
  justificantes: readonly Justificante[],
): Huerfanos {
  const idsApunte = new Set(apuntes.map((a) => a.id))
  const sinApunteAdmitido = new Set<RutaConvencional>(CARPETAS_SIN_APUNTE)
  const apuntesConJustificante = new Set(justificantes.map((j) => j.apunteId))
  return {
    justificantesSinApunte: justificantes.filter(
      (j) => !idsApunte.has(j.apunteId) && !sinApunteAdmitido.has(j.rutaConvencional),
    ),
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
