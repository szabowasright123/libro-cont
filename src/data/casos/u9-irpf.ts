/**
 * u9-irpf.ts — CASO DE LA UNIDAD 9 · «Del registro al IRPF».
 *
 * El único caso LIMPIO del catálogo, y lo es a propósito. Aquí no hay nada que depurar: el
 * CUADRE sale en verde, la conciliación FIFO↔SALDOS cierra en cero y `validarDiario` no
 * arroja ni un error. El trabajo de la Unidad 9 no es arreglar un Libro, es TRASLADARLO.
 *
 * El caso está construido para que el resumen fiscal de 2025 tenga pobladas las CINCO
 * salidas del registro, una por cajón, y ninguna vacía:
 *
 *   · AHORRO (ganancias y pérdidas por transmisión) — dos ventas con ganancia y dos con
 *     pérdida, para que el neto no sea trivial y haya que mirar el desglose por operación.
 *   · RCM (rendimiento del capital mobiliario) — las dos recompensas de staking del
 *     exchange, art. 25.2 LIRPF, base del ahorro y sin gastos deducibles.
 *   · ACTIVIDAD ECONÓMICA — la recompensa de minería, que va a la base general por una vía
 *     completamente distinta de la del staking pese a parecerse tanto.
 *   · BASE GENERAL — el airdrop, ganancia patrimonial no derivada de transmisión.
 *   · PÉRDIDAS — el robo de octubre, con su subtipo y su expediente probatorio, que se
 *     lista APARTE del ahorro porque su cómputo está condicionado a requisitos y prueba.
 *
 * Todo el patrimonio está en un exchange radicado en ESPAÑA y en una wallet de autocustodia,
 * de modo que el aviso 721 no aplica y no distrae: esa lección tiene su propio caso, el de
 * la Unidad 10.
 *
 * Contravalores: precios de mercado 2025 ASUMIDOS y redondeados, convención «(supuesto)» —
 * BTC ≈ 90.000 € (ene) · 93.000 € (abr) · 98.000 € (jul); ETH ≈ 3.000 € (feb) · 3.200 €
 * (mar) · 2.800 € (ago–sep); TKB ≈ 0,30 € en el reparto y 0,24 € al venderlo.
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
import type { PrecioRegistro, SubtipoPerdida } from '../tipos'
import type { CasoTaller } from './tipos'

const EXCHANGE = 'Bit2Me'
const WALLET = 'Trezor'

const UBICACIONES: Ubicacion[] = [
  {
    id: EXCHANGE,
    nombre: 'Bit2Me',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2024-10-01T00:00:00',
    viaEvidencia: 'exchange-kyc',
    // Radicado en ESPAÑA: no computa para el aviso 721 y el caso puede concentrarse en el
    // traslado a Renta sin el ruido del umbral.
    extranjero: false,
    pais: 'España',
    notasEvidencia:
      'Entidad establecida en España, con certificado anual de operaciones y saldos. Es el ' +
      'escenario más cómodo del taller y sirve para ver el traslado a Renta sin interferencias.',
  },
  {
    id: WALLET,
    nombre: 'Trezor',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2025-04-01T00:00:00',
    autocustodia: true,
    viaEvidencia: 'wallet-autocustodia',
    notasEvidencia: 'Claves propias. Nunca computa para el 721 (FAQ AEAT).',
  },
]

const ACTIVOS: Activo[] = [
  { simbolo: 'ETH', nombre: 'Ethereum', decimales: 8, esFiat: false },
  { simbolo: 'TKB', nombre: 'Token B (ejemplo)', decimales: 8, esFiat: false },
]

/** Doce apuntes de 2025, en orden cronológico estricto y sin un solo defecto. */
const APUNTES: Apunte[] = [
  {
    id: '2025-001',
    fechaHora: '2025-01-07T09:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'EUR',
    cantidadEntrada: '10000',
    notas: 'Ingreso de fiat del ahorro del año (transferencia SEPA).',
  },
  {
    id: '2025-002',
    fechaHora: '2025-01-09T10:30:00',
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
    notas: 'Compra de 0,05 BTC (supuesto: ≈ 90.000 €/BTC). La comisión en EUR suma al coste del lote.',
  },
  {
    id: '2025-003',
    fechaHora: '2025-02-20T11:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '3000',
    activoEntrada: 'ETH',
    cantidadEntrada: '1',
    comisionCantidad: '4.50',
    comisionActivo: 'EUR',
    contravalorEUR: '3000',
    notas: 'Compra de 1 ETH (supuesto: ≈ 3.000 €/ETH).',
  },
  {
    id: '2025-004',
    fechaHora: '2025-03-15T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'ETH',
    cantidadEntrada: '0.02',
    contravalorEUR: '64.00',
    notas:
      'Recompensa del programa de staking del exchange (supuesto: ≈ 3.200 €/ETH). RCM del ' +
      'art. 25.2 LIRPF, imputable el día en que se puede disponer de ella.',
  },
  {
    id: '2025-005',
    fechaHora: '2025-04-10T08:00:00',
    tipo: 'MINERIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: WALLET,
    activoEntrada: 'BTC',
    cantidadEntrada: '0.0025',
    contravalorEUR: '232.50',
    notas:
      'Liquidación acumulada del pool de minería (supuesto: ≈ 93.000 €/BTC). Hay ordenación ' +
      'por cuenta propia de medios de producción: rendimiento de actividad económica.',
  },
  {
    id: '2025-006',
    fechaHora: '2025-05-05T13:00:00',
    tipo: 'AIRDROP',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'TKB',
    cantidadEntrada: '400',
    contravalorEUR: '120.00',
    notas:
      'Reparto de 400 TKB acreditados en la cuenta del exchange (supuesto: ≈ 0,30 €/TKB). ' +
      'Ganancia patrimonial no derivada de transmisión, base general.',
  },
  {
    id: '2025-007',
    fechaHora: '2025-06-12T16:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: WALLET,
    activoSalida: 'BTC',
    cantidadSalida: '0.025',
    activoEntrada: 'BTC',
    cantidadEntrada: '0.025',
    comisionCantidad: '0.00007',
    comisionActivo: 'BTC',
    notas:
      'Paso a autocustodia de la mayor parte del bitcoin. Sin hecho imponible; la comisión de ' +
      'red sí sale del patrimonio y, por convención, se descuenta en el ORIGEN.',
  },
  {
    id: '2025-008',
    fechaHora: '2025-07-18T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'BTC',
    cantidadSalida: '0.02',
    activoEntrada: 'EUR',
    cantidadEntrada: '1960',
    comisionCantidad: '2.94',
    comisionActivo: 'EUR',
    contravalorEUR: '1960',
    notas:
      'Venta de 0,02 BTC (supuesto: ≈ 98.000 €/BTC). Ganancia patrimonial: la comisión en EUR ' +
      'minora el valor de transmisión y el coste sale del lote más antiguo (FIFO).',
  },
  {
    id: '2025-009',
    fechaHora: '2025-08-22T11:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'ETH',
    cantidadSalida: '0.5',
    activoEntrada: 'EUR',
    cantidadEntrada: '1400',
    comisionCantidad: '2.10',
    comisionActivo: 'EUR',
    contravalorEUR: '1400',
    notas: 'Venta de 0,5 ETH en un retroceso (supuesto: ≈ 2.800 €/ETH): pérdida patrimonial.',
  },
  {
    id: '2025-010',
    fechaHora: '2025-09-30T12:00:00',
    tipo: 'RENDIMIENTO',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'ETH',
    cantidadEntrada: '0.018',
    contravalorEUR: '50.40',
    notas: 'Segunda recompensa de staking del ejercicio (supuesto: ≈ 2.800 €/ETH). RCM.',
  },
  {
    id: '2025-011',
    fechaHora: '2025-10-14T20:00:00',
    tipo: 'PERDIDA',
    ubicacionOrigen: WALLET,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'BTC',
    cantidadSalida: '0.0008',
    contravalorEUR: '0',
    notas:
      'Robo de 0,0008 BTC tras firmar sin leer una transacción en una web falsa. Sin ' +
      'contraprestación (contravalor 0). Denuncia presentada el mismo día.',
  },
  {
    id: '2025-012',
    fechaHora: '2025-11-20T10:00:00',
    tipo: 'VENTA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'TKB',
    cantidadSalida: '400',
    activoEntrada: 'EUR',
    cantidadEntrada: '96',
    comisionCantidad: '0.14',
    comisionActivo: 'EUR',
    contravalorEUR: '96',
    notas:
      'Venta de los 400 TKB del reparto (supuesto: ≈ 0,24 €/TKB). Segunda capa fiscal del ' +
      'airdrop: primero la ganancia de la base general al recibirlo, y ahora la ganancia o ' +
      'pérdida patrimonial de la transmisión, con el valor ya declarado como coste.',
  },
]

