/**
 * u6-clasificacion.ts — CASO DE LA UNIDAD 6 · «Clasificación y sus atributos».
 *
 * El caso opuesto al de la Unidad 5. Aquí el CUADRE sale ENTERO EN VERDE —los saldos
 * calculados coinciden al céntimo de satoshi con los del exchange y los de la wallet— y sin
 * embargo el Libro está mal. Es el «error invisible» de [MT] U6.2, y es el motivo de que la
 * app tenga dos comprobaciones distintas y no una:
 *
 *   · el CUADRE compara el saldo calculado con el saldo REAL declarado: mira hacia FUERA
 *     y solo caza lo que falta o lo que sobra;
 *   · la CONCILIACIÓN FIFO↔SALDOS compara el saldo calculado con las existencias vivas de
 *     la cola: mira hacia DENTRO y caza los errores de clasificación.
 *
 * Los dos defectos del caso están elegidos para que uno se vea y el otro no:
 *
 *   A · EL ERROR INVISIBLE — las tres recompensas del minero doméstico (2025-004, 2025-007
 *       y 2025-008) están anotadas como RENDIMIENTO cuando son MINERÍA. Los dos tipos son
 *       asimétricos, los dos abren lote y ninguno tiene lado de salida: SALDOS, FIFO,
 *       CUADRE y conciliación dan EXACTAMENTE lo mismo con uno o con otro. Lo único que
 *       cambia es el cajón fiscal —rendimiento del capital mobiliario (base del ahorro)
 *       frente a rendimiento de actividad económica (base general)— y, con él, la base
 *       imponible. Ninguna comprobación del Libro lo detecta: hay que saberlo.
 *   B · LA DONACIÓN SIN SENTIDO — 2025-011 es una DONACIÓN sin decir si es entregada o
 *       recibida. DONACIÓN es uno de los dos tipos con flags «según el caso», de modo que
 *       sin `sentido` el motor no mueve la cola: el saldo baja 0,005 BTC y las existencias
 *       no. La conciliación lo marca en rojo y dice por qué. Este sí se ve —desde la
 *       v1.6.0—, y es la mitad de la lección: el atributo no es un adorno del apunte.
 *
 * Contravalores: precios de mercado 2025 ASUMIDOS y redondeados, convención «(supuesto)» —
 * BTC ≈ 90.000 € (ene–feb) · 94.000 € (abr) · 95.000 € (may) · 92.000 € (jul) · 96.000 €
 * (sep) · 98.000 € (nov); ETH ≈ 3.000 €; TKA ≈ 0,30 € en el reparto.
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

const EXCHANGE = 'Coinbase'
const WALLET = 'WalletNodo'

const UBICACIONES: Ubicacion[] = [
  {
    id: EXCHANGE,
    nombre: 'Coinbase',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2024-06-01T00:00:00',
    viaEvidencia: 'exchange-kyc',
    extranjero: true,
    pais: 'Irlanda',
    notasEvidencia: 'Cuenta verificada. Órdenes y extractos descargables.',
  },
  {
    id: WALLET,
    nombre: 'Wallet del nodo',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2025-02-01T00:00:00',
    autocustodia: true,
    viaEvidencia: 'mineria-propia',
    notasEvidencia:
      'Dirección de cobro del equipo doméstico de minería y destino de las retiradas del ' +
      'exchange. Su evidencia son los informes del pool y los txid.',
  },
]

const ACTIVOS: Activo[] = [
  { simbolo: 'ETH', nombre: 'Ethereum', decimales: 8, esFiat: false },
  { simbolo: 'TKA', nombre: 'Token A (protocolo de ejemplo)', decimales: 8, esFiat: false },
]

/**
 * Doce apuntes en orden cronológico estricto. Todos superan la validación de coherencia
 * campos↔tipo salvo la donación, que la v1.6.0 bloquea expresamente por falta de sentido:
 * el resto del caso está escrito para que NADA chirríe a simple vista.
 */
