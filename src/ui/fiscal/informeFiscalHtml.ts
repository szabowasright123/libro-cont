/**
 * informeFiscalHtml.ts — resumen fiscal ORIENTATIVO en HTML autónomo e imprimible.
 *
 * Convierte un `ResumenFiscal` (motor) en un documento sobrio apto para imprimir: los cinco
 * cajones con su desglose y totales, el mapa a casillas, el aviso 721 y el disclaimer
 * permanente. Sin red ni dependencias (local-first, Regla 3). Presentación pura.
 *
 * Regla de oro 5: los textos con calificación fiscal son literales del manual del taller
 * (viven en `engine/fiscal`); aquí solo se muestran. El disclaimer de carácter orientativo sí
 * se redacta (es metodológico, no una calificación).
 */
import type {
  ResumenFiscal,
  BloqueIngresos,
  ConceptoFiscal,
} from '../../engine/fiscal'
import { CONCEPTOS_FISCALES, UMBRAL_721_EUR, AVISO_721, NOTA_172_173, MARCADOR_TEXTO } from '../../engine/fiscal'
import type { MapaCasilla } from '../../data/casillas-2024'
import type { RefUbicacion } from '../../engine/types'
import { AUTORIA, LICENCIA } from '../acerca/datosAcerca'
import { fmtDecimal, fmtEuro, fmtFecha, fmtFechaHora, fmtUbicacion } from '../formato'

/** Escapa texto para insertarlo con seguridad en el HTML. */
function esc(s: string | undefined | null): string {
  if (s === undefined || s === null) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Fecha/hora local del momento de generación. */
function ahoraLegible(): string {
  // `toISOString()` da UTC, y toda la app lee sus ISO como hora LOCAL: sin compensar el
  // desfase, un informe generado a las 00:30 de julio se fechaba el día anterior a las 22:30.
  const ahora = new Date()
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000)
  return fmtFechaHora(local.toISOString().slice(0, 19))
}

/** Marcador de texto manual resaltado (solo para ranuras aún sin literal, p. ej. casillas). */
function marcador(): string {
  return `<span class="marcador">${MARCADOR_TEXTO}</span>`
}

/** Línea de calificación fiscal de un cajón: explicación + fecha de criterio (literales). */
function calificacionHtml(concepto: ConceptoFiscal): string {
  const c = CONCEPTOS_FISCALES[concepto]
  return `<p class="expl"><strong>Calificación fiscal:</strong> ${esc(c.explicacion)} <strong>Fecha de criterio:</strong> ${esc(c.fechaCriterio)}</p>`
}

/** Etiqueta del estado probatorio. */
const ESTADO_PROB: Record<string, string> = {
  completo: 'Completo',
  incompleto: 'Incompleto',
  'sin-justificar': 'Sin justificar',
}

/** Fila de casilla del concepto (mapa orientativo). */
function casillaDe(concepto: ConceptoFiscal, casillas: readonly MapaCasilla[]): string {
  const c = casillas.find((x) => x.concepto === concepto)
  if (!c) return ''
  const casilla = c.casilla.includes('{{') ? marcador() : esc(c.casilla)
  return `<div class="casilla">Casilla orientativa: ${casilla} · ${esc(c.apartado)}</div>`
}