const SUBTIPOS_PERDIDA: Readonly<Record<string, SubtipoPerdida>> = { '2025-011': 'robo' }

/** Saldos reales a 31/12/2025: coinciden con los calculados. El Libro está cuadrado. */
const CUADRE_REAL: SaldoRealDeclarado[] = [
  { ubicacion: EXCHANGE, activo: 'EUR', saldoReal: '5939.57', notas: 'Certificado anual de Bit2Me.' },
  { ubicacion: EXCHANGE, activo: 'BTC', saldoReal: '0.00493' },
  { ubicacion: EXCHANGE, activo: 'ETH', saldoReal: '0.538' },
  { ubicacion: EXCHANGE, activo: 'TKB', saldoReal: '0' },
  { ubicacion: WALLET, activo: 'BTC', saldoReal: '0.0267', notas: 'Leído en el dispositivo.' },
]

/** Precios de cierre a 31/12/2025, para valorar la cartera en la última sección. */
const PRECIOS: PrecioRegistro[] = [
  { activo: 'BTC', precioEur: '99000', fechaISO: '2025-12-31' },
  { activo: 'ETH', precioEur: '2900', fechaISO: '2025-12-31' },
  { activo: 'TKB', precioEur: '0.22', fechaISO: '2025-12-31' },
]

