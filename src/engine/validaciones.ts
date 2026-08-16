/**
 * validaciones.ts — validaciones al grabar apunte (la mayor ventaja sobre el Excel).
 *
 * Fuente: DOMINIO §4 «Validaciones al grabar apunte» y la Tabla 7 de PARÁMETROS.
 * Comprueba coherencia campos↔tipo, contravalor obligatorio donde hay alteración,
 * AJUSTE con rectificaA, y —a nivel de diario— consumo sin saldo FIFO suficiente.
 *
 * Cada validación devuelve `Aviso`s con nivel:
 *   - 'error'  : el apunte no debería grabarse tal cual (bloqueo/rojo).
 *   - 'aviso'  : atención, pero no impide grabar (ámbar).
 *
 * Determinista y TypeScript puro (Regla de oro 4). No lanza: acumula avisos.
 */

import { type Apunte, type IdApunte, CATALOGO_TIPOS, ETIQUETA_EVENTO, esZonaGris } from './types'
import { D } from './decimal'
import { calcularFifo } from './fifo'
import { esCompraContraCredito } from './defi/plantillas'

/** Nivel de severidad de un aviso de validación. */
export type NivelAviso = 'error' | 'aviso'

/** Un hallazgo de validación sobre un apunte o el diario. */
export interface Aviso {
  /** Apunte al que se refiere (si aplica). */
  apunteId?: IdApunte
  nivel: NivelAviso
  /** Código estable para la UI/tests (p. ej. 'TRANSFERENCIA_MISMO_ACTIVO'). */
  codigo: string
  mensaje: string
}

/** ¿Tiene el apunte lado de entrada (activo + cantidad)? */
function tieneEntrada(ap: Apunte): boolean {
  return !!ap.activoEntrada && !!ap.cantidadEntrada && D(ap.cantidadEntrada).greaterThan(0)
}

/** ¿Tiene el apunte lado de salida (activo + cantidad)? */
function tieneSalida(ap: Apunte): boolean {
  return !!ap.activoSalida && !!ap.cantidadSalida && D(ap.cantidadSalida).greaterThan(0)
}

/** ¿Tiene contravalor EUR informado (> 0 o explícitamente 0)? */
function tieneContravalor(ap: Apunte): boolean {
  return ap.contravalorEUR !== undefined && ap.contravalorEUR !== ''
}

/**
 * Valida un apunte de forma aislada (coherencia campos↔tipo, contravalor, AJUSTE).
 * No comprueba saldo FIFO (eso exige el diario completo: `validarDiario`).
 */
