/**
 * autocorreccion.test.ts — los casos que de verdad importan.
 *
 * Todos se construyen sobre el mini-caso 2024 (`tests/golden/mini-caso.ts`), que aquí solo
 * se LEE: es el golden intocable de la Regla de oro 9. La solución es el mini-caso tal cual;
 * el «alumno» es el mismo mini-caso mutado con un error concreto y verosímil, de los que
 * salen en clase.
 *
 * El orden de los casos no es casual: va de lo que cualquier herramienta detecta a lo que
 * solo detecta esta.
 *
 *   · libro idéntico            → cero hallazgos (la corrección no inventa errores);
 *   · apunte omitido            → el clásico;
 *   · apunte duplicado          → el clásico simétrico;
 *   · contravalor mal tecleado  → mismos saldos, distinta ganancia. El CUADRE lo da por
 *                                 bueno porque los saldos no dependen del contravalor;
 *   · clasificación errónea     → mismos saldos, mismo FIFO, distinta base imponible: el
 *                                 «error invisible» de [MT] U6.2, que ni el CUADRE ni la
 *                                 conciliación pueden ver, porque no hay nada descuadrado;
 *   · orden barajado            → cero hallazgos (se corrige el contenido del Libro, no el
 *                                 itinerario por el que el alumno llegó a él);
 *   · cascada                   → un solo error aguas arriba NO produce diez hallazgos
 *                                 aguas abajo. Es la mitad del valor del módulo.
 */

import { describe, it, expect } from 'vitest'
import type { Apunte } from './types'
import {
  corregir,
  revisar,
  type Correccion,
  type LibroComparable,
} from './autocorreccion'
import {
  APUNTES_MINICASO,
  UBICACIONES_MINICASO,
  CONTRAVALORES,
  KRAKEN,
} from '../../tests/golden/mini-caso'

// ────────────────────────────────────────────────────────────────────────────
// Utilidades de los casos
// ────────────────────────────────────────────────────────────────────────────

/** La solución: el mini-caso tal cual (copia, para no tocar el golden ni por accidente). */
function solucion(): LibroComparable {
  return { apuntes: APUNTES_MINICASO.map((a) => ({ ...a })), ubicaciones: UBICACIONES_MINICASO }
}

/** El libro del alumno: el mini-caso con una mutación. */
function alumno(mutar: (apuntes: Apunte[]) => Apunte[]): LibroComparable {
  return {
    apuntes: mutar(APUNTES_MINICASO.map((a) => ({ ...a }))),
    ubicaciones: UBICACIONES_MINICASO,
  }
}

/** Todos los códigos de hallazgo raíz, para aserciones legibles. */
function codigos(c: Correccion): string[] {
  return c.hallazgos.map((h) => h.codigo)
}

/** Barajado DETERMINISTA (nada de Math.random en un test que exige determinismo). */
function barajarDeterminista<T>(xs: readonly T[]): T[] {
  const copia = [...xs]
  // Permutación fija por congruencia: reproducible, y desde luego no cronológica.
  for (let i = copia.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1)
    const a = copia[i]!
    const b = copia[j]!
    copia[i] = b
    copia[j] = a
  }
  return copia
}

// ────────────────────────────────────────────────────────────────────────────

describe('corregir · libro idéntico', () => {
  it('no encuentra ni una desviación cuando el alumno ha hecho el ejercicio bien', () => {
    const c = corregir(solucion(), solucion())

    expect(c.modo).toBe('correccion')
    expect(c.sinDesviaciones).toBe(true)
    expect(c.hallazgos).toHaveLength(0)
    expect(c.consecuenciasSilenciadas).toBe(0)
    expect(c.capas.every((k) => k.coincide)).toBe(true)
    expect(c.emparejamiento.coincidentes).toBe(APUNTES_MINICASO.length)
    expect(c.emparejamiento.divergentes).toBe(0)
    expect(c.emparejamiento.sobrantes).toBe(0)
    expect(c.emparejamiento.faltantes).toBe(0)
  })

  it('es determinista: dos ejecuciones sobre los mismos libros dan lo mismo', () => {
    const malo = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-008')
      aps[i] = { ...aps[i]!, contravalorEUR: '5600' }
      return aps
    })
    const primera = corregir(malo, solucion())
    const segunda = corregir(malo, solucion())
    expect(JSON.stringify(segunda)).toBe(JSON.stringify(primera))
  })
})

