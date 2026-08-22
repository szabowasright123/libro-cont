/**
 * recompra.ts — detector de la norma anti-aplicación del art. 33.5.e LIRPF (fase D4).
 *
 * Fuente: manual, Unidad 4 ap. 4 («La norma anti-aplicación del art. 33.5 LIRPF») y
 * docs/DEFI_EVENTOS_COMPLEJOS.md §4.3.
 *
 * LA REGLA. No se computa la pérdida derivada de la transmisión de un elemento patrimonial
 * cuando el transmitente vuelve a adquirir el mismo elemento DENTRO DEL AÑO SIGUIENTE a la
 * fecha de la transmisión. La pérdida no desaparece: queda DIFERIDA hasta que se transmita
 * definitivamente el elemento readquirido.
 *
 * TRES PRECISIONES que el manual subraya y que este módulo respeta al pie de la letra:
 *
 *  1. La letra e) opera sobre cualquier «elemento patrimonial», SIN exigencia de
 *     homogeneidad. Las letras f) y g) se refieren a valores, condición que no se predica
 *     de los criptoactivos: por eso aquí NO aplican, y los plazos de dos meses (cotizados)
 *     y un año (no cotizados) de esas letras son irrelevantes.
 *
 *  2. La letra e) SOLO MIRA HACIA DELANTE: «dentro del año siguiente a la fecha de dicha
 *     transmisión». Una compra ANTERIOR a la venta no activa por sí sola el diferimiento.
 *     Es la asimetría más fácil de programar mal, y por eso tiene test propio.
 *
 *  3. Tratándose de bienes fungibles, se considera readquisición la de UNIDADES
 *     EQUIVALENTES del mismo activo (criterio del autor 16-08-2026). El manual señala que
 *     esta es «la discusión técnica real» y no la cierra; la app aplica la lectura amplia,
 *     que es la que la Administración tiene a su favor.
 *
 *  4. LOS DERIVADOS QUEDAN FUERA (V2770-19, 9-10-2019; precedente para futuros, V3755-16).
 *     La DGT ha declarado que las letras e), f) y g) del art. 33.5 no se aplican a los
 *     contratos por diferencias, por doble motivo: no son valores —decaen f) y g)— y no son
 *     elementos susceptibles de ser transmitidos y posteriormente adquiridos —decae la e)—.
 *     Aquí se cumple SIN CÓDIGO ADICIONAL, y conviene saber por qué: LIQUIDACION_DERIVADO
 *     tiene `consumeLote: false`, de modo que nunca produce una transmisión en la cola FIFO
 *     y su resultado negativo jamás entra en el bucle de `detectarRecompras`. La pérdida de
 *     un CFD no se difiere aunque se reabra posición al día siguiente. Test que lo fija:
 *     «una pérdida en derivados no se difiere aunque se reabra posición» (fases-d3-d6).
 *
 * AVISA, NO BLOQUEA (criterio del autor). El manual advierte de que el terreno «no es 100 %
 * seguro» y de que existen además las cláusulas generales de la LGT (arts. 13, 15 y 16).
 * La decisión es del contribuyente; la app se limita a que no se le pase por alto.
 *
 * Determinista y TypeScript puro (Regla de oro 4).
 */

import type { Apunte, IdApunte, SimboloActivo } from '../types'
import { CATALOGO_TIPOS } from '../types'
import { D, aCadena, CERO, Decimal } from '../decimal'
import { calcularFifo } from '../fifo'

/** Una pérdida cuya integración queda diferida por readquisición dentro del año siguiente. */
export interface PerdidaDiferida {
  /** Apunte de la transmisión con pérdida. */
  apunteId: IdApunte
  activo: SimboloActivo
  fechaHora: string
  ejercicio: number
  /** Importe de la pérdida (positivo). */
  perdidaEUR: string
  /** Cantidad transmitida con pérdida. */
  cantidadTransmitida: string
  /**
   * Cantidad readquirida dentro del año siguiente. Si es menor que la transmitida, solo se
   * difiere la parte proporcional: la letra e) opera sobre lo readquirido, no sobre el todo.
   */
  cantidadReadquirida: string
  /** Parte de la pérdida que NO se computa todavía. */
  importeDiferidoEUR: string
  /** Parte que sí se computa en el ejercicio. */
  importeComputableEUR: string
  /** Apuntes de readquisición que activan el diferimiento. */
  readquisiciones: { apunteId: IdApunte; fechaHora: string; cantidad: string }[]
}

/** ¿Es bisiesto este año? (regla gregoriana completa). */
function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

/**
 * Fecha límite de la readquisición: un año natural después de la transmisión, «de fecha a
 * fecha» (art. 5.1 CC).
 *
 * SE CALCULA SOBRE LA CADENA, sin pasar por `Date`. La primera versión hacía
 * `new Date(iso)` + `toISOString()`, y eso introducía un bug de fondo: las marcas del Libro
 * son ISO en HORA LOCAL ESPAÑOLA (ver `FechaHoraISO` y la regla de oro 6), pero
 * `toISOString()` las convierte a UTC. En un equipo en Europe/Madrid el límite salía
 * desplazado una o dos horas según el horario de verano, mientras que en un servidor en UTC
 * salía correcto.
 *
 * El daño no era cosmético: `detectarRecompras` compara `ap.fechaHora > limite` como
 * cadenas, de modo que el desfase movía la frontera del año y una readquisición registrada
 * justo en el borde entraba o salía del diferimiento según la zona horaria del equipo. Es
 * decir, el mismo Libro daba resultados fiscales distintos en Madrid y en Londres, lo que
 * rompe la regla de oro 4 (funciones deterministas estado→resultado).
 *
 * Trabajar sobre la cadena elimina el problema de raíz: no hay zona horaria que aplicar
 * porque nunca se sale del calendario local.
 */
