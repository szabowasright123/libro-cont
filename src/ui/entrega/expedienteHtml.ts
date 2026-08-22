/**
 * expedienteHtml.ts — el EXPEDIENTE DE ENTREGA escrito: un solo fichero HTML autocontenido.
 *
 * `data/entrega/expediente.ts` calcula el ejercicio entero; esto lo escribe. Es el documento
 * que el alumno entrega y que el profesor abre de un vistazo: portada con la identificación
 * del ejercicio y la fecha de generación, y detrás el Libro, los saldos y la cola FIFO al
 * cierre, el cuadre, la conciliación FIFO↔SALDOS, el resumen fiscal orientativo y el estado
 * probatorio del Archivo con el índice de la carpeta.
 *
 * AUTOCONTENIDO, y no como una virtud sino como requisito (Regla de oro 3, local-first): ni
 * una hoja de estilo remota, ni una fuente de Google, ni una imagen, ni un script. Todo va
 * inline y el documento se abre igual dentro de tres años en un portátil sin conexión, que es
 * exactamente la situación en la que un expediente probatorio tiene que seguir sirviendo.
 * `data/entrega/expediente.test.ts` lo comprueba con una expresión regular sobre la salida.
 *
 * Presentación pura: aquí no se calcula nada (Regla de oro 4). Las cifras vienen ya hechas del
 * motor y los textos con calificación fiscal son literales de `engine/fiscal` — se muestran,
 * no se reescriben (Regla de oro 5). Lo único que se redacta son las notas metodológicas y el
 * aviso de carácter orientativo, que no califican nada.
 */
import type { EstadoSemaforo, RefUbicacion } from '../../engine/types'
import {
  AVISO_721,
  CONCEPTOS_FISCALES,
  NOTA_172_173,
  UMBRAL_721_EUR,
  type BloqueIngresos,
  type ConceptoFiscal,
} from '../../engine/fiscal'
import { TEXTO_MOTIVO } from '../../engine/conciliacion'
import type { ExpedienteCalculado } from '../../data/entrega/expediente'
import type { CarpetaExpediente } from '../../data/entrega/indiceCarpeta'
import { AUTORIA, LICENCIA, MARCO } from '../acerca/datosAcerca'
import { fmtCantidad, fmtDecimal, fmtEuro, fmtFecha, fmtFechaHora, fmtUbicacion } from '../formato'

// ────────────────────────────────────────────────────────────────────────────
// 1. Qué se incluye
// ────────────────────────────────────────────────────────────────────────────

/**
 * Secciones opcionales del expediente. La portada no está aquí porque no es opcional: un
 * documento de entrega sin ejercicio, titular y fecha de generación no identifica nada.
 */
export interface SeccionesExpediente {
  /** El DIARIO del ejercicio, apunte a apunte. */
  libro: boolean
  /** Los SALDOS por ubicación × activo a 31/12. */
  saldos: boolean
  /** La cola FIFO al cierre: lotes vivos y transmisiones del ejercicio con su coste. */
  fifo: boolean
  /** El CUADRE contra los saldos reales declarados (mira hacia fuera). */
  cuadre: boolean
  /** La CONCILIACIÓN FIFO↔SALDOS (mira hacia dentro). */
  conciliacion: boolean
  /** El resumen fiscal ORIENTATIVO del ejercicio y su mapa de casillas. */
  fiscal: boolean
  /** El estado probatorio del Archivo y el índice de la carpeta del ejercicio. */
  archivo: boolean
  /** Los avisos abiertos de las validaciones sobre el Libro completo. */
  avisos: boolean
}

/** Clave de sección, para recorrerlas en orden sin repetir la lista. */
export type ClaveSeccion = keyof SeccionesExpediente

/**
 * Orden en el que aparecen las secciones. Es el orden del método del taller —qué hay, cuánto
 * costó, las dos comprobaciones, qué se declara y con qué se prueba—, no el alfabético.
 */
export const ORDEN_SECCIONES: readonly ClaveSeccion[] = [
  'libro',
  'saldos',
  'fifo',
  'cuadre',
  'conciliacion',
  'fiscal',
  'archivo',
  'avisos',
]

/** Rótulo y explicación de cada sección (también los usa el panel de la interfaz). */
export const ETIQUETA_SECCION: Readonly<
  Record<ClaveSeccion, { titulo: string; descripcion: string }>
> = Object.freeze({
  libro: {
    titulo: 'Libro del ejercicio',
    descripcion: 'El diario completo del año, apunte a apunte, con su justificante de referencia.',
  },
  saldos: {
    titulo: 'Saldos al cierre',
    descripcion: 'Qué hay y dónde a 31 de diciembre, por ubicación y activo.',
  },
  fifo: {
    titulo: 'Cola FIFO al cierre',
    descripcion: 'Lotes vivos por activo y transmisiones del ejercicio con su coste imputado.',
  },
  cuadre: {
    titulo: 'Cuadre',
    descripcion: 'El saldo calculado contra el saldo real declarado, con su semáforo.',
  },
  conciliacion: {
    titulo: 'Conciliación FIFO ↔ saldos',
    descripcion: 'La comprobación que caza los errores de clasificación que el cuadre no ve.',
  },
  fiscal: {
    titulo: 'Resumen fiscal orientativo',
    descripcion: 'Los cajones del ejercicio y su mapa orientativo a casillas de Renta.',
  },
  archivo: {
    titulo: 'Archivo probatorio',
    descripcion: 'Estado probatorio de cada apunte e índice de la carpeta del ejercicio.',
  },
  avisos: {
    titulo: 'Avisos de validación',
    descripcion: 'Lo que el motor tiene que decir sobre el Libro completo, errores primero.',
  },
})

