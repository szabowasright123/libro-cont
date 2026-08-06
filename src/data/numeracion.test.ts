/**
 * numeracion.test.ts — orden cronológico y correlativo AAAA-NNN por año.
 */
import { describe, it, expect } from 'vitest'
import {
  ordenarCronologico,
  asignarCorrelativos,
  renumerar,
  rompeOrden,
  type Numerable,
} from './numeracion'

/** Constructor de item numerable. */
function item(uid: string, fechaHora: string, id = '0000-000', creadoEn = '2020-01-01T00:00:00Z') {
  return { uid, fechaHora, id, creadoEn }
}

describe('ordenarCronologico', () => {
  it('ordena por fechaHora ascendente', () => {
    const items: Numerable[] = [
      item('c', '2024-03-01T10:00:00'),
      item('a', '2024-01-01T10:00:00'),
      item('b', '2024-02-01T10:00:00'),
    ]
    expect(ordenarCronologico(items).map((i) => i.uid)).toEqual(['a', 'b', 'c'])
  })

  it('a igual fechaHora desempata por creadoEn', () => {
    const items: Numerable[] = [
      item('segundo', '2024-01-01T10:00:00', '0', '2024-01-01T10:00:05Z'),
      item('primero', '2024-01-01T10:00:00', '0', '2024-01-01T10:00:01Z'),
    ]
    expect(ordenarCronologico(items).map((i) => i.uid)).toEqual(['primero', 'segundo'])
  })

  it('no muta la entrada', () => {
    const items = [item('b', '2024-02-01T10:00:00'), item('a', '2024-01-01T10:00:00')]
    const copia = [...items]
    ordenarCronologico(items)
    expect(items).toEqual(copia)
  })
})

describe('asignarCorrelativos', () => {
  it('numera 001, 002, … dentro de cada año y reinicia por año', () => {
    const ordenados = ordenarCronologico([
      item('a', '2024-01-01T10:00:00'),
      item('b', '2024-06-01T10:00:00'),
      item('c', '2025-01-01T10:00:00'),
    ])
    const m = asignarCorrelativos(ordenados)
    expect(m.get('a')).toBe('2024-001')
    expect(m.get('b')).toBe('2024-002')
    expect(m.get('c')).toBe('2025-001')
  })
})

describe('renumerar', () => {
  it('asigna correlativos según orden y reporta los cambios', () => {
    const items = [
      item('viejo', '2024-02-01T10:00:00', '2024-001'),
      item('nuevo', '2024-01-15T10:00:00', '0000-000'), // insertado ANTES → debe ser 2024-001
    ]
    const { ordenados, cambios } = renumerar(items)
    expect(ordenados.map((i) => `${i.uid}:${i.id}`)).toEqual([
      'nuevo:2024-001',
      'viejo:2024-002',
    ])
    // El 'viejo' pasó de 2024-001 a 2024-002; el 'nuevo' de provisional a 2024-001.
    expect(cambios).toContainEqual({ uid: 'viejo', idAnterior: '2024-001', idNuevo: '2024-002' })
    expect(cambios).toContainEqual({ uid: 'nuevo', idAnterior: '0000-000', idNuevo: '2024-001' })
  })

  it('sin cambios de orden no reporta cambios', () => {
    const items = [
      item('a', '2024-01-01T10:00:00', '2024-001'),
      item('b', '2024-02-01T10:00:00', '2024-002'),
    ]
    expect(renumerar(items).cambios).toEqual([])
  })
})

describe('rompeOrden', () => {
  const existentes: Numerable[] = [
    item('a', '2024-01-01T10:00:00'),
    item('b', '2024-03-01T10:00:00'),
  ]

  it('true si la fecha nueva queda ANTES de algún apunte existente', () => {
    expect(rompeOrden(existentes, '2024-02-01T10:00:00')).toBe(true)
  })

  it('false si la fecha nueva va al final', () => {
    expect(rompeOrden(existentes, '2024-04-01T10:00:00')).toBe(false)
  })

  it('excluye el propio apunte al editarlo', () => {
    // Mover 'b' a una fecha posterior no rompe orden respecto a sí mismo.
    expect(rompeOrden(existentes, '2024-05-01T10:00:00', 'b')).toBe(false)
  })
})
