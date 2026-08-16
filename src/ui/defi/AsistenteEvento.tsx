/**
 * AsistenteEvento.tsx — asistente por EVENTO, no por apunte.
 *
 * Es la pieza que hace usable todo lo construido en D2–D6. El alumno dice «he aportado a un
 * pool» y la app genera las patas hermanadas, con su criterio ya escrito y su reparto ya
 * calculado. Pedirle que teclee cinco apuntes a mano y que sepa cuál lleva PERMUTA y cuál
 * TRANSFERENCIA sería devolverle el problema que el Libro viene a resolver.
 *
 * La descomposición NO vive aquí: vive en `src/engine/defi/plantillas.ts`, que es TS puro.
 * Esta capa solo recoge datos, muestra la previsualización y guarda. Cuando cambie un
 * criterio, se toca la plantilla y este componente no se entera.
 */
import { useMemo, useState } from 'react'
import {
  descomponer,
  type Pata,
  type SolicitudEvento,
  type Tramo,
} from '../../engine/defi/plantillas'
import { ETIQUETA_EVENTO, ETIQUETA_TIPO, esZonaGris, type EventoDeFi } from '../../engine/types'
import { validarApunte, hayErrores } from '../../engine/validaciones'
import { crearApunte, crearPosicion } from '../../data/repositorio'
import { fmtEuro } from '../formato'
import { BTN_PRIMARIO, BTN_SEC, INPUT, Banner, Modal } from '../comp'

/** Formas de evento que el asistente sabe montar, agrupadas como en el documento. */
type Clase = SolicitudEvento['clase']

const FAMILIAS: { titulo: string; opciones: { clase: Clase; etiqueta: string; ayuda: string }[] }[] = [
  {
    titulo: 'Cesión de capitales',
    opciones: [
      {
        clase: 'recompensa',
        etiqueta: 'Recompensa acreditada',
        ayuda:
          'Staking, delegación, pool o vault. La fecha debe ser la de DISPONIBILIDAD, no la ' +
          'de devengo: es lo que fija la V0612-26 aplicando el art. 14.1.a.',
      },
      {
        clase: 'bloqueo',
        etiqueta: 'Bloqueo o desbloqueo',
        ayuda: 'Sin alteración patrimonial. Solo genera apunte si cambia de ubicación.',
      },
      {
        clase: 'canje-liquido',
        etiqueta: 'Canje (staking líquido, wrapping, bridge, router)',
        ayuda: 'Permuta del art. 37.1.h: consume lote de lo entregado y abre el de lo recibido.',
      },
    ],
  },
  {
    titulo: 'Préstamo',
    opciones: [
      {
        clase: 'movimiento-prestamo',
        etiqueta: 'Entrega, devolución o colateral',
        ayuda: 'Movimiento neutro: no hay hecho imponible.',
      },
      {
        clase: 'principal-recibido',
        etiqueta: 'Recibo el principal prestado',
        ayuda:
          'Neutro, pero abre lote con valor de adquisición: sin él, vender lo prestado ' +
          'computaría ganancia por el 100 %.',
      },
      {
        clase: 'salida-prestamo',
        etiqueta: 'Pago de interés, devolución o liquidación',
        ayuda: 'Transmisión que consume FIFO. La liquidación forzosa es un hecho imponible.',
      },
      {
        clase: 'ejecucion-garantia',
        etiqueta: 'Me quedo con la garantía ejecutada',
        ayuda: 'COMPRA a valor de mercado en la fecha de ejecución. El crédito queda satisfecho.',
      },
    ],
  },
  {
    titulo: 'Pools de liquidez',
    opciones: [
      {
        clase: 'pool-aportacion',
        etiqueta: 'Aporto liquidez',
        ayuda:
          'Tesis benévola: el LP token es un resguardo y la aportación no es hecho imponible.',
      },
      {
        clase: 'pool-retirada',
        etiqueta: 'Retiro liquidez',
        ayuda:
          'Aquí aflora todo, calculado por diferencia entre lo aportado y lo recuperado.',
      },
    ],
  },
  {
    titulo: 'Otros',
    opciones: [
      {
        clase: 'derivado',
        etiqueta: 'Cierro una posición en derivados',
        ayuda: 'Liquidación por diferencias: GyP de la base del ahorro. El art. 37.1.m no aplica.',
      },
      {
        clase: 'hard-fork',
        etiqueta: 'Hard fork',
        ayuda: 'Zona gris sin criterio publicado: elige postura y quedará documentada.',
      },
      {
        clase: 'airdrop-condicionado',
        etiqueta: 'Airdrop condicionado',
        ayuda: 'Si hubo contraprestación real, deja de ser una incorporación gratuita.',
      },
    ],
  },
]

