/**
 * caso-demo.test.ts — el capítulo 2024 del CASO DE EJEMPLO COMPLETO (src/data/demo) NO debe
 * divergir del golden intocable (tests/golden/mini-caso). Ninguno importa del otro (Regla de
 * oro 9): este test es el único puente y garantiza la igualdad estructural del capítulo 2024.
 *
 * El caso completo AMPLÍA el mini-caso con dos capítulos posteriores —2025 y 2026— y con la
 * ficha ampliada de las ubicaciones (vía de evidencia, extranjero/país, autocustodia). Por eso
 * aquí se comprueba: (1) que los apuntes 2024-* son IDÉNTICOS a los del golden, (2) que todo
 * lo demás es POSTERIOR al mini-caso, capítulo a capítulo, y (3) que Kraken y Ledger conservan
 * EXACTAMENTE sus campos originales del golden (los campos nuevos de la ficha ampliada, y las
 * ubicaciones nuevas de los capítulos siguientes, son añadidos, nunca cambios).
 */
import { describe, it, expect } from 'vitest'
import {
  APUNTES_2024_CASO_DEMO,
  APUNTES_2026_CASO_DEMO,
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

  it('los capítulos siguientes son todos POSTERIORES al mini-caso (no alteran 2024)', () => {
    const finGolden = new Date(
      APUNTES_MINICASO[APUNTES_MINICASO.length - 1]!.fechaHora,
    ).getTime()
    const posteriores = APUNTES_CASO_DEMO.filter((a) => !a.id.startsWith('2024-'))
    expect(posteriores.length).toBeGreaterThan(0)
    for (const ap of posteriores) {
      // El correlativo empieza por el año, y el año es 2025 o posterior.
      expect(/^20(2[5-9]|[3-9]\d)-\d{3}$/.test(ap.id), `correlativo ${ap.id}`).toBe(true)
      expect(new Date(ap.fechaHora).getTime()).toBeGreaterThan(finGolden)
    }
  })

  it('el capítulo 2026 es POSTERIOR al 2025 (tampoco puede mover los saldos de 2025)', () => {
    const fin2025 = new Date('2025-12-31T23:59:59').getTime()
    const capitulo2026 = APUNTES_CASO_DEMO.filter((a) => a.id.startsWith('2026-'))
    expect(capitulo2026.length).toBeGreaterThan(0)
    expect(capitulo2026).toEqual(APUNTES_2026_CASO_DEMO)
    for (const ap of capitulo2026) {
      expect(new Date(ap.fechaHora).getTime()).toBeGreaterThan(fin2025)
    }
  })

  it('el capítulo 2026 no mueve el BITCOIN (el subyacente del perpetuo no se entrega)', () => {
    // La conciliación FIFO↔SALDOS del caso completo (src/engine/conciliacion.test.ts) fija el
    // BTC en 0,84355 al cierre. El capítulo 2026 opera un perpetuo BTC liquidado por
    // diferencias, un canje ETH→TOKENX, un pool ETH/USDC y una donación en ETH: ni un satoshi
    // cambia de manos, y esa es justamente la lección del duodécimo tipo.
    for (const ap of APUNTES_2026_CASO_DEMO) {
      expect(ap.activoSalida, `${ap.id} (salida)`).not.toBe('BTC')
      expect(ap.activoEntrada, `${ap.id} (entrada)`).not.toBe('BTC')
      expect(ap.comisionActivo, `${ap.id} (comisión)`).not.toBe('BTC')
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
