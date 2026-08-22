/**
 * indiceCarpeta.ts — índice de la CARPETA del expediente probatorio de un ejercicio.
 *
 * El expediente HTML se lee; la carpeta se coteja. Este módulo produce la lista de «qué
 * documento debería estar en cada sitio, según el Libro» y «cuál consta ya registrado»,
 * que es lo que permite abrir la carpeta real del alumno al lado del documento e ir
 * tachando. Sin él, el expediente sería un informe más; con él, es una lista de cotejo.
 *
 * La convención de carpetas NO se reinventa aquí: sale entera del motor
 * (`engine/archivo.ts` — `CARPETAS_ARCHIVO`, `RUTA_POR_TIPO`, `CARPETAS_SIN_APUNTE`) y la
 * checklist de documentos exigibles, también (`requisitosAplicables`, que ya filtra la rama
 * KYC / no-KYC). Este fichero solo cruza las dos cosas con el diario y con lo registrado.
 *
 * Capa de datos, pero función PURA: entra estado, sale resultado. Sin Dexie ni navegador,
 * para que se pueda probar en Node y reutilizar desde cualquier pantalla.
 */

import type {
  Apunte,
  IdApunte,
  Justificante,
  RefUbicacion,
  RutaConvencional,
  TipoOperacion,
} from '../../engine/types'
import {
  CARPETAS_ARCHIVO,
  CARPETAS_SIN_APUNTE,
  RUTA_POR_TIPO,
  agruparPorApunte,
  requisitosAplicables,
  ubicacionRelevanteConKyc,
} from '../../engine/archivo'

/**
 * Qué guarda cada carpeta, en las palabras del manual [MT] U3.3 (convención VALIDADA el
 * 6-8-2026, recogida en docs/TEXTOS_MANUAL_RANURAS.md §5). Es texto metodológico del
 * Bloque 1, no una calificación fiscal, y se copia literal: la Regla de oro 5 prohíbe
 * parafrasear, no citar. Las dos últimas carpetas son extensión de la app y se describen
 * como tal.
 *
 * Su sitio natural sería `CARPETAS_ARCHIVO` en el motor, junto a la etiqueta; vive aquí
 * porque el motor está fuera del perímetro de este módulo (ver informe de entrega).
 */
export const CONTENIDO_CARPETA: Readonly<Record<RutaConvencional, string>> = Object.freeze({
  '01-adquisiciones':
    'Contratos P2P, tickets de cajero, facturas emitidas, documentos de donación, informes de pool; cada uno con su cotización del día. [MT U3.3]',
  '02-transferencias':
    'Txids y capturas de movimientos entre ubicaciones propias, con sus comisiones de red. [MT U3.3]',
  '03-transmisiones': 'Ventas, permutas y pagos: orden ejecutada, contravalor, comisión. [MT U3.3]',
  '04-rendimientos':
    'Staking, intereses, recompensas: fecha y valor al percibirse. [MT U3.3]',
  '05-certificados':
    'Los certificados anuales del exchange y las exportaciones CSV periódicas. Admite documentos sin apunte asociado. [MT U3.3]',
  '06-etiquetas':
    'Las exportaciones BIP-329 fechadas de cada wallet. Admite documentos sin apunte asociado. [MT U3.3]',
  '07-perdidas-y-donaciones':
    'Extensión de la app: expediente de PÉRDIDA (denuncia, drenaje, atestado) y de DONACIÓN (documento, ISD).',
  '99-otros': 'Extensión de la app: justificaciones de rectificación y resto.',
})

/** Un documento que el Libro espera encontrar en la carpeta, y si consta o no. */
export interface DocumentoEsperado {
  apunteId: IdApunte
  fechaHora: string
  tipo: TipoOperacion
  /** Clave estable del requisito (casa con `Justificante.tipoDocumento`). */
  clave: string
  /** Nombre del documento a aportar (literal de la checklist del manual). */
  documento: string
  /** true si hay un justificante registrado que cubre el requisito. */
  consta: boolean
  /** Referencia externa o notas del justificante que lo cubre. */
  referencia?: string
  /** Hash SHA-256 del justificante, si se registró (integridad probatoria). */
  hash?: string
  /**
   * Carpeta en la que está archivado el justificante que cubre el requisito, cuando NO es
   * la que le corresponde por tipo. No es un error —el alumno puede archivar donde quiera—,
   * pero al cotejar contra la carpeta real hay que saber dónde mirar.
   */
  archivadoEn?: RutaConvencional
}

/** Un justificante registrado en la carpeta que no casa con ningún requisito esperado. */
export interface DocumentoSuelto {
  id: string
  /** Apunte al que dice pertenecer (vacío si es documento de ejercicio o de ubicación). */
  apunteId: IdApunte
  tipoDocumento: string
  referencia?: string
  hash?: string
  /** true si su `apunteId` no corresponde a ningún apunte del diario. */
  sinApunte: boolean
}

/** Una carpeta del expediente con su cotejo. */
export interface CarpetaExpediente {
  ruta: RutaConvencional
  etiqueta: string
  /** Ruta completa sugerida en disco: `<ejercicio>/<carpeta>/`. */
  rutaCompleta: string
  contenido: string
  /** true si la carpeta admite documentos sin apunte (certificados y etiquetas). */
  admiteSinApunte: boolean
  esperados: DocumentoEsperado[]
  constan: number
  faltan: number
  otros: DocumentoSuelto[]
}

