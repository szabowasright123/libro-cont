/**
 * modeloFormulario.test.ts — campos visibles/obligatorios por tipo y faltantes.
 */
import { describe, it, expect } from 'vitest'
import { camposDeTipo, camposFaltantes } from './modeloFormulario'
import type { BorradorApunte } from '../../data/tipos'
import { UBICACION_EXTERIOR } from '../../engine/types'

function borrador(over: Partial<BorradorApunte>): BorradorApunte {
  return { fechaHora: '2024-01-01T10:00', tipo: 'COMPRA', ubicacionOrigen: 'k', ubicacionDestino: 'k', ...over }
}

describe('camposDeTipo · visibilidad por tipo', () => {
  it('RENDIMIENTO oculta la salida y sugiere origen EXTERIOR', () => {
    const c = camposDeTipo('RENDIMIENTO')
    expect(c.salida).toBe('oculto')
    expect(c.entrada).toBe('obligatorio')
    expect(c.contravalor).toBe('obligatorio')
    expect(c.origenPorDefecto).toBe(UBICACION_EXTERIOR)
  })

  it('TRANSFERENCIA exige mismo activo y no pide contravalor', () => {
    const c = camposDeTipo('TRANSFERENCIA')
    expect(c.mismoActivo).toBe(true)
    expect(c.contravalor).toBe('oculto')
    expect(c.entrada).toBe('opcional')
    expect(c.salida).toBe('opcional')
  })

  it('PÉRDIDA solo salida, contravalor obligatorio (0 admitido), destino EXTERIOR', () => {
    const c = camposDeTipo('PERDIDA')
    expect(c.salida).toBe('obligatorio')
    expect(c.entrada).toBe('oculto')
    expect(c.contravalor).toBe('obligatorio')
    expect(c.destinoPorDefecto).toBe(UBICACION_EXTERIOR)
  })

  it('AJUSTE exige rectificaA y causa', () => {
    const c = camposDeTipo('AJUSTE')
    expect(c.rectificaA).toBe('obligatorio')
    expect(c.causaObligatoria).toBe(true)
  })

  it('DONACIÓN entregada → salida; recibida → entrada', () => {
    expect(camposDeTipo('DONACION', 'entregada').salida).toBe('obligatorio')
    expect(camposDeTipo('DONACION', 'entregada').entrada).toBe('oculto')
    expect(camposDeTipo('DONACION', 'recibida').entrada).toBe('obligatorio')
    expect(camposDeTipo('DONACION', 'recibida').salida).toBe('oculto')
    expect(camposDeTipo('DONACION').preguntaSentidoDonacion).toBe(true)
  })
})

describe('camposFaltantes', () => {
  it('COMPRA sin cantidades ni contravalor → 3 faltas', () => {
    const c = camposDeTipo('COMPRA')
    const faltan = camposFaltantes(borrador({ tipo: 'COMPRA', activoSalida: 'EUR', activoEntrada: 'BTC' }), c)
    const campos = faltan.map((f) => f.campo)
    expect(campos).toContain('salida') // sin cantidadSalida
    expect(campos).toContain('entrada') // sin cantidadEntrada
    expect(campos).toContain('contravalorEUR')
  })

  it('COMPRA completa → sin faltas', () => {
    const c = camposDeTipo('COMPRA')
    const b = borrador({
      tipo: 'COMPRA',
      activoSalida: 'EUR',
      cantidadSalida: '20000',
      activoEntrada: 'BTC',
      cantidadEntrada: '0.5',
      contravalorEUR: '20000',
    })
    expect(camposFaltantes(b, c)).toEqual([])
  })

  it('PÉRDIDA admite contravalor 0 como informado', () => {
    const c = camposDeTipo('PERDIDA')
    const b = borrador({ tipo: 'PERDIDA', activoSalida: 'BTC', cantidadSalida: '0.005', contravalorEUR: '0' })
    expect(camposFaltantes(b, c)).toEqual([])
  })

  it('AJUSTE sin referencia ni causa → faltan rectificaA y notas', () => {
    const c = camposDeTipo('AJUSTE')
    const faltan = camposFaltantes(borrador({ tipo: 'AJUSTE' }), c).map((f) => f.campo)
    expect(faltan).toContain('rectificaA')
    expect(faltan).toContain('notas')
  })
})
