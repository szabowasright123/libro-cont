/**
 * plantillas.ts — descomposición de eventos DeFi en patas del catálogo cerrado.
 *
 * Fuente de verdad: docs/DEFI_EVENTOS_COMPLEJOS.md (validado por el autor 16-08-2026).
 *
 * PRINCIPIO RECTOR (DEFI §0): un evento DeFi NO es un tipo nuevo. Se descompone en una
 * o varias PATAS, y cada pata es un apunte de uno de los 11 tipos que ya existen. Lo que
 * este módulo materializa es esa traducción, y solo esa.
 *
 * La consecuencia de diseño es la que justifica el módulo: el día que la DGT cambie de
 * criterio sobre, por ejemplo, la entrada a un pool, se cambia AQUÍ la plantilla de ese
 * evento. El motor (saldos, FIFO, cuadre) no se toca.
 *
 * Determinista y TypeScript puro (Regla de oro 4): sin React, sin Dexie, sin browser APIs.
 * Las patas salen SIN `id`: el correlativo lo asigna el repositorio al escribir.
 *
 * Cobertura actual: familias A (cesión de capitales) y B (préstamo) — fase D2.
 */

import {
  type Apunte,
  type CantidadDecimal,
  type EuroDecimal,
  type EventoDeFi,
  type FechaHoraISO,
  type RefUbicacion,
  type SimboloActivo,
  UBICACION_EXTERIOR,
} from '../types'

/** Una pata generada: un apunte sin correlativo (lo asigna el repositorio al guardar). */
export type Pata = Omit<Apunte, 'id'>

/**
 * Criterio por defecto que la app deja escrito en los eventos de zona gris. No es
 * decorativo: sin constancia del criterio aplicado y su fundamento, la posición no se
 * defiende ante una comprobación (art. 33.5.a LIRPF; DEFI §9). El usuario puede
 * sustituirlo, pero nunca debe quedar vacío por olvido.
 */
export const CRITERIO_POR_DEFECTO: Partial<Record<EventoDeFi, string>> = {
  STAKING_LIQUIDO:
    'Tesis prudente: cada canje con el token de posición es permuta (art. 37.1.h LIRPF), ' +
    'conforme a la V0612-26 para el staking líquido. Manual U4.1.2.',
  LENDING_PRESTATARIO:
    'Recepción del principal neutra pero con valor de adquisición (equivalente en euros al ' +
    'recibirlo). Criterio del autor 16-08-2026; art. 1753 CC. Tesis fundada, no confirmada.',
}

// ────────────────────────────────────────────────────────────────────────────
// Datos comunes a toda solicitud
// ────────────────────────────────────────────────────────────────────────────

interface Comun {
  fechaHora: FechaHoraISO
  protocolo: string
  posicionId?: string
  /** Sustituye al criterio por defecto del evento, si el usuario quiere matizarlo. */
  criterioAplicado?: string
  justificante?: string
  notas?: string
}

/** Comisión de red, opcional, en el activo que sea (desde D0 el cripto consume cola). */
interface ConComision {
  comisionCantidad?: CantidadDecimal
  comisionActivo?: SimboloActivo
}

// ────────────────────────────────────────────────────────────────────────────
// Familia A · Cesión de capitales
// ────────────────────────────────────────────────────────────────────────────

/**
 * A1/A2 · Recompensa de staking, delegación o pool acreditada al titular.
 *
 * RCM del art. 25.2 LIRPF, base del ahorro (V1766-22, consolidada por V0612-26). Si el
 * modelo es PoW con ordenación de medios por cuenta propia, es actividad económica del
 * art. 27.1 y la pata es MINERÍA.
 *
 * IMPUTACIÓN: `fechaHora` debe ser la fecha de DISPONIBILIDAD, no la de devengo. La
 * V0612-26 aplica el art. 14.1.a: el rendimiento se obtiene cuando las criptomonedas se
 * acreditan en un monedero del que el titular pueda disponer. Si el protocolo las retiene
 * hasta un *claim*, la fecha es la del *claim*.
 */
