/**
 * validaciones.test.ts — coherencia campos↔tipo, contravalor, AJUSTE, FIFO insuficiente.
 */

import { describe, it, expect } from 'vitest'
import { validarApunte, validarDiario, hayErrores } from './validaciones'
import { type Apunte } from './types'
import { APUNTES_MINICASO } from '../../tests/golden/mini-caso'

/** Constructor mínimo de apunte con overrides. */
function apunte(over: Partial<Apunte>): Apunte {
  return {
    id: 't-001',
    fechaHora: '2024-01-01T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: 'Kraken',
    ubicacionDestino: 'Kraken',
    ...over,
  }
}

/** ¿Existe un aviso con ese código? */
const tiene = (avisos: { codigo: string }[], codigo: string) => avisos.some((a) => a.codigo === codigo)

describe('validarApunte · el mini-caso no produce ningún error', () => {
  for (const ap of APUNTES_MINICASO) {
    it(`${ap.id} (${ap.tipo}) sin errores`, () => {
      expect(hayErrores(validarApunte(ap))).toBe(false)
    })
  }
})

describe('validarApunte · coherencia campos ↔ tipo', () => {
  it('RENDIMIENTO con salida → error RENDIMIENTO_CON_SALIDA', () => {
    const a = apunte({
      tipo: 'RENDIMIENTO',
      ubicacionOrigen: 'EXTERIOR',
      activoEntrada: 'ETH',
      cantidadEntrada: '1',
      activoSalida: 'ETH',
      cantidadSalida: '1',
      contravalorEUR: '100',
    })
    expect(tiene(validarApunte(a), 'RENDIMIENTO_CON_SALIDA')).toBe(true)
  })

  it('RENDIMIENTO sin entrada → error FALTA_ENTRADA', () => {
    const a = apunte({ tipo: 'RENDIMIENTO', ubicacionOrigen: 'EXTERIOR', contravalorEUR: '100' })
    expect(tiene(validarApunte(a), 'FALTA_ENTRADA')).toBe(true)
  })

  it('TRANSFERENCIA con activos distintos → error TRANSFERENCIA_MISMO_ACTIVO', () => {
    const a = apunte({
      tipo: 'TRANSFERENCIA',
      activoSalida: 'BTC',
      cantidadSalida: '1',
      activoEntrada: 'ETH',
      cantidadEntrada: '1',
    })
    expect(tiene(validarApunte(a), 'TRANSFERENCIA_MISMO_ACTIVO')).toBe(true)
  })

  it('TRANSFERENCIA mismo activo (± comisión) → sin error', () => {
    const a = apunte({
      tipo: 'TRANSFERENCIA',
      ubicacionDestino: 'Ledger',
      activoSalida: 'BTC',
      cantidadSalida: '0.3',
      activoEntrada: 'BTC',
      cantidadEntrada: '0.3',
      comisionCantidad: '0.0002',
      comisionActivo: 'BTC',
    })
    expect(hayErrores(validarApunte(a))).toBe(false)
  })

  it('COMPRA con entrada = salida → error ENTRADA_IGUAL_SALIDA', () => {
    const a = apunte({
      tipo: 'COMPRA',
      activoSalida: 'BTC',
      cantidadSalida: '1',
      activoEntrada: 'BTC',
      cantidadEntrada: '1',
      contravalorEUR: '100',
    })
    expect(tiene(validarApunte(a), 'ENTRADA_IGUAL_SALIDA')).toBe(true)
  })

  it('PÉRDIDA con entrada → error PERDIDA_CON_ENTRADA', () => {
    const a = apunte({
      tipo: 'PERDIDA',
      activoSalida: 'BTC',
      cantidadSalida: '1',
      activoEntrada: 'EUR',
      cantidadEntrada: '10',
      contravalorEUR: '0',
    })
    expect(tiene(validarApunte(a), 'PERDIDA_CON_ENTRADA')).toBe(true)
  })
})

describe('validarApunte · contravalor obligatorio en alteración', () => {
  it('VENTA sin contravalor → error FALTA_CONTRAVALOR', () => {
    const a = apunte({ tipo: 'VENTA', activoSalida: 'BTC', cantidadSalida: '1' })
    expect(tiene(validarApunte(a), 'FALTA_CONTRAVALOR')).toBe(true)
  })

  it('PÉRDIDA admite contravalor 0 explícito → sin FALTA_CONTRAVALOR', () => {
    const a = apunte({ tipo: 'PERDIDA', activoSalida: 'BTC', cantidadSalida: '1', contravalorEUR: '0' })
    expect(tiene(validarApunte(a), 'FALTA_CONTRAVALOR')).toBe(false)
  })

  it('COMPRA sin contravalor NO exige contravalor (sin alteración)', () => {
    const a = apunte({
      tipo: 'COMPRA',
      activoSalida: 'EUR',
      cantidadSalida: '100',
      activoEntrada: 'BTC',
      cantidadEntrada: '1',
    })
    expect(tiene(validarApunte(a), 'FALTA_CONTRAVALOR')).toBe(false)
  })
})

