// @vitest-environment jsdom
/**
 * PanelAutocorreccion.test.tsx — tests de componente de la pantalla de autoevaluación.
 *
 * No comprueban cálculo (de eso se ocupa `src/engine/autocorreccion.test.ts`): comprueban
 * lo que la pantalla promete y podría romperse en un retoque de estilo —que la pista se lee
 * antes que el valor, que las cifras salen en es-ES con coma decimal, que lo que ya
 * coincide se pliega, que la cascada está plegada por defecto y se abre— y, sobre todo,
 * que en ninguna parte aparece una nota.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { corregir, revisar, type LibroComparable } from '../../engine/autocorreccion'
import { PanelAutocorreccion } from './PanelAutocorreccion'
import { APUNTES_MINICASO, UBICACIONES_MINICASO } from '../../../tests/golden/mini-caso'

afterEach(cleanup)

const SOLUCION: LibroComparable = {
  apuntes: APUNTES_MINICASO,
  ubicaciones: UBICACIONES_MINICASO,
}

/** El alumno teclea 5.600 € donde iban 6.500 €: mismos saldos, distinta ganancia. */
function libroConContravalorMal(): LibroComparable {
  return {
    apuntes: APUNTES_MINICASO.map((a) =>
      a.id === '2024-008' ? { ...a, contravalorEUR: '5600' } : { ...a },
    ),
    ubicaciones: UBICACIONES_MINICASO,
  }
}

/** El alumno se salta la primera compra de BTC: un error con mucha cascada detrás. */
function libroSinPrimeraCompra(): LibroComparable {
  return {
    apuntes: APUNTES_MINICASO.filter((a) => a.id !== '2024-002').map((a) => ({ ...a })),
    ubicaciones: UBICACIONES_MINICASO,
  }
}

describe('PanelAutocorreccion', () => {
  it('deja claro que no es una calificación, y no muestra ninguna', () => {
    render(<PanelAutocorreccion correccion={corregir(libroConContravalorMal(), SOLUCION)} />)

    expect(screen.getByText(/autoevaluación, no calificación/i)).toBeInTheDocument()
    // Ni la palabra, ni el concepto, en ningún rincón de la pantalla.
    expect(document.body.textContent).not.toMatch(/\bnota\b|puntuaci[óo]n|aprobado|suspens/i)
  })

  it('celebra el libro correcto sin listar nada', () => {
    render(<PanelAutocorreccion correccion={corregir(SOLUCION, SOLUCION)} />)
    expect(screen.getByText(/coincide con el del enunciado en las cuatro capas/i)).toBeInTheDocument()
    expect(screen.getByText(/Coinciden 4 de 4 capas/i)).toBeInTheDocument()
  })

  it('pinta la pista antes que el valor, y el valor en es-ES', () => {
    render(<PanelAutocorreccion correccion={corregir(libroConContravalorMal(), SOLUCION)} />)

    const tarjeta = screen.getByRole('article')
    expect(within(tarjeta).getByText(/Pista\./)).toBeInTheDocument()

    // Coma decimal y símbolo del euro (Regla de oro 6).
    expect(within(tarjeta).getByText('5.600 €')).toBeInTheDocument()
    expect(within(tarjeta).getByText('6.500 €')).toBeInTheDocument()

    // Y el orden en el DOM: la pista está antes que el par esperado/encontrado.
    const texto = tarjeta.textContent ?? ''
    expect(texto.indexOf('Pista.')).toBeLessThan(texto.indexOf('5.600 €'))
  })

  it('pliega las capas que coinciden y las despliega al desmarcar la casilla', () => {
    render(<PanelAutocorreccion correccion={corregir(libroConContravalorMal(), SOLUCION)} />)

    // La capa de saldos coincide en este caso: aparece plegada, en una línea.
    expect(screen.getByText('— coincide')).toBeInTheDocument()

    const casilla = screen.getByLabelText(/Plegar las capas que ya coinciden/i)
    fireEvent.click(casilla)
    expect(screen.getByText(/¿Tienes lo que deberías tener/i)).toBeInTheDocument()
  })

  it('tiene la cascada plegada y la abre al pedirla', () => {
    render(<PanelAutocorreccion correccion={corregir(libroSinPrimeraCompra(), SOLUCION)} />)

    const boton = screen.getByRole('button', { name: /lo que este error arrastra/i })
    expect(boton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText(/Las existencias vivas de BTC/i)).toBeInTheDocument()
  })

  it('ofrece el salto al Diario solo cuando la página lo proporciona', () => {
    const correccion = corregir(libroConContravalorMal(), SOLUCION)
    const vistos: string[] = []

    const { rerender } = render(<PanelAutocorreccion correccion={correccion} />)
    expect(screen.queryByRole('button', { name: /Abrir el apunte/i })).toBeNull()

    rerender(
      <PanelAutocorreccion correccion={correccion} onAbrirApunte={(id) => vistos.push(id)} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Abrir el apunte 2024-008/i }))
    expect(vistos).toEqual(['2024-008'])
  })

  it('en modo revisión se titula como revisión y avisa de que el Archivo no se ha mirado', () => {
    render(<PanelAutocorreccion correccion={revisar(SOLUCION)} />)
    expect(screen.getByRole('heading', { name: /Revisión del método/i })).toBeInTheDocument()
    // Sin justificantes, la capa del Archivo no aplica y no se pinta.
    expect(screen.queryByText(/Expediente probatorio/i)).toBeNull()
  })

  it('acepta un nombre de ejercicio para el encabezado', () => {
    render(
      <PanelAutocorreccion
        correccion={corregir(SOLUCION, SOLUCION)}
        nombreEjercicio="U6.2 · El error invisible"
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'U6.2 · El error invisible' }),
    ).toBeInTheDocument()
  })
})