/** Estado del formulario: todo cadenas, como el resto de la app. */
interface Campos {
  fechaHora: string
  protocolo: string
  ubicacionOrigen: string
  ubicacionDestino: string
  activo: string
  cantidad: string
  contravalorEUR: string
  activoRecibido: string
  cantidadRecibida: string
  evento: EventoDeFi
  motivo: 'interes' | 'devolucion-principal' | 'liquidacion-forzosa'
  postura: 'airdrop' | 'coste-cero'
  hayContraprestacion: boolean
  actividadEconomica: boolean
  resultadoNetoEUR: string
  criterioAplicado: string
  aportado: Tramo[]
  recuperado: Tramo[]
}

const VACIO: Campos = {
  fechaHora: '',
  protocolo: '',
  ubicacionOrigen: '',
  ubicacionDestino: '',
  activo: '',
  cantidad: '',
  contravalorEUR: '',
  activoRecibido: '',
  cantidadRecibida: '',
  evento: 'STAKING_CENTRALIZADO',
  motivo: 'interes',
  postura: 'airdrop',
  hayContraprestacion: false,
  actividadEconomica: false,
  resultadoNetoEUR: '',
  criterioAplicado: '',
  aportado: [{ activo: '', cantidad: '', contravalorEUR: '' }],
  recuperado: [{ activo: '', cantidad: '', contravalorEUR: '' }],
}

