/**
 * expediente.test.ts — el EXPEDIENTE DE ENTREGA sobre el caso de ejemplo.
 *
 * Dos cosas que comprobar, y las dos son de fondo:
 *
 *  1. Que el expediente REÚNE lo que dice reunir. Es el documento con el que un alumno entrega
 *     un ejercicio evaluable: si una sección sale vacía porque el corte estaba mal puesto, el
 *     alumno entrega un ejercicio incompleto sin enterarse. Se comprueban las cifras contra los
 *     golden del mini-caso 2024 (Regla de oro 9) y contra el propio caso de ejemplo.
 *  2. Que el HTML es AUTOCONTENIDO. La Regla de oro 3 —local-first estricto, cero red en
 *     runtime— no se cumple solo dentro de la app: un documento exportado que pidiese una
 *     hoja de estilo o una fuente a un CDN filtraría al servidor de turno cuándo y desde dónde
 *     se abre el expediente fiscal de una persona. Se comprueba con expresiones regulares sobre
 *     la salida, que es la única forma de que nadie lo rompa por descuido dentro de seis meses.
 */
import { describe, it, expect } from 'vitest'
import type { Justificante } from '../../engine/types'
import { D, aCadena, CERO } from '../../engine/decimal'
import {
  ACTIVOS_CASO_DEMO,
  APUNTES_CASO_DEMO,
  CUADRE_REAL_CASO_DEMO,
  JUSTIFICANTES_CASO_DEMO,
  UBICACIONES_CASO_DEMO,
} from '../demo/caso-demo'
import { calcularExpediente, nombreFicheroExpediente, type DatosExpediente } from './expediente'
import {
  construirExpedienteHtml,
  ORDEN_SECCIONES,
  SECCIONES_POR_DEFECTO,
  type SeccionesExpediente,
} from '../../ui/entrega/expedienteHtml'

const GENERADO_EN = '2026-08-21T12:30:00'

/** El caso de ejemplo entero, con un momento de generación fijo (test determinista). */
function datos(ejercicio: number): DatosExpediente {
  return {
    ejercicio,
    apuntes: APUNTES_CASO_DEMO,
    ubicaciones: UBICACIONES_CASO_DEMO,
    activos: ACTIVOS_CASO_DEMO,
    justificantes: JUSTIFICANTES_CASO_DEMO as readonly Justificante[],
    cuadreReal: CUADRE_REAL_CASO_DEMO,
    titular: 'Alumna de ejemplo',
    version: '1.6.0',
    generadoEn: GENERADO_EN,
  }
}

/** Suma de los saldos de un activo en todas las ubicaciones (la fila de totales). */
function totalDe(saldos: readonly { activo: string; saldo: string }[], activo: string): string {
  let total = CERO
  for (const s of saldos) if (s.activo === activo) total = total.plus(D(s.saldo))
  return aCadena(total)
}

