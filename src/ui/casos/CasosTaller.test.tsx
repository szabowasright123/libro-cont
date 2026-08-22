// @vitest-environment jsdom
/**
 * CasosTaller.test.tsx — la pantalla del catálogo de casos.
 *
 * Lo que aquí se prueba no es la maquetación: es la única cosa de esta pantalla que puede
 * hacer daño. `cargarCaso` reemplaza el Libro entero, de modo que la regla es —y tiene que
 * seguir siendo— que con datos dentro NO se carga nada sin una confirmación que diga
 * expresamente que se borra el trabajo del alumno y que recuerde la copia de seguridad. Con
 * el Libro vacío no se pregunta, porque no hay nada que perder.
 *
 * Toca IndexedDB (`libroVacio` y `cargarCaso` van contra Dexie), de ahí `fake-indexeddb`.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CasosTaller } from './CasosTaller'
import { CASOS_TALLER } from '../../data/casos'
import { db } from '../../data/db'
import { borrarTodo, cargarCasoDemo, listarApuntes } from '../../data/repositorio'

beforeEach(async () => {
  await db.open()
  await borrarTodo()
})
afterEach(cleanup)

/** Despliega la lista (arranca plegada para no alargar Inicio). */
function abrirLista() {
  fireEvent.click(screen.getByRole('button', { name: /ver los .* casos/i }))
}

describe('CasosTaller', () => {
  it('arranca plegada y despliega los seis casos con su unidad y su dificultad', () => {
    render(<CasosTaller />)
    const desplegar = screen.getByRole('button', { name: /ver los 6 casos/i })
    expect(desplegar).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(CASOS_TALLER[0]!.titulo)).not.toBeInTheDocument()

    fireEvent.click(desplegar)
    expect(desplegar).toHaveAttribute('aria-expanded', 'true')
    for (const caso of CASOS_TALLER) {
      expect(screen.getByText(caso.titulo)).toBeInTheDocument()
      expect(screen.getByText(`Unidad ${caso.unidad}`)).toBeInTheDocument()
    }
  })

  it('filtra por dificultad desde un select con su etiqueta', () => {
    render(<CasosTaller />)
    abrirLista()
    const filtro = screen.getByLabelText('Mostrar')
    fireEvent.change(filtro, { target: { value: 'avanzado' } })
    const avanzados = CASOS_TALLER.filter((c) => c.dificultad === 'avanzado')
    expect(avanzados.length).toBeGreaterThan(0)
    for (const caso of CASOS_TALLER) {
      const visible = screen.queryByText(caso.titulo)
      if (caso.dificultad === 'avanzado') expect(visible).toBeInTheDocument()
      else expect(visible).not.toBeInTheDocument()
    }
  })

  it('abre el enunciado del caso en su propia ventana', () => {
    render(<CasosTaller />)
    abrirLista()
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver el enunciado' })[0]!)
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveAttribute('aria-label', expect.stringContaining('Unidad 5'))
  })

  it('con el Libro VACÍO carga sin preguntar', async () => {
    render(<CasosTaller />)
    abrirLista()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cargar este caso' })[0]!)
    await waitFor(async () =>
      expect(await listarApuntes()).toHaveLength(CASOS_TALLER[0]!.datos.apuntes.length),
    )
    expect(screen.queryByText(/borrará tu Libro actual/i)).not.toBeInTheDocument()
  })

  it('con datos dentro AVISA de que se borra el trabajo y recuerda la copia, y no toca nada al cancelar', async () => {
    await cargarCasoDemo()
    const antes = await listarApuntes()
    expect(antes.length).toBeGreaterThan(0)

    render(<CasosTaller />)
    abrirLista()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cargar este caso' })[0]!)

    const dialogo = await screen.findByRole('dialog', { name: /borrará tu Libro actual/i })
    expect(dialogo).toHaveTextContent(/Se borra el trabajo que tengas hecho/i)
    expect(dialogo).toHaveTextContent(/copia de seguridad en JSON/i)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await listarApuntes()).toHaveLength(antes.length)
  })

  it('confirmada la advertencia, el caso reemplaza el Libro', async () => {
    await cargarCasoDemo()
    render(<CasosTaller />)
    abrirLista()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cargar este caso' })[0]!)
    await screen.findByRole('dialog', { name: /borrará tu Libro actual/i })
    fireEvent.click(screen.getByRole('button', { name: /Cargar y borrar mi Libro/i }))

    await waitFor(async () =>
      expect(await listarApuntes()).toHaveLength(CASOS_TALLER[0]!.datos.apuntes.length),
    )
  })
})
