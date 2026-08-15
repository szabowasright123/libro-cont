/**
 * FormularioApunte — alta/edición de un apunte del Libro.
 *
 * Al elegir el tipo, muestra SOLO los campos que ese tipo admite y marca los
 * obligatorios (modeloFormulario.ts). Valida EN VIVO con el motor
 * (validaciones.ts): los errores bloquean el guardado. DONACIÓN pregunta el
 * sentido; AJUSTE exige apunte rectificado + causa. Si la fecha rompe el orden
 * cronológico, avisa de que el diario se reordenará y renumerará.
 *
 * No calcula saldos/FIFO: solo captura y valida. El cálculo vive en el motor.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Activo, Apunte, Ubicacion } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import { validarApunte } from '../../engine/validaciones'
import type { ApunteRegistro, BorradorApunte } from '../../data/tipos'
import { crearApunte, actualizarApunte } from '../../data/repositorio'
import { rompeOrden } from '../../data/numeracion'
import {
  camposDeTipo,
  camposFaltantes,
  type CamposApunte,
  type SentidoDonacion,
} from './modeloFormulario'
import {
  SUBTIPOS_PERDIDA,
  SUBTIPOS_PERDIDA_ELEGIBLES,
  FECHA_CRITERIO_PERDIDAS,
} from './perdidaSubtipos'
import type { SubtipoPerdida } from '../../data/tipos'
import { ETIQUETA_TIPO, TIPOS_OPERACION } from '../../engine/types'
import { mapaKyc, ubicacionRelevanteConKyc } from '../../engine/archivo'
import { BTN_PRIMARIO, BTN_SEC, INPUT, Modal, Banner } from '../comp'
import { fmtFechaHora, aDecimalDominio } from '../formato'
import {
  SeccionJustificantes,
  cargarBorradores,
  reconciliarJustificantes,
  type BorradorJustificante,
} from '../archivo/SeccionJustificantes'

/** Estado inicial de apertura del formulario. */
export interface AperturaFormulario {
  borrador: BorradorApunte
  /** uid si se está editando; ausente si es alta o duplicado. */
  uid?: string
  /** Título de la ventana (p. ej. «Editar 2024-008», «Duplicar apunte»). */
  titulo: string
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  ubicaciones: Ubicacion[]
  activos: Activo[]
  /** Registros existentes (para el selector de AJUSTE y el aviso de reordenación). */
  registros: ApunteRegistro[]
  apertura: AperturaFormulario | null
  onGuardado: (mensaje: string) => void
}

/** Deduce el sentido de una DONACIÓN ya registrada a partir de qué lado tiene. */
function sentidoDeBorrador(b: BorradorApunte): SentidoDonacion {
  return b.activoSalida ? 'entregada' : 'recibida'
}

/**
 * Proyecta el borrador a un `Apunte` de dominio para validarlo en vivo con el motor.
 * (rectificaA se pone a un valor truthy si hay referencia: el motor solo comprueba
 * su presencia.)
 */
function aDominioValidable(b: BorradorApunte): Apunte {
  const ap: Apunte = {
    id: 'nuevo',
    fechaHora: b.fechaHora || '2000-01-01T00:00:00',
    tipo: b.tipo,
    ubicacionOrigen: b.ubicacionOrigen,
    ubicacionDestino: b.ubicacionDestino,
  }
  // Cantidades: se normalizan a decimal de dominio; si el tecleo aún no es un
  // número válido, se omite el lado (el motor no debe recibir texto a medias).
  const cs = aDecimalDominio(b.cantidadSalida)
  const ce = aDecimalDominio(b.cantidadEntrada)
  const cc = aDecimalDominio(b.comisionCantidad)
  const cv = aDecimalDominio(b.contravalorEUR)
  if (b.activoSalida) ap.activoSalida = b.activoSalida
  if (cs) ap.cantidadSalida = cs
  if (b.activoEntrada) ap.activoEntrada = b.activoEntrada
  if (ce) ap.cantidadEntrada = ce
  if (cc) ap.comisionCantidad = cc
  if (b.comisionActivo) ap.comisionActivo = b.comisionActivo
  if (cv !== undefined) ap.contravalorEUR = cv
  if (b.notas) ap.notas = b.notas
  if (b.rectificaAUid) ap.rectificaA = b.rectificaAUid
  return ap
}

