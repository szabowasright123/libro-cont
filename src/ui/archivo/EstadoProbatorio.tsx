/**
 * EstadoProbatorio.tsx — presentación del estado probatorio de un apunte.
 *
 * Distintivo (badge) con semáforo probatorio (completo / incompleto / sin justificar) y
 * un ayudante que calcula el estado de todos los apuntes a partir de los registros de la
 * base. La lógica de dominio vive en el motor (`engine/archivo`); aquí solo presentación
 * y el pegamento con la capa de datos (resolución uid → correlativo).
 */
import type { EstadoProbatorio, ResultadoProbatorio } from '../../engine/archivo'
import { estadoProbatorioApunte, mapaKyc } from '../../engine/archivo'
import { aDominio, justificantesADominio } from '../../data/repositorio'
import type { ApunteRegistro, JustificanteRegistro } from '../../data/tipos'
import type { IdApunte, Ubicacion } from '../../engine/types'

/** Configuración visual de cada estado probatorio. */
const CONFIG: Record<EstadoProbatorio, { texto: string; icono: string; clases: string }> = {
  completo: {
    texto: 'Completo',
    icono: '✓',
    clases:
      'border-green-300 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300',
  },
  incompleto: {
    texto: 'Incompleto',
    icono: '◐',
    clases:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
  },
  'sin-justificar': {
    texto: 'Sin justificar',
    icono: '○',
    clases:
      'border-red-300 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
  },
}

/** Distintivo del estado probatorio de un apunte. */
export function BadgeEstadoProbatorio({
  estado,
  titulo,
}: {
  estado: EstadoProbatorio
  titulo?: string
}) {
  const c = CONFIG[estado]
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${c.clases}`}
    >
      <span aria-hidden>{c.icono}</span>
      {c.texto}
    </span>
  )
}

/**
 * Calcula el estado probatorio de cada apunte, indexado por su correlativo `id`. Recibe
 * los registros de almacenamiento (apuntes y justificantes) y las ubicaciones (para el
 * KYC), y los traduce a dominio para el motor.
 */
export function mapaEstadosProbatorios(
  registrosApuntes: readonly ApunteRegistro[],
  registrosJustificantes: readonly JustificanteRegistro[],
  ubicaciones: readonly Ubicacion[],
): Map<IdApunte, ResultadoProbatorio> {
  const apuntes = aDominio([...registrosApuntes])
  const justificantes = justificantesADominio(registrosJustificantes, registrosApuntes)
  const kyc = mapaKyc(ubicaciones)

  const porApunte = new Map<IdApunte, ReturnType<typeof justificantesADominio>>()
  for (const j of justificantes) {
    const lista = porApunte.get(j.apunteId)
    if (lista) lista.push(j)
    else porApunte.set(j.apunteId, [j])
  }

  const salida = new Map<IdApunte, ResultadoProbatorio>()
  for (const ap of apuntes) {
    salida.set(ap.id, estadoProbatorioApunte(ap, porApunte.get(ap.id) ?? [], kyc))
  }
  return salida
}
