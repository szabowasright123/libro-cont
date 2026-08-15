/**
 * InformeCadena.tsx — vista en pantalla del informe «¿cómo demuestro este saldo?».
 *
 * Renderiza la `CadenaProbatoria` (motor) como una lista de ramas (parcelas) con su cadena
 * de eslabones hacia atrás; cada eslabón muestra su papel, estado probatorio, justificantes
 * y huecos. La versión imprimible/exportable la genera `informeHtml.ts`. Presentación pura.
 */
import type {
  CadenaProbatoria,
  EslabonProbatorio,
  RamaProbatoria,
} from '../../engine/trazabilidad'
import type { RefUbicacion } from '../../engine/types'
import { ETIQUETA_TIPO } from '../../engine/types'
import { fmtDecimal, fmtFecha } from '../formato'
import { BadgeEstadoProbatorio } from '../archivo/EstadoProbatorio'
import { SelloOrigen } from './SelloKyc'

const PAPEL: Record<EslabonProbatorio['papel'], string> = {
  adquisicion: 'Adquisición',
  transferencia: 'Transferencia',
  otro: 'Movimiento',
}

/** Un eslabón de la cadena: un apunte con su prueba (o su hueco). */
function Eslabon({
  eslabon,
  nombreUbic,
}: {
  eslabon: EslabonProbatorio
  nombreUbic: (r: RefUbicacion) => string
}) {
  if (eslabon.huerfano || !eslabon.apunte) {
    return (
      <li className="border-l-2 border-red-400 pl-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            Eslabón roto
          </span>
          <span className="font-mono text-xs text-slate-400">{eslabon.apunteId}</span>
          <span className="text-xs text-slate-500">el apunte ya no existe en el diario</span>
        </div>
      </li>
    )
  }
  const ap = eslabon.apunte
  return (
    <li className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {PAPEL[eslabon.papel]}
        </span>
        <span className="font-mono text-xs text-slate-400">{ap.id}</span>
        <span className="font-medium">{ETIQUETA_TIPO[ap.tipo]}</span>
        <span className="text-xs text-slate-500">{fmtFecha(ap.fechaHora)}</span>
        <span className="text-xs text-slate-500">
          {nombreUbic(ap.ubicacionOrigen)} → {nombreUbic(ap.ubicacionDestino)}
        </span>
        <BadgeEstadoProbatorio estado={eslabon.estado} />
      </div>

      {eslabon.justificantes.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-1 text-xs text-slate-600 dark:text-slate-300">
          {eslabon.justificantes.map((j) => (
            <li key={j.id}>
              📎 <strong>{j.tipoDocumento}</strong>{' '}
              {j.fichero
                ? '(fichero adjunto)'
                : j.referenciaExterna
                  ? `(ref.: ${j.referenciaExterna})`
                  : '(sin fichero ni referencia)'}
            </li>
          ))}
        </ul>
      )}

      {eslabon.faltantes.length > 0 && (
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          <span className="font-medium">Huecos:</span>{' '}
          {eslabon.faltantes.map((f) => f.documento).join(' · ')}
        </div>
      )}
    </li>
  )
}

/** Una rama de la cadena: una parcela viva y su cadena de eslabones. */
function Rama({
  rama,
  indice,
  activo,
  nombreUbic,
}: {
  rama: RamaProbatoria
  indice: number
  activo: string
  nombreUbic: (r: RefUbicacion) => string
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
        Parcela {indice + 1} · <span className="tabular-nums">{fmtDecimal(rama.cantidad)} {activo}</span>
        <SelloOrigen origen={rama.origen} />
        {rama.eslabonesConHueco > 0 && (
          <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {rama.eslabonesConHueco} hueco(s)
          </span>
        )}
      </h3>
      <ol className="space-y-2">
        {rama.eslabones.map((e, i) => (
          <Eslabon key={`${e.apunteId}-${i}`} eslabon={e} nombreUbic={nombreUbic} />
        ))}
      </ol>
    </section>
  )
}

/** Informe completo en pantalla: reparto KYC/no-KYC + una rama por parcela. */
export function InformeCadena({
  cadena,
  nombreUbic,
}: {
  cadena: CadenaProbatoria
  nombreUbic: (r: RefUbicacion) => string
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-xs text-stone-700 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-300">
          KYC: {fmtDecimal(cadena.kyc)} {cadena.activo}
        </span>
        <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          no-KYC: {fmtDecimal(cadena.noKyc)} {cadena.activo}
        </span>
        <span className="text-xs text-slate-500">
          {cadena.ramas.length} parcela(s) · {cadena.huecos} hueco(s) probatorio(s)
        </span>
      </div>

      {cadena.deficit && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          ⚠ Alguna salida de esta ubicación no tuvo origen suficiente registrado (saldo negativo).
          Revisa el diario.
        </p>
      )}

      {cadena.ramas.length === 0 ? (
        <p className="text-sm text-slate-400">
          Este saldo no tiene parcelas vivas (saldo cero o sin movimientos registrados).
        </p>
      ) : (
        cadena.ramas.map((r, i) => (
          <Rama key={`${r.loteApunteId}-${i}`} rama={r} indice={i} activo={cadena.activo} nombreUbic={nombreUbic} />
        ))
      )}

      <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
        Documento orientativo. El reparto KYC/no-KYC sigue la convención de
        propagación del proyecto (D1), validada fiscalmente el 8-8-2026. Es el índice del expediente que
        reúne los justificantes del saldo, no una prueba por sí mismo.
      </p>
    </div>
  )
}