export interface SolicitudRecompensa extends Comun {
  clase: 'recompensa'
  evento: Extract<
    EventoDeFi,
    'STAKING_CENTRALIZADO' | 'STAKING_NATIVO' | 'POOL_RECOMPENSA' | 'VAULT'
  >
  ubicacionDestino: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
  /** Valor de mercado en euros el día de la disponibilidad (rendimiento en especie, art. 43.1). */
  contravalorEUR: EuroDecimal
  /** true → minería PoW: actividad económica (art. 27.1), no RCM. */
  actividadEconomica?: boolean
}

/**
 * A1 · Bloqueo o desbloqueo de tokens en staking.
 *
 * NO hay alteración patrimonial: el titular sigue siéndolo. Solo genera pata si el activo
 * cambia de ubicación; si se queda donde está, no hay nada que anotar.
 */
export interface SolicitudBloqueo extends Comun, ConComision {
  clase: 'bloqueo'
  evento: Extract<EventoDeFi, 'STAKING_CENTRALIZADO' | 'STAKING_NATIVO' | 'LOCKING'>
  ubicacionOrigen: RefUbicacion
  ubicacionDestino: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
}

/**
 * A3 · Canje de staking líquido (ETH → rETH a la entrada, rETH → ETH a la salida).
 *
 * PERMUTA del art. 37.1.h: consume lote de lo entregado y abre lote de lo recibido, con
 * ganancia o pérdida patrimonial a la base del ahorro. Es la primera de las DOS capas
 * fiscales del staking líquido; la segunda son las recompensas (RCM), que van por
 * `SolicitudRecompensa`. El manual exige registrarlas por separado (U4.1.2).
 */
export interface SolicitudCanjeLiquido extends Comun, ConComision {
  clase: 'canje-liquido'
  evento: Extract<EventoDeFi, 'STAKING_LIQUIDO' | 'WRAPPING' | 'BRIDGE' | 'ROUTER_MULTIHOP'>
  ubicacion: RefUbicacion
  activoEntregado: SimboloActivo
  cantidadEntregada: CantidadDecimal
  activoRecibido: SimboloActivo
  cantidadRecibida: CantidadDecimal
  contravalorEUR: EuroDecimal
}

// ────────────────────────────────────────────────────────────────────────────
// Familia B · Préstamo
// ────────────────────────────────────────────────────────────────────────────

/**
 * B1/B2 · Movimiento neutro de préstamo: entrega al protocolo, devolución de lo prestado,
 * aportación de colateral y su recuperación.
 *
 * Ninguno es hecho imponible. La entrega del prestamista es neutra por la tesis del mutuo
 * (arts. 1740 y 1753 CC, manual U3.3.2); el colateral es un traslado en garantía porque el
 * deudor sigue siendo propietario.
 */
export interface SolicitudMovimientoPrestamo extends Comun, ConComision {
  clase: 'movimiento-prestamo'
  evento: Extract<EventoDeFi, 'LENDING_PRESTAMISTA' | 'LENDING_PRESTATARIO'>
  ubicacionOrigen: RefUbicacion
  ubicacionDestino: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
}

/**
 * B1 · Interés cobrado por el prestamista. RCM del art. 25.2 (V0648-24), base del ahorro,
 * SIN gastos deducibles (art. 26 LIRPF). Se modela como recompensa.
 */

/**
 * B1 · Devolución en activo DISTINTO al prestado.
 *
 * Deja de haber mutuo neutro: si lo devuelto no es «otro tanto de la misma especie y
 * calidad» (art. 1753 CC), hay permuta o dación en pago, con alteración patrimonial plena.
 * Es el límite 2 de los tres que el manual señala en U3.3.2.
 */
export interface SolicitudDevolucionDistinta extends Comun, ConComision {
  clase: 'devolucion-distinta'
  ubicacion: RefUbicacion
  activoEntregado: SimboloActivo
  cantidadEntregada: CantidadDecimal
  activoRecibido: SimboloActivo
  cantidadRecibida: CantidadDecimal
  contravalorEUR: EuroDecimal
}