describe('corregir · un apunte omitido', () => {
  // El alumno se salta la compra de ADA del 15/04. Todo lo de ADA aguas abajo se tuerce.
  const sinCompraAda = alumno((aps) => aps.filter((a) => a.id !== '2024-009'))

  it('lo señala como faltante y no como «sobra uno y falta otro»', () => {
    const c = corregir(sinCompraAda, solucion())

    expect(c.emparejamiento.faltantes).toBe(1)
    expect(c.emparejamiento.sobrantes).toBe(0)
    expect(codigos(c)).toContain('APUNTE_FALTANTE')

    const faltante = c.hallazgos.find((h) => h.codigo === 'APUNTE_FALTANTE')!
    expect(faltante.apunteSolucionId).toBe('2024-009')
    expect(faltante.resumenSolucion?.activoEntrada).toBe('ADA')
    // La pista enseña dónde mirar; no dicta el apunte que hay que teclear.
    expect(faltante.pista).toMatch(/extracto/i)
    expect(faltante.pista).not.toContain('300')
  })

  it('arrastra el saldo y el FIFO de ADA, pero los cuelga del faltante en vez de repetirlos', () => {
    const c = corregir(sinCompraAda, solucion())

    expect(c.hallazgos).toHaveLength(1)
    expect(c.consecuenciasSilenciadas).toBeGreaterThan(0)

    const consecuencias = c.hallazgos[0]!.consecuencias
    expect(consecuencias.some((k) => k.capa === 'saldos')).toBe(true)
    expect(consecuencias.some((k) => k.capa === 'fifo')).toBe(true)

    // Las capas siguen informando de que no coinciden, aunque no aporten raíces propias.
    const saldos = c.capas.find((k) => k.capa === 'saldos')!
    expect(saldos.coincide).toBe(false)
    expect(saldos.raices).toBe(0)
    expect(saldos.consecuencias).toBeGreaterThan(0)
  })

  it('con `sinCascada` devuelve el reguero entero (el modo del profesor)', () => {
    const c = corregir(sinCompraAda, solucion(), { sinCascada: true })
    expect(c.hallazgos.length).toBeGreaterThan(3)
    expect(c.consecuenciasSilenciadas).toBe(0)
  })
})

describe('corregir · un apunte sobrante (duplicado)', () => {
  // El alumno teclea dos veces la venta parcial de BTC del 05/04. El correlativo del
  // duplicado es otro, así que emparejarlos por `id` no habría servido de nada.
  const conDuplicado = alumno((aps) => {
    const original = aps.find((a) => a.id === '2024-008')!
    return [...aps, { ...original, id: '2024-008-BIS' }]
  })

  it('empareja uno y deja el otro como sobrante', () => {
    const c = corregir(conDuplicado, solucion())

    expect(c.emparejamiento.sobrantes).toBe(1)
    expect(c.emparejamiento.faltantes).toBe(0)
    expect(c.emparejamiento.coincidentes).toBe(APUNTES_MINICASO.length)

    const sobrante = c.hallazgos.find((h) => h.codigo === 'APUNTE_SOBRANTE')!
    expect(sobrante.apunteId).toBe('2024-008-BIS')
    expect(sobrante.resumenAlumno?.activoSalida).toBe('BTC')
    expect(sobrante.pista).toMatch(/dos veces/i)
  })

  it('cuenta el duplicado una sola vez, con su cascada colgando', () => {
    const c = corregir(conDuplicado, solucion())
    expect(c.hallazgos).toHaveLength(1)
    expect(c.hallazgos[0]!.codigo).toBe('APUNTE_SOBRANTE')
    expect(c.consecuenciasSilenciadas).toBeGreaterThan(0)
  })
})

