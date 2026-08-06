/**
 * formatos.test.ts — conversiones de formato de los puentes Excel/CSV (P4).
 */
import { describe, it, expect } from 'vitest'
import {
  serialExcelAISO,
  isoASerialExcel,
  fechaTextoAISO,
  aDecimalDominio,
  siNoABool,
  boolASiNo,
  tipoDesdeEtiqueta,
  etiquetaDesdeTipo,
} from './formatos'

describe('serial de Excel ↔ ISO (reloj de pared, sin zona horaria)', () => {
  it('45658 = 2025-01-01 (mediodía con fracción 0,5)', () => {
    expect(serialExcelAISO(45658)).toBe('2025-01-01T00:00:00')
    expect(serialExcelAISO(45658.5)).toBe('2025-01-01T12:00:00')
  })

  it('redondea el epsilon de la fracción horaria al segundo', () => {
    // 0,4451388889 ≈ 10:41:00 exacto (no 10:40:59).
    expect(serialExcelAISO(46038.4451388889)).toBe('2026-01-16T10:41:00')
  })

  it('ida y vuelta ISO→serial→ISO es exacta (sin drift)', () => {
    for (const iso of [
      '2024-01-16T10:00:00',
      '2024-12-31T23:59:59',
      '2026-03-01T00:00:00',
      '2025-06-15T14:30:00',
    ]) {
      expect(serialExcelAISO(isoASerialExcel(iso))).toBe(iso)
    }
  })

  it('isoASerialExcel es independiente de la zona horaria del proceso', () => {
    // 2025-01-01T00:00 debe dar un entero exacto (45658), sin ±1 por husos.
    expect(isoASerialExcel('2025-01-01T00:00:00')).toBe(45658)
  })
})

describe('fechaTextoAISO', () => {
  it('acepta ISO con y sin hora', () => {
    expect(fechaTextoAISO('2024-01-16')).toBe('2024-01-16T00:00:00')
    expect(fechaTextoAISO('2024-01-16T10:00')).toBe('2024-01-16T10:00:00')
    expect(fechaTextoAISO('2024-01-16 10:00:30')).toBe('2024-01-16T10:00:30')
  })

  it('acepta es-ES dd/mm/aaaa', () => {
    expect(fechaTextoAISO('16/01/2024')).toBe('2024-01-16T00:00:00')
    expect(fechaTextoAISO('16/01/2024 10:00')).toBe('2024-01-16T10:00:00')
    expect(fechaTextoAISO('16-01-2024')).toBe('2024-01-16T00:00:00')
  })

  it('combina fecha + columna hora separada (CSV genérico)', () => {
    expect(fechaTextoAISO('2024-01-16', '10:00')).toBe('2024-01-16T10:00:00')
    expect(fechaTextoAISO('16/01/2024', '09:30:15')).toBe('2024-01-16T09:30:15')
  })

  it('rechaza basura y fechas imposibles', () => {
    expect(fechaTextoAISO('')).toBeUndefined()
    expect(fechaTextoAISO('no-fecha')).toBeUndefined()
    expect(fechaTextoAISO('2024-13-01')).toBeUndefined()
  })
})

describe('aDecimalDominio (coma o punto → punto)', () => {
  it('número de celda xlsx sin notación exponencial', () => {
    expect(aDecimalDominio(0.5)).toBe('0.5')
    expect(aDecimalDominio(20000)).toBe('20000')
    expect(aDecimalDominio(0.0002)).toBe('0.0002')
    expect(aDecimalDominio(0.00000035)).toBe('0.00000035') // 8 decimales BTC
  })

  it('texto anglosajón con punto decimal', () => {
    expect(aDecimalDominio('1234.5')).toBe('1234.5')
    expect(aDecimalDominio('0.05')).toBe('0.05')
  })

  it('texto es-ES con coma decimal y puntos de miles', () => {
    expect(aDecimalDominio('1.234,5')).toBe('1234.5')
    expect(aDecimalDominio('4.254,00')).toBe('4254.00')
    expect(aDecimalDominio('0,001')).toBe('0.001')
  })

  it('vacío o inválido → undefined (nunca lanza)', () => {
    expect(aDecimalDominio('')).toBeUndefined()
    expect(aDecimalDominio(null)).toBeUndefined()
    expect(aDecimalDominio(undefined)).toBeUndefined()
    expect(aDecimalDominio('0,')).toBeUndefined()
    expect(aDecimalDominio('abc')).toBeUndefined()
  })
})

describe('sí/no ↔ booleano', () => {
  it('siNoABool tolera acentos y mayúsculas', () => {
    expect(siNoABool('sí')).toBe(true)
    expect(siNoABool('Si')).toBe(true)
    expect(siNoABool('SÍ')).toBe(true)
    expect(siNoABool('no')).toBe(false)
    expect(siNoABool('')).toBe(false)
  })
  it('boolASiNo', () => {
    expect(boolASiNo(true)).toBe('sí')
    expect(boolASiNo(false)).toBe('no')
  })
})

describe('tipo plantilla ↔ dominio', () => {
  it('etiquetas con acentos → ASCII del dominio', () => {
    expect(tipoDesdeEtiqueta('MINERÍA')).toBe('MINERIA')
    expect(tipoDesdeEtiqueta('PÉRDIDA')).toBe('PERDIDA')
    expect(tipoDesdeEtiqueta('DONACIÓN')).toBe('DONACION')
    expect(tipoDesdeEtiqueta('AJUSTE/RECTIFICACIÓN')).toBe('AJUSTE')
    expect(tipoDesdeEtiqueta('COMPRA')).toBe('COMPRA')
  })
  it('literales ASCII y sin acento también valen', () => {
    expect(tipoDesdeEtiqueta('MINERIA')).toBe('MINERIA')
    expect(tipoDesdeEtiqueta(' venta ')).toBe('VENTA')
  })
  it('desconocido → undefined', () => {
    expect(tipoDesdeEtiqueta('FUSIÓN')).toBeUndefined()
    expect(tipoDesdeEtiqueta('')).toBeUndefined()
  })
  it('etiquetaDesdeTipo devuelve la que espera la plantilla', () => {
    expect(etiquetaDesdeTipo('MINERIA')).toBe('MINERÍA')
    expect(etiquetaDesdeTipo('AJUSTE')).toBe('AJUSTE/RECTIFICACIÓN')
    expect(etiquetaDesdeTipo('COMPRA')).toBe('COMPRA')
  })
})
