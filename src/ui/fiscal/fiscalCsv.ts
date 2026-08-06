/**
 * fiscalCsv.ts — export del resumen fiscal a CSV (es-ES, apto para Excel/LibreOffice).
 *
 * Separador `;` y coma decimal (convención es-ES de Excel), con BOM UTF-8. Una fila por
 * línea de detalle, agrupada por cajón mediante la columna «Cajón», más filas de total.
 * Presentación pura: no calcula (los números vienen del motor).
 */
import type { ResumenFiscal, BloqueIngresos } from '../../engine/fiscal'
import { CONCEPTOS_FISCALES } from '../../engine/fiscal'
import { fmtDecimal, fmtUbicacion } from '../formato'
import type { RefUbicacion } from '../../engine/types'

/** Escapa un campo CSV (comillas dobles si contiene separador, comillas o salto). */
function campo(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Fila CSV a partir de celdas. */
function fila(celdas: Array<string | number | undefined | null>): string {
  return celdas.map(campo).join(';')
}

/** Número de dominio (punto interno) → texto es-ES con coma (para Excel). */
function num(v: string): string {
  const t = fmtDecimal(v) // «1.234,5» con separador de miles
  return t === '—' ? '' : t
}

/** Filas de un bloque de ingresos (RCM / actividad / base general). */
function filasIngresos(cajon: string, bloque: BloqueIngresos): string[] {
  const out = bloque.partidas.map((p) =>
    fila([cajon, p.apunteId, p.fechaHora.slice(0, 10), p.tipo, p.activo, num(p.cantidad), '', '', num(p.importeEUR)]),
  )
  out.push(fila([cajon, 'TOTAL', '', '', '', '', '', '', num(bloque.totalEUR)]))
  return out
}

/**
 * Serializa el resumen fiscal a CSV. `nombrePorId` resuelve ubicaciones (para el aviso 721).
 */
export function resumenFiscalACsv(
  resumen: ResumenFiscal,
  nombrePorId: Map<string, string>,
): string {
  const nombreUbic = (r: RefUbicacion) => fmtUbicacion(r, nombrePorId)
  const { ahorro, rcm, actividadEconomica, baseGeneral, perdidas, avisoExtranjero } = resumen
  const lineas: string[] = []

  lineas.push(fila([`Resumen fiscal orientativo ${resumen.ejercicio}`]))
  lineas.push('')
  lineas.push(
    fila(['Cajón', 'Apunte', 'Fecha', 'Tipo', 'Activo', 'Cantidad', 'Valor neto EUR', 'Coste FIFO EUR', 'Resultado/Importe EUR']),
  )

  const CAJ_AHORRO = CONCEPTOS_FISCALES.ahorro.etiqueta
  for (const o of ahorro.operaciones) {
    lineas.push(
      fila([CAJ_AHORRO, o.apunteId, o.fechaHora.slice(0, 10), o.tipo, o.activo, num(o.cantidad), num(o.valorTransmisionNetoEUR), num(o.costeFifoEUR), num(o.resultadoEUR)]),
    )
  }
  lineas.push(fila([CAJ_AHORRO, 'GANANCIAS', '', '', '', '', '', '', num(ahorro.gananciasEUR)]))
  lineas.push(fila([CAJ_AHORRO, 'PÉRDIDAS TRANSMISIÓN', '', '', '', '', '', '', num(ahorro.perdidasEUR)]))
  lineas.push(fila([CAJ_AHORRO, 'NETO', '', '', '', '', '', '', num(ahorro.netoEUR)]))

  lineas.push(...filasIngresos(CONCEPTOS_FISCALES.rcm.etiqueta, rcm))
  lineas.push(...filasIngresos(CONCEPTOS_FISCALES['actividad-economica'].etiqueta, actividadEconomica))
  lineas.push(...filasIngresos(CONCEPTOS_FISCALES['base-general'].etiqueta, baseGeneral))

  const CAJ_PERD = CONCEPTOS_FISCALES.perdidas.etiqueta
  for (const p of perdidas.items) {
    lineas.push(
      fila([CAJ_PERD, p.apunteId, p.fechaHora.slice(0, 10), 'PERDIDA', p.activo, num(p.cantidad), num(p.valorTransmisionNetoEUR), num(p.costeFifoEUR), num(p.resultadoEUR)]) +
        `;${campo(`prueba: ${p.estadoProbatorio}`)}`,
    )
  }
  lineas.push(fila([CAJ_PERD, 'TOTAL (potencial)', '', '', '', '', '', '', num(perdidas.totalEUR)]))

  if (avisoExtranjero.aplica) {
    lineas.push('')
    lineas.push(fila([`Aviso 721 — saldos en el extranjero a 31/12/${resumen.ejercicio}`]))
    lineas.push(fila(['Ubicación', 'País', 'Activo', 'Saldo', 'Valor EUR']))
    for (const c of avisoExtranjero.celdas) {
      lineas.push(
        fila([nombreUbic(c.ubicacion), c.pais ?? '', c.activo, num(c.saldo), c.sinValorar ? 'sin valorar' : num(c.valorEUR ?? '')]),
      )
    }
    lineas.push(fila(['TOTAL VALORADO', '', '', '', num(avisoExtranjero.totalValoradoEUR)]))
    lineas.push(fila([`Umbral informativo: ${num(String(avisoExtranjero.umbralEUR))} EUR · ${avisoExtranjero.supera ? 'SUPERA' : 'no supera'}`]))
  }

  lineas.push('')
  lineas.push(
    fila([
      'Resumen orientativo docente. No es asesoramiento fiscal ni declaración. Calificaciones y fechas de criterio: literales del manual del taller; casillas: verificar en el Manual práctico de Renta del ejercicio.',
    ]),
  )

  // BOM UTF-8 para que Excel respete los acentos.
  return '﻿' + lineas.join('\r\n')
}
