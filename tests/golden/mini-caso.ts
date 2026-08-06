/**
 * mini-caso.ts — transcripción del mini-caso genérico 2024 a apuntes del dominio.
 *
 * Origen: docs/reference/mini_caso_generico.csv (20 filas). Este fichero NO es un test
 * (no termina en .test.ts): es el corpus de datos que consumen los golden tests.
 *
 * MAPEO DE TIPOS (según el enunciado de la fase P1):
 *   compra→COMPRA · venta→VENTA · permuta→PERMUTA · staking→RENDIMIENTO ·
 *   interes_lending→RENDIMIENTO · mineria→MINERÍA · airdrop→AIRDROP · robo→PÉRDIDA ·
 *   retirada_cripto + deposito_cripto (mismo activo/fecha) → UN solo apunte TRANSFERENCIA ·
 *   deposito_fiat / retirada_fiat → entrada/salida de EUR desde/hacia EXTERIOR (TRANSFERENCIA).
 *
 * UBICACIONES: Kraken (exchange, KYC sí) · Ledger (wallet, KYC no) · EXTERIOR (frontera).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTRAVALORES EUR — MUY IMPORTANTE (léase junto a docs/COTEJO_F1.md):
 *
 * El CSV del mini-caso NO trae columna de contravalor. En las operaciones con una
 * pata en EUR (COMPRA, VENTA) el contravalor es inequívoco: el propio importe en
 * euros del CSV. Pero en las operaciones cripto-cripto (PERMUTA) y en las que entran
 * sin salir (RENDIMIENTO, MINERÍA, AIRDROP) y en la PÉRDIDA, el valor de mercado en
 * EUR NO está en el CSV y hay que APORTARLO.
 *
 * Los contravalores marcados «(CSV)» son datos duros del mini-caso; los marcados
 * «(supuesto)» son precios de mercado 2024 ASUMIDOS y redondeados, elegidos para el
 * cotejo. NO alteran los SALDOS (que solo dependen de cantidades: son el golden
 * intocable de la Regla 9); SÍ determinan las GyP FIFO. Si se dispone de cotizaciones
 * reales, basta cambiar la tabla PRECIOS y las GyP se recalculan solas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  type Apunte,
  type Ubicacion,
  UBICACION_EXTERIOR,
} from '../../src/engine/types'

// Ubicaciones del mini-caso.
export const KRAKEN = 'Kraken'
export const LEDGER = 'Ledger'

export const UBICACIONES_MINICASO: Ubicacion[] = [
  { id: KRAKEN, nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2024-01-01T00:00:00' },
  { id: LEDGER, nombre: 'Ledger', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-01T00:00:00' },
]

/**
 * Contravalores EUR usados en la transcripción. Ver nota de cabecera.
 * (supuesto) = precio de mercado 2024 asumido; (CSV) = importe en euros del propio CSV.
 */
export const CONTRAVALORES = {
  compraBTC_1: '20000', // (CSV) 0,5 BTC por 20.000 €  → BTC ≈ 40.000 €
  compraETH: '4400', //    (CSV) 2 ETH por 4.400 €      → ETH ≈ 2.200 €
  stakingETH: '150', //    (supuesto) 0,05 ETH @ 3.000 €/ETH
  airdropTOKENX: '100', // (supuesto) 100 TOKENX @ 1,00 €
  permutaBTCporETH: '3000', // (supuesto) 0,05 BTC @ 60.000 €/BTC = 3.000 € (valor de la permuta)
  ventaBTC_1: '6500', //   (CSV) 0,1 BTC por 6.500 €
  compraADA: '300', //     (CSV) 500 ADA por 300 €
  stakingADA: '2', //      (supuesto) 5 ADA @ 0,40 €
  ventaTOKENX: '150', //   (CSV) 100 TOKENX por 150 €
  mineriaBTC: '110', //    (supuesto) 0,002 BTC @ 55.000 €/BTC
  ventaADA: '350', //      (CSV) 505 ADA por 350 €
  compraBTC_2: '1200', //  (CSV) 0,02 BTC por 1.200 €   → BTC = 60.000 €
  permutaBTCporUSDC: '550', // (supuesto) 0,01 BTC @ 55.000 €/BTC = 550 € (valor de la permuta)
  interesUSDC: '5', //     (supuesto) 5 USDC @ 1,00 €
  perdidaBTC: '0', //      robo: sin contraprestación (valor de transmisión 0)
  ventaBTC_final: '3200', // (CSV) 0,05 BTC por 3.200 €
} as const

/**
 * Los 19 apuntes del mini-caso (20 filas del CSV, con la retirada+depósito cripto
 * del 20/03 fusionadas en UNA sola TRANSFERENCIA). Orden cronológico estricto.
 */
