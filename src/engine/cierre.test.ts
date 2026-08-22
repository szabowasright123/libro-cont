/**
 * cierre.test.ts — el checklist del Anexo D, y las ocho casillas que la app responde sola.
 *
 * Lo que estos tests fijan:
 *   1. El checklist ES el Anexo D: quince casillas, sus momentos en el orden del calendario y
 *      el reparto entre lo que el motor puede resolver y lo que solo puede afirmar el alumno.
 *   2. Las casillas automáticas se marcan solas sobre el CASO DE EJEMPLO de la app, que es el
 *      expediente modelo: concilia, cuadra, tiene el archivo completo y no supera el umbral
 *      del 721 a 31/12.
 *   3. La regla de cierre del Anexo D, al pie de la letra: un «no aplica» SIN razón escrita
 *      no cierra el ejercicio. «La diferencia entre "no lo hice" y "decidí no hacerlo, y aquí
 *      está por qué" es toda la diferencia ante una comprobación.»
 *   4. Que la salida real de `calcularAviso721` (capa de interfaz) encaja en la forma que el
 *      motor declara (`EntradaAviso721`): si aquel cambia, esto deja de compilar.
 */

import { describe, it, expect } from 'vitest'
import type { Apunte, Justificante, Ubicacion } from './types'
import { UBICACION_EXTERIOR } from './types'
import {
  CHECKLIST_CIERRE,
  ORDEN_MOMENTOS,
  APARTADOS_MEMORIA,
  calcularCierre,
  componerFotoCierre,
  cuadreDeCierre,
  evaluarMemoria,
  evaluarTresColumnas,
  proponerFilasTresColumnas,
  type CotizacionesCierre,
  type EntradaAviso721,
  type EntradasCierre,
  type FilaTresColumnas,
  type IdCasillaCierre,
  type MarcasCierre,
} from './cierre'
import { calcularAviso721, type PreciosManuales } from '../ui/fiscal/aviso721'
import {
  APUNTES_CASO_DEMO,
  ACTIVOS_CASO_DEMO,
  UBICACIONES_CASO_DEMO,
  JUSTIFICANTES_CASO_DEMO,
  CUADRE_REAL_CASO_DEMO,
  PRECIOS_CASO_DEMO,
} from '../data/demo/caso-demo'

// ────────────────────────────────────────────────────────────────────────────
// Andamiaje: el caso de ejemplo, cerrado a 31/12/2026
// ────────────────────────────────────────────────────────────────────────────

/** El caso de ejemplo cierra su último ejercicio en 2026 (el cuadre real está a 31/12/2026). */
const EJERCICIO = 2026

/** Justificantes del caso en forma de dominio (los de ejercicio, sin apunte, no cuentan). */
const JUSTIFICANTES: Justificante[] = JUSTIFICANTES_CASO_DEMO.filter((j) => j.apunteId !== '').map(
  (j) => ({
    id: j.id,
    apunteId: j.apunteId,
    rutaConvencional: j.rutaConvencional,
    tipoDocumento: j.tipoDocumento,
    ...(j.referenciaExterna ? { referenciaExterna: j.referenciaExterna } : {}),
    ...(j.notas ? { notas: j.notas } : {}),
  }),
)

/** Precios manuales del caso, en la forma que pide el aviso 721. */
const PRECIOS: PreciosManuales = Object.fromEntries(
  PRECIOS_CASO_DEMO.map((p) => [p.activo, p.precioEur]),
) as PreciosManuales

/** Las mismas cifras, ya con la FUENTE que el manual exige anotar en la foto de cierre. */
const COTIZACIONES: CotizacionesCierre = Object.fromEntries(
  PRECIOS_CASO_DEMO.map((p) => [
    p.activo,
    { precioEUR: p.precioEur, fuente: `Cierre de ${p.activo}/EUR en Kraken a 31/12/${EJERCICIO}` },
  ]),
)

/**
 * El aviso 721 del caso, calculado con la función real de la capa de interfaz. La anotación
 * de tipo es deliberada: comprueba en tiempo de compilación que `Aviso721DobleFecha` sigue
 * encajando en la forma que el motor declara.
 */
const AVISO_721_DEMO: EntradaAviso721 = calcularAviso721(
  APUNTES_CASO_DEMO,
  UBICACIONES_CASO_DEMO,
  EJERCICIO,
  PRECIOS,
)

