/**
 * triaje.test.ts — de movimientos de explorador a candidatos a apunte (ENCARGO, Parte 2).
 *
 * Lo que se blinda aquí es el criterio del encargo: la ÚNICA deducción con confianza alta
 * es el traslado entre direcciones propias; todo lo demás nace SIN calificar, y ningún
 * apunte se da por bueno sin que el alumno lo confirme.
 */
import { describe, it, expect } from 'vitest'
import { leerCsvExplorador } from './explorador'
import { indexarDirecciones } from './direcciones'
import {
  proponerCandidatos,
  candidatoABorrador,
  candidatosABorradores,
  marcaTx,
  extraerMarcasTx,
} from './triaje'
import { UBICACION_EXTERIOR, type Ubicacion } from '../../engine/types'
import { validarApunte } from '../../engine/validaciones'

const LEDGER = '0x1111111111111111111111111111111111111111'
const METAMASK = '0x2222222222222222222222222222222222222222'
const AJENA = '0x9999999999999999999999999999999999999999'

const UBICACIONES: Ubicacion[] = [
  { id: 'u-ledger', nombre: 'Ledger', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-01T00:00:00', direcciones: [LEDGER] },
  { id: 'u-mm', nombre: 'MetaMask', tipo: 'wallet', kyc: false, fechaAlta: '2024-01-01T00:00:00', direcciones: [METAMASK] },
]

const CAB =
  'Txhash,Blockno,UnixTimestamp,DateTime (UTC),From,To,ContractAddress,Value_IN(ETH),' +
  'Value_OUT(ETH),CurrentValue @ $1785.9/Eth,TxnFee(ETH),TxnFee(USD),Historical $Price/Eth,Status,ErrCode'

const CSV = [
  CAB,
  // 1 · traslado entre dos direcciones propias (Ledger → MetaMask), con gas.
  `0xaaa,1,1705399200,2024-01-16 10:00:00,${LEDGER},${METAMASK},,0,2,0,0.001,2,1785.9,,`,
  // 2 · entra desde una dirección ajena: frontera con el exterior.
  `0xbbb,2,1705402800,2024-01-16 11:00:00,${AJENA},${LEDGER},,3,0,0,0,0,1785.9,,`,
  // 3 · sale hacia una dirección ajena.
  `0xccc,3,1705406400,2024-01-16 12:00:00,${LEDGER},${AJENA},,0,1,0,0.002,4,1785.9,,`,
  // 4 · ni origen ni destino son del alumno.
  `0xddd,4,1705410000,2024-01-16 13:00:00,${AJENA},0x8888888888888888888888888888888888888888,,0,5,0,0.001,2,1785.9,,`,
  // 5 · transacción fallida: solo gas.
  `0xeee,5,1705413600,2024-01-16 14:00:00,${LEDGER},${AJENA},,0,0,0,0.0005,1,1785.9,Error(0),Reverted`,
].join('\n')

const indice = indexarDirecciones(UBICACIONES)
const candidatos = proponerCandidatos(leerCsvExplorador(CSV).movimientos, indice)

describe('propuesta de candidatos', () => {
  it('propone TRANSFERENCIA con confianza alta solo entre direcciones propias', () => {
    const c = candidatos[0]
    expect(c?.tipo).toBe('TRANSFERENCIA')
    expect(c?.confianza).toBe('alta')
    expect(c?.ubicacionOrigen).toBe('u-ledger')
    expect(c?.ubicacionDestino).toBe('u-mm')
    expect(c?.incluir).toBe(true)
  })

  it('deja SIN calificar lo que cruza la frontera, en los dos sentidos', () => {
    const entrada = candidatos[1]
    expect(entrada?.tipo).toBe('')
    expect(entrada?.confianza).toBe('pendiente')
    expect(entrada?.ubicacionOrigen).toBe(UBICACION_EXTERIOR)
    expect(entrada?.ubicacionDestino).toBe('u-ledger')
    expect(entrada?.sugerencias).toContain('COMPRA')

    const salida = candidatos[2]
    expect(salida?.tipo).toBe('')
    expect(salida?.ubicacionOrigen).toBe('u-ledger')
    expect(salida?.ubicacionDestino).toBe(UBICACION_EXTERIOR)
    expect(salida?.sugerencias).toContain('VENTA')
  })

  it('marca como ajeno, y NO lo incluye, lo que no toca ninguna dirección registrada', () => {
    expect(candidatos[3]?.confianza).toBe('ajeno')
    expect(candidatos[3]?.incluir).toBe(false)
  })

  it('la comisión solo se arrastra cuando el gas lo pagó el alumno (envío propio)', () => {
    expect(candidatos[0]?.comisionCantidad).toBe('0.001') // envía Ledger: paga el alumno
    expect(candidatos[1]?.comisionCantidad).toBeUndefined() // recibe: paga el remitente
    expect(candidatos[2]?.comisionCantidad).toBe('0.002')
  })

  it('la transacción fallida no mueve valor y no se incluye por defecto', () => {
    const c = candidatos[4]
    expect(c?.cantidad).toBe('0')
    expect(c?.incluir).toBe(false)
    expect(c?.motivo).toMatch(/gas/i)
  })

  it('NUNCA propone contravalor en euros (sin red no hay precios)', () => {
    expect(candidatos.every((c) => c.contravalorEUR === undefined)).toBe(true)
  })
})

describe('candidato → borrador de apunte', () => {
  it('el traslado propio produce una TRANSFERENCIA válida para el motor', () => {
    const b = candidatoABorrador(candidatos[0]!)
    expect(b.tipo).toBe('TRANSFERENCIA')
    expect(b.activoSalida).toBe('ETH')
    expect(b.cantidadSalida).toBe('2')
    expect(b.activoEntrada).toBe('ETH')
    expect(b.cantidadEntrada).toBe('2')
    expect(b.comisionCantidad).toBe('0.001')
    const avisos = validarApunte({ ...b, id: '2024-001' })
    expect(avisos.filter((a) => a.nivel === 'error')).toHaveLength(0)
  })

  it('un candidato sin calificar no puede entrar en el Diario', () => {
    expect(() => candidatoABorrador(candidatos[1]!)).toThrow(/calific/i)
  })

  it('calificado por el alumno, coloca el activo en el lado que corresponde', () => {
    const compra = candidatoABorrador({ ...candidatos[1]!, tipo: 'COMPRA' })
    expect(compra.activoEntrada).toBe('ETH')
    expect(compra.cantidadEntrada).toBe('3')
    expect(compra.activoSalida).toBeUndefined()

    const venta = candidatoABorrador({ ...candidatos[2]!, tipo: 'VENTA' })
    expect(venta.activoSalida).toBe('ETH')
    expect(venta.cantidadSalida).toBe('1')
    expect(venta.activoEntrada).toBeUndefined()
    // Sin contravalor: la validación existente lo señalará como pendiente. Es correcto.
    expect(venta.contravalorEUR).toBeUndefined()
  })

  it('cada apunte importado lleva su marca de deduplicación y el txhash en notas', () => {
    const b = candidatoABorrador(candidatos[0]!)
    expect(b.notas).toContain(marcaTx('0xaaa#normal#0'))
    expect(b.notas).toContain('txhash 0xaaa')
    expect(extraerMarcasTx(b.notas)).toEqual(['0xaaa#normal#0'])
  })

  it('solo convierte los marcados Y calificados', () => {
    const borradores = candidatosABorradores(candidatos)
    expect(borradores).toHaveLength(1) // solo el traslado propio viene calificado de serie
    const conCalificacion = candidatos.map((c) =>
      c.confianza === 'pendiente' && c.incluir ? { ...c, tipo: 'COMPRA' as const } : c,
    )
    expect(candidatosABorradores(conCalificacion)).toHaveLength(3)
  })
})
