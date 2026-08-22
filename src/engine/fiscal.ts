/**
 * fiscal.ts — Módulo fiscal (Bloque 3, F7). Agregación anual ORIENTATIVA del motor.
 *
 * Fuente de verdad de los NÚMEROS: el motor FIFO (`fifo.ts`) y los apuntes del diario.
 * Este módulo NO calcula nada nuevo de FIFO: reparte las transmisiones y los ingresos ya
 * calculados en las CINCO SALIDAS del registro ([MT] U9.1) y adjunta el estado probatorio de las
 * pérdidas. Las cifras reconcilian con los golden del FIFO (criterio de aceptación P7).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGLA DE ORO 5 — TEXTOS FISCALES: los textos con calificación fiscal NO se redactan en la
 * app; son literales de los manuales del taller. Los pegó el responsable (validados a
 * 2026-08-06, ver docs/TEXTOS_MANUAL_RANURAS.md) en `CONCEPTOS_FISCALES` (explicación + fecha
 * de criterio de cada cajón) y en `AVISO_721` / `NOTA_172_173`. El marcador `{{TEXTO-MANUAL}}`
 * (MARCADOR_TEXTO) sigue disponible para ranuras aún sin literal (p. ej. casillas de un
 * ejercicio nuevo). El motor solo calcula números y estructura; las etiquetas estructurales
 * (nombres de los cajones) no son calificaciones.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Cajones (DOMINIO §3.3 / §4 FISCAL):
 *   a) AHORRO   — ganancias y pérdidas patrimoniales por transmisión onerosa: VENTA,
 *                 PERMUTA (entregada) y PAGO. Neto por operación desde el FIFO.
 *   b) RCM      — rendimientos del capital mobiliario: RENDIMIENTO (staking, lending) a
 *                 contravalor del día.
 *   c) ACTIVIDAD ECONÓMICA — MINERÍA (total informativo).
 *   d) BASE GENERAL — ganancias no derivadas de transmisión: AIRDROP.
 *   f) DERIVADOS — resultado neto de posiciones liquidadas por diferencias (D6): va también
 *      a la base del ahorro, pero se presenta aparte porque no nace de una transmisión con
 *      FIFO sino del neto que liquida la plataforma.
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

/**
 * Motivo por el que una pérdida de donación entregada no se computa. Es CITA NORMATIVA
 * literal del art. 33.5.c LIRPF (Ley 35/2006, BOE-A-2006-20764, texto consolidado
 * verificado contra el BOE el 21-8-2026), no una calificación redactada por la app: la
 * Regla de oro 5 prohíbe parafrasear criterios, no citar la ley.
 */
export const MOTIVO_33_5_C =
  'Art. 33.5.c) LIRPF: «No se computarán como pérdidas patrimoniales las siguientes: […] c) Las debidas a transmisiones lucrativas por actos ínter vivos o a liberalidades.» La ganancia, en cambio, sí se computa.'

/** Los cinco cajones fiscales del resumen. */
/**
 * Los cajones en los que el motor reparte el ejercicio. Son SEIS claves para CINCO SALIDAS
 * del registro: `derivados` no es una base imponible distinta, sino una subdivisión de la
 * primera salida —ganancias y pérdidas patrimoniales de la base del ahorro— que se separa
 * porque una liquidación por diferencias no consume lote FIFO y su trazabilidad es otra
 * (no hay transmisión del subyacente que casar con una adquisición). Al presentarlo y al
 * declararlo, `ahorro` y `derivados` van al mismo apartado. Ver [MT] U9.1 y Anexo C.
 */
export type ConceptoFiscal =
  | 'ahorro'
  | 'derivados'
  | 'rcm'
  | 'actividad-economica'
  | 'base-general'
  | 'perdidas'

/**
 * Definición estructural de un cajón fiscal. `etiqueta` y `baseImponible` son terminología
 * estructural (nombres de la base), NO calificaciones: la calificación fiscal literal vive
 * en `explicacion` y `fechaCriterio` (literales de los manuales del taller).
 */