describe('calcularExpediente · reúne el ejercicio entero', () => {
  it('identifica el ejercicio, su corte y su momento de generación', () => {
    const exp = calcularExpediente(datos(2024))
    expect(exp.ejercicio).toBe(2024)
    expect(exp.corte).toBe('2024-12-31T23:59:59')
    expect(exp.generadoEn).toBe(GENERADO_EN)
    expect(exp.version).toBe('1.6.0')
    expect(exp.titular).toBe('Alumna de ejemplo')
    expect(nombreFicheroExpediente(2024)).toBe('expediente-2024.html')
  })

  it('recorta el Libro al ejercicio pero conserva el contexto del Libro completo', () => {
    const exp = calcularExpediente(datos(2024))
    expect(exp.apuntesEjercicio.length).toBeGreaterThan(0)
    expect(exp.apuntesEjercicio.every((a) => a.fechaHora.startsWith('2024'))).toBe(true)
    expect(exp.apuntesLibro).toBe(APUNTES_CASO_DEMO.length)
    // 2025 y 2026 existen en el caso: el cuadre tiene que saber que hay vida después del cierre.
    expect(exp.apuntesPosteriores).toBe(APUNTES_CASO_DEMO.length - exp.apuntesEjercicio.length)
    expect(exp.apuntesPosteriores).toBeGreaterThan(0)
  })

  it('los SALDOS al cierre de 2024 son los golden del mini-caso (Regla de oro 9)', () => {
    const { saldos } = calcularExpediente(datos(2024))
    expect(totalDe(saldos, 'BTC')).toBe('0.4068')
    expect(totalDe(saldos, 'ETH')).toBe('1.049')
    expect(totalDe(saldos, 'USDC')).toBe('305')
    expect(totalDe(saldos, 'EUR')).toBe('4254')
    expect(totalDe(saldos, 'ADA')).toBe('0')
    expect(totalDe(saldos, 'TOKENX')).toBe('0')
  })

  it('trae la cola FIFO al cierre y solo las transmisiones del ejercicio', () => {
    const exp = calcularExpediente(datos(2025))
    expect(exp.fifo.size).toBeGreaterThan(0)
    expect(exp.transmisiones.length).toBeGreaterThan(0)
    expect(exp.transmisiones.every((t) => t.ejercicio === 2025)).toBe(true)
    // Orden cronológico: es un documento que se lee de arriba abajo.
    const fechas = exp.transmisiones.map((t) => t.fechaHora)
    expect([...fechas].sort()).toEqual(fechas)
  })

  it('el caso de ejemplo concilia FIFO ↔ saldos en cero, y el euro queda fuera', () => {
    const exp = calcularExpediente(datos(2026))
    expect(exp.conciliacion.estadoGlobal).toBe('OK')
    expect(exp.conciliacion.activosDescuadrados).toBe(0)
    expect(exp.conciliacion.filas.map((f) => f.activo)).not.toContain('EUR')
  })

  it('el CUADRE va sobre el Libro completo, no sobre el recorte al ejercicio', () => {
    // El saldo real del caso está declarado a 31/12/2026. Pedir el expediente de 2024 no puede
    // fabricar descuadres: el cuadre se calcula contra el diario entero (ver cabecera del módulo).
    const exp2024 = calcularExpediente(datos(2024))
    const exp2026 = calcularExpediente(datos(2026))
    expect(exp2024.cuadre).toEqual(exp2026.cuadre)
    expect(exp2024.cuadre.length).toBe(CUADRE_REAL_CASO_DEMO.length)
  })

  it('trae el resumen fiscal del ejercicio con su mapa de casillas', () => {
    const exp = calcularExpediente(datos(2025))
    expect(exp.resumen.ejercicio).toBe(2025)
    expect(exp.resumen.ahorro.operaciones.length).toBeGreaterThan(0)
    expect(exp.casillas.length).toBeGreaterThan(0)
    expect(exp.casillasDelEjercicio).toBe(true)
    expect(exp.ejercicioMapa).toBe(2025)
  })

  it('avisa cuando el mapa de casillas no es el del ejercicio entregado', () => {
    // 2027 aún no tiene mapa publicado: se usa el más reciente COMO GUÍA y el documento lo dice,
    // porque los números de casilla cambian cada campaña y darlos por buenos sería un error caro.
    const exp = calcularExpediente(datos(2027))
    expect(exp.casillas.length).toBeGreaterThan(0)
    expect(exp.casillasDelEjercicio).toBe(false)
    expect(exp.ejercicioMapa).toBe(2026)
    expect(construirExpedienteHtml(exp)).toContain('no el de 2027')
  })

  it('trae el estado probatorio y el índice de la carpeta del ejercicio', () => {
    const exp = calcularExpediente(datos(2025))
    expect(exp.probatorio).toHaveLength(exp.apuntesEjercicio.length)
    expect(exp.completitud.total).toBe(exp.apuntesEjercicio.length)
    // El Archivo del caso de ejemplo está completo al 100 % por decisión del taller.
    expect(exp.completitud.porcentajeCompleto).toBe(100)
    expect(exp.indice.ejercicio).toBe(2025)
    expect(exp.indice.totalEsperados).toBeGreaterThan(0)
    expect(exp.indice.totalFaltan).toBe(0)
    expect(exp.indice.carpetas.length).toBeGreaterThan(0)
  })

  it('trae los avisos del motor y el nombre legible de cada ubicación', () => {
    const exp = calcularExpediente(datos(2026))
    expect(exp.avisos.filter((a) => a.nivel === 'error')).toHaveLength(0)
    expect(exp.nombrePorId.size).toBe(UBICACIONES_CASO_DEMO.length)
  })

  it('no depende del orden en que lleguen los apuntes', () => {
    const alReves = { ...datos(2024), apuntes: [...APUNTES_CASO_DEMO].reverse() }
    expect(calcularExpediente(alReves).saldos).toEqual(calcularExpediente(datos(2024)).saldos)
  })
})

