/**
 * archivo.test.ts — motor del Archivo (expediente probatorio).
 *
 * Comprueba la checklist por tipo (con la rama KYC / no-KYC), el estado probatorio de un
 * apunte, la detección de huérfanos y el informe de completitud priorizado. Usa el
 * mini-caso 2024 (golden) para el criterio de aceptación P5: el informe identifica el
 * robo (PÉRDIDA) sin denuncia como el hueco de máxima prioridad.
 */
import { describe, it, expect } from 'vitest'
import type { Apunte, Justificante } from './types'
import {
  CHECKLIST_PROBATORIA,
  RUTA_POR_TIPO,
  CARPETAS_ARCHIVO,
  CARPETAS_SIN_APUNTE,
  requisitosAplicables,
  estadoProbatorioApunte,
  detectarHuerfanos,
  informeCompletitud,
  mapaKyc,
  ubicacionRelevanteConKyc,
} from './archivo'
import {
  APUNTES_MINICASO,
  UBICACIONES_MINICASO,
  KRAKEN,
  LEDGER,
} from '../../tests/golden/mini-caso'

const KYC = mapaKyc(UBICACIONES_MINICASO)

/** Atajo para un justificante mínimo ligado a un apunte y requisito. */
function just(apunteId: string, clave: string, extra: Partial<Justificante> = {}): Justificante {
  return {
    id: `${apunteId}:${clave}`,
    apunteId,
    rutaConvencional: '99-otros',
    tipoDocumento: clave,
    ...extra,
  }
}

describe('checklist probatoria', () => {
  it('tiene una entrada por cada uno de los 12 tipos y una ruta por defecto', () => {
    expect(Object.keys(CHECKLIST_PROBATORIA)).toHaveLength(12)
    expect(CHECKLIST_PROBATORIA.LIQUIDACION_DERIVADO.requisitos.length).toBeGreaterThan(0)
    for (const tipo of Object.keys(CHECKLIST_PROBATORIA) as Apunte['tipo'][]) {
      expect(CHECKLIST_PROBATORIA[tipo].requisitos.length).toBeGreaterThan(0)
      expect(RUTA_POR_TIPO[tipo]).toBeDefined()
    }
  })

  it('COMPRA con KYC pide orden + extracto; sin KYC pide pago + anuncio + txid', () => {
    const kyc = requisitosAplicables('COMPRA', true).map((r) => r.clave)
    const noKyc = requisitosAplicables('COMPRA', false).map((r) => r.clave)
    expect(kyc).toEqual(['orden-ejecucion', 'extracto-exchange'])
    expect(noKyc).toEqual(['justificante-pago', 'captura-anuncio', 'txid-entrada'])
  })

  it('PÉRDIDA es el tipo de máxima exigencia y exige denuncia', () => {
    expect(CHECKLIST_PROBATORIA.PERDIDA.exigencia).toBe(5)
    expect(CHECKLIST_PROBATORIA.PERDIDA.requisitos.map((r) => r.clave)).toContain('denuncia')
  })
})

describe('convención de carpetas (VALIDADA 2026-08-06)', () => {
  it('mapea PÉRDIDA y DONACIÓN a 07-perdidas-y-donaciones y AJUSTE a 99-otros', () => {
    expect(RUTA_POR_TIPO.PERDIDA).toBe('07-perdidas-y-donaciones')
    expect(RUTA_POR_TIPO.DONACION).toBe('07-perdidas-y-donaciones')
    expect(RUTA_POR_TIPO.AJUSTE).toBe('99-otros')
  })

  it('las seis carpetas del manual + 07 + 99 están en el explorador', () => {
    const rutas = CARPETAS_ARCHIVO.map((c) => c.ruta)
    expect(rutas).toEqual([
      '01-adquisiciones',
      '02-transferencias',
      '03-transmisiones',
      '04-rendimientos',
      '05-certificados',
      '06-etiquetas',
      '07-perdidas-y-donaciones',
      '99-otros',
    ])
  })

  it('ningún tipo se archiva por defecto en 05-certificados ni 06-etiquetas', () => {
    for (const ruta of Object.values(RUTA_POR_TIPO)) {
      expect(CARPETAS_SIN_APUNTE).not.toContain(ruta)
    }
  })
})

describe('ubicación relevante y KYC', () => {
  it('usa el destino de una COMPRA (Kraken, KYC) como ubicación relevante', () => {
    const compra = APUNTES_MINICASO.find((a) => a.id === '2024-002')!
    expect(ubicacionRelevanteConKyc(compra, KYC)).toBe(true)
  })

  it('la PÉRDIDA desde Ledger (no-KYC) es no-KYC', () => {
    const perdida = APUNTES_MINICASO.find((a) => a.id === '2024-017')!
    expect(ubicacionRelevanteConKyc(perdida, KYC)).toBe(false)
  })

  it('en la duda (EXTERIOR / desconocida) asume no-KYC (prudente)', () => {
    expect(ubicacionRelevanteConKyc({ ubicacionOrigen: 'EXTERIOR', ubicacionDestino: 'EXTERIOR' }, KYC)).toBe(false)
  })
})