/** Limpia del borrador los lados que el tipo actual oculta, antes de guardar. */
function sanear(b: BorradorApunte, campos: CamposApunte): BorradorApunte {
  const out: BorradorApunte = { ...b }
  if (campos.entrada === 'oculto') {
    delete out.activoEntrada
    delete out.cantidadEntrada
  }
  if (campos.salida === 'oculto') {
    delete out.activoSalida
    delete out.cantidadSalida
  }
  if (campos.comision === 'oculto') {
    delete out.comisionCantidad
    delete out.comisionActivo
  }
  if (campos.contravalor === 'oculto') delete out.contravalorEUR
  if (campos.rectificaA === 'oculto') delete out.rectificaAUid
  // El subtipo solo aplica a PÉRDIDA (derivada D2): en el resto se descarta.
  if (b.tipo !== 'PERDIDA') delete out.subtipoPerdida
  // Normaliza cantidades a decimal de dominio (punto interno); descarta las que no
  // sean un número válido para no persistir texto a medio teclear.
  normalizarCampo(out, 'cantidadEntrada')
  normalizarCampo(out, 'cantidadSalida')
  normalizarCampo(out, 'comisionCantidad')
  normalizarCampo(out, 'contravalorEUR')
  return out
}

/** Normaliza un campo numérico del borrador a decimal de dominio (o lo elimina). */
function normalizarCampo(
  b: BorradorApunte,
  campo: 'cantidadEntrada' | 'cantidadSalida' | 'comisionCantidad' | 'contravalorEUR',
): void {
  const v = aDecimalDominio(b[campo])
  if (v === undefined) delete b[campo]
  else b[campo] = v
}