describe('validarApunte · AJUSTE y comisión', () => {
  it('AJUSTE sin rectificaA → error AJUSTE_SIN_RECTIFICA (bloqueo)', () => {
    const a = apunte({ tipo: 'AJUSTE' })
    const avisos = validarApunte(a)
    expect(tiene(avisos, 'AJUSTE_SIN_RECTIFICA')).toBe(true)
    expect(hayErrores(avisos)).toBe(true)
  })

  it('AJUSTE con rectificaA → sin AJUSTE_SIN_RECTIFICA', () => {
    const a = apunte({ tipo: 'AJUSTE', rectificaA: '2024-002' })
    expect(tiene(validarApunte(a), 'AJUSTE_SIN_RECTIFICA')).toBe(false)
  })

  it('comisión con cantidad pero sin activo → error COMISION_SIN_ACTIVO', () => {
    const a = apunte({
      tipo: 'COMPRA',
      activoSalida: 'EUR',
      cantidadSalida: '100',
      activoEntrada: 'BTC',
      cantidadEntrada: '1',
      comisionCantidad: '5',
    })
    expect(tiene(validarApunte(a), 'COMISION_SIN_ACTIVO')).toBe(true)
  })
})

describe('validarApunte · decisión manual y casos borde', () => {
  it('DONACIÓN sin sentido → ERROR (es lo que separaba el saldo de la cola FIFO)', () => {
    const a = apunte({
      tipo: 'DONACION',
      activoSalida: 'BTC',
      cantidadSalida: '1',
      contravalorEUR: '40000',
    })
    const avisos = validarApunte(a)
    expect(tiene(avisos, 'DONACION_SIN_SENTIDO')).toBe(true)
    expect(avisos.find((x) => x.codigo === 'DONACION_SIN_SENTIDO')?.nivel).toBe('error')
  })

  it('DONACIÓN ENTREGADA → aviso con el criterio de los arts. 36 y 33.5.c LIRPF', () => {
    const a = apunte({
      tipo: 'DONACION',
      sentido: 'entregada',
      activoSalida: 'BTC',
      cantidadSalida: '1',
      contravalorEUR: '40000',
    })
    const avisos = validarApunte(a)
    expect(tiene(avisos, 'DONACION_SIN_SENTIDO')).toBe(false)
    expect(tiene(avisos, 'DONACION_ENTREGADA_LUCRATIVA')).toBe(true)
    expect(avisos.find((x) => x.codigo === 'DONACION_ENTREGADA_LUCRATIVA')?.nivel).toBe('aviso')
  })

  it('AJUSTE con cantidades y sin sentido → aviso de que no mueve la cola', () => {
    const a = apunte({
      tipo: 'AJUSTE',
      rectificaA: '2024-001',
      activoSalida: 'BTC',
      cantidadSalida: '0.1',
      contravalorEUR: '4000',
    })
    expect(tiene(validarApunte(a), 'AJUSTE_CON_CANTIDADES')).toBe(true)
  })

  it('AJUSTE emite aviso AJUSTE_MANUAL además del bloqueo por rectificaA', () => {
    const avisos = validarApunte(apunte({ tipo: 'AJUSTE' }))
    expect(tiene(avisos, 'AJUSTE_MANUAL')).toBe(true)
  })

  it('TRANSFERENCIA sin ningún activo → error TRANSFERENCIA_VACIA', () => {
    expect(tiene(validarApunte(apunte({ tipo: 'TRANSFERENCIA' })), 'TRANSFERENCIA_VACIA')).toBe(true)
  })

  it('tipo fuera del catálogo → error TIPO_DESCONOCIDO', () => {
    const a = apunte({ tipo: 'INVENTADO' as unknown as Apunte['tipo'] })
    const avisos = validarApunte(a)
    expect(tiene(avisos, 'TIPO_DESCONOCIDO')).toBe(true)
    expect(avisos).toHaveLength(1) // corta la validación
  })

  it('PAGO sin salida → error FALTA_SALIDA', () => {
    const a = apunte({ tipo: 'PAGO', activoEntrada: 'EUR', cantidadEntrada: '1', contravalorEUR: '1' })
    expect(tiene(validarApunte(a), 'FALTA_SALIDA')).toBe(true)
  })
})

describe('validarDiario · avisos a nivel de diario', () => {
  it('el mini-caso no genera errores (sí puede haber avisos informativos)', () => {
    const avisos = validarDiario(APUNTES_MINICASO)
    expect(hayErrores(avisos)).toBe(false)
  })

  it('detecta FIFO_INSUFICIENTE en una venta sin lotes previos', () => {
    const diario: Apunte[] = [
      apunte({
        id: 'v',
        tipo: 'VENTA',
        activoSalida: 'BTC',
        cantidadSalida: '1',
        activoEntrada: 'EUR',
        cantidadEntrada: '500',
        contravalorEUR: '500',
      }),
    ]
    const avisos = validarDiario(diario)
    expect(tiene(avisos, 'FIFO_INSUFICIENTE')).toBe(true)
  })
})
