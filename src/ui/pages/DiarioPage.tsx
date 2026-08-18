/**
 * DiarioPage — el DIARIO: tabla densa de apuntes (TanStack), en orden cronológico,
 * con buscador y filtros por tipo/ubicación/activo/año. Numeración automática
 * AAAA-NNN (la asigna el repositorio).
 *
 * La tabla es SOLO lectura y cabe a lo ancho sin desplazamiento lateral: las notas y
 * los botones de acción no ocupan columna. Pinchar (o pulsar Enter sobre) un apunte abre
 * su ficha, y es ahí donde viven las notas completas y las cuatro acciones: editar,
 * duplicar, rectificar y borrar.
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
import { BTN_PRIMARIO, BTN_SEC, BTN_PELIGRO, INPUT, KBD, Banner, Modal } from '../comp'
import { FormularioApunte, type AperturaFormulario } from '../libro/FormularioApunte'
import { PLANTILLAS, type PlantillaRapida } from '../libro/plantillas'
import { ChipZonaGris } from '../defi/ChipZonaGris'
import { AsistenteEvento } from '../defi/AsistenteEvento'
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
  /** Correlativo del apunte rectificado (solo AJUSTE); `undefined` si no rectifica. */
  rectificaA?: string
}

/** Convierte un registro almacenado en borrador editable del formulario. */
function registroABorrador(r: ApunteRegistro): BorradorApunte {
  const { uid: _uid, id: _id, creadoEn: _creadoEn, ...resto } = r
  return { ...resto }
}

const col = createColumnHelper<FilaDiario>()

/**
 * Reparto del ancho de la tabla, en porcentaje (suma 100). Con `table-fixed` estas
 * anchuras MANDAN sobre el contenido: la tabla cabe siempre en su contenedor y ninguna
 * cabecera larga («Estado probatorio») empuja al resto. Lo que no entra se recorta con
 * puntos suspensivos —el valor completo está en la ficha del apunte, a un clic—, y como
 * ninguna celda parte en dos líneas todas las filas conservan la misma altura, que es de
 * lo que depende el virtualizador.
 */
