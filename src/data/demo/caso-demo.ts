/**
 * caso-demo.ts — dataset del CASO DE EJEMPLO COMPLETO (2024–2025) para el onboarding.
 *
 * Lo carga el botón «Cargar caso de ejemplo» de Inicio (repositorio.cargarCasoDemo). Es la
 * historia de un alumno del taller en DOS capítulos, pensada para que TODA la app se vea con
 * datos: Diario (los 11 tipos con relevancia práctica), Trazabilidad (sellos KYC/no-KYC y
 * mezcla), Archivo (los 29 apuntes con su expediente probatorio COMPLETO), Cartera (precios
 * manuales, plusvalía latente y GyP por ejercicio, con un 2025 en negativo) y Fiscal (dos
 * ejercicios, cajones, subtipo de pérdida y aviso 721 con doble fecha).
 *
 *  · CAPÍTULO 2024 — el mini-caso 2024 del taller, TRANSCRITO VERBATIM del golden. Compras,
 *    ventas, permutas, staking, airdrop, minería y una estafa por phishing. Saldos a
 *    31/12/2024: BTC 0,4068 · ETH 1,049 · USDC 305 · EUR 4.254 (Regla de oro 9).
 *  · CAPÍTULO 2025 — la ampliación didáctica: nueva compra grande en Kraken, venta de ETH con
 *    pérdida, apertura de un canal Lightning, un PAGO por Lightning (factura), una DONACIÓN
 *    entregada, rendimientos, la retirada a autocustodia en noviembre (que saca el saldo del
 *    perímetro del 721 antes del 31/12: la lección de la doble fecha) y un AJUSTE auditable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGLA DE ORO 9 (golden intocable): el capítulo 2024 de este fichero NO importa de
 * `tests/golden/` ni al revés; `tests/demo/caso-demo.test.ts` es el único puente y garantiza
 * por IGUALDAD ESTRUCTURAL que los apuntes 2024-* siguen siendo los del golden
 * (`tests/golden/mini-caso.ts`) y que Kraken/Ledger conservan sus campos originales. El
 * capítulo 2025 SOLO AÑADE apuntes posteriores: nunca cambia saldos ni GyP de 2024.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Módulo de datos puro: sin React, sin Dexie. Los tipos son de dominio (`Apunte`, etc.);
 * el subtipo de PÉRDIDA y los justificantes usan tipos de la capa de datos.
 */
import {
  type Activo,
  type Apunte,
  type RutaConvencional,
  type Ubicacion,
  UBICACION_EXTERIOR,
} from '../../engine/types'
import type { PrecioRegistro, SubtipoPerdida } from '../tipos'
import type { SaldoRealDeclarado } from '../import/json-backup'

const KRAKEN = 'Kraken'
const LEDGER = 'Ledger'
const CANAL_LN = 'CanalLN'

/**
 * Ubicaciones del caso de ejemplo. Kraken y Ledger son las del mini-caso 2024 (sus campos
 * originales — id, nombre, tipo, kyc, fechaAlta — son golden y no cambian); la ficha ampliada
 * (vía de evidencia, extranjero/país, autocustodia) y el canal Lightning son del capítulo 2025.
 *
 *  · Kraken — exchange KYC radicado en el EXTRANJERO (MiCA — Irlanda): computa para el aviso 721.
 *  · Ledger — wallet no-KYC de AUTOCUSTODIA: nunca computa para el 721 (FAQ AEAT).
 *  · Canal Lightning — ubicación de tipo «canal», autocustodia (regla de identidad del taller:
 *    el canal es una ubicación propia; su evidencia son facturas/preimages y aperturas on-chain).
 */
export const UBICACIONES_CASO_DEMO: Ubicacion[] = [
  {
    id: KRAKEN,
    nombre: 'Kraken',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2024-01-01T00:00:00',
    viaEvidencia: 'exchange-kyc',
    extranjero: true,
    pais: 'Irlanda',
    notasEvidencia: 'Custodio no establecido en España (MiCA — Irlanda): computa para el aviso 721.',
  },
  {
    id: LEDGER,
    nombre: 'Ledger',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2024-01-01T00:00:00',
    viaEvidencia: 'wallet-autocustodia',
    autocustodia: true,
    notasEvidencia: 'Claves propias: fuera del perímetro del 721 (FAQ AEAT).',
  },
  {
    id: CANAL_LN,
    nombre: 'Canal Lightning',
    tipo: 'canal',
    kyc: false,
    fechaAlta: '2025-05-20T00:00:00',
    viaEvidencia: 'canal-lightning',
    autocustodia: true,
    notasEvidencia: 'Canal propio abierto el 20/05/2025 (apunte 2025-005); facturas y preimages.',
  },
]

