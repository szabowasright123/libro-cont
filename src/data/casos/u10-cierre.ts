/**
 * u10-cierre.ts — CASO DE LA UNIDAD 10 · «Cierre del ejercicio».
 *
 * Un libro LISTO PARA CERRAR. No hay defectos que depurar: el CUADRE sale en verde, la
 * conciliación FIFO↔SALDOS cierra en cero y `validarDiario` no arroja ningún error. Lo que
 * hay son las tres decisiones que se toman el 31 de diciembre y no antes, y las tres están
 * puestas en el filo:
 *
 *   1. EL UMBRAL DEL 721, A 141,53 € DE DISTANCIA. Con los precios de cierre que el alumno
 *      trae (BTC 105.000 €, USDC 0,92 €), el saldo del exchange radicado en el extranjero
 *      vale 49.858,47 € a 31/12/2026: por debajo de los 50.000 €. Con una cotización de
 *      cierre apenas mil euros más alta —y hay fuentes que la dan— el mismo saldo supera el
 *      umbral. La lección no es cuál es la cifra buena, sino que la respuesta depende de una
 *      elección que hay que hacer, documentar y poder defender.
 *   2. QUÉ COMPUTA Y QUÉ NO. Los 0,6 BTC de la wallet de autocustodia valen 63.000 € y no
 *      entran en el cómputo: el 721 informa de monedas custodiadas por terceros que
 *      gestionan claves ajenas (FAQ AEAT). Quien sume todo lo que tiene declarará de más.
 *   3. LA FECHA DE CORTE. El último apunte del Libro entra a las 23:40 del 31 de diciembre.
 *      Cambia el saldo del ejercicio que se cierra y no el del siguiente, y es la clase de
 *      movimiento que se pierde cuando el histórico se descarga el día 2 de enero.
 *
 * Queda además un hueco deliberado en el Archivo: la permuta de septiembre no lleva su
 * justificante de valor de mercado, y el informe de completitud del cierre lo señala. Es el
 * recordatorio de que cerrar no es solo cuadrar números.
 *
 * Contravalores: precios de mercado 2026 ASUMIDOS y redondeados, convención «(supuesto)» —
 * BTC ≈ 80.000 € (ene) · 88.000 € (abr) · 95.000 € (jul) · 98.000 € (sep) · 105.000 € (dic);
 * USDC ≈ 0,92 €.
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
import type { PrecioRegistro } from '../tipos'
import type { CasoTaller } from './tipos'

const EXCHANGE = 'Bitvavo'
const WALLET = 'SeedSigner'

const UBICACIONES: Ubicacion[] = [
  {
    id: EXCHANGE,
    nombre: 'Bitvavo',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2025-12-01T00:00:00',
    viaEvidencia: 'exchange-kyc',
    extranjero: true,
    pais: 'Países Bajos',
    notasEvidencia:
      'Custodio no establecido en España: sus saldos entran en el cómputo del aviso del ' +
      'modelo 721 a 31 de diciembre.',
  },
  {
    id: WALLET,
    nombre: 'SeedSigner (autocustodia)',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2026-03-12T00:00:00',
    autocustodia: true,
    viaEvidencia: 'wallet-autocustodia',
    notasEvidencia:
      'Claves propias, sin tercero que las gestione. Fuera del perímetro del 721 por mucho ' +
      'que sea la mayor parte del patrimonio.',
  },
]

const ACTIVOS: Activo[] = [{ simbolo: 'USDC', nombre: 'USD Coin', decimales: 6, esFiat: false }]

/** Diez apuntes de 2026, en orden cronológico estricto y sin errores. */
const APUNTES: Apunte[] = [
  {
    id: '2026-001',
    fechaHora: '2026-01-05T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'EUR',
    cantidadEntrada: '95000',
    notas: 'Ingreso del ahorro acumulado tras la venta de un inmueble heredado.',
  },
  {
    id: '2026-002',
    fechaHora: '2026-01-08T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '64000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.8',
    comisionCantidad: '96',
    comisionActivo: 'EUR',
    contravalorEUR: '64000',
    notas: 'Compra principal del ejercicio: 0,8 BTC (supuesto: ≈ 80.000 €/BTC).',
  },
  {
    id: '2026-003',
    fechaHora: '2026-03-12T17:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: WALLET,
    activoSalida: 'BTC',
    cantidadSalida: '0.6',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.6',
    comisionCantidad: '0.00009',
    comisionActivo: 'BTC',
    notas:
      'Paso a autocustodia de la mayor parte de la posición. A partir de aquí, la mayor ' +
      'parte del patrimonio deja de estar en el perímetro del 721 y no vuelve a entrar.',
  },
  {
    id: '2026-004',
    fechaHora: '2026-04-20T11:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '22000',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.25',
    comisionCantidad: '33',
    comisionActivo: 'EUR',
    contravalorEUR: '22000',
    notas: 'Segunda compra (supuesto: ≈ 88.000 €/BTC).',
  },
  {
    id: '2026-005',
    fechaHora: '2026-06-30T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'USDC',
    cantidadEntrada: '20',
    contravalorEUR: '18.40',
    notas: 'Interés semestral del saldo en USDC (RCM del art. 25.2 LIRPF).',
  },
  {
    id: '2026-006',
    fechaHora: '2026-07-15T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'BTC',
    cantidadSalida: '0.08',
    activoEntrada: 'EUR',
    cantidadEntrada: '7600',
    comisionCantidad: '11.40',
    comisionActivo: 'EUR',
    contravalorEUR: '7600',
    notas: 'Venta parcial de julio (supuesto: ≈ 95.000 €/BTC).',
  },
  {
    id: '2026-007',
    fechaHora: '2026-09-10T13:00:00',
    tipo: 'PERMUTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'BTC',
    cantidadSalida: '0.05',
    activoEntrada: 'USDC',
    cantidadEntrada: '5200',
    valorMercadoEntregadoEUR: '4900.00',
    valorMercadoRecibidoEUR: '4784.00',
    contravalorEUR: '4900.00',
    notas:
      'Permuta de 0,05 BTC por 5.200 USDC (supuestos: ≈ 98.000 €/BTC y ≈ 0,92 €/USDC). El ' +
      'art. 37.1.h) LIRPF cuantifica por el MAYOR de los dos valores de mercado: aquí es lo ' +
      'entregado (4.900,00 € frente a 4.784,00 €), y ese mismo importe es el coste del lote ' +
      'de USDC que nace.',
  },
  {
    id: '2026-008',
    fechaHora: '2026-11-05T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'EUR',
    cantidadSalida: '5000',
    notas: 'Retirada de 5.000 € a la cuenta bancaria para gastos del año.',
  },
  {
    id: '2026-009',
    fechaHora: '2026-12-20T10:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '5250',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.05',
    comisionCantidad: '7.88',
    comisionActivo: 'EUR',
    contravalorEUR: '5250',
    notas:
      'Última compra del ejercicio (supuesto: ≈ 105.000 €/BTC). Entra en el saldo que se ' +
      'valora a 31 de diciembre, y por poco.',
  },
  {
    id: '2026-010',
    // El apunte del último día. Cambia el saldo del ejercicio que se cierra y de ningún otro.
    fechaHora: '2026-12-31T23:40:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'USDC',
    cantidadEntrada: '15',
    contravalorEUR: '13.80',
    notas:
      'Interés del segundo semestre, acreditado a las 23:40 del 31 de diciembre. Está dentro ' +
      'del ejercicio por veinte minutos: quien descargue su histórico el 2 de enero con el ' +
      'filtro puesto en «último mes» puede perderlo.',
  },
]

