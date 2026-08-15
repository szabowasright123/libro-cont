/**
 * caso-demo.test.ts — el capítulo 2024 del CASO DE EJEMPLO COMPLETO (src/data/demo) NO debe
 * divergir del golden intocable (tests/golden/mini-caso). Ninguno importa del otro (Regla de
 * oro 9): este test es el único puente y garantiza la igualdad estructural del capítulo 2024.
 *
 * El caso completo AMPLÍA el mini-caso con un capítulo 2025 (apuntes posteriores) y con la
 * ficha ampliada de las ubicaciones (vía de evidencia, extranjero/país, autocustodia). Por eso
 * aquí se comprueba: (1) que los apuntes 2024-* son IDÉNTICOS a los del golden, y (2) que
 * Kraken y Ledger conservan EXACTAMENTE sus campos originales del golden (los campos nuevos de
 * la ficha ampliada son añadidos opcionales, nunca cambios).
 */
import { describe, it, expect } from 'vitest'
import {
  APUNTES_2024_CASO_DEMO,
  APUNTES_CASO_DEMO,
  UBICACIONES_CASO_DEMO,
} from '../../src/data/demo/caso-demo'
import { APUNTES_MINICASO, UBICACIONES_MINICASO } from '../golden/mini-caso'

describe('Caso de ejemplo (capítulo 2024) ≡ golden (mini-caso 2024)', () => {
  it('los apuntes 2024 de la demo son estructuralmente idénticos a los del golden', () => {
    expect(APUNTES_2024_CASO_DEMO).toEqual(APUNTES_MINICASO)
    // Y dentro del caso completo, el capítulo 2024 es exactamente ese bloque.
    const capitulo2024 = APUNTES_CASO_DEMO.filter((a) => a.id.startsWith('2024-'))
    expect(capitulo2024).toEqual(APUNTES_MINICASO)
  })

  it('los apuntes 2025 son todos POSTERIORES al mini-caso (no alteran saldos ni GyP de 2024)', () => {
    const finGolden = new Date(
      APUNTES_MINICASO[APUNTES_MINICASO.length - 1]!.fechaHora,
    ).getTime()
    const capitulo2025 = APUNTES_CASO_DEMO.filter((a) => !a.id.startsWith('2024-'))
    expect(capitulo2025.length).toBeGreaterThan(0)
    for (const ap of capitulo2025) {
      expect(ap.id.startsWith('2025-')).toBe(true)
      expect(new Date(ap.fechaHora).getTime()).toBeGreaterThan(finGolden)
    }
  })

  it('Kraken y Ledger conservan exactamente los campos originales del golden', () => {
    for (const golden of UBICACIONES_MINICASO) {
      const demo = UBICACIONES_CASO_DEMO.find((u) => u.id === golden.id)
      expect(demo, `falta la ubicación ${golden.id} en la demo`).toBeDefined()
      // Igualdad campo a campo sobre las claves del golden (la ficha ampliada solo AÑADE).
      const nucleo = Object.fromEntries(
        Object.keys(golden).map((k) => [k, (demo as Record<string, unknown>)[k]]),
      )
      expect(nucleo).toEqual(golden)
    }
  })
})