/**
 * Activos del caso de ejemplo, además de BTC y EUR de serie (que el repositorio añade solo).
 * Sin estos, los apuntes de ETH/USDC/ADA/TOKENX no tendrían activo en el catálogo.
 */
export const ACTIVOS_CASO_DEMO: Activo[] = [
  { simbolo: 'ETH', nombre: 'Ethereum', decimales: 8, esFiat: false },
  { simbolo: 'USDC', nombre: 'USD Coin', decimales: 6, esFiat: false },
  { simbolo: 'ADA', nombre: 'Cardano', decimales: 6, esFiat: false },
  { simbolo: 'TOKENX', nombre: 'Token X (ejemplo)', decimales: 8, esFiat: false },
]

/**
 * CAPÍTULO 2024 — los 19 apuntes del mini-caso 2024, transcripción idéntica al golden
 * (tests/golden/mini-caso.ts). NO TOCAR: cualquier cambio rompe la Regla de oro 9 y el
 * puente de igualdad estructural. Los contravalores «(supuesto)» son precios de mercado
 * 2024 asumidos; los «(CSV)», datos duros del mini-caso.
 */
export const APUNTES_2024_CASO_DEMO: Apunte[] = [
  {
    id: '2024-001',
    fechaHora: '2024-01-15T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'EUR',
    cantidadEntrada: '25000',
    notas: 'Ingreso inicial de fiat (deposito_fiat).',
  },
  {
    id: '2024-002',
    fechaHora: '2024-01-16T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '20000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.5',
    comisionCantidad: '30',
    comisionActivo: 'EUR',
    contravalorEUR: '20000',
    notas: 'Compra BTC con EUR.',
  },
  {
    id: '2024-003',
    fechaHora: '2024-01-20T11:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '4400',
    activoEntrada: 'ETH',
    cantidadEntrada: '2',
    comisionCantidad: '6',
    comisionActivo: 'EUR',
    contravalorEUR: '4400',
    notas: 'Compra ETH con EUR.',
  },
  {
    id: '2024-004',
    fechaHora: '2024-02-15T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'ETH',
    cantidadEntrada: '0.05',
    contravalorEUR: '150',
    notas: 'Recompensa staking ETH (RCM).',
  },
  {
    id: '2024-005',
    fechaHora: '2024-03-01T12:00:00',
    tipo: 'AIRDROP',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'TOKENX',
    cantidadEntrada: '100',
    contravalorEUR: '100',
    notas: 'Airdrop token ficticio TOKENX.',
  },
  {
    id: '2024-006',
    fechaHora: '2024-03-10T13:00:00',
    tipo: 'PERMUTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'ETH',
    cantidadSalida: '1',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.05',
    comisionCantidad: '0.001',
    comisionActivo: 'ETH',
    contravalorEUR: '3000',
    notas: 'Permuta cripto-cripto ETH por BTC.',
  },
  {
    id: '2024-007',
    fechaHora: '2024-03-20T14:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: LEDGER,
    activoSalida: 'BTC',
    cantidadSalida: '0.3',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.3',
    comisionCantidad: '0.0002',
    comisionActivo: 'BTC',
    notas: 'Envío a wallet propia Ledger (transferencia interna).',
  },
  {
    id: '2024-008',
    fechaHora: '2024-04-05T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.1',
    activoEntrada: 'EUR',
    cantidadEntrada: '6500',
    comisionCantidad: '10',
    comisionActivo: 'EUR',
    contravalorEUR: '6500',
    notas: 'Venta parcial BTC.',
  },
  {
    id: '2024-009',
    fechaHora: '2024-04-15T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '300',
    activoEntrada: 'ADA',
    cantidadEntrada: '500',
    contravalorEUR: '300',
    notas: 'Compra ADA.',
  },
  {
    id: '2024-010',
    fechaHora: '2024-05-15T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'ADA',
    cantidadEntrada: '5',
    contravalorEUR: '2',
    notas: 'Recompensa staking ADA (RCM).',
  },
  {
    id: '2024-011',
    fechaHora: '2024-05-20T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'TOKENX',
    cantidadSalida: '100',
    activoEntrada: 'EUR',
    cantidadEntrada: '150',
    contravalorEUR: '150',
    notas: 'Venta del airdrop TOKENX.',
  },
  {
    id: '2024-012',
    fechaHora: '2024-06-01T12:00:00',
    tipo: 'MINERIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: LEDGER,
    activoEntrada: 'BTC',
    cantidadEntrada: '0.002',
    contravalorEUR: '110',
    notas: 'Recompensa minería PoW.',
  },
  {
    id: '2024-013',
    fechaHora: '2024-06-10T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'ADA',
    cantidadSalida: '505',
    activoEntrada: 'EUR',
    cantidadEntrada: '350',
    contravalorEUR: '350',
    notas: 'Venta total ADA (incluye las 5 de staking).',
  },
  {
    id: '2024-014',
    fechaHora: '2024-07-01T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '1200',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.02',
    contravalorEUR: '1200',
    notas: 'Recompra BTC.',
  },
  {
    id: '2024-015',
    fechaHora: '2024-07-15T10:00:00',
    tipo: 'PERMUTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.01',
    activoEntrada: 'USDC',
    cantidadEntrada: '300',
    contravalorEUR: '550',
    notas: 'Permuta BTC por stablecoin USDC.',
  },
  {
    id: '2024-016',
    fechaHora: '2024-08-15T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'USDC',
    cantidadEntrada: '5',
    contravalorEUR: '5',
    notas: 'Interés por lending de USDC (RCM).',
  },
  {
    id: '2024-017',
    fechaHora: '2024-09-01T12:00:00',
    tipo: 'PERDIDA',
    ubicacionOrigen: LEDGER,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.005',
    contravalorEUR: '0',
    notas: 'Robo/estafa phishing en wallet.',
  },
  {
    id: '2024-018',
    fechaHora: '2024-09-15T10:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'EUR',
    cantidadSalida: '5000',
    notas: 'Retirada de fiat a cuenta bancaria.',
  },
  {
    id: '2024-019',
    fechaHora: '2024-10-01T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.05',
    activoEntrada: 'EUR',
    cantidadEntrada: '3200',
    contravalorEUR: '3200',
    notas: 'Venta final BTC.',
  },
]