/** Entradas del cierre del caso de ejemplo, con todo lo que el Libro sabe y nada escrito aún. */
function entradasDemo(extra: Partial<EntradasCierre> = {}): EntradasCierre {
  return {
    ejercicio: EJERCICIO,
    apuntes: APUNTES_CASO_DEMO,
    ubicaciones: UBICACIONES_CASO_DEMO,
    justificantes: JUSTIFICANTES,
    saldosReales: CUADRE_REAL_CASO_DEMO,
    activos: ACTIVOS_CASO_DEMO,
    cotizaciones: COTIZACIONES,
    aviso721: AVISO_721_DEMO,
    ...extra,
  }
}

/** Busca una casilla del resultado por su identificador (falla si no existe). */
function casilla(estado: ReturnType<typeof calcularCierre>, id: IdCasillaCierre) {
  const c = estado.casillas.find((x) => x.id === id)
  if (!c) throw new Error(`No existe la casilla ${id}`)
  return c
}

/** Memoria del ejercicio con los cuatro apartados escritos. */
const MEMORIA_COMPLETA = {
  'criterios-zonas-grises': 'Tesis benévola en el pool (DEFI C1): aportar no es transmitir.',
  reconstrucciones: 'Ninguna: todos los apuntes vienen de extractos y txids del propio ejercicio.',
  'diferencias-conciliacion': 'Sin diferencias con los datos fiscales de la AEAT.',
  'obligaciones-informativas': 'No procede el 721: 7.544,12 € a 31/12, por debajo de 50.000 €.',
}

/** Marca «hecho» todas las casillas indicadas. */
function marcadas(ids: readonly IdCasillaCierre[]): MarcasCierre {
  const m: MarcasCierre = {}
  for (const id of ids) m[id] = { marcada: true, marcadaEn: `${EJERCICIO + 1}-03-15T12:00:00` }
  return m
}

/** Identificadores de las casillas manuales (las que solo puede afirmar el alumno). */
const MANUALES = CHECKLIST_CIERRE.filter((c) => c.origen === 'manual').map((c) => c.id)

// ────────────────────────────────────────────────────────────────────────────
// 1. El checklist es el Anexo D
// ────────────────────────────────────────────────────────────────────────────

