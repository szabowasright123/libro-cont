/**
 * plantillas.ts — descomposición de eventos DeFi en patas del catálogo cerrado.
 *
 * Fuente de verdad: docs/DEFI_EVENTOS_COMPLEJOS.md (validado por el autor 16-08-2026).
 *
 * PRINCIPIO RECTOR (DEFI §0): un evento DeFi NO es un tipo nuevo. Se descompone en una
 * o varias PATAS, y cada pata es un apunte de uno de los 12 tipos que ya existen. Lo que
 * este módulo materializa es esa traducción, y solo esa.
 *
 * La consecuencia de diseño es la que justifica el módulo: el día que la DGT cambie de
 * criterio sobre, por ejemplo, la entrada a un pool, se cambia AQUÍ la plantilla de ese
 * evento. El motor (saldos, FIFO, cuadre) no se toca.
 *
 * Determinista y TypeScript puro (Regla de oro 4): sin React, sin Dexie, sin browser APIs.
 * Las patas salen SIN `id`: el correlativo lo asigna el repositorio al escribir.
 *
 * Cobertura: familias A (cesión de capitales), B (préstamo), C (pools), D (derivados),
 * E (cambio de forma), F (incorporaciones) y G (bloqueo de gobernanza) — fases D2, D3, D5 y D6.
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
import { D, aCadena as aCadenaD, Decimal } from '../decimal'

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
  POOL_APORTACION:
    'Tesis BENÉVOLA: el LP token es un simple resguardo y la aportación no es hecho ' +
    'imponible (criterio del autor 16-08-2026). La tesis prudente la trataría como permuta ' +
    'del art. 37.1.h. Sin criterio de la DGT. Manual U4.5.',
  POOL_RETIRADA:
    'Tesis BENÉVOLA: solo se transmite el NETO entre lo aportado y lo recuperado, valorado ' +
    'por el precio efectivamente obtenido y no por el mayor de los dos valores del art. ' +
    '37.1.h — en un AMM el valor de transmisión real es el de la secuencia de ' +
    'micro-operaciones. Criterio del autor 16-08-2026. Manual U4.5.',
  WRAPPING:
    'Tesis prudente: el envoltorio es un activo distinto del subyacente y el canje es ' +
    'permuta del art. 37.1.h. Sin criterio de la DGT.',
  BRIDGE:
    'Tesis prudente: si lo recibido es un token envuelto distinto, el canje es permuta del ' +
    'art. 37.1.h; si es el mismo activo en otra red, es traslado. Sin criterio de la DGT.',
  ROUTER_MULTIHOP:
    'Se registra UNA sola permuta (la querida por el contribuyente) y no los saltos ' +
    'intermedios del agregador: art. 13 LGT, calificación conforme a la verdadera ' +
    'naturaleza. Los saltos quedan en el Archivo. Sin criterio de la DGT.',
  HARD_FORK:
    'Zona gris sin criterio publicado (manual U3.4.4): decisión manual entre asimilar al ' +
    'airdrop (ganancia a valor de mercado, base general) o coste cero con diferimiento.',
  AIRDROP_CONDICIONADO:
    'Si el token se recibe a cambio de una contraprestación real, la calificación se aleja ' +
    'de la incorporación gratuita del art. 37.1.l. Sin criterio publicado: decisión manual.',
  LOCKING:
    'El veToken es intransferible y sin valor de mercado determinable: el bloqueo se trata ' +
    'como traslado sin alteración y los retornos como RCM. Sin criterio de la DGT.',
  VAULT:
    'Vault de valor creciente: no hay acreditación periódica imputable, la renta aflora ' +
    'entera en la permuta de salida. Sin criterio de la DGT. Manual U4.5.',
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

// ────────────────────────────────────────────────────────────────────────────
// Familia C · Provisión de liquidez (tesis BENÉVOLA — criterio del autor 16-08-2026)
// ────────────────────────────────────────────────────────────────────────────

/** Un activo con su cantidad y su contravalor en euros. */
export interface Tramo {
  activo: SimboloActivo
  cantidad: CantidadDecimal
  contravalorEUR: EuroDecimal
}

/**
 * C1 · APORTACIÓN a un pool.
 *
 * Bajo la tesis benévola NO es hecho imponible: el LP token es un resguardo, los activos no
 * salen del patrimonio y no se consume ni se abre lote. Cada activo aportado genera una
 * TRANSFERENCIA a la ubicación que representa el pool, y nada más.
 *
 * Obsérvese lo que esta tesis ahorra: con la prudente habría que partir la aportación en
 * tantas permutas como activos y repartir el LP token en proporción al contravalor de cada
 * uno. Aquí no hace falta, y la cola FIFO no se ensucia con lotes de un token que nadie
 * negocia.
 */
