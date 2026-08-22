/**
 * CierrePage — el CIERRE del ejercicio: la Unidad 10 y el Anexo D del manual, hechos pantalla.
 *
 * Hasta la v1.6.0 el alumno llegaba al resumen fiscal y se quedaba ahí: la app calculaba todos
 * los ingredientes del cierre —saldos, cola FIFO, cuadre, conciliación, expediente probatorio,
 * aviso 721— y no tenía dónde cerrarlo. Aquí están las quince casillas del Anexo D, ocho de
 * ellas respondidas por la propia app, la foto de saldos a 31 de diciembre con su cotización y
 * su fuente, la conciliación a tres columnas de marzo y la memoria del ejercicio.
 *
 * Ni un solo cálculo vive en este fichero (Regla de oro 4): todo sale de `engine/cierre.ts` y,
 * en el caso del aviso 721 de doble corte, de `ui/fiscal/aviso721.ts`, que es capa pura. Lo que
 * hay aquí es lectura de datos, estado de formulario y presentación.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SimboloActivo } from '../../engine/types'
import {
  AVISO_CIERRE_ORIENTATIVO,
  ENCABEZADO_ANEXO_D,
  calcularCierre,
  proponerFilasTresColumnas,
  type ApartadoMemoria,
  type CotizacionCierre,
  type CotizacionesCierre,
  type FilaTresColumnas,
  type IdCasillaCierre,
  type MarcaCasilla,
} from '../../engine/cierre'
import { ejerciciosConDatos } from '../../engine/fiscal'
import {
  listarRegistros,
  listarUbicaciones,
  listarActivos,
  listarJustificantes,
  listarPrecios,
  obtenerCuadreReal,
  obtenerTolerancias,
  aDominio,
  justificantesADominio,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { calcularAviso721, type PreciosManuales } from '../fiscal/aviso721'
import { aDecimalDominio, fmtDecimal, fmtFechaHora } from '../formato'
import { descargarTexto } from '../descargas'
import { BTN_PRIMARIO, BTN_SEC, INPUT, Banner } from '../comp'
import { UnidadManual } from '../guia/UnidadManual'
import { ChecklistCierre } from '../cierre/ChecklistCierre'
import { TablaConciliacionFifo } from '../cierre/TablaConciliacionFifo'
import { FotoCierrePanel } from '../cierre/FotoCierrePanel'
import { TablaTresColumnas } from '../cierre/TablaTresColumnas'
import { MemoriaPanel } from '../cierre/MemoriaPanel'
import { PanelEntrega } from '../entrega/PanelEntrega'
import { construirInformeCierreHtml } from '../cierre/informeCierreHtml'
import { cierreVacio, guardarCierre, leerCierre, type CierreGuardado } from '../cierre/persistencia'

export function CierrePage() {
  const registrosQ = useLiveQuery(listarRegistros, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])
  const activosQ = useLiveQuery(listarActivos, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])
  const cuadreRealQ = useLiveQuery(obtenerCuadreReal, [])
  const toleranciasQ = useLiveQuery(obtenerTolerancias, [])
  const preciosQ = useLiveQuery(listarPrecios, [])

  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []
  const activos = activosQ.estado === 'listo' ? activosQ.datos : []
  const justificantesReg = justificantesQ.estado === 'listo' ? justificantesQ.datos : []
  const saldosReales = cuadreRealQ.estado === 'listo' ? cuadreRealQ.datos : []
  const tolerancias = toleranciasQ.estado === 'listo' ? toleranciasQ.datos : undefined
  const preciosCartera = preciosQ.estado === 'listo' ? preciosQ.datos : []

  const apuntes = useMemo(() => aDominio([...registros]), [registros])
  const justificantes = useMemo(
    () => justificantesADominio(justificantesReg, registros),
    [justificantesReg, registros],
  )

  const ejercicios = useMemo(() => ejerciciosConDatos(apuntes), [apuntes])
  const [ejercicioElegido, setEjercicioElegido] = useState<number | null>(null)
  const ejercicio = ejercicioElegido ?? ejercicios[0] ?? new Date().getFullYear()

  // ── Lo que el alumno marca y escribe, con su persistencia local ────────────
  const [guardado, setGuardado] = useState<CierreGuardado>(() => cierreVacio(ejercicio))
  const [falloAlGuardar, setFalloAlGuardar] = useState(false)
  const contadorFilas = useRef(0)

  // Cada ejercicio tiene su propio cierre: al cambiar de año se recarga el suyo. La lectura
  // es asíncrona porque el cierre vive en IndexedDB, junto al resto del Libro, para que
  // viaje en la copia JSON (ver `ui/cierre/persistencia.ts`). El guardia `vigente` evita
  // que la respuesta de un año que ya no está en pantalla pise a la del año actual.
  useEffect(() => {
    let vigente = true
    leerCierre(ejercicio)
      .then((estado) => {
        if (vigente) setGuardado(estado)
      })
      .catch(() => {
        if (vigente) setGuardado(cierreVacio(ejercicio))
      })
    return () => {
      vigente = false
    }
  }, [ejercicio])

  /** Aplica un cambio y lo persiste. Si la base no deja escribir, se avisa. */
  const actualizar = (parcial: Partial<CierreGuardado>) => {
    const nuevo: CierreGuardado = { ...guardado, ...parcial, ejercicio }
    setGuardado(nuevo)
    void guardarCierre(nuevo).then((ok) => setFalloAlGuardar(!ok))
  }

  // ── Normalización de lo tecleado (coma o punto → cadena de dominio) ────────
  // El motor solo recibe decimales bien formados; el formulario conserva el texto tal cual
  // se escribe, para no reescribirle al alumno lo que está tecleando.
  const cotizacionesNormalizadas: CotizacionesCierre = useMemo(() => {
    const out: Record<SimboloActivo, CotizacionCierre> = {}
    for (const [activo, cot] of Object.entries(guardado.cotizaciones)) {
      out[activo] = { precioEUR: aDecimalDominio(cot.precioEUR) ?? '', fuente: cot.fuente }
    }
    return out
  }, [guardado.cotizaciones])

  const preciosParaAviso: PreciosManuales = useMemo(() => {
    const out: Record<SimboloActivo, string> = {}
    for (const [activo, cot] of Object.entries(cotizacionesNormalizadas)) {
      if (cot.precioEUR !== '') out[activo] = cot.precioEUR
    }
    return out
  }, [cotizacionesNormalizadas])

  const tresColumnasNormalizadas: FilaTresColumnas[] = useMemo(
    () =>
      guardado.tresColumnas.map((f) => ({
        ...f,
        segunDatosFiscalesEUR: aDecimalDominio(f.segunDatosFiscalesEUR) ?? '',
        segunRegistroEUR: aDecimalDominio(f.segunRegistroEUR) ?? '',
      })),
    [guardado.tresColumnas],
  )

  // ── El cálculo, entero en el motor ────────────────────────────────────────
  const aviso721 = useMemo(
    () => calcularAviso721(apuntes, ubicaciones, ejercicio, preciosParaAviso, undefined, activos),
    [apuntes, ubicaciones, ejercicio, preciosParaAviso, activos],
  )

  const { estado, error } = useMemo(() => {
    try {
      return {
        estado: calcularCierre({
          ejercicio,
          apuntes,
          ubicaciones,
          justificantes,
          saldosReales,
          activos,
          ...(tolerancias ? { tolerancias } : {}),
          cotizaciones: cotizacionesNormalizadas,
          aviso721,
          tresColumnas: tresColumnasNormalizadas,
          memoria: guardado.memoria,
          marcas: guardado.marcas,
        }),
        error: null as string | null,
      }
    } catch (e) {
      return { estado: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [
    ejercicio,
    apuntes,
    ubicaciones,
    justificantes,
    saldosReales,
    activos,
    tolerancias,
    cotizacionesNormalizadas,
    aviso721,
    tresColumnasNormalizadas,
    guardado.memoria,
    guardado.marcas,
  ])

  // ── Acciones del alumno ───────────────────────────────────────────────────
  const cambiarMarca = (id: IdCasillaCierre, marca: MarcaCasilla) =>
    actualizar({ marcas: { ...guardado.marcas, [id]: marca } })

  const cambiarCotizacion = (activo: SimboloActivo, cotizacion: CotizacionCierre) =>
    actualizar({ cotizaciones: { ...guardado.cotizaciones, [activo]: cotizacion } })

  const traerPreciosDeCartera = () => {
    const nuevas: Record<SimboloActivo, CotizacionCierre> = { ...guardado.cotizaciones }
    for (const p of preciosCartera) {
      const previa = nuevas[p.activo]
      nuevas[p.activo] = {
        precioEUR: p.precioEur,
        // La fuente NO se inventa: el precio manual de Cartera no la lleva, y el manual la
        // exige. Se conserva la que ya hubiera escrita y, si no, queda en blanco a la vista.
        fuente: previa?.fuente ?? '',
      }
    }
    actualizar({ cotizaciones: nuevas })
  }

  const cambiarFila = (id: string, cambio: Partial<FilaTresColumnas>) =>
    actualizar({
      tresColumnas: guardado.tresColumnas.map((f) => (f.id === id ? { ...f, ...cambio } : f)),
    })

  const anadirFila = () => {
    contadorFilas.current += 1
    actualizar({
      tresColumnas: [
        ...guardado.tresColumnas,
        {
          id: `libre-${Date.now().toString(36)}-${contadorFilas.current}`,
          concepto: '',
          segunDatosFiscalesEUR: '',
          segunRegistroEUR: '',
          explicacion: '',
          origen: 'libre',
        },
      ],
    })
  }

  const eliminarFila = (id: string) =>
    actualizar({ tresColumnas: guardado.tresColumnas.filter((f) => f.id !== id) })

  const propuestas = useMemo(
    () =>
      proponerFilasTresColumnas(
        apuntes,
        ubicaciones,
        ejercicio,
        cotizacionesNormalizadas,
        activos,
      ),
    [apuntes, ubicaciones, ejercicio, cotizacionesNormalizadas, activos],
  )

  /** Añade las filas propuestas que aún no estén, sin tocar lo ya tecleado. */
  const proponerFilas = () => {
    const existentes = new Set(guardado.tresColumnas.map((f) => f.id))
    const nuevas = propuestas.filter((f) => !existentes.has(f.id))
    if (nuevas.length === 0) return
    actualizar({ tresColumnas: [...guardado.tresColumnas, ...nuevas] })
  }

  const cambiarMemoria = (apartado: ApartadoMemoria, texto: string) =>
    actualizar({ memoria: { ...guardado.memoria, [apartado]: texto } })

  const html = () => (estado ? construirInformeCierreHtml(estado, guardado.memoria) : '')

  const descargarInforme = () => {
    if (!estado) return
    descargarTexto(`cierre-${estado.ejercicio}.html`, html(), 'text/html')
  }

  const imprimirInforme = () => {
    if (!estado) return
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
    if (!win) return
    win.document.open()
    win.document.write(html())
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 250)
  }

  return (
    <div className="space-y-6">
      <UnidadManual ruta="cierre" />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cierre del ejercicio</h1>
          <p className="text-sm text-slate-500">
            El checklist del Anexo D del manual, con las casillas que la app puede responder sola
            ya respondidas: conciliación, cuadre, expediente probatorio, aviso 721 y foto de
            cierre.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Ejercicio{' '}
            <select
              className={`${INPUT} inline-block w-auto`}
              value={ejercicio}
              aria-label="Ejercicio que se cierra"
              onChange={(e) => setEjercicioElegido(Number(e.target.value))}
            >
              {(ejercicios.length > 0 ? ejercicios : [ejercicio]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <Banner tono="info">
        <strong>Cierre orientativo docente.</strong> {AVISO_CIERRE_ORIENTATIVO}
      </Banner>

      {falloAlGuardar && (
        <Banner tono="error">
          No se ha podido guardar lo que escribes en el Libro (navegación privada o
          almacenamiento lleno). Descarga el informe de cierre antes de salir o lo perderás.
        </Banner>
      )}

      {error && <Banner tono="error">No se pudo calcular el cierre: {error}</Banner>}

      {estado && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_SEC} onClick={descargarInforme}>
              Descargar informe de cierre (HTML)
            </button>
            <button type="button" className={BTN_PRIMARIO} onClick={imprimirInforme}>
              Imprimir
            </button>
          </div>

          {/* Veredicto y recuento. */}
          <section
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            aria-label="Estado del cierre"
          >
            <div
              className={`rounded-lg border p-3 ${
                estado.cerrado
                  ? 'border-green-300 dark:border-green-900/60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="text-xs text-slate-500">Ejercicio</div>
              <div
                className={`text-lg font-bold ${
                  estado.cerrado ? 'text-semaforo-ok' : 'text-semaforo-error'
                }`}
              >
                {estado.cerrado ? 'Cerrado' : 'No cerrado'}
              </div>
            </div>
            <Kpi etiqueta="Hechas" valor={`${estado.cumplidas} / ${estado.casillas.length}`} />
            <Kpi etiqueta="No aplican" valor={String(estado.noAplicables)} />
            <Kpi etiqueta="Pendientes" valor={String(estado.pendientes)} />
            <Kpi etiqueta="Resueltas" valor={`${fmtDecimal(String(estado.porcentaje))} %`} />
          </section>

          {estado.noAplicaSinRazon > 0 && (
            <Banner tono="error">
              Hay {estado.noAplicaSinRazon} casilla(s) descartadas sin razón escrita. El ejercicio
              no se cierra así: «la diferencia entre "no lo hice" y "decidí no hacerlo, y aquí
              está por qué" es toda la diferencia ante una comprobación» ([MT] Anexo D).
            </Banner>
          )}

          {/* El checklist. */}
          <section
            className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            aria-labelledby="cierre-checklist"
          >
            <div>
              <h2 id="cierre-checklist" className="text-lg font-semibold">
                Checklist de cierre del ejercicio
              </h2>
              <p className="text-xs leading-relaxed text-slate-500">{ENCABEZADO_ANEXO_D}</p>
            </div>
            <ChecklistCierre
              grupos={estado.porMomento}
              marcas={guardado.marcas}
              onCambiar={cambiarMarca}
            />
          </section>

          {/* La conciliación cola FIFO ↔ saldos, activo por activo. */}
          <TablaConciliacionFifo
            conciliacion={estado.conciliacionFifo}
            corte={`31/12/${ejercicio}`}
          />

          {/* La foto de cierre. */}
          <div className="space-y-2">
            {preciosCartera.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={BTN_SEC} onClick={traerPreciosDeCartera}>
                  Traer los precios de Cartera
                </button>
                <span className="text-xs text-slate-400">
                  Copia los precios manuales que ya tienes introducidos. La fuente sigue siendo
                  tuya: el manual pide citarla.
                </span>
              </div>
            )}
            <FotoCierrePanel
              foto={estado.foto}
              ejercicio={ejercicio}
              cotizaciones={guardado.cotizaciones}
              onCambiar={cambiarCotizacion}
            />
          </div>

          {/* La conciliación a tres columnas. */}
          <TablaTresColumnas
            filas={guardado.tresColumnas}
            resultado={estado.tresColumnas}
            onCambiarFila={cambiarFila}
            onAnadirFila={anadirFila}
            onEliminarFila={eliminarFila}
            onProponer={proponerFilas}
            hayPropuesta={propuestas.length > 0}
          />

          {/* La memoria del ejercicio. */}
          <MemoriaPanel
            memoria={guardado.memoria}
            resultado={estado.memoria}
            ejercicio={ejercicio}
            onCambiar={cambiarMemoria}
          />

          {/*
            El expediente de entrega cuelga del Cierre porque es el mismo gesto: cerrar el
            ejercicio y dejarlo entregable. Recibe el ejercicio de esta página —de ahí que no
            enseñe su propio selector— y las cotizaciones de cierre que el alumno ya ha
            tecleado arriba, que son las de 31-12 y no las de «hoy» de la pestaña Cartera.
          */}
          <PanelEntrega ejercicio={ejercicio} valoracionCierre={preciosParaAviso} />

          <p className="text-xs text-slate-400">
            Lo que marcas y escribes aquí se guarda en tu Libro, en este navegador
            {guardado.actualizadoEn ? ` (última vez: ${fmtFechaHora(guardado.actualizadoEn)})` : ''}
            , y viaja en la copia de seguridad JSON como el resto del Libro. Aun así,
            descarga el informe de cierre y archívalo con el ejercicio: es el documento que
            se lee dentro de cinco años.
          </p>
        </>
      )}
    </div>
  )
}

/** Tarjeta de recuento del cierre. */
function Kpi({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-xs text-slate-500">{etiqueta}</div>
      <div className="text-lg font-bold tabular-nums">{valor}</div>
    </div>
  )
}
