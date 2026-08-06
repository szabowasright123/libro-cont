// @vitest-environment jsdom
/**
 * FormularioApunte.test.tsx — tests de componente del formulario de apunte.
 *
 * Verifica el comportamiento dinámico (campos según tipo), el bloqueo por
 * validaciones del motor (AJUSTE sin referencia) y el guardado real con numeración
 * automática (persistencia en IndexedDB simulada con fake-indexeddb).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { FormularioApunte, type AperturaFormulario } from './FormularioApunte'
import { ACTIVOS_BASE, type Ubicacion } from '../../engine/types'
import type { ApunteRegistro } from '../../data/tipos'
import { db } from '../../data/db'

const UBICACIONES: Ubicacion[] = [
  { id: 'u-kraken', nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2024-01-01T00:00:00' },
  { id: 'u-ledger', nombre: 'Ledger', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-01T00:00:00' },
]
const ACTIVOS = [...ACTIVOS_BASE]

/** Apertura por defecto: alta de apunte nuevo (COMPRA). */
function aperturaNueva(): AperturaFormulario {
  return {
    borrador: { fechaHora: '', tipo: 'COMPRA', ubicacionOrigen: '', ubicacionDestino: '' },
    titulo: 'Nuevo apunte',
  }
}

function montar(over?: {
  apertura?: AperturaFormulario
  registros?: ApunteRegistro[]
  onGuardado?: (m: string) => void
}) {
  const onGuardado = over?.onGuardado ?? vi.fn()
  const utils = render(
    <FormularioApunte
      abierto
      onCerrar={() => {}}
      ubicaciones={UBICACIONES}
      activos={ACTIVOS}
      registros={over?.registros ?? []}
      apertura={over?.apertura ?? aperturaNueva()}
      onGuardado={onGuardado}
    />,
  )
  return { ...utils, onGuardado }
}

afterEach(() => cleanup())
beforeEach(async () => {
  await db.apuntes.clear()
})

describe('FormularioApunte · campos dinámicos según tipo', () => {
  it('COMPRA muestra salida y entrada; RENDIMIENTO oculta la salida', () => {
    montar()
    // COMPRA (por defecto): ambos lados visibles.
    expect(screen.getByLabelText('Activo de salida')).toBeInTheDocument()
    expect(screen.getByLabelText('Activo de entrada')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tipo de operación'), {
      target: { value: 'RENDIMIENTO' },
    })

    // RENDIMIENTO: entra sin salir → la salida desaparece.
    expect(screen.queryByLabelText('Activo de salida')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Activo de entrada')).toBeInTheDocument()
  })

  it('DONACIÓN pregunta el sentido y alterna entrada/salida', () => {
    montar()
    fireEvent.change(screen.getByLabelText('Tipo de operación'), { target: { value: 'DONACION' } })
    // Entregada (por defecto): sale.
    expect(screen.getByLabelText('Activo de salida')).toBeInTheDocument()
    expect(screen.queryByLabelText('Activo de entrada')).not.toBeInTheDocument()
    // Cambia a recibida: entra.
    fireEvent.click(screen.getByLabelText(/Recibida/))
    expect(screen.getByLabelText('Activo de entrada')).toBeInTheDocument()
    expect(screen.queryByLabelText('Activo de salida')).not.toBeInTheDocument()
  })
})

describe('FormularioApunte · bloqueo por validaciones del motor', () => {
  it('AJUSTE sin apunte rectificado mantiene el botón deshabilitado', () => {
    const existente: ApunteRegistro = {
      uid: 'x1',
      id: '2024-001',
      creadoEn: '2024-01-01T00:00:00Z',
      fechaHora: '2024-01-16T10:00:00',
      tipo: 'COMPRA',
      ubicacionOrigen: 'u-kraken',
      ubicacionDestino: 'u-kraken',
      activoSalida: 'EUR',
      cantidadSalida: '20000',
      activoEntrada: 'BTC',
      cantidadEntrada: '0.5',
      contravalorEUR: '20000',
    }
    montar({ registros: [existente] })

    fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: '2024-02-01T10:00' } })
    fireEvent.change(screen.getByLabelText('Tipo de operación'), { target: { value: 'AJUSTE' } })

    const boton = screen.getByRole('button', { name: /Registrar apunte/ })
    expect(boton).toBeDisabled()
    // El motor/modelo señala la falta de la referencia obligatoria.
    expect(screen.getByText(/Falta: Apunte que rectifica/)).toBeInTheDocument()

    // Al elegir el apunte rectificado y escribir la causa, se habilita.
    fireEvent.change(screen.getByLabelText('Apunte que rectifica'), { target: { value: 'x1' } })
    fireEvent.change(screen.getByLabelText('Causa de la rectificación'), {
      target: { value: 'Corrijo el contravalor por error de tecleo.' },
    })
    expect(boton).toBeEnabled()
  })
})

describe('FormularioApunte · guardado con numeración automática', () => {
  it('registra una COMPRA y le asigna el correlativo AAAA-001', async () => {
    const { onGuardado } = montar()

    fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: '2024-01-16T10:00' } })
    fireEvent.change(screen.getByLabelText('Ubicación origen'), { target: { value: 'u-kraken' } })
    fireEvent.change(screen.getByLabelText('Ubicación destino'), { target: { value: 'u-kraken' } })
    fireEvent.change(screen.getByLabelText('Activo de salida'), { target: { value: 'EUR' } })
    fireEvent.change(screen.getByLabelText('Cantidad de salida'), { target: { value: '20000' } })
    fireEvent.change(screen.getByLabelText('Activo de entrada'), { target: { value: 'BTC' } })
    fireEvent.change(screen.getByLabelText('Cantidad de entrada'), { target: { value: '0,5' } })
    fireEvent.change(screen.getByLabelText('Contravalor en euros'), { target: { value: '20000' } })

    const boton = screen.getByRole('button', { name: /Registrar apunte/ })
    expect(boton).toBeEnabled()
    fireEvent.click(boton)

    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1))

    const guardados = await db.apuntes.toArray()
    expect(guardados).toHaveLength(1)
    expect(guardados[0]!.id).toBe('2024-001')
    expect(guardados[0]!.tipo).toBe('COMPRA')
    // La coma decimal del alumno se normaliza a punto interno.
    expect(guardados[0]!.cantidadEntrada).toBe('0.5')
  })
})
