/**
 * PanelEntrega — el panel del EXPEDIENTE DE ENTREGA: un botón y qué se incluye.
 *
 * El taller son dieciséis sesiones con ejercicios evaluables, y hasta ahora la app exportaba
 * piezas sueltas —copia JSON, XLSX, informe fiscal en HTML, CSV— pero no «el ejercicio». Esto
 * produce el documento único: un HTML autocontenido con el Libro, el cuadre, la conciliación
 * FIFO↔SALDOS, el resumen fiscal orientativo y el estado probatorio del Archivo, identificado
 * con su ejercicio, su titular y su fecha de generación. El alumno lo entrega; el profesor lo
 * abre de un vistazo, sin instalar nada y sin conexión.
 *
 * Componente REUTILIZABLE y sin página propia: se monta donde el autor decida (Cierre del
 * ejercicio es su sitio natural, y Ajustes › copias su segundo). Lee sus datos del repositorio
 * igual que `SeccionCuadre`, de modo que montarlo cuesta una línea.
 *
 * Regla de oro 4: aquí no se calcula nada. `calcularExpediente` (capa de datos) reúne las
 * cifras del motor y `construirExpedienteHtml` las escribe; este componente elige el ejercicio,
 * recoge el titular, marca las casillas y llama a la descarga.
 */