describe('corregir · contravalor mal tecleado (el caso que el CUADRE no ve)', () => {
  // La venta de BTC del 05/04 se anota por 5.600 € en vez de 6.500 €: un dedo en el 6.
  // Las CANTIDADES no cambian, de modo que los saldos son idénticos y el cuadre da verde.
  // Lo que cambia es la ganancia patrimonial.
  const contravalorMal = alumno((aps) => {
    const i = aps.findIndex((a) => a.id === '2024-008')
    aps[i] = { ...aps[i]!, contravalorEUR: '5600' }
    return aps
  })

  it('los saldos coinciden: el error es invisible para la capa gruesa', () => {
    const c = corregir(contravalorMal, solucion())
    expect(c.capas.find((k) => k.capa === 'saldos')!.coincide).toBe(true)
  })

  it('señala el apunte y la columna, no solo «la ganancia no cuadra»', () => {
    const c = corregir(contravalorMal, solucion())

    expect(c.hallazgos).toHaveLength(1)
    const h = c.hallazgos[0]!
    expect(h.codigo).toBe('APUNTE_DIVERGENTE')
    expect(h.capa).toBe('apuntes')
    expect(h.apunteId).toBe('2024-008')
    expect(h.campos?.map((d) => d.campo)).toEqual(['contravalorEUR'])
    expect(h.esperado).toBe(CONTRAVALORES.ventaBTC_1)
    expect(h.encontrado).toBe('5600')
    expect(h.formato).toBe('euro')
    // La pista apunta a la cotización y al tecleo; jamás al número correcto.
    expect(h.pista).toMatch(/cotizaci/i)
    expect(h.pista).not.toContain('6500')
  })

  it('la ganancia del ahorro y el resultado de la transmisión cuelgan del apunte', () => {
    const c = corregir(contravalorMal, solucion())
    const consecuencias = c.hallazgos[0]!.consecuencias

    expect(consecuencias.some((k) => k.codigo === 'FIFO_TRANSMISION')).toBe(true)
    expect(consecuencias.some((k) => k.codigo === 'FISCAL_CAJON')).toBe(true)
    expect(c.capas.find((k) => k.capa === 'fiscal')!.coincide).toBe(false)
  })
})

describe('corregir · clasificación errónea que cuadra igual ([MT] U6.2)', () => {
  // La minería del 01/06 se anota como RENDIMIENTO. Ambos tipos abren lote con el mismo
  // contravalor y no consumen nada: mismos saldos, misma cola FIFO, mismo coste. Lo único
  // que cambia es a qué base imponible va el ingreso. Ni el CUADRE (que mira hacia fuera)
  // ni la CONCILIACIÓN (que mira cola contra saldo) pueden verlo: no hay nada descuadrado.
  const mineriaComoRendimiento = alumno((aps) => {
    const i = aps.findIndex((a) => a.id === '2024-012')
    aps[i] = { ...aps[i]!, tipo: 'RENDIMIENTO' }
    return aps
  })

  it('los saldos y la cola FIFO coinciden: no hay nada descuadrado que ver', () => {
    const c = corregir(mineriaComoRendimiento, solucion())
    expect(c.capas.find((k) => k.capa === 'saldos')!.coincide).toBe(true)
    expect(c.capas.find((k) => k.capa === 'fifo')!.coincide).toBe(true)
  })

  it('y sin embargo la base imponible cambia, y el motor lo dice señalando el apunte', () => {
    const c = corregir(mineriaComoRendimiento, solucion())

    expect(c.hallazgos).toHaveLength(1)
    const h = c.hallazgos[0]!
    expect(h.codigo).toBe('APUNTE_DIVERGENTE')
    expect(h.apunteId).toBe('2024-012')
    expect(h.campos?.map((d) => d.campo)).toEqual(['tipo'])
    expect(h.encontrado).toBe('RENDIMIENTO')
    expect(h.esperado).toBe('MINERIA')

    // Los dos cajones que se mueven quedan colgados del apunte, no listados aparte.
    const cajones = h.consecuencias.filter((k) => k.codigo === 'FISCAL_CAJON')
    expect(cajones.length).toBe(2)
    expect(c.capas.find((k) => k.capa === 'fiscal')!.raices).toBe(0)
  })

  it('la pista remite al catálogo cerrado y no afirma calificación fiscal alguna', () => {
    const c = corregir(mineriaComoRendimiento, solucion())
    const h = c.hallazgos[0]!
    expect(h.pista).toMatch(/cat[áa]logo cerrado/i)
    expect(h.pista).not.toMatch(/MINER[ÍI]A/)
  })
})

