/**
 * SeccionJustificantes.tsx — sección «Justificantes» del formulario de apunte (P5).
 *
 * Muestra la checklist probatoria del tipo de operación (con la rama KYC / no-KYC) y
 * permite adjuntar un fichero (calculando su SHA-256 en el navegador) o referenciarlo,
 * eligiendo qué documento de la checklist cubre y en qué carpeta convencional se archiva.
 *
 * Es un componente CONTROLADO: el formulario padre posee la lista de borradores y la
 * persiste al guardar (así el justificante se liga al apunte una vez creado, con su uid
 * estable). El cálculo de estado vive en el motor; aquí, captura y presentación.
 */
import { useMemo } from 'react'
import type { RutaConvencional, TipoOperacion } from '../../engine/types'
import {
  CARPETAS_ARCHIVO,
  RUTA_POR_TIPO,
  requisitosAplicables,
} from '../../engine/archivo'
import {
  crearJustificante,
  actualizarJustificante,
  eliminarJustificante,
  justificantesDeApunte,
} from '../../data/repositorio'
import { sha256HexDeBlob } from '../../data/hash'
import { INPUT, BTN_SEC } from '../comp'
import { fmtBytes } from '../formato'

/** Borrador de un justificante en el formulario (aún no necesariamente persistido). */
export interface BorradorJustificante {
  /** id si ya está en la base (edición); ausente si es nuevo. */
  idExistente?: string
  rutaConvencional: RutaConvencional
  /** Clave del requisito de la checklist que cubre, o 'otros'. */
  tipoDocumento: string
  hashSHA256?: string
  /** Blob adjuntado en esta sesión (si el alumno subió un fichero). */
  fichero?: Blob
  nombreFichero?: string
  tamano?: number
  referenciaExterna?: string
  notas?: string
}

/** Documento «libre» fuera de la checklist. */
const CLAVE_OTROS = 'otros'

/** Carga los justificantes ya guardados de un apunte como borradores (modo edición). */
export async function cargarBorradores(apunteUid: string): Promise<BorradorJustificante[]> {
  const existentes = await justificantesDeApunte(apunteUid)
  return existentes.map((j) => ({
    idExistente: j.id,
    rutaConvencional: j.rutaConvencional,
    tipoDocumento: j.tipoDocumento,
    ...(j.hashSHA256 ? { hashSHA256: j.hashSHA256 } : {}),
    ...(j.fichero ? { fichero: j.fichero, tamano: j.fichero.size } : {}),
    ...(j.referenciaExterna ? { referenciaExterna: j.referenciaExterna } : {}),
    ...(j.notas ? { notas: j.notas } : {}),
  }))
}

/**
 * Persiste la lista de borradores contra el Archivo del apunte: crea los nuevos, actualiza
 * los existentes y borra los que el usuario haya quitado. Idempotente respecto al estado
 * actual de la base.
 */
export async function reconciliarJustificantes(
  apunteUid: string,
  borradores: readonly BorradorJustificante[],
): Promise<void> {
  const existentes = await justificantesDeApunte(apunteUid)
  const idsConservados = new Set(
    borradores.map((b) => b.idExistente).filter((x): x is string => Boolean(x)),
  )
  // Borra los que ya no están.
  for (const e of existentes) {
    if (!idsConservados.has(e.id)) await eliminarJustificante(e.id)
  }
  // Crea o actualiza el resto.
  for (const b of borradores) {
    if (b.idExistente) {
      await actualizarJustificante(b.idExistente, {
        rutaConvencional: b.rutaConvencional,
        tipoDocumento: b.tipoDocumento,
        referenciaExterna: b.referenciaExterna ?? '',
        notas: b.notas ?? '',
        // Solo se reescribe el fichero/hash si se adjuntó uno nuevo en esta sesión.
        ...(b.fichero ? { fichero: b.fichero, hashSHA256: b.hashSHA256 } : {}),
      })
    } else {
      await crearJustificante({
        apunteUid,
        rutaConvencional: b.rutaConvencional,
        tipoDocumento: b.tipoDocumento,
        ...(b.hashSHA256 ? { hashSHA256: b.hashSHA256 } : {}),
        ...(b.fichero ? { fichero: b.fichero } : {}),
        ...(b.referenciaExterna ? { referenciaExterna: b.referenciaExterna } : {}),
        ...(b.notas ? { notas: b.notas } : {}),
      })
    }
  }
}

interface Props {
  tipo: TipoOperacion
  conKyc: boolean
  value: BorradorJustificante[]
  onChange: (borradores: BorradorJustificante[]) => void
}

