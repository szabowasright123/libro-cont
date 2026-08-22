/**
 * caso-demo.ts — dataset del CASO DE EJEMPLO COMPLETO (2024–2026) para el onboarding.
 *
 * Lo carga el botón «Cargar caso de ejemplo» de Inicio (repositorio.cargarCasoDemo). Es la
 * historia de un alumno del taller en TRES capítulos, pensada para que TODA la app se vea con
 * datos: Diario (los 12 tipos, ya con el duodécimo), Trazabilidad (sellos KYC/no-KYC y
 * mezcla), Archivo (los 39 apuntes con su expediente probatorio COMPLETO), Cartera (precios
 * manuales, plusvalía latente y GyP por ejercicio, con un 2025 en negativo), Posiciones
 * (un perpetuo y un pool vivos a 31/12/2026) y Fiscal (tres ejercicios, cajones —incluido el
 * de derivados—, subtipo de pérdida y aviso 721 con doble fecha).
 *
 *  · CAPÍTULO 2024 — el mini-caso 2024 del taller, TRANSCRITO VERBATIM del golden. Compras,
 *    ventas, permutas, staking, airdrop, minería y una estafa por phishing. Saldos a
 *    31/12/2024: BTC 0,4068 · ETH 1,049 · USDC 305 · EUR 4.254 (Regla de oro 9).
 *  · CAPÍTULO 2025 — la ampliación didáctica: nueva compra grande en Kraken, venta de ETH con
 *    pérdida, apertura de un canal Lightning, un PAGO por Lightning (factura), una DONACIÓN
 *    entregada, rendimientos, la retirada a autocustodia en noviembre (que saca el saldo del
 *    perímetro del 721 antes del 31/12: la lección de la doble fecha) y un AJUSTE auditable.
 *  · CAPÍTULO 2026 — lo más nuevo y lo más difícil del manual, que hasta ahora no tenía
 *    demostración ejecutable: el duodécimo tipo (LIQUIDACIÓN DE DERIVADO, con imputación
 *    DIARIA y una posición todavía abierta a 31/12), la permuta con los DOS valores de
 *    mercado del art. 37.1.h —donde se ve que el motor toma el mayor—, el primer evento DeFi
 *    del caso (aportación a un pool bajo la tesis benévola, con su recompensa como RCM) y la
 *    donación RECIBIDA, que cierra el par con la entregada de 2025.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGLA DE ORO 9 (golden intocable): el capítulo 2024 de este fichero NO importa de
 * `tests/golden/` ni al revés; `tests/demo/caso-demo.test.ts` es el único puente y garantiza
 * por IGUALDAD ESTRUCTURAL que los apuntes 2024-* siguen siendo los del golden
 * (`tests/golden/mini-caso.ts`) y que Kraken/Ledger conservan sus campos originales. Los
 * capítulos 2025 y 2026 SOLO AÑADEN apuntes posteriores: nunca cambian saldos ni GyP de los
 * ejercicios anteriores. En particular, el capítulo 2026 no mueve un solo satoshi —el BTC
 * total sigue siendo 0,84355— para que la conciliación FIFO↔SALDOS del caso (regresión de
 * `src/engine/conciliacion.test.ts`) siga cerrando exactamente donde cerraba.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Módulo de datos puro: sin React, sin Dexie. Los tipos son de dominio (`Apunte`, etc.);
 * el subtipo de PÉRDIDA y los justificantes usan tipos de la capa de datos.
 */
import {
  type Activo,
  type Apunte,
  type Posicion,
  type RutaConvencional,
  type Ubicacion,
  UBICACION_EXTERIOR,
} from '../../engine/types'
import type { PrecioRegistro, SubtipoPerdida } from '../tipos'
import type { SaldoRealDeclarado } from '../import/json-backup'

const KRAKEN = 'Kraken'
const LEDGER = 'Ledger'
const CANAL_LN = 'CanalLN'
const POOL = 'PoolUniV3'

/**
 * Identificadores de las POSICIONES del capítulo 2026 (dimensión DeFi, campo `posicionId`).
 * Agrupan las patas de un mismo hecho económico a lo largo del tiempo, que es lo que permite
 * reconstruir la posición y verla abierta al cierre del ejercicio.
 */
const POS_PERPETUO = 'demo-pos-perp-btc-2026'
const POS_POOL = 'demo-pos-pool-ethusdc-2026'