/** Construye la solicitud del motor a partir de los campos del formulario. */
function aSolicitud(clase: Clase, c: Campos, posicionId?: string): SolicitudEvento | null {
  const comun = {
    fechaHora: c.fechaHora,
    protocolo: c.protocolo,
    ...(posicionId ? { posicionId } : {}),
    ...(c.criterioAplicado.trim() ? { criterioAplicado: c.criterioAplicado.trim() } : {}),
  }
  const tramos = (ts: Tramo[]) => ts.filter((t) => t.activo && t.cantidad)

  switch (clase) {
    case 'recompensa':
      return {
        ...comun,
        clase,
        evento: c.evento as 'STAKING_CENTRALIZADO',
        ubicacionDestino: c.ubicacionDestino,
        activo: c.activo,
        cantidad: c.cantidad,
        contravalorEUR: c.contravalorEUR,
        actividadEconomica: c.actividadEconomica,
      }
    case 'bloqueo':
      return {
        ...comun,
        clase,
        evento: c.evento as 'STAKING_CENTRALIZADO',
        ubicacionOrigen: c.ubicacionOrigen,
        ubicacionDestino: c.ubicacionDestino,
        activo: c.activo,
        cantidad: c.cantidad,
      }
    case 'canje-liquido':
      return {
        ...comun,
        clase,
        evento: c.evento as 'STAKING_LIQUIDO',
        ubicacion: c.ubicacionOrigen,
        activoEntregado: c.activo,
        cantidadEntregada: c.cantidad,
        activoRecibido: c.activoRecibido,
        cantidadRecibida: c.cantidadRecibida,
        contravalorEUR: c.contravalorEUR,
      }
    case 'movimiento-prestamo':
      return {
        ...comun,
        clase,
        evento: c.evento === 'LENDING_PRESTATARIO' ? 'LENDING_PRESTATARIO' : 'LENDING_PRESTAMISTA',
        ubicacionOrigen: c.ubicacionOrigen,
        ubicacionDestino: c.ubicacionDestino,
        activo: c.activo,
        cantidad: c.cantidad,
      }
    case 'principal-recibido':
      return {
        ...comun,
        clase,
        ubicacionDestino: c.ubicacionDestino,
        activo: c.activo,
        cantidad: c.cantidad,
        contravalorEUR: c.contravalorEUR,
      }
    case 'salida-prestamo':
      return {
        ...comun,
        clase,
        motivo: c.motivo,
        ubicacionOrigen: c.ubicacionOrigen,
        activo: c.activo,
        cantidad: c.cantidad,
        contravalorEUR: c.contravalorEUR,
      }
    case 'ejecucion-garantia':
      return {
        ...comun,
        clase,
        ubicacionDestino: c.ubicacionDestino,
        activo: c.activo,
        cantidad: c.cantidad,
        contravalorEUR: c.contravalorEUR,
      }
    case 'pool-aportacion':
      return {
        ...comun,
        clase,
        ubicacionOrigen: c.ubicacionOrigen,
        ubicacionPool: c.ubicacionDestino,
        aportado: tramos(c.aportado),
      }
    case 'pool-retirada':
      return {
        ...comun,
        clase,
        ubicacionPool: c.ubicacionOrigen,
        ubicacionDestino: c.ubicacionDestino,
        aportado: tramos(c.aportado),
        recuperado: tramos(c.recuperado),
      }
    case 'derivado':
      return {
        ...comun,
        clase,
        ubicacion: c.ubicacionDestino,
        resultadoNetoEUR: c.resultadoNetoEUR,
        ...(c.activo && c.cantidad ? { activo: c.activo, cantidad: c.cantidad } : {}),
      }
    case 'hard-fork':
      return {
        ...comun,
        clase,
        postura: c.postura,
        ubicacionDestino: c.ubicacionDestino,
        activo: c.activo,
        cantidad: c.cantidad,
        contravalorEUR: c.contravalorEUR,
      }
    case 'airdrop-condicionado':
      return {
        ...comun,
        clase,
        hayContraprestacion: c.hayContraprestacion,
        ubicacionDestino: c.ubicacionDestino,
        activo: c.activo,
        cantidad: c.cantidad,
        contravalorEUR: c.contravalorEUR,
      }
    default:
      return null
  }
}

