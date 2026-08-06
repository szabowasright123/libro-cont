/**
 * DiarioPage — el DIARIO: tabla densa de apuntes (TanStack), en orden cronológico,
 * con buscador y filtros por tipo/ubicación/activo/año. Numeración automática
 * AAAA-NNN (la asigna el repositorio). Alta, edición, duplicado y borrado de apuntes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TipoOperacion } from '../../engine/types'
import { ETIQUETA_TIPO, TIPOS_OPERACION, UBICACION_EXTERIOR } from '../../engine/types'
import type { EstadoProbatorio } from '../../engine/archivo'
import { mapaKyc } from '../../engine/archivo'
import { selloOrigenApunte } from '../../engine/trazabilidad'
import type { ApunteRegistro, BorradorApunte } from '../../data/tipos'
import {
  listarRegistros,
  listarUbicaciones,
  listarActivos,
  listarJustificantes,
  eliminarApunte,
  duplicarComoBorrador,
} from '../../data/repositorio'
import { useLiveQuery } from '../../data/useLiveQuery'
import { fmtDecimal, fmtEuro, fmtFechaHora } from '../formato'
import { BTN_PRIMARIO, BTN_SEC, BTN_PELIGRO, INPUT, KBD, Banner } from '../comp'
import { FormularioApunte, type AperturaFormulario } from '../libro/FormularioApunte'
import { PLANTILLAS, type PlantillaRapida } from '../libro/plantillas'
import { BadgeEstadoProbatorio, mapaEstadosProbatorios } from '../archivo/EstadoProbatorio'
import { SelloKyc } from '../trazabilidad/SelloKyc'
import { UnidadManual } from '../guia/UnidadManual'

/** Fila de la tabla: el registro + valores ya presentados. */
interface FilaDiario {
  registro: ApunteRegistro
  origen: string
  destino: string
  salida: string
  entrada: string
  comision: string
  anio: string
  estadoProbatorio: EstadoProbatorio
  faltantesProbatorios: string
  /** Sello de origen: KYC de la ubicación relevante (null si no aplica). */
  origenKyc: boolean | null
}

/** Convierte un registro almacenado en borrador editable del formulario. */
function registroABorrador(r: ApunteRegistro): BorradorApunte {
  const { uid: _uid, id: _id, creadoEn: _creadoEn, ...resto } = r
  return { ...resto }
}

const col = createColumnHelper<FilaDiario>()