describe('estado probatorio de un apunte', () => {
  const compra = APUNTES_MINICASO.find((a) => a.id === '2024-002')! // COMPRA en Kraken (KYC)

  it('sin justificantes → «sin-justificar»', () => {
    const r = estadoProbatorioApunte(compra, [], KYC)
    expect(r.estado).toBe('sin-justificar')
    expect(r.faltantes.map((f) => f.clave)).toEqual(['orden-ejecucion', 'extracto-exchange'])
  })

  it('con parte de los requisitos → «incompleto»', () => {
    const r = estadoProbatorioApunte(compra, [just('2024-002', 'orden-ejecucion')], KYC)
    expect(r.estado).toBe('incompleto')
    expect(r.cubiertos).toEqual(['orden-ejecucion'])
    expect(r.faltantes.map((f) => f.clave)).toEqual(['extracto-exchange'])
  })

  it('con todos los requisitos → «completo»', () => {
    const r = estadoProbatorioApunte(
      compra,
      [just('2024-002', 'orden-ejecucion'), just('2024-002', 'extracto-exchange')],
      KYC,
    )
    expect(r.estado).toBe('completo')
    expect(r.faltantes).toEqual([])
  })
})

describe('detección de huérfanos', () => {
  it('marca justificantes con apunte inexistente y apuntes sin justificante', () => {
    const justificantes = [
      just('2024-002', 'orden-ejecucion'),
      just('9999-999', 'orden-ejecucion'), // apunte que no existe
    ]
    const { justificantesSinApunte, apuntesSinJustificante } = detectarHuerfanos(
      APUNTES_MINICASO,
      justificantes,
    )
    expect(justificantesSinApunte.map((j) => j.apunteId)).toEqual(['9999-999'])
    // Todos menos el 2024-002 quedan sin justificante.
    expect(apuntesSinJustificante).toHaveLength(APUNTES_MINICASO.length - 1)
    expect(apuntesSinJustificante.some((a) => a.id === '2024-002')).toBe(false)
  })

  it('un certificado o etiqueta sin apunte NO cuenta como huérfano', () => {
    const certificado = just('9999-999', 'otros', { rutaConvencional: '05-certificados' })
    const etiqueta = just('9999-998', 'otros', { rutaConvencional: '06-etiquetas' })
    const sueltoNormal = just('9999-997', 'otros', { rutaConvencional: '99-otros' })
    const { justificantesSinApunte } = detectarHuerfanos(APUNTES_MINICASO, [
      certificado,
      etiqueta,
      sueltoNormal,
    ])
    // Solo el de 99-otros (sin apunte) es huérfano; certificados y etiquetas están exentos.
    expect(justificantesSinApunte.map((j) => j.apunteId)).toEqual(['9999-997'])
    expect(CARPETAS_SIN_APUNTE).toEqual(['05-certificados', '06-etiquetas'])
  })
})

describe('informe de completitud (criterio de aceptación P5)', () => {
  it('sin ningún justificante: 0 % completo y el robo (PÉRDIDA) es el hueco prioritario', () => {
    const informe = informeCompletitud(APUNTES_MINICASO, [], KYC, 2024)
    expect(informe.ejercicio).toBe(2024)
    expect(informe.total).toBe(APUNTES_MINICASO.length)
    expect(informe.completos).toBe(0)
    expect(informe.sinJustificar).toBe(APUNTES_MINICASO.length)
    expect(informe.porcentajeCompleto).toBe(0)

    // La PÉRDIDA (2024-017), máxima exigencia, encabeza los huecos y le falta la denuncia.
    const primero = informe.huecos[0]!
    expect(primero.apunte.id).toBe('2024-017')
    expect(primero.apunte.tipo).toBe('PERDIDA')
    expect(primero.faltantes.map((f) => f.clave)).toContain('denuncia')
  })

  it('cuenta como completo un apunte con su expediente y sube el porcentaje', () => {
    const justificantes = [
      just('2024-002', 'orden-ejecucion'),
      just('2024-002', 'extracto-exchange'),
    ]
    const informe = informeCompletitud(APUNTES_MINICASO, justificantes, KYC, 2024)
    expect(informe.completos).toBe(1)
    expect(informe.porcentajeCompleto).toBeGreaterThan(0)
    expect(informe.huecos.some((h) => h.apunte.id === '2024-002')).toBe(false)
  })

  it('prioriza no-KYC dentro del mismo nivel de exigencia', () => {
    // Dos COMPRA (exigencia 3): una en Kraken (KYC) y otra en una wallet no-KYC.
    const compraKyc: Apunte = {
      id: '2024-100', fechaHora: '2024-01-01T00:00:00', tipo: 'COMPRA',
      ubicacionOrigen: KRAKEN, ubicacionDestino: KRAKEN,
    }
    const compraNoKyc: Apunte = {
      id: '2024-101', fechaHora: '2024-01-02T00:00:00', tipo: 'COMPRA',
      ubicacionOrigen: LEDGER, ubicacionDestino: LEDGER,
    }
    const informe = informeCompletitud([compraKyc, compraNoKyc], [], KYC, 2024)
    // La no-KYC (refuerzo +0,5) va antes pese a ser posterior en fecha.
    expect(informe.huecos[0]!.apunte.id).toBe('2024-101')
    expect(informe.huecos[1]!.apunte.id).toBe('2024-100')
  })
})