/**
 * B1b · EJECUCIÓN DE LA GARANTÍA, lado del PRESTAMISTA (criterio del autor 16-08-2026).
 *
 * Cuando el prestamista se queda con el colateral, esa adquisición es una COMPRA cuyo
 * valor de adquisición es el valor de mercado del activo EN LA FECHA DE LA EJECUCIÓN —no
 * el importe del crédito impagado ni el valor que tuviera al constituirse la garantía—.
 *
 * Consecuencia que conviene tener presente: el crédito queda satisfecho en especie, de
 * modo que ya NO sigue el camino del art. 14.2.k. La ejecución cierra la operación en
 * lugar de abrir la espera de las tres circunstancias.
 *
 * La contrapartida no es un activo que salga, sino la extinción del crédito: por eso esta
 * COMPRA no lleva lado de salida (ver `validaciones.ts`, excepción documentada).
 */
export interface SolicitudEjecucionGarantia extends Comun, ConComision {
  clase: 'ejecucion-garantia'
  ubicacionDestino: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
  /** Valor de mercado del colateral en la fecha de la ejecución. */
  contravalorEUR: EuroDecimal
}

/**
 * B2 · Recepción del principal por el PRESTATARIO (criterio del autor 16-08-2026).
 *
 * Neutra —no es renta— pero CON valor de adquisición: el equivalente en euros de lo
 * recibido en el momento de recibirlo. Sin ese lote, vender después lo prestado computaría
 * una ganancia por el 100 % del importe, sin coste alguno.
 *
 * La contrapartida es la deuda, que se registra en la posición y no en el Libro; de ahí
 * que esta COMPRA tampoco lleve lado de salida.
 */
export interface SolicitudPrincipalRecibido extends Comun, ConComision {
  clase: 'principal-recibido'
  ubicacionDestino: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
  contravalorEUR: EuroDecimal
}

/**
 * B2 · Salida patrimonial del prestatario: interés pagado en cripto, devolución del
 * principal y liquidación forzosa del colateral.
 *
 * Las tres son PAGO, es decir, transmisión que consume cola FIFO:
 *  - El interés no es deducible (gestión patrimonial privada, manual U4.3), pero entregar
 *    cripto para pagarlo SÍ es una transmisión con su propia ganancia o pérdida.
 *  - La devolución del principal cierra el lote abierto en la recepción; aflora la
 *    variación de valor del activo entre una fecha y otra.
 *  - La LIQUIDACIÓN FORZOSA es una dación en pago: valor de transmisión = deuda cancelada.
 *    Es un hecho imponible que el usuario no espera, y la app debe avisarlo en rojo.
 */
export interface SolicitudSalidaPrestamo extends Comun, ConComision {
  clase: 'salida-prestamo'
  motivo: 'interes' | 'devolucion-principal' | 'liquidacion-forzosa'
  ubicacionOrigen: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
  /** Interés/devolución: valor de mercado. Liquidación: importe de la deuda cancelada. */
  contravalorEUR: EuroDecimal
}

/** Unión de todas las solicitudes que este módulo sabe descomponer. */
export type SolicitudEvento =
  | SolicitudRecompensa
  | SolicitudBloqueo
  | SolicitudCanjeLiquido
  | SolicitudMovimientoPrestamo
  | SolicitudDevolucionDistinta
  | SolicitudEjecucionGarantia
  | SolicitudPrincipalRecibido
  | SolicitudSalidaPrestamo

// ────────────────────────────────────────────────────────────────────────────
// Descomposición
// ────────────────────────────────────────────────────────────────────────────

/** Campos comunes que toda pata hereda de la solicitud. */
function base(s: Comun, evento: EventoDeFi): Pick<
  Pata,
  'fechaHora' | 'evento' | 'protocolo' | 'posicionId' | 'criterioAplicado' | 'justificante' | 'notas'