export function AsistenteEvento({
  abierto,
  onCerrar,
  ubicaciones,
  onGuardado,
}: {
  abierto: boolean
  onCerrar: () => void
  ubicaciones: { id: string; nombre: string }[]
  onGuardado?: () => void
}) {
  const [clase, setClase] = useState<Clase | null>(null)
  const [c, setC] = useState<Campos>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setC((p) => ({ ...p, [k]: v }))

  // Previsualización en vivo: el usuario ve las patas ANTES de guardar. Es lo que convierte
  // el asistente en una herramienta de aprendizaje y no en una caja negra.
  const patas: Pata[] = useMemo(() => {
    if (!clase) return []
    try {
      const s = aSolicitud(clase, c)
      return s ? descomponer(s) : []
    } catch {
      return []
    }
  }, [clase, c])

  const avisos = useMemo(
    () => patas.flatMap((p, i) => validarApunte({ ...p, id: `previo-${i}` })),
    [patas],
  )
  const bloqueado = hayErrores(avisos)

  const cerrar = () => {
    setClase(null)
    setC(VACIO)
    setError(null)
    onCerrar()
  }

  async function guardar() {
    if (!clase || patas.length === 0) return
    setGuardando(true)
    setError(null)
    try {
      // Toda pata de un mismo evento cuelga de la misma posición: es lo que permite
      // reconstruirla después (aportación → recompensas → retirada).
      const tipoPosicion =
        clase.startsWith('pool') ? 'pool'
        : clase === 'derivado' ? 'derivado'
        : clase.includes('prestamo') || clase.includes('principal') || clase === 'ejecucion-garantia' ? 'lending'
        : 'staking'
      const posicionId = await crearPosicion({
        protocolo: c.protocolo || '—',
        tipoPosicion,
        fechaApertura: c.fechaHora,
        estado: 'abierta',
      })
      const s = aSolicitud(clase, c, posicionId)
      if (!s) throw new Error('No se pudo construir el evento.')
      for (const pata of descomponer(s)) await crearApunte(pata)
      onGuardado?.()
      cerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const selUbic = (valor: string, onChange: (v: string) => void, etiqueta: string) => (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{etiqueta}</span>
      <select className={INPUT} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">— elige —</option>
        <option value="EXTERIOR">EXTERIOR</option>
        {ubicaciones.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
    </label>
  )

  const campo = (etiqueta: string, valor: string, onChange: (v: string) => void, ph = '') => (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{etiqueta}</span>
      <input className={INPUT} value={valor} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
    </label>
  )

  const tabla = (
    titulo: string,
    lista: Tramo[],
    onChange: (t: Tramo[]) => void,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
        <button
          type="button"
          className={BTN_SEC}
          onClick={() => onChange([...lista, { activo: '', cantidad: '', contravalorEUR: '' }])}
        >
          + activo
        </button>
      </div>
      {lista.map((t, i) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          <input
            className={INPUT}
            placeholder="Activo"
            value={t.activo}
            onChange={(e) => onChange(lista.map((x, j) => (i === j ? { ...x, activo: e.target.value } : x)))}
          />
          <input
            className={INPUT}
            placeholder="Cantidad"
            value={t.cantidad}
            onChange={(e) => onChange(lista.map((x, j) => (i === j ? { ...x, cantidad: e.target.value } : x)))}
          />
          <input
            className={INPUT}
            placeholder="Contravalor €"
            value={t.contravalorEUR}
            onChange={(e) =>
              onChange(lista.map((x, j) => (i === j ? { ...x, contravalorEUR: e.target.value } : x)))
            }
          />
        </div>
      ))}
    </div>
  )

  const opcion = FAMILIAS.flatMap((f) => f.opciones).find((o) => o.clase === clase)

  return (
    <Modal titulo="Nuevo evento DeFi" abierto={abierto} onCerrar={cerrar} ancho="max-w-3xl">
      {!clase ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Elige el hecho económico. La app generará los apuntes que le correspondan, con su
            tipo y su criterio ya puestos.
          </p>
          {FAMILIAS.map((f) => (
            <div key={f.titulo}>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {f.titulo}
              </h4>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {f.opciones.map((o) => (
                  <button
                    key={o.clase}
                    type="button"
                    className={`${BTN_SEC} h-auto justify-start px-3 py-2 text-left`}
                    onClick={() => setClase(o.clase)}
                  >
                    <span>
                      <span className="block font-medium">{o.etiqueta}</span>
                      <span className="block text-xs font-normal text-slate-500">{o.ayuda}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{opcion?.etiqueta}</p>
              <p className="text-xs text-slate-500">{opcion?.ayuda}</p>
            </div>
            <button type="button" className={BTN_SEC} onClick={() => setClase(null)}>
              Cambiar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {campo('Fecha y hora', c.fechaHora, (v) => set('fechaHora', v), '2026-03-01T10:00:00')}
            {campo('Protocolo', c.protocolo, (v) => set('protocolo', v), 'Aave, Lido, Uniswap v3…')}

            {clase === 'recompensa' && (
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Origen del rendimiento</span>
                <select
                  className={INPUT}
                  value={c.evento}
                  onChange={(e) => set('evento', e.target.value as EventoDeFi)}
                >
                  <option value="STAKING_CENTRALIZADO">Staking en plataforma</option>
                  <option value="STAKING_NATIVO">Staking nativo o delegación</option>
                  <option value="POOL_RECOMPENSA">Recompensa de pool</option>
                  <option value="VAULT">Vault autocompuesto</option>
                </select>
              </label>
            )}

            {clase === 'canje-liquido' && (
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Tipo de canje</span>
                <select
                  className={INPUT}
                  value={c.evento}
                  onChange={(e) => set('evento', e.target.value as EventoDeFi)}
                >
                  <option value="STAKING_LIQUIDO">Staking líquido</option>
                  <option value="WRAPPING">Wrapping</option>
                  <option value="BRIDGE">Bridge</option>
                  <option value="ROUTER_MULTIHOP">Intercambio con saltos intermedios</option>
                </select>
              </label>
            )}

            {clase === 'movimiento-prestamo' && (
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">¿Qué lado?</span>
                <select
                  className={INPUT}
                  value={c.evento}
                  onChange={(e) => set('evento', e.target.value as EventoDeFi)}
                >
                  <option value="LENDING_PRESTAMISTA">Presto yo</option>
                  <option value="LENDING_PRESTATARIO">Me prestan a mí</option>
                </select>
              </label>
            )}

            {clase === 'salida-prestamo' && (
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Motivo</span>
                <select
                  className={INPUT}
                  value={c.motivo}
                  onChange={(e) => set('motivo', e.target.value as Campos['motivo'])}
                >
                  <option value="interes">Pago de interés</option>
                  <option value="devolucion-principal">Devolución del principal</option>
                  <option value="liquidacion-forzosa">Liquidación forzosa del colateral</option>
                </select>
              </label>
            )}

            {clase === 'hard-fork' && (
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Postura (decisión manual)</span>
                <select
                  className={INPUT}
                  value={c.postura}
                  onChange={(e) => set('postura', e.target.value as Campos['postura'])}
                >
                  <option value="airdrop">Asimilar al airdrop (valor de mercado, base general)</option>
                  <option value="coste-cero">Coste cero (diferir a la venta)</option>
                </select>
              </label>
            )}

            {clase === 'airdrop-condicionado' && (
              <label className="flex items-center gap-2 self-end text-sm">
                <input
                  type="checkbox"
                  checked={c.hayContraprestacion}
                  onChange={(e) => set('hayContraprestacion', e.target.checked)}
                />
                <span>Hubo contraprestación real</span>
              </label>
            )}

            {clase === 'recompensa' && (
              <label className="flex items-center gap-2 self-end text-sm">
                <input
                  type="checkbox"
                  checked={c.actividadEconomica}
                  onChange={(e) => set('actividadEconomica', e.target.checked)}
                />
                <span>Minería PoW con medios propios (actividad económica)</span>
              </label>
            )}

            {['bloqueo', 'canje-liquido', 'movimiento-prestamo', 'salida-prestamo', 'pool-aportacion', 'pool-retirada'].includes(clase) &&
              selUbic(c.ubicacionOrigen, (v) => set('ubicacionOrigen', v), clase.startsWith('pool') && clase === 'pool-retirada' ? 'Ubicación del pool' : 'Origen')}

            {clase !== 'salida-prestamo' &&
              selUbic(
                c.ubicacionDestino,
                (v) => set('ubicacionDestino', v),
                clase === 'pool-aportacion' ? 'Ubicación del pool' : clase === 'derivado' ? 'Plataforma' : 'Destino',
              )}

            {!clase.startsWith('pool') && (
              <>
                {campo(clase === 'canje-liquido' ? 'Activo entregado' : 'Activo', c.activo, (v) => set('activo', v), 'ETH')}
                {campo('Cantidad', c.cantidad, (v) => set('cantidad', v), '1')}
              </>
            )}

            {clase === 'canje-liquido' && (
              <>
                {campo('Activo recibido', c.activoRecibido, (v) => set('activoRecibido', v), 'rETH')}
                {campo('Cantidad recibida', c.cantidadRecibida, (v) => set('cantidadRecibida', v), '0.95')}
              </>
            )}

            {clase === 'derivado'
              ? campo('Resultado neto € (con signo)', c.resultadoNetoEUR, (v) => set('resultadoNetoEUR', v), '-300')
              : !['bloqueo', 'movimiento-prestamo', 'pool-aportacion', 'pool-retirada'].includes(clase) &&
                campo('Contravalor €', c.contravalorEUR, (v) => set('contravalorEUR', v), '3000')}
          </div>

          {clase === 'pool-aportacion' && tabla('Activos aportados', c.aportado, (t) => set('aportado', t))}
          {clase === 'pool-retirada' && (
            <>
              {tabla('Lo que aporté en su día', c.aportado, (t) => set('aportado', t))}
              {tabla('Lo que he recuperado', c.recuperado, (t) => set('recuperado', t))}
              <Banner tono="info">
                La pérdida no permanente (<em>impermanent loss</em>) no se registra: es lucro
                cesante, no pérdida fiscal. Solo el neto entre lo aportado y lo recuperado
                produce ganancia o pérdida computable.
              </Banner>
            </>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Criterio aplicado (se rellena solo en las zonas grises; puedes matizarlo)
            </span>
            <textarea
              className={`${INPUT} h-16`}
              value={c.criterioAplicado}
              placeholder={patas[0]?.criterioAplicado ?? ''}
              onChange={(e) => set('criterioAplicado', e.target.value)}
            />
          </label>

          {/* Previsualización: lo que se va a escribir en el Libro, antes de escribirlo. */}
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Apuntes que se crearán ({patas.length})
            </p>
            {patas.length === 0 ? (
              <p className="text-sm text-slate-400">Completa los datos para ver el resultado.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {patas.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                      {ETIQUETA_TIPO[p.tipo]}
                    </span>
                    {p.activoSalida && (
                      <span className="tabular-nums">− {p.cantidadSalida} {p.activoSalida}</span>
                    )}
                    {p.activoEntrada && (
                      <span className="tabular-nums">+ {p.cantidadEntrada} {p.activoEntrada}</span>
                    )}
                    {p.contravalorEUR && (
                      <span className="text-slate-500">({fmtEuro(p.contravalorEUR)})</span>
                    )}
                    {p.contravalorAlternativoEUR && (
                      <span
                        className="text-xs text-slate-400"
                        title="Importe que resultaría de aplicar la tesis contraria. No se declara; sirve para poder defenderla o recalcularla."
                      >
                        · alt. {fmtEuro(p.contravalorAlternativoEUR)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {patas.length === 0 && clase === 'bloqueo' && c.ubicacionOrigen && c.ubicacionOrigen === c.ubicacionDestino && (
              <p className="mt-2 text-sm text-slate-500">
                No cambia de ubicación: no hay alteración patrimonial ni movimiento, así que no
                hay nada que anotar.
              </p>
            )}
          </div>

          {esZonaGris(patas[0]?.evento) && (
            <Banner tono="info">
              <strong>{ETIQUETA_EVENTO[patas[0]!.evento!]}</strong> no tiene criterio administrativo
              publicado. La app aplica la tesis por defecto y deja constancia del criterio; el
              informe fiscal lo mostrará aparte con su disclaimer.
            </Banner>
          )}

          {avisos.filter((a) => a.nivel === 'error').map((a, i) => (
            <Banner key={i} tono="error">{a.mensaje}</Banner>
          ))}
          {error && <Banner tono="error">{error}</Banner>}

          <div className="flex justify-end gap-2">
            <button type="button" className={BTN_SEC} onClick={cerrar}>
              Cancelar
            </button>
            <button
              type="button"
              className={BTN_PRIMARIO}
              disabled={patas.length === 0 || bloqueado || guardando}
              onClick={guardar}
            >
              {guardando ? 'Guardando…' : `Crear ${patas.length} apunte(s)`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
