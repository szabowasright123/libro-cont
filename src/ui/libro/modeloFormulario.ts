/**
 * modeloFormulario.ts — qué campos admite y exige cada tipo de operación (puro).
 *
 * El enunciado P2: «al elegir tipo, muestra SOLO los campos que ese tipo admite y
 * marca los obligatorios». Esta lógica de presentación se aísla aquí como función
 * determinista para poder testearla sin renderizar y para que el componente del
 * formulario sea una proyección directa del modelo.
 *
 * Fuente de coherencia: la Tabla 7 del catálogo (CATALOGO_TIPOS) y las
 * validaciones del motor (validaciones.ts). Este modelo NO sustituye a las
 * validaciones del motor: el bloqueo definitivo al grabar combina los campos
 * faltantes de aquí con los errores de `validarApunte` (validaciones del motor en
 * vivo). Aquí solo decidimos visibilidad y marca de obligatoriedad.
 */
import type { RefUbicacion, TipoOperacion } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import type { BorradorApunte } from '../../data/tipos'

/** Grado de exigencia de un grupo de campos en el formulario. */
export type Visibilidad = 'oculto' | 'opcional' | 'obligatorio'

/** Sentido de una DONACIÓN (pregunta manual). */
export type SentidoDonacion = 'entregada' | 'recibida'

/** Especificación de los campos del formulario para un tipo (y sentido) dado. */
export interface CamposApunte {
  /** Lado de entrada (activoEntrada + cantidadEntrada). */
  entrada: Visibilidad
  /** Lado de salida (activoSalida + cantidadSalida). */
  salida: Visibilidad
  /** Comisión (comisionCantidad + comisionActivo). */
  comision: 'oculto' | 'opcional'
  /** Contravalor en euros. */
  contravalor: Visibilidad
  /** Referencia al apunte rectificado (solo AJUSTE). */
  rectificaA: 'oculto' | 'obligatorio'
  /** ¿Las notas actúan como «causa» obligatoria? (AJUSTE, principio 7). */
  causaObligatoria: boolean
  /** TRANSFERENCIA: entrada y salida deben ser el mismo activo. */
  mismoActivo: boolean
  /** ¿La app debe preguntar el sentido de la DONACIÓN? */
  preguntaSentidoDonacion: boolean
  /** Sugerencia de ubicación de origen (p. ej. EXTERIOR en rendimientos). */
  origenPorDefecto?: RefUbicacion
  /** Sugerencia de ubicación de destino (p. ej. EXTERIOR en pagos/pérdidas). */
  destinoPorDefecto?: RefUbicacion
}

/** Base común: nada visible salvo lo que cada tipo active. */
const BASE: CamposApunte = {
  entrada: 'oculto',
  salida: 'oculto',
  comision: 'oculto',
  contravalor: 'oculto',
  rectificaA: 'oculto',
  causaObligatoria: false,
  mismoActivo: false,
  preguntaSentidoDonacion: false,
}

/**
 * Devuelve la especificación de campos para un tipo. Para DONACIÓN, el `sentido`
 * (pregunta manual) decide si el activo entra o sale.
 */
