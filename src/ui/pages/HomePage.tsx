import { useEffect, useMemo, useState } from 'react'
import { abrirBaseDatos, db } from '../../data/db'
import { TIPOS_OPERACION } from '../../engine/types'
import { useLiveQuery } from '../../data/useLiveQuery'
import { cargarCasoDemo, estaDemoCargada, estadoCopia, libroVacio } from '../../data/repositorio'
import { necesitaRecordatorioCopia, textoRecordatorio } from '../../data/copias'
import { Banner, BTN_PRIMARIO, BTN_SEC } from '../comp'
import { irA, type Ruta } from '../shell/rutas'

type EstadoDB =
  | { fase: 'abriendo' }
  | { fase: 'ok'; nombre: string; version: number }
  | { fase: 'error'; mensaje: string }

/** Un paso del flujo del taller. */
interface Paso {
  ruta: Ruta
  titulo: string
  descripcion: string
  /** Devuelve el recuento a mostrar (o null si el paso no lleva contador). */
  conteo?: (c: Conteos) => number | undefined
  unidad?: string
}

interface Conteos {
  apuntes: number
  ubicaciones: number
  activos: number
  justificantes: number
}

/**
 * Los seis pasos del método del taller, en orden. La guía integrada (P8) convierte
 * el flujo del manual en un recorrido clicable: dar de alta ubicaciones → parámetros
 * → registrar → cuadrar/ver saldos → archivar → fiscal.
 */
const PASOS: Paso[] = [
  {
    ruta: 'ubicaciones',
    titulo: 'Da de alta tus ubicaciones',
    descripcion: 'Exchanges, wallets y cuentas donde tienes cripto o fiat, con su vía (KYC / no-KYC).',
    conteo: (c) => c.ubicaciones,
    unidad: 'ubicaciones',
  },
  {
    ruta: 'parametros',
    titulo: 'Revisa los parámetros',
    descripcion: 'Los 11 tipos de operación, tus activos y las tolerancias del cuadre.',
    conteo: (c) => c.activos,
    unidad: 'activos',
  },
  {
    ruta: 'diario',
    titulo: 'Registra tus operaciones',
    descripcion: 'Cada compra, venta, transferencia… como un apunte del diario, en orden cronológico.',
    conteo: (c) => c.apuntes,
    unidad: 'apuntes',
  },
  {
    ruta: 'trazabilidad',
    titulo: 'Cuadra y sigue el origen',
    descripcion:
      'Teclea el saldo real de cada fuente (semáforo del cuadre) y sigue el origen KYC / no-KYC de cada saldo.',
  },
  {
    ruta: 'archivo',
    titulo: 'Archiva las pruebas',
    descripcion: 'Reúne los justificantes de cada apunte: «¿cómo lo demuestro?».',
    conteo: (c) => c.justificantes,
    unidad: 'justificantes',
  },
  {
    ruta: 'fiscal',
    titulo: 'Consulta el resumen fiscal',
    descripcion: 'Resumen anual orientativo por cajones. No es asesoramiento ni declaración.',
  },
]

/**
 * HomePage — página de inicio. Confirma que la base local abre y presenta el flujo
 * del taller como una guía clicable, con recuento en vivo de lo registrado.
 */
