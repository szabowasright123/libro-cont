/**
 * u8-eventos-defi.ts — CASO DE LA UNIDAD 8 · «Eventos complejos».
 *
 * Tres eventos DeFi y una trampa. Lo primero que hay que tener claro, y es la razón de ser
 * de la unidad: **los eventos DeFi no son tipos**. El catálogo sigue teniendo doce tipos y
 * ninguno se llama «staking líquido» ni «préstamo». Lo que se hace es DESCOMPONER el hecho
 * económico en patas, y cada pata es un apunte de uno de los doce (docs/DEFI_EVENTOS_
 * COMPLEJOS.md §0). Los campos `evento`, `posicionId`, `protocolo` y `criterioAplicado` son
 * una dimensión ORTOGONAL: nombran de dónde viene la pata sin alterar su calificación.
 *
 * Los tres eventos del caso:
 *
 *   · STAKING LÍQUIDO (2026-004 y 2026-005) — se entregan 2 ETH y se reciben 1,94 rETH; seis
 *     meses después se deshace la posición y vuelven 2,08 ETH. Dos PERMUTAS del art. 37.1.h
 *     LIRPF, y ni un solo RENDIMIENTO por medio: el rETH es un token cuyo VALOR crece, no un
 *     token que se acredita, de modo que toda la renta aflora en la permuta de salida
 *     (DEFI §A3). Zona gris: exige criterio aplicado.
 *   · PRÉSTAMO, LADO PRESTATARIO (2026-006 a 2026-010) — colateral que se traslada sin
 *     transmitirse, principal que se recibe, interés que se paga en cripto (el «doble
 *     efecto» de [MT] U4.3: no es deducible Y además es transmisión), devolución y
 *     recuperación del colateral. Cinco patas de cuatro tipos distintos.
 *   · ENVOLTORIO (2026-011) — 0,5 ETH pasan a WETH. Regla de identidad: ETH y WETH son dos
 *     activos con dos colas FIFO independientes, y bajo la tesis prudente el canje es una
 *     permuta que genera resultado aunque el valor económico no se mueva un euro.
 *
 * LA TRAMPA (2026-007). La recepción del principal del préstamo está anotada como
 * TRANSFERENCIA. Es el primer impulso de cualquiera —«no es renta, luego no es nada»— y el
 * propio documento de diseño lo señala como error grave: TRANSFERENCIA no abre lote FIFO, de
 * modo que los 1.600 USDC recibidos entran en el Libro sin valor de adquisición. La
 * consecuencia solo se ve al devolverlos: la pata PAGO de 2026-009 consume una cola vacía,
 * el motor la marca con `saldoFifoInsuficiente` y el resumen fiscal de 2026 se apunta una
 * ganancia patrimonial de 1.472,00 € que nunca existió.
 *
 * Y lo peor: el CUADRE sale en verde y la conciliación FIFO↔SALDOS también, porque la cola
 * y el saldo del USDC acaban los dos en cero. Es un error invisible a las dos comprobaciones
 * del Libro, y solo el aviso del motor y la lectura del resumen fiscal lo delatan.
 *
 * Contravalores: precios de mercado 2026 ASUMIDOS y redondeados, convención «(supuesto)» —
 * ETH ≈ 3.000 € (ene–feb) · 3.400 € (jun–jul) · 3.500 € (dic); USDC ≈ 0,92 €.
 *
 * Módulo de datos puro: sin React, sin Dexie.
 */
import {
  type Activo,
  type Apunte,
  type Posicion,
  type Ubicacion,
  UBICACION_EXTERIOR,
} from '../../engine/types'
import type { JustificanteCargable } from '../repositorio'
import type { SaldoRealDeclarado } from '../import/json-backup'
import type { CasoTaller } from './tipos'

const EXCHANGE = 'Bitstamp'
const WALLET = 'MetaMask'
const PROTOCOLO_PRESTAMO = 'AaveV3'

const POS_STAKING = 'u8-pos-reth-2026'
const POS_PRESTAMO = 'u8-pos-prestamo-2026'

/**
 * El criterio de la zona gris se escribe UNA vez y se repite en cada pata del evento: es el
 * texto que hay que poder enseñar en una comprobación, y tiene que viajar con el apunte, no
 * con el expediente.
 */