/**
 * CAPÍTULO 2025 — la ampliación didáctica (10 apuntes, en orden cronológico estricto:
 * la renumeración les asigna 2025-001…2025-010). Añade los tipos que 2024 no tocaba
 * (PAGO, DONACIÓN, AJUSTE), el canal Lightning y la historia del 721 con doble fecha:
 * a 20/10 el saldo de Kraken (extranjero) valorado supera los 50.000 €; el 12/11 el alumno
 * retira 0,5 BTC a autocustodia y el corte normativo de 31/12 queda por debajo del umbral.
 *
 * Contravalores: precios de mercado 2025 ASUMIDOS y redondeados (misma convención
 * «(supuesto)» que el capítulo 2024): BTC ≈ 84.400 € (ene) · 95.000 € (jun) · 90.000 € (sep)
 * · 98.000 € (oct); ETH ≈ 1.850 € en el retroceso de abril.
 */
export const APUNTES_2025_CASO_DEMO: Apunte[] = [
  {
    id: '2025-001',
    fechaHora: '2025-01-10T09:30:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'EUR',
    cantidadEntrada: '40000',
    notas: 'Nueva aportación de ahorro desde el banco (transferencia SEPA).',
  },
  {
    id: '2025-002',
    fechaHora: '2025-01-16T10:15:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '38000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.45',
    comisionCantidad: '55',
    comisionActivo: 'EUR',
    contravalorEUR: '38000',
    notas: 'Compra grande de BTC (supuesto: ≈ 84.400 €/BTC). La comisión EUR suma al coste del lote.',
  },
  {
    id: '2025-003',
    fechaHora: '2025-03-12T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'USDC',
    cantidadEntrada: '6',
    contravalorEUR: '6',
    notas: 'Interés por lending de USDC (RCM). Contravalor según liquidación de la plataforma.',
  },
  {
    id: '2025-004',
    fechaHora: '2025-04-08T11:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'ETH',
    cantidadSalida: '0.8',
    activoEntrada: 'EUR',
    cantidadEntrada: '1480',
    comisionCantidad: '5',
    comisionActivo: 'EUR',
    contravalorEUR: '1480',
    notas: 'Venta de ETH en un retroceso (supuesto: ≈ 1.850 €/ETH): pérdida de transmisión (FIFO).',
  },
  {
    id: '2025-005',
    fechaHora: '2025-05-20T17:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: CANAL_LN,
    activoSalida: 'BTC',
    cantidadSalida: '0.02',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.02',
    comisionCantidad: '0.00005',
    comisionActivo: 'BTC',
    notas: 'Apertura de canal Lightning con fondos propios (funding on-chain). El canal es una ubicación.',
  },
  {
    id: '2025-006',
    fechaHora: '2025-06-18T13:00:00',
    tipo: 'PAGO',
    ubicacionOrigen: CANAL_LN,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.004',
    contravalorEUR: '380',
    notas: 'Pago por Lightning de un portátil reacondicionado (factura 380 €): transmisión como una venta.',
  },
  {
    id: '2025-007',
    fechaHora: '2025-09-10T10:00:00',
    tipo: 'DONACION',
    ubicacionOrigen: LEDGER,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.01',
    contravalorEUR: '900',
    notas:
      'Donación ENTREGADA a un familiar (supuesto: ≈ 90.000 €/BTC). Alteración en el donante; ' +
      'el receptor liquida ISD. Tratamiento manual: revisar con el documento de donación.',
  },
  {
    id: '2025-008',
    fechaHora: '2025-10-15T09:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'BTC',
    cantidadEntrada: '0.001',
    contravalorEUR: '98',
    notas: 'Recompensa de un programa de earn en BTC (RCM), valorada el día de su percepción.',
  },
  {
    id: '2025-009',
    fechaHora: '2025-11-12T16:30:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: LEDGER,
    activoSalida: 'BTC',
    cantidadSalida: '0.5',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.5',
    comisionCantidad: '0.0002',
    comisionActivo: 'BTC',
    notas:
      'Retirada a autocustodia («not your keys, not your coins»). A 31/12 este saldo ya no ' +
      'computa para el aviso 721: compárese el corte de 20/10 con el normativo.',
  },
  {
    id: '2025-010',
    fechaHora: '2025-12-05T10:00:00',
    tipo: 'AJUSTE',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    rectificaA: '2025-003',
    notas:
      'AJUSTE/RECTIFICACIÓN: fija el contravalor correcto del rendimiento 2025-003 (6,00 € según ' +
      'la liquidación; se había anotado 5,80 € por error de tecleo). Causa: error material. ' +
      'El apunte original se conserva; la corrección queda auditable.',
  },
]

