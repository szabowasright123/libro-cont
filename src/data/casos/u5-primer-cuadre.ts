/**
 * u5-primer-cuadre.ts — CASO DE LA UNIDAD 5 · «Carga y primer cuadre».
 *
 * El libro recién importado del exchange, y sucio. Es el ejercicio con el que empieza todo
 * el mundo: los datos han entrado, el Libro parece completo, y el CUADRE dice que no.
 *
 * Los TRES defectos son los tres clásicos de una importación, y están puestos a propósito
 * para que cada uno se manifieste de una forma distinta:
 *
 *   A · FALTA UN APUNTE — la compra de ETH del 12/06/2025 nunca llegó al Libro (se hizo
 *       desde el móvil y quedó fuera del CSV que el alumno descargó). Efecto: sobra euro y
 *       falta éter en el saldo calculado.
 *   B · SOBRA UN DUPLICADO — la retirada de BTC a la wallet del 05/03/2025 está dos veces
 *       (el importador leyó dos ficheros que se solapaban). Efecto: el exchange parece
 *       tener menos BTC del que tiene y la wallet, más.
 *   C · UNA COMISIÓN SIN REGISTRAR — la retirada de 2.000 € al banco costó 15 € de
 *       comisión que nadie anotó. Efecto: sobran 15 € en el saldo calculado.
 *
 * Lo importante para la clase es que la CONCILIACIÓN FIFO↔SALDOS de este caso está en
 * VERDE: ninguno de los tres defectos es un error de clasificación. El CUADRE mira hacia
 * fuera —contra el exchange— y es el único que puede verlos. Es el contraste exacto con el
 * caso de la Unidad 6, donde ocurre lo contrario.
 *
 * Contravalores: precios de mercado 2025 ASUMIDOS y redondeados, con la misma convención
 * «(supuesto)» del caso de ejemplo — BTC ≈ 90.000 € (ene) · 95.000 € (abr) · 100.000 €
 * (oct); ETH ≈ 3.000 € (feb) y 3.200 € (may–sep). Ninguno procede de una fuente real.
 *
 * Módulo de datos puro: sin React, sin Dexie.
 */
import {
  type Activo,
  type Apunte,
  type Ubicacion,
  UBICACION_EXTERIOR,
} from '../../engine/types'
import type { JustificanteCargable } from '../repositorio'
import type { SaldoRealDeclarado } from '../import/json-backup'
import type { CasoTaller } from './tipos'

const EXCHANGE = 'Bitpanda'
const WALLET = 'BlueWallet'

const UBICACIONES: Ubicacion[] = [
  {
    id: EXCHANGE,
    nombre: 'Bitpanda',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2024-11-02T00:00:00',
    viaEvidencia: 'exchange-kyc',
    extranjero: true,
    pais: 'Austria',
    notasEvidencia:
      'Cuenta verificada a nombre del titular. Toda la operativa del ejercicio sale de dos ' +
      'exportaciones de su historial, que es justamente de donde vienen los problemas.',
  },
  {
    id: WALLET,
    nombre: 'BlueWallet (móvil)',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2025-03-05T00:00:00',
    autocustodia: true,
    viaEvidencia: 'wallet-autocustodia',
    notasEvidencia: 'Claves propias en el móvil. Su evidencia son los txid on-chain.',
  },
]

const ACTIVOS: Activo[] = [{ simbolo: 'ETH', nombre: 'Ethereum', decimales: 8, esFiat: false }]

/**
 * Los diez apuntes tal y como han quedado tras la importación. En orden cronológico
 * estricto (`calcularFifo` lo exige) y con los correlativos que la renumeración asignará.
 *
 * Obsérvese que ninguno es «raro» por sí solo: cada uno, mirado de cerca, está bien escrito.
 * El defecto no está en un apunte, está en el CONJUNTO —falta uno, sobra otro y a un tercero
 * le falta la comisión—, y por eso solo se ve al cuadrar.
 */
