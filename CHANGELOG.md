# Changelog — Libro Hespérides

Todas las versiones notables de la app. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/); versionado
[SemVer](https://semver.org/lang/es/).

## [1.0.0] — 2026-08-06

Primera versión estable para el alumnado del Taller de Contabilidad, Trazabilidad y
Fiscalidad en Bitcoin (Universidad de las Hespérides, Ed. 2026). App web **local-first**:
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

### Pendiente de validación (no bloquea la v1.0)

- Convenciones fiscales marcadas `TODO-REVISION` (docs/DECISIONES.md, D1 y D2) y literales
  `{{TEXTO-MANUAL}}` (docs/PENDIENTE_TEXTOS.md): las revisa el responsable del taller.
- Autoría, licencia y URL del repositorio en «Acerca de» (marcadores `{{AUTOR}}`,
  `{{LICENCIA}}`, `{{REPO-URL}}` en `src/ui/acerca/datosAcerca.ts`).
