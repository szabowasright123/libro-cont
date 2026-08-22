/**
 * u7-exchange-cerrado.ts — CASO DE LA UNIDAD 7 · «Depuración y reconstrucción».
 *
 * El caso extremo del manual, y el que más se parece a la vida real de quien lleva años en
 * esto: un exchange que cerró. De aquellos años no queda ni una orden, ni un extracto, ni
 * un correo de confirmación; lo único que sobrevive son las transacciones on-chain de las
 * retiradas —porque la cadena no cierra— y los apuntes bancarios de las transferencias que
 * en su día se hicieron para comprar.
 *
 * El Libro llega, por tanto, con RETIRADAS SIN SU ADQUISICIÓN. Y eso produce tres señales
 * simultáneas que conviene ver juntas en clase, porque son tres capas distintas del mismo
 * agujero:
 *
 *   1. SALDO NEGATIVO en la ubicación del exchange cerrado (−0,5107 BTC). Un saldo negativo
 *      es imposible: es la alerta roja de «salida sin origen registrado» (DOMINIO §4).
 *   2. `saldoFifoInsuficiente` en las transmisiones que agotan la cola. Es la «trampa del
 *      coste cero» de [MT] U2.5: la porción sin lote se imputa a coste 0 y el resultado
 *      queda inflado. En la venta de 0,2 BTC de septiembre de 2025, más de 0,19 BTC no
 *      encuentran lote: el motor los imputa a coste 0 y la ganancia se dispara.
 *   3. CONCILIACIÓN FIFO↔SALDOS en rojo, con el motivo `saldo-fifo-insuficiente`.
 *
 * La lección de fondo es de derecho probatorio, no de aritmética: sin reconstruir el origen,
 * la Administración puede tomar coste 0, y quien pierde no es el exchange desaparecido.
 *
 * Contravalores: precios de mercado ASUMIDOS y redondeados, convención «(supuesto)» — BTC
 * ≈ 29.000 € (jul-2021) · 60.000 € (nov-2024) · 95.000 € (jun y sep-2025). Los precios de
 * 2017 que la solución propone para reconstruir el coste están en `solucion`, no aquí.
 *
 * Módulo de datos puro: sin React, sin Dexie.
 */
import { type Apunte, type Ubicacion, UBICACION_EXTERIOR } from '../../engine/types'
import type { JustificanteCargable } from '../repositorio'
import type { SaldoRealDeclarado } from '../import/json-backup'
import type { SubtipoPerdida } from '../tipos'
import type { CasoTaller } from './tipos'

const CERRADO = 'ExchangeQ'
const WALLET = 'ColdCard'
const KRAKEN = 'Kraken'

const UBICACIONES: Ubicacion[] = [
  {
    id: CERRADO,
    nombre: 'ExchangeQ (cerrado en 2019)',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2017-06-01T00:00:00',
    fechaCierre: '2019-04-30T00:00:00',
    extranjero: true,
    pais: 'desconocido',
    viaEvidencia: 'exchange-kyc',
    notasEvidencia:
      'Plataforma desaparecida: web caída, soporte inexistente y ninguna posibilidad de ' +
      'descargar el historial. Se dio de alta con verificación de identidad, de modo que la ' +
      'vía era KYC, pero de esa vía no queda documento alguno en poder del titular.',
    notas:
      'La ubicación se conserva en el Libro aunque ya no exista: por ella pasaron activos y ' +
      'el Libro debe poder explicar de dónde vienen los que hoy están en la wallet.',
  },
  {
    id: WALLET,
    nombre: 'ColdCard',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2019-03-01T00:00:00',
    autocustodia: true,
    viaEvidencia: 'wallet-autocustodia',
    notasEvidencia: 'Claves propias. Todas las entradas y salidas tienen su txid.',
  },
  {
    id: KRAKEN,
    nombre: 'Kraken',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2021-07-01T00:00:00',
    extranjero: true,
    pais: 'Irlanda',
    viaEvidencia: 'exchange-kyc',
    notasEvidencia: 'Cuenta actual del titular, con historial completo y descargable.',
  },
]