const APUNTES: Apunte[] = [
  {
    id: '2025-001',
    fechaHora: '2025-01-08T09:15:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'EUR',
    cantidadEntrada: '15000',
    notas: 'Ingreso inicial de fiat desde la cuenta bancaria (transferencia SEPA).',
  },
  {
    id: '2025-002',
    fechaHora: '2025-01-10T11:30:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '9000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.1',
    comisionCantidad: '13.50',
    comisionActivo: 'EUR',
    contravalorEUR: '9000',
    notas: 'Compra de 0,1 BTC (supuesto: ≈ 90.000 €/BTC). La comisión en EUR suma al coste del lote.',
  },
  {
    id: '2025-003',
    fechaHora: '2025-02-12T10:05:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '1500',
    activoEntrada: 'ETH',
    cantidadEntrada: '0.5',
    comisionCantidad: '2.25',
    comisionActivo: 'EUR',
    contravalorEUR: '1500',
    notas: 'Compra de 0,5 ETH (supuesto: ≈ 3.000 €/ETH).',
  },
  {
    id: '2025-004',
    fechaHora: '2025-03-05T11:40:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: WALLET,
    activoSalida: 'BTC',
    cantidadSalida: '0.03',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.03',
    comisionCantidad: '0.00008',
    comisionActivo: 'BTC',
    notas: 'Primera retirada a autocustodia. txid en el Archivo.',
  },
  {
    id: '2025-005',
    // DEFECTO B — el mismo movimiento, siete minutos después y con la misma comisión. No
    // existe: el importador procesó dos exportaciones con el rango de fechas solapado.
    fechaHora: '2025-03-05T11:47:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: WALLET,
    activoSalida: 'BTC',
    cantidadSalida: '0.03',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.03',
    comisionCantidad: '0.00008',
    comisionActivo: 'BTC',
    notas: 'Retirada a autocustodia.',
  },
  {
    id: '2025-006',
    fechaHora: '2025-04-18T16:20:00',
    tipo: 'VENTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'BTC',
    cantidadSalida: '0.01',
    activoEntrada: 'EUR',
    cantidadEntrada: '950',
    comisionCantidad: '1.43',
    comisionActivo: 'EUR',
    contravalorEUR: '950',
    notas: 'Venta parcial de BTC (supuesto: ≈ 95.000 €/BTC). La comisión en EUR minora el valor de transmisión.',
  },
  {
    id: '2025-007',
    fechaHora: '2025-05-20T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'ETH',
    cantidadEntrada: '0.004',
    contravalorEUR: '12.80',
    notas: 'Recompensa de staking de ETH acreditada en el exchange (supuesto: ≈ 3.200 €/ETH).',
  },
  {
    id: '2025-008',
    // DEFECTO C — la retirada existe y su importe es correcto, pero el exchange cobró 15 €
    // de comisión que no aparecen en la exportación (van en una línea aparte del extracto).
    fechaHora: '2025-07-02T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'EUR',
    cantidadSalida: '2000',
    notas: 'Retirada de 2.000 € a la cuenta bancaria.',
  },
  {
    id: '2025-009',
    fechaHora: '2025-09-15T17:10:00',
    tipo: 'VENTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'ETH',
    cantidadSalida: '0.2',
    activoEntrada: 'EUR',
    cantidadEntrada: '640',
    comisionCantidad: '0.96',
    comisionActivo: 'EUR',
    contravalorEUR: '640',
    notas: 'Venta parcial de ETH (supuesto: ≈ 3.200 €/ETH).',
  },
  {
    id: '2025-010',
    fechaHora: '2025-10-20T10:30:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '900',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.009',
    comisionCantidad: '1.35',
    comisionActivo: 'EUR',
    contravalorEUR: '900',
    notas: 'Recompra de BTC en octubre (supuesto: ≈ 100.000 €/BTC).',
  },
]

/**
 * Los saldos REALES a 31/12/2025: los que el alumno lee en el panel de Bitpanda y en su
 * móvil. Son la VERDAD, y no coinciden con lo calculado en ninguna de las cuatro celdas:
 * el CUADRE de este caso sale entero en ROJO y ahí empieza el ejercicio.
 */
const CUADRE_REAL: SaldoRealDeclarado[] = [
  {
    ubicacion: EXCHANGE,
    activo: 'EUR',
    saldoReal: '1653.26',
    notas: 'Panel de saldos de Bitpanda a 31/12/2025.',
  },
  { ubicacion: EXCHANGE, activo: 'BTC', saldoReal: '0.06892', notas: 'Panel de saldos de Bitpanda a 31/12/2025.' },
  { ubicacion: EXCHANGE, activo: 'ETH', saldoReal: '0.804', notas: 'Panel de saldos de Bitpanda a 31/12/2025.' },
  { ubicacion: WALLET, activo: 'BTC', saldoReal: '0.03', notas: 'Leído en la app del móvil (BlueWallet).' },
]

/**
 * El Archivo llega A MEDIAS, que es parte del ejercicio. Se siembran solo tres piezas, y
 * dos de ellas son las que resuelven el caso si se leen con atención: el extracto bancario
 * dice cuánto se abonó de verdad, y el extracto anual del exchange es la fuente contra la
 * que se contrasta todo. La tercera es el txid de la retirada que sí existe —uno solo, no
 * dos—.
 */