> {
  const criterio = s.criterioAplicado ?? CRITERIO_POR_DEFECTO[evento]
  return {
    fechaHora: s.fechaHora,
    evento,
    protocolo: s.protocolo,
    ...(s.posicionId ? { posicionId: s.posicionId } : {}),
    ...(criterio ? { criterioAplicado: criterio } : {}),
    ...(s.justificante ? { justificante: s.justificante } : {}),
    ...(s.notas ? { notas: s.notas } : {}),
  }
}

/** Comisión, solo si viene informada y es positiva. */
function comision(s: ConComision): Pick<Pata, 'comisionCantidad' | 'comisionActivo'> {
  if (!s.comisionCantidad || !s.comisionActivo) return {}
  return { comisionCantidad: s.comisionCantidad, comisionActivo: s.comisionActivo }
}

/**
 * Traduce un evento DeFi a las patas del Libro que le corresponden.
 *
 * Devuelve un array porque un solo hecho económico puede producir varias patas; en las
 * familias A y B es siempre una, pero la firma es la que necesitan los pools (D3), donde
 * una retirada genera la permuta del neto más una transferencia por activo.
 */
export function descomponer(s: SolicitudEvento): Pata[] {
  switch (s.clase) {
    // ── A1/A2 · Recompensa: RCM (o actividad económica si es PoW) ────────────
    case 'recompensa':
      return [
        {
          ...base(s, s.evento),
          tipo: s.actividadEconomica ? 'MINERIA' : 'RENDIMIENTO',
          ubicacionOrigen: UBICACION_EXTERIOR,
          ubicacionDestino: s.ubicacionDestino,
          activoEntrada: s.activo,
          cantidadEntrada: s.cantidad,
          contravalorEUR: s.contravalorEUR,
        },
      ]

    // ── A1 · Bloqueo/desbloqueo: traslado, o nada si no cambia de ubicación ──
    case 'bloqueo':
      if (s.ubicacionOrigen === s.ubicacionDestino) return []
      return [
        {
          ...base(s, s.evento),
          ...comision(s),
          tipo: 'TRANSFERENCIA',
          ubicacionOrigen: s.ubicacionOrigen,
          ubicacionDestino: s.ubicacionDestino,
          activoSalida: s.activo,
          cantidadSalida: s.cantidad,
          activoEntrada: s.activo,
          cantidadEntrada: s.cantidad,
        },
      ]

    // ── A3 · Canje de token de posición: permuta del art. 37.1.h ─────────────
    case 'canje-liquido':
      return [
        {
          ...base(s, s.evento),
          ...comision(s),
          tipo: 'PERMUTA',
          ubicacionOrigen: s.ubicacion,
          ubicacionDestino: s.ubicacion,
          activoSalida: s.activoEntregado,
          cantidadSalida: s.cantidadEntregada,
          activoEntrada: s.activoRecibido,
          cantidadEntrada: s.cantidadRecibida,
          contravalorEUR: s.contravalorEUR,
        },
      ]

    // ── B1/B2 · Movimiento neutro: entrega, devolución, colateral ────────────
    case 'movimiento-prestamo':
      return [
        {
          ...base(s, s.evento),
          ...comision(s),
          tipo: 'TRANSFERENCIA',
          ubicacionOrigen: s.ubicacionOrigen,
          ubicacionDestino: s.ubicacionDestino,
          activoSalida: s.activo,
          cantidadSalida: s.cantidad,
          activoEntrada: s.activo,
          cantidadEntrada: s.cantidad,
        },
      ]

    // ── B1 · Devolución en activo distinto: se rompe el mutuo neutro ─────────
    case 'devolucion-distinta':
      return [
        {
          ...base(s, 'LENDING_PRESTAMISTA'),
          ...comision(s),
          tipo: 'PERMUTA',
          ubicacionOrigen: s.ubicacion,
          ubicacionDestino: s.ubicacion,
          activoSalida: s.activoEntregado,
          cantidadSalida: s.cantidadEntregada,
          activoEntrada: s.activoRecibido,
          cantidadEntrada: s.cantidadRecibida,
          contravalorEUR: s.contravalorEUR,
          criterioAplicado:
            s.criterioAplicado ??
            'Devolución en activo distinto: no hay mutuo neutro sino permuta o dación en ' +
              'pago (art. 1753 CC; manual U3.3.2, límite 2).',
        },
      ]

    // ── B1b · Ejecución de la garantía: el prestamista adquiere el colateral ─
    case 'ejecucion-garantia':
      return [
        {
          ...base(s, 'EJECUCION_GARANTIA'),
          ...comision(s),
          tipo: 'COMPRA',
          ubicacionOrigen: UBICACION_EXTERIOR,
          ubicacionDestino: s.ubicacionDestino,
          activoEntrada: s.activo,
          cantidadEntrada: s.cantidad,
          contravalorEUR: s.contravalorEUR,
          notas:
            s.notas ??
            'Adquisición por ejecución de garantía: valor de adquisición = valor de mercado ' +
              'en la fecha de ejecución. El crédito queda satisfecho en especie y no sigue ' +
              'el art. 14.2.k LIRPF.',
        },
      ]

    // ── B2 · Recepción del principal: neutra, pero abre lote ─────────────────
    case 'principal-recibido':
      return [
        {
          ...base(s, 'LENDING_PRESTATARIO'),
          ...comision(s),
          tipo: 'COMPRA',
          ubicacionOrigen: UBICACION_EXTERIOR,
          ubicacionDestino: s.ubicacionDestino,
          activoEntrada: s.activo,
          cantidadEntrada: s.cantidad,
          contravalorEUR: s.contravalorEUR,
        },
      ]

    // ── B2 · Salidas del prestatario: interés, devolución, liquidación ───────
    case 'salida-prestamo':
      return [
        {
          ...base(s, 'LENDING_PRESTATARIO'),
          ...comision(s),
          tipo: 'PAGO',
          ubicacionOrigen: s.ubicacionOrigen,
          ubicacionDestino: UBICACION_EXTERIOR,
          activoSalida: s.activo,
          cantidadSalida: s.cantidad,
          contravalorEUR: s.contravalorEUR,
          notas: s.notas ?? NOTA_SALIDA[s.motivo],
        },
      ]
  }
}