/**
 * Ubicaciones del caso de ejemplo. Kraken y Ledger son las del mini-caso 2024 (sus campos
 * originales — id, nombre, tipo, kyc, fechaAlta — son golden y no cambian); la ficha ampliada
 * (vía de evidencia, extranjero/país, autocustodia) y el canal Lightning son del capítulo 2025.
 *
 *  · Kraken — exchange KYC radicado en el EXTRANJERO (MiCA — Irlanda): computa para el aviso 721.
 *  · Ledger — wallet no-KYC de AUTOCUSTODIA: nunca computa para el 721 (FAQ AEAT).
 *  · Canal Lightning — ubicación de tipo «canal», autocustodia (regla de identidad del taller:
 *    el canal es una ubicación propia; su evidencia son facturas/preimages y aperturas on-chain).
 *  · Pool ETH/USDC — la ubicación que representa el contrato del pool (capítulo 2026). Bajo la
 *    tesis benévola validada por el autor (DEFI §C1), aportar liquidez NO es hecho imponible:
 *    los activos no salen del patrimonio, se TRASLADAN a esta ubicación. Por eso el pool tiene
 *    que ser una ubicación del Libro y no un agujero por el que los saldos desaparecen.
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
  {
    id: POOL,
    nombre: 'Pool ETH/USDC (Uniswap v3)',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2026-07-10T00:00:00',
    viaEvidencia: 'otra',
    // NO se marca `extranjero`: el 721 informa de monedas custodiadas por terceros que
    // gestionan claves ajenas, y un contrato inteligente no es un custodio residente ni no
    // residente. Tampoco `autocustodia`: las claves no son del titular. Es deliberadamente
    // una ubicación «de frontera» que el alumno debe mirar con sus propios ojos.
    notasEvidencia:
      'Contrato del pool en Ethereum: dirección del contrato, hash de la aportación, ' +
      'composición del par en cada corte y cantidad de LP token recibida. Bajo la tesis ' +
      'benévola (DEFI §C1) el LP token es un simple resguardo y no abre cola FIFO propia: ' +
      'lo que sigue vivo en el Libro son el ETH y el USDC aportados, aquí localizados.',
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
    // El SENTIDO no es decorativo: es lo que hace que la donación consuma cola FIFO. Sin
    // él —como estaba hasta la v1.5.0— el saldo bajaba 0,01 BTC y la cola no, y el caso de
    // ejemplo arrastraba existencias fantasma con su coste (ver `conciliacion.ts`).
    sentido: 'entregada',
    ubicacionOrigen: LEDGER,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.01',
    contravalorEUR: '900',
    notas:
      'Donación ENTREGADA a un familiar (supuesto: ≈ 90.000 €/BTC). Transmisión lucrativa ' +
      'ínter vivos: alteración patrimonial en el donante, valorada por las normas del ISD ' +
      'sin exceder el valor de mercado (art. 36 LIRPF); la ganancia se computa y la pérdida ' +
      'no (art. 33.5.c LIRPF). El receptor liquida el ISD.',
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
    // Rectifica un contravalor mal tecleado: no mueve existencias, luego no toca la cola.
    sentido: 'solo-saldos',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    rectificaA: '2025-003',
    notas:
      'AJUSTE/RECTIFICACIÓN: fija el contravalor correcto del rendimiento 2025-003 (6,00 € según ' +
      'la liquidación; se había anotado 5,80 € por error de tecleo). Causa: error material. ' +
      'El apunte original se conserva; la corrección queda auditable.',
  },
]


/**
 * CAPÍTULO 2026 — el año en que el alumno pisa lo más nuevo del manual (10 apuntes, en orden
 * cronológico estricto: la renumeración les asigna 2026-001…2026-010).
 *
 * Este capítulo existe porque los dos anteriores, con ser completos, no ejercitaban nada de la
 * materia de las unidades 6.1.1, 6.4 y 8: el duodécimo tipo, la regla de valoración de la
 * permuta y los eventos DeFi. Cubre exactamente eso y nada más:
 *
 *  1. Un PERPETUO liquidado por diferencias (2026-003, 2026-004+2026-005 y 2026-010), con
 *     imputación DIARIA —un apunte por corte de liquidación, V2115-21— y la posición TODAVÍA
 *     ABIERTA a 31/12: una posición viva al cierre ya ha generado renta.
 *  2. Una PERMUTA con los dos valores de mercado del art. 37.1.h DISTINTOS (2026-002), para
 *     ver que el motor cuantifica por el MAYOR y que ese mismo importe es el coste del lote
 *     que nace.
 *  3. Una APORTACIÓN A POOL con su dimensión DeFi (2026-006 y 2026-007) y su recompensa como
 *     RCM (2026-008), descompuesta en patas de los doce tipos: los eventos DeFi no son tipos.
 *  4. Una DONACIÓN RECIBIDA (2026-009), que cierra el par con la entregada de 2025.
 *
 * El capítulo NO TOCA EL BITCOIN: el subyacente del perpetuo es el BTC, pero un derivado
 * liquidado por diferencias no entrega el subyacente, y esa es justamente la lección. El BTC
 * total del caso sigue siendo 0,84355 al céntimo de satoshi.
 *
 * Contravalores: precios de mercado 2026 ASUMIDOS y redondeados (misma convención
 * «(supuesto)» de los capítulos anteriores): ETH ≈ 3.000 € (ene–jul) y 3.100 € (nov) ·
 * USDC ≈ 0,92 € · TOKENX ≈ 0,262 € (mercado fino).
 */