export interface SolicitudPoolAportacion extends Comun, ConComision {
  clase: 'pool-aportacion'
  ubicacionOrigen: RefUbicacion
  /** Ubicación que representa el pool (destino de los activos aportados). */
  ubicacionPool: RefUbicacion
  aportado: Tramo[]
}

/**
 * C3 · RETIRADA de un pool. Aquí aflora todo.
 *
 * El cálculo se hace por DIFERENCIA entre lo aportado y lo recuperado, activo a activo:
 * los activos cuyo neto es cero no generan apunte alguno —nunca dejaron de ser del
 * titular—, los de neto negativo son la entrega y los de neto positivo la contraprestación.
 *
 * Valoración: el PRECIO EFECTIVAMENTE OBTENIDO, es decir, el contravalor de lo recibido, y
 * no el mayor de los dos valores del art. 37.1.h. El importe que arrojaría esa regla se
 * conserva en `contravalorAlternativoEUR` para poder defender o recalcular el otro criterio.
 */
export interface SolicitudPoolRetirada extends Comun, ConComision {
  clase: 'pool-retirada'
  ubicacionPool: RefUbicacion
  ubicacionDestino: RefUbicacion
  aportado: Tramo[]
  recuperado: Tramo[]
}

// ────────────────────────────────────────────────────────────────────────────
// Familia D · Derivados liquidados por diferencias (12.º tipo — fase D6)
// ────────────────────────────────────────────────────────────────────────────

/**
 * D1 · CIERRE de una posición en un derivado liquidado por diferencias.
 *
 * Ganancia o pérdida patrimonial (art. 33.1), integrada en la base del ahorro por el art.
 * 46.b) LIRPF y compensable por el art. 49.1.b) y 2. El art. 37.1.m NO aplica: alcanza solo a
 * los contratos negociados en mercados organizados y sigue citando el derogado RD 1814/1991
 * (sucesión: 1282/2010 → 1464/2018 → 814/2023); un perpetuo de exchange queda fuera.
 *
 * IMPUTACIÓN TEMPORAL (revisión 20-8-2026). Si el contrato liquida periódicamente —y un
 * perpetuo liquida funding cada ocho horas— la ganancia o pérdida se obtiene DIARIAMENTE,
 * «aun cuando la posición contractual no se hubiese cerrado al finalizar dicho período
 * impositivo» (art. 14.1.c LIRPF; DGT V2115-21). Esta plantilla descompone UN corte de
 * liquidación: una posición viva a 31-12 exige un apunte por corte, no uno solo al cierre.
 *
 * Con resultado POSITIVO se genera una sola pata LIQUIDACION_DERIVADO, que abre lote por lo
 * acreditado. Con resultado NEGATIVO se generan DOS, que es el «doble efecto» que el manual
 * describe en U4.3: la pérdida de la propia posición, y la transmisión del activo que se ha
 * entregado para saldarla, con su ganancia o pérdida propia calculada por FIFO.
 */
export interface SolicitudDerivado extends Comun, ConComision {
  clase: 'derivado'
  ubicacion: RefUbicacion
  /** Resultado neto que liquida la plataforma, con signo. */
  resultadoNetoEUR: EuroDecimal
  /** Activo acreditado (resultado positivo) o debitado (negativo), si lo hay. */
  activo?: SimboloActivo
  cantidad?: CantidadDecimal
  /** Valor de mercado del activo movido; por defecto, el valor absoluto del resultado. */
  contravalorActivoEUR?: EuroDecimal
}

// ────────────────────────────────────────────────────────────────────────────
// Familias E, F y G (fase D5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * E3 · HARD FORK. Zona gris sin criterio publicado (manual U3.4.4): exige DECISIÓN MANUAL
 * entre las dos posiciones doctrinales, igual que DONACIÓN y AJUSTE.
 *  - `airdrop`: ganancia patrimonial sin transmisión, a valor de mercado, base general.
 *  - `coste-cero`: se adquiere a coste cero y toda la tributación se difiere a la venta.
 */
export interface SolicitudHardFork extends Comun {
  clase: 'hard-fork'
  postura: 'airdrop' | 'coste-cero'
  ubicacionDestino: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
  /** Valor de mercado en la recepción. Se ignora en la postura de coste cero.  */
  contravalorEUR: EuroDecimal
}

/**
 * F1 · AIRDROP CONDICIONADO. Si hay contraprestación real —usar el protocolo, promocionarlo,
 * aportar liquidez—, la calificación se aleja de la incorporación gratuita del art. 37.1.l
 * y puede aproximarse al RCM. Sin criterio publicado: la app pregunta y deja constancia.
 */
