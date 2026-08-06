/**
 * ParametrosPage — parámetros del Libro.
 *
 *  1. Catálogo CERRADO de 11 tipos en SOLO-LECTURA (flags + calificación fiscal),
 *     leído de la constante del motor CATALOGO_TIPOS (Regla 7: no añadir tipos).
 *  2. Catálogo de activos EDITABLE (BTC y EUR de serie, no borrables si tienen
 *     apuntes; nunca borrables por ser de serie).
 *  3. Tolerancias del cuadre editables (verde/ámbar).
 */
import { useEffect, useState } from 'react'
import type { Activo, FlagOperacion } from '../../engine/types'
import { CATALOGO_TIPOS, TIPOS_OPERACION } from '../../engine/types'
import {
  listarActivos,
  crearActivo,
  actualizarActivo,
  eliminarActivo,
  apuntesConActivo,
  obtenerTolerancias,
  guardarTolerancias,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { BTN_PRIMARIO, BTN_SEC, BTN_PELIGRO, INPUT, Modal, Banner } from '../comp'
import { UnidadManual } from '../guia/UnidadManual'

/** Presenta un flag del catálogo (true/false/'según'). */
function Flag({ v }: { v: FlagOperacion }) {
  if (v === 'segun') return <span className="text-semaforo-revisar">según</span>
  return v ? <span className="text-semaforo-ok">Sí</span> : <span className="text-slate-400">No</span>
}

export function ParametrosPage() {
  return (
    <div className="space-y-8">
      <UnidadManual ruta="parametros" />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Parámetros</h1>
        <p className="text-sm text-slate-500">
          Catálogo cerrado de tipos, activos y tolerancias del cuadre.
        </p>
      </header>
      <SeccionTipos />
      <SeccionActivos />
      <SeccionTolerancias />
    </div>
  )
}

/** 1 · Catálogo cerrado de tipos (solo lectura). */
function SeccionTipos() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Tipos de operación</h2>
        <p className="text-sm text-slate-500">
          Catálogo cerrado de 11 tipos (solo lectura). Los textos fiscales se copian
          literales de los manuales; son orientativos.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 text-center font-medium">¿Cuadra?</th>
              <th className="px-3 py-2 text-center font-medium">¿Alteración?</th>
              <th className="px-3 py-2 text-center font-medium">¿Abre lote?</th>
              <th className="px-3 py-2 text-center font-medium">¿Consume?</th>
              <th className="px-3 py-2 font-medium">Calificación fiscal (orientativa)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {TIPOS_OPERACION.map((t) => {
              const d = CATALOGO_TIPOS[t]
              return (
                <tr key={t} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{d.etiqueta}</td>
                  <td className="px-3 py-2 text-center"><Flag v={d.cuadra} /></td>
                  <td className="px-3 py-2 text-center"><Flag v={d.alteracion} /></td>
                  <td className="px-3 py-2 text-center"><Flag v={d.abreLote} /></td>
                  <td className="px-3 py-2 text-center"><Flag v={d.consumeLote} /></td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{d.calificacionFiscal}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs italic text-slate-400">
        Calificaciones de carácter orientativo (no constituyen asesoramiento fiscal).
      </p>
    </section>
  )
}

/** Estado del formulario de activo. */
interface FormActivo {
  simbolo: string
  nombre: string
  decimales: string
  esFiat: boolean
}
const FORM_ACTIVO_VACIO: FormActivo = { simbolo: '', nombre: '', decimales: '8', esFiat: false }

/** 2 · Catálogo de activos (editable). */
function SeccionActivos() {
  const activos = useLiveQuery(listarActivos, [])
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<Activo | null>(null)
  const [form, setForm] = useState<FormActivo>(FORM_ACTIVO_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const deSerie = (s: string) => s === 'BTC' || s === 'EUR'

  const abrirNuevo = () => {
    setEditando(null)
    setForm(FORM_ACTIVO_VACIO)
    setError(null)
    setAbierto(true)
  }
  const abrirEdicion = (a: Activo) => {
    setEditando(a)
    setForm({ simbolo: a.simbolo, nombre: a.nombre, decimales: String(a.decimales), esFiat: a.esFiat })
    setError(null)
    setAbierto(true)
  }

  const guardar = async () => {
    const simbolo = form.simbolo.trim().toUpperCase()
    const decimales = Number(form.decimales)
    if (!editando && simbolo === '') return setError('El símbolo es obligatorio.')
    if (!Number.isInteger(decimales) || decimales < 0 || decimales > 18) {
      return setError('Los decimales deben ser un entero entre 0 y 18.')
    }
    try {
      if (editando) {
        await actualizarActivo(editando.simbolo, {
          nombre: form.nombre.trim() || editando.nombre,
          decimales,
          esFiat: form.esFiat,
        })
        setAviso(`Activo ${editando.simbolo} actualizado.`)
      } else {
        await crearActivo({ simbolo, nombre: form.nombre.trim() || simbolo, decimales, esFiat: form.esFiat })
        setAviso(`Activo ${simbolo} creado.`)
      }
      setAbierto(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const borrar = async (a: Activo) => {
    setError(null)
    try {
      const n = await apuntesConActivo(a.simbolo)
      if (n > 0) return setError(`No se puede borrar ${a.simbolo}: se usa en ${n} apunte(s).`)
      if (!window.confirm(`¿Borrar el activo ${a.simbolo}?`)) return
      await eliminarActivo(a.simbolo)
      setAviso(`Activo ${a.simbolo} borrado.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const filas = activos.estado === 'listo' ? activos.datos : []

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Activos</h2>
          <p className="text-sm text-slate-500">
            BTC y EUR vienen de serie (no borrables). Regla de identidad: BTC ≠ WBTC ≠ Lightning.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARIO} onClick={abrirNuevo}>
          + Nuevo activo
        </button>
      </div>

      {error && <Banner tono="error" onCerrar={() => setError(null)}>{error}</Banner>}
      {aviso && <Banner tono="exito" onCerrar={() => setAviso(null)}>{aviso}</Banner>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Símbolo</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 text-center font-medium">Decimales</th>
              <th className="px-3 py-2 text-center font-medium">Fiat</th>
              <th className="px-3 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filas.map((a) => (
              <tr key={a.simbolo} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                <td className="px-3 py-2 font-mono font-medium">{a.simbolo}</td>
                <td className="px-3 py-2">{a.nombre}</td>
                <td className="px-3 py-2 text-center tabular-nums">{a.decimales}</td>
                <td className="px-3 py-2 text-center">{a.esFiat ? 'Sí' : 'No'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button type="button" className={`${BTN_SEC} mr-1`} onClick={() => abrirEdicion(a)}>
                    Editar
                  </button>
                  {deSerie(a.simbolo) ? (
                    <span className="text-xs italic text-slate-400">de serie</span>
                  ) : (
                    <button type="button" className={BTN_PELIGRO} onClick={() => borrar(a)}>
                      Borrar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Cargando activos…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        titulo={editando ? `Editar activo ${editando.simbolo}` : 'Nuevo activo'}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      >
        <div className="space-y-3">
          {error && <Banner tono="error">{error}</Banner>}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Símbolo <span className="text-red-500">*</span>
            </span>
            <input
              className={INPUT}
              value={form.simbolo}
              disabled={!!editando}
              onChange={(e) => setForm({ ...form, simbolo: e.target.value })}
              placeholder="ETH, USDC, ADA…"
            />
            {editando && <span className="text-xs text-slate-400">El símbolo es la clave y no se puede cambiar.</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input
              className={INPUT}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ethereum, USD Coin…"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Decimales</span>
              <input
                type="number"
                min={0}
                max={18}
                className={INPUT}
                value={form.decimales}
                onChange={(e) => setForm({ ...form, decimales: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">¿Es fiat?</span>
              <select
                className={INPUT}
                value={form.esFiat ? 'si' : 'no'}
                onChange={(e) => setForm({ ...form, esFiat: e.target.value === 'si' })}
              >
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN_SEC} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className={BTN_PRIMARIO} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Crear activo'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}

/** 3 · Tolerancias del cuadre. */
function SeccionTolerancias() {
  const [verde, setVerde] = useState('0.00000001')
  const [ambar, setAmbar] = useState('0.001')
  const [cargado, setCargado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerTolerancias().then((t) => {
      setVerde(String(t.verde))
      setAmbar(String(t.ambar))
      setCargado(true)
    })
  }, [])

  const guardar = async () => {
    const v = Number(verde)
    const a = Number(ambar)
    if (!Number.isFinite(v) || !Number.isFinite(a) || v < 0 || a < 0) {
      return setError('Las tolerancias deben ser números positivos.')
    }
    if (v > a) return setError('La tolerancia verde debe ser ≤ que la ámbar.')
    setError(null)
    await guardarTolerancias({ verde: v, ambar: a })
    setAviso('Tolerancias guardadas.')
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Tolerancias del cuadre</h2>
        <p className="text-sm text-slate-500">
          Semáforo por |diferencia|: ≤ verde → OK; ≤ ámbar → REVISAR; mayor → ERROR.
        </p>
      </div>
      {error && <Banner tono="error" onCerrar={() => setError(null)}>{error}</Banner>}
      {aviso && <Banner tono="exito" onCerrar={() => setAviso(null)}>{aviso}</Banner>}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-semaforo-ok">Verde (OK) ≤</span>
          <input className={`${INPUT} w-40`} value={verde} disabled={!cargado} onChange={(e) => setVerde(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-semaforo-revisar">Ámbar (REVISAR) ≤</span>
          <input className={`${INPUT} w-40`} value={ambar} disabled={!cargado} onChange={(e) => setAmbar(e.target.value)} />
        </label>
        <button type="button" className={BTN_PRIMARIO} onClick={guardar} disabled={!cargado}>
          Guardar tolerancias
        </button>
      </div>
    </section>
  )
}