const CRITERIO_STAKING_LIQUIDO =
  'Tesis PRUDENTE: el canje ETH↔rETH se trata como PERMUTA del art. 37.1.h) LIRPF, ' +
  'cuantificada por el mayor de los dos valores de mercado, siguiendo el criterio que la ' +
  'V0612-26 aplica a los canjes del staking líquido. El rETH es un token cuyo VALOR crece ' +
  'y no acredita unidades nuevas, de modo que no hay rendimiento que imputar periódicamente: ' +
  'toda la renta aflora en la permuta de salida. La distinción entre tokens de rebase de ' +
  'valor y de cantidad no está resuelta por consulta alguna (DEFI §A3).'

const CRITERIO_PRESTATARIO =
  'Tesis del manual (U3.3.2 y U4.3) con el criterio del autor de 16-08-2026: la aportación ' +
  'del colateral es traslado en garantía y no transmisión; la recepción del principal no es ' +
  'renta pero sí abre lote con valor de adquisición; los intereses pagados no son deducibles ' +
  'en la gestión patrimonial privada, y pagarlos en cripto es además una transmisión. ' +
  'Construcción fundada y NO confirmada por la DGT (DEFI §B2).'

const CRITERIO_WRAPPING =
  'Tesis PRUDENTE: ETH y WETH son dos elementos patrimoniales distintos (regla de identidad, ' +
  'DEFI §1), de modo que el envoltorio es una permuta del art. 37.1.h) LIRPF aunque el valor ' +
  'económico sea idéntico. Sin criterio administrativo publicado.'

const UBICACIONES: Ubicacion[] = [
  {
    id: EXCHANGE,
    nombre: 'Bitstamp',
    tipo: 'exchange',
    kyc: true,
    fechaAlta: '2025-09-01T00:00:00',
    viaEvidencia: 'exchange-kyc',
    extranjero: true,
    pais: 'Luxemburgo',
    notasEvidencia: 'Puerta de entrada del fiat. Órdenes y extractos descargables.',
  },
  {
    id: WALLET,
    nombre: 'MetaMask',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2026-01-18T00:00:00',
    autocustodia: true,
    viaEvidencia: 'wallet-autocustodia',
    notasEvidencia:
      'Wallet propia desde la que se firma toda la operativa DeFi. Su evidencia son los ' +
      'hashes de transacción y las direcciones de los contratos con los que interactúa.',
  },
  {
    id: PROTOCOLO_PRESTAMO,
    nombre: 'Aave v3 (colateral)',
    tipo: 'wallet',
    kyc: false,
    fechaAlta: '2026-07-15T00:00:00',
    viaEvidencia: 'otra',
    // NI extranjero NI autocustodia, por la misma razón que el pool del caso de ejemplo: un
    // contrato inteligente no es un custodio residente ni no residente, y las claves no son
    // del titular. Es una ubicación de frontera que el alumno debe mirar con sus propios ojos.
    notasEvidencia:
      'Ubicación que representa el depósito de garantía en el protocolo. Existe para que el ' +
      'colateral no desaparezca del Libro mientras está bloqueado: bajo la tesis del manual ' +
      'el ETH aportado NO sale del patrimonio, solo cambia de sitio, y el CUADRE tiene que ' +
      'poder seguirlo. Evidencia: dirección del contrato, hash del depósito y estado de la ' +
      'posición en cada corte.',
  },
]

const ACTIVOS: Activo[] = [
  { simbolo: 'ETH', nombre: 'Ethereum', decimales: 8, esFiat: false },
  {
    simbolo: 'RETH',
    nombre: 'Rocket Pool ETH',
    decimales: 8,
    esFiat: false,
    subyacente: 'ETH',
    naturaleza: 'recibo-posicion',
    // Rebase de VALOR, no de cantidad: el saldo no crece, crece la tasa de canje. Es la
    // distinción que decide si hay RCM periódico (no lo hay) o si toda la renta aflora en
    // la permuta de salida (es lo que ocurre aquí).
    rebase: 'valor',
  },
  { simbolo: 'USDC', nombre: 'USD Coin', decimales: 6, esFiat: false },
  {
    simbolo: 'WETH',
    nombre: 'Wrapped Ether',
    decimales: 8,
    esFiat: false,
    subyacente: 'ETH',
    naturaleza: 'envoltorio',
  },
]

