/**
 * CasosTaller.tsx — el CATÁLOGO DE CASOS del taller, en Inicio.
 *
 * Seis ejercicios, uno por unidad, que el profesor reparte con una frase («cargad el caso de
 * la Unidad 7») y el alumno carga con un clic. Cada tarjeta lleva la unidad, el título, la
 * dificultad, la duración estimada y lo que el caso enseña; el enunciado completo se abre
 * aparte, para que la lista siga siendo una lista.
 *
 * Lo único delicado de esta pantalla es el botón de cargar: `cargarCaso` REEMPLAZA el Libro
 * entero, de modo que si el alumno tiene trabajo dentro lo pierde. Por eso, cuando el Libro
 * no está vacío, no se carga nada sin una confirmación que diga exactamente eso y que
 * recuerde —con enlace— descargar antes la copia de seguridad. Con el Libro vacío no se
 * pregunta: no hay nada que perder y una pregunta de más es una pregunta que se contesta sin
 * leer.
 *
 * Presentación pura: la lógica de datos vive en `data/casos/` y la escritura en el
 * repositorio. Este componente no calcula nada del dominio.
 */
import { useMemo, useState } from 'react'
import {
  CASOS_TALLER,
  ETIQUETA_DIFICULTAD,
  type CasoTaller,
  type DificultadCaso,
} from '../../data/casos'
import { cargarCaso, libroVacio } from '../../data/repositorio'
import { BTN_PELIGRO, BTN_PRIMARIO, BTN_SEC, Banner, INPUT, Modal } from '../comp'
import { irA } from '../shell/rutas'

/** Filtro de la lista: todas las dificultades o una concreta. */
type FiltroDificultad = 'todas' | DificultadCaso

const OPCIONES_FILTRO: readonly { valor: FiltroDificultad; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas las dificultades' },
  { valor: 'introductorio', etiqueta: ETIQUETA_DIFICULTAD.introductorio },
  { valor: 'medio', etiqueta: ETIQUETA_DIFICULTAD.medio },
  { valor: 'avanzado', etiqueta: ETIQUETA_DIFICULTAD.avanzado },
]

/** Color del distintivo de dificultad (claro y oscuro). */
const CLASES_DIFICULTAD: Readonly<Record<DificultadCaso, string>> = {
  introductorio:
    'border-green-300 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200',
  medio:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  avanzado:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
}

/**
 * Parte el enunciado en párrafos. Los saltos de línea sueltos son del formato del fichero
 * de datos, no del texto: solo la línea en blanco separa párrafos de verdad.
 */
function parrafos(texto: string): string[] {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p.length > 0)
}

/** Estado de la carga de un caso (para el aviso y para deshabilitar botones). */
type EstadoCarga =
  | { fase: 'reposo' }
  | { fase: 'cargando'; id: string }
  | { fase: 'error'; mensaje: string }

