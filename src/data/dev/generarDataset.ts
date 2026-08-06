/**
 * generarDataset.ts — generador de datasets sintéticos para pruebas de rendimiento
 * (P8: «probar con 5.000 apuntes»).
 *
 * Produce una secuencia de apuntes VÁLIDA y cronológica: cada ciclo ingresa fiat,
 * compra BTC, transfiere una parte a la wallet y vende una pizca. Las compras son
 * grandes y las ventas pequeñas, así el FIFO (global y por ubicación) nunca queda en
 * déficit y el motor recalcula sin errores. Es determinista (sin azar) para que las
 * mediciones sean reproducibles.
 *
 * Módulo de dominio puro: sin React, sin Dexie. Lo consumen el test de rendimiento
 * y la herramienta de desarrollo de Ajustes.
 */
import { type Apunte, type Ubicacion, UBICACION_EXTERIOR } from '../../engine/types'
import type { BorradorApunte } from '../tipos'

/** Las dos ubicaciones del dataset de demostración. */
export const UBICACIONES_DEMO: Ubicacion[] = [
  { id: 'Kraken', nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2020-01-01T00:00:00' },
  { id: 'Ledger', nombre: 'Ledger', tipo: 'wallet', kyc: false, fechaAlta: '2020-01-01T00:00:00' },
]

const KRAKEN = 'Kraken'
const LEDGER = 'Ledger'
const UNA_HORA_MS = 3_600_000

function formatoFechaLocal(ms: number): string {
  const d = new Date(ms)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

/** Los cuatro apuntes de un ciclo (sin id ni fecha, que se asignan al generar). */
type Plantilla = Omit<Apunte, 'id' | 'fechaHora'>

const CICLO: Plantilla[] = [
  // 1 · Ingreso de fiat (deposito_fiat).
  {
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: KRAKEN,
    activoEntrada: 'EUR',
    cantidadEntrada: '1000',
    notas: 'Ingreso de fiat (sintético).',
  },
  // 2 · Compra de BTC con EUR.
  {
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '800',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.01',
    comisionCantidad: '2',
    comisionActivo: 'EUR',
    contravalorEUR: '800',
    notas: 'Compra BTC (sintético).',
  },
  // 3 · Transferencia interna a la wallet (comisión de red quemada).
  {
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: LEDGER,
    activoSalida: 'BTC',
    cantidadSalida: '0.005',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.005',
    comisionCantidad: '0.0001',
    comisionActivo: 'BTC',
    notas: 'Envío a wallet propia (sintético).',
  },
  // 4 · Venta pequeña de BTC.
  {
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.002',
    activoEntrada: 'EUR',
    cantidadEntrada: '160',
    comisionCantidad: '1',
    comisionActivo: 'EUR',
    contravalorEUR: '160',
    notas: 'Venta parcial BTC (sintético).',
  },
]

/**
 * Genera `n` apuntes sintéticos válidos, en orden cronológico estricto, con
 * correlativos AAAA-NNN por año.
 */
export function generarApuntesSinteticos(n: number): Apunte[] {
  const apuntes: Apunte[] = []
  const contadorPorAnio = new Map<string, number>()
  let t = Date.UTC(2020, 0, 1, 9, 0, 0)

  for (let i = 0; i < n; i++) {
    const plantilla = CICLO[i % CICLO.length]!
    const fechaHora = formatoFechaLocal(t)
    const anio = fechaHora.slice(0, 4)
    const nnn = (contadorPorAnio.get(anio) ?? 0) + 1
    contadorPorAnio.set(anio, nnn)
    apuntes.push({ id: `${anio}-${String(nnn).padStart(3, '0')}`, fechaHora, ...plantilla })
    t += UNA_HORA_MS
  }
  return apuntes
}

/** Los mismos apuntes en forma de borrador (sin id), para cargarlos por el repositorio. */
export function generarBorradoresSinteticos(n: number): BorradorApunte[] {
  return generarApuntesSinteticos(n).map(({ id: _id, ...resto }) => resto)
}