import { useMemo, useState } from 'react'
import type { SimboloActivo } from '../../engine/types'
import { TOLERANCIAS_POR_DEFECTO } from '../../engine/types'
import { ejerciciosConDatos } from '../../engine/fiscal'
import {
  listarApuntes,
  listarUbicaciones,
  listarActivos,
  listarJustificantes,
  listarRegistros,
  justificantesADominio,
  obtenerCuadreReal,
  obtenerTolerancias,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { calcularExpediente, nombreFicheroExpediente } from '../../data/entrega/expediente'
import {
  construirExpedienteHtml,
  ETIQUETA_SECCION,
  ORDEN_SECCIONES,
  SECCIONES_POR_DEFECTO,
  type ClaveSeccion,
  type SeccionesExpediente,
} from './expedienteHtml'
import { descargarTexto } from '../descargas'
import { BTN_PRIMARIO, BTN_SEC, INPUT, Banner } from '../comp'
import { fmtDecimal, fmtFechaHora } from '../formato'

/** Clave de localStorage donde se recuerda el titular (la app no lo guarda en ningún otro sitio). */
const CLAVE_TITULAR = 'hesperides.entrega.titular'

function leerTitular(): string {
  try {
    return localStorage.getItem(CLAVE_TITULAR) ?? ''
  } catch {
    // Modo privado o almacenamiento bloqueado: no es crítico, se teclea cada vez.
    return ''
  }
}

function guardarTitular(valor: string): void {
  try {
    localStorage.setItem(CLAVE_TITULAR, valor)
  } catch {
    /* Ver `leerTitular`. */
  }
}

export function PanelEntrega({
  ejercicio,
  titular: titularInicial,
  valoracionCierre,
}: {
  /**
   * Ejercicio a entregar. Si se pasa, el panel lo respeta y no enseña selector (la página
   * anfitriona ya tiene el suyo); si se omite, el panel muestra el suyo con los ejercicios
   * que tienen apuntes.
   */
  ejercicio?: number
  /** Titular del Libro para la portada. Si se omite, se recuerda el último tecleado. */
  titular?: string
  /**
   * Precios de cierre a 31/12 (EUR por unidad) para valorar el aviso 721 del resumen fiscal.
   * Local-first: los teclea el alumno en la pantalla Fiscal; sin ellos el aviso sale «sin
   * valorar» y el expediente lo dice, que es más honesto que inventar una cotización.
   *
   * Memoízalo en la página anfitriona: entra en las dependencias del cálculo del expediente y
   * un objeto literal nuevo en cada render volvería a recorrer el Libro entero.
   */
  valoracionCierre?: Readonly<Record<SimboloActivo, string>>
}) {
  const apuntesQ = useLiveQuery(listarApuntes, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])
  const activosQ = useLiveQuery(listarActivos, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])
  const registrosQ = useLiveQuery(listarRegistros, [])
  const cuadreQ = useLiveQuery(obtenerCuadreReal, [])
  const tolQ = useLiveQuery(obtenerTolerancias, [])

  const apuntes = apuntesQ.estado === 'listo' ? apuntesQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []
  const activos = activosQ.estado === 'listo' ? activosQ.datos : []
  const justificantes = justificantesQ.estado === 'listo' ? justificantesQ.datos : []
  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []
  const cuadreReal = cuadreQ.estado === 'listo' ? cuadreQ.datos : []
  const tolerancias = tolQ.estado === 'listo' ? tolQ.datos : TOLERANCIAS_POR_DEFECTO

  const [secciones, setSecciones] = useState<SeccionesExpediente>({ ...SECCIONES_POR_DEFECTO })
  const [titular, setTitular] = useState<string>(() => titularInicial ?? leerTitular())
  const [elegido, setElegido] = useState<number | null>(null)

  const ejercicios = useMemo(() => ejerciciosConDatos(apuntes), [apuntes])
  const ejercicioActivo =
    ejercicio ?? elegido ?? ejercicios[0] ?? new Date().getFullYear()

  const justificantesDom = useMemo(
    () => justificantesADominio(justificantes, registros),
    [justificantes, registros],
  )

  const { expediente, error } = useMemo(() => {
    if (apuntes.length === 0) return { expediente: null, error: null as string | null }
    try {
      return {
        expediente: calcularExpediente({
          ejercicio: ejercicioActivo,
          apuntes,
          ubicaciones,
          activos,
          justificantes: justificantesDom,
          cuadreReal,
          tolerancias,
          ...(titular.trim() ? { titular: titular.trim() } : {}),
          ...(valoracionCierre ? { opcionesFiscal: { valoracionCierre } } : {}),
        }),
        error: null as string | null,
      }
    } catch (e) {
      return { expediente: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [
    apuntes,
    ubicaciones,
    activos,
    justificantesDom,
    cuadreReal,
    tolerancias,
    ejercicioActivo,
    titular,
    valoracionCierre,
  ])

  const alternar = (clave: ClaveSeccion) =>
    setSecciones((prev) => ({ ...prev, [clave]: !prev[clave] }))

  const ninguna = ORDEN_SECCIONES.every((c) => !secciones[c])

  const descargar = () => {
    if (!expediente) return
    descargarTexto(
      nombreFicheroExpediente(expediente.ejercicio),
      construirExpedienteHtml(expediente, secciones),
      'text/html',
    )
  }

  const imprimir = () => {
    if (!expediente) return
    const win = window.open('', '_blank', 'noopener,noreferrer,width=980,height=1000')
    if (!win) return
    win.document.open()
    win.document.write(construirExpedienteHtml(expediente, secciones))
    win.document.close()
    win.focus()
    // Deja pintar antes de abrir el diálogo de impresión (mismo gesto que en Fiscal).
    setTimeout(() => win.print(), 250)
  }

  return (
    <section
      aria-labelledby="entrega-titulo"
      className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="entrega-titulo" className="text-lg font-semibold">
            Expediente de entrega
          </h2>
          <p className="text-sm text-slate-500">
            Un único fichero HTML con el ejercicio entero —Libro, cuadre, conciliación, resumen
            fiscal orientativo y estado probatorio del Archivo—, identificado con su titular y su
            fecha de generación. Se abre en cualquier navegador, <strong>sin conexión</strong>: no
            carga ni un solo recurso externo.
          </p>
        </div>
        {ejercicio === undefined && (
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Ejercicio{' '}
            <select
              className={`${INPUT} inline-block w-auto`}
              value={ejercicioActivo}
              aria-label="Ejercicio que se entrega"
              onChange={(e) => setElegido(Number(e.target.value))}
            >
              {(ejercicios.length > 0 ? ejercicios : [ejercicioActivo]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <Banner tono="error">No se ha podido preparar el expediente: {error}</Banner>
      )}

      {apuntesQ.estado === 'listo' && apuntes.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aún no hay apuntes: no hay ejercicio que entregar. Registra operaciones en el Diario o
          carga el caso de ejemplo.
        </p>
      ) : (
        <>
          <div className="max-w-md">
            <label htmlFor="entrega-titular" className="block text-sm font-medium">
              Titular del Libro
            </label>
            <input
              id="entrega-titular"
              type="text"
              className={INPUT}
              value={titular}
              placeholder="Nombre y apellidos que figuran en la portada"
              aria-describedby="entrega-titular-ayuda"
              onChange={(e) => setTitular(e.target.value)}
              onBlur={(e) => guardarTitular(e.target.value.trim())}
            />
            <p id="entrega-titular-ayuda" className="mt-1 text-xs text-slate-500">
              Solo se escribe en la portada del documento y se recuerda en este navegador. La app
              no lo envía a ninguna parte.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Qué se incluye</legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {ORDEN_SECCIONES.map((clave) => {
                const { titulo, descripcion } = ETIQUETA_SECCION[clave]
                const id = `entrega-seccion-${clave}`
                return (
                  <li key={clave}>
                    <label
                      htmlFor={id}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-stone-200 px-2.5 py-2 text-sm hover:bg-stone-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                      <input
                        id={id}
                        type="checkbox"
                        className="mt-0.5"
                        checked={secciones[clave]}
                        aria-describedby={`${id}-ayuda`}
                        onChange={() => alternar(clave)}
                      />
                      <span>
                        <span className="font-medium">{titulo}</span>
                        <span
                          id={`${id}-ayuda`}
                          className="block text-xs text-slate-500 dark:text-slate-400"
                        >
                          {descripcion}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          {expediente && (
            <p className="text-sm text-slate-500" aria-live="polite">
              Ejercicio {expediente.ejercicio}: {expediente.apuntesEjercicio.length} apunte
              {expediente.apuntesEjercicio.length === 1 ? '' : 's'} de {expediente.apuntesLibro} del
              Libro · conciliación <strong>{expediente.conciliacion.estadoGlobal}</strong> ·
              archivo completo al{' '}
              {fmtDecimal(String(expediente.completitud.porcentajeCompleto))} % ·{' '}
              {expediente.indice.totalFaltan} documento
              {expediente.indice.totalFaltan === 1 ? '' : 's'} por aportar. Se fechará el{' '}
              {fmtFechaHora(expediente.generadoEn)}.
            </p>
          )}

          {ninguna && (
            <Banner tono="info">
              No has marcado ninguna sección: el expediente saldría con la portada sola. Marca al
              menos una.
            </Banner>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN_PRIMARIO}
              onClick={descargar}
              disabled={!expediente}
            >
              Descargar expediente HTML
            </button>
            <button type="button" className={BTN_SEC} onClick={imprimir} disabled={!expediente}>
              Imprimir o guardar en PDF
            </button>
          </div>

          <p className="text-xs text-slate-400">
            El fichero se llama <code>{nombreFicheroExpediente(ejercicioActivo)}</code>. Guárdalo
            en la raíz de la carpeta del ejercicio, junto a las carpetas <code>01-adquisiciones/</code>
            , <code>02-transferencias/</code> y las demás: el documento incluye el índice de cotejo
            de esa carpeta.
          </p>
        </>
      )}
    </section>
  )
}