export function validarApunte(ap: Apunte): Aviso[] {
  const avisos: Aviso[] = []
  const def = CATALOGO_TIPOS[ap.tipo]
  const push = (nivel: NivelAviso, codigo: string, mensaje: string) =>
    avisos.push({ apunteId: ap.id, nivel, codigo, mensaje })

  // 0. Tipo del catálogo cerrado.
  if (!def) {
    push('error', 'TIPO_DESCONOCIDO', `Tipo «${ap.tipo}» fuera del catálogo cerrado de 11 tipos.`)
    return avisos
  }

  // 1. Coherencia campos ↔ tipo.
  switch (ap.tipo) {
    case 'COMPRA':
    case 'PERMUTA':
      // Adquisición/permuta: entran y salen activos, y deben ser distintos.
      if (!tieneEntrada(ap)) push('error', 'FALTA_ENTRADA', `${ap.tipo} exige activo de entrada.`)
      // Excepción documentada (D2): las COMPRAS cuya contrapartida es un CRÉDITO y no un
      // activo —ejecución de garantía por el prestamista, recepción del principal por el
      // prestatario— no tienen lado de salida. La deuda vive en la posición, no en el
      // Libro. Ver src/engine/defi/plantillas.ts y DEFI §B1b/B2.
      if (!tieneSalida(ap) && !esCompraContraCredito(ap)) {
        push('error', 'FALTA_SALIDA', `${ap.tipo} exige activo de salida.`)
      }
      if (ap.activoEntrada && ap.activoSalida && ap.activoEntrada === ap.activoSalida) {
        push('error', 'ENTRADA_IGUAL_SALIDA', `${ap.tipo}: entrada y salida no pueden ser el mismo activo.`)
      }
      break

    case 'VENTA':
    case 'PAGO':
      // Transmisión con contraprestación: sale cripto, entra EUR/bien.
      if (!tieneSalida(ap)) push('error', 'FALTA_SALIDA', `${ap.tipo} exige activo de salida (lo transmitido).`)
      break

    case 'PERDIDA':
      // Solo salida; nunca entrada.
      if (!tieneSalida(ap)) push('error', 'FALTA_SALIDA', 'PÉRDIDA exige activo de salida (lo perdido).')
      if (tieneEntrada(ap)) push('error', 'PERDIDA_CON_ENTRADA', 'PÉRDIDA no puede tener lado de entrada.')
      break

    case 'RENDIMIENTO':
    case 'MINERIA':
    case 'AIRDROP':
      // Entran sin salir (RCM/actividad/ganancia): entrada obligatoria, salida prohibida.
      if (!tieneEntrada(ap)) push('error', 'FALTA_ENTRADA', `${def.etiqueta} exige activo de entrada.`)
      if (tieneSalida(ap)) push('error', 'RENDIMIENTO_CON_SALIDA', `${def.etiqueta} no tiene lado de salida.`)
      break

    case 'TRANSFERENCIA': {
      // Mismo activo ± comisión. Si ambos lados constan, deben coincidir.
      if (tieneEntrada(ap) && tieneSalida(ap) && ap.activoEntrada !== ap.activoSalida) {
        push('error', 'TRANSFERENCIA_MISMO_ACTIVO', 'TRANSFERENCIA exige el mismo activo en entrada y salida.')
      }
      // Debe existir al menos un lado, y tocar alguna ubicación de frontera o interna.
      if (!tieneEntrada(ap) && !tieneSalida(ap)) {
        push('error', 'TRANSFERENCIA_VACIA', 'TRANSFERENCIA sin activo movido.')
      }
      break
    }

    case 'DONACION':
      // Requiere decisión manual: solo avisamos.
      push('aviso', 'DONACION_MANUAL', 'DONACIÓN requiere decisión manual del sentido y tratamiento fiscal.')
      break

    case 'AJUSTE':
      // Requiere decisión manual + rectificaA (se comprueba abajo).
      push('aviso', 'AJUSTE_MANUAL', 'AJUSTE/RECTIFICACIÓN requiere revisión manual.')
      break
  }

  // 2. Contravalor obligatorio en tipos con alteración patrimonial (relevancia fiscal).
  //    PÉRDIDA admite contravalor 0 (robo sin contraprestación), pero debe estar informado.
  if (def.alteracion === true && !tieneContravalor(ap)) {
    push('error', 'FALTA_CONTRAVALOR', `${def.etiqueta} exige contravalor EUR (hecho imponible).`)
  }

  // 3. AJUSTE exige rectificaA (principio 7, U7.4) → bloqueo.
  if (def.exigeRectificaA && !ap.rectificaA) {
    push('error', 'AJUSTE_SIN_RECTIFICA', 'AJUSTE exige referencia al apunte que rectifica (rectificaA).')
  }

  // 4. Comisión: si hay cantidad de comisión debe haber activo de comisión (y viceversa).
  const hayComCant = !!ap.comisionCantidad && D(ap.comisionCantidad).greaterThan(0)
  if (hayComCant && !ap.comisionActivo) {
    push('error', 'COMISION_SIN_ACTIVO', 'La comisión tiene cantidad pero no activo.')
  }

  // 5. Zona gris DeFi: los eventos sin criterio administrativo publicado exigen dejar
  //    constancia del criterio aplicado (DEFI §9). Es AVISO, no error: no debe impedir
  //    registrar el hecho —el principio de integridad manda anotar TODO movimiento—,
  //    pero sin esa nota la posición no es defendible ante una comprobación.
  if (esZonaGris(ap.evento) && !ap.criterioAplicado?.trim()) {
    push(
      'aviso',
      'ZONA_GRIS_SIN_CRITERIO',
      `${ETIQUETA_EVENTO[ap.evento!]} no tiene criterio administrativo publicado: ` +
        'deja constancia del criterio aplicado y su fundamento.',
    )
  }

  // 5 bis. RCM SIN GASTOS DEDUCIBLES (DEFI §4.5) → bloqueo.
  //    El art. 26 LIRPF no permite deducir gastos de los rendimientos del capital
  //    mobiliario obtenidos en criptoactivos (criterio V0648-24, expreso para staking,
  //    lending, pools y yield farming). Una comisión colgada del propio RENDIMIENTO
  //    acabaría minorando la renta por la puerta de atrás: si es en EUR suma al coste del
  //    lote, y si es en cripto también (D0, regla 3), reduciendo la ganancia futura.
  //    Debe registrarse como apunte independiente.
  //    No aplica a MINERÍA (actividad económica: ahí los gastos SÍ son deducibles) ni a
  //    AIRDROP (ganancia patrimonial, cuyo valor de adquisición sí admite gastos
  //    inherentes del art. 35.1).
  if (ap.tipo === 'RENDIMIENTO' && hayComCant) {
    push(
      'error',
      'RCM_CON_GASTO',
      'Un RENDIMIENTO (RCM) no admite comisión: el art. 26 LIRPF no permite deducir gastos ' +
        '(V0648-24). Registra la comisión como apunte independiente.',
    )
  }

  // 6. Coherencia de la dimensión DeFi: el criterio y el protocolo cuelgan del evento.
  if (!ap.evento && ap.criterioAplicado?.trim()) {
    push('aviso', 'CRITERIO_SIN_EVENTO', 'Hay criterio aplicado pero el apunte no declara evento DeFi.')
  }

  return avisos
}

/**
 * Valida el diario completo: agrega las validaciones por apunte y añade el aviso de
 * «consumo sin saldo FIFO suficiente» (venta/pago/pérdida que agota la cola del activo).
 * Requiere el diario en orden cronológico (lo exige `calcularFifo`).
 */
export function validarDiario(apuntes: Apunte[]): Aviso[] {
  const avisos: Aviso[] = []
  for (const ap of apuntes) avisos.push(...validarApunte(ap))

  // Aviso de saldo FIFO insuficiente por transmisión (DOMINIO §4).
  const fifo = calcularFifo(apuntes)
  for (const { transmisiones } of fifo.values()) {
    for (const t of transmisiones) {
      if (t.saldoFifoInsuficiente) {
        avisos.push({
          apunteId: t.apunteId,
          nivel: 'aviso',
          codigo: 'FIFO_INSUFICIENTE',
          mensaje:
            `Transmisión de ${t.cantidad} ${t.activo} sin saldo FIFO suficiente: ` +
            `${t.cantidadSinCoste} sin lote de coste (venta/salida sin origen registrado).`,
        })
      }
    }
  }

  return avisos
}

/** ¿Hay algún aviso de nivel 'error' en la lista? */
export function hayErrores(avisos: Aviso[]): boolean {
  return avisos.some((a) => a.nivel === 'error')
}
