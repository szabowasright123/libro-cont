/**
 * unidades.ts — catálogo de las «Unidades del manual» que se muestran en cada
 * pantalla (guía integrada, P8).
 *
 * Regla de oro 5: los textos del manual del taller NO se redactan en la app; son literales.
 * Los pegó el responsable (validados a 2026-08-06, ver docs/TEXTOS_MANUAL_RANURAS.md §4) en
 * el campo `texto` de cada unidad, con su cita. Se conserva la `pista` neutra como entradilla
 * y lo ESTRUCTURAL (a qué bloque pertenece la pantalla).
 *
 * El marcador `{{TEXTO-MANUAL}}` (MARCADOR_MANUAL) queda disponible para unidades futuras aún
 * sin literal. Inventario: `docs/PENDIENTE_TEXTOS.md` (sección «Guía integrada»).
 */
import type { Ruta } from '../shell/rutas'

/** Mismo marcador que el módulo fiscal (una única convención en toda la app). */
export const MARCADOR_MANUAL = '{{TEXTO-MANUAL}}' as const

export interface UnidadManual {
  /** Clave estable para el inventario de textos pendientes. */
  readonly clave: string
  /** Bloque del taller al que pertenece (estructural, no es calificación). */
  readonly bloque: string
  /** Pista neutra de para qué sirve la pantalla (entradilla de la unidad). */
  readonly pista: string
  /** Texto literal de la unidad del manual (con su cita). Vacío = pendiente de literal. */
  readonly texto: string
}

/**
 * Unidad del manual por pantalla. `texto` lleva el literal de la unidad del taller (con cita);
 * `bloque` y `pista` son andamiaje estructural que la acompaña.
 */
