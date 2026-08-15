/**
 * copias.test.ts — decisión PURA del recordatorio de copia de seguridad (P11).
 * Sin Dexie ni relojes: la fecha «ahora» entra por parámetro.
 */
import { describe, it, expect } from 'vitest'
import {
  necesitaRecordatorioCopia,
  textoRecordatorio,
  APUNTES_MINIMOS_PRIMERA_COPIA,
  APUNTES_NUEVOS_RECORDATORIO,
  DIAS_RECORDATORIO,
} from './copias'

const AHORA = '2026-08-15T12:00:00'

describe('necesitaRecordatorioCopia', () => {
  it('con el Libro vacío nunca recuerda (no hay nada que proteger)', () => {
    expect(necesitaRecordatorioCopia({}, 0, AHORA).necesita).toBe(false)
    expect(
      necesitaRecordatorioCopia({ ultimaCopiaEn: '2020-01-01T00:00:00' }, 0, AHORA).necesita,
    ).toBe(false)
  })

  it('sin copia previa: recuerda solo a partir del mínimo de apuntes', () => {
    expect(
      necesitaRecordatorioCopia({}, APUNTES_MINIMOS_PRIMERA_COPIA - 1, AHORA).necesita,
    ).toBe(false)
    const r = necesitaRecordatorioCopia({}, APUNTES_MINIMOS_PRIMERA_COPIA, AHORA)
    expect(r.necesita).toBe(true)
    expect(r.motivo).toBe('nunca')
    expect(textoRecordatorio(r)).toContain('ninguna copia')
  })

  it('recuerda por acumulación de apuntes nuevos desde la última copia', () => {
    const marca = { ultimaCopiaEn: '2026-08-10T00:00:00', apuntesEnUltimaCopia: 30 }
    // 19 nuevos: aún no.
    expect(
      necesitaRecordatorioCopia(marca, 30 + APUNTES_NUEVOS_RECORDATORIO - 1, AHORA).necesita,
    ).toBe(false)
    // 20 nuevos: sí, aunque la copia sea reciente.
    const r = necesitaRecordatorioCopia(marca, 30 + APUNTES_NUEVOS_RECORDATORIO, AHORA)
    expect(r.necesita).toBe(true)
    expect(r.motivo).toBe('apuntes-nuevos')
    expect(r.apuntesNuevos).toBe(APUNTES_NUEVOS_RECORDATORIO)
    expect(textoRecordatorio(r)).toContain(String(APUNTES_NUEVOS_RECORDATORIO))
  })

  it('recuerda por antigüedad SOLO si el Libro cambió desde la copia', () => {
    const hace31dias = '2026-07-15T12:00:00' // 31 días antes de AHORA
    // Mismo nº de apuntes que en la copia: nada nuevo que perder → no recuerda.
    expect(
      necesitaRecordatorioCopia(
        { ultimaCopiaEn: hace31dias, apuntesEnUltimaCopia: 30 },
        30,
        AHORA,
      ).necesita,
    ).toBe(false)
    // Con cambios (un apunte más): sí.
    const r = necesitaRecordatorioCopia(
      { ultimaCopiaEn: hace31dias, apuntesEnUltimaCopia: 30 },
      31,
      AHORA,
    )
    expect(r.necesita).toBe(true)
    expect(r.motivo).toBe('antiguedad')
    expect(r.dias).toBeGreaterThanOrEqual(DIAS_RECORDATORIO)
  })

  it('copia reciente y pocos cambios: silencio', () => {
    const r = necesitaRecordatorioCopia(
      { ultimaCopiaEn: '2026-08-14T00:00:00', apuntesEnUltimaCopia: 29 },
      30,
      AHORA,
    )
    expect(r.necesita).toBe(false)
  })
})
