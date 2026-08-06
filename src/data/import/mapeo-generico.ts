/**
 * mapeo-generico.ts — mapeo del CSV genérico del taller al dominio (P4, punto 3).
 *
 * Es la ÚNICA fuente del mapeo de tipos del CSV genérico (antes solo documentado en el
 * comentario de tests/golden/mini-caso.ts). Aquí vive como constante y como función de
 * transformación pura, para que el importador y los golden compartan un mismo criterio.
 *
 * MAPEO DE TIPOS (idéntico al de mini-caso.ts):
 *   compra→COMPRA · venta→VENTA · permuta→PERMUTA · staking→RENDIMIENTO ·
 *   interes_lending→RENDIMIENTO · mineria→MINERÍA · airdrop→AIRDROP · robo→PÉRDIDA ·
 *   pago→PAGO · donacion→DONACIÓN ·
 *   retirada_cripto + deposito_cripto (mismo activo, cercanos) → UN solo TRANSFERENCIA ·
 *   deposito_fiat / retirada_fiat → entrada/salida de EUR desde/hacia EXTERIOR (TRANSFERENCIA).
 *
 * Pura y determinista (sin CSV, sin browser APIs): recibe filas ya parseadas y devuelve
 * apuntes de dominio en orden cronológico con correlativo AAAA-NNN, más un informe.
 */

import {
  type Apunte,
  type TipoOperacion,
  UBICACION_EXTERIOR,
} from '../../engine/types'
import { fechaTextoAISO, aDecimalDominio } from './formatos'

// ────────────────────────────────────────────────────────────────────────────
// Fila genérica (una línea del CSV del taller, ya troceada en campos)
// ────────────────────────────────────────────────────────────────────────────

/** Campos del CSV genérico del taller (docs/reference/mini_caso_generico.csv). */
export interface FilaGenerica {
  fecha: string
  hora: string
  tipo: string
  plataforma: string
  activo_recibido: string
  cantidad_recibida: string
  activo_entregado: string
  cantidad_entregada: string
  comision: string
  moneda_comision: string
  descripcion: string
}

/** Cabeceras esperadas del CSV genérico, en orden. */
export const CABECERAS_GENERICO: readonly (keyof FilaGenerica)[] = [
  'fecha', 'hora', 'tipo', 'plataforma',
  'activo_recibido', 'cantidad_recibida', 'activo_entregado', 'cantidad_entregada',
  'comision', 'moneda_comision', 'descripcion',
]

// ────────────────────────────────────────────────────────────────────────────
// Mapeo de tipos del CSV genérico → catálogo cerrado del dominio
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tipos que ENTRAN sin salida, desde EXTERIOR (abren lote, sin hecho de transmisión).
 * staking e interes_lending son RENDIMIENTO; minería y airdrop, sus propios tipos.
 */
const ENTRADA_FRONTERA: Record<string, TipoOperacion> = {
  staking: 'RENDIMIENTO',
  interes_lending: 'RENDIMIENTO',
  mineria: 'MINERIA',
  airdrop: 'AIRDROP',
}

/**
 * MAPEO_TIPO_GENERICO — tipo del CSV genérico → TipoOperacion del dominio.
 * Incluye los directos y los que exigen tratamiento especial de dirección/casación
 * (marcados: su tipo de dominio es TRANSFERENCIA salvo robo→PÉRDIDA).
 */
export const MAPEO_TIPO_GENERICO: Readonly<Record<string, TipoOperacion>> = {
  compra: 'COMPRA',
  venta: 'VENTA',
  permuta: 'PERMUTA',
  pago: 'PAGO',
  donacion: 'DONACION',
  ...ENTRADA_FRONTERA,
  robo: 'PERDIDA',
  deposito_fiat: 'TRANSFERENCIA',
  retirada_fiat: 'TRANSFERENCIA',
  retirada_cripto: 'TRANSFERENCIA',
  deposito_cripto: 'TRANSFERENCIA',
}

// ────────────────────────────────────────────────────────────────────────────
// Informe de importación
// ────────────────────────────────────────────────────────────────────────────

/** Motivo por el que una fila se rechazó (con su nº de línea, 1-based del CSV). */
export interface FilaRechazada {
  fila: number
  motivo: string
}

/** Informe de una importación (aceptadas, rechazadas y avisos). */
export interface InformeImport {
  filasAceptadas: number
  filasRechazadas: FilaRechazada[]
  avisos: string[]
  /** Filas de ejemplo detectadas («EJEMPLO — borrar»). */
  ejemplosDetectados: number
}