export function DiarioPage() {
  const registrosQ = useLiveQuery(listarRegistros, [])
  const ubicacionesQ = useLiveQuery(listarUbicaciones, [])
  const activosQ = useLiveQuery(listarActivos, [])
  const justificantesQ = useLiveQuery(listarJustificantes, [])

  const registros = registrosQ.estado === 'listo' ? registrosQ.datos : []
  const ubicaciones = ubicacionesQ.estado === 'listo' ? ubicacionesQ.datos : []
  const activos = activosQ.estado === 'listo' ? activosQ.datos : []
  const justificantes = justificantesQ.estado === 'listo' ? justificantesQ.datos : []

  // Estado probatorio por apunte (correlativo), para la columna del Archivo.
  const estadosProbatorios = useMemo(
    () => mapaEstadosProbatorios(registros, justificantes, ubicaciones),
    [registros, justificantes, ubicaciones],
  )

  const [apertura, setApertura] = useState<AperturaFormulario | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filtros.
  const [busqueda, setBusqueda] = useState('')
  const [fTipo, setFTipo] = useState<string>('')
  const [fUbic, setFUbic] = useState<string>('')
  const [fActivo, setFActivo] = useState<string>('')
  const [fAnio, setFAnio] = useState<string>('')

  const nombrePorId = useMemo(
    () => new Map(ubicaciones.map((u) => [u.id, u.nombre])),
    [ubicaciones],
  )
  const nombreUbic = (ref: string) =>
    ref === UBICACION_EXTERIOR ? 'EXTERIOR' : nombrePorId.get(ref) ?? ref

  const kyc = useMemo(() => mapaKyc(ubicaciones), [ubicaciones])

  // Filas presentadas.
  const filas: FilaDiario[] = useMemo(
    () =>
      registros.map((r) => {
        const est = estadosProbatorios.get(r.id)
        const sello = selloOrigenApunte(r, kyc)
        return {
          registro: r,
          origen: nombreUbic(r.ubicacionOrigen),
          destino: nombreUbic(r.ubicacionDestino),
          salida: r.activoSalida && r.cantidadSalida ? `${fmtDecimal(r.cantidadSalida)} ${r.activoSalida}` : '—',
          entrada: r.activoEntrada && r.cantidadEntrada ? `${fmtDecimal(r.cantidadEntrada)} ${r.activoEntrada}` : '—',
          comision:
            r.comisionCantidad && r.comisionActivo
              ? `${fmtDecimal(r.comisionCantidad)} ${r.comisionActivo}`
              : '—',
          anio: r.fechaHora.slice(0, 4),
          estadoProbatorio: est?.estado ?? 'sin-justificar',
          faltantesProbatorios: est?.faltantes.map((f) => f.documento).join(', ') ?? '',
          origenKyc: sello.aplica ? sello.kyc : null,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registros, nombrePorId, estadosProbatorios, kyc],
  )

  const anios = useMemo(
    () => [...new Set(filas.map((f) => f.anio))].sort(),
    [filas],
  )

  // Aplicación de filtros y buscador (sobre el registro subyacente).
  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter((f) => {
      const r = f.registro
      if (fTipo && r.tipo !== fTipo) return false
      if (fAnio && f.anio !== fAnio) return false
      if (fUbic && r.ubicacionOrigen !== fUbic && r.ubicacionDestino !== fUbic) return false
      if (
        fActivo &&
        r.activoEntrada !== fActivo &&
        r.activoSalida !== fActivo &&
        r.comisionActivo !== fActivo
      )
        return false
      if (q) {
        const heno = [
          r.id,
          ETIQUETA_TIPO[r.tipo],
          f.origen,
          f.destino,
          r.activoEntrada,
          r.activoSalida,
          r.notas,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!heno.includes(q)) return false
      }
      return true
    })
  }, [filas, busqueda, fTipo, fUbic, fActivo, fAnio])

  const columnas = useMemo(
    () => [
      col.accessor((f) => f.registro.id, {
        id: 'id',
        header: 'Nº',
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      col.accessor((f) => f.registro.fechaHora, {
        id: 'fecha',
        header: 'Fecha',
        cell: (c) => <span className="whitespace-nowrap tabular-nums">{fmtFechaHora(c.getValue())}</span>,
      }),
      col.accessor((f) => f.registro.tipo, {
        id: 'tipo',
        header: 'Tipo',
        cell: (c) => (
          <span className="whitespace-nowrap font-medium">{ETIQUETA_TIPO[c.getValue() as TipoOperacion]}</span>
        ),
      }),
      col.accessor('origenKyc', {
        id: 'sello',
        header: () => <span title="Origen KYC / no-KYC de la operación">KYC</span>,
        cell: (c) => {
          const v = c.getValue()
          return v === null ? (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          ) : (
            <SelloKyc kyc={v} soloIcono />
          )
        },
      }),
      col.accessor('origen', { header: 'Origen', cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span> }),
      col.accessor('destino', { header: 'Destino', cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span> }),
      col.accessor('salida', { header: 'Salida', cell: (c) => <span className="whitespace-nowrap tabular-nums">{c.getValue()}</span> }),
      col.accessor('entrada', { header: 'Entrada', cell: (c) => <span className="whitespace-nowrap tabular-nums">{c.getValue()}</span> }),
      col.accessor('comision', { header: 'Comisión', cell: (c) => <span className="whitespace-nowrap tabular-nums">{c.getValue()}</span> }),
      col.accessor((f) => f.registro.contravalorEUR, {
        id: 'contravalor',
        header: 'Contravalor',
        cell: (c) => <span className="whitespace-nowrap tabular-nums">{fmtEuro(c.getValue())}</span>,
      }),
      col.accessor((f) => f.registro.notas, {
        id: 'notas',
        header: 'Notas',
        cell: (c) => (
          <span className="block max-w-[14rem] truncate text-slate-500" title={c.getValue() ?? ''}>
            {c.getValue() ?? '—'}
          </span>
        ),
      }),
      col.accessor('estadoProbatorio', {
        id: 'probatorio',
        header: 'Estado probatorio',
        cell: (c) => (
          <BadgeEstadoProbatorio
            estado={c.getValue()}
            titulo={c.row.original.faltantesProbatorios ? `Falta: ${c.row.original.faltantesProbatorios}` : undefined}
          />
        ),
      }),
      col.display({
        id: 'acciones',
        header: () => <span className="sr-only">Acciones</span>,
        cell: (c) => {
          const r = c.row.original.registro
          return (
            <div className="flex justify-end gap-1 whitespace-nowrap">
              <button type="button" className={BTN_SEC} onClick={() => abrirEdicion(r)}>
                Editar
              </button>
              <button type="button" className={BTN_SEC} onClick={() => abrirDuplicado(r)}>
                Duplicar
              </button>
              <button type="button" className={BTN_PELIGRO} onClick={() => borrar(r)}>
                Borrar
              </button>
            </div>
          )
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const tabla = useReactTable({
    data: filasFiltradas,
    columns: columnas,
    getCoreRowModel: getCoreRowModel(),
  })
  const filasTabla = tabla.getRowModel().rows

  // Virtualización de la tabla: con miles de apuntes solo se renderizan las filas
  // visibles (rendimiento P8). Alturas uniformes → tamaño estimado fijo.
  const contenedorRef = useRef<HTMLDivElement>(null)
  const virtualizador = useVirtualizer({
    count: filasTabla.length,
    getScrollElement: () => contenedorRef.current,
    estimateSize: () => 37,
    overscan: 12,
  })
  const itemsVirtuales = virtualizador.getVirtualItems()
  const padTop = itemsVirtuales.length > 0 ? (itemsVirtuales[0]?.start ?? 0) : 0
  const padBottom =
    itemsVirtuales.length > 0
      ? virtualizador.getTotalSize() - (itemsVirtuales[itemsVirtuales.length - 1]?.end ?? 0)
      : 0

  // Navegación por teclado (el usuario intensivo viene de Excel): ↑/↓ mueven la fila
  // activa, Inicio/Fin saltan a los extremos, Enter edita, Esc deselecciona.
  const [filaActiva, setFilaActiva] = useState(-1)
  // Solo robamos el foco tras una pulsación de teclado (no al hacer scroll con ratón).
  const enfocarPendiente = useRef(false)

  // Al filtrar/cambiar el número de filas, mantenemos el índice activo en rango.
  useEffect(() => {
    setFilaActiva((prev) => (prev >= filasTabla.length ? filasTabla.length - 1 : prev))
  }, [filasTabla.length])

  useEffect(() => {
    if (!enfocarPendiente.current || filaActiva < 0) return
    const el = contenedorRef.current?.querySelector<HTMLTableRowElement>(
      `tr[data-fila="${filaActiva}"]`,
    )
    if (el) {
      el.focus()
      enfocarPendiente.current = false
    }
  }, [filaActiva, itemsVirtuales])

  const moverActiva = useCallback(
    (delta: number) => {
      setFilaActiva((prev) => {
        const base = prev < 0 ? (delta > 0 ? -1 : filasTabla.length) : prev
        const sig = Math.max(0, Math.min(filasTabla.length - 1, base + delta))
        virtualizador.scrollToIndex(sig, { align: 'auto' })
        enfocarPendiente.current = true
        return sig
      })
    },
    [filasTabla.length, virtualizador],
  )

  const irAExtremo = useCallback(
    (cual: 'inicio' | 'fin') => {
      if (filasTabla.length === 0) return
      const idx = cual === 'inicio' ? 0 : filasTabla.length - 1
      virtualizador.scrollToIndex(idx, { align: 'auto' })
      enfocarPendiente.current = true
      setFilaActiva(idx)
    },
    [filasTabla.length, virtualizador],
  )

  const onTeclaTabla = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const objetivo = e.target as HTMLElement
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moverActiva(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moverActiva(-1)
        break
      case 'Home':
        e.preventDefault()
        irAExtremo('inicio')
        break
      case 'End':
        e.preventDefault()
        irAExtremo('fin')
        break
      case 'Enter':
        // Enter sobre la fila (no sobre un botón de acción) abre la edición.
        if (objetivo.tagName === 'TR' && filaActiva >= 0) {
          e.preventDefault()
          const fila = filasTabla[filaActiva]
          if (fila) abrirEdicion(fila.original.registro)
        }
        break
      case 'Escape':
        if (filaActiva >= 0) {
          setFilaActiva(-1)
          objetivo.blur()
        }
        break
    }
  }

  const abrirNuevo = () => {
    setApertura({
      borrador: { fechaHora: '', tipo: 'COMPRA', ubicacionOrigen: '', ubicacionDestino: '' },
      titulo: 'Nuevo apunte',
    })
    setFormAbierto(true)
  }
  const abrirEdicion = (r: ApunteRegistro) => {
    setApertura({ borrador: registroABorrador(r), uid: r.uid, titulo: `Editar ${r.id}` })
    setFormAbierto(true)
  }
  const abrirDuplicado = (r: ApunteRegistro) => {
    setApertura({ borrador: duplicarComoBorrador(r), titulo: `Duplicar ${r.id}` })
    setFormAbierto(true)
  }
  const abrirPlantilla = (p: PlantillaRapida) => {
    setApertura({ borrador: p.crear(), titulo: `Plantilla · ${p.etiqueta}` })
    setFormAbierto(true)
  }
  const borrar = async (r: ApunteRegistro) => {
    setError(null)
    if (!window.confirm(`¿Borrar el apunte ${r.id} (${ETIQUETA_TIPO[r.tipo]})?`)) return
    try {
      const res = await eliminarApunte(r.uid)
      const n = res.cambios.length
      setAviso(`Apunte ${r.id} borrado.` + (n > 0 ? ` Se renumeraron ${n} apunte(s).` : ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const limpiarFiltros = () => {
    setBusqueda('')
    setFTipo('')
    setFUbic('')
    setFActivo('')
    setFAnio('')
  }
  const hayFiltros = busqueda || fTipo || fUbic || fActivo || fAnio

  return (
    <div className="space-y-4">
      <UnidadManual ruta="diario" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diario</h1>
          <p className="text-sm text-slate-500">
            {registros.length} apunte(s){hayFiltros ? ` · ${filasFiltradas.length} tras filtro` : ''}. Numeración
            AAAA-NNN automática, orden cronológico.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARIO} onClick={abrirNuevo}>
          + Nuevo apunte
        </button>
      </div>

      {error && <Banner tono="error" onCerrar={() => setError(null)}>{error}</Banner>}
      {aviso && <Banner tono="exito" onCerrar={() => setAviso(null)}>{aviso}</Banner>}

      {/* Plantillas rápidas: prerrellenan el formulario para operaciones frecuentes. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Plantillas rápidas:</span>
        {PLANTILLAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            className={BTN_SEC}
            title={p.descripcion}
            onClick={() => abrirPlantilla(p)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* Buscador y filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Buscar</span>
          <input
            className={`${INPUT} w-48`}
            placeholder="Nº, tipo, activo, notas…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en el diario"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Tipo</span>
          <select className={`${INPUT} w-40`} value={fTipo} onChange={(e) => setFTipo(e.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todos</option>
            {TIPOS_OPERACION.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Ubicación</span>
          <select className={`${INPUT} w-40`} value={fUbic} onChange={(e) => setFUbic(e.target.value)} aria-label="Filtrar por ubicación">
            <option value="">Todas</option>
            <option value={UBICACION_EXTERIOR}>EXTERIOR</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Activo</span>
          <select className={`${INPUT} w-32`} value={fActivo} onChange={(e) => setFActivo(e.target.value)} aria-label="Filtrar por activo">
            <option value="">Todos</option>
            {activos.map((a) => (
              <option key={a.simbolo} value={a.simbolo}>
                {a.simbolo}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Año</span>
          <select className={`${INPUT} w-28`} value={fAnio} onChange={(e) => setFAnio(e.target.value)} aria-label="Filtrar por año">
            <option value="">Todos</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {hayFiltros && (
          <button type="button" className={BTN_SEC} onClick={limpiarFiltros}>
            Limpiar
          </button>
        )}
      </div>

      {/* Ayuda de teclado para el usuario intensivo (viene de Excel). */}
      <p className="text-xs text-slate-400">
        En la tabla: <kbd className={KBD}>↑</kbd> <kbd className={KBD}>↓</kbd> mueven la fila,{' '}
        <kbd className={KBD}>Inicio</kbd>/<kbd className={KBD}>Fin</kbd> saltan a los extremos,{' '}
        <kbd className={KBD}>Enter</kbd> edita y <kbd className={KBD}>Esc</kbd> deselecciona.
      </p>

      {/* Tabla virtualizada (solo se pintan las filas visibles) y navegable por teclado. */}
      <div
        ref={contenedorRef}
        onKeyDown={onTeclaTabla}
        className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800"
      >
        <table
          className="w-full border-collapse text-sm"
          aria-label="Diario de apuntes"
          aria-rowcount={filasFiltradas.length}
        >
          <caption className="sr-only">
            Diario de apuntes contables. Usa las flechas para moverte entre filas, Enter para
            editar la fila activa y Escape para deseleccionar.
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-900">
            {tabla.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} scope="col" className="px-3 py-2 font-medium">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {padTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columnas.length} style={{ height: padTop }} />
              </tr>
            )}
            {itemsVirtuales.map((item) => {
              const row = filasTabla[item.index]
              if (!row) return null
              const activa = item.index === filaActiva
              return (
                <tr
                  key={row.id}
                  data-fila={item.index}
                  tabIndex={activa ? 0 : -1}
                  aria-selected={activa}
                  aria-rowindex={item.index + 1}
                  onClick={() => setFilaActiva(item.index)}
                  className={
                    'cursor-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 ' +
                    (activa
                      ? 'bg-amber-50 dark:bg-amber-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/60')
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
            {padBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={columnas.length} style={{ height: padBottom }} />
              </tr>
            )}
            {filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="px-3 py-8 text-center text-slate-400">
                  {registros.length === 0
                    ? 'El diario está vacío. Registra el primer apunte.'
                    : 'Ningún apunte coincide con los filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormularioApunte
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        ubicaciones={ubicaciones}
        activos={activos}
        registros={registros}
        apertura={apertura}
        onGuardado={(m) => setAviso(m)}
      />
    </div>
  )
}
