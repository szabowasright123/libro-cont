/**
 * mini-caso-demo.test.ts — el dataset del CASO DE EJEMPLO (src/data/demo) NO debe divergir del
 * golden intocable (tests/golden/mini-caso). Ninguno importa del otro (Regla de oro 2): este
 * test es el único puente y garantiza su igualdad estructural. Si tocas uno, este test falla
 * hasta que actualices el otro.
 */
import { describe, it, expect } from 'vitest'
import { APUNTES_CASO_DEMO, UBICACIONES_CASO_DEMO } from '../../src/data/demo/mini-caso-demo'
import { APUNTES_MINICASO, UBICACIONES_MINICASO } from '../golden/mini-caso'

describe('Caso de ejemplo ≡ golden (mini-caso 2024)', () => {
  it('los apuntes de la demo son estructuralmente idénticos a los del golden', () => {
    expect(APUNTES_CASO_DEMO).toEqual(APUNTES_MINICASO)
  })

  it('las ubicaciones de la demo son estructuralmente idénticas a las del golden', () => {
    expect(UBICACIONES_CASO_DEMO).toEqual(UBICACIONES_MINICASO)
  })
})