const JUSTIFICANTES: JustificanteCargable[] = [
  {
    id: 'u5-j-004-txid',
    apunteId: '2025-004',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna:
      'txid 8a1e…c2f0 — captura del explorador con la salida de 0,03 BTC del 05/03/2025 y su comisión de red.',
    notas: 'Del 5 de marzo hay UNA transacción en la cadena. Conviene contarlas.',
  },
  {
    id: 'u5-j-008-banco',
    apunteId: '2025-008',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna:
      'Extracto bancario de julio de 2025: abono de 1.985,00 € procedente de Bitpanda el 02/07/2025.',
    notas: 'El importe abonado y el importe retirado no son el mismo número.',
  },
  {
    id: 'u5-j-extracto-anual',
    apunteId: '',
    rutaConvencional: '05-certificados',
    tipoDocumento: 'certificado-anual',
    referenciaExterna:
      'Bitpanda › Extracto anual 2025 (PDF): resumen de operaciones, comisiones y saldos a 31/12/2025.',
    notas:
      'Documento de ejercicio, sin apunte asociado. Es la fuente contra la que se contrasta ' +
      'el Libro entero: lo que el exchange dice que pasó.',
  },
]

/** El caso de la Unidad 5, listo para repartir. */
export const CASO_U5: CasoTaller = {
  id: 'u5-primer-cuadre',
  unidad: 5,
  titulo: 'Carga y primer cuadre',
  dificultad: 'introductorio',
  minutosEstimados: 30,
  queEnsena: [
    'Cargar un histórico y no dar por bueno lo que entra.',
    'Leer el semáforo del CUADRE celda a celda: verde, ámbar y rojo.',
    'Los tres defectos típicos de una importación: falta un apunte, sobra un duplicado, falta una comisión.',
    'Por qué el CUADRE mira hacia fuera y la conciliación FIFO↔SALDOS mira hacia dentro.',
  ],
  enunciado: `Marta acaba de terminar la Unidad 4 y ha hecho lo que se le pidió: exportar el
historial completo de su exchange y volcarlo al Libro. Ha exportado dos veces —una en verano
y otra en enero, «por si acaso»— y ha importado los dos ficheros. Al abrir la sección de
Cuadre y teclear los saldos que ve en el panel de Bitpanda y en su móvil, ninguna de las
cuatro celdas se pone en verde.

Su reacción es la que tenemos todos la primera vez: pensar que la aplicación calcula mal.
No calcula mal. El Libro dice exactamente lo que le han contado, y lo que le han contado no
es lo que pasó. El trabajo de esta unidad consiste en averiguar en qué se diferencian las
dos cosas.

Tienes su Libro tal y como quedó tras la importación: diez apuntes de 2025, dos ubicaciones
y los saldos reales ya declarados en el Cuadre. En el Archivo hay solo tres documentos: el
identificador on-chain de una retirada, el extracto bancario de julio y el extracto anual
que el exchange emite a 31 de diciembre. No es mucho, pero es suficiente.

Se te pide que dejes el CUADRE entero en verde sin tocar los saldos reales declarados —esos
son el dato, no la incógnita— y que anotes, para cada corrección, en qué documento te has
apoyado. Cuando termines, mira además la conciliación entre la cola FIFO y los saldos: fíjate
en qué estaba diciendo mientras el CUADRE estaba en rojo, y pregúntate por qué.`,
  datos: {
    apuntes: APUNTES,
    ubicaciones: UBICACIONES,
    activos: ACTIVOS,
    justificantes: JUSTIFICANTES,
    cuadreReal: CUADRE_REAL,
  },
  solucion: {
    correcciones: [
      'Eliminar el apunte duplicado del 05/03/2025 (la segunda retirada de 0,03 BTC a BlueWallet): en la cadena solo hay una transacción ese día.',
      'Registrar la compra que falta: 12/06/2025, COMPRA de 0,5 ETH por 1.500 € en Bitpanda con 2,25 € de comisión en EUR (contravalor 1.500 €). Aparece en el extracto anual y no en la exportación que el alumno importó.',
      'Añadir la comisión de 15 € en EUR a la retirada del 02/07/2025: el banco abonó 1.985 € y el Libro anotó 2.000 € de salida sin comisión.',
    ],
    saldosEsperados: [
      { ubicacion: EXCHANGE, activo: 'EUR', saldo: '1653.26' },
      { ubicacion: EXCHANGE, activo: 'BTC', saldo: '0.06892' },
      { ubicacion: EXCHANGE, activo: 'ETH', saldo: '0.804' },
      { ubicacion: WALLET, activo: 'BTC', saldo: '0.03' },
    ],
  },
}
