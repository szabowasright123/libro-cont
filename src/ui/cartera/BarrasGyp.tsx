/**
 * BarrasGyp.tsx — barras SVG propias (sin dependencias) de la GyP realizada por ejercicio.
 *
 * Barras finas (~54px), extremo redondeado 4px anclado a la línea de base, eje cero visible.
 * Ganancia = naranja #e8820c, pérdida = azul #2a78d6 (par cálido/frío seguro para daltonismo;
 * aquí NO se usa verde/rojo). Etiqueta directa con signo sobre/bajo cada barra. Tooltip por barra.
 */
import { fmtEuro } from '../formato'
import { COLOR_GANANCIA, COLOR_PERDIDA, type GypEjercicio } from './valoracion'

const ANCHO_BARRA = 54
const HUECO = 26
const ALTO = 180
const PAD_SUP = 26 // margen para la etiqueta de las ganancias
const PAD_INF = 34 // margen para el año + etiqueta de las pérdidas
const ALTO_UTIL = ALTO - PAD_SUP - PAD_INF

export function BarrasGyp({ datos }: { datos: GypEjercicio[] }) {
  const valores = datos.map((d) => Number(d.netoEUR))
  const max = Math.max(0, ...valores)
  const min = Math.min(0, ...valores)
  const rango = max - min || 1
  const cero = PAD_SUP + (max / rango) * ALTO_UTIL // y de la línea base (valor 0)

  const ancho = Math.max(datos.length * (ANCHO_BARRA + HUECO) + HUECO, ANCHO_BARRA + 2 * HUECO)

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        className="h-48"
        style={{ width: ancho }}
        role="img"
        aria-label="Ganancias y pérdidas realizadas por ejercicio"
      >
        {/* Eje cero. */}
        <line x1={0} y1={cero} x2={ancho} y2={cero} stroke="#d6d3d1" strokeWidth={1} />

        {datos.map((d, i) => {
          const v = Number(d.netoEUR)
          const ganancia = v >= 0
          const x = HUECO + i * (ANCHO_BARRA + HUECO)
          const alturaBarra = (Math.abs(v) / rango) * ALTO_UTIL
          const y = ganancia ? cero - alturaBarra : cero
          const color = ganancia ? COLOR_GANANCIA : COLOR_PERDIDA
          const etiquetaY = ganancia ? y - 6 : y + alturaBarra + 14
          const signo = v > 0 ? '+' : ''
          return (
            <g key={d.ejercicio}>
              <rect
                x={x}
                y={y}
                width={ANCHO_BARRA}
                height={Math.max(alturaBarra, 1)}
                rx={4}
                fill={color}
              >
                <title>{`${d.ejercicio} · ${signo}${fmtEuro(d.netoEUR)}`}</title>
              </rect>
              {/* Etiqueta directa con signo. */}
              <text
                x={x + ANCHO_BARRA / 2}
                y={etiquetaY}
                textAnchor="middle"
                className="fill-stone-700 text-[10px] font-semibold"
              >
                {signo}
                {fmtEuro(d.netoEUR)}
              </text>
              {/* Año en la base. */}
              <text
                x={x + ANCHO_BARRA / 2}
                y={ALTO - 8}
                textAnchor="middle"
                className="fill-stone-500 text-[11px]"
              >
                {d.ejercicio}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