/** Saldos reales a 31/12/2026: coinciden con los calculados. El Libro llega cuadrado. */
const CUADRE_REAL: SaldoRealDeclarado[] = [
  { ubicacion: EXCHANGE, activo: 'EUR', saldoReal: '6201.72', notas: 'Panel de Bitvavo a 31/12/2026.' },
  { ubicacion: EXCHANGE, activo: 'BTC', saldoReal: '0.36991' },
  { ubicacion: EXCHANGE, activo: 'USDC', saldoReal: '5235' },
  { ubicacion: WALLET, activo: 'BTC', saldoReal: '0.6', notas: 'Verificado en el dispositivo.' },
]

/**
 * Precios de cierre que el alumno ha tecleado. Son UNA fuente, no LA fuente: la parte
 * interesante del ejercicio es qué pasa si se cambia el primero de ellos.
 */
const PRECIOS: PrecioRegistro[] = [
  { activo: 'BTC', precioEur: '105000', fechaISO: '2026-12-31' },
  { activo: 'USDC', precioEur: '0.92', fechaISO: '2026-12-31' },
]

/**
 * Archivo casi completo. Falta a propósito el justificante de valor de mercado de la permuta
 * de septiembre: es el hueco que el informe de completitud del cierre debe sacar a la luz.
 */