/**
 * Nueve apuntes que cubren seis años. Los tres primeros son el agujero: salen 0,51 BTC de
 * una ubicación en la que nunca entró nada.
 */
const APUNTES: Apunte[] = [
  {
    id: '2019-001',
    fechaHora: '2019-03-12T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: CERRADO,
    ubicacionDestino: WALLET,
    activoSalida: 'BTC',
    cantidadSalida: '0.35',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.35',
    comisionCantidad: '0.0004',
    comisionActivo: 'BTC',
    notas:
      'Retirada de urgencia el día en que la plataforma anunció que suspendía los reintegros. ' +
      'Este apunte existe porque la transacción está en la cadena, no porque haya papel.',
  },
  {
    id: '2019-002',
    fechaHora: '2019-03-20T18:30:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: CERRADO,
    ubicacionDestino: WALLET,
    activoSalida: 'BTC',
    cantidadSalida: '0.12',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.12',
    comisionCantidad: '0.0003',
    comisionActivo: 'BTC',
    notas: 'Segunda y última retirada que la plataforma llegó a procesar.',
  },
  {
    id: '2019-003',
    fechaHora: '2019-04-02T12:00:00',
    tipo: 'PERDIDA',
    ubicacionOrigen: CERRADO,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.04',
    contravalorEUR: '0',
    notas:
      'Lo que quedó dentro cuando la plataforma dejó de responder: 0,04 BTC que nunca ' +
      'salieron. Sin contraprestación (contravalor 0). Su deducibilidad está condicionada a ' +
      'requisitos y prueba, y la prueba es justamente lo que aquí falta.',
  },
  {
    id: '2021-001',
    fechaHora: '2021-07-15T10:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: WALLET,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.1',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.1',
    comisionCantidad: '0.00012',
    comisionActivo: 'BTC',
    notas: 'Vuelve una parte a un exchange con KYC para venderla.',
  },
  {
    id: '2021-002',
    fechaHora: '2021-07-20T11:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.1',
    activoEntrada: 'EUR',
    cantidadEntrada: '2900',
    comisionCantidad: '4.35',
    comisionActivo: 'EUR',
    contravalorEUR: '2900',
    notas:
      'Primera venta del histórico (supuesto: ≈ 29.000 €/BTC). Se declaró en la Renta de 2021 ' +
      'con un coste estimado a ojo que no consta en ninguna parte.',
  },
  {
    id: '2024-001',
    fechaHora: '2024-11-03T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'EUR',
    cantidadSalida: '1800',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.03',
    comisionCantidad: '2.70',
    comisionActivo: 'EUR',
    contravalorEUR: '1800',
    notas:
      'Compra reciente y perfectamente documentada (supuesto: ≈ 60.000 €/BTC). Está aquí para ' +
      'que se vea el contraste: esta sí abre lote con su coste.',
  },
  {
    id: '2025-001',
    fechaHora: '2025-06-10T11:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.02',
    activoEntrada: 'EUR',
    cantidadEntrada: '1900',
    comisionCantidad: '2.85',
    comisionActivo: 'EUR',
    contravalorEUR: '1900',
    notas:
      'Venta de junio (supuesto: ≈ 95.000 €/BTC). Consume el lote de 2024 y su resultado es ' +
      'creíble: hay coste con el que restar.',
  },
  {
    id: '2025-002',
    fechaHora: '2025-09-15T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: WALLET,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.2',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.2',
    comisionCantidad: '0.00007',
    comisionActivo: 'BTC',
    notas: 'Vuelven al exchange 0,2 BTC de los que salieron de ExchangeQ en 2019.',
  },
  {
    id: '2025-003',
    fechaHora: '2025-09-20T12:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: KRAKEN,
    ubicacionDestino: KRAKEN,
    activoSalida: 'BTC',
    cantidadSalida: '0.2',
    activoEntrada: 'EUR',
    cantidadEntrada: '19000',
    comisionCantidad: '28.50',
    comisionActivo: 'EUR',
    contravalorEUR: '19000',
    notas:
      'La venta grande del ejercicio (supuesto: ≈ 95.000 €/BTC). Mira lo que el motor calcula ' +
      'como resultado y pregúntate si es defendible.',
  },
]

