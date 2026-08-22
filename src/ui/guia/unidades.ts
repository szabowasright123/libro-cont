/**
 * unidades.ts — catálogo de las «Unidades del manual» que se muestran en cada
 * pantalla (guía integrada, P8).
 *
 * Regla de oro 5: los textos del manual del taller NO se redactan en la app; son literales.
 * Los pegó el responsable (validados a 2026-08-06, ver docs/TEXTOS_MANUAL_RANURAS.md §4) en
 * el campo `texto` de cada unidad, con su cita. Se conserva la `pista` neutra como entradilla
 * y lo ESTRUCTURAL (a qué bloque pertenece la pantalla).
 *
 * El marcador `{{TEXTO-MANUAL}}` (MARCADOR_MANUAL) queda disponible como convención común de
 * la app, pero NO se usa en este catálogo: el recuadro `UnidadManual` pinta `texto` tal cual,
 * de modo que un marcador aquí acabaría impreso en la pantalla del alumno (ya pasó una vez).
 * Una unidad sin literal se deja con `texto: ''` —el propio tipo lo documenta— y el recuadro
 * enseña «pendiente del literal del manual» con su clave. Inventario:
 * `docs/PENDIENTE_TEXTOS.md` (sección «Guía integrada»).
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
  inicio: {
    clave: 'manual.inicio',
    bloque: 'Transversal · El método del taller',
    pista:
      'El recorrido completo del método, en orden: ubicaciones → parámetros → diario → cuadre y origen → archivo → fiscal.',
    // Pendiente del literal del manual (Regla de oro 5): la app no redacta la unidad. Vacío,
    // no MARCADOR_MANUAL, porque el recuadro pinta `texto` tal cual y el alumno vería el
    // marcador en pantalla; con la cadena vacía enseña el aviso de «pendiente del literal».
    texto: '',
  },
  diario: {
    clave: 'manual.diario',
    bloque: 'Bloque 2 · El Libro',
    pista: 'Registrar cada operación como un apunte del diario, en orden cronológico.',
    texto:
      '«Nuestra primera idea debe ser que el libro dice qué pasó y la carpeta lo prueba. Cada línea del libro apunta a su justificante; cada justificante está representado en una línea.» «Integridad. Se registra TODO movimiento, gravable o no. […] El criterio de qué anotar no es “¿tributa?” sino “¿movió valor?”.» «Correcciones auditables: […] el apunte original se conserva y la corrección entra como apunte nuevo de AJUSTE/RECTIFICACIÓN, con referencia al apunte corregido.» — [MT] Unidad 4, aps. 1-2 (principios 1 y 7) y Unidad 7, ap. 4.',
  },
  cartera: {
    clave: 'manual.cartera',
    bloque: 'Bloque 2 · Saldos y valoración',
    pista:
      'Qué tienes y dónde, a partir del diario: saldos por activo y ubicación, coste de la cola FIFO y valoración con TUS precios tecleados (la app nunca consulta cotizaciones).',
    // Pendiente del literal del manual (Regla de oro 5). Ver comentario de `inicio`.
    texto: '',
  },
  posiciones: {
    clave: 'manual.posiciones',
    bloque: 'Bloque 2 · Posiciones (DeFi)',
    pista:
      'Agrupa las patas de un mismo hecho económico —aportación, recompensas, retirada— para poder leerlas juntas. Es un índice sobre los apuntes: no altera SALDOS ni FIFO.',
    // Pendiente del literal del manual (Regla de oro 5). Ver comentario de `inicio`.
    texto: '',
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
  panel: {
    clave: 'manual.panel',
    bloque: 'Bloque 2 · El Libro',
    pista:
      'El Diario visto por el motor: cuánto hay, cuánto costó, si cuadra hacia fuera y si cuadra hacia dentro.',
    texto:
      '«El cuadre caza errores de cantidad, no de concepto. Una PERMUTA anotada como TRANSFERENCIA cuadra perfectamente, las cantidades son las mismas, y sin embargo ha hecho desaparecer una alteración patrimonial del cálculo fiscal.» «El error invisible siempre son dos errores: la ganancia que falta hoy y el coste sin causa que estallará en la venta de mañana.» Y la comprobación que lo caza: «Comprobar que la cola FIFO y el saldo dicen lo mismo activo por activo». La cola es única: «cada transmisión consume lotes por orden de antigüedad (primera entrada, primera salida), y consume de la cola única global del activo, sin distinguir en qué exchange o wallet estuviera cada lote». — [MT] Unidad 6, aps. 2 y 3, y Anexo D (checklist de cierre, 31 de diciembre).',
  },
  cierre: {
    clave: 'manual.cierre',
    bloque: 'Bloque 3 · Fiscalidad',
    pista:
      'Cerrar el ejercicio: el checklist del Anexo D, la foto de cierre, la conciliación con los datos fiscales y la memoria.',
    texto:
      '«Un ejercicio cerrado es un ejercicio en el que todas las casillas están marcadas y las que no aplican están marcadas como no aplicables, con su razón escrita. La diferencia entre “no lo hice” y “decidí no hacerlo, y aquí está por qué” es toda la diferencia ante una comprobación.» Y sobre la casilla que más pesa: «La memoria del ejercicio es la casilla que más rinde. Es una página, se escribe una vez al año y es el documento que un asesor, un heredero o el propio contribuyente dentro de cinco años leerá antes que ninguna otra cosa. Todo lo demás de esta lista se puede reconstruir con trabajo; el porqué de una decisión, no.» — [MT] Anexo D, presentación y cierre.',
  },
  fiscal: {
    clave: 'manual.fiscal',
    bloque: 'Bloque 3 · Fiscalidad',
    pista: 'Resumen anual orientativo por las cinco salidas del registro. No es asesoramiento ni declaración.',
    texto:
      '«Si las dos primeras partes se han hecho bien, el IRPF es un trámite de traslado. La teoría fiscal vive en el manual de Fiscalidad en Bitcoin, al que se remite; aquí está el gesto práctico: qué salida del registro va a qué apartado de Renta WEB, cómo se concilia el registro propio con lo que la AEAT ya sabe por terceros, y cómo se cierra y archiva un ejercicio.» «Los números de casilla y las pantallas cambian cada campaña. […] Los apartados y la lógica, qué renta va a qué base, cambian rara vez y con ley.» — [MT] Parte III, introducción.',
  },
  importar: {
    clave: 'manual.importar',
    bloque: 'Bloque 1 · Trazabilidad',
    pista:
      'Un explorador da movimientos, no operaciones: la cadena no sabe si un envío es traslado o transmisión. Lo decides tú.',
    texto:
      '«Conviene distinguir tres cosas que se confunden con facilidad y que tienen consecuencias fiscales opuestas: mover (cambiar de ubicación monedas propias, sin transmisión y sin hecho imponible, aunque con una comisión que sí sale del patrimonio), transformar (cambiar un activo por otro, que es permuta y sí es alteración patrimonial) y transmitir (entregar a un tercero a cambio de un precio o de un bien). En la cadena las tres se ven igual: una transacción con entradas y salidas. En el registro deben verse distintas, y de que se vean distintas depende que la declaración sea correcta.» Por eso «hay tres cosas que ninguna importación puede traer y que el alumno tiene que aportar siempre. La primera son los contravalores en euros de las operaciones que no tienen una pata en euros […]. La segunda es la calificación de las operaciones que el fichero de origen no distingue —una salida hacia una dirección propia y una venta a un tercero se exportan igual—. La tercera es el justificante: la importación puebla el libro, no la carpeta.» — [MT] Unidad 1, ap. 6, y Unidad 5, ap. 3.',
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
    pista: 'Los 12 tipos de operación, los activos y las tolerancias del cuadre.',
    texto:
      '«La plantilla no admite texto libre en la columna Tipo: admite doce valores, definidos en PARÁMETROS. Un catálogo cerrado obliga a decidir, y las decisiones difíciles son exactamente las que conviene tomar despacio y una sola vez, no improvisar en cada línea.» Y el motivo de la validación dura: «El cuadre caza errores de cantidad, no de concepto. Una PERMUTA anotada como TRANSFERENCIA cuadra perfectamente […] y sin embargo ha hecho desaparecer una alteración patrimonial del cálculo fiscal» (el «error invisible»). — [MT] Unidad 6, aps. 1-2.',
  },
  ajustes: {
    clave: 'manual.ajustes',
    bloque: 'Transversal · Puentes y copias',
    pista: 'Alternar con Excel/CSV sin pérdida y guardar/restaurar tu copia local.',
    texto:
      '«La foto de cierre. El 31 de diciembre y quince minutos que compran un año de tranquilidad: 1. Exportar el histórico completo de cada exchange del ejercicio y las etiquetas BIP-329 de cada wallet. 2. Cuadrar todas las ubicaciones contra la hoja CUADRE y resolver lo que aparezca. 3. Congelar: el DIARIO del ejercicio se cierra y guardamos una copia.» — [MT] Unidad 10, ap. 3.',
  },
}