export const UNIDADES_MANUAL: Partial<Record<Ruta, UnidadManual>> = {
  diario: {
    clave: 'manual.diario',
    bloque: 'Bloque 2 · El Libro',
    pista: 'Registrar cada operación como un apunte del diario, en orden cronológico.',
    texto:
      '«Nuestra primera idea debe ser que el libro dice qué pasó y la carpeta lo prueba. Cada línea del libro apunta a su justificante; cada justificante está representado en una línea.» «Integridad. Se registra TODO movimiento, gravable o no. […] El criterio de qué anotar no es “¿tributa?” sino “¿movió valor?”.» «Correcciones auditables: […] el apunte original se conserva y la corrección entra como apunte nuevo de AJUSTE/RECTIFICACIÓN, con referencia al apunte corregido.» — [MT] Unidad 4, aps. 1-2 (principios 1 y 7) y Unidad 7, ap. 4.',
  },
  archivo: {
    clave: 'manual.archivo',
    bloque: 'Bloque 1 · El Archivo probatorio',
    pista: 'Reunir los justificantes que sostienen cada apunte: «¿cómo lo demuestro?».',
    texto:
      '«La segunda mitad del setup […] es el respaldo documental. Se presenta como una estructura fija de carpetas, una por ejercicio fiscal, donde cae el papel de cada operación el día en que la operación ocurre.» «Regla que debe respetarse dentro de lo posible: ningún movimiento sin su papel; el papel se archiva el día de la operación. Con diez segundos por operación puedes mantener cómodamente el archivo. En caso contrario […] se requerirán decenas de horas para hacer una reconstrucción aproximada.» — [MT] Unidad 3, ap. 3, «La carpeta del ejercicio fiscal, nuestro archivo probatorio».',
  },
  trazabilidad: {
    clave: 'manual.trazabilidad',
    bloque: 'Bloque 1 · Trazabilidad',
    pista: 'Seguir el origen KYC / no-KYC de cada saldo: «¿de dónde salió esta cripto?».',
    texto:
      'Vía KYC: «lo que el CASP documenta, el CASP lo comunica» (modelos 172/173 y DAC8/CARF). Vías no-KYC: «ninguna de las vías siguientes es ilegal. Estas vías coinciden en que nadie informa de la operación a la AEAT por ti y nadie te documenta. La disciplina documental que en la vía KYC regala el CASP aquí la pone el adquirente o no la pone nadie.» Y el porqué: «La carga de la prueba (arts. 105 y 106 LGT): […] quien afirma un hecho debe probarlo»; si el coste no se acredita, la Administración «puede regularizar tomando como coste el que resulte probado que, en el peor de los casos, puede ser 0» (la «trampa del coste cero»). — [MT] Unidad 2, aps. 2, 3 y 5.',
  },
  fiscal: {
    clave: 'manual.fiscal',
    bloque: 'Bloque 3 · Fiscalidad',
    pista: 'Resumen anual orientativo por cajones. No es asesoramiento ni declaración.',
    texto:
      '«Si las dos primeras partes se han hecho bien, el IRPF es un trámite de traslado. La teoría fiscal vive en el manual de Fiscalidad en Bitcoin, al que se remite; aquí está el gesto práctico: qué salida del registro va a qué apartado de Renta WEB, cómo se concilia el registro propio con lo que la AEAT ya sabe por terceros, y cómo se cierra y archiva un ejercicio.» «Los números de casilla y las pantallas cambian cada campaña. […] Los apartados y la lógica, qué renta va a qué base, cambian rara vez y con ley.» — [MT] Parte III, introducción.',
  },
  importar: {
    clave: 'manual.importar',
    bloque: 'Bloque 1 · Trazabilidad',
    pista:
      'Un explorador da movimientos, no operaciones: la cadena no sabe si un envío es traslado o transmisión. Lo decides tú.',
    // Pendiente del literal del manual (U3.3, «la fuente más frecuente de errores en la
    // contabilidad de carteras»): ver docs/PENDIENTE_TEXTOS.md §4.
    texto: '',
  },
  ubicaciones: {
    clave: 'manual.ubicaciones',
    bloque: 'Bloque 1 · Ubicaciones',
    pista: 'Declarar dónde está la cripto (exchange, wallet…) y si la vía llevaba KYC.',
    texto:
      '«Todo saldo tiene ubicación. No existe “tengo 0,7 BTC”; existe “0,4 en la wallet fría, 0,25 en el exchange, 0,05 en el canal Lightning”. Cada exchange, wallet o canal es una ubicación del registro, con saldo propio comprobable contra la realidad.» — [MT] Unidad 4, ap. 2, principio 3.',
  },
  parametros: {
    clave: 'manual.parametros',
    bloque: 'Bloque 2 · Parámetros',
    pista: 'Los 11 tipos de operación, los activos y las tolerancias del cuadre.',
    texto:
      '«La plantilla no admite texto libre en la columna Tipo: admite once valores, definidos en PARÁMETROS. Un catálogo cerrado obliga a decidir, y las decisiones difíciles son exactamente las que conviene tomar despacio y una sola vez, no improvisar en cada línea.» Y el motivo de la validación dura: «El cuadre caza errores de cantidad, no de concepto. Una PERMUTA anotada como TRANSFERENCIA cuadra perfectamente […] y sin embargo ha hecho desaparecer una alteración patrimonial del cálculo fiscal» (el «error invisible»). — [MT] Unidad 6, aps. 1-2.',
  },
  ajustes: {
    clave: 'manual.ajustes',
    bloque: 'Transversal · Puentes y copias',
    pista: 'Alternar con Excel/CSV sin pérdida y guardar/restaurar tu copia local.',
    texto:
      '«La foto de cierre. El 31 de diciembre y quince minutos que compran un año de tranquilidad: 1. Exportar el histórico completo de cada exchange del ejercicio y las etiquetas BIP-329 de cada wallet. 2. Cuadrar todas las ubicaciones contra la hoja CUADRE y resolver lo que aparezca. 3. Congelar: el DIARIO del ejercicio se cierra y guardamos una copia.» — [MT] Unidad 10, ap. 3.',
  },
}
