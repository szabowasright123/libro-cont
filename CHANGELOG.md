# Changelog — Libro Hespérides

Todas las versiones notables de la app. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/); versionado
[SemVer](https://semver.org/lang/es/).

## [1.3.0] — 2026-08-15

El CUADRE por fin tiene pantalla y el trabajo del alumno queda protegido frente a purgas del
navegador. El **motor** sigue intacto: la nueva vista LEE `engine/cuadre.ts` (que existía y
estaba testeado desde P1) sin tocarlo.

### Pantalla del CUADRE (semáforo de la Tabla 5) — P11

- Nueva sección **«Cuadre (semáforo)»** en la página *Trazabilidad y cuadre*: por cada celda
  (ubicación × activo) el alumno teclea el **saldo real** leído en su fuente (exchange,
  wallet, canal) y ve la diferencia contra el saldo calculado, clasificada OK / REVISAR /
  ERROR según las tolerancias (editables en Parámetros). Chips de resumen y celdas «sin
  declarar»; entrada con coma o punto; borrar la casilla quita la declaración.
- Los saldos declarados se guardan en `cuadreReal` (que ya viajaba en la copia JSON desde P4)
  vía el nuevo `repositorio.guardarSaldoRealDeclarado` (upsert por celda).
- El **caso de ejemplo** llega con las 6 celdas con saldo declaradas y el semáforo en verde:
  editar una celda en clase enseña el ámbar y el rojo en vivo.
- El paso 4 de Inicio («Cuadra y sigue el origen») describe ahora el semáforo.

### Protección del trabajo del alumno — P11

- **Almacenamiento persistente:** al abrir la base se solicita `navigator.storage.persist()`
  (mejor esfuerzo, sin bloquear); Ajustes → Copia de seguridad muestra si está concedido.
- **Recordatorio suave de copia:** banner en Inicio cuando nunca se descargó copia y ya hay
  ≥ 10 apuntes, cuando hay ≥ 20 apuntes nuevos desde la última, o cuando la última copia
  tiene ≥ 30 días y el Libro cambió. Nunca con la demo cargada; descartable por sesión. La
  lógica es pura y testeada (`src/data/copias.ts`); al descargar la copia JSON se registra la
  marca (fecha + nº de apuntes), visible en Ajustes.

## [1.2.0] — 2026-08-15

Caso de ejemplo COMPLETO (fase P10): el botón de Inicio pasa a llamarse **«Cargar caso de
ejemplo»** (sin paréntesis) y carga una historia en dos capítulos pensada para que TODA la app
se vea con datos. El **motor** y los **golden tests** siguen intactos.

### Caso de ejemplo completo 2024–2025 (P10)

- **Capítulo 2024 = mini-caso golden, verbatim** (Regla de oro 9): mismos 19 apuntes y mismos
  saldos a 31/12/2024 (BTC 0,4068 · ETH 1,049 · USDC 305 · EUR 4.254). El puente de igualdad
  estructural (`tests/demo/caso-demo.test.ts`) ahora garantiza que el capítulo 2024 no diverge
  del golden y que Kraken/Ledger conservan sus campos originales.
- **Capítulo 2025 (10 apuntes nuevos):** compra grande de BTC, venta de ETH **con pérdida de
  transmisión**, apertura de un **canal Lightning** (ubicación tipo «canal»), un **PAGO** por
  Lightning con factura, una **DONACIÓN entregada**, dos RENDIMIENTOS (lending USDC y earn
  BTC) y un **AJUSTE/RECTIFICACIÓN** auditable con `rectificaA`. Con esto el Diario muestra
  los 11 tipos del catálogo con relevancia práctica.
- **La lección del 721 con doble fecha:** Kraken pasa a ficha ampliada (extranjero · Irlanda ·
  vía exchange-KYC); Ledger y el canal, a **autocustodia**. A 20/10/2025 el saldo extranjero
  valorado (con BTC a 100.000 €) **supera** los 50.000 €; el 12/11 el alumno retira 0,5 BTC a
  autocustodia y el corte normativo de 31/12 queda **por debajo** del umbral.
- **Archivo sembrado al 100%:** 62 justificantes de demostración (referencias externas, sin
  ficheros) que dejan los 29 apuntes con expediente probatorio completo — el «expediente
  modelo» del taller, con la rama KYC/no-KYC que corresponde a cada tipo — más un certificado
  anual en la carpeta 05 (documento de ejercicio, sin apunte).
- **Subtipo de la pérdida:** el phishing de 2024 se clasifica como **estafa** (capa de datos).
- **Cartera/Fiscal:** GyP por ejercicio con 2024 positivo y **2025 negativo** (−67,64 €), dos
  ejercicios en el selector de Fiscal (mapas de casillas 2024 y 2025) y trazabilidad de Ledger
  en «mezcla» (0,785 KYC + 0,002 no-KYC).
- Textos actualizados en Inicio/Ajustes; e2e de Cartera adaptado a los nuevos valores
  (93.062,12 € con los precios de demostración).

### Ficha «Acerca de» completada — sin marcadores

- **Repositorio publicado:** `REPO_URL` apunta ya a
  <https://github.com/szabowasright123/libro-cont>. Con ello desaparece el último marcador
  visible de la app (`{{REPO-URL}}`).
- **Web y contacto del autor:** nuevas filas «Web del autor»
  (legelbitcoin.com · [@Javibrd](https://x.com/Javibrd)) y «Contacto» (javier@legel.es, para
  consultas y licencias de uso profesional), con sus constantes `WEB`, `RED_SOCIAL`,
  `RED_SOCIAL_ETIQUETA` y `CONTACTO` en `src/ui/acerca/datosAcerca.ts`. Si alguna es `null`,
  la fila simplemente no se muestra.
- **Estado de los textos del manual:** todas las ranuras `{{TEXTO-MANUAL}}` quedaron
  rellenadas el 6-8-2026 y las convenciones D1/D2 validadas el 8-8-2026. No queda ningún
  marcador pendiente en `src/` (las constantes `MARCADOR_TEXTO`/`MARCADOR_MANUAL` siguen
  existiendo como respaldo para textos futuros).

## [1.1.0] — 2026-08-08

Identidad visual propia, visión de cartera y onboarding con un clic (fase P9). El **motor**
(`src/engine`) y los **golden tests** del mini-caso 2024 quedan intactos; todo lo nuevo vive
en capas de datos/UI que **leen** los resultados del motor. Sigue siendo **local-first**: cero
llamadas de red en runtime.

### Licencia

- El proyecto se publica bajo la **Personal Use Source License v1.0 (PUSL-1.0)**: código
  fuente público, gratuito para uso personal; el uso profesional, empresarial o
  institucional requiere licencia independiente (javier@legel.es). Ver `LICENSE`.

### Identidad visual «naranja sutil» (P9.1)

- Nueva paleta: base neutra cálida (`stone`) + **naranja bitcoin como acento** (`brand`) en
  logo, pill activa del menú, números de paso, enlaces/CTA y focus ring. El semáforo del
  CUADRE no cambia.
- Cabecera con icono de la app + wordmark y menú tipo *pill bar*; página de inicio con kicker
  y pasos acentuados. Icono de la PWA sobre base `#1c1917` (PNG regenerados) y `theme-color`
  coherente.

### Nueva pestaña «Cartera» (P9.2)

- Vista de cartera **local-first con precios manuales** (prohibida cualquier cotización por
  red): valor estimado, coste FIFO restante, GyP realizada del ejercicio y **plusvalía latente
  (cripto)** «no realizada — no tributa aún». Todo sale del motor + el precio que teclea el
  alumno; nueva tabla Dexie `precios`.
- Gráficos SVG propios (donut de distribución y barras de GyP por ejercicio) con colores fijos
  por entidad, y tabla de posiciones con precio editable en línea.

### Caso de ejemplo con un clic (P9.3)

- Botón «Cargar caso de ejemplo (mini-caso 2024)» en Inicio (con precios de demostración) y
  «Borrar caso de ejemplo» en Ajustes; aviso mientras la demo está cargada. Un test garantiza
  que el dataset de la demo no diverge del golden.

### Derivadas de la validación D1/D2 (P9.4)

- **Pérdidas → BASE GENERAL:** el resumen fiscal rotula las pérdidas como «posible pérdida
  patrimonial en BASE GENERAL, condicionada al expediente probatorio» (nunca ahorro), y el
  formulario de PÉRDIDA pide el **subtipo** (error/extravío · robo · estafa) con su aviso de
  criterio y checklist probatorio; los apuntes antiguos se migran a «sin clasificar».
- **Aviso 721:** lista-semilla de entidades para **sugerir** (no imponer) la marca extranjero,
  **exclusión de la autocustodia** del cómputo, y **doble fecha** (estimación a 20-oct y corte
  normativo a 31-dic).

## [1.0.0] — 2026-08-06

Primera versión estable para el alumnado del Taller de Contabilidad, Trazabilidad y
Fiscalidad en Bitcoin (Ed. 2026). App web **local-first**:
los datos del alumno nunca salen de su navegador.

### Añadido en esta versión (P8 · Pulido y v1.0)

- **PWA completa e instalable.** Service worker que precachea todo el build
  (estrategia cache-first): la app funciona **100 % sin conexión**, en modo avión, y es
  instalable en escritorio y móvil. Aviso no intrusivo de «nueva versión disponible»
  (el alumno decide cuándo recargar) y de «lista sin conexión». Iconos PNG 192/512 y
  *maskable*.
- **Guía integrada.** La página de inicio presenta el método del taller como un recorrido
  clicable de seis pasos (ubicaciones → parámetros → registrar → cuadrar → archivar →
  fiscal) con recuento en vivo. Cada pantalla muestra un recuadro plegable «Unidad del
  manual» con marcador `{{TEXTO-MANUAL}}` para el literal del manual (Regla 5).
- **Accesibilidad del DIARIO por teclado** (para quien viene de Excel): flechas ↑/↓ mueven
  la fila activa, Inicio/Fin saltan a los extremos, Enter edita y Esc deselecciona; foco
  visible, cabecera fija, `<caption>` y ARIA en la tabla.
- **Rendimiento.** Tabla del DIARIO virtualizada (solo se pintan las filas visibles): con
  5.000 apuntes el recálculo completo del motor (SALDOS + FIFO + TRAZABILIDAD) tarda
  ~110 ms (< 500 ms exigido), verificado por test.
- **E2E del camino crítico** (Playwright): alta de ubicaciones → 5 apuntes de tipos
  distintos → panel → export JSON → borrar → restaurar → mismos números; y el ciclo XLSX;
  y la navegación por teclado con virtualización. Se ejecutan en CI.
- **Página «Acerca de»**: versión, autoría, licencia, repositorio y declaración de
  privacidad (tus datos no salen de tu navegador).
- Correcciones: el aviso PWA ya no intercepta clics ni tapa los diálogos.

### Incluido de fases anteriores (resumen)

- **Motor contable** (`src/engine`, TypeScript puro y determinista): aritmética exacta con
  `decimal.js`, 11 tipos de operación cerrados, SALDOS, FIFO en cola única global por
  activo, CUADRE con semáforo y validaciones. Golden tests del mini-caso 2024 intocables.
- **El Libro**: capa de datos sobre IndexedDB (Dexie) con correlativo AAAA-NNN y
  renumeración automática; UI de registro con formulario dinámico por tipo.
- **Puentes con Excel y CSV**: import/export XLSX conservando las fórmulas de la plantilla,
  import de CSV genérico y copia de seguridad JSON nativa.
- **El Archivo** probatorio: justificantes con SHA-256, checklists por tipo e informe de
  completitud.
- **Trazabilidad** KYC / no-KYC: cartera por origen reconciliada con SALDOS e informes de
  cadena probatoria imprimibles.
- **Módulo fiscal** (orientativo): resumen anual por cajones reconciliado con el FIFO, mapa
  a casillas, avisos 721 y 172/173. Toda calificación fiscal queda como `{{TEXTO-MANUAL}}`.

### Pendiente de validación en su día (no bloqueaba la v1.0) — CERRADO

> Los dos puntos siguientes quedaron resueltos después: los literales del manual el
> 6-8-2026, las convenciones D1/D2 el 8-8-2026 y la ficha «Acerca de» el 15-8-2026
> (ver la entrada 1.3.0).

- Convenciones fiscales marcadas `TODO-REVISION` (registro de decisiones, D1 y D2) y literales
  `{{TEXTO-MANUAL}}` (docs/PENDIENTE_TEXTOS.md): las revisa el responsable del taller.
- Autoría, licencia y URL del repositorio en «Acerca de» (marcadores `{{AUTOR}}`,
  `{{LICENCIA}}`, `{{REPO-URL}}` en `src/ui/acerca/datosAcerca.ts`).
