/**
 * plantillas.ts — plantillas rápidas del formulario (enunciado P2, punto 5).
 *
 * Prerrellenan un borrador con el esqueleto típico de una operación frecuente para
 * ahorrar tecleo. NO calculan nada ni fijan importes: dejan las cantidades y el
 * contravalor en blanco para que el alumno los complete. Las ubicaciones quedan sin
 * asignar (salvo la frontera EXTERIOR, que es inequívoca) para que se elijan del
 * catálogo del alumno.
 */
import type { TipoOperacion } from '../../engine/types'
import { UBICACION_EXTERIOR } from '../../engine/types'
import type { BorradorApunte } from '../../data/tipos'

/** Una plantilla rápida: etiqueta + borrador base. */
export interface PlantillaRapida {
  clave: string
  etiqueta: string
  descripcion: string
  tipo: TipoOperacion
  /** Genera el borrador base (sin uid/id). */
  crear: () => BorradorApunte
}

/** Borrador vacío con un tipo dado (ubicaciones sin asignar). */
function borradorBase(tipo: TipoOperacion): BorradorApunte {
  return {
    fechaHora: '',
    tipo,
    ubicacionOrigen: '',
    ubicacionDestino: '',
  }
}

/** Catálogo de plantillas rápidas. */
export const PLANTILLAS: PlantillaRapida[] = [
  {
    clave: 'compra-exchange',
    etiqueta: 'Compra en exchange',
    descripcion: 'COMPRA de BTC pagando en EUR, con comisión en EUR.',
    tipo: 'COMPRA',
    crear: () => ({
      ...borradorBase('COMPRA'),
      activoSalida: 'EUR',
      activoEntrada: 'BTC',
      comisionActivo: 'EUR',
      notas: 'Compra BTC en exchange.',
    }),
  },
  {
    clave: 'envio-wallet-fria',
    etiqueta: 'Envío a wallet fría',
    descripcion: 'TRANSFERENCIA de BTC del exchange a una wallet propia, con comisión de red.',
    tipo: 'TRANSFERENCIA',
    crear: () => ({
      ...borradorBase('TRANSFERENCIA'),
      activoSalida: 'BTC',
      activoEntrada: 'BTC',
      comisionActivo: 'BTC',
      notas: 'Envío a wallet fría (transferencia interna).',
    }),
  },
  {
    clave: 'recompensa-staking',
    etiqueta: 'Recompensa de staking',
    descripcion: 'RENDIMIENTO: entra un activo desde la frontera EXTERIOR (RCM).',
    tipo: 'RENDIMIENTO',
    crear: () => ({
      ...borradorBase('RENDIMIENTO'),
      ubicacionOrigen: UBICACION_EXTERIOR,
      activoEntrada: 'BTC',
      notas: 'Recompensa de staking (RCM art. 25.2 LIRPF).',
    }),
  },
]