/** Los apuntes del caso de ejemplo completo: capítulo 2024 (golden) + capítulo 2025. */
export const APUNTES_CASO_DEMO: Apunte[] = [...APUNTES_2024_CASO_DEMO, ...APUNTES_2025_CASO_DEMO]

/**
 * Subtipo de las PÉRDIDAS del caso (capa de datos, derivada D2): la pérdida de 2024 fue un
 * phishing → subtipo «estafa» (autor desconocido: computable en base general debidamente
 * justificada, V0625-24/V1828-24). Vive en un mapa APARTE para no añadir campos a los apuntes
 * del capítulo 2024, que deben seguir siendo estructuralmente idénticos al golden.
 */
export const SUBTIPOS_PERDIDA_CASO_DEMO: Readonly<Record<string, SubtipoPerdida>> = {
  '2024-017': 'estafa',
}

/** Un justificante del caso de ejemplo (dominio del dataset: enlaza por correlativo). */
export interface JustificanteCasoDemo {
  id: string
  /** Correlativo del apunte al que acompaña; '' = documento de ubicación/ejercicio (carpeta 05/06). */
  apunteId: string
  rutaConvencional: RutaConvencional
  /** Clave del requisito probatorio que cubre (casa con la checklist de engine/archivo.ts). */
  tipoDocumento: string
  referenciaExterna?: string
  notas?: string
}

/**
 * El Archivo del caso de ejemplo, COMPLETO AL 100% (decisión del responsable del taller):
 * 62 justificantes SIN fichero embebido (solo referencia externa) que cubren la checklist
 * probatoria de los 29 apuntes — cada requisito de cada tipo, en su rama KYC/no-KYC — más un
 * certificado anual en la carpeta 05 (documento de ejercicio, sin apunte asociado). El caso
 * muestra así el «expediente modelo» terminado; los huecos los pondrá el alumno al empezar
 * con sus propios datos.
 */
