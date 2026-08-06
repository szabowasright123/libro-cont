/**
 * SelloKyc.tsx — sello visual discreto KYC / no-KYC (P6).
 *
 * Distintivo pequeño y no invasivo para marcar el origen de una operación (DIARIO) o de una
 * porción de saldo (cartera por origen / SALDOS). Presentación pura: la lógica de origen
 * vive en el motor (`engine/trazabilidad`).
 */
import type { Origen } from '../../engine/trazabilidad'

/** Configuración visual por condición KYC. */
const CONFIG = {
  kyc: {
    texto: 'KYC',
    icono: '🛡',
    titulo: 'Origen con KYC (vía identificada)',
    clases:
      'border-green-300 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300',
  },
  noKyc: {
    texto: 'no-KYC',
    icono: '△',
    titulo: 'Origen sin KYC (vía no identificada)',
    clases:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
  },
} as const

/**
 * Sello discreto KYC / no-KYC. `soloIcono` lo reduce a un punto con el icono (para tablas
 * densas como el DIARIO); en su forma normal muestra icono + texto.
 */
export function SelloKyc({
  kyc,
  soloIcono = false,
  titulo,
}: {
  kyc: boolean
  soloIcono?: boolean
  titulo?: string
}) {
  const c = kyc ? CONFIG.kyc : CONFIG.noKyc
  if (soloIcono) {
    return (
      <span
        title={titulo ?? c.titulo}
        aria-label={c.titulo}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${c.clases}`}
      >
        <span aria-hidden>{c.icono}</span>
      </span>
    )
  }
  return (
    <span
      title={titulo ?? c.titulo}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${c.clases}`}
    >
      <span aria-hidden>{c.icono}</span>
      {c.texto}
    </span>
  )
}

/** Sello a partir del tipo de origen del motor (`'KYC'` | `'NO_KYC'`). */
export function SelloOrigen({ origen, soloIcono }: { origen: Origen; soloIcono?: boolean }) {
  return <SelloKyc kyc={origen === 'KYC'} soloIcono={soloIcono} />
}