export function camposDeTipo(
  tipo: TipoOperacion,
  sentido: SentidoDonacion = 'entregada',
): CamposApunte {
  switch (tipo) {
    case 'LIQUIDACION_DERIVADO':
      // D6: entra lo acreditado (si lo hay) y nunca sale el subyacente. El contravalor es
      // el RESULTADO NETO de la posición, y puede ser negativo.
      return { ...BASE, entrada: 'opcional', salida: 'oculto', comision: 'opcional', contravalor: 'obligatorio' }

    case 'COMPRA':
      // Sale la contraprestación (EUR/otro), entra el activo adquirido; coste = contravalor.
      return { ...BASE, entrada: 'obligatorio', salida: 'obligatorio', comision: 'opcional', contravalor: 'obligatorio' }

    case 'PERMUTA':
      // Cripto-cripto: entrega uno, recibe otro; contravalor = valor de la permuta.
      return { ...BASE, entrada: 'obligatorio', salida: 'obligatorio', comision: 'opcional', contravalor: 'obligatorio' }

    case 'VENTA':
      // Sale cripto (obligatorio), entra EUR (opcional); valor de transmisión = contravalor.
      return { ...BASE, salida: 'obligatorio', entrada: 'opcional', comision: 'opcional', contravalor: 'obligatorio' }

    case 'PAGO':
      // Sale cripto para pagar; el precio es la factura (contravalor). Sin entrada de activo.
      return { ...BASE, salida: 'obligatorio', comision: 'opcional', contravalor: 'obligatorio', destinoPorDefecto: UBICACION_EXTERIOR }

    case 'PERDIDA':
      // Solo salida; contravalor (0 admitido: robo sin contraprestación).
      return { ...BASE, salida: 'obligatorio', contravalor: 'obligatorio', destinoPorDefecto: UBICACION_EXTERIOR }

    case 'TRANSFERENCIA':
      // Mismo activo ± comisión; sin hecho imponible (sin contravalor).
      return { ...BASE, entrada: 'opcional', salida: 'opcional', comision: 'opcional', mismoActivo: true }

    case 'RENDIMIENTO':
    case 'MINERIA':
    case 'AIRDROP':
      // Entra sin salir; llega desde la frontera EXTERIOR.
      return { ...BASE, entrada: 'obligatorio', comision: 'opcional', contravalor: 'obligatorio', origenPorDefecto: UBICACION_EXTERIOR }

    case 'DONACION':
      // Pregunta manual el sentido: entregada (sale) o recibida (entra).
      return {
        ...BASE,
        preguntaSentidoDonacion: true,
        contravalor: 'obligatorio',
        comision: 'opcional',
        ...(sentido === 'entregada'
          ? { salida: 'obligatorio' as Visibilidad, destinoPorDefecto: UBICACION_EXTERIOR }
          : { entrada: 'obligatorio' as Visibilidad, origenPorDefecto: UBICACION_EXTERIOR }),
      }

    case 'AJUSTE':
      // Rectificación: referencia + causa obligatorias; el resto, flexible.
      return {
        ...BASE,
        entrada: 'opcional',
        salida: 'opcional',
        comision: 'opcional',
        contravalor: 'opcional',
        rectificaA: 'obligatorio',
        causaObligatoria: true,
      }
  }
}

/** Un campo obligatorio que falta en el borrador. */
export interface CampoFaltante {
  campo: string
  etiqueta: string
}

/** ¿Hay activo + cantidad (> vacío) en un lado? */
function ladoRelleno(activo?: string, cantidad?: string): boolean {
  return !!activo && cantidad !== undefined && cantidad.trim() !== ''
}

/**
 * Campos obligatorios del modelo que faltan en el borrador. Complementa (no
 * sustituye) a las validaciones del motor: el motor comprueba coherencia
 * campos↔tipo; aquí, la presencia de lo marcado como obligatorio en el formulario.
 */
export function camposFaltantes(
  borrador: BorradorApunte,
  campos: CamposApunte,
): CampoFaltante[] {
  const faltan: CampoFaltante[] = []

  if (campos.salida === 'obligatorio' && !ladoRelleno(borrador.activoSalida, borrador.cantidadSalida)) {
    faltan.push({ campo: 'salida', etiqueta: 'Activo y cantidad de salida' })
  }
  if (campos.entrada === 'obligatorio' && !ladoRelleno(borrador.activoEntrada, borrador.cantidadEntrada)) {
    faltan.push({ campo: 'entrada', etiqueta: 'Activo y cantidad de entrada' })
  }
  // Contravalor: se exige informado; el valor 0 es válido (p. ej. robo).
  if (campos.contravalor === 'obligatorio' && (borrador.contravalorEUR ?? '').trim() === '') {
    faltan.push({ campo: 'contravalorEUR', etiqueta: 'Contravalor en euros' })
  }
  if (campos.rectificaA === 'obligatorio' && !borrador.rectificaAUid) {
    faltan.push({ campo: 'rectificaA', etiqueta: 'Apunte que rectifica' })
  }
  if (campos.causaObligatoria && (borrador.notas ?? '').trim() === '') {
    faltan.push({ campo: 'notas', etiqueta: 'Causa de la rectificación (notas)' })
  }
  return faltan
}
