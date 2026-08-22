/**
 * informeCierreHtml.ts — el informe de CIERRE del ejercicio en HTML autónomo e imprimible.
 *
 * Convierte el `EstadoCierre` del motor en un documento sobrio: el checklist del Anexo D con
 * el estado de cada casilla y su razón, la foto de saldos a 31-12 con las cotizaciones y sus
 * fuentes, la conciliación cola FIFO ↔ saldos, la conciliación a tres columnas y la memoria
 * del ejercicio.
 *
 * Es el documento que se archiva en la carpeta del ejercicio, y ahora mismo es también la
 * única copia de seguridad de la memoria (ver el TODO de `persistencia.ts`): por eso el pie lo
 * dice en lugar de dar por supuesto que el alumno lo sabe.
 *
 * Autónomo y sin red (Regla 3): CSS embebido, ni una petición externa. Estilo calcado del de
 * `ui/fiscal/informeFiscalHtml.ts` para que los dos informes del ejercicio parezcan del mismo
 * expediente, porque lo son. Presentación pura: aquí no se calcula nada.
 */
import type { EstadoCierre, CasillaEvaluada, CifraCasilla } from '../../engine/cierre'
import {
  AVISO_CIERRE_ORIENTATIVO,
  ENCABEZADO_ANEXO_D,
  NOTA_MEMORIA_ANEXO_D,
  APARTADOS_MEMORIA,
  ETIQUETA_MOMENTO,
} from '../../engine/cierre'
import { TEXTO_MOTIVO } from '../../engine/conciliacion'
import { AUTORIA, LICENCIA } from '../acerca/datosAcerca'
import { fmtDecimal, fmtEuro, fmtFechaHora } from '../formato'

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
  return fmtFechaHora(new Date().toISOString().slice(0, 19))
}

/** Texto de la cifra que respalda una casilla, con su unidad. */
function textoCifra(cifra: CifraCasilla): string {
  if (cifra.unidad === 'EUR') return fmtEuro(cifra.valor)
  if (cifra.unidad === 'porcentaje') return `${fmtDecimal(cifra.valor)} %`
  return fmtDecimal(cifra.valor)
}

/** Pastilla de estado de una casilla. */
function pastilla(c: CasillaEvaluada): string {
  const clase =
    c.estado === 'cumplida' ? 'pill-verde' : c.estado === 'no-aplica' ? 'pill-ambar' : 'pill-rojo'
  const texto =
    c.estado === 'cumplida' ? 'Hecha' : c.estado === 'no-aplica' ? 'No aplica' : 'Pendiente'
  return `<span class="pill ${clase}">${texto}</span>`
}

/** Una casilla del checklist. */
function casillaHtml(c: CasillaEvaluada): string {
  const razon = c.razon
    ? `<p class="razon"><strong>Razón y cálculo:</strong> ${esc(c.razon)}</p>`
    : ''
  const nota = c.nota ? `<p class="expl"><strong>Nota:</strong> ${esc(c.nota)}</p>` : ''
  const cifra = c.cifra ? ` <strong>${esc(textoCifra(c.cifra))}</strong>` : ''
  const quien =
    c.resueltaPor === 'motor'
      ? 'resuelta por la app'
      : c.resueltaPor === 'alumno'
        ? 'marcada por el titular'
        : 'sin responder'
  return `<li class="casilla">
    <div class="cab">${pastilla(c)} <span class="unidad">${esc(c.dondeSeExplica)}</span> <span class="quien">${esc(quien)}</span></div>
    <p class="que">${esc(c.queSeComprueba)}</p>
    <p class="expl">${esc(c.detalle)}${cifra}</p>
    ${razon}
    ${nota}
  </li>`
}

/** Un grupo de casillas bajo su momento del calendario. */
function grupoHtml(momento: string, casillas: readonly CasillaEvaluada[]): string {
  return `<section class="grupo">
    <h3>${esc(momento)}</h3>
    <ul class="casillas">${casillas.map(casillaHtml).join('')}</ul>
  </section>`
}