describe('corregir · el orden no importa', () => {
  it('el mismo libro con los apuntes barajados no genera ni un hallazgo', () => {
    const barajado: LibroComparable = {
      apuntes: barajarDeterminista(APUNTES_MINICASO.map((a) => ({ ...a }))),
      ubicaciones: UBICACIONES_MINICASO,
    }
    // Comprobación de que el barajado hace algo (si no, el test no probaría nada).
    expect(barajado.apuntes.map((a) => a.id)).not.toEqual(APUNTES_MINICASO.map((a) => a.id))

    const c = corregir(barajado, solucion())
    expect(c.sinDesviaciones).toBe(true)
    expect(c.hallazgos).toHaveLength(0)
  })

  it('empareja por el hecho y no por el correlativo: renumerar el diario es inocuo', () => {
    const renumerado = alumno((aps) =>
      aps.map((a, i) => ({ ...a, id: `2024-${String(900 + i)}` })),
    )
    const c = corregir(renumerado, solucion())
    expect(c.sinDesviaciones).toBe(true)
    expect(c.emparejamiento.coincidentes).toBe(APUNTES_MINICASO.length)
  })
})

describe('corregir · la cascada se silencia', () => {
  // Se omite la PRIMERA compra de BTC (0,5 BTC por 20.000 € el 16/01). A partir de ahí se
  // tuerce todo lo que toca BTC: el saldo de Kraken y el de EUR, las existencias de la
  // cola, el resultado de la permuta, el de las dos ventas, el de la pérdida y los cajones
  // del ahorro. Un solo tecleo, media docena larga de síntomas.
  const sinPrimeraCompra = alumno((aps) => aps.filter((a) => a.id !== '2024-002'))

  it('un solo error aguas arriba no produce diez hallazgos aguas abajo', () => {
    const c = corregir(sinPrimeraCompra, solucion())

    expect(c.hallazgos).toHaveLength(1)
    expect(c.hallazgos[0]!.codigo).toBe('APUNTE_FALTANTE')
    expect(c.hallazgos[0]!.apunteSolucionId).toBe('2024-002')
    // Y sin embargo el alcance del destrozo queda a la vista, colgando de su causa.
    expect(c.consecuenciasSilenciadas).toBeGreaterThanOrEqual(5)
    expect(c.hallazgos[0]!.consecuencias.length).toBe(c.consecuenciasSilenciadas)
  })

  it('sin silenciar, el mismo error produce el reguero que se quería evitar', () => {
    const conReguero = corregir(sinPrimeraCompra, solucion(), { sinCascada: true })
    expect(conReguero.hallazgos.length).toBeGreaterThanOrEqual(6)
  })

  it('ordena por causa y no por fecha: lo que más arrastra va primero', () => {
    // Dos errores independientes: uno gordo en enero y uno menor en octubre.
    const dosErrores = alumno((aps) => {
      const sinCompra = aps.filter((a) => a.id !== '2024-002')
      const i = sinCompra.findIndex((a) => a.id === '2024-016')
      sinCompra[i] = { ...sinCompra[i]!, contravalorEUR: '9' }
      return sinCompra
    })
    const c = corregir(dosErrores, solucion())

    expect(c.hallazgos.length).toBe(2)
    expect(c.hallazgos[0]!.apunteSolucionId).toBe('2024-002')
    expect(c.hallazgos[0]!.consecuencias.length).toBeGreaterThan(
      c.hallazgos[1]!.consecuencias.length,
    )
  })
})

