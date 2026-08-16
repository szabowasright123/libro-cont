/**
 * posiciones.test.ts — D1: dimensión DeFi sobre el apunte y entidad `Posicion`.
 *
 * Lo que se comprueba aquí es que la dimensión DeFi es ORTOGONAL: se puede etiquetar
 * un apunte con su evento y su posición sin que cambie una sola cifra del motor.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from './db'
import {
  crearApunte,
  listarApuntes,
  crearPosicion,
  listarPosiciones,
  actualizarPosicion,
  eliminarPosicion,
  apuntesConPosicion,
  apuntesDePosicion,
  snapshotActual,
  restaurarSnapshot,
} from './repositorio'
import { construirSnapshot } from './import/json-backup'
import { validarApunte } from '../engine/validaciones'
import { EVENTOS_ZONA_GRIS, esZonaGris, ETIQUETA_EVENTO, type Apunte } from '../engine/types'

const BASE = {
  fechaHora: '2026-03-01T10:00:00',
  ubicacionOrigen: 'EXTERIOR',
  ubicacionDestino: 'lido',
} as const

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('D1 · catálogo de eventos DeFi', () => {
  it('todo evento de zona gris tiene etiqueta de presentación', () => {
    for (const e of EVENTOS_ZONA_GRIS) {
      expect(ETIQUETA_EVENTO[e]).toBeTruthy()
    }
  })

  it('los eventos con criterio DGT firme NO son zona gris', () => {
    // Staking (V1766-22, V0612-26), recompensas de pool y farming (V0648-24) y la
    // ejecución de garantía (criterio del autor) están resueltos: no exigen nota.
    expect(esZonaGris('STAKING_CENTRALIZADO')).toBe(false)
    expect(esZonaGris('POOL_RECOMPENSA')).toBe(false)
    expect(esZonaGris('EJECUCION_GARANTIA')).toBe(false)
    expect(esZonaGris(undefined)).toBe(false)
  })

  it('los supuestos sin criterio administrativo SÍ son zona gris', () => {
    expect(esZonaGris('POOL_APORTACION')).toBe(true)
    expect(esZonaGris('WRAPPING')).toBe(true)
    expect(esZonaGris('HARD_FORK')).toBe(true)
  })
})

describe('D1 · validación de zona gris', () => {
  const rendimiento = (extra: Partial<Apunte> = {}): Apunte => ({
    id: '2026-001',
    tipo: 'RENDIMIENTO',
    activoEntrada: 'ETH',
    cantidadEntrada: '0.05',
    contravalorEUR: '150',
    ...BASE,
    ...extra,
  })

  it('un evento de zona gris SIN criterio aplicado avisa (no bloquea)', () => {
    const avisos = validarApunte(rendimiento({ evento: 'VAULT' }))
    const zg = avisos.find((a) => a.codigo === 'ZONA_GRIS_SIN_CRITERIO')
    expect(zg).toBeDefined()
    // Aviso, no error: el principio de integridad manda registrar TODO movimiento.
    expect(zg?.nivel).toBe('aviso')
  })

  it('con criterio aplicado no avisa', () => {
    const avisos = validarApunte(
      rendimiento({ evento: 'VAULT', criterioAplicado: 'GP a la salida (DEFI §C5)' }),
    )
    expect(avisos.some((a) => a.codigo === 'ZONA_GRIS_SIN_CRITERIO')).toBe(false)
  })

  it('un criterio en blanco no cuenta como criterio', () => {
    const avisos = validarApunte(rendimiento({ evento: 'WRAPPING', criterioAplicado: '   ' }))
    expect(avisos.some((a) => a.codigo === 'ZONA_GRIS_SIN_CRITERIO')).toBe(true)
  })

  it('un evento con criterio DGT firme no exige nota', () => {
    const avisos = validarApunte(rendimiento({ evento: 'POOL_RECOMPENSA' }))
    expect(avisos.some((a) => a.codigo === 'ZONA_GRIS_SIN_CRITERIO')).toBe(false)
  })

  it('criterio sin evento avisa de incoherencia', () => {
    const avisos = validarApunte(rendimiento({ criterioAplicado: 'algo' }))
    expect(avisos.some((a) => a.codigo === 'CRITERIO_SIN_EVENTO')).toBe(true)
  })
})

describe('D1 · persistencia de posiciones', () => {
  const posicionBase = {
    protocolo: 'Lido',
    tipoPosicion: 'staking',
    fechaApertura: '2026-03-01T10:00:00',
    estado: 'abierta',
  } as const

  it('alta, listado y edición', async () => {
    const id = await crearPosicion({ ...posicionBase })
    expect(await listarPosiciones()).toHaveLength(1)

    await actualizarPosicion(id, { estado: 'cerrada', fechaCierre: '2026-06-01T10:00:00' })
    const [p] = await listarPosiciones()
    expect(p?.estado).toBe('cerrada')
    expect(p?.fechaCierre).toBe('2026-06-01T10:00:00')
  })

  it('agrupa las patas de una posición y las devuelve en orden cronológico', async () => {
    const id = await crearPosicion({ ...posicionBase })
    // Se crean a propósito en orden inverso al cronológico.
    await crearApunte({
      ...BASE,
      fechaHora: '2026-05-01T10:00:00',
      tipo: 'RENDIMIENTO',
      activoEntrada: 'ETH',
      cantidadEntrada: '0.02',
      contravalorEUR: '60',
      evento: 'STAKING_CENTRALIZADO',
      posicionId: id,
      protocolo: 'Lido',
    })
    await crearApunte({
      ...BASE,
      fechaHora: '2026-04-01T10:00:00',
      tipo: 'RENDIMIENTO',
      activoEntrada: 'ETH',
      cantidadEntrada: '0.01',
      contravalorEUR: '30',
      evento: 'STAKING_CENTRALIZADO',
      posicionId: id,
      protocolo: 'Lido',
    })

    expect(await apuntesConPosicion(id)).toBe(2)
    const patas = await apuntesDePosicion(id)
    expect(patas.map((a) => a.fechaHora)).toEqual([
      '2026-04-01T10:00:00',
      '2026-05-01T10:00:00',
    ])
  })

  it('no borra una posición con apuntes salvo que se fuerce, y entonces los desvincula', async () => {
    const id = await crearPosicion({ ...posicionBase })
    await crearApunte({
      ...BASE,
      tipo: 'RENDIMIENTO',
      activoEntrada: 'ETH',
      cantidadEntrada: '0.01',
      contravalorEUR: '30',
      evento: 'STAKING_CENTRALIZADO',
      posicionId: id,
    })

    await expect(eliminarPosicion(id)).rejects.toThrow(/apunte/i)
    expect(await listarPosiciones()).toHaveLength(1)

    await eliminarPosicion(id, true)
    expect(await listarPosiciones()).toHaveLength(0)
    // El apunte sobrevive —el Libro manda— pero sin referencia colgando.
    const [ap] = await listarApuntes()
    expect(ap).toBeDefined()
    expect(ap?.posicionId).toBeUndefined()
  })
})

describe('D1 · la copia JSON conserva la dimensión DeFi', () => {
  it('las posiciones y los campos del apunte sobreviven a exportar y restaurar', async () => {
    const id = await crearPosicion({
      id: 'pos-uniswap-1',
      protocolo: 'Uniswap v3',
      tipoPosicion: 'pool',
      fechaApertura: '2026-02-01T09:00:00',
      estado: 'abierta',
    })
    await crearApunte({
      ...BASE,
      tipo: 'TRANSFERENCIA',
      activoSalida: 'ETH',
      cantidadSalida: '1',
      activoEntrada: 'ETH',
      cantidadEntrada: '1',
      evento: 'POOL_APORTACION',
      posicionId: id,
      protocolo: 'Uniswap v3',
      criterioAplicado: 'Tesis benévola: el LP token es resguardo (DEFI §C1)',
    })

    const snapshot = construirSnapshot(await snapshotActual())
    expect(snapshot.posiciones).toHaveLength(1)

    // Viaje completo por JSON, como en una copia real.
    await restaurarSnapshot(JSON.parse(JSON.stringify(snapshot)))

    const posiciones = await listarPosiciones()
    expect(posiciones[0]?.id).toBe('pos-uniswap-1')
    expect(posiciones[0]?.protocolo).toBe('Uniswap v3')

    const [ap] = await listarApuntes()
    expect(ap?.evento).toBe('POOL_APORTACION')
    expect(ap?.posicionId).toBe('pos-uniswap-1')
    expect(ap?.criterioAplicado).toContain('benévola')
  })

  it('una copia anterior a D1 (sin posiciones) se restaura sin romperse', async () => {
    const snapshot = construirSnapshot(await snapshotActual())
    const { posiciones: _quitado, ...sinPosiciones } = snapshot
    await expect(
      restaurarSnapshot(sinPosiciones as typeof snapshot),
    ).resolves.toBeDefined()
    expect(await listarPosiciones()).toHaveLength(0)
  })
})