/**
 * Archivo suficiente para que las cinco salidas tengan respaldo. La pérdida lleva su
 * denuncia y su txid, que es lo que decide si puede llegar a computarse o no.
 */
const JUSTIFICANTES: JustificanteCargable[] = [
  {
    id: 'u9-j-002-orden',
    apunteId: '2025-002',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bit2Me › orden BTC/EUR ejecutada el 09/01/2025 (PDF).',
  },
  {
    id: 'u9-j-003-orden',
    apunteId: '2025-003',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bit2Me › orden ETH/EUR ejecutada el 20/02/2025 (PDF).',
  },
  {
    id: 'u9-j-004-liquidacion',
    apunteId: '2025-004',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-rendimiento',
    referenciaExterna: 'Bit2Me › historial de recompensas de staking de ETH del 15/03/2025.',
  },
  {
    id: 'u9-j-005-pool',
    apunteId: '2025-005',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'liquidacion-pool',
    referenciaExterna: 'Informe del pool de minería con la dirección de cobro propia (10/04/2025).',
  },
  {
    id: 'u9-j-006-recepcion',
    apunteId: '2025-006',
    rutaConvencional: '04-rendimientos',
    tipoDocumento: 'prueba-recepcion',
    referenciaExterna: 'Captura de la campaña del reparto de TKB y del abono de 400 unidades (05/05/2025).',
  },
  {
    id: 'u9-j-008-orden',
    apunteId: '2025-008',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bit2Me › orden de venta BTC/EUR del 18/07/2025 (PDF).',
  },
  {
    id: 'u9-j-009-orden',
    apunteId: '2025-009',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'orden-ejecucion',
    referenciaExterna: 'Bit2Me › orden de venta ETH/EUR del 22/08/2025 (PDF).',
  },
  {
    id: 'u9-j-011-denuncia',
    apunteId: '2025-011',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'denuncia',
    referenciaExterna: 'Denuncia presentada ante la Policía Nacional el 14/10/2025, con número de atestado.',
    notas: 'Sin este documento la pérdida no llega a plantearse siquiera.',
  },
  {
    id: 'u9-j-011-txid',
    apunteId: '2025-011',
    rutaConvencional: '07-perdidas-y-donaciones',
    tipoDocumento: 'txid-perdida',
    referenciaExterna: 'txid de la transacción firmada por error, con la dirección de destino del atacante.',
  },
  {
    id: 'u9-j-cert-anual',
    apunteId: '',
    rutaConvencional: '05-certificados',
    tipoDocumento: 'certificado-anual',
    referenciaExterna: 'Bit2Me › certificado anual 2025 de operaciones, comisiones y saldos (PDF).',
    notas: 'Documento de ejercicio: no acompaña a un apunte concreto.',
  },
]