/** Resultado del mapeo genérico: apuntes de dominio + ubicaciones/activos descubiertos. */
export interface ResultadoMapeoGenerico {
  apuntes: Apunte[]
  /** Nombres de plataforma vistos (candidatas a ubicación). */
  plataformas: string[]
  /** Símbolos de activo vistos (para dar de alta en el catálogo si faltan). */
  activos: string[]
  informe: InformeImport
}

// ────────────────────────────────────────────────────────────────────────────
// Transformación
// ────────────────────────────────────────────────────────────────────────────

/** Apunte «a medio construir»: sin correlativo (se asigna al final, por fecha). */
type ApunteSinId = Omit<Apunte, 'id'> & { _fila: number }

const DOS_DIAS_MS = 2 * 86_400_000

/**
 * Convierte filas del CSV genérico en apuntes de dominio, en orden cronológico y con
 * correlativo AAAA-NNN por año. Casa automáticamente cada `retirada_cripto` con su
 * `deposito_cripto` (mismo activo, fechas cercanas) en una única TRANSFERENCIA; los
 * que no casan quedan como transferencia de una sola pata y se avisa para revisión.
 *
 * `filaBase` es el nº de línea del CSV de la PRIMERA fila de datos (para el informe:
 * normalmente 2, si la línea 1 es la cabecera).
 */