/** Once apuntes, en orden cronológico estricto. */
const APUNTES: Apunte[] = [
  {
    id: '2026-001',
    fechaHora: '2026-01-12T10:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: EXCHANGE,
    activoEntrada: 'EUR',
    cantidadEntrada: '12000',
    notas: 'Ingreso de fiat desde el banco.',
  },
  {
    id: '2026-002',
    fechaHora: '2026-01-14T11:00:00',
    tipo: 'COMPRA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: EXCHANGE,
    activoSalida: 'EUR',
    cantidadSalida: '9300',
    activoEntrada: 'ETH',
    cantidadEntrada: '3.1',
    comisionCantidad: '13.95',
    comisionActivo: 'EUR',
    contravalorEUR: '9300',
    notas: 'Compra de 3,1 ETH (supuesto: ≈ 3.000 €/ETH). Sin hecho imponible: fija el lote FIFO.',
  },
  {
    id: '2026-003',
    fechaHora: '2026-01-20T12:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: EXCHANGE,
    ubicacionDestino: WALLET,
    activoSalida: 'ETH',
    cantidadSalida: '3',
    activoEntrada: 'ETH',
    cantidadEntrada: '3',
    comisionCantidad: '0.005',
    comisionActivo: 'ETH',
    notas:
      'Retirada a la wallet propia para poder operar. La comisión se paga en ETH: reduce la ' +
      'cola prorrateada entre los lotes vivos, sin ser transmisión, y su coste no es ' +
      'deducible por tratarse de un traslado entre ubicaciones propias.',
  },
  {
    id: '2026-004',
    fechaHora: '2026-02-02T09:00:00',
    tipo: 'PERMUTA',
    ubicacionOrigen: WALLET,
    ubicacionDestino: WALLET,
    activoSalida: 'ETH',
    cantidadSalida: '2',
    activoEntrada: 'RETH',
    cantidadEntrada: '1.94',
    comisionCantidad: '0.0015',
    comisionActivo: 'ETH',
    valorMercadoEntregadoEUR: '6000.00',
    valorMercadoRecibidoEUR: '6000.00',
    contravalorEUR: '6000.00',
    evento: 'STAKING_LIQUIDO',
    posicionId: POS_STAKING,
    protocolo: 'Rocket Pool',
    criterioAplicado: CRITERIO_STAKING_LIQUIDO,
    notas:
      'ENTRADA al staking líquido: se entregan 2 ETH (6.000 €) y se reciben 1,94 rETH, que ' +
      'valen lo mismo porque el rETH cotiza por encima del ETH. Consume cola de ETH y abre ' +
      'cola de rETH: son dos activos distintos y no se funden nunca.',
  },
  {
    id: '2026-005',
    fechaHora: '2026-06-30T09:00:00',
    tipo: 'PERMUTA',
    ubicacionOrigen: WALLET,
    ubicacionDestino: WALLET,
    activoSalida: 'RETH',
    cantidadSalida: '1.94',
    activoEntrada: 'ETH',
    cantidadEntrada: '2.08',
    comisionCantidad: '0.0018',
    comisionActivo: 'ETH',
    valorMercadoEntregadoEUR: '7072.00',
    valorMercadoRecibidoEUR: '7072.00',
    contravalorEUR: '7072.00',
    evento: 'STAKING_LIQUIDO',
    posicionId: POS_STAKING,
    protocolo: 'Rocket Pool',
    criterioAplicado: CRITERIO_STAKING_LIQUIDO,
    notas:
      'SALIDA del staking líquido: los 1,94 rETH se canjean por 2,08 ETH (supuesto: ≈ 3.400 ' +
      '€/ETH). Aquí aflora de golpe toda la renta de cinco meses, como ganancia patrimonial ' +
      'y no como rendimiento, porque el protocolo nunca acreditó unidades nuevas.',
  },
  {
    id: '2026-006',
    fechaHora: '2026-07-15T08:00:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: WALLET,
    ubicacionDestino: PROTOCOLO_PRESTAMO,
    activoSalida: 'ETH',
    cantidadSalida: '1',
    activoEntrada: 'ETH',
    cantidadEntrada: '1',
    comisionCantidad: '0.0021',
    comisionActivo: 'ETH',
    evento: 'LENDING_PRESTATARIO',
    posicionId: POS_PRESTAMO,
    protocolo: 'Aave v3',
    criterioAplicado: CRITERIO_PRESTATARIO,
    notas:
      'Aportación del COLATERAL: 1 ETH bloqueado en garantía. No es transmisión —el deudor ' +
      'sigue siendo propietario—, así que la pata es una TRANSFERENCIA a la ubicación que ' +
      'representa el depósito. La comisión anotada (0,0021 ETH) agrupa el gas de esta ' +
      'operación y el de la recuperación de noviembre: la convención de la plantilla descuenta ' +
      'la comisión en el ORIGEN, y colgar el gas de la retirada de su propio apunte dejaría ' +
      'la ubicación del protocolo en negativo.',
  },
  {
    id: '2026-007',
    // LA TRAMPA. Debería ser COMPRA a valor de mercado: sin hecho imponible, pero con valor
    // de adquisición. Como TRANSFERENCIA no abre lote, y el error no aflora hasta 2026-009.
    fechaHora: '2026-07-15T08:10:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: UBICACION_EXTERIOR,
    ubicacionDestino: WALLET,
    activoEntrada: 'USDC',
    cantidadEntrada: '1600',
    evento: 'LENDING_PRESTATARIO',
    posicionId: POS_PRESTAMO,
    protocolo: 'Aave v3',
    criterioAplicado: CRITERIO_PRESTATARIO,
    notas:
      'Recepción del PRINCIPAL: 1.600 USDC prestados contra el colateral (supuesto: ≈ 0,92 ' +
      '€/USDC, 1.472,00 €). Recibir un préstamo no es renta y el titular lo anotó como un ' +
      'simple movimiento de entrada.',
  },
  {
    id: '2026-008',
    fechaHora: '2026-09-30T10:00:00',
    tipo: 'PAGO',
    ubicacionOrigen: WALLET,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'ETH',
    cantidadSalida: '0.015',
    contravalorEUR: '51.00',
    evento: 'LENDING_PRESTATARIO',
    posicionId: POS_PRESTAMO,
    protocolo: 'Aave v3',
    criterioAplicado: CRITERIO_PRESTATARIO,
    notas:
      'Intereses del trimestre, pagados en ETH: 0,015 ETH (51,00 €). El «doble efecto» de ' +
      '[MT] U4.3: el interés NO es deducible en la gestión patrimonial privada y, además, ' +
      'entregar cripto para pagarlo es una transmisión que consume cola y genera su propia ' +
      'ganancia o pérdida.',
  },
  {
    id: '2026-009',
    fechaHora: '2026-11-20T08:00:00',
    tipo: 'PAGO',
    ubicacionOrigen: WALLET,
    ubicacionDestino: UBICACION_EXTERIOR,
    activoSalida: 'USDC',
    cantidadSalida: '1600',
    contravalorEUR: '1472.00',
    evento: 'LENDING_PRESTATARIO',
    posicionId: POS_PRESTAMO,
    protocolo: 'Aave v3',
    criterioAplicado: CRITERIO_PRESTATARIO,
    notas:
      'Devolución del principal: se entregan los mismos 1.600 USDC. Mira el resultado que el ' +
      'motor asigna a esta operación y compáralo con lo que económicamente ha pasado, que es ' +
      'nada: se devuelve lo mismo que se recibió y el USDC no se ha movido de precio.',
  },
  {
    id: '2026-010',
    fechaHora: '2026-11-20T08:05:00',
    tipo: 'TRANSFERENCIA',
    ubicacionOrigen: PROTOCOLO_PRESTAMO,
    ubicacionDestino: WALLET,
    activoSalida: 'ETH',
    cantidadSalida: '1',
    activoEntrada: 'ETH',
    cantidadEntrada: '1',
    evento: 'LENDING_PRESTATARIO',
    posicionId: POS_PRESTAMO,
    protocolo: 'Aave v3',
    criterioAplicado: CRITERIO_PRESTATARIO,
    notas:
      'Recuperación del colateral: vuelve el mismo ETH que se depositó, con su antigüedad y ' +
      'su coste FIFO intactos. Nunca salió del patrimonio. El gas de esta operación se anotó ' +
      'en 2026-006 (véase su nota).',
  },
  {
    id: '2026-011',
    fechaHora: '2026-12-10T17:00:00',
    tipo: 'PERMUTA',
    ubicacionOrigen: WALLET,
    ubicacionDestino: WALLET,
    activoSalida: 'ETH',
    cantidadSalida: '0.5',
    activoEntrada: 'WETH',
    cantidadEntrada: '0.5',
    comisionCantidad: '0.0008',
    comisionActivo: 'ETH',
    valorMercadoEntregadoEUR: '1750.00',
    valorMercadoRecibidoEUR: '1750.00',
    contravalorEUR: '1750.00',
    evento: 'WRAPPING',
    protocolo: 'WETH9',
    criterioAplicado: CRITERIO_WRAPPING,
    notas:
      'Envoltorio de 0,5 ETH en WETH (supuesto: ≈ 3.500 €/ETH) para poder operar en un ' +
      'protocolo que no acepta ETH nativo. Económicamente no ha pasado nada: 0,5 unidades ' +
      'valen lo mismo antes y después. Fiscalmente, bajo la tesis prudente, sí ha pasado, y ' +
      'el resultado no es cero porque el coste FIFO del ETH consumido no es su valor de hoy.',
  },
]