export function SeccionJustificantes({ tipo, conKyc, value, onChange }: Props) {
  const requisitos = useMemo(() => requisitosAplicables(tipo, conKyc), [tipo, conKyc])
  const cubiertas = useMemo(() => new Set(value.map((b) => b.tipoDocumento)), [value])

  const espacioSesion = value.reduce((acc, b) => acc + (b.tamano ?? 0), 0)

  const actualizar = (i: number, parcial: Partial<BorradorJustificante>) =>
    onChange(value.map((b, j) => (j === i ? { ...b, ...parcial } : b)))

  const quitar = (i: number) => onChange(value.filter((_, j) => j !== i))

  const anadir = (clavePreseleccionada?: string) => {
    // Sugiere la primera clave de requisito no cubierta si no se indica una.
    const primeraLibre = requisitos.find((r) => !cubiertas.has(r.clave))?.clave
    onChange([
      ...value,
      {
        rutaConvencional: RUTA_POR_TIPO[tipo],
        tipoDocumento: clavePreseleccionada ?? primeraLibre ?? CLAVE_OTROS,
      },
    ])
  }

  const adjuntar = async (i: number, file: File) => {
    // Calcula el SHA-256 en el navegador (integridad probatoria).
    const hash = await sha256HexDeBlob(file)
    actualizar(i, {
      fichero: file,
      nombreFichero: file.name,
      tamano: file.size,
      hashSHA256: hash,
      // Al adjuntar un fichero, la referencia externa deja de tener sentido.
      referenciaExterna: undefined,
    })
  }

  return (
    <fieldset className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <legend className="px-1 text-sm font-medium">Justificantes (Archivo)</legend>

      {/* Checklist probatoria del tipo */}
      <div className="mb-3 rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-900/60">
        <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">
          Documentos que pide este tipo {conKyc ? '(ubicación con KYC)' : '(ubicación sin KYC)'}:
        </p>
        <ul className="space-y-0.5">
          {requisitos.map((r) => {
            const ok = cubiertas.has(r.clave)
            return (
              <li key={r.clave} className="flex items-start gap-1.5">
                <span aria-hidden className={ok ? 'text-green-600' : 'text-slate-400'}>
                  {ok ? '✓' : '○'}
                </span>
                <span className={ok ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}>
                  <span className="font-medium">{r.documento}</span>
                  {!ok && (
                    <button
                      type="button"
                      onClick={() => anadir(r.clave)}
                      className="ml-2 text-brand-600 underline hover:text-brand-700 dark:text-amber-400"
                    >
                      añadir
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Lista de justificantes */}
      <div className="space-y-2">
        {value.map((b, i) => (
          <div key={i} className="rounded-md border border-slate-200 p-2 dark:border-slate-800">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-0.5 block text-slate-500">Documento</span>
                <select
                  className={INPUT}
                  value={b.tipoDocumento}
                  onChange={(e) => actualizar(i, { tipoDocumento: e.target.value })}
                  aria-label="Tipo de documento"
                >
                  {requisitos.map((r) => (
                    <option key={r.clave} value={r.clave}>
                      {r.documento}
                    </option>
                  ))}
                  <option value={CLAVE_OTROS}>Otro documento</option>
                </select>
              </label>
              <label className="block text-xs">
                <span className="mb-0.5 block text-slate-500">Carpeta</span>
                <select
                  className={INPUT}
                  value={b.rutaConvencional}
                  onChange={(e) => actualizar(i, { rutaConvencional: e.target.value as RutaConvencional })}
                  aria-label="Carpeta convencional"
                >
                  {CARPETAS_ARCHIVO.map((c) => (
                    <option key={c.ruta} value={c.ruta}>
                      {c.ruta} · {c.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Fichero adjunto o referencia externa */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {b.fichero ? (
                <span className="inline-flex items-center gap-2 rounded bg-green-50 px-2 py-1 text-green-800 dark:bg-green-950/40 dark:text-green-300">
                  📎 {b.nombreFichero ?? 'fichero'} · {fmtBytes(b.tamano)}
                  <button
                    type="button"
                    onClick={() => actualizar(i, { fichero: undefined, nombreFichero: undefined, tamano: undefined, hashSHA256: undefined })}
                    className="opacity-70 hover:opacity-100"
                    aria-label="Quitar fichero"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <label className={`${BTN_SEC} cursor-pointer`}>
                  Adjuntar fichero…
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) void adjuntar(i, f)
                    }}
                  />
                </label>
              )}
              {!b.fichero && (
                <input
                  className={`${INPUT} flex-1`}
                  placeholder="…o referencia externa (ruta, URL local, nº de expediente)"
                  aria-label="Referencia externa"
                  value={b.referenciaExterna ?? ''}
                  onChange={(e) => actualizar(i, { referenciaExterna: e.target.value })}
                />
              )}
              <button type="button" className="ml-auto text-red-600 hover:underline" onClick={() => quitar(i)}>
                Quitar
              </button>
            </div>

            {b.hashSHA256 && (
              <p className="mt-1 break-all font-mono text-[10px] text-slate-400" title="SHA-256">
                SHA-256: {b.hashSHA256}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button type="button" className={BTN_SEC} onClick={() => anadir()}>
          + Añadir justificante
        </button>
        {espacioSesion > 0 && (
          <span className="text-xs text-slate-500">
            Ficheros de este apunte: {fmtBytes(espacioSesion)} (se guardan en tu navegador).
          </span>
        )}
      </div>
    </fieldset>
  )
}