export const APUNTES_2026_CASO_DEMO: Apunte[] = [
  {
    id: '2026-001',
    fechaHora: '2026-01-20T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '3000',
    activoEntrada: 'ETH',
    cantidadEntrada: '1',
    comisionCantidad: '15',
    comisionActivo: 'EUR',
    contravalorEUR: '3000',
    notas:
      'Compra de 1 ETH para tener con qué operar el resto del año (supuesto: ≈ 3.000 €/ETH). ' +
      'Sin hecho imponible: solo fija el lote FIFO. La comisión en EUR SUMA al coste, de modo ' +
      'que el lote nace con 3.015 € y no con 3.000 €.',
  },
  {
    id: '2026-002',
    fechaHora: '2026-02-05T12:30:00',
    tipo: 'PERMUTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'ETH',
    cantidadSalida: '0.25',
    activoEntrada: 'TOKENX',
    cantidadEntrada: '2500',
    // Los DOS valores de mercado del art. 37.1.h, y son DISTINTOS a propósito: el ETH tiene
    // mercado profundo y su valor es indiscutible (0,25 × 3.000 = 750,00 €); el TOKENX tiene
    // mercado fino y en el momento del canje cotiza a 0,262 €, así que lo recibido vale
    // 655,00 €. El motor NO cuantifica por lo recibido: toma el MAYOR de los dos.
    valorMercadoEntregadoEUR: '750.00',
    valorMercadoRecibidoEUR: '655.00',
    contravalorEUR: '750.00',
    notas:
      'PERMUTA de 0,25 ETH por 2.500 TOKENX en un mercado fino. Es el ejemplo de [MT] U6.4: la ' +
      'ley no cuantifica la permuta por lo recibido ni por lo entregado, sino por «el mayor de ' +
      'los dos siguientes: el valor de mercado del bien o derecho entregado; el valor de ' +
      'mercado del bien o derecho que se recibe a cambio» (art. 37.1.h LIRPF). Aquí el mayor ' +
      'es lo ENTREGADO (750,00 € frente a 655,00 €), de modo que se tributa por 95,00 € más de ' +
      'lo efectivamente recibido. La contrapartida no es un castigo: ese mismo importe es el ' +
      'coste del lote de TOKENX que nace, y evita que esos 95,00 € vuelvan a tributar al vender.',
  },
  {
    id: '2026-003',
    fechaHora: '2026-03-15T08:00:00',
    tipo: 'LIQUIDACION_DERIVADO',
    // El duodécimo tipo NUNCA tiene lado de salida: en una liquidación por diferencias no se
    // entrega el subyacente. Aquí solo hay lado de entrada, y abre lote por lo acreditado.
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'USDC',
    cantidadEntrada: '230',
    contravalorEUR: '211.60',
    evento: 'DERIVADO',
    posicionId: POS_PERPETUO,
    protocolo: 'Kraken Futures',
    notas:
      'Primer corte de liquidación del PERPETUO BTC/USD abierto en febrero: la plataforma ' +
      'liquida un resultado neto de +230 USDC (211,60 € al cambio del día). La apertura de la ' +
      'posición no genera apunte —el margen no sale de Kraken y no hay alteración patrimonial—: ' +
      'lo que se registra son los CORTES. Ganancia patrimonial del art. 33.1, cuantificada por ' +
      'el art. 34 e integrada en la base del AHORRO por el art. 46.b) LIRPF (compensación por ' +
      'el art. 49.1.b) y 2). El art. 37.1.m no aplica: alcanza solo a los contratos negociados ' +
      'en mercados organizados y remite al derogado RD 1814/1991 (hoy RD 814/2023). Y un ' +
      'derivado sobre cripto no es un criptoactivo (MiCA art. 2.4.a): queda fuera del art. ' +
      '37.1.h, del FIFO del art. 37.2 y de los modelos 172/173/721.',
  },
  {
    id: '2026-004',
    fechaHora: '2026-06-15T08:00:00',
    tipo: 'LIQUIDACION_DERIVADO',
    // Sin activos: el contravalor de una liquidación por diferencias es el RESULTADO NETO y
    // puede ser NEGATIVO. No hay lado de salida ni aunque se pierda.
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    contravalorEUR: '-92.00',
    evento: 'DERIVADO',
    posicionId: POS_PERPETUO,
    protocolo: 'Kraken Futures',
    notas:
      'Segundo corte del mismo perpetuo, esta vez EN CONTRA: −92,00 € de resultado neto (la ' +
      'suma del funding pagado cada ocho horas y de la variación del precio hasta el corte). ' +
      'El apunte no tiene lado de salida y su contravalor es negativo, que es exactamente como ' +
      'se anota una pérdida por diferencias. La entrega de los USDC con los que se salda el ' +
      'corte va aparte, en el apunte siguiente: son dos hechos fiscales distintos y el manual ' +
      'los llama «el doble efecto» ([MT] U4.3).',
  },
  {
    id: '2026-005',
    fechaHora: '2026-06-15T08:05:00',
    tipo: 'PAGO',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'USDC',
    cantidadSalida: '100',
    contravalorEUR: '92.00',
    evento: 'DERIVADO',
    posicionId: POS_PERPETUO,
    protocolo: 'Kraken Futures',
    notas:
      'Entrega de 100 USDC (92,00 €) para saldar el corte negativo anterior. Es una pata PAGO ' +
      'independiente porque sí es una transmisión: consume cola FIFO de USDC y genera su ' +
      'propia ganancia o pérdida patrimonial, distinta del resultado del derivado. Aquí arroja ' +
      'pérdida porque los USDC más antiguos de la cola entraron caros, en la permuta de 2024.',
  },
  {
    id: '2026-006',
    fechaHora: '2026-07-10T11:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: POOL,
    activoSalida: 'ETH',
    cantidadSalida: '0.1',
    activoEntrada: 'ETH',
    cantidadEntrada: '0.1',
    // El gas se paga en ETH, no en euros: criterio del autor (DEFI §8) — no es transmisión,
    // el lote se retira por su COSTE prorrateado entre los lotes vivos, con resultado cero, y
    // como aquí solo hay traslado entre ubicaciones propias ese coste no es deducible.
    comisionCantidad: '0.002',
    comisionActivo: 'ETH',
    evento: 'POOL_APORTACION',
    posicionId: POS_POOL,
    protocolo: 'Uniswap v3',
    criterioAplicado:
      'Tesis BENÉVOLA: el LP token es un simple resguardo y la aportación no es hecho ' +
      'imponible (criterio del autor 16-08-2026). La tesis prudente la trataría como permuta ' +
      'del art. 37.1.h. Sin criterio de la DGT. Manual U4.5.',
    notas:
      'APORTACIÓN A POOL, primera pata: 0,10 ETH (≈ 300 €) al pool ETH/USDC. Bajo la tesis ' +
      'benévola no hay permuta ni se abre lote de LP token: los activos se TRASLADAN a la ' +
      'ubicación que representa el pool y conservan su antigüedad y su coste FIFO intactos. ' +
      'Obsérvese que el evento DeFi no es un tipo nuevo: se descompone en patas de los doce ' +
      'del catálogo, y aquí la pata es una TRANSFERENCIA. Y ojo con lo que NO se registra: ' +
      'mientras la posición siga abierta, la pérdida no permanente es lucro cesante y no es ' +
      'pérdida fiscal ([MT] U4.5).',
  },
  {
    id: '2026-007',
    fechaHora: '2026-07-10T11:00:30',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: POOL,
    activoSalida: 'USDC',
    cantidadSalida: '430',
    activoEntrada: 'USDC',
    cantidadEntrada: '430',
    evento: 'POOL_APORTACION',
    posicionId: POS_POOL,
    protocolo: 'Uniswap v3',
    criterioAplicado:
      'Tesis BENÉVOLA: el LP token es un simple resguardo y la aportación no es hecho ' +
      'imponible (criterio del autor 16-08-2026). La tesis prudente la trataría como permuta ' +
      'del art. 37.1.h. Sin criterio de la DGT. Manual U4.5.',
    notas:
      'APORTACIÓN A POOL, segunda pata: 430 USDC (≈ 395,60 €), el otro lado del par. La ' +
      'comisión de red se colgó de la primera pata para no contarla dos veces. Las dos patas ' +
      'comparten `posicionId`: es lo que permite reconstruir la posición después.',
  },
  {
    id: '2026-008',
    fechaHora: '2026-09-30T10:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: POOL,
    activoEntrada: 'USDC',
    cantidadEntrada: '40',
    contravalorEUR: '36.80',
    evento: 'POOL_RECOMPENSA',
    posicionId: POS_POOL,
    protocolo: 'Uniswap v3',
    notas:
      'Comisiones de intercambio acumuladas por la posición y acreditadas al titular: 40 USDC ' +
      '(36,80 €). Rendimiento del capital mobiliario del art. 25.2 LIRPF, base del ahorro, ' +
      'valorado a mercado el día en que se puede disponer de ellos y SIN gastos deducibles ' +
      '(art. 26 LIRPF), que es la respuesta expresa de la V0648-24 para pools de liquidez y ' +
      'yield farming. Es la segunda capa fiscal del pool: conviven con la ganancia patrimonial ' +
      'que aflorará en la retirada, y por eso se registran por separado.',
  },
  {
    id: '2026-009',
    fechaHora: '2026-11-15T12:00:00',
    tipo: 'DONACION',
    // El SENTIDO opuesto al de 2025-007: aquí el alumno RECIBE. Con `recibida` el motor abre
    // lote FIFO en lugar de consumirlo, y no computa ganancia alguna en el IRPF del donatario.
    sentido: 'recibida',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: LEDGER,
    activoEntrada: 'ETH',
    cantidadEntrada: '0.1',
    contravalorEUR: '310.00',
    notas:
      'Donación RECIBIDA de un familiar: 0,10 ETH (supuesto: ≈ 3.100 €/ETH). En el donatario ' +
      'no hay ganancia patrimonial en el IRPF —la adquisición lucrativa tributa por el ISD—, ' +
      'pero sí nace un lote FIFO, y su coste es el valor del art. 36 LIRPF: el que resulte de ' +
      'las normas del Impuesto sobre Sucesiones y Donaciones, sin exceder el valor de mercado. ' +
      'Compárese con la donación ENTREGADA de 2025-007: el mismo tipo del catálogo y dos ' +
      'comportamientos opuestos, que es justamente lo que el campo `sentido` resuelve.',
  },
  {
    id: '2026-010',
    fechaHora: '2026-12-31T23:00:00',
    tipo: 'LIQUIDACION_DERIVADO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'USDC',
    cantidadEntrada: '150',
    contravalorEUR: '138.00',
    evento: 'DERIVADO',
    posicionId: POS_PERPETUO,
    protocolo: 'Kraken Futures',
    notas:
      'Último corte del ejercicio con la posición TODAVÍA ABIERTA: +150 USDC (138,00 €). Es la ' +
      'lección de la imputación temporal: cuando el contrato liquida periódicamente —y un ' +
      'perpetuo liquida funding cada ocho horas—, la ganancia o la pérdida se obtiene ' +
      'DIARIAMENTE «aun cuando la posición contractual no se hubiese cerrado al finalizar dicho ' +
      'período impositivo» (art. 14.1.c LIRPF; V2115-21, reiterada en V2788-21 y V3183-20). ' +
      'Quien espere a cerrar la posición para declarar habrá declarado tarde. A 31/12/2026 el ' +
      'perpetuo sigue vivo y ya ha generado 257,60 € de renta en el ejercicio.',
  },
]

