/**
 * aviso721.test.ts — aviso 721 con doble fecha, exclusión de autocustodia y exclusión del
 * fiat (derivada D2, P9.4).
 *   - ubicación extranjera CUSTODIADA > 50.000 € → aviso (supera) en ambos cortes;
 *   - autocustodia con el mismo saldo → sin aviso (no computa);
 *   - sin precios → «sin valorar» (el total es un mínimo, no supera);
 *   - saldo en fiat → fuera del cómputo (V2185-23: va al bloque de cuentas del 720), pero
 *     visible en `totalFiatExcluidoEUR` para que no parezca un saldo perdido;
 *   - REGRESIÓN: una cuenta extranjera con SOLO euros no dispara el aviso.
 */
import { describe, it, expect } from 'vitest'
import type { Activo, Apunte, Ubicacion } from '../../engine/types'
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

/** Depósito de `cantidad` unidades de `activo` en una ubicación desde EXTERIOR (sin contrapata). */
function deposito(
  id: string,
  ubic: string,
  activo: string,
  cantidad: string,
  fecha: string,
): Apunte {
  return {
    id,
    fechaHora: fecha,
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: ubic,
    activoEntrada: activo,
    cantidadEntrada: cantidad,
  }
}

/** Depósito de `cantidad` BTC (atajo, el caso más frecuente en estas pruebas). */
function depositoBtc(id: string, ubic: string, cantidad: string, fecha: string): Apunte {
  return deposito(id, ubic, 'BTC', cantidad, fecha)
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

describe('Aviso 721 · el fiat queda fuera del cómputo (DGT V2185-23)', () => {
  it('el saldo en euros no suma al total valorado, pero se informa aparte', () => {
    const apuntes = [
      depositoBtc('2024-001', 'Kraken', '1', '2024-01-16T10:00:00'),
      deposito('2024-002', 'Kraken', 'EUR', '7674', '2024-02-01T12:00:00'),
    ]
    const a = calcularAviso721(apuntes, [KRAKEN_EXTRANJERO], 2024, { BTC: '60000' })
    // El total del 721 son SOLO las monedas virtuales.
    expect(D(a.normativo.totalValoradoEUR).equals(D('60000'))).toBe(true)
    expect(a.normativo.celdas.map((c) => c.activo)).toEqual(['BTC'])
    // …y el euro no desaparece: se enseña como excluido, con su importe.
    expect(D(a.normativo.totalFiatExcluidoEUR).equals(D('7674'))).toBe(true)
    expect(a.normativo.celdasFiatExcluidas).toHaveLength(1)
    expect(a.normativo.celdasFiatExcluidas[0]?.activo).toBe('EUR')
    expect(a.normativo.celdasFiatExcluidas[0]?.saldo).toBe('7674')
  })

  it('REGRESIÓN: una cuenta extranjera con SOLO euros no dispara el aviso', () => {
    const apuntes = [deposito('2024-001', 'Kraken', 'EUR', '90000', '2024-02-01T12:00:00')]
    const a = calcularAviso721(apuntes, [KRAKEN_EXTRANJERO], 2024, {})
    expect(a.aplica).toBe(false)
    expect(a.normativo.supera).toBe(false)
    expect(a.normativo.celdas).toHaveLength(0)
    expect(D(a.normativo.totalValoradoEUR).isZero()).toBe(true)
    // Aunque no haya aviso, el importe del fiat sigue calculado: es el dato que la pantalla
    // necesita para remitir al bloque de cuentas del modelo 720.
    expect(D(a.normativo.totalFiatExcluidoEUR).equals(D('90000'))).toBe(true)
  })

  it('el fiat se detecta por el catálogo, no por la cadena «EUR»', () => {
    const USD: Activo = { simbolo: 'USD', nombre: 'Dólar', decimales: 2, esFiat: true }
    const apuntes = [
      depositoBtc('2024-001', 'Kraken', '1', '2024-01-16T10:00:00'),
      deposito('2024-002', 'Kraken', 'USD', '1000', '2024-02-01T12:00:00'),
    ]
    const precios = { BTC: '60000', USD: '0.9' }
    // Sin catálogo, el dólar es un activo cualquiera y suma al 721 (comportamiento anterior).
    const sinCatalogo = calcularAviso721(apuntes, [KRAKEN_EXTRANJERO], 2024, precios)
    expect(D(sinCatalogo.normativo.totalValoradoEUR).equals(D('60900'))).toBe(true)
    // Con el catálogo del alumno, el dólar es fiat y sale del cómputo.
    const conCatalogo = calcularAviso721(
      apuntes,
      [KRAKEN_EXTRANJERO],
      2024,
      precios,
      undefined,
      [USD],
    )
    expect(D(conCatalogo.normativo.totalValoradoEUR).equals(D('60000'))).toBe(true)
    expect(D(conCatalogo.normativo.totalFiatExcluidoEUR).equals(D('900'))).toBe(true)
  })

  it('el fiat sin precio no vuelve «mínimo» el total del 721', () => {
    const USD: Activo = { simbolo: 'USD', nombre: 'Dólar', decimales: 2, esFiat: true }
    const apuntes = [
      depositoBtc('2024-001', 'Kraken', '1', '2024-01-16T10:00:00'),
      deposito('2024-002', 'Kraken', 'USD', '1000', '2024-02-01T12:00:00'),
    ]
    const a = calcularAviso721(apuntes, [KRAKEN_EXTRANJERO], 2024, { BTC: '60000' }, undefined, [
      USD,
    ])
    expect(a.normativo.haySinValorar).toBe(false)
    expect(D(a.normativo.totalValoradoEUR).equals(D('60000'))).toBe(true)
    expect(a.normativo.celdasFiatExcluidas[0]?.sinValorar).toBe(true)
    expect(D(a.normativo.totalFiatExcluidoEUR).isZero()).toBe(true)
  })
})