/** El robo, no: lo que quedó atrapado en una plataforma que dejó de responder. */
const SUBTIPOS_PERDIDA: Readonly<Record<string, SubtipoPerdida>> = { '2019-003': 'estafa' }

/**
 * Los saldos reales a 31/12/2025. La celda del exchange cerrado es la que grita: ahí no hay
 * nada —ni puede haberlo—, y el Libro calcula −0,5107 BTC. Las otras tres cuadran, que es lo
 * que localiza el problema en un solo sitio.
 */
const CUADRE_REAL: SaldoRealDeclarado[] = [
  {
    ubicacion: CERRADO,
    activo: 'BTC',
    saldoReal: '0',
    notas: 'No hay nada que leer: la plataforma no existe. El saldo real es cero.',
  },
  { ubicacion: WALLET, activo: 'BTC', saldoReal: '0.16981', notas: 'Leído en el dispositivo.' },
  { ubicacion: KRAKEN, activo: 'BTC', saldoReal: '0.01' },
  { ubicacion: KRAKEN, activo: 'EUR', saldoReal: '21961.60' },
]

/**
 * El Archivo trae exactamente lo que a este alumno le queda: cadena y banco. Ninguna orden,
 * ningún extracto del exchange desaparecido. Los dos apuntes bancarios son la pieza con la
 * que se reconstruye el origen, y por eso están en la carpeta 01.
 */
const JUSTIFICANTES: JustificanteCargable[] = [
  {
    id: 'u7-j-2019-001-txid',
    apunteId: '2019-001',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'txid 2c77…41ab — salida de 0,35 BTC de ExchangeQ el 12/03/2019, con su comisión de red.',
  },
  {
    id: 'u7-j-2019-002-txid',
    apunteId: '2019-002',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'txid 9f30…7d52 — salida de 0,12 BTC de ExchangeQ el 20/03/2019.',
  },
  {
    id: 'u7-j-banco-2017',
    apunteId: '',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'justificante-pago',
    referenciaExterna:
      'Extracto bancario de noviembre de 2017: transferencia de 2.100,00 € a ExchangeQ el 15/11/2017.',
    notas:
      'Documento de ejercicio sin apunte asociado, porque el apunte al que debería acompañar ' +
      'todavía no existe. Es la mitad del origen que falta.',
  },
  {
    id: 'u7-j-banco-2017-dic',
    apunteId: '',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'justificante-pago',
    referenciaExterna:
      'Extracto bancario de diciembre de 2017: transferencia de 3.360,00 € a ExchangeQ el 18/12/2017.',
    notas:
      'La otra mitad, y la cara: es la semana en que el bitcoin marcó su máximo de 2017. ' +
      'Entre las dos suman todo el dinero que entró en aquella plataforma.',
  },
  {
    id: 'u7-j-2019-003-anuncio',
    apunteId: '2019-003',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'captura-anuncio',
    referenciaExterna:
      'Captura del aviso de suspensión de reintegros publicado por ExchangeQ el 28/03/2019 y del correo de soporte sin respuesta.',
  },
]