/**
 * Las POSICIONES DeFi vivas del capítulo 2026 (dimensión ortogonal al catálogo: agrupan las
 * patas de un mismo hecho económico, no participan en SALDOS ni en FIFO). Las dos siguen
 * ABIERTAS a 31/12/2026, que es lo que el caso quiere enseñar: un perpetuo que ya ha
 * imputado renta sin haberse cerrado y un pool cuya ganancia patrimonial no ha aflorado
 * todavía —y cuya pérdida no permanente, mientras tanto, no es pérdida fiscal—.
 *
 * PENDIENTE (decisión del autor): `repositorio.cargarCasoDemo` todavía no siembra
 * `db.posiciones`, de modo que las patas del capítulo 2026 llevan `posicionId` pero la
 * pestaña Posiciones no las agrupa. Es un `bulkAdd` de una línea junto al de ubicaciones;
 * mientras no se haga, la referencia queda colgando —sin romper nada: la página lista las
 * posiciones que existen y estas patas simplemente no aparecen—.
 */
export const POSICIONES_CASO_DEMO: Posicion[] = [
  {
    id: POS_PERPETUO,
    protocolo: 'Kraken Futures',
    tipoPosicion: 'derivado',
    fechaApertura: '2026-02-10T09:00:00',
    estado: 'abierta',
    notas:
      'Perpetuo BTC/USD con margen en USDC. Liquida por diferencias: nunca se entrega el ' +
      'subyacente, de modo que el BTC de la cartera no se toca. Un apunte por corte de ' +
      'liquidación (V2115-21).',
  },
  {
    id: POS_POOL,
    protocolo: 'Uniswap v3',
    tipoPosicion: 'pool',
    fechaApertura: '2026-07-10T11:00:00',
    estado: 'abierta',
    notas:
      'Par ETH/USDC. Tesis benévola: la aportación no es hecho imponible y el LP token es un ' +
      'resguardo sin cola FIFO propia. El hecho imponible se traslada íntegro a la retirada.',
  },
]

