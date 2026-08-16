# ENCARGO — Reestructuración de la cabecera e importación desde exploradores

Encargo de trabajo para ejecutar con Claude Code en local. Criterio fijado por el autor el
16-08-2026; lo que sigue es implementación, no decisión doctrinal.

Fuentes de verdad: `CLAUDE.md` (reglas de oro), `docs/reference/DOMINIO.md`,
`docs/DEFI_EVENTOS_COMPLEJOS.md`.

---

## Parte 1 · Cabecera: de nueve pestañas a siete

Estructura pedida:

| Pestaña | Contiene |
|---|---|
| Inicio | — |
| Diario | — |
| Archivo | — |
| **Cartera** | Cartera · **Posiciones** (apartado independiente) |
| Trazabilidad | — |
| Fiscal | — |
| **Ajustes** | Ajustes · **Ubicaciones** · **Parámetros** (apartados independientes) |

Notas de implementación:

- Las páginas ya existen y **no se tocan**: es una capa de navegación por encima. `Posiciones`,
  `Ubicaciones` y `Parámetros` pasan de ser rutas de primer nivel a subapartados.
- `src/ui/shell/rutas.ts` ya distingue entre rutas de navegación principal y rutas secundarias
  accesibles por enlace directo (hoy solo `acerca`). Ese es el mecanismo a extender.
- **Conservar las rutas por hash existentes.** `#/posiciones`, `#/ubicaciones` y `#/parametros`
  deben seguir funcionando: hay enlaces internos y el alumno puede tenerlas guardadas. Que
  dejen de estar en la barra no significa que dejen de resolver.
- Sub-navegación sugerida: pestañas secundarias dentro de la página, no menús desplegables.
  El desplegable esconde y obliga a un clic extra en una app que se usa a diario.
- Comprobar el ancho en 1280 px: con siete pestañas debería sobrar sitio, que es parte del
  motivo del cambio.

---

## Parte 2 · Importación desde exploradores de bloques

### Criterio fijado: opción (a), sin llamadas de red

**La app NO consulta ninguna cadena ni ningún explorador.** El alumno descarga los CSV donde
quiera y los sube. La regla de oro 3 queda intacta y el texto del pie —«Local-first · tus datos
no salen de tu navegador»— sigue siendo cierto.

Descartada expresamente la consulta directa a un explorador: sería una llamada de red en
runtime y revelaría a un tercero la dirección del alumno y, con ella, todo su historial.

### Flujo del alumno

1. Localiza la totalidad de sus activos entre cadenas con una herramienta de cartera
   (DeBank o equivalente). **Fuera de la app.**
2. Cadena por cadena, descarga del explorador el CSV de transacciones de su dirección
   (Etherscan, BscScan, Arbiscan… todos comparten estructura).
3. Sube esos CSV a la app, que los convierte en **candidatos a apunte**.

### Lo que un CSV de explorador NO sabe — y es el núcleo del trabajo

Un explorador da **movimientos**, no operaciones. La importación **no puede producir apuntes
definitivos**, y presentarlos como tales sería el peor resultado posible: un Libro con
apariencia de completo y calificaciones inventadas.

Lo que falta en el CSV:

- **Si un envío es traslado o transmisión.** Depende de si la dirección de destino es también
  del alumno. El manual llama a esta confusión «la fuente más frecuente de errores en la
  contabilidad de carteras» (U3.3).
- **El contravalor en euros.** Etherscan da precio histórico en **dólares** y solo del activo
  nativo, no de cada token.
- **Cuál de los 12 tipos aplica.** Una salida de tokens puede ser VENTA, PERMUTA, PAGO,
  DONACIÓN o el aporte a un pool.
- **A qué evento DeFi pertenece la pata.** Eso lo sabe el alumno, no la cadena.

**Diseño obligado:** la importación produce una **bandeja de triaje** donde cada movimiento se
propone con lo que sí se puede deducir y el alumno confirma o corrige antes de que nada entre
en el Diario. Es además lo pedagógicamente correcto: el criterio de qué anotar lo pone el
alumno, que es lo que enseña el taller.

### Direcciones en Ubicaciones

Añadir a `Ubicacion` un campo de direcciones (varias por ubicación; una wallet tiene muchas).

Es lo que permite la única automatización fiable de todo esto: **si origen y destino son ambos
direcciones registradas del alumno, el movimiento es una TRANSFERENCIA** —traslado sin efecto
fiscal— y se puede proponer con confianza alta. Si solo una lo es, hay frontera con el exterior
y el alumno debe calificar.