/** Por defecto se entrega todo: quien entrega un ejercicio lo entrega entero. */
export const SECCIONES_POR_DEFECTO: SeccionesExpediente = Object.freeze({
  libro: true,
  saldos: true,
  fifo: true,
  cuadre: true,
  conciliacion: true,
  fiscal: true,
  archivo: true,
  avisos: true,
})

// ────────────────────────────────────────────────────────────────────────────
// 2. Utilidades de escritura
// ────────────────────────────────────────────────────────────────────────────


/** Escapa texto para insertarlo con seguridad en el HTML. */
function esc(s: string | undefined | null): string {
  if (s === undefined || s === null) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ancla estable de una sección (los enlaces del índice son internos, nunca de red). */
function ancla(clave: ClaveSeccion): string {
  return `seccion-${clave}`
}

/** Presentación del semáforo, con las mismas palabras que la pantalla. */
const SEMAFORO: Readonly<Record<EstadoSemaforo, { texto: string; clase: string }>> = Object.freeze({
  OK: { texto: 'OK', clase: 'pill-verde' },
  REVISAR: { texto: 'REVISAR', clase: 'pill-ambar' },
  ERROR: { texto: 'ERROR', clase: 'pill-rojo' },
})

/** Etiqueta del estado probatorio (la misma del informe fiscal). */
const ESTADO_PROB: Readonly<Record<string, { texto: string; clase: string }>> = Object.freeze({
  completo: { texto: 'Completo', clase: 'pill-verde' },
  incompleto: { texto: 'Incompleto', clase: 'pill-ambar' },
  'sin-justificar': { texto: 'Sin justificar', clase: 'pill-rojo' },
})

/** Un semáforo como píldora. */
function semaforo(estado: EstadoSemaforo): string {
  const s = SEMAFORO[estado]
  return `<span class="pill ${s.clase}">${s.texto}</span>`
}

/** Fila «vacía» de una tabla, con el texto que explica por qué está vacía. */
function vacio(columnas: number, texto: string): string {
  return `<tr><td colspan="${columnas}" class="vacio">${esc(texto)}</td></tr>`
}

/** Envuelve una sección con su título, su explicación y su ancla. */
function seccion(clave: ClaveSeccion, cuerpo: string, nota = ''): string {
  const { titulo, descripcion } = ETIQUETA_SECCION[clave]
  return `<section class="bloque" id="${ancla(clave)}">
    <h2>${esc(titulo)}</h2>
    <p class="expl">${esc(descripcion)}</p>
    ${nota}
    ${cuerpo}
  </section>`
}

/** Línea de calificación fiscal de un cajón: explicación + fecha de criterio (literales). */
function calificacion(concepto: ConceptoFiscal): string {
  const c = CONCEPTOS_FISCALES[concepto]
  return `<p class="expl"><strong>Calificación fiscal:</strong> ${esc(c.explicacion)} <strong>Fecha de criterio:</strong> ${esc(c.fechaCriterio)}</p>`
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Estilo (inline; ni una petición de red)
// ────────────────────────────────────────────────────────────────────────────

/**
 * CSS embebido, sobrio y apto para imprimir. Sigue el estilo de `informeFiscalHtml.ts` para
 * que los documentos que salen de la app se parezcan entre sí, y usa solo fuentes del
 * sistema: una fuente descargada sería una llamada de red.
 */
const ESTILO = `
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; margin: 24px; }
  h1 { font-size: 21px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 0 0 4px; color: #334155; }
  h3 { font-size: 13px; margin: 14px 0 4px; color: #475569; }
  .sub { color: #64748b; font-size: 12px; margin: 0 0 12px; }
  .portada { border: 2px solid #cbd5e1; border-radius: 10px; padding: 14px 18px 16px; margin: 0 0 16px; }
  .ident { display: flex; flex-wrap: wrap; gap: 6px 26px; margin: 8px 0 0; font-size: 12px; color: #475569; }
  .ident div span { color: #94a3b8; }
  .bloque { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px 14px; margin: 14px 0; page-break-inside: auto; }
  .expl { color: #64748b; font-size: 12px; margin: 2px 0 8px; }
  .indice { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 8px 14px; margin: 0 0 16px; font-size: 12px; }
  .indice ol { margin: 4px 0 0; padding-left: 20px; }
  .indice a { color: #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; vertical-align: top; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  thead th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; }
  tfoot td { font-weight: 700; border-top: 2px solid #cbd5e1; border-bottom: none; }
  tr.mal td { background: #fef2f2; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #475569; }
  .vacio { color: #94a3b8; font-style: italic; }
  .totales { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0 2px; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; min-width: 150px; }
  .kpi .et { font-size: 11px; color: #64748b; }
  .kpi .v { font-size: 15px; font-weight: 700; }
  .pill { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 0 7px; font-size: 11px; background: #f8fafc; white-space: nowrap; }
  .pill-verde { border-color: #86efac; background: #f0fdf4; color: #166534; }
  .pill-ambar { border-color: #fcd34d; background: #fffbeb; color: #92400e; }
  .pill-rojo { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
  .marcador { font-family: ui-monospace, monospace; background: #fef9c3; border: 1px dashed #eab308; border-radius: 4px; padding: 0 4px; color: #854d0e; font-size: 11px; }
  .aviso { border: 1px solid #fcd34d; background: #fffbeb; border-radius: 8px; padding: 10px 12px; margin: 12px 0; }
  .nota { font-size: 11px; color: #64748b; margin: 0 0 8px; }
  .disclaimer { margin-top: 20px; padding: 10px 12px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; }
  .pie { color: #94a3b8; font-size: 11px; margin-top: 10px; }
  @media print { body { margin: 12mm; } .bloque, .aviso, .kpi { break-inside: avoid; } .indice { display: none; } }
`

// ────────────────────────────────────────────────────────────────────────────
// 4. Las secciones, una a una
// ────────────────────────────────────────────────────────────────────────────

/** El DIARIO del ejercicio, apunte a apunte. */
function libroHtml(exp: ExpedienteCalculado, nombreUbic: (r: RefUbicacion) => string): string {
  const filas =
    exp.apuntesEjercicio.length > 0
      ? exp.apuntesEjercicio
          .map((ap) => {
            const salida =
              ap.cantidadSalida && ap.activoSalida
                ? `${fmtCantidad(ap.cantidadSalida)} ${esc(ap.activoSalida)}`
                : '—'
            const entrada =
              ap.cantidadEntrada && ap.activoEntrada
                ? `${fmtCantidad(ap.cantidadEntrada)} ${esc(ap.activoEntrada)}`
                : '—'
            const comision =
              ap.comisionCantidad && ap.comisionActivo
                ? `${fmtCantidad(ap.comisionCantidad)} ${esc(ap.comisionActivo)}`
                : '—'
            const detalle = [
              ap.sentido ? `sentido: ${ap.sentido}` : '',
              ap.rectificaA ? `rectifica a ${ap.rectificaA}` : '',
              ap.justificante ? `justificante: ${ap.justificante}` : '',
              ap.notas ?? '',
            ]
              .filter((t) => t !== '')
              .join(' · ')
            return `<tr>
        <td class="mono">${esc(ap.id)}</td>
        <td>${esc(fmtFechaHora(ap.fechaHora))}</td>
        <td>${esc(ap.tipo)}</td>
        <td>${esc(nombreUbic(ap.ubicacionOrigen))} → ${esc(nombreUbic(ap.ubicacionDestino))}</td>
        <td class="num">${salida}</td>
        <td class="num">${entrada}</td>
        <td class="num">${comision}</td>
        <td class="num">${esc(fmtEuro(ap.contravalorEUR))}</td>
        <td class="mono">${esc(detalle)}</td>
      </tr>`
          })
          .join('')
      : vacio(9, 'El ejercicio no tiene ningún apunte.')

  return seccion(
    'libro',
    `<table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Tipo</th><th>Origen → destino</th><th class="num">Salida</th><th class="num">Entrada</th><th class="num">Comisión</th><th class="num">Contravalor</th><th>Detalle</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`,
    `<p class="nota">${exp.apuntesEjercicio.length} apunte(s) en ${exp.ejercicio}, de ${exp.apuntesLibro} del Libro completo.</p>`,
  )
}

/** Los SALDOS a 31/12: qué hay y dónde. */
function saldosHtml(exp: ExpedienteCalculado, nombreUbic: (r: RefUbicacion) => string): string {
  const filas =
    exp.saldos.length > 0
      ? exp.saldos
          .map(
            (s) => `<tr${s.negativo ? ' class="mal"' : ''}>
        <td>${esc(nombreUbic(s.ubicacion))}</td>
        <td>${esc(s.activo)}</td>
        <td class="num">${esc(fmtCantidad(s.entradas))}</td>
        <td class="num">${esc(fmtCantidad(s.salidas))}</td>
        <td class="num">${esc(fmtCantidad(s.comisiones))}</td>
        <td class="num">${esc(fmtCantidad(s.saldo))}${s.negativo ? ' <span class="pill pill-rojo">negativo</span>' : ''}</td>
      </tr>`,
          )
          .join('')
      : vacio(6, 'No hay ninguna celda con movimiento a la fecha de cierre.')

  const hayNegativos = exp.saldos.some((s) => s.negativo)
  const nota = hayNegativos
    ? `<div class="aviso">Hay saldos negativos a 31/12. Un saldo negativo es siempre una salida sin su
        origen registrado: falta el apunte que trajo esas unidades ([MT] U7).</div>`
    : ''

  return seccion(
    'saldos',
    `<table>
      <thead><tr><th>Ubicación</th><th>Activo</th><th class="num">Entradas</th><th class="num">Salidas</th><th class="num">Comisiones</th><th class="num">Saldo</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`,
    `<p class="nota">Saldo = entradas − salidas − comisiones, con corte en ${esc(fmtFecha(exp.corte))} inclusive.</p>${nota}`,
  )
}

/** La cola FIFO al cierre: lotes vivos y transmisiones del ejercicio. */
function fifoHtml(exp: ExpedienteCalculado): string {
  const activos = [...exp.fifo.keys()].sort((a, b) => a.localeCompare(b, 'es'))

  const colas =
    activos.length > 0
      ? activos
          .map((activo) => {
            const cola = exp.fifo.get(activo)
            if (!cola) return ''
            const lotes =
              cola.resumen.lotesAbiertos.length > 0
                ? cola.resumen.lotesAbiertos
                    .map(
                      (l) => `<tr>
            <td class="mono">${esc(l.apunteId)}</td>
            <td>${esc(fmtFecha(l.fechaHora))}</td>
            <td class="num">${esc(fmtCantidad(l.cantidadInicial))}</td>
            <td class="num">${esc(fmtCantidad(l.cantidadRestante))}</td>
            <td class="num">${esc(fmtEuro(l.costeUnitarioEUR))}</td>
          </tr>`,
                    )
                    .join('')
                : vacio(5, `No queda ningún lote abierto de ${activo}: la cola está consumida.`)
            return `<h3>${esc(activo)} · adquirido ${esc(fmtCantidad(cola.resumen.adquiridoTotal))} · consumido ${esc(fmtCantidad(cola.resumen.consumidoTotal))} · restante ${esc(fmtCantidad(cola.resumen.restanteTotal))} (coste ${esc(fmtEuro(cola.resumen.costeRestanteEUR))})</h3>
        <table>
          <thead><tr><th>Lote (apunte)</th><th>Fecha</th><th class="num">Cantidad inicial</th><th class="num">Cantidad restante</th><th class="num">Coste unitario</th></tr></thead>
          <tbody>${lotes}</tbody>
        </table>`
          })
          .join('')
      : '<p class="vacio">Ningún activo tiene cola FIFO a la fecha de cierre.</p>'

  const transmisiones =
    exp.transmisiones.length > 0
      ? exp.transmisiones
          .map((t) => {
            const marcas =
              (t.saldoFifoInsuficiente
                ? ` <span class="pill pill-rojo">sin coste ${fmtCantidad(t.cantidadSinCoste)}</span>`
                : '') + (t.lucrativa ? ' <span class="pill">lucrativa</span>' : '')
            const lotes = t.consumos
              .map((c) => `${esc(c.loteApunteId)} (${fmtCantidad(c.cantidadConsumida)})`)
              .join(' · ')
            return `<tr${t.saldoFifoInsuficiente ? ' class="mal"' : ''}>
        <td class="mono">${esc(t.apunteId)}${marcas}</td>
        <td>${esc(fmtFecha(t.fechaHora))}</td>
        <td>${esc(t.activo)}</td>
        <td class="num">${esc(fmtCantidad(t.cantidad))}</td>
        <td class="num">${esc(fmtEuro(t.valorTransmisionNetoEUR))}</td>
        <td class="num">${esc(fmtEuro(t.costeFifoEUR))}</td>
        <td class="num">${esc(fmtEuro(t.resultadoEUR))}</td>
        <td class="mono">${lotes || '—'}</td>
      </tr>`
          })
          .join('')
      : vacio(8, 'No hay transmisiones en el ejercicio.')

  return seccion(
    'fifo',
    `${colas}
    <h3>Transmisiones del ejercicio (${exp.transmisiones.length})</h3>
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Activo</th><th class="num">Cantidad</th><th class="num">Valor neto</th><th class="num">Coste FIFO</th><th class="num">Resultado</th><th>Lotes consumidos</th></tr></thead>
      <tbody>${transmisiones}</tbody>
    </table>`,
    `<p class="nota">Cola ÚNICA global por activo, sin distinguir ubicación. La comisión de adquisición
      en euros suma al coste del lote; la de transmisión minora el valor de transmisión.
      Las cantidades se imprimen con 8 decimales (la precisión del satoshi); el Libro conserva la
      precisión completa.</p>`,
  )
}

/** El CUADRE: saldo calculado contra saldo real declarado. */
function cuadreHtml(exp: ExpedienteCalculado, nombreUbic: (r: RefUbicacion) => string): string {
  const filas =
    exp.cuadre.length > 0
      ? exp.cuadre
          .map(
            (f) => `<tr${f.estado !== 'OK' ? ' class="mal"' : ''}>
        <td>${esc(nombreUbic(f.ubicacion))}</td>
        <td>${esc(f.activo)}</td>
        <td class="num">${esc(fmtCantidad(f.saldoCalculado))}</td>
        <td class="num">${esc(fmtCantidad(f.saldoReal))}</td>
        <td class="num">${esc(fmtCantidad(f.diferencia))}</td>
        <td>${semaforo(f.estado)}</td>
      </tr>`,
          )
          .join('')
      : vacio(6, 'No hay ningún saldo real declarado: el cuadre está sin hacer.')

  return seccion(
    'cuadre',
    `<table>
      <thead><tr><th>Ubicación</th><th>Activo</th><th class="num">Saldo calculado</th><th class="num">Saldo real</th><th class="num">Diferencia</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`,
    `<p class="nota">El cuadre va sobre el Libro <strong>completo</strong>, no sobre el recorte a 31/12: el
      saldo real se lee hoy en el exchange o en la wallet, y compararlo con una foto antigua fabricaría
      descuadres inexistentes.${exp.apuntesPosteriores > 0 ? ` Hay ${exp.apuntesPosteriores} apunte(s) posteriores al cierre del ejercicio.` : ''}</p>`,
  )
}

/** La CONCILIACIÓN FIFO ↔ SALDOS: la comprobación que mira hacia dentro. */
function conciliacionHtml(exp: ExpedienteCalculado): string {
  const filas =
    exp.conciliacion.filas.length > 0
      ? exp.conciliacion.filas
          .map((f) => {
            const motivos =
              f.motivos.length > 0
                ? `<div class="expl">${esc(f.motivos.map((m) => TEXTO_MOTIVO[m]).join(' '))}</div>`
                : ''
            const implicados =
              f.apuntesImplicados.length > 0
                ? `<div class="mono">Apuntes implicados: ${esc(f.apuntesImplicados.join(', '))}</div>`
                : ''
            return `<tr${f.estado !== 'OK' ? ' class="mal"' : ''}>
        <td>${esc(f.activo)}</td>
        <td class="num">${esc(fmtCantidad(f.existenciasFifo))}</td>
        <td class="num">${esc(fmtCantidad(f.saldoTotal))}</td>
        <td class="num">${esc(fmtCantidad(f.diferencia))}</td>
        <td>${semaforo(f.estado)}${motivos}${implicados}</td>
      </tr>`
          })
          .join('')
      : vacio(5, 'No hay ningún activo con cola FIFO ni saldo que conciliar.')

  return seccion(
    'conciliacion',
    `<table>
      <thead><tr><th>Activo</th><th class="num">Existencias FIFO</th><th class="num">Suma de saldos</th><th class="num">Diferencia</th><th>Estado y motivo</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`,
    `<p class="nota">El cuadre mira hacia fuera («¿me falta un apunte?»); la conciliación mira hacia
      dentro y compara ese mismo saldo con la cola FIFO («¿está bien clasificado?»). El euro y las demás
      monedas de cuenta quedan fuera: no abren cola.</p>`,
  )
}

/** Un cajón de ingresos del resumen fiscal (RCM, actividad, base general, derivados). */
function cajonIngresos(titulo: string, concepto: ConceptoFiscal, bloque: BloqueIngresos): string {
  const filas =
    bloque.partidas.length > 0
      ? bloque.partidas
          .map(
            (p) => `<tr>
        <td class="mono">${esc(p.apunteId)}</td>
        <td>${esc(fmtFecha(p.fechaHora))}</td>
        <td>${esc(p.activo)}</td>
        <td class="num">${esc(fmtCantidad(p.cantidad))}</td>
        <td class="num">${esc(fmtEuro(p.importeEUR))}${p.sinContravalor ? ' <span class="marcador">sin contravalor</span>' : ''}</td>
      </tr>`,
          )
          .join('')
      : vacio(5, 'Sin operaciones en el ejercicio.')
  return `<h3>${esc(titulo)}</h3>
    ${calificacion(concepto)}
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Activo</th><th class="num">Cantidad</th><th class="num">Importe</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num">${esc(fmtEuro(bloque.totalEUR))}</td></tr></tfoot>
    </table>`
}

/** El resumen fiscal orientativo del ejercicio. */
function fiscalHtml(exp: ExpedienteCalculado, nombreUbic: (r: RefUbicacion) => string): string {
  const { ahorro, derivados, rcm, actividadEconomica, baseGeneral, perdidas, avisoExtranjero } =
    exp.resumen

  const filasAhorro =
    ahorro.operaciones.length > 0
      ? ahorro.operaciones
          .map(
            (o) => `<tr>
        <td class="mono">${esc(o.apunteId)}</td>
        <td>${esc(fmtFecha(o.fechaHora))}</td>
        <td>${esc(o.tipo)}</td>
        <td>${esc(o.activo)}</td>
        <td class="num">${esc(fmtEuro(o.valorTransmisionNetoEUR))}</td>
        <td class="num">${esc(fmtEuro(o.costeFifoEUR))}</td>
        <td class="num">${esc(fmtEuro(o.resultadoEUR))}${o.saldoFifoInsuficiente ? ' <span class="pill pill-rojo">FIFO insuficiente</span>' : ''}</td>
      </tr>`,
          )
          .join('')
      : vacio(7, 'Sin transmisiones con relevancia fiscal en el ejercicio.')

  const filasPerdidas =
    perdidas.items.length > 0
      ? perdidas.items
          .map((p) => {
            const est = ESTADO_PROB[p.estadoProbatorio] ?? { texto: p.estadoProbatorio, clase: '' }
            return `<tr>
        <td class="mono">${esc(p.apunteId)}</td>
        <td>${esc(fmtFecha(p.fechaHora))}</td>
        <td>${esc(p.activo)}</td>
        <td class="num">${esc(fmtCantidad(p.cantidad))}</td>
        <td class="num">${esc(fmtEuro(p.costeFifoEUR))}</td>
        <td class="num">${esc(fmtEuro(p.resultadoEUR))}</td>
        <td><span class="pill ${est.clase}">${esc(est.texto)}</span></td>
      </tr>`
          })
          .join('')
      : vacio(7, 'Sin pérdidas registradas en el ejercicio.')

  const casillas =
    exp.casillas.length > 0
      ? exp.casillas
          .map(
            (c) => `<tr>
        <td>${esc(CONCEPTOS_FISCALES[c.concepto]?.etiqueta ?? c.concepto)}</td>
        <td>${c.casilla.includes('{{') ? '<span class="marcador">pendiente del manual</span>' : esc(c.casilla)}</td>
        <td>${esc(c.apartado)}</td>
      </tr>`,
          )
          .join('')
      : vacio(3, 'Sin mapa de casillas para este ejercicio.')

  const avisoMapa = exp.casillasDelEjercicio
    ? ''
    : `<p class="nota"><span class="marcador">Atención</span> el mapa de casillas mostrado es el de
       ${exp.ejercicioMapa ?? '—'}, no el de ${exp.ejercicio}: verifica los números en el Manual práctico
       de Renta del ejercicio que entregas.</p>`

  const celdas721 = avisoExtranjero.celdas
    .map(
      (c) => `<tr>
      <td>${esc(nombreUbic(c.ubicacion))}${c.pais ? ` (${esc(c.pais)})` : ''}</td>
      <td>${esc(c.activo)}</td>
      <td class="num">${esc(fmtCantidad(c.saldo))}</td>
      <td class="num">${c.sinValorar ? '<span class="marcador">sin valorar</span>' : esc(fmtEuro(c.valorEUR))}</td>
    </tr>`,
    )
    .join('')

  const aviso721 = avisoExtranjero.aplica
    ? `<div class="aviso">
        <h3>Aviso informativo · Modelo 721 (saldos en el extranjero)</h3>
        <p class="expl">${esc(AVISO_721)}</p>
        <p class="nota">Umbral informativo: ${esc(fmtEuro(String(avisoExtranjero.umbralEUR ?? UMBRAL_721_EUR)))}.
          ${
            avisoExtranjero.supera
              ? '<span class="pill pill-ambar">Supera el umbral — revisa si procede el modelo 721</span>'
              : '<span class="pill">No supera el umbral valorado</span>'
          }</p>
        <table>
          <thead><tr><th>Ubicación</th><th>Activo</th><th class="num">Saldo</th><th class="num">Valor EUR</th></tr></thead>
          <tbody>${celdas721 || vacio(4, 'Sin saldos en ubicaciones marcadas como extranjeras.')}</tbody>
          <tfoot><tr><td colspan="3">Total valorado</td><td class="num">${esc(fmtEuro(avisoExtranjero.totalValoradoEUR))}</td></tr></tfoot>
        </table>
        ${avisoExtranjero.haySinValorar ? '<p class="nota">Hay activos sin precio de cierre: el total valorado es un mínimo.</p>' : ''}
      </div>`
    : ''

  return seccion(
    'fiscal',
    `<div class="totales">
      <div class="kpi"><div class="et">Neto del ahorro</div><div class="v">${esc(fmtEuro(ahorro.netoEUR))}</div></div>
      <div class="kpi"><div class="et">Derivados</div><div class="v">${esc(fmtEuro(derivados.totalEUR))}</div></div>
      <div class="kpi"><div class="et">RCM</div><div class="v">${esc(fmtEuro(rcm.totalEUR))}</div></div>
      <div class="kpi"><div class="et">Actividad económica</div><div class="v">${esc(fmtEuro(actividadEconomica.totalEUR))}</div></div>
      <div class="kpi"><div class="et">Base general</div><div class="v">${esc(fmtEuro(baseGeneral.totalEUR))}</div></div>
      <div class="kpi"><div class="et">Pérdidas (potencial)</div><div class="v">${esc(fmtEuro(perdidas.totalEUR))}</div></div>
    </div>

    <h3>${esc(CONCEPTOS_FISCALES.ahorro.etiqueta)} · ${esc(CONCEPTOS_FISCALES.ahorro.baseImponible)}</h3>
    ${calificacion('ahorro')}
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Tipo</th><th>Activo</th><th class="num">Valor neto</th><th class="num">Coste FIFO</th><th class="num">Resultado</th></tr></thead>
      <tbody>${filasAhorro}</tbody>
      <tfoot>
        <tr><td colspan="6">Ganancias</td><td class="num">${esc(fmtEuro(ahorro.gananciasEUR))}</td></tr>
        <tr><td colspan="6">Pérdidas de transmisión</td><td class="num">${esc(fmtEuro(ahorro.perdidasEUR))}</td></tr>
        <tr><td colspan="6">Neto del ahorro</td><td class="num">${esc(fmtEuro(ahorro.netoEUR))}</td></tr>
      </tfoot>
    </table>
    ${
      ahorro.perdidasNoComputablesEUR && ahorro.perdidasNoComputablesEUR !== '0'
        ? `<p class="nota">Pérdidas NO computables por transmisión lucrativa ínter vivos (art. 33.5.c LIRPF):
           ${esc(fmtEuro(ahorro.perdidasNoComputablesEUR))}. No entran en el neto.</p>`
        : ''
    }

    ${cajonIngresos(`${CONCEPTOS_FISCALES.derivados.etiqueta} · ${CONCEPTOS_FISCALES.derivados.baseImponible}`, 'derivados', derivados)}
    ${cajonIngresos(`${CONCEPTOS_FISCALES.rcm.etiqueta} · ${CONCEPTOS_FISCALES.rcm.baseImponible}`, 'rcm', rcm)}
    ${cajonIngresos(`${CONCEPTOS_FISCALES['actividad-economica'].etiqueta} · ${CONCEPTOS_FISCALES['actividad-economica'].baseImponible}`, 'actividad-economica', actividadEconomica)}
    ${cajonIngresos(`${CONCEPTOS_FISCALES['base-general'].etiqueta} · ${CONCEPTOS_FISCALES['base-general'].baseImponible}`, 'base-general', baseGeneral)}

    <h3>${esc(CONCEPTOS_FISCALES.perdidas.etiqueta)}</h3>
    ${calificacion('perdidas')}
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Activo</th><th class="num">Cantidad</th><th class="num">Coste FIFO</th><th class="num">Resultado</th><th>Prueba</th></tr></thead>
      <tbody>${filasPerdidas}</tbody>
      <tfoot><tr><td colspan="5">Total pérdidas (potencial)</td><td class="num">${esc(fmtEuro(perdidas.totalEUR))}</td><td></td></tr></tfoot>
    </table>

    <h3>Mapa orientativo a casillas de Renta</h3>
    ${avisoMapa}
    <table>
      <thead><tr><th>Concepto</th><th>Casilla</th><th>Apartado</th></tr></thead>
      <tbody>${casillas}</tbody>
    </table>

    ${aviso721}
    <div class="aviso">
      <h3>Nota informativa · Modelos 172 / 173</h3>
      <p class="expl">${esc(NOTA_172_173)}</p>
    </div>`,
  )
}

/** Una carpeta del índice del Archivo. */
function carpetaHtml(c: CarpetaExpediente): string {
  const esperados = c.esperados
    .map(
      (e) => `<tr${e.consta ? '' : ' class="mal"'}>
      <td class="mono">${esc(e.apunteId)}</td>
      <td>${esc(fmtFecha(e.fechaHora))}</td>
      <td>${esc(e.documento)}</td>
      <td>${e.consta ? '<span class="pill pill-verde">consta</span>' : '<span class="pill pill-rojo">falta</span>'}${
        e.archivadoEn ? ` <span class="pill">archivado en ${esc(e.archivadoEn)}</span>` : ''
      }</td>
      <td class="mono">${esc(e.referencia ?? '')}${e.hash ? ` · SHA-256 ${esc(e.hash.slice(0, 12))}…` : ''}</td>
    </tr>`,
    )
    .join('')

  const otros = c.otros
    .map(
      (o) => `<tr>
      <td class="mono">${esc(o.apunteId || '—')}</td>
      <td>—</td>
      <td>${esc(o.tipoDocumento)}${o.sinApunte ? ' <span class="pill">documento de ejercicio o de ubicación</span>' : ''}</td>
      <td><span class="pill">no exigido</span></td>
      <td class="mono">${esc(o.referencia ?? '')}</td>
    </tr>`,
    )
    .join('')

  const cuerpo =
    esperados + otros ||
    vacio(5, 'Esta carpeta no espera ningún documento en el ejercicio y no tiene ninguno.')

  return `<h3>${esc(c.rutaCompleta)} — ${esc(c.etiqueta)} <span class="pill${c.faltan > 0 ? ' pill-ambar' : ' pill-verde'}">${c.constan}/${c.esperados.length}</span></h3>
    <p class="nota">${esc(c.contenido)}</p>
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Documento</th><th>Estado</th><th>Referencia</th></tr></thead>
      <tbody>${cuerpo}</tbody>
    </table>`
}

/** El estado probatorio del Archivo y el índice de la carpeta del ejercicio. */
function archivoHtml(exp: ExpedienteCalculado): string {
  const { completitud, indice } = exp

  const filas =
    exp.probatorio.length > 0
      ? exp.probatorio
          .map((p) => {
            const est = ESTADO_PROB[p.estado] ?? { texto: p.estado, clase: '' }
            const faltan =
              p.faltantes.length > 0
                ? `<div class="expl">Faltan: ${esc(p.faltantes.map((f) => f.documento).join(' · '))}</div>`
                : ''
            return `<tr${p.estado === 'completo' ? '' : ' class="mal"'}>
        <td class="mono">${esc(p.apunteId)}</td>
        <td>${esc(p.tipo)}</td>
        <td>${p.conKyc ? 'KYC' : 'no-KYC'}</td>
        <td class="num">${p.cubiertos.length}/${p.requisitos.length}</td>
        <td><span class="pill ${est.clase}">${esc(est.texto)}</span>${faltan}</td>
      </tr>`
          })
          .join('')
      : vacio(5, 'El ejercicio no tiene apuntes cuyo expediente probatorio revisar.')

  return seccion(
    'archivo',
    `<div class="totales">
      <div class="kpi"><div class="et">Expedientes completos</div><div class="v">${completitud.completos}/${completitud.total}</div></div>
      <div class="kpi"><div class="et">Completitud</div><div class="v">${esc(fmtDecimal(String(completitud.porcentajeCompleto)))} %</div></div>
      <div class="kpi"><div class="et">Documentos esperados</div><div class="v">${indice.totalConstan}/${indice.totalEsperados}</div></div>
      <div class="kpi"><div class="et">Documentos que faltan</div><div class="v">${indice.totalFaltan}</div></div>
    </div>

    <h3>Estado probatorio, apunte a apunte</h3>
    <table>
      <thead><tr><th>Apunte</th><th>Tipo</th><th>Origen</th><th class="num">Cubiertos</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>

    <h3>Índice de la carpeta ${indice.ejercicio}</h3>
    ${indice.carpetas.map(carpetaHtml).join('')}`,
    `<p class="nota">El expediente se lee; la carpeta se coteja. Abre tu carpeta real al lado de este
      índice y ve tachando: cada línea dice qué documento espera el Libro y si consta registrado.</p>`,
  )
}

/** Los avisos abiertos de las validaciones sobre el Libro completo. */
function avisosHtml(exp: ExpedienteCalculado): string {
  // Errores primero: son los que impiden dar el ejercicio por cerrado.
  const ordenados = [...exp.avisos].sort((a, b) => {
    if (a.nivel !== b.nivel) return a.nivel === 'error' ? -1 : 1
    return (a.apunteId ?? '').localeCompare(b.apunteId ?? '')
  })
  const errores = ordenados.filter((a) => a.nivel === 'error').length

  const filas =
    ordenados.length > 0
      ? ordenados
          .map(
            (a) => `<tr${a.nivel === 'error' ? ' class="mal"' : ''}>
        <td class="mono">${esc(a.apunteId ?? '—')}</td>
        <td><span class="pill ${a.nivel === 'error' ? 'pill-rojo' : 'pill-ambar'}">${a.nivel === 'error' ? 'Error' : 'Aviso'}</span></td>
        <td class="mono">${esc(a.codigo)}</td>
        <td>${esc(a.mensaje)}</td>
      </tr>`,
          )
          .join('')
      : vacio(4, 'El motor no tiene nada que objetar al Libro.')

  return seccion(
    'avisos',
    `<table>
      <thead><tr><th>Apunte</th><th>Nivel</th><th>Código</th><th>Mensaje</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`,
    `<p class="nota">${ordenados.length} aviso(s), de los que ${errores} son errores. Un error abierto
      significa que el ejercicio todavía no se puede dar por cerrado.</p>`,
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 5. El documento
// ────────────────────────────────────────────────────────────────────────────

/** Constructor de cada sección, en el mismo orden que `ORDEN_SECCIONES`. */
const CONSTRUCTOR: Readonly<
  Record<ClaveSeccion, (exp: ExpedienteCalculado, n: (r: RefUbicacion) => string) => string>
> = Object.freeze({
  libro: libroHtml,
  saldos: saldosHtml,
  fifo: (exp) => fifoHtml(exp),
  cuadre: cuadreHtml,
  conciliacion: (exp) => conciliacionHtml(exp),
  fiscal: fiscalHtml,
  archivo: (exp) => archivoHtml(exp),
  avisos: (exp) => avisosHtml(exp),
})

/**
 * Escribe el expediente de entrega como un único documento HTML autocontenido.
 *
 * @param exp        expediente ya calculado (`calcularExpediente`)
 * @param secciones  qué se incluye; por defecto, todo
 */
export function construirExpedienteHtml(
  exp: ExpedienteCalculado,
  secciones: SeccionesExpediente = SECCIONES_POR_DEFECTO,
): string {
  const nombreUbic = (r: RefUbicacion) => fmtUbicacion(String(r), exp.nombrePorId)
  const incluidas = ORDEN_SECCIONES.filter((c) => secciones[c])

  const indice =
    incluidas.length > 0
      ? `<nav class="indice" aria-label="Índice del expediente">
        <strong>Contenido</strong>
        <ol>${incluidas
          .map((c) => `<li><a href="#${ancla(c)}">${esc(ETIQUETA_SECCION[c].titulo)}</a></li>`)
          .join('')}</ol>
      </nav>`
      : ''

  const cuerpo = incluidas.map((c) => CONSTRUCTOR[c](exp, nombreUbic)).join('\n')

  const erroresAbiertos = exp.avisos.filter((a) => a.nivel === 'error').length

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Expediente de entrega ${exp.ejercicio}</title>
  <style>${ESTILO}</style>
</head>
<body>
  <header class="portada">
    <h1>Expediente de entrega — ejercicio ${exp.ejercicio}</h1>
    <p class="sub">Libro Hespérides · ${esc(MARCO)}</p>
    <div class="ident">
      <div><span>Titular:</span> <strong>${esc(exp.titular ?? 'sin indicar')}</strong></div>
      <div><span>Ejercicio:</span> <strong>${exp.ejercicio}</strong></div>
      <div><span>Corte del cierre:</span> <strong>${esc(fmtFechaHora(exp.corte))}</strong></div>
      <div><span>Generado el:</span> <strong>${esc(fmtFechaHora(exp.generadoEn))}</strong></div>
      <div><span>Versión de la app:</span> <strong>${esc(exp.version)}</strong></div>
    </div>
    <div class="totales">
      <div class="kpi"><div class="et">Apuntes del ejercicio</div><div class="v">${exp.apuntesEjercicio.length}</div></div>
      <div class="kpi"><div class="et">Apuntes del Libro</div><div class="v">${exp.apuntesLibro}</div></div>
      <div class="kpi"><div class="et">Conciliación FIFO ↔ saldos</div><div class="v">${semaforo(exp.conciliacion.estadoGlobal)}</div></div>
      <div class="kpi"><div class="et">Archivo completo</div><div class="v">${esc(fmtDecimal(String(exp.completitud.porcentajeCompleto)))} %</div></div>
      <div class="kpi"><div class="et">Errores de validación</div><div class="v">${erroresAbiertos}</div></div>
    </div>
  </header>

  ${indice}
  ${cuerpo}

  <div class="disclaimer">
    Expediente de entrega generado por el Libro Hespérides a partir de los apuntes y
    justificantes del titular. El resumen fiscal que contiene es ORIENTATIVO y de carácter
    docente: no es asesoramiento fiscal ni una declaración, ni sustituye la revisión de un
    profesional. Las calificaciones fiscales y sus fechas de criterio son literales del manual
    del taller; los números de casilla cambian cada campaña y hay que verificarlos en el Manual
    práctico de Renta del ejercicio. Los avisos 721 y 172/173 son informativos y nunca
    determinan una obligación.
  </div>

  <p class="pie">
    Documento autocontenido: no carga ni un solo recurso externo y se abre sin conexión.
    Generado con Libro Hespérides ${esc(exp.version)} — © ${esc(AUTORIA ?? '')} · aplicación
    publicada bajo licencia ${esc(LICENCIA ?? '')}. La licencia cubre el código de la app; los
    datos y este expediente pertenecen a su titular.
  </p>
</body>
</html>`
}