export function FormularioApunte({
  abierto,
  onCerrar,
  ubicaciones,
  activos,
  registros,
  apertura,
  onGuardado,
}: Props) {
  const [borrador, setBorrador] = useState<BorradorApunte>(() => apertura?.borrador ?? vacio())
  const [sentido, setSentido] = useState<SentidoDonacion>('entregada')
  const [error, setError] = useState<string | null>(null)
  const [justificantes, setJustificantes] = useState<BorradorJustificante[]>([])

  // Resetea el estado al (re)abrir con una apertura nueva. En edición, precarga los
  // justificantes ya guardados del apunte; en alta/duplicado, empieza vacío.
  useEffect(() => {
    if (!apertura) return
    setBorrador(apertura.borrador)
    setSentido(sentidoDeBorrador(apertura.borrador))
    setError(null)
    if (apertura.uid) {
      cargarBorradores(apertura.uid).then(setJustificantes).catch(() => setJustificantes([]))
    } else {
      setJustificantes([])
    }
  }, [apertura])

  // ¿La ubicación relevante del apunte está sujeta a KYC? Determina qué rama de la
  // checklist probatoria se exige (adquisición KYC vs. no-KYC).
  const conKyc = useMemo(
    () =>
      ubicacionRelevanteConKyc(
        { ubicacionOrigen: borrador.ubicacionOrigen, ubicacionDestino: borrador.ubicacionDestino },
        mapaKyc(ubicaciones),
      ),
    [borrador.ubicacionOrigen, borrador.ubicacionDestino, ubicaciones],
  )

  const campos = useMemo(
    () => camposDeTipo(borrador.tipo, sentido),
    [borrador.tipo, sentido],
  )

  // Validación en vivo: errores del motor + campos obligatorios que faltan.
  const avisosMotor = useMemo(() => validarApunte(aDominioValidable(borrador)), [borrador])
  const faltan = useMemo(() => camposFaltantes(borrador, campos), [borrador, campos])
  const erroresMotor = avisosMotor.filter((a) => a.nivel === 'error')
  const avisosBlandos = avisosMotor.filter((a) => a.nivel === 'aviso')
  const puedeGuardar = borrador.fechaHora !== '' && erroresMotor.length === 0 && faltan.length === 0

  const reordenara = borrador.fechaHora !== '' && rompeOrden(registros, borrador.fechaHora, apertura?.uid)

  const set = (parcial: Partial<BorradorApunte>) => setBorrador((b) => ({ ...b, ...parcial }))

  const cambiarTipo = (tipo: BorradorApunte['tipo']) => {
    const nuevoSentido: SentidoDonacion = 'entregada'
    const c = camposDeTipo(tipo, nuevoSentido)
    setSentido(nuevoSentido)
    setBorrador((b) => {
      const nb: BorradorApunte = { ...b, tipo }
      // Sugerencias de ubicación de frontera según el tipo.
      if (c.origenPorDefecto) nb.ubicacionOrigen = c.origenPorDefecto
      if (c.destinoPorDefecto) nb.ubicacionDestino = c.destinoPorDefecto
      // PÉRDIDA: arranca «sin clasificar» hasta que el alumno elija el subtipo (D2).
      if (tipo === 'PERDIDA') nb.subtipoPerdida = b.subtipoPerdida ?? 'sin-clasificar'
      else delete nb.subtipoPerdida
      return nb
    })
  }

  const cambiarSentidoDonacion = (s: SentidoDonacion) => {
    setSentido(s)
    setBorrador((b) => {
      const nb: BorradorApunte = { ...b }
      if (s === 'entregada') {
        delete nb.activoEntrada
        delete nb.cantidadEntrada
        nb.ubicacionDestino = UBICACION_EXTERIOR
      } else {
        delete nb.activoSalida
        delete nb.cantidadSalida
        nb.ubicacionOrigen = UBICACION_EXTERIOR
      }
      return nb
    })
  }

  const guardar = async () => {
    if (!puedeGuardar) return
    setError(null)
    const saneado = sanear(borrador, campos)
    try {
      const res = apertura?.uid
        ? await actualizarApunte(apertura.uid, saneado)
        : await crearApunte(saneado)
      // Con el apunte ya persistido (uid estable), liga sus justificantes del Archivo.
      await reconciliarJustificantes(res.uid, justificantes)
      const nCambios = res.cambios.filter((c) => c.uid !== res.uid).length
      const base = apertura?.uid ? 'Apunte actualizado.' : 'Apunte registrado.'
      const extra = nCambios > 0 ? ` Se reordenó el diario y se renumeraron ${nCambios} apunte(s).` : ''
      onGuardado(base + extra)
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const opcionesUbic = (
    <>
      <option value="">— elegir —</option>
      <option value={UBICACION_EXTERIOR}>EXTERIOR (frontera)</option>
      {ubicaciones.map((u) => (
        <option key={u.id} value={u.id}>
          {u.nombre}
        </option>
      ))}
    </>
  )

  const opcionesActivo = (
    <>
      <option value="">—</option>
      {activos.map((a) => (
        <option key={a.simbolo} value={a.simbolo}>
          {a.simbolo}
        </option>
      ))}
    </>
  )

  return (
    <Modal titulo={apertura?.titulo ?? 'Nuevo apunte'} abierto={abierto} onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        {error && <Banner tono="error">{error}</Banner>}

        {/* Tipo y fecha */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tipo de operación</span>
            <select
              className={INPUT}
              value={borrador.tipo}
              onChange={(e) => cambiarTipo(e.target.value as BorradorApunte['tipo'])}
              aria-label="Tipo de operación"
            >
              {TIPOS_OPERACION.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Fecha y hora <span className="text-red-500">*</span>
            </span>
            <input
              type="datetime-local"
              className={INPUT}
              value={borrador.fechaHora}
              onChange={(e) => set({ fechaHora: e.target.value })}
              aria-label="Fecha y hora"
            />
          </label>
        </div>

        {/* Pregunta manual: sentido de la donación */}
        {campos.preguntaSentidoDonacion && (
          <fieldset className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <legend className="px-1 text-sm font-medium">Sentido de la donación</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sentido"
                  checked={sentido === 'entregada'}
                  onChange={() => cambiarSentidoDonacion('entregada')}
                />
                Entregada (sale de tu patrimonio)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sentido"
                  checked={sentido === 'recibida'}
                  onChange={() => cambiarSentidoDonacion('recibida')}
                />
                Recibida (entra a tu patrimonio · ISD)
              </label>
            </div>
          </fieldset>
        )}

        {/* Ubicaciones */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Ubicación origen</span>
            <select
              className={INPUT}
              value={borrador.ubicacionOrigen}
              onChange={(e) => set({ ubicacionOrigen: e.target.value })}
              aria-label="Ubicación origen"
            >
              {opcionesUbic}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Ubicación destino</span>
            <select
              className={INPUT}
              value={borrador.ubicacionDestino}
              onChange={(e) => set({ ubicacionDestino: e.target.value })}
              aria-label="Ubicación destino"
            >
              {opcionesUbic}
            </select>
          </label>
        </div>

        {/* Lado de salida */}
        {campos.salida !== 'oculto' && (
          <GrupoActivoCantidad
            etiqueta="Salida (lo que sale / se transmite)"
            obligatorio={campos.salida === 'obligatorio'}
            activo={borrador.activoSalida ?? ''}
            cantidad={borrador.cantidadSalida ?? ''}
            onActivo={(v) => set({ activoSalida: v || undefined })}
            onCantidad={(v) => set({ cantidadSalida: v })}
            opcionesActivo={opcionesActivo}
            idLado="salida"
          />
        )}

        {/* Lado de entrada */}
        {campos.entrada !== 'oculto' && (
          <GrupoActivoCantidad
            etiqueta="Entrada (lo que entra / se adquiere)"
            obligatorio={campos.entrada === 'obligatorio'}
            activo={borrador.activoEntrada ?? ''}
            cantidad={borrador.cantidadEntrada ?? ''}
            onActivo={(v) => set({ activoEntrada: v || undefined })}
            onCantidad={(v) => set({ cantidadEntrada: v })}
            opcionesActivo={opcionesActivo}
            idLado="entrada"
          />
        )}

        {/* Comisión y contravalor */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {campos.comision !== 'oculto' && (
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <span className="mb-1 block text-sm font-medium">Comisión</span>
              <div className="flex gap-2">
                <input
                  className={`${INPUT} min-w-0 flex-1`}
                  inputMode="decimal"
                  placeholder="Cantidad"
                  aria-label="Cantidad de comisión"
                  value={borrador.comisionCantidad ?? ''}
                  onChange={(e) => set({ comisionCantidad: e.target.value })}
                />
                <select
                  className={`${INPUT} !w-28 shrink-0`}
                  aria-label="Activo de comisión"
                  value={borrador.comisionActivo ?? ''}
                  onChange={(e) => set({ comisionActivo: e.target.value || undefined })}
                >
                  {opcionesActivo}
                </select>
              </div>
            </div>
          )}

          {campos.contravalor !== 'oculto' && (
            <label className="block rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
              <span className="mb-1 block font-medium">
                Contravalor (EUR){' '}
                {campos.contravalor === 'obligatorio' && <span className="text-red-500">*</span>}
              </span>
              <input
                className={INPUT}
                inputMode="decimal"
                placeholder="0,00"
                aria-label="Contravalor en euros"
                value={borrador.contravalorEUR ?? ''}
                onChange={(e) => set({ contravalorEUR: e.target.value })}
              />
            </label>
          )}
        </div>

        {/* AJUSTE: apunte rectificado */}
        {campos.rectificaA === 'obligatorio' && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Apunte que rectifica <span className="text-red-500">*</span>
            </span>
            <select
              className={INPUT}
              aria-label="Apunte que rectifica"
              value={borrador.rectificaAUid ?? ''}
              onChange={(e) => set({ rectificaAUid: e.target.value || undefined })}
            >
              <option value="">— elegir apunte —</option>
              {registros
                .filter((r) => r.uid !== apertura?.uid)
                .map((r) => (
                  <option key={r.uid} value={r.uid}>
                    {r.id} · {ETIQUETA_TIPO[r.tipo]} · {fmtFechaHora(r.fechaHora)}
                  </option>
                ))}
            </select>
          </label>
        )}

        {/* Notas / causa */}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {campos.causaObligatoria ? (
              <>
                Causa de la rectificación <span className="text-red-500">*</span>
              </>
            ) : (
              'Notas'
            )}
          </span>
          <textarea
            className={INPUT}
            rows={2}
            aria-label={campos.causaObligatoria ? 'Causa de la rectificación' : 'Notas'}
            value={borrador.notas ?? ''}
            onChange={(e) => set({ notas: e.target.value })}
          />
        </label>

        {/* PÉRDIDA: subtipo (error/robo/estafa) → criterio fiscal y checklist probatorio (D2). */}
        {borrador.tipo === 'PERDIDA' && (
          <SubtipoPerdidaBloque
            valor={borrador.subtipoPerdida ?? 'sin-clasificar'}
            onCambio={(s) => set({ subtipoPerdida: s })}
          />
        )}

        {/* Justificantes (Archivo probatorio) */}
        <SeccionJustificantes
          tipo={borrador.tipo}
          conKyc={conKyc}
          value={justificantes}
          onChange={setJustificantes}
        />

        {/* Avisos en vivo */}
        {reordenara && (
          <Banner tono="info">
            Esta fecha rompe el orden cronológico: al guardar, el diario se reordenará y
            se renumerarán los correlativos afectados.
          </Banner>
        )}
        {erroresMotor.length + faltan.length > 0 && (
          <Banner tono="error">
            <ul className="ml-4 list-disc space-y-0.5">
              {erroresMotor.map((a) => (
                <li key={a.codigo}>{a.mensaje}</li>
              ))}
              {faltan.map((f) => (
                <li key={f.campo}>Falta: {f.etiqueta}.</li>
              ))}
            </ul>
          </Banner>
        )}
        {erroresMotor.length === 0 && avisosBlandos.length > 0 && (
          <Banner tono="info">
            <ul className="ml-4 list-disc space-y-0.5">
              {avisosBlandos.map((a) => (
                <li key={a.codigo}>{a.mensaje}</li>
              ))}
            </ul>
          </Banner>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button type="button" className={BTN_SEC} onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className={BTN_PRIMARIO} onClick={guardar} disabled={!puedeGuardar}>
            {apertura?.uid ? 'Guardar cambios' : 'Registrar apunte'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Grupo reutilizable «activo + cantidad» con marca de obligatoriedad. */
function GrupoActivoCantidad({
  etiqueta,
  obligatorio,
  activo,
  cantidad,
  onActivo,
  onCantidad,
  opcionesActivo,
  idLado,
}: {
  etiqueta: string
  obligatorio: boolean
  activo: string
  cantidad: string
  onActivo: (v: string) => void
  onCantidad: (v: string) => void
  opcionesActivo: React.ReactNode
  idLado: string
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <span className="mb-1 block text-sm font-medium">
        {etiqueta} {obligatorio && <span className="text-red-500">*</span>}
      </span>
      <div className="flex gap-2">
        <input
          className={`${INPUT} min-w-0 flex-1`}
          inputMode="decimal"
          placeholder="Cantidad"
          aria-label={`Cantidad de ${idLado}`}
          value={cantidad}
          onChange={(e) => onCantidad(e.target.value)}
        />
        <select
          className={`${INPUT} !w-28 shrink-0`}
          aria-label={`Activo de ${idLado}`}
          value={activo}
          onChange={(e) => onActivo(e.target.value)}
        >
          {opcionesActivo}
        </select>
      </div>
    </div>
  )
}

/**
 * Bloque de subtipo de PÉRDIDA (derivada D2): selector + aviso de criterio fiscal + checklist
 * probatorio del subtipo. Orientativo (Regla 5); toda pérdida computable va a la BASE GENERAL.
 */
function SubtipoPerdidaBloque({
  valor,
  onCambio,
}: {
  valor: SubtipoPerdida
  onCambio: (s: SubtipoPerdida) => void
}) {
  const def = SUBTIPOS_PERDIDA[valor]
  return (
    <fieldset className="space-y-2 rounded-md border border-brand-200 bg-brand-50/50 p-3">
      <legend className="px-1 text-sm font-medium text-brand-700">
        Subtipo de la pérdida (criterio fiscal y prueba)
      </legend>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-stone-700">¿Qué clase de pérdida es?</span>
        <select
          className={INPUT}
          aria-label="Subtipo de la pérdida"
          value={valor}
          onChange={(e) => onCambio(e.target.value as SubtipoPerdida)}
        >
          {SUBTIPOS_PERDIDA_ELEGIBLES.map((s) => (
            <option key={s} value={s}>
              {SUBTIPOS_PERDIDA[s].etiqueta}
            </option>
          ))}
        </select>
      </label>

      {valor === 'sin-clasificar' && (
        <Banner tono="info">
          Clasifica el subtipo para ver el criterio de deducibilidad y el checklist probatorio.
        </Banner>
      )}

      <p className="text-xs font-medium text-stone-700">{def.encajeFiscal}</p>
      <p className="text-xs leading-relaxed text-stone-500">{def.aviso}</p>

      <div>
        <p className="text-xs font-semibold text-stone-600">Checklist probatorio:</p>
        <ul className="ml-4 list-disc space-y-0.5 text-xs text-stone-500">
          {def.checklist.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="text-[11px] italic text-stone-400">
        {FECHA_CRITERIO_PERDIDAS} Orientativo; no sustituye la revisión de un profesional.
      </p>
    </fieldset>
  )
}

/** Borrador vacío por defecto (COMPRA). */
function vacio(): BorradorApunte {
  return {
    fechaHora: '',
    tipo: 'COMPRA',
    ubicacionOrigen: '',
    ubicacionDestino: '',
  }
}