export const JUSTIFICANTES_CASO_DEMO: JustificanteCasoDemo[] = [
  // 2024 · depósito inicial de fiat: justificante bancario + titularidad del destino.
  {
    id: 'demo-j-2024-001-txid',
    apunteId: '2024-001',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'Justificante bancario de la transferencia SEPA de 25.000 € a Kraken (15/01/2024).',
  },
  {
    id: 'demo-j-2024-001-titularidad',
    apunteId: '2024-001',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'Perfil de la cuenta de Kraken verificada (KYC) a nombre del titular.',
  },
  // 2024 · compra BTC (Kraken, KYC): orden + extracto → completo.
  {
    id: 'demo-j-2024-002-orden',
    apunteId: '2024-002',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › Historial de órdenes › orden BTC/EUR ejecutada el 16/01/2024 (PDF).',
    notas: 'Fecha, hora, contravalor y comisión: la pieza clave de la vía KYC.',
  },
  {
    id: 'demo-j-2024-002-extracto',
    apunteId: '2024-002',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › Ledger de cuenta enero 2024 (CSV exportado al cierre del ejercicio).',
  },
  // 2024 · compra ETH: orden + extracto.
  {
    id: 'demo-j-2024-003-orden',
    apunteId: '2024-003',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden ETH/EUR ejecutada el 20/01/2024 (PDF).',
  },
  {
    id: 'demo-j-2024-003-extracto',
    apunteId: '2024-003',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › Ledger de cuenta enero 2024 (CSV): cargo de 4.400 € + comisión de 6 €.',
  },
  // 2024 · staking ETH: liquidación de recompensas + valor de mercado.
  {
    id: 'demo-j-2024-004-liquidacion',
    apunteId: '2024-004',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Kraken › historial de recompensas de staking ETH del 15/02/2024.',
  },
  {
    id: 'demo-j-2024-004-valor',
    apunteId: '2024-004',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Cotización ETH/EUR del 15/02/2024 (≈ 3.000 €/ETH), fuente verificable guardada.',
  },
  // 2024 · airdrop TOKENX: prueba de recepción + valor de mercado.
  {
    id: 'demo-j-2024-005-recepcion',
    apunteId: '2024-005',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'prueba-recepcion',
    referenciaExterna: 'Captura de la campaña del airdrop TOKENX y del abono de 100 unidades (01/03/2024).',
  },
  {
    id: 'demo-j-2024-005-valor',
    apunteId: '2024-005',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Mejor valoración disponible el día de la recepción (1,00 €/TOKENX), con su fuente.',
  },
  // 2024 · permuta ETH→BTC: comprobante + valor de mercado + identificador.
  {
    id: 'demo-j-2024-006-orden',
    apunteId: '2024-006',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-permuta',
    referenciaExterna: 'Kraken › comprobante del intercambio ETH→BTC del 10/03/2024 con ambas patas.',
  },
  {
    id: 'demo-j-2024-006-valor',
    apunteId: '2024-006',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Contravalor de la permuta: 3.000 € (0,05 BTC a ≈ 60.000 €/BTC), fuente citada.',
  },
  {
    id: 'demo-j-2024-006-txid',
    apunteId: '2024-006',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-permuta',
    referenciaExterna: 'Identificador interno de la operación en el exchange.',
  },
  // 2024 · transferencia a Ledger: txid + titularidad → completo.
  {
    id: 'demo-j-2024-007-txid',
    apunteId: '2024-007',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'txid 4f0c…9db1 — captura de mempool.space con la comisión de red (0,0002 BTC).',
  },
  {
    id: 'demo-j-2024-007-titularidad',
    apunteId: '2024-007',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'Mensaje firmado desde la dirección de recepción del Ledger (prueba de titularidad).',
  },
  // 2024 · venta parcial BTC: orden + extracto.
  {
    id: 'demo-j-2024-008-orden',
    apunteId: '2024-008',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden de venta BTC/EUR del 05/04/2024 (PDF).',
  },
  {
    id: 'demo-j-2024-008-extracto',
    apunteId: '2024-008',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › extracto con el abono de 6.500 € de la venta (05/04/2024).',
  },
  // 2024 · compra ADA: orden + extracto.
  {
    id: 'demo-j-2024-009-orden',
    apunteId: '2024-009',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden ADA/EUR ejecutada el 15/04/2024 (PDF).',
  },
  {
    id: 'demo-j-2024-009-extracto',
    apunteId: '2024-009',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › Ledger de cuenta abril 2024 (CSV): cargo de 300 €.',
  },
  // 2024 · staking ADA: liquidación + valor de mercado.
  {
    id: 'demo-j-2024-010-liquidacion',
    apunteId: '2024-010',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Kraken › historial de recompensas de staking ADA del 15/05/2024.',
  },
  {
    id: 'demo-j-2024-010-valor',
    apunteId: '2024-010',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Cotización ADA/EUR del 15/05/2024 (≈ 0,40 €/ADA), fuente guardada.',
  },
  // 2024 · venta del airdrop TOKENX: orden + extracto.
  {
    id: 'demo-j-2024-011-orden',
    apunteId: '2024-011',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden de venta TOKENX/EUR del 20/05/2024 (PDF).',
  },
  {
    id: 'demo-j-2024-011-extracto',
    apunteId: '2024-011',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › extracto con el abono de 150 € (20/05/2024).',
  },
  // 2024 · minería (Ledger, no-KYC): liquidación del pool + valor → completo.
  {
    id: 'demo-j-2024-012-pool',
    apunteId: '2024-012',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-pool',
    referenciaExterna: 'Informe del pool de minería · recompensa del 01/06/2024 con dirección de cobro propia.',
  },
  {
    id: 'demo-j-2024-012-valor',
    apunteId: '2024-012',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Cotización BTC/EUR del 01/06/2024 (fuente verificable, captura guardada).',
  },
  // 2024 · venta total ADA: orden + extracto.
  {
    id: 'demo-j-2024-013-orden',
    apunteId: '2024-013',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden de venta ADA/EUR del 10/06/2024 (PDF, 505 ADA).',
  },
  {
    id: 'demo-j-2024-013-extracto',
    apunteId: '2024-013',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › extracto con el abono de 350 € (10/06/2024).',
  },
  // 2024 · recompra BTC: orden + extracto.
  {
    id: 'demo-j-2024-014-orden',
    apunteId: '2024-014',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden BTC/EUR ejecutada el 01/07/2024 (PDF).',
  },
  {
    id: 'demo-j-2024-014-extracto',
    apunteId: '2024-014',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › Ledger de cuenta julio 2024 (CSV): cargo de 1.200 €.',
  },
  // 2024 · permuta BTC→USDC: comprobante + valor de mercado + identificador.
  {
    id: 'demo-j-2024-015-orden',
    apunteId: '2024-015',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-permuta',
    referenciaExterna: 'Kraken › comprobante del intercambio BTC→USDC del 15/07/2024 con ambas patas.',
  },
  {
    id: 'demo-j-2024-015-valor',
    apunteId: '2024-015',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Contravalor de la permuta: 550 € (0,01 BTC a ≈ 55.000 €/BTC), fuente citada.',
  },
  {
    id: 'demo-j-2024-015-txid',
    apunteId: '2024-015',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-permuta',
    referenciaExterna: 'Identificador interno de la operación en el exchange.',
  },
  // 2024 · interés lending USDC: liquidación + valor de mercado.
  {
    id: 'demo-j-2024-016-liquidacion',
    apunteId: '2024-016',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Kraken › liquidación del interés de lending USDC del 15/08/2024.',
  },
  {
    id: 'demo-j-2024-016-valor',
    apunteId: '2024-016',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Cotización USDC/EUR del 15/08/2024 (≈ 1,00 €), fuente guardada.',
  },
  // 2024 · estafa phishing: denuncia + expediente + txid → expediente COMPLETO.
  {
    id: 'demo-j-2024-017-denuncia',
    apunteId: '2024-017',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'denuncia',
    referenciaExterna: 'Denuncia del 02/09/2024 con identificación precisa de los 0,005 BTC sustraídos.',
    notas: 'Condición necesaria y no suficiente (V1174-25).',
  },
  {
    id: 'demo-j-2024-017-txid',
    apunteId: '2024-017',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'txid-perdida',
    referenciaExterna: 'txid del drenaje y capturas del incidente, reunidos el mismo día.',
  },
  {
    id: 'demo-j-2024-017-expediente',
    apunteId: '2024-017',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'expediente-atestado',
    referenciaExterna:
      'Atestado con los txid de salida, direcciones de destino, titularidad previa de la wallet ' +
      'vaciada y trazabilidad posterior de los fondos.',
    notas: 'Cierra el expediente de la estafa (autor desconocido: V0625-24 y V1828-24).',
  },
  // 2024 · retirada de fiat al banco: justificante + titularidad de la cuenta.
  {
    id: 'demo-j-2024-018-txid',
    apunteId: '2024-018',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'Kraken › justificante de la retirada SEPA de 5.000 € (15/09/2024).',
  },
  {
    id: 'demo-j-2024-018-titularidad',
    apunteId: '2024-018',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'Extracto bancario con el abono: la cuenta de destino es del titular.',
  },
  // 2024 · venta final BTC: orden + extracto.
  {
    id: 'demo-j-2024-019-orden',
    apunteId: '2024-019',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden de venta BTC/EUR del 01/10/2024 (PDF).',
  },
  {
    id: 'demo-j-2024-019-extracto',
    apunteId: '2024-019',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › extracto con el abono de 3.200 € (01/10/2024).',
  },
  // 2024 · certificado anual del exchange: documento de EJERCICIO (carpeta 05, sin apunte).
  {
    id: 'demo-j-2024-cert-kraken',
    apunteId: '',
    rutaConvencional: '05-certificados',
    tipoDocumento: 'certificado-anual',
    referenciaExterna: 'Kraken › certificado anual 2024 de saldos y operaciones (PDF).',
    notas: 'Documento de ejercicio: no acompaña a un apunte concreto y no cuenta como huérfano.',
  },
  // 2025 · nueva aportación de fiat: justificante bancario + titularidad del destino.
  {
    id: 'demo-j-2025-001-txid',
    apunteId: '2025-001',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'Justificante bancario de la transferencia SEPA de 40.000 € a Kraken (10/01/2025).',
  },
  {
    id: 'demo-j-2025-001-titularidad',
    apunteId: '2025-001',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'Perfil de la cuenta de Kraken verificada (KYC) a nombre del titular.',
  },
  // 2025 · compra grande BTC: orden + extracto → completo.
  {
    id: 'demo-j-2025-002-orden',
    apunteId: '2025-002',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden BTC/EUR ejecutada el 16/01/2025 (PDF).',
  },
  {
    id: 'demo-j-2025-002-extracto',
    apunteId: '2025-002',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › Ledger de cuenta enero 2025 (CSV).',
  },
  // 2025 · interés lending USDC: liquidación + valor de mercado.
  {
    id: 'demo-j-2025-003-liquidacion',
    apunteId: '2025-003',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Liquidación de la plataforma de lending: 6 USDC el 12/03/2025.',
  },
  {
    id: 'demo-j-2025-003-valor',
    apunteId: '2025-003',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Cotización USDC/EUR del 12/03/2025 (≈ 1,00 €), fuente guardada.',
  },
  // 2025 · venta ETH con pérdida: orden + extracto → completo.
  {
    id: 'demo-j-2025-004-orden',
    apunteId: '2025-004',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › orden de venta ETH/EUR del 08/04/2025 (PDF).',
  },
  {
    id: 'demo-j-2025-004-extracto',
    apunteId: '2025-004',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › extracto con el abono de 1.480 € (CSV).',
  },
  // 2025 · apertura del canal Lightning: funding on-chain + canal propio.
  {
    id: 'demo-j-2025-005-txid',
    apunteId: '2025-005',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'txid de la transacción de apertura (funding) del canal, 20/05/2025.',
  },
  {
    id: 'demo-j-2025-005-titularidad',
    apunteId: '2025-005',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'Identificador del canal en el nodo propio del titular (prueba de control de claves).',
  },
  // 2025 · pago por Lightning: factura + txid/preimage → completo.
  {
    id: 'demo-j-2025-006-factura',
    apunteId: '2025-006',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'factura-recibo',
    referenciaExterna: 'Factura F25-0618 del proveedor (380,00 €), pagada en bitcoin por Lightning.',
    notas: 'La factura fija el valor de transmisión del PAGO.',
  },
  {
    id: 'demo-j-2025-006-txid',
    apunteId: '2025-006',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-pago',
    referenciaExterna: 'Factura BOLT11 + preimage del pago (captura), vinculadas a la factura F25-0618.',
  },
  // 2025 · donación entregada: documento + ISD + txid → expediente COMPLETO.
  {
    id: 'demo-j-2025-007-documento',
    apunteId: '2025-007',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'documento-donacion',
    referenciaExterna: 'Documento privado de donación del 10/09/2025: parentesco y valoración a la fecha.',
    notas: 'Fija además el valor y la fecha de adquisición del receptor.',
  },
  {
    id: 'demo-j-2025-007-isd',
    apunteId: '2025-007',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'liquidacion-isd',
    referenciaExterna: 'Autoliquidación del ISD presentada por el donatario (modelo autonómico 651).',
  },
  {
    id: 'demo-j-2025-007-txid',
    apunteId: '2025-007',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'txid-donacion',
    referenciaExterna: 'txid de la entrega de 0,01 BTC al donatario.',
  },
  // 2025 · recompensa earn BTC: liquidación + valor de mercado.
  {
    id: 'demo-j-2025-008-liquidacion',
    apunteId: '2025-008',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Liquidación del programa de earn: 0,001 BTC acreditados el 15/10/2025.',
  },
  {
    id: 'demo-j-2025-008-valor',
    apunteId: '2025-008',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Cotización BTC/EUR del 15/10/2025 (≈ 98.000 €/BTC), fuente guardada.',
  },
  // 2025 · retirada a autocustodia: txid + titularidad → completo.
  {
    id: 'demo-j-2025-009-txid',
    apunteId: '2025-009',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'txid de la retirada de 0,5 BTC del 12/11/2025 (captura con la comisión de red).',
  },
  {
    id: 'demo-j-2025-009-titularidad',
    apunteId: '2025-009',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'Primera dirección de recepción del Ledger asociada al titular (mensaje firmado).',
  },
  // 2025 · ajuste auditable: soporte de la corrección → completo.
  {
    id: 'demo-j-2025-010-soporte',
    apunteId: '2025-010',
    rutaConvencional: '99-otros',
    tipoDocumento: 'soporte-correccion',
    referenciaExterna: 'Liquidación de la plataforma con el contravalor correcto (6,00 €) del apunte 2025-003.',
  },
]

