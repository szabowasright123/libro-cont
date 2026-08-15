/**
 * perdidaSubtipos.ts — catálogo de subtipos de PÉRDIDA (derivada D2, P9.4).
 *
 * Capa UI/datos: son LITERALES (resumen del registro de decisiones del proyecto, §D2.2, validado el 8-8-2026) para mostrar en
 * el formulario de PÉRDIDA el aviso de criterio y el checklist probatorio que corresponde a cada
 * subtipo. NO es cálculo del motor: el subtipo no altera saldos, FIFO ni cuadre. El estado
 * probatorio «duro» lo sigue calculando `engine/archivo.ts` (intocable); esto es orientación.
 *
 * Prudencia (Regla de oro 5): la calificación fiscal es orientativa y con fecha de criterio; no
 * sustituye la revisión de un profesional. Toda PÉRDIDA computable va a la BASE GENERAL, nunca
 * al ahorro (alteración patrimonial sin transmisión).
 */
import type { SubtipoPerdida } from '../../data/tipos'

/** Definición de un subtipo de pérdida (para el formulario y el resumen fiscal). */
export interface DefinicionSubtipoPerdida {
  readonly clave: SubtipoPerdida
  /** Etiqueta para el selector. */
  readonly etiqueta: string
  /** Encaje fiscal en una línea (siempre BASE GENERAL cuando es computable). */
  readonly encajeFiscal: string
  /** Aviso de criterio (resumen del criterio validado, con su fecha/consultas). */
  readonly aviso: string
  /** Checklist probatorio orientativo del subtipo (qué reunir). */
  readonly checklist: readonly string[]
}

/** Fecha de criterio común de los subtipos (validación del responsable). */
export const FECHA_CRITERIO_PERDIDAS = 'Criterio validado a 8-8-2026.'

/**
 * SUBTIPOS_PERDIDA — los tres subtipos del taller más `sin-clasificar` (migración/pendiente).
 * Textos: resumen del criterio validado el 8-8-2026. Deducibilidad SIEMPRE condicionada a prueba.
 */
export const SUBTIPOS_PERDIDA: Readonly<Record<SubtipoPerdida, DefinicionSubtipoPerdida>> = {
  'sin-clasificar': {
    clave: 'sin-clasificar',
    etiqueta: 'Sin clasificar',
    encajeFiscal: 'Clasifícala para ver su criterio fiscal y su checklist.',
    aviso:
      'Elige el subtipo (error/extravío · robo · estafa) para ver el criterio de deducibilidad y el ' +
      'expediente probatorio que corresponde. Toda pérdida computable va a la BASE GENERAL, nunca al ahorro.',
    checklist: [
      'Clasifica el subtipo para ver el checklist probatorio específico.',
    ],
  },
  error: {
    clave: 'error',
    etiqueta: 'Error / extravío de claves',
    encajeFiscal: 'Posible pérdida en BASE GENERAL — posición prudente: NO computar sin soporte excepcional.',
    aviso:
      'Sin criterio publicado de la DGT. Su deducción no está excluida de forma categórica, pero tropieza ' +
      'con el art. 33.5.a) LIRPF: habría que acreditar no solo el envío erróneo o la pérdida de las claves, ' +
      'sino la imposibilidad definitiva de recuperación (difícil si las monedas siguen visibles en la cadena). ' +
      'Posición prudente: no computar sin soporte probatorio excepcional. Contablemente sí procede dar de baja ' +
      'el activo; esa divergencia contable/fiscal se documenta en la contabilidad de la cartera.',
    checklist: [
      'Prueba del envío erróneo o de la pérdida de las claves (capturas, correspondencia, txid).',
      'Acreditación de la imposibilidad definitiva de recuperación de los fondos.',
      'Justificantes de adquisición originales (fijan el valor de adquisición).',
    ],
  },
  robo: {
    clave: 'robo',
    etiqueta: 'Robo',
    encajeFiscal: 'Pérdida patrimonial computable en la BASE GENERAL del ejercicio de la sustracción.',
    aviso:
      'Pérdida patrimonial computable en la base general del ejercicio de la sustracción, con expediente ' +
      'probatorio mínimo. La denuncia es condición necesaria pero no suficiente (MF U2, V1174-25).',
    checklist: [
      '(i) Denuncia ante las FFCCSS con identificación precisa de los activos sustraídos.',
      '(ii) Hashes de las transacciones de salida y direcciones de destino, con acreditación de la titularidad previa de las direcciones vaciadas (extractos, control de claves).',
      '(iii) Justificantes de adquisición originales (fijan el valor de adquisición).',
      '(iv) En su caso, informes periciales o técnicos del incidente.',
      '(v) Trazabilidad posterior de los fondos, si la hay.',
    ],
  },
  estafa: {
    clave: 'estafa',
    etiqueta: 'Estafa',
    encajeFiscal: 'BASE GENERAL — criterio dual según subsista o no un derecho de crédito frente a deudor identificado.',
    aviso:
      'Criterio dual de la DGT (2024–2025). Autor desconocido o no identificable (phishing, ciberestafas): no ' +
      'hay crédito; la pérdida del art. 33.1 LIRPF se computa en la base general del ejercicio del fraude, ' +
      'debidamente justificada (V0625-24, V1828-24). Deudor identificado (plataforma o persona conocida, aunque ' +
      'insolvente): mientras subsista el crédito NO hay pérdida; rige la imputación temporal del art. 14.2.k) ' +
      'LIRPF (quita eficaz; convenio concursal con quita o conclusión del concurso sin cobro; o un año desde el ' +
      'inicio del procedimiento judicial de ejecución sin cobro). El proceso penal pendiente contra el presunto ' +
      'estafador NO es ese procedimiento de ejecución y no inicia el cómputo del año (V1579-22, V1134-25).',
    checklist: [
      'Denuncia y documentación del fraude (correspondencia, capturas, contrato).',
      'Justificantes de adquisición originales (valor de adquisición).',
      'Trazabilidad on-chain de los fondos (txids, direcciones de destino).',
      'Si hay deudor identificado: documentación del crédito y del procedimiento (art. 14.2.k) que fija la imputación temporal.',
    ],
  },
}

/** Lista ordenada de subtipos elegibles en el formulario (con «sin-clasificar» al final). */
export const SUBTIPOS_PERDIDA_ELEGIBLES: readonly SubtipoPerdida[] = [
  'error',
  'robo',
  'estafa',
  'sin-clasificar',
]
