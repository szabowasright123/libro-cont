/**
 * mini-caso-demo.ts — dataset del CASO DE EJEMPLO (mini-caso 2024) para el onboarding (P9.3).
 *
 * Es el mismo mini-caso 2024 del taller: ubicaciones, activos, apuntes y —novedad de la
 * pestaña Cartera— unos precios manuales de demostración. Lo carga el botón «Cargar caso de
 * ejemplo» de Inicio (repositorio.cargarCasoDemo).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGLA DE ORO 2 (golden intocable): este fichero NO importa de `tests/golden/` ni al revés.
 * El golden (`tests/golden/mini-caso.ts`) es la fuente de verdad de los tests y queda como
 * está. Para garantizar que la demo no diverge del golden, `tests/demo/mini-caso-demo.test.ts`
 * compara ambos por IGUALDAD ESTRUCTURAL (apuntes y ubicaciones). Si tocas uno, toca el otro.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Módulo de datos puro: sin React, sin Dexie. Los tipos son de dominio (`Apunte`, etc.).
 */
import { type Activo, type Apunte, type Ubicacion, UBICACION_EXTERIOR } from '../../engine/types'
import type { PrecioRegistro } from '../tipos'

const KRAKEN = 'Kraken'
const LEDGER = 'Ledger'

/** Ubicaciones del caso de ejemplo (Kraken exchange KYC · Ledger wallet no-KYC). */
export const UBICACIONES_CASO_DEMO: Ubicacion[] = [
  { id: KRAKEN, nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2024-01-01T00:00:00' },
  { id: LEDGER, nombre: 'Ledger', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-01T00:00:00' },
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
 * Los 19 apuntes del mini-caso 2024 (misma transcripción que el golden). Orden cronológico.
 * Los contravalores «(supuesto)» son precios de mercado 2024 asumidos; los «(CSV)», datos
 * duros del mini-caso (ver la cabecera de tests/golden/mini-caso.ts).
 */
export const APUNTES_CASO_DEMO: Apunte[] = [
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

/** Fecha (ISO, solo día) en que se «introdujeron» los precios manuales de la demo. */
export const FECHA_PRECIOS_DEMO = '2026-08-08'

/**
 * Precios manuales de demostración para la pestaña Cartera (P9.2/P9.3): BTC 100.000 ·
 * ETH 3.000 · USDC 0,92. EUR no lleva precio (vale 1). Cadenas decimales internas (punto).
 */
export const PRECIOS_CASO_DEMO: PrecioRegistro[] = [
  { activo: 'BTC', precioEur: '100000', fechaISO: FECHA_PRECIOS_DEMO },
  { activo: 'ETH', precioEur: '3000', fechaISO: FECHA_PRECIOS_DEMO },
  { activo: 'USDC', precioEur: '0.92', fechaISO: FECHA_PRECIOS_DEMO },
]