const JUSTIFICANTES: JustificanteCargable[] = [
  {
    id: 'u10-j-002-orden',
    apunteId: '2026-002',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bitvavo › orden BTC/EUR ejecutada el 08/01/2026 (PDF).',
  },
  {
    id: 'u10-j-002-extracto',
    apunteId: '2026-002',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'extracto-exchange',
    referenciaExterna: 'Bitvavo › extracto de enero de 2026 con el cargo de 64.000 € y su comisión.',
  },
  {
    id: 'u10-j-003-txid',
    apunteId: '2026-003',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'txid-transferencia',
    referenciaExterna: 'txid 5b12…08ee — salida de 0,6 BTC hacia la dirección propia (12/03/2026).',
  },
  {
    id: 'u10-j-003-titularidad',
    apunteId: '2026-003',
    rutaConvencional: '02-transferencias',
    tipoDocumento: 'titularidad-destino',
    referenciaExterna: 'Mensaje firmado desde la dirección de recepción, acreditando su titularidad.',
  },
  {
    id: 'u10-j-004-orden',
    apunteId: '2026-004',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bitvavo › orden BTC/EUR ejecutada el 20/04/2026 (PDF).',
  },
  {
    id: 'u10-j-006-orden',
    apunteId: '2026-006',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bitvavo › orden de venta BTC/EUR del 15/07/2026 (PDF).',
  },
  {
    id: 'u10-j-007-permuta',
    apunteId: '2026-007',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-permuta',
    referenciaExterna: 'Bitvavo › comprobante del intercambio BTC→USDC del 10/09/2026, con ambas patas.',
    // Falta a propósito el `valor-mercado` de este apunte: es el hueco del Archivo que el
    // cierre debe detectar.
  },
  {
    id: 'u10-j-009-orden',
    apunteId: '2026-009',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bitvavo › orden BTC/EUR ejecutada el 20/12/2026 (PDF).',
  },
  {
    id: 'u10-j-cert-anual',
    apunteId: '',
    rutaConvencional: '05-certificados',
    tipoDocumento: 'certificado-anual',
    referenciaExterna:
      'Bitvavo › certificado anual 2026 de operaciones y saldos, con el saldo a 31/12 a las 23:59.',
    notas: 'Documento de ejercicio: la foto oficial contra la que se contrasta el cierre.',
  },
]