/** Los apuntes del caso de ejemplo completo: capítulo 2024 (golden) + 2025 + 2026. */
export const APUNTES_CASO_DEMO: Apunte[] = [
  ...APUNTES_2024_CASO_DEMO,
  ...APUNTES_2025_CASO_DEMO,
  ...APUNTES_2026_CASO_DEMO,
]

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
 * 87 justificantes SIN fichero embebido (solo referencia externa) que cubren la checklist
 * probatoria de los 39 apuntes — cada requisito de cada tipo, en su rama KYC/no-KYC — más un
 * certificado anual en la carpeta 05 (documento de ejercicio, sin apunte asociado). El caso
 * muestra así el «expediente modelo» terminado; los huecos los pondrá el alumno al empezar
 * con sus propios datos.
 *
 * El capítulo 2026 añade las carpetas del duodécimo tipo (extracto de la posición, movimientos
 * de margen y fuente de la cotización) y las de los eventos DeFi. La advertencia del manual
 * viene al caso: en derivados el riesgo real no es de calificación sino PROBATORIO —la STSJ de
 * Andalucía de 12-12-2023 rechazó 208.501 € de pérdidas en CFD por falta de prueba—.
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
  // ── CAPÍTULO 2026 ─────────────────────────────────────────────────────────
  // 2026 · compra de ETH (Kraken, KYC): orden + extracto → completo.
  {
    id: 'demo-j-2026-001-orden',
    apunteId: '2026-001',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Kraken › Historial de órdenes › orden ETH/EUR ejecutada el 20/01/2026 (PDF).',
    notas: 'Fija el contravalor (3.000 €) y la comisión (15 €), que suma al coste del lote.',
  },
  {
    id: 'demo-j-2026-001-extracto',
    apunteId: '2026-001',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Kraken › Ledger de cuenta enero 2026 (CSV exportado al cierre del ejercicio).',
  },
  // 2026 · permuta ETH → TOKENX: comprobante + LOS DOS valores de mercado + txid → completo.
  {
    id: 'demo-j-2026-002-orden',
    apunteId: '2026-002',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-permuta',
    referenciaExterna: 'Comprobante del canje del 05/02/2026: 0,25 ETH entregados, 2.500 TOKENX recibidos.',
  },
  {
    id: 'demo-j-2026-002-valor',
    apunteId: '2026-002',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'valor-mercado',
    referenciaExterna:
      'Cotizaciones del 05/02/2026 guardadas con su fuente: ETH/EUR 3.000 € (750,00 € lo entregado) y TOKENX/EUR 0,262 € (655,00 € lo recibido).',
    notas:
      'Las DOS cotizaciones, no una: el art. 37.1.h cuantifica por el mayor de los dos valores, y sin ambas no se puede acreditar cuál se aplicó ni defender el cálculo.',
  },
  {
    id: 'demo-j-2026-002-txid',
    apunteId: '2026-002',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-permuta',
    referenciaExterna: 'Identificador de la operación de canje en la plataforma (captura con fecha y hora).',
  },
  // 2026 · perpetuo, corte de marzo: extracto de la posición + margen + cotización → completo.
  {
    id: 'demo-j-2026-003-extracto',
    apunteId: '2026-003',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-posicion',
    referenciaExterna: 'Kraken Futures › extracto del perpetuo BTC/USD: cortes de liquidación y funding hasta el 15/03/2026 (+230 USDC).',
  },
  {
    id: 'demo-j-2026-003-margen',
    apunteId: '2026-003',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'movimientos-margen',
    referenciaExterna: 'Movimientos de margen de la posición: lo aportado y lo devuelto, para separar el traslado del resultado.',
  },
  {
    id: 'demo-j-2026-003-cotizacion',
    apunteId: '2026-003',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'cotizacion',
    referenciaExterna: 'Cotización USDC/EUR del 15/03/2026 (0,92 €) con fecha, hora y fuente: la liquidación no fue en euros.',
  },
  // 2026 · perpetuo, corte de junio en contra: el mismo expediente, con signo negativo.
  {
    id: 'demo-j-2026-004-extracto',
    apunteId: '2026-004',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-posicion',
    referenciaExterna: 'Kraken Futures › extracto del corte del 15/06/2026: resultado neto −92,00 €.',
    notas: 'Es el documento que fija la cifra: en una liquidación por diferencias no hay entrega del subyacente que probar. La prueba lo es todo (STSJ Andalucía 12-12-2023).',
  },
  {
    id: 'demo-j-2026-004-margen',
    apunteId: '2026-004',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'movimientos-margen',
    referenciaExterna: 'Detalle del funding pagado cada ocho horas y del ajuste de margen del periodo.',
  },
  {
    id: 'demo-j-2026-004-cotizacion',
    apunteId: '2026-004',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'cotizacion',
    referenciaExterna: 'Cotización USDC/EUR del 15/06/2026 (0,92 €) con su fuente.',
  },
  // 2026 · entrega de USDC que salda el corte negativo: factura del cargo + txid.
  {
    id: 'demo-j-2026-005-factura',
    apunteId: '2026-005',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'factura-recibo',
    referenciaExterna: 'Nota de cargo de la plataforma por los 100 USDC con los que se salda el corte del 15/06/2026.',
  },
  {
    id: 'demo-j-2026-005-txid',
    apunteId: '2026-005',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-pago',
    referenciaExterna: 'Movimiento de salida de los 100 USDC en el extracto de la cuenta, vinculado a la nota de cargo.',
  },
  // 2026 · aportación al pool (dos patas): txid + titularidad de la ubicación destino.
  {
    id: 'demo-j-2026-006-txid',
    apunteId: '2026-006',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'Hash de la transacción de aportación del 10/07/2026 (0,10 ETH) con la comisión de red pagada en ETH.',
  },
  {
    id: 'demo-j-2026-006-titularidad',
    apunteId: '2026-006',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna:
      'Dirección del contrato del pool, identificador de la posición (NFT de Uniswap v3) y dirección propia desde la que se aportó.',
    notas: 'Zona gris: la nota fechada con el criterio aplicado (tesis benévola) se archiva junto a este documento.',
  },
  {
    id: 'demo-j-2026-007-txid',
    apunteId: '2026-007',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'Hash de la transacción de aportación de los 430 USDC y composición del par en el momento de entrar.',
  },
  {
    id: 'demo-j-2026-007-titularidad',
    apunteId: '2026-007',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'La misma posición del pool: identificador, dirección del contrato y cantidad de LP token recibida.',
  },
  // 2026 · recompensa del pool (RCM): liquidación + valor de mercado.
  {
    id: 'demo-j-2026-008-liquidacion',
    apunteId: '2026-008',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Histórico de comisiones acreditadas por la posición hasta el 30/09/2026 (40 USDC).',
    notas: 'Fecha de DISPONIBILIDAD, que es la que manda para imputar (art. 14.1.a; V0612-26).',
  },
  {
    id: 'demo-j-2026-008-valor',
    apunteId: '2026-008',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'valor-mercado',
    referenciaExterna: 'Cotización USDC/EUR del 30/09/2026 (0,92 €) con su fuente guardada.',
  },
  // 2026 · donación RECIBIDA: documento + ISD (que aquí liquida el propio alumno) + txid.
  {
    id: 'demo-j-2026-009-documento',
    apunteId: '2026-009',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'documento-donacion',
    referenciaExterna: 'Documento privado de donación del 15/11/2026: donante, parentesco y valoración de los 0,10 ETH a esa fecha.',
    notas: 'Es el documento que fija el valor y la fecha de adquisición del receptor, es decir, el coste del lote que nace.',
  },
  {
    id: 'demo-j-2026-009-isd',
    apunteId: '2026-009',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'liquidacion-isd',
    referenciaExterna: 'Autoliquidación del ISD presentada por el alumno como DONATARIO (modelo autonómico 651).',
    notas: 'En la donación recibida el que liquida el ISD es él: es el reverso exacto de la donación entregada de 2025.',
  },
  {
    id: 'demo-j-2026-009-txid',
    apunteId: '2026-009',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'txid-donacion',
    referenciaExterna: 'txid de la recepción de los 0,10 ETH en la dirección propia del Ledger.',
  },
  // 2026 · perpetuo, corte de 31/12 con la posición todavía abierta.
  {
    id: 'demo-j-2026-010-extracto',
    apunteId: '2026-010',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'extracto-posicion',
    referenciaExterna: 'Kraken Futures › extracto a 31/12/2026: cortes del periodo (+150 USDC) y posición ABIERTA al cierre.',
    notas: 'El extracto acredita las dos cosas: la renta ya imputada y que la posición sigue viva (art. 14.1.c; V2115-21).',
  },
  {
    id: 'demo-j-2026-010-margen',
    apunteId: '2026-010',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'movimientos-margen',
    referenciaExterna: 'Margen depositado y disponible a 31/12/2026, para separar el colateral del resultado.',
  },
  {
    id: 'demo-j-2026-010-cotizacion',
    apunteId: '2026-010',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'cotizacion',
    referenciaExterna: 'Cotización USDC/EUR del 31/12/2026 (0,92 €) con su fuente.',
  },
]