describe('corregir · el diagnóstico de una transmisión', () => {
  it('cuando solo falla el coste FIFO, la pista manda aguas arriba', () => {
    // Se cambia el contravalor de la COMPRA de ADA. La venta posterior tiene el valor de
    // transmisión correcto y el coste FIFO no: el error no está en la venta, está antes.
    // Con `sinCascada` se ve el hallazgo de la transmisión que la cascada absorbería.
    const compraAdaMal = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-009')
      aps[i] = { ...aps[i]!, contravalorEUR: '500' }
      return aps
    })
    const c = corregir(compraAdaMal, solucion(), { sinCascada: true })

    const transmision = c.hallazgos.find(
      (h) => h.codigo === 'FIFO_TRANSMISION' && h.apunteId === '2024-013',
    )!
    expect(transmision).toBeDefined()
    expect(transmision.pista).toMatch(/adquisiciones anteriores/i)
    expect(transmision.pista).toContain('ADA')
  })

  it('detecta que un apunte transmite cuando no debería (y al revés)', () => {
    // El robo del 01/09 se anota como TRANSFERENCIA a EXTERIOR: sale del saldo igual, pero
    // deja de consumir cola y de realizar pérdida.
    const roboComoTraslado = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-017')
      aps[i] = { ...aps[i]!, tipo: 'TRANSFERENCIA' }
      return aps
    })
    const c = corregir(roboComoTraslado, solucion(), { sinCascada: true })
    expect(codigos(c)).toContain('FIFO_TRANSMISION_AUSENTE')
  })
})

describe('corregir · opciones', () => {
  it('`ocultarEsperado` deja el diagnóstico y se queda con la respuesta', () => {
    const contravalorMal = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-008')
      aps[i] = { ...aps[i]!, contravalorEUR: '5600' }
      return aps
    })
    const c = corregir(contravalorMal, solucion(), { ocultarEsperado: true })
    const h = c.hallazgos[0]!

    expect(h.campos?.[0]?.campo).toBe('contravalorEUR')
    expect(h.campos?.[0]?.encontrado).toBe('5600')
    expect(h.campos?.[0]?.esperado).toBeUndefined()
    expect(h.esperado).toBeUndefined()
    expect(h.resumenSolucion).toBeUndefined()
    // Lo que sí se conserva: dónde está el fallo y qué preguntarse.
    expect(h.apunteId).toBe('2024-008')
    expect(h.pista).toBeTruthy()
  })

  it('empareja dentro del margen de días: una fecha mal tecleada es un campo, no dos apuntes', () => {
    const fechaMal = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-014')
      aps[i] = { ...aps[i]!, fechaHora: '2024-07-02T10:00:00' }
      return aps
    })
    const c = corregir(fechaMal, solucion())

    expect(c.emparejamiento.sobrantes).toBe(0)
    expect(c.emparejamiento.faltantes).toBe(0)
    expect(c.emparejamiento.divergentes).toBe(1)
    expect(c.hallazgos[0]!.campos?.map((d) => d.campo)).toEqual(['fechaHora'])
  })

  it('sin margen, la misma fecha mal tecleada se parte en sobrante + faltante', () => {
    const fechaMal = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-014')
      aps[i] = { ...aps[i]!, fechaHora: '2024-07-02T10:00:00' }
      return aps
    })
    const c = corregir(fechaMal, solucion(), { margenDiasEmparejado: 0 })
    expect(c.emparejamiento.sobrantes).toBe(1)
    expect(c.emparejamiento.faltantes).toBe(1)
  })

  it('acota la capa fiscal a los ejercicios pedidos', () => {
    const contravalorMal = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-008')
      aps[i] = { ...aps[i]!, contravalorEUR: '5600' }
      return aps
    })
    // Pidiendo solo 2025, la capa fiscal no tiene nada que mirar y el hallazgo del apunte
    // se queda sin esa consecuencia.
    const c = corregir(contravalorMal, solucion(), { ejercicios: [2025], sinCascada: true })
    expect(codigos(c)).not.toContain('FISCAL_CAJON')
  })

  it('respeta el catálogo de activos: un fiat añadido no se trata como cola FIFO', () => {
    const conUsdcFiat: LibroComparable = {
      ...solucion(),
      activos: [
        { simbolo: 'EUR', nombre: 'Euro', decimales: 2, esFiat: true },
        { simbolo: 'USDC', nombre: 'USD Coin', decimales: 6, esFiat: true },
      ],
    }
    // El catálogo no cambia ningún cálculo del FIFO; solo la huella de las causas. El
    // libro sigue siendo idéntico a la solución, así que no debe aparecer nada.
    expect(corregir(conUsdcFiat, conUsdcFiat).sinDesviaciones).toBe(true)
  })

  it('trata «0.50» y «0.5» como la misma cantidad (comparación decimal, no textual)', () => {
    const reescrito = alumno((aps) => {
      const i = aps.findIndex((a) => a.id === '2024-002')
      aps[i] = { ...aps[i]!, cantidadEntrada: '0.50', contravalorEUR: '20000.00' }
      return aps
    })
    expect(corregir(reescrito, solucion()).sinDesviaciones).toBe(true)
  })
})

