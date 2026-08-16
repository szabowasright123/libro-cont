/**
 * comparativa.ts — recálculo bajo la tesis alternativa (fase D5).
 *
 * Fuente: docs/DEFI_EVENTOS_COMPLEJOS.md §9, punto 4 del protocolo de zonas grises.
 *
 * Ocho supuestos del catálogo DeFi carecen de criterio administrativo publicado. La app
 * aplica en cada uno una tesis por defecto y deja constancia en `criterioAplicado`, pero eso
 * no basta: el alumno necesita saber CUÁNTO le mueve la zona gris. Esa es la herramienta que
 * este módulo construye, y no es un adorno — el día que una de estas cuestiones se resuelva,
 * la pregunta inmediata será cuánto cambia.
 *
 * El mecanismo es deliberadamente simple: los apuntes que llevan `contravalorAlternativoEUR`
 * se recalculan con ese importe en lugar del declarado, y se comparan los dos resultados
 * fiscales. Nada más. La tesis alternativa no reordena patas ni cambia tipos: si lo hiciera,
 * no sería una comparación sino otro Libro.
 *
 * Determinista y TypeScript puro (Regla de oro 4).
 */

import type { Apunte } from '../types'
import { D, aCadena, CERO, Decimal } from '../decimal'
import { transmisionesDelDiario } from '../fifo'

/** Diferencia de resultado fiscal entre la tesis aplicada y la alternativa. */
export interface Comparativa {
  /** Nº de apuntes que declaran una valoración alternativa. */
  apuntesConAlternativa: number
  /** Resultado total de las transmisiones con la tesis aplicada. */
  totalAplicadoEUR: string
  /** Resultado total con la tesis alternativa. */
  totalAlternativoEUR: string
  /** Alternativo − aplicado. Positivo = la alternativa tributa MÁS. */
  diferenciaEUR: string
  /** Detalle por apunte afectado. */
  detalle: DetalleComparativa[]
}

/** Diferencia de un apunte concreto. */
export interface DetalleComparativa {
  apunteId: string
  activo: string
  criterioAplicado?: string
  contravalorAplicadoEUR: string
  contravalorAlternativoEUR: string
  resultadoAplicadoEUR: string
  resultadoAlternativoEUR: string
  diferenciaEUR: string
}

/** Sustituye el contravalor por el alternativo en los apuntes que lo declaren. */
function conTesisAlternativa(apuntes: readonly Apunte[]): Apunte[] {
  return apuntes.map((ap) =>
    ap.contravalorAlternativoEUR !== undefined
      ? { ...ap, contravalorEUR: ap.contravalorAlternativoEUR }
      : ap,
  )
}

/**
 * Compara el resultado fiscal del diario bajo la tesis aplicada y bajo la alternativa.
 *
 * Solo entran en el detalle los apuntes que declaran `contravalorAlternativoEUR`, pero los
 * totales se calculan sobre TODO el diario: cambiar el valor de una permuta altera el coste
 * de adquisición del lote que abre, y eso se propaga a las transmisiones posteriores. Medir
 * solo el apunte afectado daría una cifra corta.
 */
export function compararTesis(apuntes: readonly Apunte[]): Comparativa {
  const conAlternativa = apuntes.filter((ap) => ap.contravalorAlternativoEUR !== undefined)

  const aplicadas = transmisionesDelDiario([...apuntes])
  const alternativas = transmisionesDelDiario(conTesisAlternativa(apuntes))

  const suma = (ts: readonly { resultadoEUR: string }[]) =>
    ts.reduce<Decimal>((acc, t) => acc.plus(D(t.resultadoEUR)), CERO)

  const totalAplicado = suma(aplicadas)
  const totalAlternativo = suma(alternativas)

  const porApunteAlt = new Map(alternativas.map((t) => [t.apunteId, t]))
  const apunteById = new Map(apuntes.map((a) => [a.id, a]))

  const detalle: DetalleComparativa[] = []
  for (const t of aplicadas) {
    const ap = apunteById.get(t.apunteId)
    if (!ap?.contravalorAlternativoEUR) continue
    const alt = porApunteAlt.get(t.apunteId)
    if (!alt) continue
    detalle.push({
      apunteId: t.apunteId,
      activo: t.activo,
      ...(ap.criterioAplicado ? { criterioAplicado: ap.criterioAplicado } : {}),
      contravalorAplicadoEUR: ap.contravalorEUR ?? '0',
      contravalorAlternativoEUR: ap.contravalorAlternativoEUR,
      resultadoAplicadoEUR: t.resultadoEUR,
      resultadoAlternativoEUR: alt.resultadoEUR,
      diferenciaEUR: aCadena(D(alt.resultadoEUR).minus(D(t.resultadoEUR))),
    })
  }

  return {
    apuntesConAlternativa: conAlternativa.length,
    totalAplicadoEUR: aCadena(totalAplicado),
    totalAlternativoEUR: aCadena(totalAlternativo),
    diferenciaEUR: aCadena(totalAlternativo.minus(totalAplicado)),
    detalle,
  }
}
