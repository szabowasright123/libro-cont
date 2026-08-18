/**
 * direcciones.test.ts — direcciones on-chain de las ubicaciones (ENCARGO, Parte 2).
 */
import { describe, it, expect } from 'vitest'
import {
  normalizarDireccion,
  normalizarDirecciones,
  parsearDirecciones,
  indexarDirecciones,
  ubicacionDeDireccion,
  pareceDireccionEvm,
} from './direcciones'
import type { Ubicacion } from '../../engine/types'

function ubic(id: string, nombre: string, direcciones?: string[]): Ubicacion {
  return { id, nombre, tipo: 'wallet', kyc: false, fechaAlta: '2024-01-01T00:00:00', direcciones }
}

describe('normalización', () => {
  it('pasa a minúsculas lo que es insensible a mayúsculas (EVM y bech32)', () => {
    expect(normalizarDireccion('0xAbC0000000000000000000000000000000000001')).toBe(
      '0xabc0000000000000000000000000000000000001',
    )
    expect(normalizarDireccion('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4')).toBe(
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    )
  })

  it('respeta las mayúsculas de una dirección base58 de Bitcoin (SÍ distingue)', () => {
    const p2pkh = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
    expect(normalizarDireccion(p2pkh)).toBe(p2pkh)
  })

  it('descarta la etiqueta que añaden los exploradores', () => {
    expect(normalizarDireccion('0xAbC0000000000000000000000000000000000001 (Uniswap V3: Router)')).toBe(
      '0xabc0000000000000000000000000000000000001',
    )
  })

  it('deduplica y trocea el texto del formulario', () => {
    expect(normalizarDirecciones(['0xA1', ' 0xa1 ', ''])).toEqual(['0xA1', '0xa1'])
    expect(parsearDirecciones('  0xAAA0000000000000000000000000000000000001 , bc1qxyz\n0xAAA0000000000000000000000000000000000001 '))
      .toEqual(['0xaaa0000000000000000000000000000000000001', 'bc1qxyz'])
  })

  it('reconoce la forma de una dirección EVM (solo para avisar de erratas)', () => {
    expect(pareceDireccionEvm('0x' + 'a'.repeat(40))).toBe(true)
    expect(pareceDireccionEvm('0x123')).toBe(false)
  })
})

describe('índice de direcciones propias', () => {
  const ubicaciones = [
    ubic('u-ledger', 'Ledger', ['0xAAA0000000000000000000000000000000000001']),
    ubic('u-metamask', 'MetaMask', ['0xBBB0000000000000000000000000000000000002', 'bc1qmia']),
    ubic('u-sin', 'Sin direcciones'),
  ]
  const indice = indexarDirecciones(ubicaciones)

  it('resuelve la ubicación sin importar mayúsculas', () => {
    expect(ubicacionDeDireccion(indice, '0xaaa0000000000000000000000000000000000001')).toBe('u-ledger')
    expect(ubicacionDeDireccion(indice, '0xBBB0000000000000000000000000000000000002')).toBe('u-metamask')
    expect(ubicacionDeDireccion(indice, 'BC1QMIA')).toBe('u-metamask')
  })

  it('una dirección que no consta no es de nadie (→ EXTERIOR)', () => {
    expect(ubicacionDeDireccion(indice, '0x' + 'f'.repeat(40))).toBeUndefined()
    expect(ubicacionDeDireccion(indice, '')).toBeUndefined()
  })
})
