/**
 * triaje.ts — de MOVIMIENTOS de explorador a CANDIDATOS a apunte (ENCARGO, Parte 2).
 *
 * Regla que gobierna todo este módulo: **ningún apunte entra en el Diario sin que el
 * alumno lo haya confirmado**, y **ninguna calificación fiscal se inventa por heurística**.
 * Un explorador da movimientos, no operaciones: no sabe si un envío es traslado o
 * transmisión, ni el contravalor en euros, ni a qué evento DeFi pertenece la pata.
 *
 * La ÚNICA deducción con confianza alta es la del traslado propio: si el origen y el
 * destino son ambos direcciones registradas del alumno, el movimiento es una
 * TRANSFERENCIA (traslado sin efecto fiscal). Todo lo demás se propone en blanco, con
 * sugerencias, y lo califica el alumno.
 *
 * Funciones PURAS (sin Dexie, sin React): la página de importación las orquesta.
 */
import {
  type RefUbicacion,
  type TipoOperacion,
  UBICACION_EXTERIOR,
} from '../../engine/types'
import type { BorradorApunte } from '../tipos'
import type { MovimientoExplorador } from './explorador'
import { type IndiceDirecciones, ubicacionDeDireccion } from './direcciones'

// ────────────────────────────────────────────────────────────────────────────
// 1. Marca de trazabilidad en notas (clave de deduplicación)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Marca que deja cada apunte importado en sus `notas`: `[tx:0xabc…#normal#0]`.
 *
 * Es la clave de deduplicación del modo ADITIVO (el encargo la pide sobre `txhash` +
 * índice dentro de la transacción) y viaja en un campo de texto que ya existe, así que
 * sobrevive al ciclo XLSX/CSV/JSON sin tocar el esquema ni el motor.
 */
export function marcaTx(clave: string): string {
  return `[tx:${clave}]`
}

/** Extrae las marcas `[tx:…]` presentes en un texto de notas. */
export function extraerMarcasTx(notas: string | undefined): string[] {
  if (!notas) return []
  return [...notas.matchAll(/\[tx:([^\]]+)\]/g)].flatMap((m) => (m[1] ? [m[1]] : []))
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Candidatos
// ────────────────────────────────────────────────────────────────────────────

/** Cómo de segura es la propuesta. */
export type Confianza = 'alta' | 'pendiente' | 'ajeno'

/** Un movimiento ya interpretado contra las direcciones del alumno. */
export interface CandidatoApunte {
  clave: string
  movimiento: MovimientoExplorador
  /** Tipo propuesto. Cadena vacía = pendiente de calificar por el alumno. */
  tipo: TipoOperacion | ''
  confianza: Confianza
  /** Por qué se propone eso (se muestra en la bandeja). */
  motivo: string
  ubicacionOrigen: RefUbicacion
  ubicacionDestino: RefUbicacion
  activo: string
  cantidad: string
  comisionCantidad?: string
  comisionActivo?: string
  /** Contravalor en euros: NUNCA se deduce (no hay red, y el explorador da dólares). */
  contravalorEUR?: string
  /** Tipos que tienen sentido para este movimiento (ayuda, no imposición). */
  sugerencias: TipoOperacion[]
  /** ¿Se incluirá al añadir al Diario? Lo marca el alumno; aquí solo el valor inicial. */
  incluir: boolean
}

/** Tipos que puede tener una ENTRADA de activos desde el exterior. */
export const SUGERENCIAS_ENTRADA: TipoOperacion[] = [
  'COMPRA',
  'PERMUTA',
  'RENDIMIENTO',
  'MINERIA',
  'AIRDROP',
  'TRANSFERENCIA',
]

/** Tipos que puede tener una SALIDA de activos hacia el exterior. */
export const SUGERENCIAS_SALIDA: TipoOperacion[] = [
  'VENTA',
  'PERMUTA',
  'PAGO',
  'DONACION',
  'TRANSFERENCIA',
  'PERDIDA',
]

/**
 * Interpreta un movimiento contra las direcciones registradas del alumno.
 * No consulta nada: solo compara direcciones.
 */