export interface SolicitudAirdropCondicionado extends Comun {
  clase: 'airdrop-condicionado'
  hayContraprestacion: boolean
  ubicacionDestino: RefUbicacion
  activo: SimboloActivo
  cantidad: CantidadDecimal
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
  | SolicitudPoolAportacion
  | SolicitudPoolRetirada
  | SolicitudDerivado
  | SolicitudHardFork
  | SolicitudAirdropCondicionado

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

    // ── C1 · Aportación a pool: bajo la tesis benévola, solo traslados ───────
    case 'pool-aportacion':
      return s.aportado.map((t, i) => ({
        ...base(s, 'POOL_APORTACION'),
        // La comisión se cuelga de la primera pata para no contarla tantas veces
        // como activos aportados.
        ...(i === 0 ? comision(s) : {}),
        tipo: 'TRANSFERENCIA',
        ubicacionOrigen: s.ubicacionOrigen,
        ubicacionDestino: s.ubicacionPool,
        activoSalida: t.activo,
        cantidadSalida: t.cantidad,
        activoEntrada: t.activo,
        cantidadEntrada: t.cantidad,
      }))

    // ── C3 · Retirada de pool: permuta del NETO + vuelta de los saldos ───────
    case 'pool-retirada':
      return retirarDePool(s)

    // ── D1 · Cierre de una posición en derivados ─────────────────────────────
    case 'derivado':
      return cerrarDerivado(s)

    // ── E3 · Hard fork: decisión manual entre las dos posturas ───────────────
    case 'hard-fork':
      return [
        {
          ...base(s, 'HARD_FORK'),
          // Asimilación al airdrop: ganancia a valor de mercado, base general.
          // Coste cero: COMPRA a contravalor 0, con toda la tributación diferida a la venta.
          tipo: s.postura === 'airdrop' ? 'AIRDROP' : 'COMPRA',
          ubicacionOrigen: UBICACION_EXTERIOR,
          ubicacionDestino: s.ubicacionDestino,
          activoEntrada: s.activo,
          cantidadEntrada: s.cantidad,
          contravalorEUR: s.postura === 'airdrop' ? s.contravalorEUR : '0',
          // Se conserva el otro importe para poder ver cuánto mueve la postura contraria.
          contravalorAlternativoEUR: s.postura === 'airdrop' ? '0' : s.contravalorEUR,
        },
      ]