/** Las dos posiciones del caso. La del préstamo se cerró; la del staking, también. */
const POSICIONES: Posicion[] = [
  {
    id: POS_STAKING,
    protocolo: 'Rocket Pool',
    tipoPosicion: 'staking',
    fechaApertura: '2026-02-02T09:00:00',
    fechaCierre: '2026-06-30T09:00:00',
    estado: 'cerrada',
    notas:
      'Staking líquido con token de rebase de VALOR: sin acreditación periódica, toda la ' +
      'renta aflora en la permuta de salida.',
  },
  {
    id: POS_PRESTAMO,
    protocolo: 'Aave v3',
    tipoPosicion: 'lending',
    fechaApertura: '2026-07-15T08:00:00',
    fechaCierre: '2026-11-20T08:05:00',
    estado: 'cerrada',
    notas:
      'Préstamo con colateral en ETH y principal en USDC, devuelto en noviembre sin que ' +
      'llegara a haber liquidación forzosa.',
  },
]

/**
 * El CUADRE de este caso sale ENTERO EN VERDE, y esa es media lección: los saldos son
 * correctos porque el defecto no está en cuánto hay, sino en cuánto costó.
 */
const CUADRE_REAL: SaldoRealDeclarado[] = [
  { ubicacion: EXCHANGE, activo: 'EUR', saldoReal: '2686.05' },
  { ubicacion: EXCHANGE, activo: 'ETH', saldoReal: '0.095' },
  { ubicacion: WALLET, activo: 'ETH', saldoReal: '2.5588', notas: 'Leído en la wallet a 31/12/2026.' },
  { ubicacion: WALLET, activo: 'RETH', saldoReal: '0' },
  { ubicacion: WALLET, activo: 'USDC', saldoReal: '0' },
  { ubicacion: WALLET, activo: 'WETH', saldoReal: '0.5' },
  { ubicacion: PROTOCOLO_PRESTAMO, activo: 'ETH', saldoReal: '0', notas: 'Posición cerrada: el depósito volvió entero.' },
]