export function CasosTaller({ deshabilitado = false }: { deshabilitado?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [filtro, setFiltro] = useState<FiltroDificultad>('todas')
  const [enunciadoDe, setEnunciadoDe] = useState<CasoTaller | null>(null)
  const [porConfirmar, setPorConfirmar] = useState<CasoTaller | null>(null)
  const [estado, setEstado] = useState<EstadoCarga>({ fase: 'reposo' })

  const visibles = useMemo(
    () => CASOS_TALLER.filter((c) => filtro === 'todas' || c.dificultad === filtro),
    [filtro],
  )

  /** Escribe el caso en el Libro y lleva al Diario, que es donde el alumno empieza. */
  const cargar = async (caso: CasoTaller) => {
    setEstado({ fase: 'cargando', id: caso.id })
    try {
      await cargarCaso(caso.datos)
      setPorConfirmar(null)
      setEnunciadoDe(null)
      setEstado({ fase: 'reposo' })
      irA('diario')
    } catch (err: unknown) {
      setEstado({
        fase: 'error',
        mensaje: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /** Con el Libro vacío se carga sin preguntar; con trabajo dentro, nunca sin confirmar. */
  const pedirCarga = async (caso: CasoTaller) => {
    if (await libroVacio()) {
      await cargar(caso)
      return
    }
    setPorConfirmar(caso)
  }

  const cargando = estado.fase === 'cargando'

  return (
    <section aria-labelledby="casos-taller-titulo" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="casos-taller-titulo" className="text-lg font-semibold text-stone-900">
            Casos del taller, por unidad
          </h2>
          <p className="text-sm text-stone-500">
            Ejercicios pequeños para trabajar en clase. Cada uno trae dentro el problema de su
            unidad: no son libros de demostración, son libros para arreglar.
          </p>
        </div>
        <button
          type="button"
          className={BTN_SEC}
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="casos-taller-lista"
        >
          {abierto ? 'Ocultar los casos' : `Ver los ${CASOS_TALLER.length} casos`}
        </button>
      </div>

      {abierto && (
        <div id="casos-taller-lista" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="casos-filtro-dificultad" className="text-sm text-stone-500">
              Mostrar
            </label>
            <select
              id="casos-filtro-dificultad"
              className={`${INPUT} inline-block w-auto`}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroDificultad)}
            >
              {OPCIONES_FILTRO.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
            <span className="text-sm text-stone-400" aria-live="polite">
              {visibles.length} de {CASOS_TALLER.length}
            </span>
          </div>

          {estado.fase === 'error' && (
            <Banner tono="error" onCerrar={() => setEstado({ fase: 'reposo' })}>
              No se ha podido cargar el caso: {estado.mensaje}. Tu Libro no se ha modificado.
            </Banner>
          )}

          <ul className="grid gap-3 sm:grid-cols-2">
            {visibles.map((caso) => (
              <li
                key={caso.id}
                className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-500/25 dark:text-brand-100">
                      Unidad {caso.unidad}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${CLASES_DIFICULTAD[caso.dificultad]}`}
                    >
                      {ETIQUETA_DIFICULTAD[caso.dificultad]}
                    </span>
                    <span className="text-xs text-stone-400">
                      {caso.minutosEstimados} min · {caso.datos.apuntes.length} apuntes
                    </span>
                  </div>
                  <h3 className="font-semibold text-stone-900">{caso.titulo}</h3>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Qué enseña
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-stone-600">
                    {caso.queEnsena.map((punto) => (
                      <li key={punto}>{punto}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className={BTN_SEC}
                    onClick={() => setEnunciadoDe(caso)}
                    aria-haspopup="dialog"
                  >
                    Ver el enunciado
                  </button>
                  <button
                    type="button"
                    className={BTN_PRIMARIO}
                    disabled={deshabilitado || cargando}
                    onClick={() => void pedirCarga(caso)}
                  >
                    {cargando && estado.id === caso.id ? 'Cargando…' : 'Cargar este caso'}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs text-stone-400">
            Cargar un caso reemplaza el Libro entero. Si tienes trabajo dentro, descarga antes
            la copia de seguridad desde Ajustes.
          </p>
        </div>
      )}

      {/* El enunciado, aparte: la tarjeta presenta y el enunciado plantea. */}
      <Modal
        titulo={enunciadoDe ? `Unidad ${enunciadoDe.unidad} · ${enunciadoDe.titulo}` : ''}
        abierto={enunciadoDe !== null}
        onCerrar={() => setEnunciadoDe(null)}
        ancho="max-w-2xl"
      >
        {enunciadoDe && (
          <div className="space-y-4">
            <p className="text-xs text-stone-400">
              {ETIQUETA_DIFICULTAD[enunciadoDe.dificultad]} · {enunciadoDe.minutosEstimados}{' '}
              minutos estimados · {enunciadoDe.datos.apuntes.length} apuntes
            </p>
            <div className="space-y-3 text-sm leading-relaxed text-stone-700">
              {parrafos(enunciadoDe.enunciado).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 pt-3 dark:border-slate-800">
              <button type="button" className={BTN_SEC} onClick={() => setEnunciadoDe(null)}>
                Cerrar
              </button>
              <button
                type="button"
                className={BTN_PRIMARIO}
                disabled={deshabilitado || cargando}
                onClick={() => void pedirCarga(enunciadoDe)}
              >
                Cargar este caso
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* La confirmación destructiva: solo aparece si hay algo dentro que se pueda perder. */}
      <Modal
        titulo="Cargar el caso borrará tu Libro actual"
        abierto={porConfirmar !== null}
        onCerrar={() => setPorConfirmar(null)}
      >
        {porConfirmar && (
          <div className="space-y-3 text-sm text-stone-700">
            <p>
              Tu Libro tiene datos dentro. Cargar el caso{' '}
              <strong>«Unidad {porConfirmar.unidad} · {porConfirmar.titulo}»</strong> reemplaza
              el Libro entero —apuntes, ubicaciones, activos, Archivo y cuadre— por los del
              caso. <strong>Se borra el trabajo que tengas hecho</strong> y no hay forma de
              recuperarlo desde la propia aplicación.
            </p>
            <p>
              Si aún no la tienes, descarga primero la copia de seguridad en JSON: es un
              fichero y se restaura desde el mismo sitio.
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" className={BTN_SEC} onClick={() => setPorConfirmar(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={BTN_SEC}
                onClick={() => {
                  setPorConfirmar(null)
                  irA('ajustes')
                }}
              >
                Descargar la copia primero
              </button>
              <button
                type="button"
                className={BTN_PELIGRO}
                disabled={cargando}
                onClick={() => void cargar(porConfirmar)}
              >
                {cargando ? 'Cargando…' : 'Cargar y borrar mi Libro'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