const ANCHO_COLUMNA: Record<string, string> = {
  id: '6.5%',
  fecha: '13%',
  tipo: '13.5%',
  sello: '3.5%',
  origen: '8%',
  destino: '8%',
  salida: '11%',
  entrada: '11%',
  comision: '8.5%',
  contravalor: '7.5%',
  probatorio: '9.5%',
}

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
  // Ficha del apunte: se abre al pinchar una fila y reúne las notas y las acciones.
  // Guarda la FILA (no el registro) para reutilizar los valores ya presentados.
  const [detalle, setDetalle] = useState<FilaDiario | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Asistente de eventos DeFi (un hecho económico → varias patas).
  const [asistenteDefi, setAsistenteDefi] = useState(false)

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

  // El registro guarda la referencia por `uid` (estable frente a la renumeración); para
  // enseñarla hay que resolverla al correlativo AAAA-NNN de ese momento.
  const idPorUid = useMemo(() => new Map(registros.map((r) => [r.uid, r.id])), [registros])

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
          rectificaA: r.rectificaAUid ? idPorUid.get(r.rectificaAUid) : undefined,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registros, nombrePorId, estadosProbatorios, kyc, idPorUid],
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
        cell: (c) => <span className="tabular-nums">{fmtFechaHora(c.getValue())}</span>,
      }),
      col.accessor((f) => f.registro.tipo, {
        id: 'tipo',
        header: 'Tipo',
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium" title={ETIQUETA_TIPO[c.getValue() as TipoOperacion]}>
              {ETIQUETA_TIPO[c.getValue() as TipoOperacion]}
            </span>
            {/* Distintivo de zona gris (DEFI §9): un apunte apoyado en una tesis fundada
                pero no confirmada no debe verse igual que uno resuelto. */}
            <span className="shrink-0">
              <ChipZonaGris apunte={c.row.original.registro} />
            </span>
          </span>
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
      col.accessor('origen', { header: 'Origen', cell: (c) => <span title={c.getValue()}>{c.getValue()}</span> }),
      col.accessor('destino', { header: 'Destino', cell: (c) => <span title={c.getValue()}>{c.getValue()}</span> }),
      col.accessor('salida', { header: 'Salida', cell: (c) => <span className="tabular-nums" title={c.getValue()}>{c.getValue()}</span> }),
      col.accessor('entrada', { header: 'Entrada', cell: (c) => <span className="tabular-nums" title={c.getValue()}>{c.getValue()}</span> }),
      col.accessor('comision', { header: 'Comisión', cell: (c) => <span className="tabular-nums" title={c.getValue()}>{c.getValue()}</span> }),
      col.accessor((f) => f.registro.contravalorEUR, {
        id: 'contravalor',
        header: 'Contravalor',
        cell: (c) => <span className="tabular-nums">{fmtEuro(c.getValue())}</span>,
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
    // Altura real de la fila con el relleno actual: sin botones dentro, la fila encoge.
    estimateSize: () => 35,
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

  /** Devuelve el foco a una fila concreta (si está pintada). */
  const enfocarFila = useCallback((indice: number) => {
    contenedorRef.current
      ?.querySelector<HTMLTableRowElement>(`tr[data-fila="${indice}"]`)
      ?.focus()
  }, [])

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
    // Con una ventana abierta manda ella: Escape debe cerrarla, no deseleccionar la fila
    // que quedó debajo (y las flechas no deben mover nada mientras tanto).
    if (detalle || formAbierto || asistenteDefi) return
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
        // Enter sobre la fila abre su ficha (mismo gesto que pinchar).
        if (objetivo.tagName === 'TR' && filaActiva >= 0) {
          e.preventDefault()
          const fila = filasTabla[filaActiva]
          if (fila) setDetalle(fila.original)
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
    setDetalle(null)
    setApertura({ borrador: registroABorrador(r), uid: r.uid, titulo: `Editar ${r.id}` })
    setFormAbierto(true)
  }
  const abrirDuplicado = (r: ApunteRegistro) => {
    setDetalle(null)
    setApertura({ borrador: duplicarComoBorrador(r), titulo: `Duplicar ${r.id}` })
    setFormAbierto(true)
  }
  /**
   * Rectificar (principio 7 del método): el error NO se borra ni se reescribe, se corrige
   * con un apunte nuevo de tipo AJUSTE/RECTIFICACIÓN que apunta al rectificado y explica la
   * causa. Aquí solo se prepara el borrador con la referencia ya puesta; el formulario exige
   * el resto (referencia y causa son obligatorias para AJUSTE).
   */
  const abrirRectificacion = (r: ApunteRegistro) => {
    setDetalle(null)
    setApertura({
      borrador: {
        fechaHora: '',
        tipo: 'AJUSTE',
        ubicacionOrigen: r.ubicacionOrigen,
        ubicacionDestino: r.ubicacionDestino,
        rectificaAUid: r.uid,
      },
      titulo: `Rectificar ${r.id}`,
    })
    setFormAbierto(true)
  }
  const abrirPlantilla = (p: PlantillaRapida) => {
    setApertura({ borrador: p.crear(), titulo: `Plantilla · ${p.etiqueta}` })
    setFormAbierto(true)
  }
  const borrar = async (r: ApunteRegistro) => {
    setError(null)
    if (!window.confirm(`¿Borrar el apunte ${r.id} (${ETIQUETA_TIPO[r.tipo]})?`)) return
    setDetalle(null)
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
        {/* Los eventos DeFi no caben en una plantilla de apunte: un solo hecho produce
            varias patas. Por eso van por asistente. */}
        <button type="button" className={BTN_SEC} onClick={() => setAsistenteDefi(true)}>
          Evento DeFi…
        </button>
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
        <kbd className={KBD}>Enter</kbd> abre la ficha del apunte (notas y acciones) y{' '}
        <kbd className={KBD}>Esc</kbd> deselecciona.
      </p>

      {/* Tabla virtualizada (solo se pintan las filas visibles) y navegable por teclado. */}
      <div
        ref={contenedorRef}
        onKeyDown={onTeclaTabla}
        className="max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800"
      >
        <table
          className="w-full table-fixed border-collapse text-sm"
          aria-label="Diario de apuntes"
          aria-rowcount={filasFiltradas.length}
        >
          <colgroup>
            {tabla.getAllLeafColumns().map((c) => (
              <col key={c.id} style={{ width: ANCHO_COLUMNA[c.id] }} />
            ))}
          </colgroup>
          <caption className="sr-only">
            Diario de apuntes contables. Usa las flechas para moverte entre filas, Enter para
            abrir la ficha de la fila activa (notas, editar, duplicar, rectificar y borrar) y
            Escape para deseleccionar.
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-900">
            {tabla.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} scope="col" className="px-2 py-2 font-medium">
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
                  onClick={() => {
                    setFilaActiva(item.index)
                    setDetalle(row.original)
                  }}
                  className={
                    'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ' +
                    (activa
                      ? 'bg-amber-50 dark:bg-amber-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/60')
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="truncate px-2 py-1.5">
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
                <td colSpan={columnas.length} className="px-2 py-8 text-center text-slate-400">
                  {registros.length === 0
                    ? 'El diario está vacío. Registra el primer apunte.'
                    : 'Ningún apunte coincide con los filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FichaApunte
        fila={detalle}
        onCerrar={() => {
          setDetalle(null)
          // Devuelve el foco a la fila: quien navega con el teclado sigue donde estaba.
          if (filaActiva >= 0) enfocarFila(filaActiva)
        }}
        onEditar={abrirEdicion}
        onDuplicar={abrirDuplicado}
        onRectificar={abrirRectificacion}
        onBorrar={(r) => void borrar(r)}
      />

      <FormularioApunte
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        ubicaciones={ubicaciones}
        activos={activos}
        registros={registros}
        apertura={apertura}
        onGuardado={(m) => setAviso(m)}
      />

      <AsistenteEvento
        abierto={asistenteDefi}
        onCerrar={() => setAsistenteDefi(false)}
        ubicaciones={ubicaciones}
        onGuardado={() => setAviso('Evento DeFi registrado: revisa las patas en Posiciones.')}
      />
    </div>
  )
}

/**
 * FichaApunte — ventana del apunte: lo que ya no ocupa columna en la tabla.
 *
 * Reúne el detalle completo (incluidas las NOTAS, que en la tabla se truncaban) y las
 * cuatro acciones sobre el apunte. «Rectificar» es la vía del método cuando el apunte ya
 * está asentado: no reescribe el pasado, abre un AJUSTE/RECTIFICACIÓN que lo referencia.
 */
function FichaApunte({
  fila,
  onCerrar,
  onEditar,
  onDuplicar,
  onRectificar,
  onBorrar,
}: {
  fila: FilaDiario | null
  onCerrar: () => void
  onEditar: (r: ApunteRegistro) => void
  onDuplicar: (r: ApunteRegistro) => void
  onRectificar: (r: ApunteRegistro) => void
  onBorrar: (r: ApunteRegistro) => void
}) {
  if (!fila) return null
  const r = fila.registro

  return (
    <Modal titulo={`Apunte ${r.id}`} abierto onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{ETIQUETA_TIPO[r.tipo]}</span>
          <ChipZonaGris apunte={r} />
          <span className="tabular-nums text-slate-500">{fmtFechaHora(r.fechaHora)}</span>
          {fila.origenKyc !== null && <SelloKyc kyc={fila.origenKyc} />}
          <BadgeEstadoProbatorio
            estado={fila.estadoProbatorio}
            titulo={fila.faltantesProbatorios ? `Falta: ${fila.faltantesProbatorios}` : undefined}
          />
        </div>

        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
          <Dato etiqueta="Origen">{fila.origen}</Dato>
          <Dato etiqueta="Destino">{fila.destino}</Dato>
          <Dato etiqueta="Salida">{fila.salida}</Dato>
          <Dato etiqueta="Entrada">{fila.entrada}</Dato>
          <Dato etiqueta="Comisión">{fila.comision}</Dato>
          <Dato etiqueta="Contravalor">{fmtEuro(r.contravalorEUR)}</Dato>
          {fila.rectificaA && <Dato etiqueta="Rectifica a">{fila.rectificaA}</Dato>}
        </dl>

        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Notas</h3>
          <p className="whitespace-pre-wrap break-words text-sm">
            {r.notas?.trim() ? r.notas : <span className="text-slate-400">Sin notas.</span>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button type="button" className={BTN_SEC} onClick={() => onEditar(r)}>
            Editar
          </button>
          <button type="button" className={BTN_SEC} onClick={() => onDuplicar(r)}>
            Duplicar
          </button>
          <button
            type="button"
            className={BTN_SEC}
            title="Corrige el apunte con un AJUSTE/RECTIFICACIÓN que lo referencia, sin reescribirlo"
            onClick={() => onRectificar(r)}
          >
            Rectificar
          </button>
          <button type="button" className={`${BTN_PELIGRO} ml-auto`} onClick={() => onBorrar(r)}>
            Borrar
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Par etiqueta/valor de la ficha. */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="tabular-nums">{children}</dd>
    </>
  )
}
