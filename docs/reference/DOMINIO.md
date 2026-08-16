# DOMINIO.md — Especificación del dominio (Libro Hespérides)

Extraído del plan maestro (6-8-2026) y de la PLANTILLA_TALLER.xlsx oficial del taller (fuente de verdad última: sus fórmulas). Este fichero vive en `docs/reference/` del repo y manda sobre cualquier otra interpretación.

Valores golden del mini-caso 2024 (docs/reference/mini_caso_generico.csv, 20 operaciones):
saldos totales a 31/12/2024 → BTC 0,4068 · ETH 1,049 · USDC 305 · EUR 4.254 · ADA 0 · TOKENX 0.

## 3. Modelo de datos

Extraído 1:1 de la PLANTILLA_TALLER.xlsx (verificada: 2.486 fórmulas, sin macros). Es la fuente de verdad del dominio.

### 3.1 Apunte (fila del DIARIO)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string `AAAA-NNN` (p. ej. `2026-001`) | Correlativo; el orden cronológico es obligatorio para FIFO |
| `fechaHora` | ISO local (convención: hora local española; UTC se convierte al cargar y se anota) | |
| `tipo` | uno de los **12 tipos del catálogo cerrado** (§3.3) | Validación dura |
| `ubicacionOrigen` / `ubicacionDestino` | ref. a UBICACIONES o `EXTERIOR` | |
| `activoSalida` + `cantidadSalida` | opcional según tipo | |
| `activoEntrada` + `cantidadEntrada` | opcional según tipo | |
| `comisionCantidad` + `comisionActivo` | opcional | Convención: se descuenta en ORIGEN; si origen = EXTERIOR, en destino |
| `contravalorEUR` | decimal | Obligatorio en tipos con relevancia fiscal; fuente de cotización en notas |
| `justificante` | ref. al Archivo (ruta convencional `01-adquisiciones/…`) | Enlaza Libro ↔ Archivo |
| `notas` / `rectificaA` | texto / ref. a apunte | AJUSTE exige `rectificaA` + causa (principio 7: correcciones auditables, U7.4) |

### 3.2 Ubicación

`nombre`, `tipo` (exchange / wallet / canal), `kyc` (sí/no — **la columna que vertebra el Bloque 1**), `fechaAlta`, `fechaCierre`, `notas`. `EXTERIOR` es la ubicación especial de frontera (rendimientos que entran, pagos que salen).

### 3.3 Catálogo cerrado de tipos (PARÁMETROS, Tabla 7 del manual)

Doce tipos desde la fase D6 (16-8-2026). Los once primeros son la Tabla 7 literal; el duodécimo lo añadió el autor al comprobar que los derivados liquidados por diferencias no encajaban en ninguno (ver `docs/DEFI_EVENTOS_COMPLEJOS.md` §7). El manual se actualiza aparte.

| Tipo | ¿Cuadra? | ¿Alteración? | ¿Abre lote? | ¿Consume lote? | Calificación fiscal |
|---|---|---|---|---|---|
| COMPRA | Sí | No | **Sí** | No | Sin hecho imponible; fija lote FIFO |
| VENTA | Sí | Sí | No | **Sí** | GyP patrimonial, base del ahorro |
| PERMUTA | Sí | Sí | **Sí** | **Sí** | Alteración: se transmite lo entregado; lo recibido nace a valor de mercado |
| TRANSFERENCIA | Sí (mismo activo ± comisión) | No | No | No | Sin hecho imponible; la comisión de red sí sale del patrimonio |
| RENDIMIENTO | No | Sí | **Sí** | No | RCM art. 25.2 LIRPF — V1766-22, V0612-26 |
| MINERÍA | No | Sí | **Sí** | No | Rendimiento de actividad económica |
| AIRDROP | No | Sí | **Sí** | No | Ganancia base general — DGT 0018-23 (no vinculante) |
| PAGO | Sí | Sí | No | **Sí** | Transmisión (como venta cuyo precio es la factura) |
| PÉRDIDA | No | Sí | No | **Sí** | Pérdida condicionada a requisitos y prueba (dualidad DGT) |
| DONACIÓN | Según sentido | Sí | Según | Según | Entregada: alteración en donante; recibida: ISD |
| AJUSTE/RECTIFICACIÓN | Según | Según | Según | Según | — (exige referencia y causa) |
| **LIQUIDACIÓN DE DERIVADO** | No | Sí | **Sí** | No | GyP patrimonial, base del ahorro (arts. 33.1 y 34; **no** art. 37.1.m, que alcanza solo a los mercados del RD 1814/1991) |

DONACIÓN y AJUSTE requieren decisión manual (la app pregunta); el resto se automatiza. LIQUIDACIÓN DE DERIVADO nunca tiene lado de salida: en una liquidación por diferencias no se entrega el subyacente, y si la posición se salda entregando un activo, esa entrega es una pata PAGO independiente.