    // ── F1 · Airdrop condicionado ────────────────────────────────────────────
    case 'airdrop-condicionado':
      return [
        {
          ...base(s, 'AIRDROP_CONDICIONADO'),
          // Con contraprestación real la incorporación deja de ser gratuita y se aproxima
          // al RCM; sin ella, sigue el régimen del art. 37.1.l.
          tipo: s.hayContraprestacion ? 'RENDIMIENTO' : 'AIRDROP',
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

/**
 * Retirada de un pool bajo la tesis benévola: el hecho imponible es la DIFERENCIA entre lo
 * aportado y lo recuperado, no el canje contra el LP token.
 *
 * Los activos cuyo neto es cero no generan permuta: nunca dejaron de ser del titular. Lo que
 * sí generan todos —incluidos esos— es la TRANSFERENCIA de vuelta desde la ubicación del
 * pool, para que el CUADRE cierre.
 */
function retirarDePool(s: SolicitudPoolRetirada): Pata[] {
  const netos = new Map<SimboloActivo, Decimal>()
  const valorPorActivo = new Map<SimboloActivo, Decimal>()
  for (const t of s.aportado) {
    netos.set(t.activo, (netos.get(t.activo) ?? D(0)).minus(D(t.cantidad)))
  }
  for (const t of s.recuperado) {
    netos.set(t.activo, (netos.get(t.activo) ?? D(0)).plus(D(t.cantidad)))
    valorPorActivo.set(t.activo, D(t.contravalorEUR))
  }
  for (const t of s.aportado) {
    if (!valorPorActivo.has(t.activo)) valorPorActivo.set(t.activo, D(t.contravalorEUR))
  }

  const salidas = [...netos].filter(([, n]) => n.lessThan(0)).map(([a, n]) => ({ activo: a, cantidad: n.negated() }))
  const entradas = [...netos].filter(([, n]) => n.greaterThan(0)).map(([a, n]) => ({ activo: a, cantidad: n }))

  const patas: Pata[] = []

  // Valor unitario en euros de cada activo en el momento de la retirada, tomado de los
  // tramos recuperados/aportados: es lo que permite valorar el neto.
  const unitario = (activo: SimboloActivo): Decimal => {
    const tr =
      s.recuperado.find((t) => t.activo === activo) ?? s.aportado.find((t) => t.activo === activo)
    if (!tr || D(tr.cantidad).lessThanOrEqualTo(0)) return D(0)
    return D(tr.contravalorEUR).div(D(tr.cantidad))
  }

  const valorEntradas = entradas.reduce<Decimal>((acc, e) => acc.plus(unitario(e.activo).times(e.cantidad)), D(0))
  const valorSalidas = salidas.reduce<Decimal>((acc, x) => acc.plus(unitario(x.activo).times(x.cantidad)), D(0))

  // Permuta(s) del neto. Con varias salidas, el valor recibido se reparte entre ellas en
  // proporción a su contravalor (DEFI §C3), que es la única situación en la que sobrevive
  // la fórmula de reparto proporcional.
  for (const x of salidas) {
    const valorX = unitario(x.activo).times(x.cantidad)
    const proporcion = valorSalidas.greaterThan(0) ? valorX.div(valorSalidas) : D(0)
    const entrada = entradas[0]
    patas.push({
      ...base(s, 'POOL_RETIRADA'),
      tipo: 'PERMUTA',
      ubicacionOrigen: s.ubicacionPool,
      ubicacionDestino: s.ubicacionDestino,
      activoSalida: x.activo,
      cantidadSalida: aCadenaD(x.cantidad),
      ...(entrada
        ? {
            activoEntrada: entrada.activo,
            cantidadEntrada: aCadenaD(entrada.cantidad.times(proporcion)),
          }
        : {}),
      // PRECIO EFECTIVAMENTE OBTENIDO: el valor de lo recibido, no el de lo entregado.
      contravalorEUR: aCadenaD(valorEntradas.times(proporcion)),
      // Lo que exigiría el art. 37.1.h: el MAYOR de los dos valores. Se conserva para
      // poder defender o recalcular el criterio contrario (DEFI §C6).
      contravalorAlternativoEUR: aCadenaD(Decimal.max(valorX, valorEntradas.times(proporcion))),
    })
  }

  // Vuelta de los saldos: una transferencia por activo recuperado, para que el CUADRE cierre.
  for (const t of s.recuperado) {
    patas.push({
      ...base(s, 'POOL_RETIRADA'),
      tipo: 'TRANSFERENCIA',
      ubicacionOrigen: s.ubicacionPool,
      ubicacionDestino: s.ubicacionDestino,
      activoSalida: t.activo,
      cantidadSalida: t.cantidad,
      activoEntrada: t.activo,
      cantidadEntrada: t.cantidad,
    })
  }

  return patas
}

/**
 * Cierre de una posición en derivados. Con pérdida se emiten DOS patas: la de la posición y
 * la del activo entregado para saldarla. Es el «doble efecto» del manual (U4.3): una
 * liquidación forzosa concentra dos hechos fiscales a la vez.
 */
function cerrarDerivado(s: SolicitudDerivado): Pata[] {
  const neto = D(s.resultadoNetoEUR)
  const valorActivo = s.contravalorActivoEUR ?? aCadenaD(neto.abs())

  const liquidacion: Pata = {
    ...base(s, 'DERIVADO'),
    tipo: 'LIQUIDACION_DERIVADO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: s.ubicacion,
    contravalorEUR: s.resultadoNetoEUR,
    ...(neto.greaterThan(0) && s.activo && s.cantidad
      ? { activoEntrada: s.activo, cantidadEntrada: s.cantidad }
      : {}),
    notas:
      s.notas ??
      'Resultado neto liquidado por la plataforma. GyP patrimonial (art. 33.1), base del ahorro ' +
        'por el art. 46.b) LIRPF. Imputación diaria si el contrato liquida a diario (V2115-21). ' +
        'El art. 37.1.m no aplica: alcanza solo a mercados organizados y remite al derogado ' +
        'RD 1814/1991 (hoy RD 814/2023).',
  }

  if (neto.greaterThanOrEqualTo(0) || !s.activo || !s.cantidad) return [liquidacion]

  return [
    liquidacion,
    {
      ...base(s, 'DERIVADO'),
      ...comision(s),
      tipo: 'PAGO',
      ubicacionOrigen: s.ubicacion,
      ubicacionDestino: UBICACION_EXTERIOR,
      activoSalida: s.activo,
      cantidadSalida: s.cantidad,
      contravalorEUR: valorActivo,
      notas:
        'Entrega del activo con el que se salda la pérdida de la posición: transmisión con ' +
        'su propia GyP calculada por FIFO. Es el doble efecto del manual U4.3.',
    },
  ]
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
