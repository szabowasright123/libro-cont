/**
 * UbicacionesPage — alta/edición de ubicaciones del alumno.
 *
 * EXTERIOR es la ubicación especial de frontera: existe siempre, se muestra pero no
 * es editable ni borrable. Una ubicación con apuntes asociados no puede borrarse
 * (integridad referencial en el repositorio).
 */
import { useMemo, useState } from 'react'
import type { TipoUbicacion, Ubicacion } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import { VIAS_EVIDENCIA, viaEvidencia } from '../../engine/trazabilidad'
import { sugerir721, NOTA_CRITERIO_721, NOTA_AUTOCUSTODIA_721 } from '../../data/entidades-721'
import {
  listarUbicaciones,
  crearUbicacion,
  actualizarUbicacion,
  eliminarUbicacion,
  apuntesConUbicacion,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { fmtFecha } from '../formato'
import { BTN_PRIMARIO, BTN_SEC, BTN_PELIGRO, INPUT, Modal, Banner } from '../comp'
import { UnidadManual } from '../guia/UnidadManual'

const TIPOS_UBIC: { valor: TipoUbicacion; etiqueta: string }[] = [
  { valor: 'exchange', etiqueta: 'Exchange' },
  { valor: 'wallet', etiqueta: 'Wallet' },
  { valor: 'canal', etiqueta: 'Canal' },
]

/** Estado del formulario de ubicación. */
interface FormUbic {
  nombre: string
  tipo: TipoUbicacion
  kyc: boolean
  fechaAlta: string
  fechaCierre: string
  notas: string
  viaEvidencia: string
  notasEvidencia: string
  extranjero: boolean
  pais: string
  autocustodia: boolean
}

const FORM_VACIO: FormUbic = {
  nombre: '',
  tipo: 'exchange',
  kyc: true,
  fechaAlta: '',
  fechaCierre: '',
  notas: '',
  viaEvidencia: '',
  notasEvidencia: '',
  extranjero: false,
  pais: '',
  autocustodia: false,
}

export function UbicacionesPage() {
  const ubicaciones = useLiveQuery(listarUbicaciones, [])
  const [editando, setEditando] = useState<Ubicacion | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<FormUbic>(FORM_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [verPorque, setVerPorque] = useState(false)

  // Sugerencia del perímetro 721 a partir del nombre (lista-semilla editable; nunca impone).
  const sugerencia = useMemo(() => sugerir721(form.nombre), [form.nombre])

  const abrirNueva = () => {
    setEditando(null)
    setForm(FORM_VACIO)
    setError(null)
    setAbierto(true)
  }

  const abrirEdicion = (u: Ubicacion) => {
    setEditando(u)
    setForm({
      nombre: u.nombre,
      tipo: u.tipo,
      kyc: u.kyc,
      fechaAlta: u.fechaAlta?.slice(0, 10) ?? '',
      fechaCierre: u.fechaCierre?.slice(0, 10) ?? '',
      notas: u.notas ?? '',
      viaEvidencia: u.viaEvidencia ?? '',
      notasEvidencia: u.notasEvidencia ?? '',
      extranjero: u.extranjero ?? false,
      pais: u.pais ?? '',
      autocustodia: u.autocustodia ?? false,
    })
    setError(null)
    setAbierto(true)
  }

  const guardar = async () => {
    if (form.nombre.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }
    const datos = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      kyc: form.kyc,
      fechaAlta: form.fechaAlta ? `${form.fechaAlta}T00:00:00` : new Date().toISOString().slice(0, 19),
      ...(form.fechaCierre ? { fechaCierre: `${form.fechaCierre}T00:00:00` } : {}),
      ...(form.notas.trim() ? { notas: form.notas.trim() } : {}),
      ...(form.viaEvidencia ? { viaEvidencia: form.viaEvidencia } : {}),
      ...(form.notasEvidencia.trim() ? { notasEvidencia: form.notasEvidencia.trim() } : {}),
      // Siempre explícitos: al editar, desmarcar «extranjero» debe borrar el valor previo
      // (Dexie.update fusiona: `undefined` elimina la clave; omitirla la dejaría intacta).
      // La autocustodia NO computa para el 721: si está marcada, «extranjero» queda en falso.
      extranjero: form.autocustodia ? false : form.extranjero,
      pais: !form.autocustodia && form.extranjero && form.pais.trim() ? form.pais.trim() : undefined,
      autocustodia: form.autocustodia,
    }
    try {
      if (editando) {
        await actualizarUbicacion(editando.id, datos)
        setAviso(`Ubicación «${datos.nombre}» actualizada.`)
      } else {
        await crearUbicacion(datos)
        setAviso(`Ubicación «${datos.nombre}» creada.`)
      }
      setAbierto(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const borrar = async (u: Ubicacion) => {
    setError(null)
    try {
      const n = await apuntesConUbicacion(u.id)
      if (n > 0) {
        setAviso(null)
        setError(`No se puede borrar «${u.nombre}»: tiene ${n} apunte(s) asociado(s).`)
        return
      }
      if (!window.confirm(`¿Borrar la ubicación «${u.nombre}»?`)) return
      await eliminarUbicacion(u.id)
      setAviso(`Ubicación «${u.nombre}» borrada.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const filas = ubicaciones.estado === 'listo' ? ubicaciones.datos : []

  return (
    <div className="space-y-5">
      <UnidadManual ruta="ubicaciones" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ubicaciones</h1>
          <p className="text-sm text-slate-500">
            Dónde custodias o mueves activos. La columna KYC vertebra el Bloque 1.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARIO} onClick={abrirNueva}>
          + Nueva ubicación
        </button>
      </div>

      {error && (
        <Banner tono="error" onCerrar={() => setError(null)}>
          {error}
        </Banner>
      )}
      {aviso && (
        <Banner tono="exito" onCerrar={() => setAviso(null)}>
          {aviso}
        </Banner>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">KYC</th>
              <th className="px-3 py-2 font-medium">Extranjero</th>
              <th className="px-3 py-2 font-medium">Vía / evidencia</th>
              <th className="px-3 py-2 font-medium">Alta</th>
              <th className="px-3 py-2 font-medium">Cierre</th>
              <th className="px-3 py-2 font-medium">Notas</th>
              <th className="px-3 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* EXTERIOR: frontera, siempre presente y no editable. */}
            <tr className="bg-slate-50/50 dark:bg-slate-900/40">
              <td className="px-3 py-2 font-medium">{UBICACION_EXTERIOR}</td>
              <td className="px-3 py-2 text-slate-500">frontera</td>
              <td className="px-3 py-2 text-slate-400">—</td>
              <td className="px-3 py-2 text-slate-400">—</td>
              <td className="px-3 py-2 text-slate-400">—</td>
              <td className="px-3 py-2 text-slate-400">—</td>
              <td className="px-3 py-2 text-slate-400">—</td>
              <td className="px-3 py-2 text-slate-500">
                Rendimientos que entran, pagos que salen. No editable.
              </td>
              <td className="px-3 py-2 text-right text-xs italic text-slate-400">fija</td>
            </tr>

            {filas.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                <td className="px-3 py-2 font-medium">{u.nombre}</td>
                <td className="px-3 py-2 capitalize">{u.tipo}</td>
                <td className="px-3 py-2">
                  {u.kyc ? (
                    <span className="text-semaforo-ok">Sí</span>
                  ) : (
                    <span className="text-semaforo-revisar">No</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {u.extranjero ? (
                    <span title={u.pais ? `Extranjero · ${u.pais}` : 'Extranjero'}>
                      Sí{u.pais ? ` · ${u.pais}` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {viaEvidencia(u.viaEvidencia)?.etiqueta ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2 tabular-nums">{fmtFecha(u.fechaAlta)}</td>
                <td className="px-3 py-2 tabular-nums">{u.fechaCierre ? fmtFecha(u.fechaCierre) : '—'}</td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-slate-500" title={u.notas}>
                  {u.notas ?? '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button type="button" className={`${BTN_SEC} mr-1`} onClick={() => abrirEdicion(u)}>
                    Editar
                  </button>
                  <button type="button" className={BTN_PELIGRO} onClick={() => borrar(u)}>
                    Borrar
                  </button>
                </td>
              </tr>
            ))}

            {filas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  Aún no hay ubicaciones. Crea la primera (p. ej. tu exchange).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        titulo={editando ? `Editar «${editando.nombre}»` : 'Nueva ubicación'}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      >
        <div className="space-y-3">
          {error && <Banner tono="error">{error}</Banner>}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Nombre <span className="text-red-500">*</span>
            </span>
            <input
              className={INPUT}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Kraken, Ledger, Lightning…"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Tipo</span>
              <select
                className={INPUT}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoUbicacion })}
              >
                {TIPOS_UBIC.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">¿Sujeta a KYC?</span>
              <select
                className={INPUT}
                value={form.kyc ? 'si' : 'no'}
                onChange={(e) => setForm({ ...form, kyc: e.target.value === 'si' })}
              >
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          {/* Autocustodia: si controlas tú las claves, NO computa para el 721 (FAQ AEAT). */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">¿Autocustodia (controlas las claves)?</span>
              <select
                className={INPUT}
                value={form.autocustodia ? 'si' : 'no'}
                onChange={(e) => {
                  const auto = e.target.value === 'si'
                  // Al marcar autocustodia, se limpia «extranjero» (no computa para el 721).
                  setForm((f) => ({ ...f, autocustodia: auto, extranjero: auto ? false : f.extranjero }))
                }}
              >
                <option value="no">No</option>
                <option value="si">Sí (Ledger, Trezor, wallet propia, nodo…)</option>
              </select>
            </label>
          </div>

          {/* Radicación en el extranjero (aviso 721 del módulo fiscal). */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">¿Radicada en el extranjero?</span>
              <select
                className={INPUT}
                value={form.extranjero ? 'si' : 'no'}
                disabled={form.autocustodia}
                onChange={(e) => setForm({ ...form, extranjero: e.target.value === 'si' })}
              >
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">País</span>
              <input
                className={INPUT}
                value={form.pais}
                disabled={!form.extranjero || form.autocustodia}
                onChange={(e) => setForm({ ...form, pais: e.target.value })}
                placeholder="p. ej. Malta"
              />
            </label>
          </div>
          <p className="-mt-1 text-xs text-stone-400">
            Solo para el aviso informativo del modelo 721 (saldos &gt; 50.000 € en el extranjero a
            31/12). No altera ningún cálculo del Libro.
          </p>

          {/* Sugerencia por lista-semilla (P9.4): nunca impone; el alumno decide. */}
          {form.autocustodia ? (
            <Banner tono="info">{NOTA_AUTOCUSTODIA_721}</Banner>
          ) : (
            sugerencia && (
              <Banner tono="info">
                <div className="space-y-1">
                  {sugerencia.sugerirExtranjero ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        Parece <strong>{sugerencia.entidad}</strong> ({sugerencia.situacion}).
                        Sugerencia: marcar «extranjero» para el aviso 721.
                      </span>
                      {!form.extranjero && (
                        <button
                          type="button"
                          className={BTN_SEC}
                          onClick={() => setForm((f) => ({ ...f, extranjero: true }))}
                        >
                          Marcar extranjero
                        </button>
                      )}
                    </div>
                  ) : (
                    <span>
                      <strong>{sugerencia.entidad}</strong> está establecida en España (
                      {sugerencia.situacion}): declara 172/173; no la marques «extranjero».
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-xs text-brand-600 underline underline-offset-2 hover:text-brand-700"
                    onClick={() => setVerPorque((v) => !v)}
                  >
                    ¿por qué?
                  </button>
                  {verPorque && <p className="text-xs text-stone-500">{NOTA_CRITERIO_721}</p>}
                </div>
              </Banner>
            )
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Fecha de alta</span>
              <input
                type="date"
                className={INPUT}
                value={form.fechaAlta}
                onChange={(e) => setForm({ ...form, fechaAlta: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Fecha de cierre</span>
              <input
                type="date"
                className={INPUT}
                value={form.fechaCierre}
                onChange={(e) => setForm({ ...form, fechaCierre: e.target.value })}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Notas</span>
            <textarea
              className={INPUT}
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </label>

          {/* Ficha ampliada: vía de evidencia (qué documentación genera esta ubicación). */}
          <fieldset className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidencia de la vía (Bloque 1)
            </legend>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Vía de evidencia</span>
              <select
                className={INPUT}
                value={form.viaEvidencia}
                onChange={(e) => {
                  const clave = e.target.value
                  const via = viaEvidencia(clave)
                  // Al elegir vía, sugiere su KYC típico solo si el alumno no lo tocó aún.
                  setForm((f) => ({
                    ...f,
                    viaEvidencia: clave,
                    kyc: via ? via.kycTipico : f.kyc,
                  }))
                }}
              >
                <option value="">Sin especificar</option>
                {VIAS_EVIDENCIA.map((v) => (
                  <option key={v.clave} value={v.clave}>
                    {v.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            {viaEvidencia(form.viaEvidencia) && (
              <div className="rounded-md bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <p>
                  <span className="font-medium">Documentación que genera:</span>{' '}
                  {viaEvidencia(form.viaEvidencia)!.documentacion}
                </p>
                <p className="mt-1 italic text-slate-400">{viaEvidencia(form.viaEvidencia)!.cita}</p>
              </div>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Notas de evidencia</span>
              <textarea
                className={INPUT}
                rows={2}
                placeholder="Detalles de la documentación de esta ubicación (nº de cuenta, alias P2P, pool…)."
                value={form.notasEvidencia}
                onChange={(e) => setForm({ ...form, notasEvidencia: e.target.value })}
              />
            </label>
          </fieldset>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN_SEC} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className={BTN_PRIMARIO} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Crear ubicación'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
