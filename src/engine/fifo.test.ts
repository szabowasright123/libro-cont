/**
 * fifo.test.ts — PROPERTY TESTS del motor FIFO (fase P1, paso 7).
 *
 * Propiedades que deben cumplirse SIEMPRE, sobre secuencias aleatorias deterministas:
 *   (P1) consumido ≤ adquirido.
 *   (P2) coste del restante = Σ costes de lotes abiertos − Σ costes consumidos.
 *   (P3) el resultado total no cambia al partir un consumo en dos consecutivos.
 *
 * Además, pruebas puntuales: orden cronológico obligatorio, comisión EUR (suma al
 * coste / minora la transmisión) y consumo sin saldo FIFO suficiente.
 *
 * Generador determinista (LCG con semilla fija): sin Math.random, reproducible.
 */

import { describe, it, expect } from 'vitest'
import {
  calcularFifoActivo,
  calcularFifo,
  exigirOrdenCronologico,
  transmisionesDelDiario,
} from './fifo'
import { type Apunte } from './types'
import { D, Decimal } from './decimal'

// ── PRNG determinista (LCG de Numerical Recipes) ─────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** Genera una secuencia cronológica de COMPRAs y VENTAs de un activo ficticio X. */
function generarEscenario(rnd: () => number): Apunte[] {
  const apuntes: Apunte[] = []
  const nOps = 3 + Math.floor(rnd() * 8)
  let dispon = new Decimal(0) // cantidad disponible (para no sobrevender por defecto)
  let dia = 1
  for (let i = 0; i < nOps; i++) {
    dia += 1 + Math.floor(rnd() * 5)
    const fecha = `2024-${String(1 + Math.floor(dia / 28)).padStart(2, '0')}-${String(
      1 + (dia % 28),
    ).padStart(2, '0')}T10:00:00`
    const id = `X-${String(i + 1).padStart(3, '0')}`
    const compra = dispon.lessThanOrEqualTo(0) || rnd() < 0.55
    if (compra) {
      const cant = new Decimal((0.1 + rnd() * 3).toFixed(6))
      const precio = new Decimal((100 + rnd() * 900).toFixed(2))
      const contravalor = cant.times(precio).toFixed(2)
      apuntes.push({
        id,
        fechaHora: fecha,
        tipo: 'COMPRA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'EUR',
        cantidadSalida: contravalor,
        activoEntrada: 'X',
        cantidadEntrada: cant.toFixed(6),
        contravalorEUR: contravalor,
      })
      dispon = dispon.plus(cant)
    } else {
      const cant = new Decimal(dispon.times(0.1 + rnd() * 0.8).toFixed(6))
      if (cant.lessThanOrEqualTo(0)) continue
      const precio = new Decimal((100 + rnd() * 900).toFixed(2))
      const contravalor = cant.times(precio).toFixed(2)
      apuntes.push({
        id,
        fechaHora: fecha,
        tipo: 'VENTA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'X',
        cantidadSalida: cant.toFixed(6),
        activoEntrada: 'EUR',
        cantidadEntrada: contravalor,
        contravalorEUR: contravalor,
      })
      dispon = dispon.minus(cant)
    }
  }
  return apuntes
}

/** Σ de los costes imputados de todas las transmisiones de un activo. */
function costeConsumidoTotal(apuntes: Apunte[], activo: string): Decimal {
  const { transmisiones } = calcularFifoActivo(apuntes, activo)
  return transmisiones.reduce<Decimal>(
    (acc, t) => acc.plus(t.consumos.reduce<Decimal>((a, c) => a.plus(D(c.costeImputadoEUR)), D('0'))),
    D('0'),
  )
}

/** Σ de los costes totales de los lotes abiertos de un activo. */
function costeAbiertoTotal(apuntes: Apunte[], activo: string): Decimal {
  return apuntes
    .filter((ap) => ap.tipo === 'COMPRA' && ap.activoEntrada === activo)
    .reduce<Decimal>((acc, ap) => acc.plus(D(ap.contravalorEUR)), D('0'))
}

