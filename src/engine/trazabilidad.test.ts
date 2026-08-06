/**
 * trazabilidad.test.ts — tests del propagador de origen KYC / no-KYC (P6).
 *
 * Cubre: casos sintéticos de mezcla (FIFO por ubicación consume lo más antiguo primero),
 * preservación del origen y la cadena al transferir, la cadena completa del BTC de Ledger
 * en el mini-caso (compra KYC → transferencia → minería no-KYC), la RECONCILIACIÓN de la
 * cartera por origen con la hoja SALDOS (invariante clave), y la cadena probatoria.
 */
import { describe, it, expect } from 'vitest'
import {
  calcularTrazabilidad,
  celdaCartera,
  cadenaProbatoria,
  selloOrigenApunte,
  viaEvidencia,
  VIAS_EVIDENCIA,
} from './trazabilidad'
import { calcularSaldos } from './saldos'
import { mapaKyc } from './archivo'
import { D } from './decimal'
import type { Apunte, Ubicacion } from './types'
import { UBICACION_EXTERIOR } from './types'
import {
  APUNTES_MINICASO,
  UBICACIONES_MINICASO,
  CORTE_2024,
  KRAKEN,
  LEDGER,
} from '../../tests/golden/mini-caso'

// Ubicaciones sintéticas para los casos de mezcla.
const EX: Ubicacion = { id: 'EX', nombre: 'Exchange', tipo: 'exchange', kyc: true, fechaAlta: '2024-01-01T00:00:00' }
const W: Ubicacion = { id: 'W', nombre: 'Wallet', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-01T00:00:00' }

describe('trazabilidad · casos de mezcla (FIFO por ubicación)', () => {
  it('una ubicación mezcla KYC (transferido) y no-KYC (minado); el consumo gasta lo más antiguo', () => {
    const apuntes: Apunte[] = [
      // Compra 1 BTC en exchange KYC.
      { id: 'a1', fechaHora: '2024-01-01T10:00:00', tipo: 'COMPRA', ubicacionOrigen: 'EX', ubicacionDestino: 'EX', activoSalida: 'EUR', cantidadSalida: '40000', activoEntrada: 'BTC', cantidadEntrada: '1', contravalorEUR: '40000' },
      // Transfiere 1 BTC a la wallet (el origen KYC viaja con la cripto).
      { id: 'a2', fechaHora: '2024-02-01T10:00:00', tipo: 'TRANSFERENCIA', ubicacionOrigen: 'EX', ubicacionDestino: 'W', activoSalida: 'BTC', cantidadSalida: '1', activoEntrada: 'BTC', cantidadEntrada: '1' },
      // Mina 0,5 BTC en la wallet (no-KYC).
      { id: 'a3', fechaHora: '2024-03-01T10:00:00', tipo: 'MINERIA', ubicacionOrigen: UBICACION_EXTERIOR, ubicacionDestino: 'W', activoEntrada: 'BTC', cantidadEntrada: '0.5', contravalorEUR: '25000' },
      // Vende 0,4 BTC desde la wallet → consume la parcela más antigua (la KYC transferida).
      { id: 'a4', fechaHora: '2024-04-01T10:00:00', tipo: 'VENTA', ubicacionOrigen: 'W', ubicacionDestino: 'W', activoSalida: 'BTC', cantidadSalida: '0.4', activoEntrada: 'EUR', cantidadEntrada: '24000', contravalorEUR: '24000' },
    ]
    const r = calcularTrazabilidad(apuntes, [EX, W])
    const wBtc = celdaCartera(r, 'W', 'BTC')!
    expect(wBtc).toBeDefined()
    expect(D(wBtc.kyc).equals(D('0.6'))).toBe(true) // 1 KYC − 0,4 vendida = 0,6
    expect(D(wBtc.noKyc).equals(D('0.5'))).toBe(true) // 0,5 minada intacta
    expect(D(wBtc.total).equals(D('1.1'))).toBe(true)
    expect(wBtc.deficit).toBe(false)
  })

  it('la transferencia preserva el origen y encadena el apunte de transferencia', () => {
    const apuntes: Apunte[] = [
      { id: 'a1', fechaHora: '2024-01-01T10:00:00', tipo: 'COMPRA', ubicacionOrigen: 'EX', ubicacionDestino: 'EX', activoSalida: 'EUR', cantidadSalida: '40000', activoEntrada: 'BTC', cantidadEntrada: '1', contravalorEUR: '40000' },
      { id: 'a2', fechaHora: '2024-02-01T10:00:00', tipo: 'TRANSFERENCIA', ubicacionOrigen: 'EX', ubicacionDestino: 'W', activoSalida: 'BTC', cantidadSalida: '1', activoEntrada: 'BTC', cantidadEntrada: '1' },
    ]
    const r = calcularTrazabilidad(apuntes, [EX, W])
    const wBtc = celdaCartera(r, 'W', 'BTC')!
    expect(wBtc.parcelas).toHaveLength(1)
    const p = wBtc.parcelas[0]!
    expect(p.origen).toBe('KYC')
    expect(p.loteApunteId).toBe('a1') // el lote de origen sigue siendo la compra
    expect(p.cadena).toEqual(['a1', 'a2']) // compra → transferencia
    // El exchange ya no tiene BTC.
    expect(D(celdaCartera(r, 'EX', 'BTC')!.total).equals(D('0'))).toBe(true)
  })

  it('la comisión de red se quema del origen (el total cuadra con SALDOS)', () => {
    const apuntes: Apunte[] = [
      { id: 'a1', fechaHora: '2024-01-01T10:00:00', tipo: 'COMPRA', ubicacionOrigen: 'EX', ubicacionDestino: 'EX', activoSalida: 'EUR', cantidadSalida: '40000', activoEntrada: 'BTC', cantidadEntrada: '1', contravalorEUR: '40000' },
      { id: 'a2', fechaHora: '2024-02-01T10:00:00', tipo: 'TRANSFERENCIA', ubicacionOrigen: 'EX', ubicacionDestino: 'W', activoSalida: 'BTC', cantidadSalida: '0.5', activoEntrada: 'BTC', cantidadEntrada: '0.5', comisionCantidad: '0.001', comisionActivo: 'BTC' },
    ]
    const r = calcularTrazabilidad(apuntes, [EX, W])
    // EX: 1 − 0,5 (transferida) − 0,001 (comisión) = 0,499
    expect(D(celdaCartera(r, 'EX', 'BTC')!.total).equals(D('0.499'))).toBe(true)
    expect(D(celdaCartera(r, 'W', 'BTC')!.total).equals(D('0.5'))).toBe(true)
  })

  it('marca déficit si se transmite más de lo que hay en la ubicación', () => {
    const apuntes: Apunte[] = [
      { id: 'a1', fechaHora: '2024-01-01T10:00:00', tipo: 'VENTA', ubicacionOrigen: 'EX', ubicacionDestino: 'EX', activoSalida: 'BTC', cantidadSalida: '1', activoEntrada: 'EUR', cantidadEntrada: '40000', contravalorEUR: '40000' },
    ]
    const r = calcularTrazabilidad(apuntes, [EX, W])
    expect(celdaCartera(r, 'EX', 'BTC')!.deficit).toBe(true)
  })
})

describe('GOLDEN-LIGADO · la cartera por origen reconcilia con la hoja SALDOS (mini-caso)', () => {
  const traza = calcularTrazabilidad(APUNTES_MINICASO, UBICACIONES_MINICASO, new Date(CORTE_2024).getTime())
  const saldos = calcularSaldos(APUNTES_MINICASO, CORTE_2024)

  for (const s of saldos) {
    it(`${s.ubicacion} · ${s.activo}: trazabilidad total = saldo (${s.saldo})`, () => {
      const celda = celdaCartera(traza, s.ubicacion, s.activo)
      expect(celda, `falta la celda ${s.ubicacion} ${s.activo} en la trazabilidad`).toBeDefined()
      expect(D(celda!.total).equals(D(s.saldo)), `total ${celda!.total} ≠ saldo ${s.saldo}`).toBe(true)
      // kyc + noKyc == total (consistencia interna).
      expect(D(celda!.kyc).plus(D(celda!.noKyc)).equals(D(celda!.total))).toBe(true)
    })
  }

  it('la trazabilidad no inventa celdas fuera de SALDOS (salvo saldo 0)', () => {
    const clavesSaldos = new Set(saldos.map((s) => `${s.ubicacion} ${s.activo}`))
    for (const c of traza.cartera) {
      if (D(c.total).equals(D('0'))) continue
      expect(clavesSaldos.has(`${c.ubicacion} ${c.activo}`), `celda extra ${c.ubicacion} ${c.activo}`).toBe(true)
    }
  })

  it('no hay parcelas en EXTERIOR (la frontera no custodia saldo)', () => {
    expect(traza.cartera.some((c) => c.ubicacion === UBICACION_EXTERIOR)).toBe(false)
  })
})

describe('GOLDEN-LIGADO · cadena completa del BTC de Ledger (mini-caso)', () => {
  const traza = calcularTrazabilidad(APUNTES_MINICASO, UBICACIONES_MINICASO, new Date(CORTE_2024).getTime())

  it('Ledger BTC = 0,295 KYC + 0,002 no-KYC (mezcla repartida por la convención D1)', () => {
    const ledgerBtc = celdaCartera(traza, LEDGER, 'BTC')!
    expect(D(ledgerBtc.total).equals(D('0.297'))).toBe(true)
    expect(D(ledgerBtc.kyc).equals(D('0.295'))).toBe(true)
    expect(D(ledgerBtc.noKyc).equals(D('0.002'))).toBe(true)
  })

  it('la parcela KYC procede de la compra en Kraken vía transferencia; la no-KYC de la minería', () => {
    const ledgerBtc = celdaCartera(traza, LEDGER, 'BTC')!
    const kycP = ledgerBtc.parcelas.find((p) => p.origen === 'KYC')!
    const noKycP = ledgerBtc.parcelas.find((p) => p.origen === 'NO_KYC')!
    // KYC: compra 2024-002 (Kraken) → transferencia 2024-007 (Kraken→Ledger).
    expect(kycP.loteApunteId).toBe('2024-002')
    expect(kycP.cadena).toEqual(['2024-002', '2024-007'])
    expect(D(kycP.cantidad).equals(D('0.295'))).toBe(true)
    // no-KYC: minería propia 2024-012 (Ledger).
    expect(noKycP.loteApunteId).toBe('2024-012')
    expect(noKycP.cadena).toEqual(['2024-012'])
    expect(D(noKycP.cantidad).equals(D('0.002'))).toBe(true)
  })

  it('Kraken BTC es íntegramente de origen KYC', () => {
    const krakenBtc = celdaCartera(traza, KRAKEN, 'BTC')!
    expect(D(krakenBtc.total).equals(D('0.1098'))).toBe(true)
    expect(D(krakenBtc.noKyc).equals(D('0'))).toBe(true)
  })
})

describe('trazabilidad · cadena probatoria «¿cómo demuestro este saldo?»', () => {
  const traza = calcularTrazabilidad(APUNTES_MINICASO, UBICACIONES_MINICASO, new Date(CORTE_2024).getTime())

  it('el informe del BTC de Ledger tiene 2 ramas (KYC y no-KYC) con sus eslabones', () => {
    const informe = cadenaProbatoria(traza, APUNTES_MINICASO, [], UBICACIONES_MINICASO, LEDGER, 'BTC')
    expect(informe.ramas).toHaveLength(2)
    expect(D(informe.saldo).equals(D('0.297'))).toBe(true)

    const kycRama = informe.ramas.find((r) => r.origen === 'KYC')!
    expect(kycRama.eslabones.map((e) => e.apunteId)).toEqual(['2024-002', '2024-007'])
    expect(kycRama.eslabones[0]!.papel).toBe('adquisicion')
    expect(kycRama.eslabones[1]!.papel).toBe('transferencia')
    // Sin justificantes → todos los eslabones son huecos.
    expect(kycRama.eslabones.every((e) => e.estado === 'sin-justificar')).toBe(true)

    const noKycRama = informe.ramas.find((r) => r.origen === 'NO_KYC')!
    expect(noKycRama.eslabones.map((e) => e.apunteId)).toEqual(['2024-012'])
  })

  it('marca huérfano un eslabón cuyo apunte ya no existe', () => {
    // Diario sin el apunte de adquisición referenciado por la cadena.
    const informe = cadenaProbatoria(traza, [], [], UBICACIONES_MINICASO, LEDGER, 'BTC')
    const huerfanos = informe.ramas.flatMap((r) => r.eslabones).filter((e) => e.huerfano)
    expect(huerfanos.length).toBeGreaterThan(0)
  })

  it('un saldo sin parcelas (celda inexistente) da un informe vacío coherente', () => {
    const informe = cadenaProbatoria(traza, APUNTES_MINICASO, [], UBICACIONES_MINICASO, 'INEXISTENTE', 'BTC')
    expect(informe.ramas).toHaveLength(0)
    expect(informe.saldo).toBe('0')
  })
})

describe('trazabilidad · sello de origen del apunte', () => {
  const kyc = mapaKyc(UBICACIONES_MINICASO)

  it('una operación en Kraken (KYC) sella KYC', () => {
    const s = selloOrigenApunte({ ubicacionOrigen: KRAKEN, ubicacionDestino: KRAKEN }, kyc)
    expect(s).toMatchObject({ kyc: true, aplica: true })
  })

  it('una minería a Ledger (no-KYC) sella no-KYC', () => {
    const s = selloOrigenApunte({ ubicacionOrigen: UBICACION_EXTERIOR, ubicacionDestino: LEDGER }, kyc)
    expect(s).toMatchObject({ kyc: false, aplica: true })
  })

  it('un apunte sin ubicación real no aplica sello', () => {
    const s = selloOrigenApunte({ ubicacionOrigen: UBICACION_EXTERIOR, ubicacionDestino: UBICACION_EXTERIOR }, kyc)
    expect(s.aplica).toBe(false)
  })
})

describe('trazabilidad · catálogo de vías de evidencia', () => {
  it('todas las vías tienen clave, etiqueta, documentación y cita literal del manual', () => {
    for (const v of VIAS_EVIDENCIA) {
      expect(v.clave).toBeTruthy()
      expect(v.etiqueta).toBeTruthy()
      expect(v.documentacion).toBeTruthy()
      expect(v.cita).toBeTruthy()
      expect(v.cita).not.toContain('TODO-REVISION')
      // Las citas del manual del taller llevan la referencia [MT]/[MF].
      expect(v.cita).toMatch(/\[M[TF]\]/)
    }
  })

  it('resuelve una vía por clave y devuelve undefined si no existe', () => {
    expect(viaEvidencia('exchange-kyc')?.etiqueta).toBe('Exchange con KYC')
    expect(viaEvidencia('no-existe')).toBeUndefined()
    expect(viaEvidencia(undefined)).toBeUndefined()
  })
})