const APUNTES: Apunte[] = [
  {
    id: '2025-001',
    fechaHora: '2025-01-09T10:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'EUR',
    cantidadEntrada: '5000',
    notas: 'Ingreso de fiat para la operativa del año.',
  },
  {
    id: '2025-002',
    fechaHora: '2025-01-15T11:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '4500',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.05',
    comisionCantidad: '6.75',
    comisionActivo: 'EUR',
    contravalorEUR: '4500',
    notas: 'Compra de 0,05 BTC (supuesto: ≈ 90.000 €/BTC).',
  },
  {
    id: '2025-003',
    fechaHora: '2025-02-01T09:30:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: WALLET,
    activoSalida: 'BTC',
    cantidadSalida: '0.04',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.04',
    comisionCantidad: '0.00006',
    comisionActivo: 'BTC',
    notas: 'Retirada a la wallet del nodo, que es también la dirección de cobro del minero.',
  },
  {
    id: '2025-004',
    // DEFECTO A, primer corte. Es MINERÍA: hay ordenación por cuenta propia de medios de
    // producción (un equipo, su electricidad y su mantenimiento). Anotado como RENDIMIENTO
    // cuadra igual y tributa en el cajón equivocado.
    fechaHora: '2025-02-28T23:50:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: WALLET,
    activoEntrada: 'BTC',
    cantidadEntrada: '0.0009',
    contravalorEUR: '81.00',
    notas:
      'Liquidación de febrero del pool: 0,0009 BTC acreditados en la dirección del equipo ' +
      '(supuesto: ≈ 90.000 €/BTC). El equipo es un ASIC doméstico que el titular compró, ' +
      'instaló y paga de su bolsillo.',
  },
  {
    id: '2025-005',
    fechaHora: '2025-03-15T12:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '300',
    activoEntrada: 'ETH',
    cantidadEntrada: '0.1',
    comisionCantidad: '0.45',
    comisionActivo: 'EUR',
    contravalorEUR: '300',
    notas: 'Compra pequeña de ETH para probar el staking del exchange (supuesto: ≈ 3.000 €/ETH).',
  },
  {
    id: '2025-006',
    // Este SÍ es un RENDIMIENTO: cesión de capital a un tercero que lo gestiona. Está aquí
    // para que el alumno tenga con qué comparar los tres cortes del minero.
    fechaHora: '2025-03-31T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'ETH',
    cantidadEntrada: '0.002',
    contravalorEUR: '6.00',
    notas:
      'Recompensa del programa de staking de Coinbase: el titular cede el ETH y la plataforma ' +
      'hace todo lo demás. RCM del art. 25.2 LIRPF (V1766-22, V0612-26).',
  },
  {
    id: '2025-007',
    // DEFECTO A, segundo corte.
    fechaHora: '2025-04-30T23:50:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: WALLET,
    activoEntrada: 'BTC',
    cantidadEntrada: '0.0009',
    contravalorEUR: '84.60',
    notas: 'Liquidación de abril del pool (supuesto: ≈ 94.000 €/BTC).',
  },
  {
    id: '2025-008',
    // DEFECTO A, tercer corte.
    fechaHora: '2025-05-31T23:50:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: WALLET,
    activoEntrada: 'BTC',
    cantidadEntrada: '0.0009',
    contravalorEUR: '85.50',
    notas: 'Liquidación de mayo del pool (supuesto: ≈ 95.000 €/BTC). El equipo dejó de minar en junio.',
  },
  {
    id: '2025-009',
    fechaHora: '2025-06-20T13:00:00',
    tipo: 'AIRDROP',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'TKA',
    cantidadEntrada: '500',
    contravalorEUR: '150.00',
    evento: 'AIRDROP_CONDICIONADO',
    criterioAplicado:
      'Reparto CONDICIONADO: solo lo recibieron las direcciones que habían usado el protocolo ' +
      'durante el año anterior. Se aplica el tratamiento de AIRDROP —ganancia patrimonial no ' +
      'derivada de transmisión, base general (DGT 0018-23, no vinculante)— y no el de una ' +
      'contraprestación por servicios, porque el titular operó por interés propio y no por ' +
      'encargo ni a cambio de precio. Sin criterio administrativo publicado para el reparto ' +
      'condicionado: criterio propio, fechado y archivado.',
    notas:
      'Reparto de 500 TKA (supuesto: ≈ 0,30 €/TKA el día del abono). Es la operación AMBIGUA ' +
      'del caso: quien entienda que hubo una actividad ordenada detrás llegará a otro cajón.',
  },
  {
    id: '2025-010',
    fechaHora: '2025-07-12T18:00:00',
    tipo: 'PAGO',
    ubicacionOrigen: WALLET,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.001',
    contravalorEUR: '92.00',
    notas:
      'Pago de la factura anual del hosting del nodo, 92,00 € (supuesto: ≈ 92.000 €/BTC). ' +
      'Sale bitcoin del patrimonio contra una factura: es una transmisión, como una venta ' +
      'cuyo precio es esa factura. La segunda operación ambigua del caso.',
  },
  {
    id: '2025-011',
    // DEFECTO B — falta el sentido. Sin él, `resolverFlags` deja el apunte sin resolver, la
    // cola FIFO no se toca y las existencias quedan 0,005 BTC por encima del saldo.
    fechaHora: '2025-09-05T11:00:00',
    tipo: 'DONACION',
    ubicacionOrigen: WALLET,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.005',
    contravalorEUR: '480.00',
    notas:
      'Donación de 0,005 BTC entre el titular y un familiar (supuesto: ≈ 96.000 €/BTC). El ' +
      'apunte se grabó deprisa y quedó sin indicar en qué dirección va la donación.',
  },
  {
    id: '2025-012',
    fechaHora: '2025-11-15T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'BTC',
    cantidadSalida: '0.005',
    activoEntrada: 'EUR',
    cantidadEntrada: '490',
    comisionCantidad: '0.74',
    comisionActivo: 'EUR',
    contravalorEUR: '490',
    notas: 'Venta parcial de BTC en noviembre (supuesto: ≈ 98.000 €/BTC).',
  },
]

