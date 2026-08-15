/**
 * informeHtml.ts — «expediente modelo» imprimible del informe «¿cómo demuestro este saldo?».
 *
 * Convierte una `CadenaProbatoria` (motor) en un documento HTML autónomo, sobrio y apto para
 * imprimir en 1-2 páginas: cabecera del saldo con su reparto KYC/no-KYC, una sección por
 * rama (parcela) con la cadena de eslabones hacia atrás, y en cada eslabón sus justificantes
 * o sus huecos. Sin red ni dependencias (local-first, Regla 3). Presentación pura.
 *
 * Regla de oro 5: todo output con relevancia probatoria/fiscal lleva disclaimer de carácter
 * orientativo y fecha de generación.
 */
import type { CadenaProbatoria, EslabonProbatorio, RamaProbatoria } from '../../engine/trazabilidad'
import type { RefUbicacion } from '../../engine/types'
import { ETIQUETA_TIPO } from '../../engine/types'
import { fmtDecimal, fmtFecha, fmtFechaHora, fmtUbicacion } from '../formato'

/** Escapa texto para insertarlo con seguridad en el HTML. */
function esc(s: string | undefined | null): string {
  if (s === undefined || s === null) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Etiqueta del papel del eslabón en la cadena. */
const PAPEL: Record<EslabonProbatorio['papel'], string> = {
  adquisicion: 'Adquisición',
  transferencia: 'Transferencia',
  otro: 'Movimiento',
}

/** Etiqueta del estado probatorio. */
const ESTADO: Record<EslabonProbatorio['estado'], string> = {
  completo: 'Completo',
  incompleto: 'Incompleto',
  'sin-justificar': 'Sin justificar',
}

/** Fecha ISO local del momento de generación, sin depender de zona. */
function ahoraLegible(): string {
  return fmtFechaHora(new Date().toISOString().slice(0, 19))
}

/** HTML de un justificante (documento, referencia/fichero, hash abreviado). */
function justificanteHtml(j: EslabonProbatorio['justificantes'][number]): string {
  const soporte = j.fichero
    ? 'fichero adjunto'
    : j.referenciaExterna
      ? `ref.: ${esc(j.referenciaExterna)}`
      : 'sin fichero ni referencia'
  const hash = j.hashSHA256 ? ` · SHA-256 ${esc(j.hashSHA256.slice(0, 16))}…` : ''
  return `<li><strong>${esc(j.tipoDocumento)}</strong> — ${soporte}${hash}</li>`
}

/** HTML de un eslabón de la cadena. */
function eslabonHtml(e: EslabonProbatorio, nombreUbic: (r: RefUbicacion) => string): string {
  if (e.huerfano || !e.apunte) {
    return `<div class="eslabon huerfano">
      <div class="eslabon-cab"><span class="pill pill-rojo">Eslabón roto</span>
        <span class="mono">${esc(e.apunteId)}</span> — el apunte ya no existe en el diario.</div>
    </div>`
  }
  const ap = e.apunte
  const estadoClase =
    e.estado === 'completo' ? 'pill-verde' : e.estado === 'incompleto' ? 'pill-ambar' : 'pill-rojo'
  const justis =
    e.justificantes.length > 0
      ? `<ul class="justis">${e.justificantes.map(justificanteHtml).join('')}</ul>`
      : ''
  const huecos =
    e.faltantes.length > 0
      ? `<div class="huecos"><span class="etq">Huecos:</span> ${esc(
          e.faltantes.map((f) => f.documento).join(' · '),
        )}</div>`
      : ''
  return `<div class="eslabon">
    <div class="eslabon-cab">
      <span class="pill">${esc(PAPEL[e.papel])}</span>
      <span class="mono">${esc(ap.id)}</span>
      <span class="tipo">${esc(ETIQUETA_TIPO[ap.tipo])}</span>
      <span class="fecha">${esc(fmtFecha(ap.fechaHora))}</span>
      <span class="ruta">${esc(nombreUbic(ap.ubicacionOrigen))} → ${esc(nombreUbic(ap.ubicacionDestino))}</span>
      <span class="pill ${estadoClase}">${esc(ESTADO[e.estado])}</span>
    </div>
    ${justis}
    ${huecos}
  </div>`
}

/** HTML de una rama (parcela) de la cadena. */
function ramaHtml(
  rama: RamaProbatoria,
  activo: string,
  indice: number,
  nombreUbic: (r: RefUbicacion) => string,
): string {
  const origen = rama.origen === 'KYC' ? 'KYC' : 'no-KYC'
  const origenClase = rama.origen === 'KYC' ? 'pill-verde' : 'pill-ambar'
  return `<section class="rama">
    <h3>Parcela ${indice + 1} · ${esc(fmtDecimal(rama.cantidad))} ${esc(activo)}
      <span class="pill ${origenClase}">${origen}</span>
      ${rama.eslabonesConHueco > 0 ? `<span class="pill pill-rojo">${rama.eslabonesConHueco} hueco(s)</span>` : ''}
    </h3>
    <div class="cadena">${rama.eslabones.map((e) => eslabonHtml(e, nombreUbic)).join('')}</div>
  </section>`
}

/** CSS embebido, sobrio y apto para impresión. */
const ESTILO = `
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 18px 0 6px; color: #334155; }
  h3 { font-size: 13px; margin: 14px 0 6px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .sub { color: #64748b; font-size: 12px; margin: 0 0 12px; }
  .resumen { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin: 10px 0 4px; }
  .resumen .cifra { font-size: 17px; font-weight: 700; }
  .reparto { display: flex; gap: 16px; margin-top: 6px; flex-wrap: wrap; }
  .rama { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px 12px; margin: 10px 0; page-break-inside: avoid; }
  .cadena { display: flex; flex-direction: column; gap: 6px; }
  .eslabon { border-left: 3px solid #cbd5e1; padding: 4px 0 4px 10px; }
  .eslabon.huerfano { border-left-color: #ef4444; }
  .eslabon-cab { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #64748b; }
  .tipo { font-weight: 600; }
  .fecha, .ruta { color: #64748b; font-size: 12px; }
  .justis { margin: 4px 0 0; padding-left: 18px; }
  .justis li { font-size: 12px; }
  .huecos { margin-top: 3px; font-size: 12px; color: #b45309; }
  .huecos .etq { font-weight: 600; }
  .pill { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 0 7px; font-size: 11px; background: #f8fafc; }
  .pill-verde { border-color: #86efac; background: #f0fdf4; color: #166534; }
  .pill-ambar { border-color: #fcd34d; background: #fffbeb; color: #92400e; }
  .pill-rojo { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
  .disclaimer { margin-top: 20px; padding: 10px 12px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; }
  @media print { body { margin: 12mm; } .rama { break-inside: avoid; } }
`

/**
 * Genera el documento HTML autónomo del informe de un saldo. `nombrePorId` resuelve los
 * identificadores de ubicación a nombres legibles.
 */
export function construirInformeHtml(
  cadena: CadenaProbatoria,
  nombrePorId: Map<string, string>,
): string {
  const nombreUbic = (r: RefUbicacion) => fmtUbicacion(r, nombrePorId)
  const titulo = `Expediente del saldo — ${esc(fmtDecimal(cadena.saldo))} ${esc(cadena.activo)} en ${esc(
    nombreUbic(cadena.ubicacion),
  )}`
  const ramas =
    cadena.ramas.length > 0
      ? cadena.ramas.map((r, i) => ramaHtml(r, cadena.activo, i, nombreUbic)).join('')
      : '<p class="sub">Este saldo no tiene parcelas vivas (saldo cero o sin movimientos registrados).</p>'

  const avisoDeficit = cadena.deficit
    ? '<p class="sub" style="color:#991b1b">⚠ Atención: alguna salida de esta ubicación no tuvo origen suficiente registrado (saldo negativo). Revisa el diario.</p>'
    : ''

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
  <style>${ESTILO}</style>
</head>
<body>
  <h1>¿Cómo demuestro este saldo?</h1>
  <p class="sub">Libro Hespérides · Trazabilidad KYC/no-KYC · generado el ${esc(ahoraLegible())}</p>

  <div class="resumen">
    <div class="cifra">${esc(fmtDecimal(cadena.saldo))} ${esc(cadena.activo)}</div>
    <div>en <strong>${esc(nombreUbic(cadena.ubicacion))}</strong></div>
    <div class="reparto">
      <span class="pill pill-verde">KYC: ${esc(fmtDecimal(cadena.kyc))} ${esc(cadena.activo)}</span>
      <span class="pill pill-ambar">no-KYC: ${esc(fmtDecimal(cadena.noKyc))} ${esc(cadena.activo)}</span>
      <span class="pill">${cadena.ramas.length} parcela(s) · ${cadena.huecos} hueco(s) probatorio(s)</span>
    </div>
  </div>
  ${avisoDeficit}

  <h2>Cadena probatoria (de cada parcela hacia atrás)</h2>
  ${ramas}

  <div class="disclaimer">
    Documento orientativo generado por el Libro Hespérides a partir de los apuntes y
    justificantes registrados por el alumno. El reparto KYC/no-KYC sigue la convención de
    propagación del proyecto (D1), validada fiscalmente el 8-8-2026. No
    constituye asesoramiento fiscal ni prueba por sí mismo: es el índice del expediente que
    reúne los justificantes que sostienen el saldo.
  </div>
</body>
</html>`
}
