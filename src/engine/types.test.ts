import { describe, it, expect } from 'vitest'
import {
  CATALOGO_TIPOS,
  TIPOS_OPERACION,
  ETIQUETA_TIPO,
  ACTIVOS_BASE,
  PARAMETROS_POR_DEFECTO,
  TOLERANCIAS_POR_DEFECTO,
  UBICACION_EXTERIOR,
  type TipoOperacion,
} from './types'

// Test de humo del módulo de tipos: verifica que el catálogo cerrado de 11 tipos
// existe y que sus flags coinciden con la Tabla 7 del DOMINIO. No es lógica de motor.

describe('Catálogo cerrado de tipos de operación (DOMINIO §3.3)', () => {
  it('contiene exactamente los 11 tipos del catálogo cerrado', () => {
    expect(TIPOS_OPERACION).toHaveLength(11)
    const esperados: TipoOperacion[] = [
      'COMPRA',
      'VENTA',
      'PERMUTA',
      'TRANSFERENCIA',
      'RENDIMIENTO',
      'MINERIA',
      'AIRDROP',
      'PAGO',
      'PERDIDA',
      'DONACION',
      'AJUSTE',
    ]
    expect(new Set(TIPOS_OPERACION)).toEqual(new Set(esperados))
  })

  it('cada definición es coherente con su clave', () => {
    for (const tipo of TIPOS_OPERACION) {
      expect(CATALOGO_TIPOS[tipo].tipo).toBe(tipo)
      expect(ETIQUETA_TIPO[tipo]).toBe(CATALOGO_TIPOS[tipo].etiqueta)
    }
  })

  it('COMPRA: cuadra, no altera, abre lote y no consume (fija lote FIFO)', () => {
    const c = CATALOGO_TIPOS.COMPRA
    expect(c.cuadra).toBe(true)
    expect(c.alteracion).toBe(false)
    expect(c.abreLote).toBe(true)
    expect(c.consumeLote).toBe(false)
  })

  it('VENTA: altera y consume lote (GyP patrimonial)', () => {
    const v = CATALOGO_TIPOS.VENTA
    expect(v.alteracion).toBe(true)
    expect(v.consumeLote).toBe(true)
    expect(v.abreLote).toBe(false)
  })

  it('PERMUTA: abre y consume lote a la vez', () => {
    const p = CATALOGO_TIPOS.PERMUTA
    expect(p.abreLote).toBe(true)
    expect(p.consumeLote).toBe(true)
    expect(p.alteracion).toBe(true)
  })

  it('RENDIMIENTO, MINERÍA y AIRDROP: abren lote pero NO cuadran', () => {
    for (const tipo of ['RENDIMIENTO', 'MINERIA', 'AIRDROP'] as const) {
      expect(CATALOGO_TIPOS[tipo].abreLote).toBe(true)
      expect(CATALOGO_TIPOS[tipo].cuadra).toBe(false)
    }
  })

  it('DONACIÓN y AJUSTE requieren decisión manual (flags "segun")', () => {
    expect(CATALOGO_TIPOS.DONACION.requiereDecisionManual).toBe(true)
    expect(CATALOGO_TIPOS.AJUSTE.requiereDecisionManual).toBe(true)
    expect(CATALOGO_TIPOS.AJUSTE.exigeRectificaA).toBe(true)
    expect(CATALOGO_TIPOS.AJUSTE.cuadra).toBe('segun')
  })
})

describe('Parámetros y activos de serie', () => {
  it('BTC y EUR están en el catálogo base, con 8 y 2 decimales', () => {
    const btc = ACTIVOS_BASE.find((a) => a.simbolo === 'BTC')
    const eur = ACTIVOS_BASE.find((a) => a.simbolo === 'EUR')
    expect(btc?.decimales).toBe(8)
    expect(eur?.decimales).toBe(2)
    expect(eur?.esFiat).toBe(true)
  })

  it('tolerancias por defecto: verde ≤ 1e-8, ámbar ≤ 0,001', () => {
    expect(TOLERANCIAS_POR_DEFECTO.verde).toBe(1e-8)
    expect(TOLERANCIAS_POR_DEFECTO.ambar).toBe(1e-3)
    expect(PARAMETROS_POR_DEFECTO.tolerancias).toEqual(TOLERANCIAS_POR_DEFECTO)
  })

  it('la ubicación de frontera es EXTERIOR', () => {
    expect(UBICACION_EXTERIOR).toBe('EXTERIOR')
  })
})