/**
 * Los saldos reales declarados COINCIDEN al detalle con los calculados. No es un descuido:
 * es la tesis del caso. El CUADRE de este Libro sale entero en verde y el Libro está mal.
 */
const CUADRE_REAL: SaldoRealDeclarado[] = [
  { ubicacion: EXCHANGE, activo: 'EUR', saldoReal: '682.06', notas: 'Panel de Coinbase a 31/12/2025.' },
  { ubicacion: EXCHANGE, activo: 'BTC', saldoReal: '0.00494' },
  { ubicacion: EXCHANGE, activo: 'ETH', saldoReal: '0.102' },
  { ubicacion: EXCHANGE, activo: 'TKA', saldoReal: '500' },
  { ubicacion: WALLET, activo: 'BTC', saldoReal: '0.0367', notas: 'Leído en el nodo.' },
]

/**
 * Archivo mínimo, con las dos piezas que delatan el error invisible: la factura del ASIC y
 * el informe del pool a nombre de la dirección propia. Ninguna de las dos cambia un saldo;
 * las dos cambian la calificación.
 */
const JUSTIFICANTES: JustificanteCargable[] = [
  {
    id: 'u6-j-004-pool',
    apunteId: '2025-004',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-pool',
    referenciaExterna:
      'Informe del pool de minería · liquidación de febrero de 2025, con la dirección de cobro y el hashrate aportado.',
    notas: 'Nótese quién aporta el trabajo en esta operación y quién lo aporta en el apunte 2025-006.',
  },
  {
    id: 'u6-j-004-equipo',
    apunteId: '2025-004',
    rutaConvencional: '99-otros',
    tipoDocumento: 'factura-recibo',
    referenciaExterna:
      'Factura de compra del equipo ASIC (11/2024) y facturas de electricidad del primer semestre de 2025.',
    notas: 'Documento de ubicación/actividad: acredita los medios de producción ordenados por cuenta propia.',
  },
  {
    id: 'u6-j-006-liquidacion',
    apunteId: '2025-006',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Coinbase › historial de recompensas de staking de ETH del 31/03/2025.',
  },
  {
    id: 'u6-j-011-documento',
    apunteId: '2025-011',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'documento-donacion',
    referenciaExterna:
      'Documento privado de donación de 05/09/2025 con las dos partes, el parentesco y la valoración.',
    notas: 'El documento dice quién dona y quién recibe. El apunte, todavía no.',
  },
]