export interface DefinicionConcepto {
  readonly clave: ConceptoFiscal
  /** Nombre del cajón para la UI (estructural). */
  readonly etiqueta: string
  /** Nombre de la base imponible en la que encaja (estructural). */
  readonly baseImponible: string
  /** Tipos de operación que alimentan el cajón. */
  readonly tipos: readonly TipoOperacion[]
  /** Explicación fiscal literal del manual (con su cita). Ver DOMINIO.md / manuales del taller. */
  readonly explicacion: string
  /** Fecha de criterio de la calificación (literal del manual, con «Verificado a …»). */
  readonly fechaCriterio: string
}

/**
 * CONCEPTOS_FISCALES — los cinco cajones, con sus tipos y sus textos del manual. Las
 * etiquetas son estructurales; la calificación fiscal literal vive en `explicacion`/`fechaCriterio`.
 */
export const CONCEPTOS_FISCALES: Readonly<Record<ConceptoFiscal, DefinicionConcepto>> = {
  ahorro: {
    clave: 'ahorro',
    etiqueta: 'Ganancias y pérdidas por transmisión',
    baseImponible: 'Base imponible del ahorro',
    // DONACIÓN entra desde la v1.6.0: la donación ENTREGADA es transmisión lucrativa ínter
    // vivos y, por tanto, alteración patrimonial en el DONANTE. Se valora por las normas
    // del ISD sin exceder el valor de mercado (art. 36 LIRPF, verificado contra el BOE el
    // 21-8-2026) y su eventual PÉRDIDA no se computa (art. 33.5.c LIRPF, literal: «No se
    // computarán como pérdidas patrimoniales las siguientes: […] c) Las debidas a
    // transmisiones lucrativas por actos ínter vivos o a liberalidades»). La donación
    // RECIBIDA no entra: en el donatario no hay renta en el IRPF, tributa por el ISD.
    tipos: ['VENTA', 'PERMUTA', 'PAGO', 'DONACION'],
    explicacion:
      '«Alteraciones CON transmisión. La variación de valor aflora porque un elemento patrimonial sale del patrimonio […]. Se cuantifican por diferencia entre el valor de transmisión y el valor de adquisición (arts. 34 a 37 LIRPF) y se integran en la base imponible del ahorro (art. 46.b).» En las ventas parciales, la DGT «sostiene que las criptomonedas de un mismo tipo son bienes homogéneos y que […] se entienden transmitidas las adquiridas en primer lugar (el método FIFO; consultas V0975-22 y V2520-22)». La STSJ PV 37/2025, de 9-1-2025 (ROJ: STSJ PV 41/2025), rechazó ese planteamiento en territorio foral; «la sentencia no constituye jurisprudencia consolidada». — [MF] Unidad 3, «Alteraciones patrimoniales» y Unidad 1 (FIFO y controversia foral).',
    fechaCriterio:
      'FIFO: DGT V0975-22 y V2520-22 (2022), vigente; V0525-25 (28-3-2025) y V0491-26 sobre cola única. Controversia foral: STSJ PV 37/2025, de 9-1-2025, no firme. Verificado a 6-8-2026.',
  },
  derivados: {
    clave: 'derivados',
    etiqueta: 'Liquidación de derivados por diferencias',
    baseImponible: 'Base imponible del ahorro',
    tipos: ['LIQUIDACION_DERIVADO'],
    explicacion:
      '«Las ganancias o pérdidas de las operaciones apalancadas […] sí son alteraciones patrimoniales computables en la base del ahorro. En muchas plataformas, estas posiciones (futuros, CFD, perpetuos) no se calculan operación a operación por diferencia de valores de adquisición y transmisión, sino que se liquidan por el resultado neto que la propia plataforma arroja, y ese resultado es el que se integra.» PRECISIONES de la revisión de 20-8-2026, ya incorporadas al [MT] U6.1 y U9.3: (i) la INTEGRACIÓN en la base del ahorro la manda el art. 46.b) LIRPF y la compensación el art. 49.1.b) y 2 —el 33.1 califica y el 34 cuantifica—, con el flanco de la ausencia de transmisión cubierto por las SSTS 803/2022 y 804/2022, de 21-6-2022 (rec. 7121/2020 y 7749/2020); (ii) la IMPUTACIÓN es DIARIA cuando el contrato liquida periódicamente, «aun cuando la posición contractual no se hubiese cerrado al finalizar dicho período impositivo» (art. 14.1.c LIRPF; V2115-21, reiterada en V2788-21 y V3183-20): un perpetuo liquida funding cada ocho horas, de modo que una posición abierta a 31-12 ya ha generado renta; (iii) sobre gastos, las comisiones de apertura y cierre computan, los intereses PAGADOS no, y los intereses PERCIBIDOS sí («un componente más a tener en cuenta», V2115-21); (iv) el art. 37.1.m sigue citando el derogado RD 1814/1991, cuya sucesión llega hoy al RD 814/2023 (1814/1991 → 1282/2010 → 1464/2018 → 814/2023), y en todo caso no alcanza a un perpetuo de exchange; (v) un derivado sobre cripto NO es un criptoactivo (MiCA art. 2.4.a y considerando 9), luego queda fuera del art. 37.1.h, del FIFO del art. 37.2 y de los modelos 172/173/721. — [MT] U6.1, U9.3 y Anexo C; [MF] Unidad 4, «Comisiones y apalancamiento».',
    fechaCriterio:
      'Sin consulta de la DGT específica sobre derivados con subyacente cripto (barrido hasta ago-2026): es analogía con la línea de contratos por diferencias y NO ampara la protección del art. 89 LGT. Línea: V0076-09, V0597-18, V2770-19, V3183-20, V0503-21, V0885-21, V2115-21, V2788-21 (precedente para futuros, V3755-16). Se retira V0917-14: resolvía sobre el régimen de base general de 2013-2014, derogado desde 1-1-2015 por la Ley 16/2012. El riesgo real es probatorio: STSJ Andalucía (Málaga) ECLI:ES:TSJAND:2023:18410, de 12-12-2023, rechazó 208.501 € de pérdidas en CFD por falta de prueba. Verificado a 20-8-2026.',
  },
  rcm: {
    clave: 'rcm',
    etiqueta: 'Rendimientos del capital mobiliario',
    baseImponible: 'Base imponible del ahorro',
    tipos: ['RENDIMIENTO'],
    explicacion:
      '«Las recompensas obtenidas por poner tokens en stake se califican como rendimientos del capital mobiliario del art. 25.2 LIRPF, procedentes de la cesión a terceros de capitales propios. Así lo sostiene la DGT desde la consulta V1766-22, de 26 de julio de 2022, y lo consolida la V0612-26, de 17 de marzo de 2026. […] los rendimientos se integran en la base del ahorro; se valoran por su valor de mercado en euros el día de su percepción (rendimiento en especie, art. 43.1 LIRPF); y […] la DGT no admite deducir gastos asociados (criterio V0648-24).» Los intereses de lending tienen la misma calificación (V0648-24, de 11-4-2024). — [MF] Unidad 4, «El staking: rendimiento del capital mobiliario».',
    fechaCriterio:
      'V1766-22 (26-7-2022), consolidada por V0612-26 (17-3-2026, que concreta además la imputación temporal ex art. 14.1.a LIRPF); lending V0648-24 (11-4-2024). Verificado a 6-8-2026.',
  },
  'actividad-economica': {
    clave: 'actividad-economica',
    etiqueta: 'Actividad económica (minería)',
    baseImponible: 'Base imponible general',
    tipos: ['MINERIA'],
    explicacion:
      '«La minería basada en PoW constituye una actividad económica ya que hay una ordenación por cuenta propia de medios materiales y humanos dirigida a la obtención de rendimientos, que es exactamente el presupuesto del artículo 27.1 LIRPF. Sus consecuencias son que los rendimientos netos se integran en la base general, se determinan por diferencia entre ingresos y gastos deducibles (amortización del hardware, electricidad, etc.) y quedan sujetos a las obligaciones formales del empresario o profesional (alta censal, libros registro, pagos fraccionados).» En IVA, la V3625-16 la considera operación no sujeta, sin derecho a deducir el IVA soportado. — [MF] Unidad 4, «La minería PoW: actividad económica no sujeta a IVA».',
    fechaCriterio:
      'Art. 27.1 LIRPF; IVA/IAE: DGT V3625-16 (31-8-2016). Verificado a 6-8-2026.',
  },
  'base-general': {
    clave: 'base-general',
    etiqueta: 'Ganancias no derivadas de transmisión (airdrops)',
    baseImponible: 'Base imponible general',
    tipos: ['AIRDROP'],
    explicacion:
      '«El airdrop, esto es, la recepción gratuita de tokens, normalmente con fines promocionales, constituye, según la Consulta General 0018-23, de 29 de junio de 2023, una ganancia patrimonial que no deriva de transmisión, integrada en la base general (arts. 33.1 y 37.1.l LIRPF) y valorada por el valor de mercado de los tokens en el momento de su recepción. Ese mismo valor cumple una doble función: (i) es la renta que se declara ahora y (ii) será el valor de adquisición cuando esos tokens se transmitan en el futuro.» Atención a la signatura: la 0018-23 es consulta general, «no vincula a la Administración conforme al artículo 89 LGT, aunque expresa su criterio». — [MF] Unidad 3, «Airdrops y hard forks: lo resuelto y la zona gris» y Unidad 1 (valor de las consultas).',
    fechaCriterio:
      'Consulta General 0018-23 (29-6-2023) — NO vinculante; valor orientativo. Verificado a 6-8-2026.',
  },
  perdidas: {
    clave: 'perdidas',
    etiqueta: 'Pérdidas (robo, estafa, extravío)',
    baseImponible: 'Condicionada a requisitos y prueba',
    tipos: ['PERDIDA'],
    explicacion:
      'Tres tipologías con suerte distinta: «(i) las pérdidas por error de manipulación […]; (ii) los robos […]; y (iii) las estafas». Sobre el error «no existe criterio publicado de la DGT» y «la posición prudente es no computar la pérdida sin un soporte probatorio excepcional». «Los robos y las estafas, por el contrario, sí pueden generar pérdidas patrimoniales deducibles […]. El patrimonio disminuye sin contraprestación y por ello se integran en la base general, no en la del ahorro.» Robo: V1174-25 (1-7-2025) «admite computar la pérdida debidamente justificada»; «la denuncia formal es condición necesaria y no suficiente». Estafa de autor desconocido: se computa en el ejercicio del fraude «siempre que quede debidamente justificada» (V0625-24 y V1828-24). Deudor identificado: rige el art. 14.2.k) LIRPF y «mientras pende un proceso penal contra el presunto estafador no cabe deducir la pérdida» (V1579-22 y V1134-25). — [MF] Unidad 2, «Pérdidas, robos y estafas».',
    fechaCriterio:
      'Robo: V1174-25 (1-7-2025). Estafas: V0625-24 (11-4-2024), V1828-24 (1-8-2024); deudor identificado V1579-22 (30-6-2022) y V1134-25 (27-6-2025). Cuantificación (adquisición vs mercado) sin criterio publicado: tesis prudente, valor de adquisición. Verificado a 6-8-2026.',
  },
}

