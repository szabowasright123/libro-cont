// @vitest-environment jsdom
/**
 * Panel.test.tsx — tests de componente del Panel (F3).
 *
 * El Panel existe para una cosa: que se pueda pinchar cualquier cifra y ver los apuntes que la
 * componen. Estos tests montan los cuatro bloques con un diario pequeño —una entrada de fiat,
 * una compra y una venta parcial— y comprueban justamente eso: que los cuatro bloques están,
 * que las cifras salen en es-ES (coma decimal) y que los tres drill-downs abren y enseñan los
 * apuntes de los que sale la cifra.
 *
 * El Panel se monta con la `VistaPanel` ya calculada, sin base de datos de por medio: esa es la
 * razón de que `Panel` y `PanelPage` estén separados. La única pieza que sí toca IndexedDB es
 * `SeccionCuadre` (bloque 3), que persiste los saldos reales declarados; de ahí
 * `fake-indexeddb/auto`.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import type { Apunte } from '../../engine/types'
import { ACTIVOS_BASE } from '../../engine/types'
import { Panel } from './Panel'
import { construirVistaPanel } from './modelo'

const KRAKEN = 'u-kraken'
const NOMBRES = new Map([[KRAKEN, 'Kraken']])
const nombreUbic = (r: string) => (r === 'EXTERIOR' ? 'EXTERIOR (frontera)' : (NOMBRES.get(r) ?? r))

/**
 * Diario mínimo pero completo: fiat que entra, una compra que abre lote y una venta parcial
 * que lo consume. Da saldos, cola FIFO con lote vivo y transmisión, y conciliación en cero.
 */
const DIARIO: Apunte[] = [
  {
    id: '2024-001',
    fechaHora: '2024-01-15T10:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: 'EXTERIOR',
    ubicacionDestino: KRAKEN,
    activoEntrada: 'EUR',
    cantidadEntrada: '10000',
    contravalorEUR: '10000',
  },
  {
    id: '2024-002',
    fechaHora: '2024-01-16T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '5000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.1',
    contravalorEUR: '5000',
  },
  {
    id: '2024-003',
    fechaHora: '2024-06-10T12:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.04',
    activoEntrada: 'EUR',
    cantidadEntrada: '2500',
    contravalorEUR: '2500',
  },
]

function montar(apuntes: Apunte[] = DIARIO) {
  const vista = construirVistaPanel(apuntes, ACTIVOS_BASE)
  return { vista, ...render(<Panel apuntes={apuntes} vista={vista} nombreUbic={nombreUbic} />) }
}

afterEach(() => cleanup())

describe('Panel · los cuatro bloques', () => {
  it('pinta los cuatro bloques del método, en orden', () => {
    montar()
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim())
    expect(titulos).toEqual([
      '1 · Saldos',
      '2 · Cola FIFO',
      'Cuadre (semáforo)',
      '4 · Conciliación FIFO ↔ saldos',
    ])
  })

  it('muestra el saldo de cada celda con coma decimal y el total por activo', () => {
    montar()
    // 0,1 BTC comprados − 0,04 vendidos = 0,06. Coma decimal en pantalla (Regla de oro 6).
    expect(screen.getByRole('button', { name: /Ver los apuntes que mueven BTC en Kraken/ })).toHaveTextContent('0,06')
    const totales = screen.getByRole('list', { name: 'Total por activo' })
    expect(within(totales).getByText('BTC').parentElement).toHaveTextContent('0,06')
    // 10.000 − 5.000 + 2.500 = 7.500, con punto de miles.
    expect(screen.getByRole('button', { name: /Ver los apuntes que mueven EUR en Kraken/ })).toHaveTextContent('7.500')
  })

  it('la conciliación FIFO ↔ saldos cierra en cero y deja fuera el euro', () => {
    const { vista } = montar()
    expect(vista.error).toBeNull()
    expect(vista.conciliacion.estadoGlobal).toBe('OK')
    expect(vista.conciliacion.filas.map((f) => f.activo)).toEqual(['BTC'])
    expect(screen.getByText('Concilia')).toBeInTheDocument()
  })
})

describe('Panel · pinchar una cifra y ver los apuntes que la componen', () => {
  it('el saldo de una celda despliega sus movimientos y su acumulado', () => {
    montar()
    const boton = screen.getByRole('button', { name: /Ver los apuntes que mueven BTC en Kraken/ })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')

    const detalle = screen.getByRole('table', {
      name: /Apuntes que mueven el saldo de BTC en Kraken/,
    })
    const filas = within(detalle).getAllByRole('row').slice(1) // sin la cabecera
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent('2024-002')
    expect(filas[0]).toHaveTextContent('+0,1')
    expect(filas[1]).toHaveTextContent('2024-003')
    expect(filas[1]).toHaveTextContent('−0,04')
    // La última línea del acumulado ES el saldo de la fila.
    expect(filas[1]).toHaveTextContent('0,06')
  })

  it('la cola FIFO de un activo despliega sus lotes vivos y sus transmisiones', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Ver la cola FIFO de BTC/ }))

    const lotes = screen.getByRole('table', { name: /Lotes de BTC aún no consumidos/ })
    expect(within(lotes).getByText('2024-002')).toBeInTheDocument()
    // Coste unitario del lote: 5.000 € / 0,1 BTC = 50.000 €/BTC.
    expect(within(lotes).getByText('50.000 €')).toBeInTheDocument()
    // Las cantidades se PINTAN con 8 decimales (los periódicos del prorrateo de comisiones en
    // cripto no caben en una celda), pero la cifra exacta del dominio queda en el `title`.
    expect(within(lotes).getByText('0,1')).toHaveAttribute('title', '0.1')

    const trans = screen.getByRole('table', { name: /Transmisiones de BTC/ })
    const fila = within(trans).getAllByRole('row')[1] as HTMLElement
    expect(fila).toHaveTextContent('2024-003')
    expect(within(fila).getByText('2.500 €')).toBeInTheDocument()
    // Coste FIFO: 0,04 × 50.000 = 2.000 €; resultado: 2.500 − 2.000 = 500 € de ganancia.
    expect(within(fila).getByText('2.000 €')).toBeInTheDocument()
    expect(within(fila).getByText('500 €')).toBeInTheDocument()
  })

  it('una transmisión despliega los lotes concretos que consumió (el FIFO, visible)', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Ver la cola FIFO de BTC/ }))
    fireEvent.click(
      screen.getByRole('button', { name: /Ver los lotes consumidos por el apunte 2024-003/ }),
    )

    const consumos = screen.getByRole('table', { name: /Lotes consumidos por el apunte 2024-003/ })
    expect(within(consumos).getByText('2024-002')).toBeInTheDocument()
    expect(consumos).toHaveTextContent('0,04')
    expect(within(consumos).getByText('2.000 €')).toBeInTheDocument()
  })
})

describe('Panel · cuando el diario no deja calcular', () => {
  it('avisa de que la cola FIFO no se pudo calcular pero conserva los saldos', () => {
    // Diario desordenado: `calcularFifo` exige orden cronológico y lanza.
    const desordenado = [DIARIO[2], DIARIO[0], DIARIO[1]] as Apunte[]
    const { vista } = montar(desordenado)
    expect(vista.error).not.toBeNull()
    expect(vista.saldos.length).toBeGreaterThan(0)
    expect(screen.getByText(/No se ha podido calcular la cola FIFO/)).toBeInTheDocument()
    // Los saldos siguen ahí (no dependen del orden).
    expect(screen.getByRole('heading', { level: 2, name: '1 · Saldos' })).toBeInTheDocument()
  })
})