const JUSTIFICANTES: JustificanteCargable[] = [
  {
    id: 'u8-j-004-permuta',
    apunteId: '2026-004',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-permuta',
    referenciaExterna:
      'Hash de la transacción de depósito en Rocket Pool (02/02/2026), con las dos patas y la tasa de canje aplicada.',
  },
  {
    id: 'u8-j-004-valor',
    apunteId: '2026-004',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'valor-mercado',
    referenciaExterna:
      'Cotizaciones ETH/EUR y rETH/EUR del 02/02/2026 con su fuente: los DOS valores de mercado del art. 37.1.h).',
  },
  {
    id: 'u8-j-005-permuta',
    apunteId: '2026-005',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-permuta',
    referenciaExterna: 'Hash del canje de salida de Rocket Pool (30/06/2026) y tasa de canje del día.',
  },
  {
    id: 'u8-j-007-contrato',
    apunteId: '2026-007',
    rutaConvencional: '01-adquisiciones',
    tipoDocumento: 'txid-entrada',
    referenciaExterna:
      'Hash de la operación de préstamo en Aave v3 (15/07/2026): colateral depositado, principal recibido y tipo aplicado.',
    notas:
      'El documento acredita cuántos USDC entraron y a qué cambio: exactamente lo que hace ' +
      'falta para fijar un valor de adquisición.',
  },
  {
    id: 'u8-j-009-devolucion',
    apunteId: '2026-009',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-pago',
    referenciaExterna: 'Hash de la devolución de los 1.600 USDC y cierre de la posición (20/11/2026).',
  },
  {
    id: 'u8-j-011-wrap',
    apunteId: '2026-011',
    rutaConvencional: '03-transmisiones',
    tipoDocumento: 'txid-permuta',
    referenciaExterna: 'Hash del depósito en el contrato WETH9 (10/12/2026).',
  },
]