export function HomePage() {
  const [estado, setEstado] = useState<EstadoDB>({ fase: 'abriendo' })

  useEffect(() => {
    let vivo = true
    abrirBaseDatos()
      .then((info) => vivo && setEstado({ fase: 'ok', nombre: info.nombre, version: info.version }))
      .catch(
        (err: unknown) =>
          vivo &&
          setEstado({ fase: 'error', mensaje: err instanceof Error ? err.message : String(err) }),
      )
    return () => {
      vivo = false
    }
  }, [])

  const listo = estado.fase === 'ok'
  const conteos = useLiveQuery(
    async (): Promise<Conteos | null> =>
      listo
        ? {
            apuntes: await db.apuntes.count(),
            ubicaciones: await db.ubicaciones.count(),
            activos: await db.activos.count(),
            justificantes: await db.justificantes.count(),
          }
        : null,
    [listo],
  )
  const c = conteos.estado === 'listo' ? conteos.datos : null

  const demoQ = useLiveQuery(async () => (listo ? estaDemoCargada() : false), [listo])
  const demoCargada = demoQ.estado === 'listo' ? demoQ.datos : false

  // Recordatorio suave de copia de seguridad (P11). Nunca con la demo cargada (no son
  // datos del alumno) y descartable por sesión.
  const copiaQ = useLiveQuery(async () => (listo ? estadoCopia() : null), [listo])
  const [copiaDescartada, setCopiaDescartada] = useState(false)
  const recordatorio = useMemo(() => {
    if (!c || c.apuntes === 0 || demoCargada) return null
    if (copiaQ.estado !== 'listo' || copiaQ.datos === null) return null
    const r = necesitaRecordatorioCopia(copiaQ.datos, c.apuntes, new Date().toISOString())
    return r.necesita ? r : null
  }, [c, demoCargada, copiaQ])

  /** Carga el caso de ejemplo; si ya hay datos, pide confirmación no destructiva. */
  const cargarDemo = async () => {
    if (!(await libroVacio())) {
      if (
        !window.confirm(
          'Ya tienes datos en el Libro. Cargar el caso de ejemplo REEMPLAZARÁ tu Libro actual ' +
            'por el caso completo 2024–2025 de demostración.\n\n' +
            'Aceptar = cargar el ejemplo · Cancelar = no tocar nada.',
        )
      )
        return
    }
    await cargarCasoDemo()
    irA('diario')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Taller de <span className="text-brand-500">₿</span>itcoin 2026
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Libro Hespérides</h1>
        <p className="text-stone-600">
          El Libro (diario contable con saldos, FIFO y cuadre) y el Archivo probatorio.
          Local-first: tus datos no salen de tu navegador.
        </p>
      </header>

      {/* Onboarding con un clic (P9.3): cargar el caso de ejemplo o empezar vacío. */}
      <section className="flex flex-wrap items-center gap-3">
        <button type="button" className={BTN_PRIMARIO} onClick={() => void cargarDemo()} disabled={!listo}>
          Cargar caso de ejemplo
        </button>
        <button type="button" className={BTN_SEC} onClick={() => irA('ubicaciones')}>
          Empezar con mi libro vacío
        </button>
        {demoCargada && (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700 dark:border-brand-500/50 dark:bg-brand-700/25 dark:text-brand-100">
            Estás viendo el caso de ejemplo — se borra desde Ajustes
          </span>
        )}
      </section>

      {/* Recordatorio suave de copia de seguridad (P11): tus datos viven solo en este navegador. */}
      {recordatorio && !copiaDescartada && (
        <Banner tono="info" onCerrar={() => setCopiaDescartada(true)}>
          <span>
            {textoRecordatorio(recordatorio)} Tus datos viven solo en este navegador: descarga la
            copia JSON en{' '}
            <button
              type="button"
              onClick={() => irA('ajustes')}
              className="font-semibold underline underline-offset-2 hover:text-brand-700"
            >
              Ajustes → Copia de seguridad
            </button>
            .
          </span>
        </Banner>
      )}

      <section
        aria-live="polite"
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-stone-500">Base de datos local</dt>
            <dd className="font-mono">
              {estado.fase === 'abriendo' && <span className="text-stone-400">abriendo…</span>}
              {estado.fase === 'ok' && (
                <span className="text-semaforo-ok">● abierta · v{estado.version}</span>
              )}
              {estado.fase === 'error' && (
                <span className="text-semaforo-error">● error: {estado.mensaje}</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-stone-500">Catálogo de tipos</dt>
            <dd className="font-mono text-stone-700">{TIPOS_OPERACION.length} tipos</dd>
          </div>
        </dl>
      </section>

      {/* Guía integrada: el flujo del taller como recorrido clicable. */}
      <section aria-labelledby="flujo-titulo" className="space-y-3">
        <div>
          <h2 id="flujo-titulo" className="text-lg font-semibold text-stone-900">
            El método del taller, paso a paso
          </h2>
          <p className="text-sm text-stone-500">
            Sigue el orden la primera vez; luego salta a donde necesites desde el menú.
          </p>
        </div>
        <ol className="space-y-2">
          {PASOS.map((paso, i) => {
            const valor = paso.conteo && c ? paso.conteo(c) : undefined
            return (
              <li key={paso.ruta}>
                <button
                  type="button"
                  onClick={() => irA(paso.ruta)}
                  className="group flex w-full items-center gap-4 rounded-lg border border-stone-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50 dark:hover:bg-slate-800"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-stone-900">{paso.titulo}</span>
                    <span className="block text-sm text-stone-500">{paso.descripcion}</span>
                  </span>
                  {paso.conteo && (
                    <span className="shrink-0 text-right">
                      <span className="block text-xl font-bold tabular-nums text-stone-900">
                        {valor ?? '—'}
                      </span>
                      <span className="block text-xs text-stone-400">{paso.unidad}</span>
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-stone-300 transition-colors group-hover:text-brand-500"
                  >
                    →
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      <p className="text-center text-xs text-stone-400">
        <button
          type="button"
          onClick={() => irA('acerca')}
          className="rounded underline underline-offset-2 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Acerca de Libro Hespérides
        </button>
      </p>
    </div>
  )
}