**Dimensión DeFi (fase D1).** Cuatro campos opcionales del apunte —`evento`, `posicionId`, `protocolo`, `criterioAplicado`— y uno más para la zona gris, `contravalorAlternativoEUR`, nombran el hecho económico del que la pata procede sin alterar su tipo ni su calificación. Son ortogonales al catálogo: el motor sigue clasificando por `tipo`. Ver `docs/DEFI_EVENTOS_COMPLEJOS.md` §1.

**Comisiones en cripto (fase D0).** Una comisión pagada en un activo distinto de EUR reduce su cola —prorrateada entre los lotes vivos, no por orden FIFO— sin generar transmisión, y el coste retirado se traslada a la operación servida. Se aparta deliberadamente de la plantilla; ver `docs/COTEJO_F1.md`.

Además: **catálogo de activos** (editable; BTC y EUR de serie; regla de identidad: BTC ≠ WBTC ≠ saldo Lightning — activos o ubicaciones distintos) y **tolerancias del cuadre** (verde ≤ 1e-8, ámbar ≤ 0,001; configurables).

### 3.4 Justificante (el Archivo)

`id`, `apunteId`, `rutaConvencional` (carpetas `01-adquisiciones/`, `02-transferencias/`, `04-rendimientos/`…), `tipoDocumento`, `hashSHA256` (integridad probatoria), `fichero` (blob en IndexedDB, opcional) o solo referencia externa, `notas`. Cada tipo de operación tiene su **checklist probatoria** (qué documentos exige el manual para ese tipo — clave en PÉRDIDA y en adquisiciones no-KYC).

---

## 4. Motor de cálculo: reglas exactas (traducción de las fórmulas del Excel)

Estas reglas están extraídas de las fórmulas reales de la plantilla y son **la especificación del motor**. Cualquier discrepancia app↔Excel es un bug.

**SALDOS** (por ubicación × activo, a fecha de corte editable):
`saldo = entradas − salidas − comisiones`, donde entradas = Σ cantidadEntrada con destino=ubicación y activo, salidas = Σ cantidadSalida con origen=ubicación, y comisiones = Σ comisión con origen=ubicación (más las de origen EXTERIOR imputadas al destino). Solo apuntes con fecha ≤ corte. Saldo negativo ⇒ alerta roja: venta o salida sin origen registrado (Unidad 7). La app elimina el límite de 10 ubicaciones × 5 activos del Excel.

**FIFO** (cola ÚNICA global por activo, sin distinguir ubicación — criterio administrativo vigente: V0525-25, V0491-26, con la fórmula prudente del manual):
- Abren lote: COMPRA, PERMUTA (recibida), RENDIMIENTO, MINERÍA, AIRDROP. Coste del lote = contravalor EUR **+ comisión si es en EUR** (comisión de adquisición SUMA al coste).
- Consumen: VENTA, PERMUTA (entregada), PAGO, PÉRDIDA. Valor de transmisión neto = contravalor EUR **− comisión si es en EUR** (comisión de venta MINORA). Un consumo que abarca varios lotes toma el coste de los más antiguos, con troceo parcial de lote.
- Resultado por transmisión = valor neto − coste FIFO; totales de cola: adquirido, consumido, restante y su coste.
- Requiere DIARIO en orden cronológico (la app lo garantiza por construcción, cosa que el Excel solo puede suponer).
- La app supera al Excel: cola para **todos** los activos a la vez, desglose por lote visible, y GyP separadas por ejercicio fiscal.

**CUADRE** (semáforo, Tabla 5 del manual): por ubicación × activo, `dif = saldo real declarado − saldo calculado`; |dif| ≤ 1e-8 → **OK**, ≤ 0,001 → **REVISAR**, mayor → **ERROR**. El saldo real lo teclea el alumno desde la fuente (exchange, wallet).

**Validaciones al grabar apunte** (la mayor ventaja sobre el Excel): tipo obligatorio del catálogo; coherencia campos↔tipo (un RENDIMIENTO no tiene salida; una TRANSFERENCIA exige mismo activo ± comisión); contravalor obligatorio donde hay hecho imponible; fecha que rompa el orden → reordenación automática con aviso; venta sin saldo suficiente → aviso inmediato (en Excel solo se ve al final, en rojo); AJUSTE sin `rectificaA` → bloqueo.

**FISCAL** (Bloque 3, fase F7): agregación anual del motor — GyP de transmisiones (base del ahorro) con desglose por operación, RCM (RENDIMIENTO), actividad económica (MINERÍA, informativo), ganancias base general (AIRDROP), pérdidas pendientes de requisitos (PÉRDIDA con su estado probatorio), y mapa **orientativo** a casillas de Renta con disclaimer. Umbrales informativos: aviso 721 (>50.000 € en el extranjero, con las consultas del bloque U10.1) y modelo 172/173 para referencia.

---