describe('FIFO · property tests (100 escenarios deterministas)', () => {
  const rnd = lcg(20240806)
  const escenarios = Array.from({ length: 100 }, () => generarEscenario(rnd))

  it('(P1) consumido ≤ adquirido en todos los escenarios', () => {
    for (const apuntes of escenarios) {
      const { resumen } = calcularFifoActivo(apuntes, 'X')
      expect(
        D(resumen.consumidoTotal).lessThanOrEqualTo(D(resumen.adquiridoTotal)),
        `consumido ${resumen.consumidoTotal} > adquirido ${resumen.adquiridoTotal}`,
      ).toBe(true)
    }
  })

  it('(P2) coste restante = Σ costes abiertos − Σ costes consumidos', () => {
    for (const apuntes of escenarios) {
      const { resumen } = calcularFifoActivo(apuntes, 'X')
      const esperado = costeAbiertoTotal(apuntes, 'X').minus(costeConsumidoTotal(apuntes, 'X'))
      const dif = D(resumen.costeRestanteEUR).minus(esperado).abs()
      // Tolerancia ínfima por el redondeo de las divisiones a 40 dígitos.
      expect(dif.lessThan(D('1e-20')), `dif ${dif.toFixed()}`).toBe(true)
    }
  })

  it('(P3) el resultado no cambia al partir un consumo en dos consecutivos', () => {
    for (const apuntes of escenarios) {
      // Busca la primera VENTA con cantidad partible.
      const idx = apuntes.findIndex((a) => a.tipo === 'VENTA' && D(a.cantidadSalida!).greaterThan(0))
      if (idx < 0) continue
      const venta = apuntes[idx]!
      const qty = D(venta.cantidadSalida!)
      const cv = D(venta.contravalorEUR!)
      const q1 = qty.times('0.4')
      const q2 = qty.minus(q1)
      // Reparte el contravalor proporcionalmente (mismo precio unitario).
      const cv1 = cv.times('0.4')
      const cv2 = cv.minus(cv1)
      const partido: Apunte[] = [
        ...apuntes.slice(0, idx),
        {
          ...venta,
          id: venta.id + 'a',
          cantidadSalida: q1.toFixed(),
          cantidadEntrada: cv1.toFixed(),
          contravalorEUR: cv1.toFixed(),
        },
        {
          ...venta,
          id: venta.id + 'b',
          cantidadSalida: q2.toFixed(),
          cantidadEntrada: cv2.toFixed(),
          contravalorEUR: cv2.toFixed(),
        },
        ...apuntes.slice(idx + 1),
      ]
      const resOrig = calcularFifoActivo(apuntes, 'X').transmisiones.reduce<Decimal>(
        (a, t) => a.plus(D(t.resultadoEUR)),
        D('0'),
      )
      const resPart = calcularFifoActivo(partido, 'X').transmisiones.reduce<Decimal>(
        (a, t) => a.plus(D(t.resultadoEUR)),
        D('0'),
      )
      const dif = resOrig.minus(resPart).abs()
      expect(dif.lessThan(D('1e-18')), `orig ${resOrig.toFixed()} vs part ${resPart.toFixed()}`).toBe(
        true,
      )
    }
  })
})