/** Fecha (ISO, solo día) en que se «introdujeron» los precios manuales de la demo. */
export const FECHA_PRECIOS_DEMO = '2026-12-31'

/**
 * Precios manuales de demostración para la pestaña Cartera: BTC 100.000 · ETH 3.000 ·
 * USDC 0,92 · TOKENX 0,26. EUR no lleva precio (vale 1). Cadenas decimales internas (punto).
 * En la página Fiscal, el aviso 721 pide además teclear el precio de cierre: con BTC a
 * 100.000 €, la estimación de 20/10/2025 SUPERA el umbral y el corte normativo de 31/12/2025
 * no (la lección de la doble fecha y la autocustodia).
 *
 * El TOKENX entró con el capítulo 2026: su precio es deliberadamente bajo y redondo (0,26 €
 * frente a los 0,262 € del canje) para que en Cartera se vea que la valoración a precio de
 * mercado y el coste FIFO del lote —que nació por el MAYOR de los dos valores del art.
 * 37.1.h, 750,00 €— son dos cosas distintas.
 */
export const PRECIOS_CASO_DEMO: PrecioRegistro[] = [
  { activo: 'BTC', precioEur: '100000', fechaISO: FECHA_PRECIOS_DEMO },
  { activo: 'ETH', precioEur: '3000', fechaISO: FECHA_PRECIOS_DEMO },
  { activo: 'USDC', precioEur: '0.92', fechaISO: FECHA_PRECIOS_DEMO },
  { activo: 'TOKENX', precioEur: '0.26', fechaISO: FECHA_PRECIOS_DEMO },
]