/** Bloque de ingresos (RCM / actividad / base general). */
function bloqueIngresosHtml(
  titulo: string,
  concepto: ConceptoFiscal,
  bloque: BloqueIngresos,
  casillas: readonly MapaCasilla[],
): string {
  const filas =
    bloque.partidas.length > 0
      ? bloque.partidas
          .map(
            (p) => `<tr>
        <td class="mono">${esc(p.apunteId)}</td>
        <td>${esc(fmtFecha(p.fechaHora))}</td>
        <td>${esc(p.activo)}</td>
        <td class="num">${esc(fmtDecimal(p.cantidad))}</td>
        <td class="num">${esc(fmtEuro(p.importeEUR))}${p.sinContravalor ? ' <span class="marcador">sin contravalor</span>' : ''}</td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="5" class="vacio">Sin operaciones en el ejercicio.</td></tr>'
  return `<section class="cajon">
    <h2>${esc(titulo)}</h2>
    ${calificacionHtml(concepto)}
    ${casillaDe(concepto, casillas)}
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Activo</th><th class="num">Cantidad</th><th class="num">Importe</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num">${esc(fmtEuro(bloque.totalEUR))}</td></tr></tfoot>
    </table>
  </section>`
}

/** CSS embebido, sobrio y apto para impresión (sigue el estilo de informeHtml.ts). */
const ESTILO = `
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 0 0 6px; color: #334155; }
  .sub { color: #64748b; font-size: 12px; margin: 0 0 12px; }
  .cajon { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px 12px; margin: 12px 0; page-break-inside: avoid; }
  .expl { color: #64748b; font-size: 12px; margin: 2px 0 6px; }
  .casilla { font-size: 12px; color: #475569; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; border-top: 2px solid #cbd5e1; border-bottom: none; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #64748b; }
  .vacio { color: #94a3b8; font-style: italic; }
  .totales { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0 4px; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; min-width: 150px; }
  .kpi .et { font-size: 11px; color: #64748b; }
  .kpi .v { font-size: 15px; font-weight: 700; }
  .pill { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 0 7px; font-size: 11px; background: #f8fafc; }
  .pill-verde { border-color: #86efac; background: #f0fdf4; color: #166534; }
  .pill-ambar { border-color: #fcd34d; background: #fffbeb; color: #92400e; }
  .pill-rojo { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
  .marcador { font-family: ui-monospace, monospace; background: #fef9c3; border: 1px dashed #eab308; border-radius: 4px; padding: 0 4px; color: #854d0e; font-size: 11px; }
  .aviso { border: 1px solid #fcd34d; background: #fffbeb; border-radius: 8px; padding: 10px 12px; margin: 12px 0; }
  .disclaimer { margin-top: 20px; padding: 10px 12px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; }
  @media print { body { margin: 12mm; } .cajon, .aviso { break-inside: avoid; } }
`

/**
 * Genera el documento HTML autónomo del resumen fiscal orientativo del ejercicio.
 * `nombrePorId` resuelve identificadores de ubicación a nombres legibles.
 */
export function construirInformeFiscalHtml(
  resumen: ResumenFiscal,
  casillas: readonly MapaCasilla[],
  nombrePorId: Map<string, string>,
): string {
  const nombreUbic = (r: RefUbicacion) => fmtUbicacion(r, nombrePorId)
  const { ahorro, rcm, actividadEconomica, baseGeneral, perdidas, avisoExtranjero } = resumen

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
      : '<tr><td colspan="7" class="vacio">Sin transmisiones onerosas en el ejercicio.</td></tr>'

  const ahorroHtml = `<section class="cajon">
    <h2>${esc(CONCEPTOS_FISCALES.ahorro.etiqueta)} · ${esc(CONCEPTOS_FISCALES.ahorro.baseImponible)}</h2>
    ${calificacionHtml('ahorro')}
    ${casillaDe('ahorro', casillas)}
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Tipo</th><th>Activo</th><th class="num">Valor neto</th><th class="num">Coste FIFO</th><th class="num">Resultado</th></tr></thead>
      <tbody>${filasAhorro}</tbody>
      <tfoot>
        <tr><td colspan="6">Ganancias</td><td class="num">${esc(fmtEuro(ahorro.gananciasEUR))}</td></tr>
        <tr><td colspan="6">Pérdidas de transmisión</td><td class="num">${esc(fmtEuro(ahorro.perdidasEUR))}</td></tr>
        <tr><td colspan="6">Neto del ahorro</td><td class="num">${esc(fmtEuro(ahorro.netoEUR))}</td></tr>
      </tfoot>
    </table>
  </section>`

  const filasPerdidas =
    perdidas.items.length > 0
      ? perdidas.items
          .map((p) => {
            const clase =
              p.estadoProbatorio === 'completo'
                ? 'pill-verde'
                : p.estadoProbatorio === 'incompleto'
                  ? 'pill-ambar'
                  : 'pill-rojo'
            const huecos =
              p.faltantes.length > 0
                ? `<div class="expl">Huecos: ${esc(p.faltantes.map((f) => f.documento).join(' · '))}</div>`
                : ''
            return `<tr>
        <td class="mono">${esc(p.apunteId)}</td>
        <td>${esc(fmtFecha(p.fechaHora))}</td>
        <td>${esc(p.activo)}</td>
        <td class="num">${esc(fmtDecimal(p.cantidad))}</td>
        <td class="num">${esc(fmtEuro(p.costeFifoEUR))}</td>
        <td class="num">${esc(fmtEuro(p.resultadoEUR))}</td>
        <td><span class="pill ${clase}">${esc(ESTADO_PROB[p.estadoProbatorio])}</span>${huecos}</td>
      </tr>`
          })
          .join('')
      : '<tr><td colspan="7" class="vacio">Sin pérdidas registradas en el ejercicio.</td></tr>'

  const perdidasHtml = `<section class="cajon">
    <h2>${esc(CONCEPTOS_FISCALES.perdidas.etiqueta)}</h2>
    ${calificacionHtml('perdidas')}
    ${casillaDe('perdidas', casillas)}
    <p class="expl"><strong>Deducibilidad condicionada</strong> a requisitos y prueba (dualidad DGT). Revisa el estado probatorio de cada pérdida en el Archivo.</p>
    <table>
      <thead><tr><th>Apunte</th><th>Fecha</th><th>Activo</th><th class="num">Cantidad</th><th class="num">Coste FIFO</th><th class="num">Resultado</th><th>Prueba</th></tr></thead>
      <tbody>${filasPerdidas}</tbody>
      <tfoot><tr><td colspan="5">Total pérdidas (potencial)</td><td class="num">${esc(fmtEuro(perdidas.totalEUR))}</td><td></td></tr></tfoot>
    </table>
  </section>`

  const celdas721 =
    avisoExtranjero.celdas.length > 0
      ? avisoExtranjero.celdas
          .map(
            (c) => `<tr>
        <td>${esc(nombreUbic(c.ubicacion))}${c.pais ? ` (${esc(c.pais)})` : ''}</td>
        <td>${esc(c.activo)}</td>
        <td class="num">${esc(fmtDecimal(c.saldo))}</td>
        <td class="num">${c.sinValorar ? '<span class="marcador">sin valorar</span>' : esc(fmtEuro(c.valorEUR))}</td>
      </tr>`,
          )
          .join('')
      : ''

  const aviso721Html = avisoExtranjero.aplica
    ? `<div class="aviso">
        <h2>Aviso informativo · Modelo 721 (saldos en el extranjero)</h2>
        <p class="expl">${esc(AVISO_721)}</p>
        <p>Saldos a 31/12/${resumen.ejercicio} en ubicaciones marcadas como extranjeras.
          Umbral informativo: ${fmtEuro(String(avisoExtranjero.umbralEUR ?? UMBRAL_721_EUR))}.
          ${
            avisoExtranjero.supera
              ? '<span class="pill pill-ambar">Supera el umbral — revisa si procede el modelo 721</span>'
              : '<span class="pill">No supera el umbral valorado</span>'
          }
        </p>
        <table>
          <thead><tr><th>Ubicación</th><th>Activo</th><th class="num">Saldo</th><th class="num">Valor EUR</th></tr></thead>
          <tbody>${celdas721}</tbody>
          <tfoot><tr><td colspan="3">Total valorado</td><td class="num">${esc(fmtEuro(avisoExtranjero.totalValoradoEUR))}</td></tr></tfoot>
        </table>
        ${avisoExtranjero.haySinValorar ? '<p class="expl">Hay activos sin precio de cierre: el total valorado es un mínimo.</p>' : ''}
      </div>`
    : ''

  const nota172Html = `<div class="aviso">
    <h2>Nota informativa · Modelos 172 / 173</h2>
    <p class="expl">${esc(NOTA_172_173)}</p>
  </div>`

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resumen fiscal orientativo ${resumen.ejercicio}</title>
  <style>${ESTILO}</style>
</head>
<body>
  <h1>Resumen fiscal orientativo — ejercicio ${resumen.ejercicio}</h1>
  <p class="sub">Libro Hespérides · Bloque 3 · generado el ${esc(ahoraLegible())}</p>

  <div class="totales">
    <div class="kpi"><div class="et">Neto del ahorro (transmisiones)</div><div class="v">${esc(fmtEuro(ahorro.netoEUR))}</div></div>
    <div class="kpi"><div class="et">RCM</div><div class="v">${esc(fmtEuro(rcm.totalEUR))}</div></div>
    <div class="kpi"><div class="et">Actividad económica</div><div class="v">${esc(fmtEuro(actividadEconomica.totalEUR))}</div></div>
    <div class="kpi"><div class="et">Base general (airdrops)</div><div class="v">${esc(fmtEuro(baseGeneral.totalEUR))}</div></div>
    <div class="kpi"><div class="et">Pérdidas (potencial)</div><div class="v">${esc(fmtEuro(perdidas.totalEUR))}</div></div>
  </div>

  ${ahorroHtml}
  ${bloqueIngresosHtml(`${CONCEPTOS_FISCALES.rcm.etiqueta} · ${CONCEPTOS_FISCALES.rcm.baseImponible}`, 'rcm', rcm, casillas)}
  ${bloqueIngresosHtml(`${CONCEPTOS_FISCALES['actividad-economica'].etiqueta} · ${CONCEPTOS_FISCALES['actividad-economica'].baseImponible}`, 'actividad-economica', actividadEconomica, casillas)}
  ${bloqueIngresosHtml(`${CONCEPTOS_FISCALES['base-general'].etiqueta} · ${CONCEPTOS_FISCALES['base-general'].baseImponible}`, 'base-general', baseGeneral, casillas)}
  ${perdidasHtml}

  ${aviso721Html}
  ${nota172Html}

  <div class="disclaimer">
    Resumen ORIENTATIVO de carácter docente generado por el Libro Hespérides a partir de los
    apuntes y justificantes del alumno. NO es asesoramiento fiscal ni una declaración, ni
    sustituye la revisión de un profesional. Las calificaciones y fechas de criterio son literales
    del manual del taller; los números de casilla cambian cada campaña (verifícalos en el Manual
    práctico de Renta del ejercicio). Los avisos 721 y 172/173 son informativos y nunca determinan
    una obligación.
  </div>

  <p class="sub" style="margin-top: 10px">
    Generado con <strong>Libro Hespérides</strong> — © ${esc(AUTORIA ?? '')} · aplicación
    publicada bajo licencia ${esc(LICENCIA ?? '')} · legelbitcoin.com. La licencia cubre el código de la app; los
    datos y este informe pertenecen a su titular.
  </p>
</body>
</html>`
}
