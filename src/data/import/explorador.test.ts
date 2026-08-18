/**
 * explorador.test.ts — lector de CSV de exploradores de bloques (ENCARGO, Parte 2).
 *
 * Los CSV de prueba reproducen las cabeceras reales de Etherscan y sus clones (BscScan,
 * Arbiscan…): mismas columnas con el símbolo cambiado, y nombres de columna de precio
 * DINÁMICOS («CurrentValue @ $1785.9/Eth»), que obligan a casar por prefijo.
 */
import { describe, it, expect } from 'vitest'
import {
  detectarClaseExportacion,
  simboloNativoDeCabecera,
  leerCsvExplorador,
  unirLecturas,
} from './explorador'

const CAB_NORMAL =
  'Txhash,Blockno,UnixTimestamp,DateTime (UTC),From,To,ContractAddress,Value_IN(ETH),' +
  'Value_OUT(ETH),CurrentValue @ $1785.9/Eth,TxnFee(ETH),TxnFee(USD),Historical $Price/Eth,Status,ErrCode'

const MIA = '0x1111111111111111111111111111111111111111'
const OTRA = '0x2222222222222222222222222222222222222222'

/** Exportación normal: una entrada en invierno, una salida en verano y una fallida. */
const CSV_NORMAL = [
  CAB_NORMAL,
  `0xaaa,19000000,1705399200,2024-01-16 10:00:00,${OTRA},${MIA},,1.5,0,2678.85,0,0,1785.9,,`,
  `0xbbb,20000000,1721124000,2024-07-16 10:00:00,${MIA},${OTRA},,0,"1,234.5",0,0.0021,3.75,1785.9,,`,
  `0xccc,20000001,1721124600,2024-07-16 10:10:00,${MIA},${OTRA},,0,0,0,0.00035,0.62,1785.9,Error(0),Reverted`,
].join('\n')

const CAB_ERC20 =
  'Txhash,Blockno,UnixTimestamp,DateTime (UTC),From,To,TokenValue,USDValueDayOfTx,' +
  'ContractAddress,TokenName,TokenSymbol'

const CSV_ERC20 = [
  CAB_ERC20,
  `0xddd,20000002,1721127600,2024-07-16 11:00:00,${OTRA},${MIA},"1,000",1000,0x9999,USD Coin,USDC`,
].join('\n')

const CAB_INTERNAS =
  'Txhash,Blockno,UnixTimestamp,DateTime (UTC),ParentTxFrom,ParentTxTo,ParentTxETH_Value,' +
  'From,TxTo,ContractAddress,Value_IN(ETH),Value_OUT(ETH),CurrentValue @ $1785.9/Eth,' +
  'Historical $Price/Eth,Status,ErrCode,Type'

const CSV_INTERNAS = [
  CAB_INTERNAS,
  `0xeee,20000003,1721131200,2024-07-16 12:00:00,${MIA},0x8888,0,0x8888,${MIA},,0.25,0,446.47,1785.9,,,call`,
].join('\n')

describe('detección de la exportación', () => {
  it('distingue las tres exportaciones por sus columnas, no por el nombre del fichero', () => {
    expect(detectarClaseExportacion(CAB_NORMAL.split(','))).toBe('normal')
    expect(detectarClaseExportacion(CAB_ERC20.split(','))).toBe('erc20')
    expect(detectarClaseExportacion(CAB_INTERNAS.split(','))).toBe('internas')
  })

  it('no reconoce un CSV cualquiera', () => {
    expect(detectarClaseExportacion(['fecha', 'tipo', 'importe'])).toBeUndefined()
  })

  it('lee el símbolo nativo de la cabecera (BscScan es el mismo formato con otro símbolo)', () => {
    expect(simboloNativoDeCabecera(CAB_NORMAL.split(','))).toBe('ETH')
    expect(simboloNativoDeCabecera(CAB_NORMAL.replace(/ETH/g, 'BNB').split(','))).toBe('BNB')
    // La columna de precio lleva la cotización incrustada: no debe confundir al detector.
    expect(simboloNativoDeCabecera(['CurrentValue @ $1785.9/Eth'])).toBeUndefined()
  })
})