/**
 * Saldos REALES declarados del caso de ejemplo (hoja CUADRE, Tabla 5): los saldos que el
 * alumno «leyó» de cada fuente al cierre del último ejercicio del caso (31/12/2026),
 * idénticos a los calculados → semáforo todo en VERDE. En el taller basta editar una celda en
 * la sección Cuadre para ver el ÁMBAR y el ROJO en vivo. Cadenas decimales internas (punto).
 *
 * Obsérvese la última pareja de celdas: el saldo del POOL también se declara y también cuadra.
 * Bajo la tesis benévola los activos aportados no salieron del patrimonio, así que tienen que
 * seguir apareciendo en algún sitio —y el sitio es la ubicación que representa el pool—.
 */
export const CUADRE_REAL_CASO_DEMO: SaldoRealDeclarado[] = [
  {
    ubicacion: KRAKEN,
    activo: 'EUR',
    saldoReal: '4659',
    notas: 'Del panel de saldos de Kraken a 31/12/2026.',
  },
  { ubicacion: KRAKEN, activo: 'BTC', saldoReal: '0.04055' },
  { ubicacion: KRAKEN, activo: 'ETH', saldoReal: '0.897' },
  { ubicacion: KRAKEN, activo: 'USDC', saldoReal: '161' },
  { ubicacion: KRAKEN, activo: 'TOKENX', saldoReal: '2500' },
  {
    ubicacion: LEDGER,
    activo: 'BTC',
    saldoReal: '0.787',
    notas: 'Leído en el propio dispositivo (Ledger Live).',
  },
  { ubicacion: LEDGER, activo: 'ETH', saldoReal: '0.1', notas: 'Los 0,10 ETH de la donación recibida.' },
  { ubicacion: CANAL_LN, activo: 'BTC', saldoReal: '0.016' },
  {
    ubicacion: POOL,
    activo: 'ETH',
    saldoReal: '0.1',
    notas: 'Leído en la posición del pool (los activos siguen siendo suyos: solo se trasladaron).',
  },
  { ubicacion: POOL, activo: 'USDC', saldoReal: '470' },
]