describe('construirExpedienteHtml · el documento', () => {
  const exp = calcularExpediente(datos(2025))
  const html = construirExpedienteHtml(exp)

  it('se identifica: ejercicio, titular, corte y fecha de generación en dd/mm/aaaa', () => {
    expect(html).toContain('<title>Expediente de entrega 2025</title>')
    expect(html).toContain('Expediente de entrega — ejercicio 2025')
    expect(html).toContain('Alumna de ejemplo')
    expect(html).toContain('31/12/2025 23:59')
    expect(html).toContain('21/08/2026 12:30')
    expect(html).toContain('<html lang="es">')
  })

  it('reúne las secciones que el expediente dice reunir', () => {
    for (const clave of ORDEN_SECCIONES) expect(html).toContain(`id="seccion-${clave}"`)
    expect(html).toContain('Conciliación FIFO ↔ saldos')
    expect(html).toContain('Resumen fiscal orientativo')
    expect(html).toContain('Archivo probatorio')
    // Y las cifras están dentro, no solo los rótulos.
    expect(html).toContain(exp.apuntesEjercicio[0]?.id ?? '')
    expect(html).toContain(exp.transmisiones[0]?.apunteId ?? '')
  })

  it('lleva el aviso de carácter orientativo del resumen fiscal (Regla de oro 5)', () => {
    expect(html).toContain('ORIENTATIVO')
    expect(html).toContain('no es asesoramiento fiscal')
    expect(html).toContain('Fecha de criterio:')
  })

  it('respeta qué secciones se piden y cuáles no', () => {
    const soloFiscal: SeccionesExpediente = {
      ...SECCIONES_POR_DEFECTO,
      libro: false,
      saldos: false,
      fifo: false,
      cuadre: false,
      conciliacion: false,
      archivo: false,
      avisos: false,
    }
    const recortado = construirExpedienteHtml(exp, soloFiscal)
    expect(recortado).toContain('id="seccion-fiscal"')
    expect(recortado).not.toContain('id="seccion-libro"')
    expect(recortado).not.toContain('id="seccion-cuadre"')
    // La portada NO es opcional: sin ella el documento no identificaría nada.
    expect(recortado).toContain('Expediente de entrega — ejercicio 2025')
  })

  it('escapa el contenido del alumno (no se cuela HTML por las notas)', () => {
    const conInyeccion = calcularExpediente({
      ...datos(2025),
      titular: '<script>alert(1)</script>',
    })
    const salida = construirExpedienteHtml(conInyeccion)
    expect(salida).not.toContain('<script>alert(1)</script>')
    expect(salida).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

describe('construirExpedienteHtml · autocontenido (Regla de oro 3)', () => {
  // Los tres ejercicios del caso: si alguna sección concreta colase una URL, aquí se ve.
  const documentos = [2024, 2025, 2026].map((e) => construirExpedienteHtml(calcularExpediente(datos(e))))

  it('no contiene ninguna URL absoluta ni protocolo-relativa', () => {
    for (const html of documentos) {
      expect(html).not.toMatch(/https?:\/\//i)
      expect(html).not.toMatch(/\/\/[a-z0-9-]+\.[a-z]{2,}/i)
      expect(html).not.toMatch(/\b(?:data|file|ftp|ws|wss):/i)
    }
  })

  it('no carga ningún recurso externo: sin script, link, img, iframe ni @import', () => {
    for (const html of documentos) {
      expect(html).not.toMatch(/<(script|link|iframe|img|object|embed|source|video|audio)\b/i)
      expect(html).not.toMatch(/\b(?:src|srcset|integrity|crossorigin)\s*=/i)
      expect(html).not.toMatch(/@import/i)
      expect(html).not.toMatch(/@font-face/i)
      // `url(...)` en el CSS sería una petición: no se usa ninguna.
      expect(html).not.toMatch(/url\(/i)
    }
  })

  it('todos los enlaces son internos al propio documento', () => {
    for (const html of documentos) {
      const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] ?? '')
      expect(hrefs.length).toBeGreaterThan(0)
      for (const href of hrefs) expect(href.startsWith('#')).toBe(true)
    }
  })

  it('ninguna cantidad se imprime con más de 8 decimales', () => {
    // Desde D0 la cola arrastra decimales periódicos (prorrateo de comisiones en cripto). Sin
    // recortarlos, una celda de «cantidad restante» ocupa cuarenta cifras y desborda la hoja.
    for (const html of documentos) {
      expect(html).not.toMatch(/,\d{9,}/)
    }
  })

  it('el estilo va inline, en un único bloque <style>', () => {
    for (const html of documentos) {
      expect(html.match(/<style>/g)).toHaveLength(1)
      expect(html).toContain('font-variant-numeric: tabular-nums')
    }
  })
})