describe('revisar · el modo sin solución', () => {
  it('el mini-caso, contrastado solo contra el método, no arroja errores de regla', () => {
    const r = revisar(solucion())

    expect(r.modo).toBe('revision')
    expect(r.hallazgos.every((h) => h.gravedad !== 'error')).toBe(true)
    expect(r.capas.map((k) => k.capa)).toEqual(['metodo', 'archivo'])
    // Sin justificantes, la capa del Archivo no se puede comprobar y se dice.
    expect(r.capas.find((k) => k.capa === 'archivo')!.aplica).toBe(false)
  })

  it('caza la donación sin sentido, que es la que descuadra la cola en silencio', () => {
    const conDonacion = alumno((aps) => [
      ...aps,
      {
        id: '2024-020',
        fechaHora: '2024-11-01T10:00:00',
        tipo: 'DONACION',
        ubicacionOrigen: KRAKEN,
        ubicacionDestino: 'EXTERIOR',
        activoSalida: 'BTC',
        cantidadSalida: '0.01',
        contravalorEUR: '600',
        notas: 'Donación a un familiar, sin indicar el sentido.',
      } satisfies Apunte,
    ])
    const r = revisar(conDonacion)

    const titulos = r.hallazgos.map((h) => h.titulo).join(' ')
    expect(titulos).toMatch(/ENTREGADA o RECIBIDA/)
    // Y la conciliación FIFO↔SALDOS, que llega por `validarDiario`, ve el hueco de 0,01 BTC.
    expect(titulos).toMatch(/cola FIFO/)
    expect(r.hallazgos.some((h) => h.gravedad === 'error')).toBe(true)
  })

  it('con el Archivo a la vista, lista los huecos más graves y resume el resto', () => {
    // Sin ningún justificante, los 19 apuntes están sin justificar. La lista se corta a
    // propósito: se muestran los huecos que más pesan y se resume la cola.
    const r = revisar(solucion(), { justificantes: [], maxHuecos: 3 })

    const archivo = r.capas.find((k) => k.capa === 'archivo')!
    expect(archivo.aplica).toBe(true)
    expect(archivo.coincide).toBe(false)

    const huecos = r.hallazgos.filter((h) => h.codigo === 'ARCHIVO_HUECO')
    expect(huecos).toHaveLength(4) // 3 detallados + 1 de resumen
    expect(huecos.some((h) => h.gravedad === 'info')).toBe(true)
    // El primero es el de mayor exigencia probatoria: la PÉRDIDA (robo) del 01/09.
    expect(huecos[0]!.apunteId).toBe('2024-017')
  })

  it('un justificante completo saca al apunte de la lista de huecos', () => {
    const conTodos = revisar(solucion(), { justificantes: [], maxHuecos: 50 })
    const sinRobo = revisar(solucion(), {
      maxHuecos: 50,
      justificantes: [
        {
          id: 'j-1',
          apunteId: '2024-017',
          rutaConvencional: '07-perdidas-y-donaciones',
          tipoDocumento: 'denuncia',
        },
      ],
    })
    const huecosDelRobo = (c: Correccion) =>
      c.hallazgos.filter((h) => h.apunteId === '2024-017').length

    expect(huecosDelRobo(conTodos)).toBe(1)
    // Sigue habiendo hueco (la checklist del robo pide más de un documento), pero ya no
    // está «sin justificar»: baja de error a aviso.
    const hueco = sinRobo.hallazgos.find((h) => h.apunteId === '2024-017' && h.codigo === 'ARCHIVO_HUECO')
    expect(hueco?.gravedad).toBe('aviso')
  })

  it('sin apuntes, no hay nada que revisar y lo dice sin inventarse hallazgos', () => {
    const r = revisar({ apuntes: [], ubicaciones: [] })
    expect(r.sinDesviaciones).toBe(true)
    expect(r.hallazgos).toHaveLength(0)
  })
})