/** El caso de la Unidad 7, listo para repartir. */
export const CASO_U7: CasoTaller = {
  id: 'u7-exchange-cerrado',
  unidad: 7,
  titulo: 'El exchange que cerró',
  dificultad: 'avanzado',
  minutosEstimados: 60,
  queEnsena: [
    'La trampa del coste cero: sin origen registrado, el valor de adquisición puede ser 0.',
    'Leer las tres señales del agujero: saldo negativo, saldo FIFO insuficiente y conciliación en rojo.',
    'Reconstruir una adquisición con prueba indirecta: extracto bancario, cadena y cotización de la fecha.',
    'Dejar constancia del método seguido, que es lo que separa una estimación defendible de una invención.',
  ],
  enunciado: `Ana empezó en 2017, como tanta gente, en una plataforma que ya no existe.
Mandó dinero dos veces desde su banco, compró bitcoin, lo dejó allí y no volvió a pensar en
ello. En marzo de 2019 la plataforma anunció que suspendía los reintegros; Ana consiguió
sacar dos veces y se quedó dentro una parte pequeña que nunca recuperó. La web lleva años
caída y el soporte no responde desde entonces.

De aquella etapa no conserva ni una orden de compra, ni un extracto, ni un correo. Lo que sí
tiene es lo que la plataforma no podía llevarse: las dos transacciones on-chain de sus
retiradas y, en su banco, los dos apuntes de las transferencias que hizo para comprar. Con
eso, y con el histórico posterior en Kraken, ha montado el Libro que tienes delante.

Ábrelo y míralo antes de tocar nada. Hay una ubicación con saldo negativo, cosa que no puede
ser. Hay ventas que el motor marca con un aviso de saldo FIFO insuficiente. Y hay, sobre
todo, una venta de septiembre de 2025 cuyo resultado el Libro cifra en más de dieciocho mil
euros de ganancia. Ana ha ganado mucho, no cabe duda, pero no exactamente eso: por aquel
bitcoin pagó un dinero que salió de su cuenta corriente y que el Libro, tal y como está, no
resta en ninguna parte. Lo que ocurre es que el Libro no lo sabe.

Se te pide que reconstruyas el origen de esos bitcoin con la prueba que hay, que registres la
adquisición o adquisiciones que faltan con la fecha, la cantidad y el valor que consideres
sostenibles, y que dejes escrito en el propio Libro cómo has llegado a cada cifra y con qué
documento la respaldas. Cuando termines, el saldo negativo debe haber desaparecido, la
conciliación debe cerrar, ninguna transmisión debe quedar sin lote de coste y la ganancia de
septiembre debe ser otra.

Y una pregunta para llevarse a la sesión síncrona, porque no tiene respuesta única: los 0,04
BTC que se quedaron dentro, ¿qué son, y qué haría falta para poder computarlos?`,
  datos: {
    apuntes: APUNTES,
    ubicaciones: UBICACIONES,
    justificantes: JUSTIFICANTES,
    subtiposPerdida: SUBTIPOS_PERDIDA,
    cuadreReal: CUADRE_REAL,
  },
  solucion: {
    correcciones: [
      'Registrar primero las dos entradas de fiat que acredita el banco: 15/11/2017 · TRANSFERENCIA de 2.100,00 € y 18/12/2017 · TRANSFERENCIA de 3.360,00 €, ambas de EXTERIOR a ExchangeQ. Sin ellas, la ubicación se queda con saldo de euros negativo, que es el mismo error una capa más abajo.',
      'Registrar después las dos adquisiciones, con la fecha de cada transferencia y contravalor el importe transferido: 15/11/2017 · COMPRA de 0,3007 BTC por 2.100,00 € (supuesto: ≈ 6.984 €/BTC) y 18/12/2017 · COMPRA de 0,21 BTC por 3.360,00 € (supuesto: ≈ 16.000 €/BTC, la semana del máximo). Suman 0,5107 BTC —los 0,51 que salieron más las dos comisiones de red— y 5.460,00 € de coste.',
      'Anotar en las notas de ambas el método seguido: importe del extracto bancario como contravalor, cotización de la fecha como comprobación de la cantidad, y cantidad final cuadrada contra las retiradas on-chain de 2019 y su comisión. La cantidad no es redonda precisamente porque se ha deducido, no inventado.',
      'Comprobado el efecto: desaparece el saldo negativo de ExchangeQ (pasa a 0), la conciliación FIFO↔SALDOS cierra y ninguna transmisión queda marcada con saldo FIFO insuficiente.',
      'Los 0,04 BTC atrapados quedan como PÉRDIDA con su subtipo de estafa y su expediente probatorio incompleto: se listan aparte y no se netean sin más.',
    ],
    saldosEsperados: [
      { ubicacion: CERRADO, activo: 'BTC', saldo: '0' },
      { ubicacion: WALLET, activo: 'BTC', saldo: '0.16981' },
      { ubicacion: KRAKEN, activo: 'BTC', saldo: '0.01' },
      { ubicacion: KRAKEN, activo: 'EUR', saldo: '21961.60' },
    ],
  },
}