export function proponerCandidato(
  movimiento: MovimientoExplorador,
  indice: IndiceDirecciones,
): CandidatoApunte {
  const origenPropio = ubicacionDeDireccion(indice, movimiento.desde)
  const destinoPropio = ubicacionDeDireccion(indice, movimiento.hacia)

  // La comisión de red la paga QUIEN ENVÍA: solo se arrastra si el origen es del alumno.
  const comisionCantidad = origenPropio ? movimiento.comisionCantidad : undefined
  const comisionActivo = comisionCantidad ? movimiento.comisionActivo : undefined

  const base = {
    clave: movimiento.clave,
    movimiento,
    activo: movimiento.activo,
    cantidad: movimiento.cantidad,
    comisionCantidad,
    comisionActivo,
    contravalorEUR: undefined,
  }

  // Transacción fallida: no movió valor, solo gastó gas.
  if (movimiento.fallida) {
    return {
      ...base,
      tipo: '',
      confianza: 'pendiente',
      motivo:
        'Transacción FALLIDA: no movió valor, pero gastó gas. Decide cómo registrar ese gasto ' +
        '(el gas no es transmisión: ver el catálogo de eventos DeFi, §8).',
      ubicacionOrigen: origenPropio ?? UBICACION_EXTERIOR,
      ubicacionDestino: origenPropio ?? UBICACION_EXTERIOR,
      sugerencias: [],
      incluir: false,
    }
  }

  // Traslado propio: la única deducción con confianza alta.
  if (origenPropio && destinoPropio) {
    return {
      ...base,
      tipo: 'TRANSFERENCIA',
      confianza: 'alta',
      motivo: 'Origen y destino son direcciones tuyas: traslado entre ubicaciones propias.',
      ubicacionOrigen: origenPropio,
      ubicacionDestino: destinoPropio,
      sugerencias: SUGERENCIAS_ENTRADA,
      incluir: true,
    }
  }

  if (destinoPropio) {
    return {
      ...base,
      tipo: '',
      confianza: 'pendiente',
      motivo:
        'Entra desde una dirección que no consta como tuya: hay frontera con el exterior y ' +
        'la calificación la pones tú.',
      ubicacionOrigen: UBICACION_EXTERIOR,
      ubicacionDestino: destinoPropio,
      sugerencias: SUGERENCIAS_ENTRADA,
      incluir: true,
    }
  }

  if (origenPropio) {
    return {
      ...base,
      tipo: '',
      confianza: 'pendiente',
      motivo:
        'Sale hacia una dirección que no consta como tuya: puede ser venta, pago, permuta, ' +
        'donación… o un traslado a una wallet tuya que aún no has registrado.',
      ubicacionOrigen: origenPropio,
      ubicacionDestino: UBICACION_EXTERIOR,
      sugerencias: SUGERENCIAS_SALIDA,
      incluir: true,
    }
  }

  return {
    ...base,
    tipo: '',
    confianza: 'ajeno',
    motivo:
      'Ninguna de las dos direcciones consta como tuya. Si alguna lo es, regístrala en su ' +
      'ubicación y vuelve a importar.',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: UBICACION_EXTERIOR,
    sugerencias: [...SUGERENCIAS_ENTRADA, ...SUGERENCIAS_SALIDA],
    incluir: false,
  }
}

/** Interpreta todos los movimientos de una importación. */
export function proponerCandidatos(
  movimientos: readonly MovimientoExplorador[],
  indice: IndiceDirecciones,
): CandidatoApunte[] {
  return movimientos.map((m) => proponerCandidato(m, indice))
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Candidato → borrador de apunte
// ────────────────────────────────────────────────────────────────────────────

/** Tipos en los que el activo movido ENTRA en el patrimonio del alumno. */
const TIPOS_SOLO_ENTRADA: TipoOperacion[] = ['RENDIMIENTO', 'MINERIA', 'AIRDROP']
/** Tipos en los que el activo movido SALE del patrimonio del alumno. */
const TIPOS_SOLO_SALIDA: TipoOperacion[] = ['PAGO', 'DONACION', 'PERDIDA', 'VENTA', 'PERMUTA']

/**
 * Convierte un candidato CONFIRMADO en borrador de apunte.
 *
 * Deja deliberadamente incompletos los datos que la cadena no sabe:
 *  - **contravalor en euros**: nace vacío (sin red no hay precios y el explorador da
 *    dólares del activo nativo). La validación existente ya bloquea los tipos con
 *    alteración patrimonial que no lo traen: el alumno lo verá como pendiente.
 *  - la pata en euros de una VENTA/COMPRA: la cadena no la ve.
 *
 * Lanza si el candidato no tiene tipo: un apunte sin calificar no puede entrar.
 */
export function candidatoABorrador(c: CandidatoApunte): BorradorApunte {
  if (c.tipo === '') throw new Error('El candidato no está calificado: elige un tipo antes de añadirlo.')

  const notasBase = [
    marcaTx(c.clave),
    c.movimiento.txhash.startsWith('sin-hash') ? '' : `txhash ${c.movimiento.txhash}`,
    `importado de explorador (${c.movimiento.clase}); UTC ${c.movimiento.fechaHoraUtc}`,
    c.movimiento.fallida ? 'transacción fallida: solo gas' : '',
  ]
    .filter((t) => t !== '')
    .join(' · ')

  const borrador: BorradorApunte = {
    fechaHora: c.movimiento.fechaHora,
    tipo: c.tipo,
    ubicacionOrigen: c.ubicacionOrigen,
    ubicacionDestino: c.ubicacionDestino,
    notas: notasBase,
  }

  const hayCantidad = c.cantidad !== '' && c.cantidad !== '0'

  if (hayCantidad) {
    if (c.tipo === 'TRANSFERENCIA') {
      borrador.activoSalida = c.activo
      borrador.cantidadSalida = c.cantidad
      borrador.activoEntrada = c.activo
      borrador.cantidadEntrada = c.cantidad
    } else if (TIPOS_SOLO_ENTRADA.includes(c.tipo) || c.tipo === 'COMPRA') {
      borrador.activoEntrada = c.activo
      borrador.cantidadEntrada = c.cantidad
    } else if (TIPOS_SOLO_SALIDA.includes(c.tipo)) {
      borrador.activoSalida = c.activo
      borrador.cantidadSalida = c.cantidad
    } else {
      // AJUSTE y LIQUIDACION_DERIVADO: el alumno completa los lados a mano.
      borrador.activoEntrada = c.activo
      borrador.cantidadEntrada = c.cantidad
    }
  }

  if (c.comisionCantidad && c.comisionActivo) {
    borrador.comisionCantidad = c.comisionCantidad
    borrador.comisionActivo = c.comisionActivo
  }
  if (c.contravalorEUR) borrador.contravalorEUR = c.contravalorEUR

  return borrador
}

/** Convierte los candidatos marcados e YA calificados. Los demás se ignoran. */
export function candidatosABorradores(candidatos: readonly CandidatoApunte[]): BorradorApunte[] {
  return candidatos.filter((c) => c.incluir && c.tipo !== '').map(candidatoABorrador)
}