/** La foto de cierre. */
function fotoHtml(estado: EstadoCierre): string {
  const { foto } = estado
  const filas =
    foto.filas.length > 0
      ? foto.filas
          .map(
            (f) => `<tr>
        <td>${esc(f.nombreUbicacion)}</td>
        <td>${esc(f.activo)}</td>
        <td class="num">${esc(fmtDecimal(f.saldo))}</td>
        <td class="num">${f.precioEUR === null ? '<span class="marcador">sin cotización</span>' : esc(fmtEuro(f.precioEUR))}</td>
        <td class="num">${f.valorEUR === null ? '—' : esc(fmtEuro(f.valorEUR))}</td>
        <td>${f.fuente && f.fuente.trim() !== '' ? esc(f.fuente) : '<span class="marcador">sin fuente citada</span>'}</td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="6" class="vacio">No queda saldo a 31 de diciembre.</td></tr>'

  const totales = foto.totalesPorActivo
    .map(
      (t) =>
        `<tr><td colspan="2">Total ${esc(t.activo)}</td><td class="num">${esc(fmtDecimal(t.cantidad))}</td><td></td><td class="num">${t.valorEUR === null ? '—' : esc(fmtEuro(t.valorEUR))}</td><td></td></tr>`,
    )
    .join('')

  return `<section class="cajon">
    <h2>Foto de cierre a 31/12/${estado.ejercicio}</h2>
    <p class="expl">Saldos por ubicación y activo con la cotización empleada y su fuente. Es el dato que alimenta el 721 y el que abre el ejercicio siguiente con saldos comprobados en lugar de heredados — [MT] U10.3.</p>
    <table>
      <thead><tr><th>Ubicación</th><th>Activo</th><th class="num">Saldo</th><th class="num">Cotización</th><th class="num">Valor</th><th>Fuente</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot>${totales}<tr><td colspan="4">Total valorado${foto.activosSinCotizacion.length > 0 ? ' (mínimo)' : ''}</td><td class="num">${esc(fmtEuro(foto.totalValoradoEUR))}</td><td></td></tr></tfoot>
    </table>
  </section>`
}

/** La conciliación cola FIFO ↔ saldos. */
function conciliacionHtml(estado: EstadoCierre): string {
  const { conciliacionFifo: c } = estado
  const filas =
    c.filas.length > 0
      ? c.filas
          .map(
            (f) => `<tr>
        <td>${esc(f.activo)}</td>
        <td class="num">${esc(fmtDecimal(f.saldoTotal))}</td>
        <td class="num">${esc(fmtDecimal(f.existenciasFifo))}</td>
        <td class="num">${esc(fmtDecimal(f.diferencia))}</td>
        <td><span class="pill ${f.estado === 'OK' ? 'pill-verde' : f.estado === 'REVISAR' ? 'pill-ambar' : 'pill-rojo'}">${esc(f.estado)}</span></td>
        <td class="mono">${esc(f.apuntesImplicados.join(', ')) || '—'}</td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="6" class="vacio">Ningún activo con cola FIFO ni saldo a esta fecha.</td></tr>'

  const motivos = [...new Set(c.filas.flatMap((f) => f.motivos))]
    .map((m) => `<p class="expl"><strong>Motivo:</strong> ${esc(TEXTO_MOTIVO[m])}</p>`)
    .join('')

  return `<section class="cajon">
    <h2>La cola FIFO y el saldo, activo por activo</h2>
    <p class="expl">El CUADRE compara el saldo calculado con el saldo real declarado y por eso no puede ver un error de clasificación; esta comprobación mira hacia dentro — [MT] U7.5 y Anexo D.</p>
    <table>
      <thead><tr><th>Activo</th><th class="num">Suma de saldos</th><th class="num">Existencias FIFO</th><th class="num">Diferencia</th><th>Semáforo</th><th>Apuntes implicados</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    ${motivos}
  </section>`
}

/** La conciliación a tres columnas. */
function tresColumnasHtml(estado: EstadoCierre): string {
  const t = estado.tresColumnas
  const filas =
    t.filas.length > 0
      ? t.filas
          .map(
            (f) => `<tr>
        <td>${esc(f.concepto)}${f.origen && f.origen !== 'libre' ? ` <span class="unidad">Modelo ${esc(f.origen)}</span>` : ''}</td>
        <td class="num">${esc(fmtEuro(f.segunDatosFiscalesEUR))}</td>
        <td class="num">${esc(fmtEuro(f.segunRegistroEUR))}</td>
        <td class="num">${esc(fmtEuro(f.diferenciaEUR))}</td>
        <td>${f.explicacion ? esc(f.explicacion) : f.hayDiferencia ? '<span class="marcador">sin explicar</span>' : '—'}</td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="5" class="vacio">Sin filas: la conciliación a tres columnas no se ha hecho.</td></tr>'

  return `<section class="cajon">
    <h2>Conciliación a tres columnas</h2>
    <p class="expl">Qué dicen los datos fiscales, qué dice el registro y la explicación de cada diferencia — [MT] U10.2.</p>
    <table>
      <thead><tr><th>Concepto</th><th class="num">Datos fiscales</th><th class="num">Registro</th><th class="num">Diferencia</th><th>Explicación</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td>Totales</td><td class="num">${esc(fmtEuro(t.totalDatosFiscalesEUR))}</td><td class="num">${esc(fmtEuro(t.totalRegistroEUR))}</td><td class="num">${esc(fmtEuro(t.diferenciaTotalEUR))}</td><td></td></tr></tfoot>
    </table>
  </section>`
}

/** La memoria del ejercicio. */
function memoriaHtml(estado: EstadoCierre, memoria: Readonly<Record<string, string | undefined>>): string {
  const apartados = APARTADOS_MEMORIA.map((a) => {
    const texto = memoria[a.clave]
    const cuerpo =
      texto && texto.trim() !== ''
        ? `<p class="memoria">${esc(texto)}</p>`
        : '<p class="vacio">Sin escribir.</p>'
    return `<h3>${esc(a.titulo)}</h3>${cuerpo}`
  }).join('')

  return `<section class="cajon">
    <h2>Memoria del ejercicio ${estado.ejercicio}</h2>
    <p class="expl">${esc(NOTA_MEMORIA_ANEXO_D)}</p>
    ${apartados}
  </section>`
}

/** CSS embebido, sobrio y apto para impresión (sigue el estilo de informeFiscalHtml.ts). */
const ESTILO = `
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 0 0 6px; color: #334155; }
  h3 { font-size: 12px; margin: 10px 0 4px; color: #475569; text-transform: uppercase; letter-spacing: .04em; }
  .sub { color: #64748b; font-size: 12px; margin: 0 0 12px; }
  .cajon { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px 12px; margin: 12px 0; page-break-inside: avoid; }
  .grupo { margin: 10px 0; page-break-inside: avoid; }
  .expl { color: #64748b; font-size: 12px; margin: 2px 0 6px; }
  .razon { font-size: 12px; margin: 4px 0 0; padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
  .memoria { font-size: 12.5px; margin: 2px 0 8px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; vertical-align: top; }
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
  .casillas { list-style: none; margin: 0; padding: 0; }
  .casilla { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin: 0 0 6px; page-break-inside: avoid; }
  .casilla .cab { display: flex; gap: 8px; align-items: center; margin-bottom: 3px; }
  .casilla .que { margin: 0 0 3px; font-size: 12.5px; }
  .unidad { font-size: 11px; color: #94a3b8; }
  .quien { font-size: 11px; color: #94a3b8; margin-left: auto; }
  .disclaimer { margin-top: 20px; padding: 10px 12px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; }
  @media print { body { margin: 12mm; } .cajon, .aviso, .casilla { break-inside: avoid; } }
`

/**
 * Genera el documento HTML autónomo del cierre del ejercicio.
 *
 * @param estado   resultado de `calcularCierre`
 * @param memoria  los textos de la memoria (el motor solo devuelve su evaluación)
 */
export function construirInformeCierreHtml(
  estado: EstadoCierre,
  memoria: Readonly<Record<string, string | undefined>>,
): string {
  const grupos = estado.porMomento
    .map((g) => grupoHtml(ETIQUETA_MOMENTO[g.momento], g.casillas))
    .join('')

  const veredicto = estado.cerrado
    ? '<div class="aviso"><strong>Ejercicio CERRADO.</strong> Todas las casillas del Anexo D están marcadas, o marcadas como no aplicables con su razón escrita.</div>'
    : `<div class="aviso"><strong>Ejercicio NO cerrado.</strong> Quedan ${estado.bloqueos.length} casilla(s) por resolver: ${esc(
        estado.bloqueos
          .map(
            (b) =>
              `${b.queSeComprueba.slice(0, 60)}…${b.motivoBloqueo === 'no-aplica-sin-razon' ? ' (descartada sin razón escrita)' : ''}`,
          )
          .join(' · '),
      )}</div>`

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cierre del ejercicio ${estado.ejercicio}</title>
  <style>${ESTILO}</style>
</head>
<body>
  <h1>Cierre del ejercicio ${estado.ejercicio}</h1>
  <p class="sub">Libro Hespérides · Checklist del Anexo D · generado el ${esc(ahoraLegible())}</p>

  <div class="totales">
    <div class="kpi"><div class="et">Estado</div><div class="v">${estado.cerrado ? 'Cerrado' : 'No cerrado'}</div></div>
    <div class="kpi"><div class="et">Hechas</div><div class="v">${estado.cumplidas} / ${estado.casillas.length}</div></div>
    <div class="kpi"><div class="et">No aplican</div><div class="v">${estado.noAplicables}</div></div>
    <div class="kpi"><div class="et">Pendientes</div><div class="v">${estado.pendientes}</div></div>
    <div class="kpi"><div class="et">Resueltas</div><div class="v">${esc(fmtDecimal(String(estado.porcentaje)))} %</div></div>
  </div>

  ${veredicto}

  <section class="cajon">
    <h2>Checklist de cierre del ejercicio (Anexo D)</h2>
    <p class="expl">${esc(ENCABEZADO_ANEXO_D)}</p>
    ${grupos}
  </section>

  ${fotoHtml(estado)}
  ${conciliacionHtml(estado)}
  ${tresColumnasHtml(estado)}
  ${memoriaHtml(estado, memoria)}

  <div class="disclaimer">
    ${esc(AVISO_CIERRE_ORIENTATIVO)}
    <br /><br />
    Este documento es también, hoy, la copia de seguridad de la memoria del ejercicio y de las
    razones escritas: guárdalo en la carpeta del ejercicio y, como pide el propio Anexo D,
    conserva una copia fuera del equipo de trabajo.
  </div>

  <p class="sub" style="margin-top: 10px">
    Generado con <strong>Libro Hespérides</strong> — © ${esc(AUTORIA ?? '')} · aplicación
    publicada bajo licencia ${esc(LICENCIA ?? '')} · legelbitcoin.com. La licencia cubre el código de la app; los
    datos y este informe pertenecen a su titular.
  </p>
</body>
</html>`
}