describe('FIFO · reglas duras', () => {
  it('lanza si el diario no está en orden cronológico', () => {
    const desordenado: Apunte[] = [
      {
        id: 'a',
        fechaHora: '2024-05-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'EUR',
        cantidadSalida: '100',
        activoEntrada: 'X',
        cantidadEntrada: '1',
        contravalorEUR: '100',
      },
      {
        id: 'b',
        fechaHora: '2024-01-01T10:00:00', // anterior → rompe el orden
        tipo: 'VENTA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'X',
        cantidadSalida: '1',
        activoEntrada: 'EUR',
        cantidadEntrada: '120',
        contravalorEUR: '120',
      },
    ]
    expect(() => exigirOrdenCronologico(desordenado)).toThrow(/orden cronológico/)
    expect(() => calcularFifo(desordenado)).toThrow(/orden cronológico/)
  })

  it('comisión EUR: suma al coste del lote (compra) y minora la transmisión (venta)', () => {
    const apuntes: Apunte[] = [
      {
        id: 'c1',
        fechaHora: '2024-01-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'EUR',
        cantidadSalida: '1000',
        activoEntrada: 'X',
        cantidadEntrada: '1',
        comisionCantidad: '20',
        comisionActivo: 'EUR',
        contravalorEUR: '1000',
      },
      {
        id: 'v1',
        fechaHora: '2024-02-01T10:00:00',
        tipo: 'VENTA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'X',
        cantidadSalida: '1',
        activoEntrada: 'EUR',
        cantidadEntrada: '1500',
        comisionCantidad: '15',
        comisionActivo: 'EUR',
        contravalorEUR: '1500',
      },
    ]
    const { transmisiones } = calcularFifoActivo(apuntes, 'X')
    const t = transmisiones[0]!
    expect(D(t.costeFifoEUR).equals(D('1020'))).toBe(true) // 1000 + 20 comisión
    expect(D(t.valorTransmisionNetoEUR).equals(D('1485'))).toBe(true) // 1500 − 15 comisión
    expect(D(t.resultadoEUR).equals(D('465'))).toBe(true) // 1485 − 1020
  })

  it('marca saldoFifoInsuficiente al vender sin lotes suficientes', () => {
    const apuntes: Apunte[] = [
      {
        id: 'v-solo',
        fechaHora: '2024-01-01T10:00:00',
        tipo: 'VENTA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'X',
        cantidadSalida: '1',
        activoEntrada: 'EUR',
        cantidadEntrada: '500',
        contravalorEUR: '500',
      },
    ]
    const { transmisiones } = calcularFifoActivo(apuntes, 'X')
    const t = transmisiones[0]!
    expect(t.saldoFifoInsuficiente).toBe(true)
    expect(D(t.cantidadSinCoste!).equals(D('1'))).toBe(true)
    expect(D(t.costeFifoEUR).equals(D('0'))).toBe(true)
  })

  it('transmisionesDelDiario ordena por fecha y cubre todos los activos', () => {
    const apuntes: Apunte[] = [
      {
        id: 'ca',
        fechaHora: '2024-01-01T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'EUR',
        cantidadSalida: '100',
        activoEntrada: 'A',
        cantidadEntrada: '10',
        contravalorEUR: '100',
      },
      {
        id: 'cb',
        fechaHora: '2024-01-02T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'EUR',
        cantidadSalida: '200',
        activoEntrada: 'B',
        cantidadEntrada: '5',
        contravalorEUR: '200',
      },
      {
        id: 'va',
        fechaHora: '2024-02-01T10:00:00',
        tipo: 'VENTA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'A',
        cantidadSalida: '10',
        activoEntrada: 'EUR',
        cantidadEntrada: '150',
        contravalorEUR: '150',
      },
      {
        id: 'vb',
        fechaHora: '2024-03-01T10:00:00',
        tipo: 'VENTA',
        ubicacionOrigen: 'X',
        ubicacionDestino: 'X',
        activoSalida: 'B',
        cantidadSalida: '5',
        activoEntrada: 'EUR',
        cantidadEntrada: '250',
        contravalorEUR: '250',
      },
    ]
    // El diario ya está en orden cronológico; el test valida que se recogen ambos
    // activos (A y B) y que las transmisiones salen ordenadas por fecha.
    const todas = transmisionesDelDiario(apuntes)
    expect(todas.map((t) => t.apunteId)).toEqual(['va', 'vb'])
  })
})