/** El caso de la Unidad 9, listo para repartir. */
export const CASO_U9: CasoTaller = {
  id: 'u9-registro-a-irpf',
  unidad: 9,
  titulo: 'Del registro al IRPF',
  dificultad: 'medio',
  minutosEstimados: 40,
  queEnsena: [
    'Las cinco salidas del registro y qué operación alimenta cada una.',
    'Por qué el staking y la minería, que se parecen tanto, caen en bases imponibles distintas.',
    'Las dos capas fiscales de un airdrop: la ganancia al recibirlo y la transmisión al venderlo.',
    'Las pérdidas se listan aparte y no se netean sin más: dependen de requisitos y de prueba.',
    'Leer el resumen fiscal como lo que es: un mapa orientativo a casillas, no una declaración.',
  ],
  enunciado: `Este Libro está bien. No hay nada que depurar: el Cuadre está en verde, la
conciliación entre la cola FIFO y los saldos cierra en cero y el Archivo tiene lo que hace
falta. Es el Libro de Carmen a 31 de diciembre de 2025, y su trabajo de este año ya está
hecho.

Queda el otro trabajo, que es el de esta unidad: convertir doce apuntes en una declaración.
Carmen ha comprado, ha vendido con ganancia y con pérdida, ha cobrado recompensas de staking
en su exchange, ha minado en casa, ha recibido un reparto de tokens y le han robado una
cantidad pequeña de bitcoin firmando sin leer. Cada una de esas cosas sale del registro por
una puerta distinta y llega a la declaración por una casilla distinta.

Abre la sección Fiscal y trabaja sobre el ejercicio 2025. Se te pide que identifiques, para
cada uno de los cinco cajones, qué apuntes lo alimentan y por qué; que expliques con tus
palabras por qué las recompensas del exchange y las de la minería no acaban en la misma base
imponible pese a parecerse tanto; y que sigas el rastro completo del reparto de tokens de
mayo, desde que entra hasta que sale, contando cuántas veces y por qué conceptos aparece en
la declaración.

Presta atención al robo de octubre. Está registrado, está denunciado y tiene su txid, y aun
así el motor lo saca en un cajón aparte y no lo resta de las ganancias. Explica esa decisión:
es, probablemente, lo más importante que se lleva uno de esta unidad.

Y una advertencia que conviene repetir en voz alta antes de empezar: lo que la aplicación
produce es un resumen ORIENTATIVO con su fecha de criterio. No es una declaración, no es
asesoramiento y no exime de nada.`,
  datos: {
    apuntes: APUNTES,
    ubicaciones: UBICACIONES,
    activos: ACTIVOS,
    justificantes: JUSTIFICANTES,
    subtiposPerdida: SUBTIPOS_PERDIDA,
    precios: PRECIOS,
    cuadreReal: CUADRE_REAL,
  },
  // El caso no tiene defecto, de modo que su «solución» no son correcciones sino la HOJA DE
  // RESULTADOS del traslado: las cifras que el alumno debe obtener en cada cajón si ha leído
  // bien el registro. No se muestra en el enunciado.
  solucion: {
    correcciones: [
      'No hay nada que corregir: el Libro llega limpio y cuadrado. El ejercicio es leerlo.',
      'Ahorro: alimentan el cajón las tres VENTAS (BTC con ganancia, ETH y TKB con pérdida). La PÉRDIDA por robo NO entra aquí.',
      'RCM: las dos recompensas de staking del exchange (15/03 y 30/09). Sin gastos deducibles (art. 26 LIRPF, V0648-24).',
      'Actividad económica: la liquidación de minería de abril, por ordenación de medios propios (art. 27.1 LIRPF).',
      'Base general: el reparto de TKB de mayo, ganancia no derivada de transmisión. Su valor declarado es después el coste del lote que se vende en noviembre: se cuenta dos veces en la declaración y una sola vez en la riqueza.',
      'Pérdidas: el robo de octubre se lista aparte, con su subtipo y su expediente. Su cómputo está condicionado a requisitos y prueba y no se netea sin más.',
    ],
    saldosEsperados: [
      { ubicacion: EXCHANGE, activo: 'EUR', saldo: '5939.57' },
      { ubicacion: EXCHANGE, activo: 'BTC', saldo: '0.00493' },
      { ubicacion: EXCHANGE, activo: 'ETH', saldo: '0.538' },
      { ubicacion: EXCHANGE, activo: 'TKB', saldo: '0' },
      { ubicacion: WALLET, activo: 'BTC', saldo: '0.0267' },
    ],
    fiscalEsperado: [
      { ejercicio: 2025, concepto: 'ahorro.neto', importeEUR: '25.87' },
      { ejercicio: 2025, concepto: 'rcm.total', importeEUR: '114.4' },
      { ejercicio: 2025, concepto: 'actividad-economica.total', importeEUR: '232.5' },
      { ejercicio: 2025, concepto: 'base-general.total', importeEUR: '120' },
      { ejercicio: 2025, concepto: 'perdidas.total', importeEUR: '-72.108' },
    ],
  },
}