/** El caso de la Unidad 8, listo para repartir. */
export const CASO_U8: CasoTaller = {
  id: 'u8-eventos-defi',
  unidad: 8,
  titulo: 'Eventos complejos: descomponer en patas',
  dificultad: 'avanzado',
  minutosEstimados: 60,
  queEnsena: [
    'Un evento DeFi no es un tipo: se descompone en patas de los doce del catálogo.',
    'Staking líquido: dos permutas del art. 37.1.h y ningún rendimiento cuando el token crece de valor.',
    'Préstamo del lado prestatario: qué es traslado, qué abre lote y qué es transmisión.',
    'La regla de identidad: ETH, rETH y WETH son tres activos con tres colas FIFO.',
    'Zona gris: elegir tesis, escribirla y fecharla es parte del registro, no un adorno.',
  ],
  enunciado: `Luis ha tenido un 2026 movido. En febrero metió 2 ETH en un protocolo de
staking líquido y le devolvieron unos tokens que no son ETH; en junio deshizo la posición y
recuperó algo más de ETH del que puso. En julio dejó 1 ETH en garantía en un protocolo de
préstamo, se llevó 1.600 USDC, pagó los intereses del trimestre en ETH y en noviembre lo
devolvió todo y recuperó su garantía. En diciembre envolvió medio ETH en WETH para poder
usar otra aplicación.

Nada de eso aparece en la Tabla 7 del manual, y no debe aparecer: el catálogo tiene doce
tipos y no se amplía. Lo que se hace con un evento así es partirlo en patas y darle a cada
pata el tipo que le corresponde de esos doce. Luis lo ha intentado y el Libro que tienes
delante es el resultado. Está casi bien.

Empieza por leerlo entero antes de juzgar nada, apunte por apunte, y para cada uno pregúntate
tres cosas: qué ha salido del patrimonio, qué ha entrado y con qué valor de adquisición nace
lo que entra. Fíjate especialmente en las operaciones en las que Luis ha decidido que «no
pasa nada» fiscalmente: algunas veces tiene razón y otras no, y la diferencia entre las dos
situaciones no está en si hay o no hecho imponible, sino en si el activo que entra trae o no
un coste consigo.

El Cuadre de este Libro está en verde y la conciliación entre la cola FIFO y los saldos
también. Aun así, uno de los once apuntes está mal clasificado y su consecuencia es una
ganancia patrimonial de cuatro cifras que Luis no ha tenido. Encuéntrala, corrígela y explica
por qué la clasificación correcta es la que propones.

Comprueba después que los criterios de zona gris están escritos y fechados en los apuntes que
los necesitan. En esta materia no hay una respuesta administrativa para casi nada, y una
posición fundada y documentada vale mucho más que una posición acertada por casualidad.`,
  datos: {
    apuntes: APUNTES,
    ubicaciones: UBICACIONES,
    activos: ACTIVOS,
    justificantes: JUSTIFICANTES,
    posiciones: POSICIONES,
    cuadreReal: CUADRE_REAL,
  },
  solucion: {
    correcciones: [
      'Reclasificar 2026-007 de TRANSFERENCIA a COMPRA con contravalor 1.472,00 € (1.600 USDC a 0,92 €): recibir el principal de un préstamo no es renta, pero el activo recibido sí tiene valor de adquisición —el equivalente en euros el día de recibirlo— y ese valor abre el lote FIFO (criterio del autor de 16-08-2026, DEFI §B2).',
      'Comprobado el efecto: la devolución de 2026-009 deja de estar marcada con saldo FIFO insuficiente y su resultado pasa de +1.472,00 € a 0,00 €, que es lo que económicamente ha ocurrido.',
      'El resto del Libro está bien: las dos permutas del staking líquido, el pago de intereses en cripto, la recuperación del colateral y el envoltorio en WETH. Conviene decirlo en clase para que el ejercicio no se convierta en una caza indiscriminada.',
    ],
    fiscalEsperado: [{ ejercicio: 2026, concepto: '2026-009.resultado', importeEUR: '0' }],
  },
}