/** Fecha (ISO, solo día) en que se «introdujeron» los precios manuales de la demo. */
export const FECHA_PRECIOS_DEMO = '2026-08-15'

/**
 * Precios manuales de demostración para la pestaña Cartera: BTC 100.000 · ETH 3.000 ·
 * USDC 0,92. EUR no lleva precio (vale 1). Cadenas decimales internas (punto). En la página
 * Fiscal, el aviso 721 pide además teclear el precio de cierre: con BTC a 100.000 €, la
 * estimación de 20/10/2025 SUPERA el umbral y el corte normativo de 31/12/2025 no (la lección
 * de la doble fecha y la autocustodia).
 */
export const PRECIOS_CASO_DEMO: PrecioRegistro[] = [
  { activo: 'BTC', precioEur: '100000', fechaISO: FECHA_PRECIOS_DEMO },
  { activo: 'ETH', precioEur: '3000', fechaISO: FECHA_PRECIOS_DEMO },
  { activo: 'USDC', precioEur: '0.92', fechaISO: FECHA_PRECIOS_DEMO },
]

/**
 * Saldos REALES declarados del caso de ejemplo (hoja CUADRE, Tabla 5): los saldos que el
 * alumno «leyó» de cada fuente a fin de 2025, idénticos a los calculados → semáforo todo en
 * VERDE. En el taller basta editar una celda en la sección Cuadre para ver el ÁMBAR y el ROJO
 * en vivo. Cadenas decimales internas (punto).
 */
export const CUADRE_REAL_CASO_DEMO: SaldoRealDeclarado[] = [
  {
    ubicacion: KRAKEN,
    activo: 'EUR',
    saldoReal: '7674',
    notas: 'Del panel de saldos de Kraken a 31/12/2025.',
  },
  { ubicacion: KRAKEN, activo: 'BTC', saldoReal: '0.04055' },
  { ubicacion: KRAKEN, activo: 'ETH', saldoReal: '0.249' },
  { ubicacion: KRAKEN, activo: 'USDC', saldoReal: '311' },
  {
    ubicacion: LEDGER,
    activo: 'BTC',
    saldoReal: '0.787',
    notas: 'Leído en el propio dispositivo (Ledger Live).',
  },
  { ubicacion: CANAL_LN, activo: 'BTC', saldoReal: '0.016' },
]