/**
 * AVISO_721 — texto informativo literal del modelo 721 (saldos en el extranjero). Se muestra
 * como llamada de atención; nunca es un cálculo de la obligación (Regla de oro 5).
 */
export const AVISO_721 =
  '«El modelo 721 obliga a los residentes a declarar las monedas virtuales situadas en el extranjero, esto es, custodiadas por personas o entidades no residentes, cuando los saldos conjuntos superen los 50.000 euros, con plazo de presentación entre el 1 de enero y el 31 de marzo del ejercicio siguiente» (Ley 11/2021, RD 249/2023, OM HFP/886/2023 y HFP/887/2023). «La exclusión de la autocustodia no es solo interpretación doctrinal.» La autoridad citada es triple y siempre en este orden: V2290-23, de 28-7-2023 (monederos «hot» y «cold»), que fija el criterio — las monedas cuyas claves controla el contribuyente «no se tendrían en cuenta en el cómputo de los saldos y, en consecuencia, no se informaría sobre las mismas» —; V0941-24, de 29-4-2024 (monedero de papel), que es la cita más precisa por su objeto; y las preguntas frecuentes del modelo 721 de la Sede electrónica de la AEAT, que reproducen ese mismo criterio y son la fuente oficial comprobable. Complementarias: V2185-23, de 25-7-2023 (el saldo en moneda fiduciaria en un exchange extranjero NO va al 721, sino al bloque de cuentas del modelo 720), V2304-23, de 1-8-2023 (sin obligación por debajo de 50.000 €), V1012-25 (saldo determinante) y V1030-25 (años sucesivos tras ventas parciales). Cotejado a 19-8-2026 ([MT] Anexo VI, tercera ronda). Este aviso es solo una llamada de atención calculada sobre las ubicaciones marcadas como extranjeras: no es un cálculo de la obligación. — [MF] Unidad 1, «Modelos 721/172/173» · [MT] Unidad 10, ap. 1.'