const NOTA_SALIDA: Record<SolicitudSalidaPrestamo['motivo'], string> = {
  interes:
    'Interés pagado en cripto: no es deducible (manual U4.3), pero entregarlo es una ' +
    'transmisión que consume FIFO y genera su propia ganancia o pérdida patrimonial.',
  'devolucion-principal':
    'Devolución del principal: cierra el lote abierto en la recepción y hace aflorar la ' +
    'variación de valor del activo entre ambas fechas.',
  'liquidacion-forzosa':
    'LIQUIDACIÓN FORZOSA del colateral: dación en pago. Valor de transmisión = deuda ' +
    'cancelada. Es un hecho imponible (manual U3.3.2 y U4.3).',
}

/**
 * ¿Es esta pata una COMPRA cuya contrapartida NO es un activo que sale, sino la extinción
 * o el nacimiento de un crédito? Son los dos supuestos validados por el autor: la
 * ejecución de la garantía (el prestamista adquiere el colateral y su crédito se extingue)
 * y la recepción del principal por el prestatario (entra el activo, nace la deuda).
 *
 * La deuda vive en la POSICIÓN, no en el Libro: por eso estas compras no llevan lado de
 * salida y la validación de COMPRA las exceptúa.
 */
export function esCompraContraCredito(ap: Pick<Apunte, 'tipo' | 'evento'>): boolean {
  return (
    ap.tipo === 'COMPRA' &&
    (ap.evento === 'EJECUCION_GARANTIA' || ap.evento === 'LENDING_PRESTATARIO')
  )
}