/** Índice completo de la carpeta del ejercicio. */
export interface IndiceCarpeta {
  ejercicio: number
  carpetas: CarpetaExpediente[]
  totalEsperados: number
  totalConstan: number
  totalFaltan: number
}

/**
 * Construye el índice de la carpeta del ejercicio.
 *
 * @param apuntesEjercicio  apuntes del ejercicio (ya filtrados)
 * @param justificantes     justificantes de dominio del Libro COMPLETO (los documentos de
 *                          carpeta 05/06 no cuelgan de un apunte y hay que verlos igual)
 * @param kycPorUbicacion   mapa ubicación→KYC (`mapaKyc` del motor): decide qué rama de la
 *                          checklist aplica a cada adquisición
 * @param idsDelDiario      correlativos de TODOS los apuntes del Libro, para distinguir un
 *                          documento de ejercicio de un justificante huérfano
 */
export function construirIndiceCarpeta(
  apuntesEjercicio: readonly Apunte[],
  justificantes: readonly Justificante[],
  kycPorUbicacion: ReadonlyMap<RefUbicacion, boolean>,
  ejercicio: number,
  idsDelDiario?: ReadonlySet<IdApunte>,
): IndiceCarpeta {
  const porApunte = agruparPorApunte(justificantes)
  const idsEjercicio = new Set(apuntesEjercicio.map((a) => a.id))
  const idsDiario = idsDelDiario ?? idsEjercicio
  const admiteSinApunte = new Set<RutaConvencional>(CARPETAS_SIN_APUNTE)

  // Los justificantes que ya hemos dado por «esperados» no vuelven a salir como sueltos.
  const consumidos = new Set<string>()
  const esperadosPorRuta = new Map<RutaConvencional, DocumentoEsperado[]>()

  for (const ap of apuntesEjercicio) {
    const ruta = RUTA_POR_TIPO[ap.tipo]
    const conKyc = ubicacionRelevanteConKyc(ap, kycPorUbicacion)
    const suyos = porApunte.get(ap.id) ?? []
    const lista = esperadosPorRuta.get(ruta) ?? []

    for (const req of requisitosAplicables(ap.tipo, conKyc)) {
      const j = suyos.find((x) => x.tipoDocumento === req.clave)
      if (j) consumidos.add(j.id)
      lista.push({
        apunteId: ap.id,
        fechaHora: ap.fechaHora,
        tipo: ap.tipo,
        clave: req.clave,
        documento: req.documento,
        consta: j !== undefined,
        ...(j?.referenciaExterna ?? j?.notas ? { referencia: j?.referenciaExterna ?? j?.notas } : {}),
        ...(j?.hashSHA256 ? { hash: j.hashSHA256 } : {}),
        ...(j && j.rutaConvencional !== ruta ? { archivadoEn: j.rutaConvencional } : {}),
      })
    }
    esperadosPorRuta.set(ruta, lista)
  }

  // Sueltos: lo registrado que no cubre un requisito esperado. Se muestran porque al cotejar
  // una carpeta real importa tanto lo que falta como lo que hay de más.
  const sueltosPorRuta = new Map<RutaConvencional, DocumentoSuelto[]>()
  for (const j of justificantes) {
    if (consumidos.has(j.id)) continue
    const esDeEjercicio = idsEjercicio.has(j.apunteId)
    const sinApunte = !idsDiario.has(j.apunteId)
    // Un documento de otro ejercicio no ensucia este índice; uno sin apunte archivado en
    // certificados o etiquetas sí entra: es documento del ejercicio o de la ubicación.
    if (!esDeEjercicio && !(sinApunte && admiteSinApunte.has(j.rutaConvencional))) continue
    const lista = sueltosPorRuta.get(j.rutaConvencional) ?? []
    lista.push({
      id: j.id,
      apunteId: j.apunteId,
      tipoDocumento: j.tipoDocumento,
      ...(j.referenciaExterna ?? j.notas ? { referencia: j.referenciaExterna ?? j.notas } : {}),
      ...(j.hashSHA256 ? { hash: j.hashSHA256 } : {}),
      sinApunte,
    })
    sueltosPorRuta.set(j.rutaConvencional, lista)
  }

  const carpetas: CarpetaExpediente[] = CARPETAS_ARCHIVO.map((c) => {
    const esperados = (esperadosPorRuta.get(c.ruta) ?? []).sort(
      (a, b) => a.fechaHora.localeCompare(b.fechaHora) || a.apunteId.localeCompare(b.apunteId),
    )
    const constan = esperados.filter((e) => e.consta).length
    return {
      ruta: c.ruta,
      etiqueta: c.etiqueta,
      rutaCompleta: `${ejercicio}/${c.ruta}/`,
      contenido: CONTENIDO_CARPETA[c.ruta],
      admiteSinApunte: admiteSinApunte.has(c.ruta),
      esperados,
      constan,
      faltan: esperados.length - constan,
      otros: sueltosPorRuta.get(c.ruta) ?? [],
    }
  })

  return {
    ejercicio,
    carpetas,
    totalEsperados: carpetas.reduce((n, c) => n + c.esperados.length, 0),
    totalConstan: carpetas.reduce((n, c) => n + c.constan, 0),
    totalFaltan: carpetas.reduce((n, c) => n + c.faltan, 0),
  }
}
