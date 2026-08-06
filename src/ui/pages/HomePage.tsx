import { useEffect, useState } from 'react'
import { abrirBaseDatos, db } from '../../data/db'
import { TIPOS_OPERACION } from '../../engine/types'
import { useLiveQuery } from '../../data/useLiveQuery'
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
    descripcion: 'Saldos por ubicación «con sello» KYC / no-KYC, reconciliados con la hoja SALDOS.',
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500">
          Universidad de las Hespérides · Taller de Bitcoin 2026
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Libro Hespérides</h1>
        <p className="text-slate-600 dark:text-slate-400">
          El Libro (diario contable con saldos, FIFO y cuadre) y el Archivo probatorio.
          Local-first: tus datos no salen de tu navegador.
        </p>
      </header>

      <section
        aria-live="polite"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Base de datos local</dt>
            <dd className="font-mono">
              {estado.fase === 'abriendo' && <span className="text-slate-400">abriendo…</span>}
              {estado.fase === 'ok' && (
                <span className="text-semaforo-ok">● abierta · v{estado.version}</span>
              )}
              {estado.fase === 'error' && (
                <span className="text-semaforo-error">● error: {estado.mensaje}</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Catálogo de tipos</dt>
            <dd className="font-mono text-slate-700 dark:text-slate-300">
              {TIPOS_OPERACION.length} tipos
            </dd>
          </div>
        </dl>
      </section>

      {/* Guía integrada: el flujo del taller como recorrido clicable. */}
      <section aria-labelledby="flujo-titulo" className="space-y-3">
        <div>
          <h2 id="flujo-titulo" className="text-lg font-semibold">
            El método del taller, paso a paso
          </h2>
          <p className="text-sm text-slate-500">
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
                  className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-600 dark:hover:bg-amber-950/20"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{paso.titulo}</span>
                    <span className="block text-sm text-slate-500">{paso.descripcion}</span>
                  </span>
                  {paso.conteo && (
                    <span className="shrink-0 text-right">
                      <span className="block text-xl font-bold tabular-nums">{valor ?? '—'}</span>
                      <span className="block text-xs text-slate-400">{paso.unidad}</span>
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-slate-300 transition-colors group-hover:text-amber-500 dark:text-slate-600"
                  >
                    →
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      <p className="text-center text-xs text-slate-400">
        <button
          type="button"
          onClick={() => irA('acerca')}
          className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Acerca de Libro Hespérides
        </button>
      </p>
    </div>
  )
}