export function limiteAnoSiguiente(fechaHoraISO: string): string {
  const [fecha = '', hora = '00:00:00'] = fechaHoraISO.split('T')
  const [a = '0', m = '01', d = '01'] = fecha.split('-')
  const anio = Number(a) + 1

  // 29 de febrero: si el año siguiente no es bisiesto, el plazo vence el 28. Es el
  // criterio del cómputo civil «de fecha a fecha» cuando el mes de vencimiento no tiene
  // día equivalente (art. 5.1 CC in fine).
  const dia = m === '02' && d === '29' && !esBisiesto(anio) ? '28' : d

  return `${anio}-${m}-${dia}T${hora}`
}

/** ¿Este apunte readquiere unidades del activo (abre lote)? */
function readquiere(ap: Apunte, activo: SimboloActivo): boolean {
  return (
    CATALOGO_TIPOS[ap.tipo].abreLote === true &&
    ap.activoEntrada === activo &&
    !!ap.cantidadEntrada &&
    D(ap.cantidadEntrada).greaterThan(0)
  )
}

/**
 * Detecta las pérdidas cuya integración queda diferida por el art. 33.5.e LIRPF.
 *
 * Recorre las transmisiones con resultado negativo y, para cada una, busca readquisiciones
 * del mismo activo en la ventana `(fecha, fecha + 1 año]`. Cada readquisición se consume
 * como mucho una vez: una sola compra no puede diferir dos ventas distintas por la misma
 * cantidad, o se computaría dos veces el mismo hecho.
 */
export function detectarRecompras(apuntes: readonly Apunte[]): PerdidaDiferida[] {
  const fifo = calcularFifo([...apuntes])
  const perdidas: PerdidaDiferida[] = []

  // Cantidad de cada readquisición ya imputada a un diferimiento anterior.
  const yaUsado = new Map<IdApunte, Decimal>()

  for (const { transmisiones } of fifo.values()) {
    for (const t of transmisiones) {
      const resultado = D(t.resultadoEUR)
      if (resultado.greaterThanOrEqualTo(0)) continue

      const limite = limiteAnoSiguiente(t.fechaHora)
      const cantidadTransmitida = D(t.cantidad)
      let porCubrir = cantidadTransmitida
      const readquisiciones: PerdidaDiferida['readquisiciones'] = []

      for (const ap of apuntes) {
        if (porCubrir.lessThanOrEqualTo(0)) break
        // SOLO HACIA DELANTE (precisión 2): estrictamente posterior a la transmisión y
        // dentro del año siguiente. Una compra anterior no activa la regla.
        if (ap.fechaHora <= t.fechaHora || ap.fechaHora > limite) continue
        if (!readquiere(ap, t.activo)) continue

        const disponible = D(ap.cantidadEntrada).minus(yaUsado.get(ap.id) ?? CERO)
        if (disponible.lessThanOrEqualTo(0)) continue

        const toma = Decimal.min(porCubrir, disponible)
        yaUsado.set(ap.id, (yaUsado.get(ap.id) ?? CERO).plus(toma))
        readquisiciones.push({
          apunteId: ap.id,
          fechaHora: ap.fechaHora,
          cantidad: aCadena(toma),
        })
        porCubrir = porCubrir.minus(toma)
      }

      const readquirida = cantidadTransmitida.minus(porCubrir)
      if (readquirida.lessThanOrEqualTo(0)) continue

      // Diferimiento proporcional: la letra e) opera sobre lo readquirido. Si se recompró
      // la mitad, se difiere la mitad de la pérdida y la otra mitad se computa ya.
      const proporcion = readquirida.div(cantidadTransmitida)
      const perdida = resultado.abs()
      const diferido = perdida.times(proporcion)

      perdidas.push({
        apunteId: t.apunteId,
        activo: t.activo,
        fechaHora: t.fechaHora,
        ejercicio: t.ejercicio,
        perdidaEUR: aCadena(perdida),
        cantidadTransmitida: aCadena(cantidadTransmitida),
        cantidadReadquirida: aCadena(readquirida),
        importeDiferidoEUR: aCadena(diferido),
        importeComputableEUR: aCadena(perdida.minus(diferido)),
        readquisiciones,
      })
    }
  }

  perdidas.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  return perdidas
}

/** Aviso listo para la UI, con el mensaje que el alumno debe leer. */
export interface AvisoRecompra {
  apunteId: IdApunte
  nivel: 'aviso'
  codigo: 'RECOMPRA_33_5_E'
  mensaje: string
  detalle: PerdidaDiferida
}

/**
 * Traduce las pérdidas diferidas a avisos. Nivel `aviso` y no `error` por decisión del
 * autor: la regla ofrece a la Administración una vía directa para diferir la integración,
 * pero la calificación final es del contribuyente.
 */
export function avisosRecompra(apuntes: readonly Apunte[]): AvisoRecompra[] {
  return detectarRecompras(apuntes).map((p) => ({
    apunteId: p.apunteId,
    nivel: 'aviso' as const,
    codigo: 'RECOMPRA_33_5_E' as const,
    mensaje:
      `Pérdida de ${p.perdidaEUR} € en ${p.activo} con readquisición de ` +
      `${p.cantidadReadquirida} unidades dentro del año siguiente: el art. 33.5.e LIRPF ` +
      `difiere ${p.importeDiferidoEUR} € hasta que se transmita definitivamente lo ` +
      `readquirido. La pérdida no se pierde, se aplaza.`,
    detalle: p,
  }))
}