export function mapearFilasGenericas(
  filas: readonly FilaGenerica[],
  filaBase = 2,
): ResultadoMapeoGenerico {
  const informe: InformeImport = {
    filasAceptadas: 0,
    filasRechazadas: [],
    avisos: [],
    ejemplosDetectados: 0,
  }
  const plataformas = new Set<string>()
  const activos = new Set<string>()
  const registrarActivo = (a?: string) => {
    if (a && a.trim() !== '') activos.add(a.trim())
  }

  const construidos: ApunteSinId[] = []
  // Piernas de cripto pendientes de casar.
  const retiradas: Array<{ fila: number; f: FilaGenerica; fechaHora: string }> = []
  const depositos: Array<{ fila: number; f: FilaGenerica; fechaHora: string }> = []

  filas.forEach((f, i) => {
    const nFila = filaBase + i
    const tipoCsv = f.tipo.trim().toLowerCase()
    if (tipoCsv === '') {
      informe.filasRechazadas.push({ fila: nFila, motivo: 'Sin tipo de operación.' })
      return
    }
    const fechaHora = fechaTextoAISO(f.fecha, f.hora)
    if (!fechaHora) {
      informe.filasRechazadas.push({ fila: nFila, motivo: `Fecha no reconocida: «${f.fecha} ${f.hora}».` })
      return
    }

    // Las piernas de cripto se aparcan para la casación (segunda pasada).
    if (tipoCsv === 'retirada_cripto') {
      retiradas.push({ fila: nFila, f, fechaHora })
      return
    }
    if (tipoCsv === 'deposito_cripto') {
      depositos.push({ fila: nFila, f, fechaHora })
      return
    }

    const tipo = MAPEO_TIPO_GENERICO[tipoCsv]
    if (!tipo) {
      informe.filasRechazadas.push({ fila: nFila, motivo: `Tipo desconocido: «${f.tipo}».` })
      return
    }
    if (f.plataforma.trim() !== '') plataformas.add(f.plataforma.trim())
    registrarActivo(f.activo_recibido)
    registrarActivo(f.activo_entregado)
    registrarActivo(f.moneda_comision)

    construidos.push(construirDirecto(tipoCsv, tipo, f, fechaHora, nFila))
  })

  // ── Casación retirada_cripto ↔ deposito_cripto ──────────────────────────────
  const depDisponibles = depositos.map((d) => ({ ...d, usado: false }))
  for (const ret of retiradas) {
    plataformas.add(ret.f.plataforma.trim())
    registrarActivo(ret.f.activo_entregado)
    registrarActivo(ret.f.moneda_comision)
    const activo = ret.f.activo_entregado.trim()
    const tRet = new Date(ret.fechaHora).getTime()
    // Candidato: mismo activo, no usado, fecha en ventana de ±2 días, el más cercano.
    let mejor: (typeof depDisponibles)[number] | undefined
    let mejorDist = Infinity
    for (const dep of depDisponibles) {
      if (dep.usado) continue
      if (dep.f.activo_recibido.trim() !== activo) continue
      const dist = Math.abs(new Date(dep.fechaHora).getTime() - tRet)
      if (dist <= DOS_DIAS_MS && dist < mejorDist) { mejor = dep; mejorDist = dist }
    }
    if (mejor) {
      mejor.usado = true
      plataformas.add(mejor.f.plataforma.trim())
      registrarActivo(mejor.f.activo_recibido)
      construidos.push(construirTransferenciaCripto(ret, mejor, ret.fila))
    } else {
      // No casa: transferencia de una sola pata (salida a EXTERIOR) + aviso.
      informe.avisos.push(
        `Línea ${ret.fila}: retirada de ${activo} sin depósito casado; importada como ` +
          'transferencia de una sola pata. Revisar y casar a mano.',
      )
      construidos.push(construirCriptoUnaPata('retirada', ret.f, ret.fechaHora, ret.fila))
    }
  }
  // Depósitos que quedaron sin retirada.
  for (const dep of depDisponibles) {
    if (dep.usado) continue
    plataformas.add(dep.f.plataforma.trim())
    registrarActivo(dep.f.activo_recibido)
    informe.avisos.push(
      `Línea ${dep.fila}: depósito de ${dep.f.activo_recibido.trim()} sin retirada casada; ` +
        'importado como transferencia de una sola pata. Revisar y casar a mano.',
    )
    construidos.push(construirCriptoUnaPata('deposito', dep.f, dep.fechaHora, dep.fila))
  }

  // ── Orden cronológico estable + correlativo AAAA-NNN por año ────────────────
  const ordenados = [...construidos].sort((a, b) => {
    const ta = new Date(a.fechaHora).getTime()
    const tb = new Date(b.fechaHora).getTime()
    if (ta !== tb) return ta - tb
    return a._fila - b._fila // desempate: orden original del CSV
  })
  const contadorPorAnio = new Map<number, number>()
  const apuntes: Apunte[] = ordenados.map((a) => {
    const anio = new Date(a.fechaHora).getFullYear()
    const n = (contadorPorAnio.get(anio) ?? 0) + 1
    contadorPorAnio.set(anio, n)
    const { _fila, ...resto } = a
    return { ...resto, id: `${anio}-${String(n).padStart(3, '0')}` }
  })

  informe.filasAceptadas = apuntes.length
  return {
    apuntes,
    plataformas: [...plataformas],
    activos: [...activos],
    informe,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Constructores por forma de operación
// ────────────────────────────────────────────────────────────────────────────

/** Comisión (cantidad + activo) tal cual viene, si la hay. */
function comisionDe(f: FilaGenerica): Pick<Apunte, 'comisionCantidad' | 'comisionActivo'> {
  const cant = aDecimalDominio(f.comision)
  const activo = f.moneda_comision.trim()
  if (cant === undefined || activo === '') return {}
  return { comisionCantidad: cant, comisionActivo: activo }
}

/** Contravalor EUR derivable: la pierna en EUR de una compra/venta/pago. */
function contravalorDerivado(f: FilaGenerica): string | undefined {
  if (f.activo_entregado.trim() === 'EUR') return aDecimalDominio(f.cantidad_entregada)
  if (f.activo_recibido.trim() === 'EUR') return aDecimalDominio(f.cantidad_recibida)
  return undefined
}

function limpio(s: string): string | undefined {
  const t = s.trim()
  return t === '' ? undefined : t
}

/** Construye un apunte de un tipo «directo» (no cripto-casado). */
function construirDirecto(
  tipoCsv: string,
  tipo: TipoOperacion,
  f: FilaGenerica,
  fechaHora: string,
  fila: number,
): ApunteSinId {
  const plataforma = f.plataforma.trim()
  const notas = limpio(f.descripcion)
  const base: ApunteSinId = {
    _fila: fila,
    fechaHora,
    tipo,
    ubicacionOrigen: plataforma,
    ubicacionDestino: plataforma,
    ...(notas ? { notas } : {}),
  }

  // Entrada desde la frontera (rendimiento, minería, airdrop): entra sin salir.
  if (tipoCsv in ENTRADA_FRONTERA) {
    return {
      ...base,
      ubicacionOrigen: UBICACION_EXTERIOR,
      ubicacionDestino: plataforma,
      activoEntrada: f.activo_recibido.trim(),
      cantidadEntrada: aDecimalDominio(f.cantidad_recibida) ?? '0',
      ...contravalorContra(f),
      ...comisionDe(f),
    }
  }

  switch (tipoCsv) {
    case 'deposito_fiat': // entra EUR desde EXTERIOR
      return {
        ...base,
        ubicacionOrigen: UBICACION_EXTERIOR,
        ubicacionDestino: plataforma,
        activoEntrada: f.activo_recibido.trim(),
        cantidadEntrada: aDecimalDominio(f.cantidad_recibida) ?? '0',
        ...comisionDe(f),
      }
    case 'retirada_fiat': // sale EUR hacia EXTERIOR
      return {
        ...base,
        ubicacionOrigen: plataforma,
        ubicacionDestino: UBICACION_EXTERIOR,
        activoSalida: f.activo_entregado.trim(),
        cantidadSalida: aDecimalDominio(f.cantidad_entregada) ?? '0',
        ...comisionDe(f),
      }
    case 'robo': // PÉRDIDA: sale cripto hacia EXTERIOR, sin contraprestación (0)
      return {
        ...base,
        ubicacionOrigen: plataforma,
        ubicacionDestino: UBICACION_EXTERIOR,
        activoSalida: f.activo_entregado.trim(),
        cantidadSalida: aDecimalDominio(f.cantidad_entregada) ?? '0',
        contravalorEUR: '0',
        ...comisionDe(f),
      }
    default: {
      // compra, venta, permuta, pago, donacion: dos piernas dentro de la plataforma.
      const contravalor = contravalorDerivado(f)
      return {
        ...base,
        activoSalida: limpio(f.activo_entregado),
        cantidadSalida: aDecimalDominio(f.cantidad_entregada),
        activoEntrada: limpio(f.activo_recibido),
        cantidadEntrada: aDecimalDominio(f.cantidad_recibida),
        ...(contravalor !== undefined ? { contravalorEUR: contravalor } : {}),
        ...comisionDe(f),
      }
    }
  }
}

/** Contravalor de una entrada de frontera (no derivable del CSV genérico: se deja vacío). */
function contravalorContra(_f: FilaGenerica): Partial<Apunte> {
  // El CSV genérico no trae valor de mercado en EUR para rendimientos/minería/airdrop.
  // Se deja sin contravalor; el alumno lo aporta luego (ver COTEJO_F1 / mini-caso.ts).
  return {}
}

/** Fusiona una retirada_cripto y su deposito_cripto casado en una TRANSFERENCIA. */
function construirTransferenciaCripto(
  ret: { fila: number; f: FilaGenerica; fechaHora: string },
  dep: { fila: number; f: FilaGenerica; fechaHora: string },
  fila: number,
): ApunteSinId {
  const notas = limpio(ret.f.descripcion) ?? limpio(dep.f.descripcion)
  return {
    _fila: fila,
    fechaHora: ret.fechaHora, // el envío inicia la transferencia
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: ret.f.plataforma.trim(),
    ubicacionDestino: dep.f.plataforma.trim(),
    activoSalida: ret.f.activo_entregado.trim(),
    cantidadSalida: aDecimalDominio(ret.f.cantidad_entregada) ?? '0',
    activoEntrada: dep.f.activo_recibido.trim(),
    cantidadEntrada: aDecimalDominio(dep.f.cantidad_recibida) ?? '0',
    ...comisionDe(ret.f),
    ...(notas ? { notas } : {}),
  }
}

/** Cripto sin pareja: transferencia de una sola pata (origen→EXTERIOR o EXTERIOR→destino). */
function construirCriptoUnaPata(
  sentido: 'retirada' | 'deposito',
  f: FilaGenerica,
  fechaHora: string,
  fila: number,
): ApunteSinId {
  const notas = limpio(f.descripcion)
  const plataforma = f.plataforma.trim()
  if (sentido === 'retirada') {
    return {
      _fila: fila,
      fechaHora,
      tipo: 'TRANSFERENCIA',
      ubicacionOrigen: plataforma,
      ubicacionDestino: UBICACION_EXTERIOR,
      activoSalida: f.activo_entregado.trim(),
      cantidadSalida: aDecimalDominio(f.cantidad_entregada) ?? '0',
      ...comisionDe(f),
      ...(notas ? { notas } : {}),
    }
  }
  return {
    _fila: fila,
    fechaHora,
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: plataforma,
    activoEntrada: f.activo_recibido.trim(),
    cantidadEntrada: aDecimalDominio(f.cantidad_recibida) ?? '0',
    ...comisionDe(f),
    ...(notas ? { notas } : {}),
  }
}