/**
 * NOTA_172_173 — texto informativo literal de los modelos 172 (saldos) y 173 (operaciones),
 * que declaran los proveedores establecidos en España (declaraciones informativas de terceros).
 */
export const NOTA_172_173 =
  '«Los modelos 172 (saldos) y 173 (operaciones) recaen […] sobre los proveedores de servicios sobre criptoactivos establecidos en España, que deben suministrar anualmente, en el mes de enero, los saldos y las operaciones de sus clientes.» «La información de los modelos 172 y 173 alimenta directamente los datos fiscales de la campaña de Renta» (aviso «CR2»): «el contribuyente debe partir de la base de que la Administración ya conoce sus saldos y operaciones en plataformas españolas antes de que presente la declaración, y de que ese perímetro se ampliará a los proveedores extranjeros con los primeros intercambios DAC8/CARF». — [MF] Unidad 1, «Modelos 721/172/173» y Unidad 4 (datos fiscales).'

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
  /**
   * true si el resultado es NEGATIVO y la pérdida NO se computa. Único supuesto que el
   * motor aplica hoy: la transmisión lucrativa ínter vivos del art. 33.5.c LIRPF (donación
   * entregada). La línea sigue apareciendo en el desglose —el hecho existió y hay que
   * poder verlo— pero no suma al total de pérdidas.
   */
  perdidaNoComputable?: boolean
  /** Norma por la que no se computa, para mostrarla junto a la línea. */
  motivoNoComputable?: string
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
  /**
   * Suma (signo negativo) de las pérdidas EXCLUIDAS por norma, hoy solo las del
   * art. 33.5.c LIRPF. No entra en `netoEUR`: es informativa, para que el alumno vea que
   * el motor las ha visto y por qué no las ha computado.
   */
  perdidasNoComputablesEUR: string
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
  /**
   * Resultado neto de las posiciones en derivados liquidadas por diferencias (D6). Va a la
   * base del ahorro igual que el bloque `ahorro`, pero se presenta aparte porque no procede
   * de una transmisión con FIFO: la cifra la fija la liquidación de la plataforma.
   */
  derivados: BloqueIngresos
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
  let noComputables = CERO

  for (const t of transmisiones) {
    if (t.ejercicio !== ejercicio) continue
    const tipo = tipoPorApunte.get(t.apunteId)
    if (!tipo || !tiposAhorro.has(tipo)) continue
    const resultado = D(t.resultadoEUR)
    const ganancia = resultado.greaterThanOrEqualTo(0)
    // Art. 33.5.c LIRPF: la pérdida de una transmisión lucrativa ínter vivos no se computa.
    // La ganancia sí, y por eso la exclusión se comprueba solo en el lado negativo.
    const noComputable = !ganancia && t.lucrativa === true
    if (ganancia) ganancias = ganancias.plus(resultado)
    else if (noComputable) noComputables = noComputables.plus(resultado)
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
      ...(noComputable
        ? {
            perdidaNoComputable: true,
            motivoNoComputable: MOTIVO_33_5_C,
          }
        : {}),
    })
  }

  operaciones.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  return {
    operaciones,
    gananciasEUR: aCadena(ganancias),
    perdidasEUR: aCadena(perdidas),
    netoEUR: aCadena(ganancias.plus(perdidas)),
    perdidasNoComputablesEUR: aCadena(noComputables),
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
    derivados: calcularIngresos(apuntes, ejercicio, CONCEPTOS_FISCALES.derivados.tipos),
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