**Decisión pendiente del autor:** si las direcciones entran o no en la copia JSON de seguridad.
Una dirección o un xpub es dato sensible; la copia se descarga y puede acabar en cualquier
sitio. Por defecto, incluirlas (la copia debe restaurar el Libro completo), pero avisarlo en
el diálogo de descarga.

### Reglas de mapeo desde el CSV

| Dato del CSV | Destino en el apunte |
|---|---|
| `DateTime (UTC)` | `fechaHora`, **convertido a hora local española** y anotado (DOMINIO §3.1) |
| `From` / `To` | `ubicacionOrigen` / `ubicacionDestino`, resueltos contra las direcciones registradas; `EXTERIOR` si no consta |
| `Value_IN(ETH)` / `Value_OUT(ETH)` | `cantidadEntrada` / `cantidadSalida` con `activo` = nativo de la cadena |
| `TxnFee(ETH)` | `comisionCantidad` + `comisionActivo` (en cripto: desde D0 prorratea, ver DEFI §8) |
| `Txhash` | `notas` y clave de deduplicación |
| `Status` / `ErrCode` | Las transacciones fallidas **no mueven valor pero sí gastan gas**: se importan solo por la comisión |

Detalles que muerden:

- **Los nombres de columna del precio son dinámicos**: `CurrentValue @ $1785.9/Eth` lleva la
  cotización incrustada. Hay que casar por prefijo, nunca por igualdad exacta.
- **Hacen falta varios ficheros por cadena.** La exportación normal trae solo el activo nativo;
  los tokens van en la exportación **ERC-20**, y hay una tercera de **internal txns** que
  recoge movimientos de contratos que de otro modo se pierden. Las cabeceras de esas dos hay
  que **confirmarlas contra una exportación real**, no darlas por supuestas: la de
  transacciones normales está verificada y es
  `Txhash, Blockno, UnixTimestamp, DateTime, From, To, ContractAddress, Value_IN(x), Value_OUT(x), CurrentValue @ $…, TxnFee(x), TxnFee(USD), Historical $Price/x, Status, ErrCode`.
- **BscScan, Arbiscan y las demás son el mismo formato** con el símbolo cambiado. El detector
  debe leer el símbolo de la cabecera, no codificar «ETH».

### Modo aditivo, no reemplazo

La importación actual (XLSX/CSV/JSON) **REEMPLAZA el Libro**. Esta no puede: se está añadiendo
una cadena a un Libro que ya tiene otras. Hace falta un modo **añadir** con:

- **Deduplicación** por `txhash` + índice dentro de la transacción. Reimportar el mismo fichero,
  o solapar las exportaciones normal y ERC-20 de la misma transacción, no debe duplicar nada.
- **Renumeración** al insertar en medio del orden cronológico: ya está resuelta en
  `src/data/numeracion.ts` y hay que apoyarse en ella, no reinventarla.

### Contravalor en euros

Sin llamadas de red no hay precios automáticos. El apunte importado nace **sin contravalor**, y
la validación existente ya bloquea los tipos con alteración patrimonial que no lo tengan: el
alumno lo verá como pendiente y tendrá que completarlo. Es correcto que sea así.

Mejora opcional: permitir importar un CSV de precios por fecha y activo, y ofrecer el
rellenado en bloque desde la bandeja de triaje. Sigue sin salir nada del navegador.

---

## Lo que NO debe hacerse

- Ninguna llamada de red en runtime, ni siquiera «solo para precios» o «solo si el alumno lo
  pide». Regla de oro 3.
- Ningún apunte que entre en el Diario sin que el alumno lo haya confirmado.
- Ninguna calificación fiscal inventada por heurística. La única deducción con confianza alta
  es TRANSFERENCIA entre direcciones propias registradas; el resto se propone y se pregunta.
- No tocar el motor (`src/engine/`) para esto: la importación es capa de datos y de UI.
- No modificar los golden tests.

## Orden sugerido

1. Cabecera (Parte 1). Independiente y de riesgo bajo; deja la app usable mientras se hace lo demás.
2. Campo de direcciones en `Ubicacion` + migración Dexie.
3. Lector de CSV de explorador con detección de cadena y de tipo de exportación.
4. Bandeja de triaje con resolución de direcciones propias.
5. Alta en modo aditivo con deduplicación.

Cada paso, con sus tests y con `npm test` en verde antes de pasar al siguiente.