export const APUNTES_MINICASO: Apunte[] = [
  // 1 · 2024-01-15 deposito_fiat: entra EUR desde EXTERIOR a Kraken.
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
  // 2 · 2024-01-16 compra BTC con EUR (comisión 30 €).
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
    contravalorEUR: CONTRAVALORES.compraBTC_1,
    notas: 'Compra BTC con EUR.',
  },
  // 3 · 2024-01-20 compra ETH con EUR (comisión 6 €).
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
    contravalorEUR: CONTRAVALORES.compraETH,
    notas: 'Compra ETH con EUR.',
  },
  // 4 · 2024-02-15 staking ETH → RENDIMIENTO (entra ETH desde EXTERIOR).
  {
    id: '2024-004',
    fechaHora: '2024-02-15T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'ETH',
    cantidadEntrada: '0.05',
    contravalorEUR: CONTRAVALORES.stakingETH,
    notas: 'Recompensa staking ETH (RCM).',
  },
  // 5 · 2024-03-01 airdrop TOKENX → AIRDROP.
  {
    id: '2024-005',
    fechaHora: '2024-03-01T12:00:00',
    tipo: 'AIRDROP',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'TOKENX',
    cantidadEntrada: '100',
    contravalorEUR: CONTRAVALORES.airdropTOKENX,
    notas: 'Airdrop token ficticio TOKENX.',
  },
  // 6 · 2024-03-10 permuta: entrega 1 ETH, recibe 0,05 BTC (comisión 0,001 ETH).
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
    contravalorEUR: CONTRAVALORES.permutaBTCporETH,
    notas: 'Permuta cripto-cripto ETH por BTC.',
  },
  // 7 · 2024-03-20 retirada_cripto + deposito_cripto → TRANSFERENCIA Kraken→Ledger.
  //     Comisión de red 0,0002 BTC en el origen (Kraken). El depósito recibe 0,3 BTC netos.
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
  // 8 · 2024-04-05 venta parcial BTC (comisión 10 €).
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
    contravalorEUR: CONTRAVALORES.ventaBTC_1,
    notas: 'Venta parcial BTC.',
  },
  // 9 · 2024-04-15 compra ADA con EUR (sin comisión).
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
    contravalorEUR: CONTRAVALORES.compraADA,
    notas: 'Compra ADA.',
  },
  // 10 · 2024-05-15 staking ADA → RENDIMIENTO.
  {
    id: '2024-010',
    fechaHora: '2024-05-15T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'ADA',
    cantidadEntrada: '5',
    contravalorEUR: CONTRAVALORES.stakingADA,
    notas: 'Recompensa staking ADA (RCM).',
  },
  // 11 · 2024-05-20 venta del airdrop TOKENX.
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
    contravalorEUR: CONTRAVALORES.ventaTOKENX,
    notas: 'Venta del airdrop TOKENX.',
  },
  // 12 · 2024-06-01 minería PoW → MINERÍA (entra BTC en Ledger).
  {
    id: '2024-012',
    fechaHora: '2024-06-01T12:00:00',
    tipo: 'MINERIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: LEDGER,
    activoEntrada: 'BTC',
    cantidadEntrada: '0.002',
    contravalorEUR: CONTRAVALORES.mineriaBTC,
    notas: 'Recompensa minería PoW.',
  },
  // 13 · 2024-06-10 venta total ADA (500 compradas + 5 de staking).
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
    contravalorEUR: CONTRAVALORES.ventaADA,
    notas: 'Venta total ADA (incluye las 5 de staking).',
  },
  // 14 · 2024-07-01 recompra BTC con EUR.
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
    contravalorEUR: CONTRAVALORES.compraBTC_2,
    notas: 'Recompra BTC.',
  },
  // 15 · 2024-07-15 permuta BTC por stablecoin USDC.
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
    contravalorEUR: CONTRAVALORES.permutaBTCporUSDC,
    notas: 'Permuta BTC por stablecoin USDC.',
  },
  // 16 · 2024-08-15 interés lending USDC → RENDIMIENTO.
  {
    id: '2024-016',
    fechaHora: '2024-08-15T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'USDC',
    cantidadEntrada: '5',
    contravalorEUR: CONTRAVALORES.interesUSDC,
    notas: 'Interés por lending de USDC (RCM).',
  },
  // 17 · 2024-09-01 robo/estafa phishing → PÉRDIDA (sale BTC de Ledger).
  {
    id: '2024-017',
    fechaHora: '2024-09-01T12:00:00',
    tipo: 'PERDIDA',
    ubicacionOrigen: LEDGER,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.005',
    contravalorEUR: CONTRAVALORES.perdidaBTC,
    notas: 'Robo/estafa phishing en wallet.',
  },
  // 18 · 2024-09-15 retirada_fiat: sale EUR de Kraken hacia EXTERIOR.
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
  // 19 · 2024-10-01 venta final BTC.
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
    contravalorEUR: CONTRAVALORES.ventaBTC_final,
    notas: 'Venta final BTC.',
  },
]

/** Fecha de corte del cierre del ejercicio 2024 (inclusive). */
export const CORTE_2024 = '2024-12-31T23:59:59'

/**
 * Saldos totales esperados a 31/12/2024 (suma de todas las ubicaciones), por activo.
 * Golden intocable (Regla de oro 9). Verificado a mano contra el CSV.
 */
export const SALDOS_TOTALES_ESPERADOS: Record<string, string> = {
  BTC: '0.4068',
  ETH: '1.049',
  USDC: '305',
  EUR: '4254',
  ADA: '0',
  TOKENX: '0',
}

/**
 * Reparto esperado por ubicación × activo a 31/12/2024 (los pares con saldo ≠ 0).
 * Verificado a mano contra el CSV.
 */
export const SALDOS_POR_UBICACION_ESPERADOS: Array<{
  ubicacion: string
  activo: string
  saldo: string
}> = [
  { ubicacion: KRAKEN, activo: 'BTC', saldo: '0.1098' },
  { ubicacion: LEDGER, activo: 'BTC', saldo: '0.297' },
  { ubicacion: KRAKEN, activo: 'ETH', saldo: '1.049' },
  { ubicacion: KRAKEN, activo: 'USDC', saldo: '305' },
  { ubicacion: KRAKEN, activo: 'EUR', saldo: '4254' },
  { ubicacion: KRAKEN, activo: 'ADA', saldo: '0' },
  { ubicacion: KRAKEN, activo: 'TOKENX', saldo: '0' },
]
