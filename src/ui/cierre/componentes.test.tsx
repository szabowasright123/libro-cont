// @vitest-environment jsdom
/**
 * componentes.test.tsx — que la pantalla de cierre se pinte y sea accesible.
 *
 * El cálculo lo prueba `src/engine/cierre.test.ts`; aquí se comprueba lo que un test de motor
 * no puede ver: que los componentes montan sobre el caso de ejemplo sin romperse, que cada
 * control tiene su etiqueta accesible (siete de las doce pantallas de la app no las tienen y no
 * se le suma una octava) y que el informe HTML sale autónomo, sin una sola petición de red.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { calcularCierre, evaluarTresColumnas, type FilaTresColumnas } from '../../engine/cierre'
import { ChecklistCierre } from './ChecklistCierre'
import { TablaConciliacionFifo } from './TablaConciliacionFifo'
import { FotoCierrePanel } from './FotoCierrePanel'
import { TablaTresColumnas } from './TablaTresColumnas'
import { MemoriaPanel } from './MemoriaPanel'
import { construirInformeCierreHtml } from './informeCierreHtml'
import {
  APUNTES_CASO_DEMO,
  UBICACIONES_CASO_DEMO,
  ACTIVOS_CASO_DEMO,
  CUADRE_REAL_CASO_DEMO,
} from '../../data/demo/caso-demo'

const COTIZACIONES = { BTC: { precioEUR: '100000', fuente: 'Cierre BTC/EUR en Kraken a 31/12' } }

const FILA: FilaTresColumnas = {
  id: 'a',
  concepto: 'Operaciones del ejercicio · Kraken',
  segunDatosFiscalesEUR: '2500',
  segunRegistroEUR: '2000',
  explicacion: '',
}

const ESTADO = calcularCierre({
  ejercicio: 2026,
  apuntes: APUNTES_CASO_DEMO,
  ubicaciones: UBICACIONES_CASO_DEMO,
  justificantes: [],
  saldosReales: CUADRE_REAL_CASO_DEMO,
  activos: ACTIVOS_CASO_DEMO,
  cotizaciones: COTIZACIONES,
  tresColumnas: [FILA],
})

describe('ChecklistCierre', () => {
  it('pinta las quince casillas con sus dos controles etiquetados', () => {
    render(<ChecklistCierre grupos={ESTADO.porMomento} marcas={{}} onCambiar={() => {}} />)
    expect(screen.getAllByLabelText('Hecho')).toHaveLength(15)
    expect(screen.getAllByLabelText('No aplica')).toHaveLength(15)
  })

  it('al descartar una casilla pide la razón, con su etiqueta y su aviso', () => {
    // El aviso lo enciende el motor, no el componente: hay que recalcular con la marca puesta.
    const conDescarte = calcularCierre({
      ejercicio: 2026,
      apuntes: APUNTES_CASO_DEMO,
      ubicaciones: UBICACIONES_CASO_DEMO,
      justificantes: [],
      marcas: { 'exportar-historicos': { noAplica: true } },
    })
    render(
      <ChecklistCierre
        grupos={conDescarte.porMomento}
        marcas={{ 'exportar-historicos': { noAplica: true } }}
        onCambiar={() => {}}
      />,
    )
    const razon = screen.getByLabelText(/Razón por la que no aplica/)
    expect(razon).toBeTruthy()
    expect(razon.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(/decidí no hacerlo, y aquí está por qué/)).toBeTruthy()
  })

  it('reproduce el texto literal del anexo, sin reescribirlo', () => {
    render(<ChecklistCierre grupos={ESTADO.porMomento} marcas={{}} onCambiar={() => {}} />)
    // `getAllByText`: el literal aparece en el párrafo y en el `aria-label` de su casilla.
    expect(
      screen.getAllByText(
        'Comprobar que la cola FIFO y el saldo dicen lo mismo activo por activo: si difieren, falta aplicar el prorrateo de comisiones',
      ).length,
    ).toBeGreaterThan(0)
  })
})

describe('TablaConciliacionFifo', () => {
  it('enseña la tabla activo a activo con su semáforo', () => {
    render(<TablaConciliacionFifo conciliacion={ESTADO.conciliacionFifo} corte="31/12/2026" />)
    const tabla = screen.getByRole('table')
    expect(within(tabla).getByText('BTC')).toBeTruthy()
    expect(within(tabla).getAllByText(/OK/).length).toBeGreaterThan(0)
    // El euro no concilia: es la moneda de cuenta, no un elemento patrimonial con coste.
    expect(within(tabla).queryByRole('cell', { name: 'EUR' })).toBeNull()
  })
})

describe('FotoCierrePanel', () => {
  it('pide precio y fuente de cada activo con etiquetas accesibles', () => {
    render(
      <FotoCierrePanel
        foto={ESTADO.foto}
        ejercicio={2026}
        cotizaciones={COTIZACIONES}
        onCambiar={() => {}}
      />,
    )
    expect(screen.getByLabelText('Cotización de cierre en euros por unidad de BTC')).toBeTruthy()
    expect(screen.getByLabelText('Fuente de la cotización de BTC')).toBeTruthy()
    // Sin cotización, el activo se señala en vez de valorarse en cero.
    expect(screen.getAllByText('sin cotización').length).toBeGreaterThan(0)
  })
})

describe('TablaTresColumnas', () => {
  it('marca la diferencia sin explicar y etiqueta cada celda editable', () => {
    render(
      <TablaTresColumnas
        filas={[FILA]}
        resultado={evaluarTresColumnas([FILA])}
        onCambiarFila={() => {}}
        onAnadirFila={() => {}}
        onEliminarFila={() => {}}
        onProponer={() => {}}
        hayPropuesta={false}
      />,
    )
    expect(screen.getByText('Diferencia sin explicar')).toBeTruthy()
    expect(screen.getByLabelText(`Importe según los datos fiscales de ${FILA.concepto}`)).toBeTruthy()
    expect(screen.getByLabelText(`Importe según el registro de ${FILA.concepto}`)).toBeTruthy()
    const explicacion = screen.getByLabelText(`Explicación de la diferencia de ${FILA.concepto}`)
    expect(explicacion.getAttribute('aria-invalid')).toBe('true')
  })
})

describe('MemoriaPanel', () => {
  it('presenta los cuatro apartados del anexo, cada uno con su <label>', () => {
    render(
      <MemoriaPanel memoria={{}} resultado={ESTADO.memoria} ejercicio={2026} onCambiar={() => {}} />,
    )
    expect(screen.getByLabelText(/Criterios adoptados en las zonas grises/)).toBeTruthy()
    expect(screen.getByLabelText(/Reconstrucciones realizadas/)).toBeTruthy()
    expect(screen.getByLabelText(/Diferencias de conciliación/)).toBeTruthy()
    expect(screen.getByLabelText(/Decisiones sobre obligaciones informativas/)).toBeTruthy()
  })
})

describe('informe de cierre en HTML', () => {
  const html = construirInformeCierreHtml(ESTADO, {
    reconstrucciones: 'Ninguna: todo viene de extractos del propio ejercicio.',
  })

  it('sale autónomo: sin scripts, sin hojas externas y sin una sola petición de red', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<link[^>]+href/i)
    expect(html).not.toMatch(/src=["']https?:/i)
  })

  it('lleva el checklist, la foto, la conciliación, las tres columnas y la memoria', () => {
    expect(html).toContain('Checklist de cierre del ejercicio (Anexo D)')
    expect(html).toContain('Foto de cierre a 31/12/2026')
    expect(html).toContain('La cola FIFO y el saldo, activo por activo')
    expect(html).toContain('Conciliación a tres columnas')
    expect(html).toContain('Memoria del ejercicio 2026')
    expect(html).toContain('Ninguna: todo viene de extractos del propio ejercicio.')
  })

  it('lleva su aviso de carácter orientativo y su remisión al manual', () => {
    expect(html).toContain('ORIENTATIVO')
    expect(html).toContain('[MT] Unidad 10 y Anexo D')
  })

  it('dice cuántas casillas impiden el cierre cuando el ejercicio no está cerrado', () => {
    expect(html).toContain('Ejercicio NO cerrado')
  })
})
