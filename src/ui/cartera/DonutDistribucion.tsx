/**
 * DonutDistribucion.tsx — donut SVG propio (sin dependencias) de la distribución por activo.
 *
 * Radio exterior 66 / interior 44, separación ≈2px entre segmentos, total en el centro.
 * Tooltip al pasar el ratón (nombre · valor · %). Colores fijos por entidad (los trae cada
 * segmento). La leyenda se dibuja aparte en la página (etiquetado directo).
 */
import { useState } from 'react'

/** Un segmento del donut. */
export interface SegmentoDonut {
  label: string
  /** Valor en EUR (número, solo para el ángulo; el importe exacto va en `valorTexto`). */
  valor: number
  valorTexto: string
  pct: number
  color: string
}

const CX = 72
const CY = 72
const R_EXT = 66
const R_INT = 44
/** Separación angular entre segmentos (≈2px de superficie sobre el radio exterior). */
const GAP = 2 / R_EXT

function polar(r: number, ang: number): [number, number] {
  return [CX + r * Math.cos(ang), CY + r * Math.sin(ang)]
}

/** Path de un sector anular entre los ángulos a0 y a1 (radianes). */
function sectorPath(a0: number, a1: number): string {
  const grande = a1 - a0 > Math.PI ? 1 : 0
  const [x0o, y0o] = polar(R_EXT, a0)
  const [x1o, y1o] = polar(R_EXT, a1)
  const [x1i, y1i] = polar(R_INT, a1)
  const [x0i, y0i] = polar(R_INT, a0)
  return (
    `M ${x0o} ${y0o} A ${R_EXT} ${R_EXT} 0 ${grande} 1 ${x1o} ${y1o} ` +
    `L ${x1i} ${y1i} A ${R_INT} ${R_INT} 0 ${grande} 0 ${x0i} ${y0i} Z`
  )
}

export function DonutDistribucion({
  segmentos,
  totalTexto,
}: {
  segmentos: SegmentoDonut[]
  totalTexto: string
}) {
  const [activo, setActivo] = useState<number | null>(null)
  const total = segmentos.reduce((acc, s) => acc + Math.max(0, s.valor), 0)

  // Un solo segmento (o el resto a cero): anillo completo, que el path de arco no dibuja.
  const unico = segmentos.length === 1 || (total > 0 && segmentos.filter((s) => s.valor > 0).length === 1)

  let ang = -Math.PI / 2 // empieza arriba
  const arcos = segmentos.map((s, i) => {
    const frac = total > 0 ? Math.max(0, s.valor) / total : 0
    const barrido = frac * (Math.PI * 2)
    const a0 = ang + (frac > 0 ? GAP / 2 : 0)
    const a1 = ang + barrido - (frac > 0 ? GAP / 2 : 0)
    ang += barrido
    return { s, i, d: a1 > a0 ? sectorPath(a0, a1) : '' }
  })

  const sel = activo !== null ? segmentos[activo] : null

  return (
    <div className="relative">
      <svg viewBox="0 0 144 144" className="mx-auto block h-40 w-40" role="img" aria-label="Distribución de la cartera por activo">
        {unico ? (
          <circle
            cx={CX}
            cy={CY}
            r={(R_EXT + R_INT) / 2}
            fill="none"
            stroke={segmentos.find((s) => s.valor > 0)?.color ?? '#8a857e'}
            strokeWidth={R_EXT - R_INT}
          />
        ) : (
          arcos.map(({ s, i, d }) =>
            d ? (
              <path
                key={s.label}
                d={d}
                fill={s.color}
                opacity={activo === null || activo === i ? 1 : 0.4}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                className="cursor-default transition-opacity"
              >
                <title>{`${s.label} · ${s.valorTexto} · ${s.pct.toFixed(1).replace('.', ',')} %`}</title>
              </path>
            ) : null,
          )
        )}
        <text x={CX} y={CY - 4} textAnchor="middle" className="fill-stone-500 text-[8px]">
          Total
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" className="fill-stone-900 text-[10px] font-bold">
          {totalTexto}
        </text>
      </svg>

      {sel && (
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-max rounded-md bg-stone-900 px-2 py-1 text-center text-xs text-white shadow">
          <span className="font-semibold">{sel.label}</span> · {sel.valorTexto} ·{' '}
          {sel.pct.toFixed(1).replace('.', ',')} %
        </div>
      )}
    </div>
  )
}