/** El caso de la Unidad 6, listo para repartir. */
export const CASO_U6: CasoTaller = {
  id: 'u6-clasificacion',
  unidad: 6,
  titulo: 'Clasificación y sus atributos',
  dificultad: 'medio',
  minutosEstimados: 45,
  queEnsena: [
    'El error invisible: una clasificación equivocada que cuadra igual y cambia la base imponible.',
    'Minería frente a rendimiento: quién aporta el trabajo decide el cajón.',
    'El atributo «sentido» de la DONACIÓN, y por qué sin él la cola FIFO no se mueve.',
    'Operaciones ambiguas: elegir un criterio, fundarlo y dejarlo escrito.',
  ],
  enunciado: `Diego lleva el Libro con cuidado. Ha cuadrado su ejercicio 2025 celda a celda y
el semáforo del Cuadre está entero en verde: lo que la aplicación calcula coincide con lo que
ve en Coinbase y con lo que ve en su nodo. Está, con razón, satisfecho.

Su Libro, sin embargo, tiene dos problemas. Uno de ellos la aplicación se lo dirá en cuanto
mire la conciliación entre la cola FIFO y los saldos; el otro no se lo va a decir nadie,
porque no hay comprobación aritmética que pueda verlo: los números salen igual de bien
clasificando la operación de una manera o de la otra, y lo único que cambia es en qué casilla
de la declaración acaba el dinero.

Conviene que sepas algo que no está escrito en ningún apunte: Diego compró un equipo de
minería doméstico en noviembre de 2024, lo tuvo funcionando en el trastero de casa hasta
junio de 2025 y pagó su electricidad. Además tiene una pequeña cantidad de ETH en el programa
de staking del exchange, que gestiona la plataforma de principio a fin. Las dos cosas le
producen cripto nueva cada mes y las dos entran en el Libro sin lado de salida.

Se te pide que revises la clasificación de los doce apuntes uno por uno, que corrijas lo que
esté mal y que dejes escrita, en las notas del apunte, la razón de cada decisión. Presta
atención a tres de ellos en particular: el reparto de tokens de junio, el pago del hosting de
julio y la donación de septiembre. Los tres admiten más de una lectura, y en los tres lo que
se te pide no es acertar la única respuesta posible, sino elegir una y saber defenderla.

Cuando termines, compara el resumen fiscal de 2025 con el que tenías al empezar. La cifra
que se mueve es la medida exacta de lo que vale clasificar bien.`,
  datos: {
    apuntes: APUNTES,
    ubicaciones: UBICACIONES,
    activos: ACTIVOS,
    justificantes: JUSTIFICANTES,
    cuadreReal: CUADRE_REAL,
  },
  solucion: {
    correcciones: [
      'Reclasificar 2025-004, 2025-007 y 2025-008 de RENDIMIENTO a MINERÍA: hay ordenación por cuenta propia de medios de producción (art. 27.1 LIRPF). Saldos, FIFO y CUADRE no se mueven; los 251,10 € pasan del cajón de RCM al de actividad económica.',
      'Completar 2025-011 con el sentido de la donación (entregada, según el documento privado del Archivo): la cola FIFO vuelve a moverse y la conciliación cierra en cero.',
      'Dejar por escrito el criterio de 2025-009 (airdrop condicionado) y confirmar que 2025-010 es un PAGO y no una TRANSFERENCIA: sale bitcoin del patrimonio contra una factura.',
    ],
    fiscalEsperado: [
      { ejercicio: 2025, concepto: 'rcm.total', importeEUR: '6' },
      { ejercicio: 2025, concepto: 'actividad-economica.total', importeEUR: '251.1' },
      { ejercicio: 2025, concepto: 'base-general.total', importeEUR: '150' },
    ],
  },
}