/** El caso de la Unidad 10, listo para repartir. */
export const CASO_U10: CasoTaller = {
  id: 'u10-cierre-ejercicio',
  unidad: 10,
  titulo: 'Cierre del ejercicio, al borde del umbral',
  dificultad: 'medio',
  minutosEstimados: 45,
  queEnsena: [
    'La foto del cierre: saldos, cotizaciones y conciliación a una fecha fija.',
    'El aviso del modelo 721 a un pelo del umbral, y de qué depende quedarse a un lado o al otro.',
    'Qué computa y qué no: la autocustodia queda fuera por mucho que sea la mayor parte.',
    'La fecha de corte manda: un apunte de las 23:40 del 31 de diciembre es del ejercicio que cierra.',
    'Cerrar no es solo cuadrar: el expediente probatorio también se cierra.',
  ],
  enunciado: `Es 2 de enero de 2027 y Pablo va a cerrar su ejercicio 2026. Su Libro está
bien: cuadra celda a celda, la cola FIFO concilia con los saldos y no hay ningún aviso de
error. Podría dar el año por terminado en cinco minutos. No debería.

Pablo tiene su bitcoin repartido entre un exchange radicado en los Países Bajos y una wallet
de autocustodia a la que pasó la mayor parte en marzo. Ha comprado dos veces, ha vendido una,
ha permutado bitcoin por dólares digitales en septiembre y ha vuelto a comprar el 20 de
diciembre. El último apunte del año entró a las 23:40 del 31 de diciembre.

Se te pide que hagas el cierre completo. Primero, la foto: fija la fecha de corte, teclea las
cotizaciones de cierre con su fuente y comprueba que la conciliación a tres columnas —lo que
dice el Libro, lo que dice la fuente y lo que dice la cola— cierra en las tres.

Después, el aviso del modelo 721. Calcula el saldo que computa y mira bien la cifra que
sale, porque este año está a menos de doscientos euros del umbral. Prueba entonces a hacer
una cosa: cambia la cotización de cierre del bitcoin por otra de una fuente distinta, de las
que se diferencian en un uno por ciento, y vuelve a mirar. Lo que ocurra te va a decir por
qué el manual insiste tanto en documentar de dónde sale cada precio. Y no te olvides de
comprobar qué parte del patrimonio de Pablo entra en ese cómputo y qué parte no, ni de mirar
con lupa el apunte de las 23:40.

Por último, repasa el expediente. Hay un apunte cuyo Archivo está incompleto y el cierre lo
señala. Localízalo, di qué documento le falta y explica qué pasaría si dentro de tres años
alguien pidiera justificar precisamente ese número.`,
  datos: {
    apuntes: APUNTES,
    ubicaciones: UBICACIONES,
    activos: ACTIVOS,
    justificantes: JUSTIFICANTES,
    precios: PRECIOS,
    cuadreReal: CUADRE_REAL,
  },
  solucion: {
    correcciones: [
      'No hay errores en el Libro: el ejercicio consiste en cerrar bien, no en depurar.',
      'Saldo computable para el aviso 721 a 31/12/2026 con las cotizaciones del caso: 6.201,72 € (EUR) + 38.840,55 € (0,36991 BTC × 105.000 €) + 4.816,20 € (5.235 USDC × 0,92 €) = 49.858,47 €. Queda 141,53 € por debajo del umbral de 50.000 €.',
      'Con una cotización de cierre de 106.000 €/BTC —diferencia de menos del 1 %— el mismo saldo asciende a 50.228,38 € y SUPERA el umbral. De ahí la exigencia de documentar la fuente y la hora del precio.',
      'Los 0,6 BTC de la wallet de autocustodia (63.000 € a la cotización del caso) NO computan: el 721 informa de monedas custodiadas por terceros que gestionan claves ajenas (FAQ AEAT).',
      'El apunte de las 23:40 del 31/12/2026 pertenece al ejercicio que se cierra: sus 15 USDC están dentro del saldo valorado.',
      'Falta en el Archivo el justificante de valor de mercado de la permuta de 10/09/2026: es el número por el que se tributó y es el único que no tiene respaldo propio.',
    ],
    saldosEsperados: [
      { ubicacion: EXCHANGE, activo: 'EUR', saldo: '6201.72' },
      { ubicacion: EXCHANGE, activo: 'BTC', saldo: '0.36991' },
      { ubicacion: EXCHANGE, activo: 'USDC', saldo: '5235' },
      { ubicacion: WALLET, activo: 'BTC', saldo: '0.6' },
    ],
    fiscalEsperado: [{ ejercicio: 2026, concepto: '721.totalValorado', importeEUR: '49858.47' }],
  },
}
