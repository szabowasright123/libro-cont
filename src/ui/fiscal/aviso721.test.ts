/**
 * aviso721.test.ts — aviso 721 con doble fecha y exclusión de autocustodia (derivada D2, P9.4).
 *   - ubicación extranjera CUSTODIADA > 50.000 € → aviso (supera) en ambos cortes;
 *   - autocustodia con el mismo saldo → sin aviso (no computa);
 *   - sin precios → «sin valorar» (el total es un mínimo, no supera).
 */
import { describe, it, expect } from 'vitest'
import type { Apunte, Ubicacion } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import { D } from '../../engine/decimal'
import { calcularAviso721 } from './aviso721'

const KRAKEN_EXTRANJERO: Ubicacion = {
  id: 'Kraken',
  nombre: 'Kraken',
  tipo: 'exchange',
  kyc: true,
  fechaAlta: '2024-01-01T00:00:00',
  extranjero: true, // custodio no establecido en España
}
const LEDGER_AUTOCUSTODIA: Ubicacion = {
  id: 'Ledger',
  nombre: 'Ledger',
  tipo: 'wallet',
  kyc: false,
  fechaAlta: '2024-01-01T00:00:00',
  extranjero: true, // aunque se marque, la autocustodia NO computa para el 721
  autocustodia: true,
}

/** Depósito de `cantidad` BTC en una ubicación desde EXTERIOR (sin pata EUR). */
function depositoBtc(id: string, ubic: string, cantidad: string, fecha: string): Apunte {
  return {
    id,
    fechaHora: fecha,
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: ubic,
    activoEntrada: 'BTC',
    cantidadEntrada: cantidad,
  }
}

describe('Aviso 721 · custodio extranjero > 50.000 €', () => {
  const apuntes = [depositoBtc('2024-001', 'Kraken', '1', '2024-01-16T10:00:00')]
  const ubic = [KRAKEN_EXTRANJERO]

  it('supera el umbral en AMBOS cortes (estimación 20-oct y normativo 31-dic)', () => {
    const a = calcularAviso721(apuntes, ubic, 2024, { BTC: '60000' })
    expect(a.aplica).toBe(true)
    expect(a.estimacion.supera).toBe(true)
    expect(a.normativo.supera).toBe(true)
    expect(D(a.normativo.totalValoradoEUR).equals(D('60000'))).toBe(true)
    expect(D(a.estimacion.totalValoradoEUR).equals(D('60000'))).toBe(true)
  })

  it('sin precios → «sin valorar»: el total es un mínimo (0) y no afirma que supera', () => {
    const a = calcularAviso721(apuntes, ubic, 2024, {})
    expect(a.normativo.haySinValorar).toBe(true)
    expect(a.normativo.supera).toBe(false)
    expect(a.normativo.celdas[0]?.valorEUR).toBeNull()
    expect(D(a.normativo.totalValoradoEUR).isZero()).toBe(true)
  })
})

describe('Aviso 721 · autocustodia excluida', () => {
  it('el mismo saldo en una wallet de autocustodia NO genera aviso', () => {
    const apuntes = [depositoBtc('2024-001', 'Ledger', '1', '2024-01-16T10:00:00')]
    const a = calcularAviso721(apuntes, [LEDGER_AUTOCUSTODIA], 2024, { BTC: '60000' })
    expect(a.aplica).toBe(false)
    expect(a.normativo.celdas).toHaveLength(0)
    expect(a.normativo.supera).toBe(false)
  })

  it('con custodio extranjero + wallet autocustodia, solo computa el custodio', () => {
    const apuntes = [
      depositoBtc('2024-001', 'Kraken', '1', '2024-01-16T10:00:00'),
      depositoBtc('2024-002', 'Ledger', '1', '2024-02-01T12:00:00'),
    ]
    const a = calcularAviso721(apuntes, [KRAKEN_EXTRANJERO, LEDGER_AUTOCUSTODIA], 2024, {
      BTC: '60000',
    })
    const ubicaciones = a.normativo.celdas.map((c) => c.ubicacion)
    expect(ubicaciones).toEqual(['Kraken'])
    expect(D(a.normativo.totalValoradoEUR).equals(D('60000'))).toBe(true)
  })
})