describe('CHECKLIST_CIERRE — el Anexo D del manual', () => {
  it('tiene las quince casillas del anexo, ocho automáticas y siete manuales', () => {
    expect(CHECKLIST_CIERRE).toHaveLength(15)
    expect(CHECKLIST_CIERRE.filter((c) => c.origen === 'automatica')).toHaveLength(8)
    expect(CHECKLIST_CIERRE.filter((c) => c.origen === 'manual')).toHaveLength(7)
  })

  it('conserva el orden del calendario del anexo y sus ocho momentos', () => {
    const momentos = [...new Set(CHECKLIST_CIERRE.map((c) => c.momento))]
    expect(momentos).toEqual([...ORDEN_MOMENTOS])
  })

  it('cada casilla lleva su remisión a la unidad del manual', () => {
    for (const c of CHECKLIST_CIERRE) {
      expect(c.dondeSeExplica).toMatch(/U\d/)
      expect(c.queSeComprueba.length).toBeGreaterThan(20)
    }
  })

  it('las automáticas dicen qué mira el motor y las manuales no lo fingen', () => {
    for (const c of CHECKLIST_CIERRE) {
      if (c.origen === 'automatica') expect(c.comoSeAutomatiza).toBeTruthy()
      else expect(c.comoSeAutomatiza).toBeUndefined()
    }
  })

  it('los identificadores de casilla son únicos (son la clave de la marca del alumno)', () => {
    const ids = CHECKLIST_CIERRE.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('la memoria tiene los cuatro apartados que el anexo enumera', () => {
    expect(APARTADOS_MEMORIA.map((a) => a.clave)).toEqual([
      'criterios-zonas-grises',
      'reconstrucciones',
      'diferencias-conciliacion',
      'obligaciones-informativas',
    ])
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 2. Las casillas automáticas, sobre el caso de ejemplo
// ────────────────────────────────────────────────────────────────────────────

describe('casillas automáticas sobre el caso de ejemplo', () => {
  const estado = calcularCierre(entradasDemo())

  it('la conciliación FIFO↔saldos se marca sola: el caso concilia activo por activo', () => {
    const c = casilla(estado, 'conciliacion-fifo-saldos')
    expect(c.origen).toBe('automatica')
    expect(c.estado).toBe('cumplida')
    expect(c.resueltaPor).toBe('motor')
    expect(estado.conciliacionFifo.estadoGlobal).toBe('OK')
    expect(estado.conciliacionFifo.activosDescuadrados).toBe(0)
    // El fiat no concilia: es la moneda de cuenta, no un elemento patrimonial con coste.
    expect(estado.conciliacionFifo.filas.map((f) => f.activo)).not.toContain('EUR')
  })

  it('el cuadre de todas las ubicaciones se marca solo: todo declarado y en verde', () => {
    const c = casilla(estado, 'cuadrar-ubicaciones')
    expect(c.estado).toBe('cumplida')
    expect(estado.cuadre.celdasSinDeclarar).toEqual([])
    expect(estado.cuadre.estadoGlobal).toBe('OK')
    expect(estado.cuadre.completo).toBe(true)
  })

  it('los justificantes se marcan solos: el expediente del caso está completo', () => {
    const c = casilla(estado, 'justificantes-al-dia')
    expect(c.estado).toBe('cumplida')
    expect(estado.archivo.incompletos).toBe(0)
    expect(estado.archivo.sinJustificar).toBe(0)
    expect(estado.archivo.porcentajeCompleto).toBe(100)
    expect(c.cifra).toEqual({ valor: '100', unidad: 'porcentaje' })
  })

  it('la foto de cierre se marca sola cuando toda cotización trae su fuente', () => {
    const c = casilla(estado, 'foto-saldos')
    expect(c.estado).toBe('cumplida')
    expect(estado.foto.activosSinCotizacion).toEqual([])
    expect(estado.foto.activosSinFuente).toEqual([])
    expect(estado.foto.corte).toBe(`${EJERCICIO}-12-31T23:59:59`)
    expect(estado.foto.filas.length).toBeGreaterThan(0)
  })

  it('la estimación anticipada del 721 (octubre) se resuelve sola', () => {
    const c = casilla(estado, 'estimacion-721-octubre')
    expect(c.estado).toBe('cumplida')
    expect(c.cifra?.unidad).toBe('EUR')
    expect(c.detalle).toContain('20/10/2026')
    expect(c.detalle).toContain('sin valor normativo')
  })

  it('el modelo 721 queda en «no aplica» CON la razón y el cálculo escritos', () => {
    const c = casilla(estado, 'modelo-721')
    expect(c.estado).toBe('no-aplica')
    expect(c.resueltaPor).toBe('motor')
    // El Anexo D exige, cuando no procede, «dejar escrita la razón y el cálculo».
    expect(c.razon).toBeTruthy()
    expect(c.razon).toContain('No supera el umbral')
    expect(c.razon).toContain('50000')
    // Desde la v1.6.0 el fiat no computa y se informa aparte (V2185-23).
    expect(c.razon).toContain('V2185-23')
    // Un «no aplica» con razón escrita NO bloquea el cierre.
    expect(c.bloquea).toBe(false)
  })

  it('la memoria y la conciliación a tres columnas quedan pendientes mientras nadie escriba', () => {
    expect(casilla(estado, 'memoria-ejercicio').estado).toBe('pendiente')
    expect(casilla(estado, 'conciliacion-tres-columnas').estado).toBe('pendiente')
  })

  it('ninguna casilla manual la resuelve el motor', () => {
    for (const id of MANUALES) {
      const c = casilla(estado, id)
      expect(c.estado).toBe('pendiente')
      expect(c.resueltaPor).toBe('nadie')
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 3. Las automáticas cuando el Libro NO está en orden
// ────────────────────────────────────────────────────────────────────────────

describe('casillas automáticas cuando algo falta', () => {
  it('sin cotizaciones, la foto queda pendiente y el 721 NO concluye (el total es un mínimo)', () => {
    const estado = calcularCierre(
      entradasDemo({
        cotizaciones: {},
        aviso721: calcularAviso721(APUNTES_CASO_DEMO, UBICACIONES_CASO_DEMO, EJERCICIO, {}),
      }),
    )
    const foto = casilla(estado, 'foto-saldos')
    expect(foto.estado).toBe('pendiente')
    expect(estado.foto.activosSinCotizacion).toContain('BTC')

    const m721 = casilla(estado, 'modelo-721')
    expect(m721.estado).toBe('pendiente')
    expect(m721.detalle).toContain('MÍNIMO')
  })

  it('sin saldos reales declarados, cuadrar ubicaciones queda pendiente (no cuadra ni descuadra)', () => {
    const estado = calcularCierre(entradasDemo({ saldosReales: [] }))
    const c = casilla(estado, 'cuadrar-ubicaciones')
    expect(c.estado).toBe('pendiente')
    expect(c.detalle).toContain('por declarar')
    expect(estado.cuadre.celdasSinDeclarar.length).toBeGreaterThan(0)
  })

  it('sin justificantes, la casilla del archivo enumera los apuntes con hueco', () => {
    const estado = calcularCierre(entradasDemo({ justificantes: [] }))
    const c = casilla(estado, 'justificantes-al-dia')
    expect(c.estado).toBe('pendiente')
    expect(c.implicados?.length).toBeGreaterThan(0)
    expect(estado.archivo.sinJustificar).toBeGreaterThan(0)
  })

  it('una donación sin sentido rompe la conciliación y deja la casilla pendiente', () => {
    // El defecto que cerró la v1.6.0: sin `sentido`, el bitcoin donado baja del SALDO y sigue
    // vivo en la COLA FIFO. El CUADRE no lo ve; la conciliación sí, y ahora el cierre también.
    const KRAKEN = 'Kraken'
    const ubics: Ubicacion[] = [
      { id: KRAKEN, nombre: 'Kraken', tipo: 'exchange', kyc: true, fechaAlta: '2026-01-01T00:00:00' },
    ]
    const apuntes: Apunte[] = [
      {
        id: '2026-001',
        fechaHora: '2026-01-10T10:00:00',
        tipo: 'COMPRA',
        ubicacionOrigen: KRAKEN,
        ubicacionDestino: KRAKEN,
        activoSalida: 'EUR',
        cantidadSalida: '50000',
        activoEntrada: 'BTC',
        cantidadEntrada: '1',
        contravalorEUR: '50000',
      },
      {
        id: '2026-002',
        fechaHora: '2026-02-10T10:00:00',
        tipo: 'DONACION',
        ubicacionOrigen: KRAKEN,
        ubicacionDestino: UBICACION_EXTERIOR,
        activoSalida: 'BTC',
        cantidadSalida: '0.5',
        contravalorEUR: '30000',
      },
    ]
    const estado = calcularCierre({
      ejercicio: 2026,
      apuntes,
      ubicaciones: ubics,
      justificantes: [],
    })
    const c = casilla(estado, 'conciliacion-fifo-saldos')
    expect(c.estado).toBe('pendiente')
    expect(c.detalle).toContain('BTC')
    expect(estado.conciliacionFifo.estadoGlobal).not.toBe('OK')
    expect(estado.cerrado).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 4. El estado global: cerrado / no cerrado
// ────────────────────────────────────────────────────────────────────────────

describe('cerrado / no cerrado', () => {
  it('el caso de ejemplo NO está cerrado mientras queden casillas manuales sin responder', () => {
    const estado = calcularCierre(entradasDemo())
    expect(estado.cerrado).toBe(false)
    expect(estado.bloqueos.length).toBeGreaterThan(0)
    // Las siete manuales, la memoria y la conciliación a tres columnas.
    expect(estado.bloqueos.map((b) => b.id).sort()).toEqual(
      [...MANUALES, 'memoria-ejercicio', 'conciliacion-tres-columnas'].sort(),
    )
    expect(estado.porcentaje).toBeLessThan(100)
  })

  it('se cierra cuando se responden las manuales y se escriben memoria y conciliación', () => {
    const tres: FilaTresColumnas[] = [
      {
        id: 'f1',
        concepto: 'Saldo a 31/12/2026 · Kraken · BTC',
        segunDatosFiscalesEUR: '4055',
        segunRegistroEUR: '4055',
        explicacion: '',
      },
    ]
    const estado = calcularCierre(
      entradasDemo({
        marcas: marcadas(MANUALES),
        memoria: MEMORIA_COMPLETA,
        tresColumnas: tres,
      }),
    )
    expect(estado.bloqueos).toEqual([])
    expect(estado.cerrado).toBe(true)
    expect(estado.porcentaje).toBe(100)
    expect(estado.cumplidas + estado.noAplicables).toBe(15)
    expect(estado.pendientes).toBe(0)
  })

  it('marcar a mano una casilla que el motor ve pendiente deja constancia de la discrepancia', () => {
    const estado = calcularCierre(
      entradasDemo({
        saldosReales: [],
        marcas: { 'cuadrar-ubicaciones': { marcada: true } },
      }),
    )
    const c = casilla(estado, 'cuadrar-ubicaciones')
    expect(c.estado).toBe('cumplida')
    expect(c.resueltaPor).toBe('alumno')
    expect(c.discrepanciaConMotor).toBe(true)
    expect(c.detalle).toContain('El motor, en cambio, la ve pendiente')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 5. «No aplica» sin razón escrita: la regla que el Anexo D subraya
// ────────────────────────────────────────────────────────────────────────────

describe('«no aplica» sin razón escrita', () => {
  /** Todo respondido salvo una casilla manual, que se descarta de una u otra manera. */
  function conDescarte(razon: string | undefined) {
    const resto = MANUALES.filter((id) => id !== 'exportar-historicos')
    const marcas: MarcasCierre = {
      ...marcadas(resto),
      'exportar-historicos': {
        noAplica: true,
        ...(razon !== undefined ? { razonNoAplica: razon } : {}),
      },
    }
    return calcularCierre(
      entradasDemo({
        marcas,
        memoria: MEMORIA_COMPLETA,
        tresColumnas: [
          {
            id: 'f1',
            concepto: 'Saldo a 31/12/2026 · Kraken · BTC',
            segunDatosFiscalesEUR: '4055',
            segunRegistroEUR: '4055',
            explicacion: '',
          },
        ],
      }),
    )
  }

  it('NO cierra el ejercicio: es «no lo hice», no «decidí no hacerlo»', () => {
    const estado = conDescarte(undefined)
    const c = casilla(estado, 'exportar-historicos')
    expect(c.estado).toBe('no-aplica')
    expect(c.bloquea).toBe(true)
    expect(c.motivoBloqueo).toBe('no-aplica-sin-razon')
    expect(estado.noAplicaSinRazon).toBe(1)
    expect(estado.cerrado).toBe(false)
    expect(estado.bloqueos.map((b) => b.id)).toEqual(['exportar-historicos'])
  })

  it('una razón en blanco (solo espacios) tampoco vale', () => {
    const estado = conDescarte('   \n  ')
    expect(estado.cerrado).toBe(false)
    expect(casilla(estado, 'exportar-historicos').motivoBloqueo).toBe('no-aplica-sin-razon')
  })

  it('con la razón escrita, cierra: «decidí no hacerlo, y aquí está por qué»', () => {
    const estado = conDescarte('No operé en ningún exchange este año: no hay histórico que exportar.')
    const c = casilla(estado, 'exportar-historicos')
    expect(c.estado).toBe('no-aplica')
    expect(c.bloquea).toBe(false)
    expect(c.resueltaPor).toBe('alumno')
    expect(estado.noAplicaSinRazon).toBe(0)
    expect(estado.cerrado).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 6. La conciliación a tres columnas (U10.2)
// ────────────────────────────────────────────────────────────────────────────

describe('conciliación a tres columnas', () => {
  const filas: FilaTresColumnas[] = [
    {
      id: 'a',
      concepto: 'Saldo 172 · Kraken',
      segunDatosFiscalesEUR: '1000',
      segunRegistroEUR: '1000',
      explicacion: '',
    },
    {
      id: 'b',
      concepto: 'Operaciones 173 · Kraken',
      segunDatosFiscalesEUR: '2500',
      segunRegistroEUR: '2000',
      explicacion: '',
    },
  ]

  it('calcula cada diferencia y marca las que no están explicadas', () => {
    const r = evaluarTresColumnas(filas)
    expect(r.filas[0]?.hayDiferencia).toBe(false)
    expect(r.filas[1]?.diferenciaEUR).toBe('500')
    expect(r.filas[1]?.sinExplicar).toBe(true)
    expect(r.filasConDiferencia).toBe(1)
    expect(r.filasSinExplicar).toBe(1)
    expect(r.completa).toBe(false)
    expect(r.diferenciaTotalEUR).toBe('500')
  })

  it('una diferencia explicada por escrito ya no cuenta como hueco', () => {
    const explicadas = filas.map((f) =>
      f.id === 'b' ? { ...f, explicacion: 'El 173 incluye la permuta que el registro anota en dos patas.' } : f,
    )
    const r = evaluarTresColumnas(explicadas)
    expect(r.filasConDiferencia).toBe(1)
    expect(r.filasSinExplicar).toBe(0)
    expect(r.completa).toBe(true)
  })

  it('una tabla vacía no es una conciliación', () => {
    expect(evaluarTresColumnas([]).completa).toBe(false)
  })

  it('la tolerancia en euros existe pero por defecto es cero (cada diferencia se explica)', () => {
    const céntimo: FilaTresColumnas[] = [
      { id: 'c', concepto: 'x', segunDatosFiscalesEUR: '100.01', segunRegistroEUR: '100', explicacion: '' },
    ]
    expect(evaluarTresColumnas(céntimo).filasConDiferencia).toBe(1)
    expect(evaluarTresColumnas(céntimo, '0.01').filasConDiferencia).toBe(0)
  })

  it('propone las filas del registro por modelo: 172 (saldos) y 173 (operaciones)', () => {
    const propuestas = proponerFilasTresColumnas(
      APUNTES_CASO_DEMO,
      UBICACIONES_CASO_DEMO,
      EJERCICIO,
      COTIZACIONES,
      ACTIVOS_CASO_DEMO,
    )
    // Kraken es la única ubicación de tipo exchange del caso, y está marcada como extranjera:
    // los modelos 172/173 los presentan los proveedores establecidos en España.
    expect(propuestas).toEqual([])

    const nacional = UBICACIONES_CASO_DEMO.map((u) =>
      u.tipo === 'exchange' ? { ...u, extranjero: false } : u,
    )
    const conPerimetro = proponerFilasTresColumnas(
      APUNTES_CASO_DEMO,
      nacional,
      EJERCICIO,
      COTIZACIONES,
      ACTIVOS_CASO_DEMO,
    )
    expect(conPerimetro.length).toBeGreaterThan(0)
    expect(conPerimetro.some((f) => f.origen === '172')).toBe(true)
    expect(conPerimetro.some((f) => f.origen === '173')).toBe(true)
    // La columna del alumno nace vacía: la teclea él desde sus datos fiscales.
    for (const f of conPerimetro) expect(f.segunDatosFiscalesEUR).toBe('')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 7. La memoria del ejercicio
// ────────────────────────────────────────────────────────────────────────────

describe('memoria del ejercicio', () => {
  it('exige los cuatro apartados del anexo', () => {
    const r = evaluarMemoria({ reconstrucciones: 'Ninguna.' })
    expect(r.completa).toBe(false)
    expect(r.escritos).toEqual(['reconstrucciones'])
    expect(r.vacios).toHaveLength(3)
  })

  it('un apartado en blanco no cuenta aunque tenga espacios', () => {
    const r = evaluarMemoria({ ...MEMORIA_COMPLETA, reconstrucciones: '   ' })
    expect(r.completa).toBe(false)
    expect(r.vacios).toEqual(['reconstrucciones'])
  })

  it('«este año no hubo reconstrucciones» también es memoria', () => {
    const r = evaluarMemoria(MEMORIA_COMPLETA)
    expect(r.completa).toBe(true)
    expect(r.palabras).toBeGreaterThan(20)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 8. La foto de cierre
// ────────────────────────────────────────────────────────────────────────────

describe('foto de cierre', () => {
  it('fija saldos por ubicación y activo a 31-12 con su cotización y su fuente', () => {
    const foto = componerFotoCierre(
      APUNTES_CASO_DEMO,
      UBICACIONES_CASO_DEMO,
      EJERCICIO,
      COTIZACIONES,
      ACTIVOS_CASO_DEMO,
    )
    expect(foto.completa).toBe(true)
    // El BTC total del caso a 31/12/2026 es el del golden ampliado: 0,84355.
    const btc = foto.totalesPorActivo.find((t) => t.activo === 'BTC')
    expect(btc?.cantidad).toBe('0.84355')
    // El euro es moneda de cuenta: vale su propio importe y no precisa fuente.
    const eur = foto.filas.find((f) => f.activo === 'EUR')
    expect(eur?.esFiat).toBe(true)
    expect(eur?.precioEUR).toBe('1')
    // Ninguna celda a cero: una foto de saldos es de lo que hay.
    for (const f of foto.filas) expect(f.saldo).not.toBe('0')
  })

  it('sin la fuente de la cotización, la foto no está completa (el manual la exige)', () => {
    const sinFuente: CotizacionesCierre = Object.fromEntries(
      PRECIOS_CASO_DEMO.map((p) => [p.activo, { precioEUR: p.precioEur, fuente: '' }]),
    )
    const foto = componerFotoCierre(
      APUNTES_CASO_DEMO,
      UBICACIONES_CASO_DEMO,
      EJERCICIO,
      sinFuente,
      ACTIVOS_CASO_DEMO,
    )
    expect(foto.completa).toBe(false)
    expect(foto.activosSinFuente).toContain('BTC')
    expect(foto.activosSinCotizacion).toEqual([])
  })

  it('un activo sin valorar no inventa el total de ese activo', () => {
    const soloBtc: CotizacionesCierre = {
      BTC: { precioEUR: '100000', fuente: 'Kraken 31/12' },
    }
    const foto = componerFotoCierre(
      APUNTES_CASO_DEMO,
      UBICACIONES_CASO_DEMO,
      EJERCICIO,
      soloBtc,
      ACTIVOS_CASO_DEMO,
    )
    const eth = foto.totalesPorActivo.find((t) => t.activo === 'ETH')
    expect(eth?.valorEUR).toBeNull()
    expect(foto.activosSinCotizacion).toContain('ETH')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 9. El cuadre de cierre
// ────────────────────────────────────────────────────────────────────────────

describe('cuadre de cierre', () => {
  it('distingue lo que descuadra de lo que nadie ha declarado todavía', () => {
    const parcial = CUADRE_REAL_CASO_DEMO.slice(0, 2)
    const r = cuadreDeCierre(
      APUNTES_CASO_DEMO,
      UBICACIONES_CASO_DEMO,
      parcial,
      EJERCICIO,
    )
    expect(r.filas).toHaveLength(2)
    expect(r.estadoGlobal).toBe('OK')
    expect(r.celdasSinDeclarar.length).toBeGreaterThan(0)
    expect(r.completo).toBe(false)
    // Las celdas sin declarar traen su nombre legible, para poder pedirlas por su nombre.
    expect(r.celdasSinDeclarar[0]?.nombreUbicacion).toBeTruthy()
  })

  it('un saldo real mal tecleado enciende el semáforo', () => {
    const torcido = CUADRE_REAL_CASO_DEMO.map((c) =>
      c.activo === 'BTC' && c.ubicacion === 'Ledger' ? { ...c, saldoReal: '0.5' } : c,
    )
    const r = cuadreDeCierre(APUNTES_CASO_DEMO, UBICACIONES_CASO_DEMO, torcido, EJERCICIO)
    expect(r.estadoGlobal).toBe('ERROR')
    expect(r.celdasDescuadradas).toBe(1)
    expect(r.completo).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 10. Determinismo (Regla de oro 4: estado → resultado)
// ────────────────────────────────────────────────────────────────────────────

describe('determinismo', () => {
  it('la misma entrada da siempre el mismo resultado', () => {
    const a = calcularCierre(entradasDemo())
    const b = calcularCierre(entradasDemo())
    expect(JSON.stringify(a.casillas)).toBe(JSON.stringify(b.casillas))
  })

  it('no muta el diario que recibe', () => {
    const copia: Apunte[] = APUNTES_CASO_DEMO.map((a) => ({ ...a }))
    calcularCierre(entradasDemo())
    expect(APUNTES_CASO_DEMO.map((a) => a.id)).toEqual(copia.map((a) => a.id))
  })

  it('el activo sin cotizar no rompe el cálculo (todo sigue devolviendo cifra o null)', () => {
    const estado = calcularCierre(entradasDemo({ cotizaciones: {} }))
    for (const t of estado.foto.totalesPorActivo) {
      expect(typeof t.cantidad).toBe('string')
      expect(t.valorEUR === null || typeof t.valorEUR === 'string').toBe(true)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 11. Los extremos: el ejercicio vacío y el 721 que sí supera el umbral
// ────────────────────────────────────────────────────────────────────────────

describe('extremos', () => {
  it('un ejercicio sin nada deja las automáticas en «no aplica» CON su razón', () => {
    const estado = calcularCierre({
      ejercicio: 1999,
      apuntes: [],
      ubicaciones: [],
      justificantes: [],
    })
    for (const id of [
      'justificantes-al-dia',
      'cuadrar-ubicaciones',
      'foto-saldos',
      'conciliacion-fifo-saldos',
    ] as const) {
      const c = casilla(estado, id)
      expect(c.estado).toBe('no-aplica')
      expect(c.razon).toBeTruthy()
      expect(c.bloquea).toBe(false)
    }
    // Sin aviso 721 aportado, el motor no concluye nada sobre el modelo.
    expect(casilla(estado, 'modelo-721').estado).toBe('pendiente')
    expect(casilla(estado, 'estimacion-721-octubre').estado).toBe('pendiente')
  })

  it('sin perímetro extranjero, los dos cortes del 721 quedan en «no aplica» razonado', () => {
    const soloNacionales = UBICACIONES_CASO_DEMO.map((u) => ({ ...u, extranjero: false }))
    const estado = calcularCierre(
      entradasDemo({
        ubicaciones: soloNacionales,
        aviso721: calcularAviso721(APUNTES_CASO_DEMO, soloNacionales, EJERCICIO, PRECIOS),
      }),
    )
    const estimacion = casilla(estado, 'estimacion-721-octubre')
    expect(estimacion.estado).toBe('no-aplica')
    expect(estimacion.razon).toContain('no hay perímetro que estimar')

    const m721 = casilla(estado, 'modelo-721')
    expect(m721.estado).toBe('no-aplica')
    expect(m721.razon).toContain('No procede presentar el modelo 721')
  })

  it('si el saldo custodiado fuera supera los 50.000 €, la casilla queda pendiente de presentar', () => {
    // Mismo caso, con el bitcoin a dos millones: el corte normativo pasa el umbral (el saldo
    // de Kraken a 31/12/2026 es 0,04055 BTC, que a ese precio ya vale más de 50.000 €).
    const caros = { ...PRECIOS, BTC: '2000000' }
    const estado = calcularCierre(
      entradasDemo({
        aviso721: calcularAviso721(APUNTES_CASO_DEMO, UBICACIONES_CASO_DEMO, EJERCICIO, caros),
      }),
    )
    const m721 = casilla(estado, 'modelo-721')
    expect(m721.estado).toBe('pendiente')
    expect(m721.detalle).toContain('supera')
    expect(m721.detalle).toContain('no determina la obligación')
    // La estimación de octubre sí está hecha: superar el umbral la informa, no la deja a medias.
    expect(casilla(estado, 'estimacion-721-octubre').estado).toBe('cumplida')
  })

  it('un saldo real mal tecleado deja pendiente la casilla del cuadre, con la celda señalada', () => {
    const torcido = CUADRE_REAL_CASO_DEMO.map((c) =>
      c.activo === 'BTC' && c.ubicacion === 'Ledger' ? { ...c, saldoReal: '0.5' } : c,
    )
    const estado = calcularCierre(entradasDemo({ saldosReales: torcido }))
    const c = casilla(estado, 'cuadrar-ubicaciones')
    expect(c.estado).toBe('pendiente')
    expect(c.detalle).toContain('no cuadran')
    expect(c.implicados?.some((x) => x.includes('BTC'))).toBe(true)
  })

  it('la conciliación a tres columnas cerrada da la casilla por hecha y recuerda archivarla', () => {
    const estado = calcularCierre(
      entradasDemo({
        tresColumnas: [
          {
            id: 'a',
            concepto: 'Operaciones 173 · Kraken',
            segunDatosFiscalesEUR: '2500',
            segunRegistroEUR: '2000',
            explicacion: 'El 173 agrega la permuta que el registro anota en dos patas.',
          },
        ],
      }),
    )
    const c = casilla(estado, 'conciliacion-tres-columnas')
    expect(c.estado).toBe('cumplida')
    expect(c.detalle).toContain('archívalo')
  })
})