describe('lectura de la exportación normal', () => {
  const lectura = leerCsvExplorador(CSV_NORMAL, 'export-normal.csv')

  it('reconoce la clase y el activo nativo', () => {
    expect(lectura.clase).toBe('normal')
    expect(lectura.activoNativo).toBe('ETH')
    expect(lectura.movimientos).toHaveLength(3)
  })

  it('convierte el UTC a hora local española, con el cambio de hora incluido', () => {
    // 16-1 a las 10:00 UTC → 11:00 en Madrid (CET, +1).
    expect(lectura.movimientos[0]?.fechaHora).toBe('2024-01-16T11:00:00')
    // 16-7 a las 10:00 UTC → 12:00 en Madrid (CEST, +2).
    expect(lectura.movimientos[1]?.fechaHora).toBe('2024-07-16T12:00:00')
  })

  it('lee cantidades anglosajonas con coma de miles', () => {
    expect(lectura.movimientos[1]?.cantidad).toBe('1234.5')
    expect(lectura.movimientos[1]?.sentido).toBe('salida')
    expect(lectura.movimientos[0]?.cantidad).toBe('1.5')
    expect(lectura.movimientos[0]?.sentido).toBe('entrada')
  })

  it('arrastra la comisión de red en cripto', () => {
    expect(lectura.movimientos[1]?.comisionCantidad).toBe('0.0021')
    expect(lectura.movimientos[1]?.comisionActivo).toBe('ETH')
    // La entrada no pagó gas: la comisión del CSV es 0 y no se inventa ninguna.
    expect(lectura.movimientos[0]?.comisionCantidad).toBeUndefined()
  })

  it('importa la transacción FALLIDA solo por el gas (no movió valor)', () => {
    const fallida = lectura.movimientos[2]
    expect(fallida?.fallida).toBe(true)
    expect(fallida?.cantidad).toBe('0')
    expect(fallida?.sentido).toBe('ninguno')
    expect(fallida?.comisionCantidad).toBe('0.00035')
  })

  it('da a cada movimiento una clave de deduplicación txhash#clase#índice', () => {
    expect(lectura.movimientos[0]?.clave).toBe('0xaaa#normal#0')
  })
})

describe('lectura de tokens e internas', () => {
  it('lee el símbolo y el valor del token de la exportación ERC-20', () => {
    const l = leerCsvExplorador(CSV_ERC20, 'export-erc20.csv')
    expect(l.clase).toBe('erc20')
    expect(l.movimientos[0]?.activo).toBe('USDC')
    expect(l.movimientos[0]?.cantidad).toBe('1000')
    // La exportación de tokens no trae comisión: el gas lo trae la normal.
    expect(l.movimientos[0]?.comisionCantidad).toBeUndefined()
  })

  it('lee los movimientos de contrato de la exportación de internas', () => {
    const l = leerCsvExplorador(CSV_INTERNAS, 'export-internas.csv')
    expect(l.clase).toBe('internas')
    expect(l.movimientos[0]?.cantidad).toBe('0.25')
    expect(l.movimientos[0]?.sentido).toBe('entrada')
  })

  it('rechaza un fichero que no es de un explorador', () => {
    expect(() => leerCsvExplorador('fecha,tipo\n2024-01-01,COMPRA', 'x.csv')).toThrow(
      /explorador de bloques/i,
    )
  })
})

describe('unión de ficheros y deduplicación', () => {
  it('reimportar el mismo fichero no duplica nada', () => {
    const l = leerCsvExplorador(CSV_NORMAL)
    const { movimientos, duplicados } = unirLecturas([l, leerCsvExplorador(CSV_NORMAL)])
    expect(movimientos).toHaveLength(3)
    expect(duplicados).toBe(3)
  })

  it('mezcla normal + ERC-20 + internas y ordena cronológicamente', () => {
    const { movimientos, duplicados } = unirLecturas([
      leerCsvExplorador(CSV_ERC20),
      leerCsvExplorador(CSV_NORMAL),
      leerCsvExplorador(CSV_INTERNAS),
    ])
    expect(duplicados).toBe(0)
    expect(movimientos).toHaveLength(5)
    expect(movimientos.map((m) => m.fechaHora)).toEqual([...movimientos.map((m) => m.fechaHora)].sort())
    // La misma transacción en dos exportaciones distintas NO es un duplicado: son patas
    // diferentes (el ETH de la normal y el token de la ERC-20).
    expect(new Set(movimientos.map((m) => m.clave)).size).toBe(5)
  })
})
