# DEFI_EVENTOS_COMPLEJOS.md — Catálogo de eventos DeFi y su integración en el Libro

Documento de diseño. Estado: **validado por el autor del manual** (ver §11). Sin cuestiones bloqueantes abiertas.
Fecha: 16 de agosto de 2026 · Versión de la app: v1.3.0

Fuentes de verdad, por este orden: `PLANTILLA_TALLER.xlsx` → `docs/reference/DOMINIO.md` → MANUAL DE FISCALIDAD BITCOIN (Ed. 2026), Unidades 3 y 4 → doctrina DGT citada. Cuando este documento y el manual discrepen, manda el manual.

---

## 0. El problema y el principio rector

El Libro nació para la **custodia al contado**: compras, ventas, permutas, traslados y rendimientos sobre activos que el titular tiene. DeFi rompe ese supuesto de tres maneras:

1. **Un solo hecho económico produce varias patas fiscales a la vez.** Aportar a un pool es, en la tesis prudente, dos permutas *y* abre una fuente de rendimientos. El manual lo dice expresamente para el staking líquido y para los pools: «conviven dos capas fiscales […] ambas deben registrarse por separado» (U4.1.2 y U4.5).
2. **Aparecen activos nuevos que no son el subyacente.** rETH no es ETH; el LP token no es ni ETH ni USDC; WBTC no es BTC. Cada uno es un elemento patrimonial con su propia cola FIFO.
3. **Hay posiciones sin activo entregado.** Un perpetuo liquidado por diferencias genera renta sin que salga ningún lote de la cartera.

### Principio rector: descomposición en patas, no ampliación del catálogo

La regla de oro 7 del proyecto (catálogo cerrado de 11 tipos, Tabla 7 del manual) **no se toca**. La vía de integración es la contraria:

> Todo evento DeFi se descompone en una o varias **patas**, y cada pata es un apunte de uno de los 11 tipos existentes. Lo que se añade no son tipos, sino **una dimensión ortogonal** que agrupa las patas y nombra el evento del que proceden.

Esta elección tiene tres ventajas y conviene enunciarlas porque justifican todo lo que sigue:

- El motor (`src/engine/`) no cambia de contrato: sigue clasificando por `tipo`, sigue aplicando FIFO en cola única y sigue produciendo el mismo CUADRE. Los golden tests siguen pasando sin tocarlos.
- La calificación fiscal permanece donde el manual la puso. Un RENDIMIENTO es RCM porque es RENDIMIENTO, venga de un pool o de un exchange centralizado.
- El día que la DGT cambie de criterio sobre, por ejemplo, la entrada al pool, se cambia la **plantilla de descomposición** de ese evento, no el motor.

La única familia que no se deja descomponer con los 11 tipos son los **derivados liquidados por diferencias**. Está tratada aparte en §7 y es la única decisión de este documento que exige una resolución del autor antes de escribir código.

---

## 1. Modelo de datos: lo que hay que añadir

Cuatro campos nuevos en el apunte, todos opcionales, ninguno con efecto sobre el motor de cálculo actual:

| Campo | Tipo | Para qué |
|---|---|---|
| `evento` | `EventoDeFi \| null` | Etiqueta del hecho económico del que la pata forma parte (ver §2). Puramente descriptiva a efectos de motor; vertebra la UI, el Archivo y los informes. |
| `posicionId` | `string \| null` | Agrupa todas las patas de una misma posición a lo largo del tiempo (aportación → recompensas → retirada). Es lo que permite reconstruir una posición abierta y calcular su resultado al cerrarla. |
| `protocolo` | `string \| null` | Nombre del protocolo (Aave, Lido, Uniswap v3…). Necesario para la prueba y para el modelo 721. |
| `criterioAplicado` | `string \| null` | Cuál de las dos lecturas posibles se ha aplicado en los supuestos sin criterio administrativo (ver §9). Obligatorio cuando el evento está marcado como *zona gris*. |

Dos entidades nuevas:

**`Posicion`** — `id`, `protocolo`, `tipoPosicion` (staking / lending / pool / vault / derivado / locking), `fechaApertura`, `fechaCierre`, `estado` (abierta / cerrada / liquidada), `activosAportados[]`, `notas`. No participa en SALDOS ni en FIFO: es un índice sobre los apuntes.

**Catálogo de activos derivados** — extensión de la regla de identidad ya presente en DOMINIO.md §3.3 («BTC ≠ WBTC ≠ saldo Lightning»). Cada activo derivado declara su `subyacente` y su `naturaleza` (envoltorio / recibo de posición / token de deuda / token de gobernanza). El subyacente es informativo: **no** funde colas FIFO.

### Regla de identidad de activos (crítica)

`ETH`, `stETH`, `rETH`, `WETH` y `UNI-V2-ETH/USDC` son **cinco activos distintos**, con cinco colas FIFO independientes. Esto no es una opción de diseño: se deriva de que cada canje entre ellos es, en la tesis prudente del manual, una permuta del art. 37.1.h LIRPF. Si se fundieran las colas, el resultado de la permuta desaparecería.

---

## 2. Catálogo de eventos DeFi

Trece eventos, agrupados por familia. Para cada uno: qué es, cómo tributa y con qué apoyo, y en qué patas se descompone.

### Familia A · Cesión de capitales

#### A1. STAKING_CENTRALIZADO — staking a través de plataforma

Tributación: las recompensas son **rendimiento del capital mobiliario del art. 25.2 LIRPF**, base del ahorro, valoradas a mercado en euros el día de su percepción (rendimiento en especie, art. 43.1). Sin gastos deducibles (art. 26 LIRPF; V0648-24). Criterio: V1766-22, consolidado por **V0612-26**.

Imputación: **cuando la recompensa está disponible**, no cuando se genera. La V0612-26 aplica el art. 14.1.a LIRPF: el rendimiento se obtiene cuando las criptomonedas «se acrediten a favor del consultante en un monedero o cuenta del que éste pueda disponer». Si el protocolo las acredita automáticamente, se imputa ahí aunque el titular no haga nada; si exigen *claim*, se imputa con el *claim*.

Patas:

| Momento | Tipo | Observaciones |
|---|---|---|
| Bloqueo de tokens | *ninguna*, o TRANSFERENCIA | Solo si cambia la ubicación. No hay alteración patrimonial: el titular sigue siéndolo. |
| Recompensa acreditada | **RENDIMIENTO** | Abre lote FIFO al valor de mercado imputado. Fecha = fecha de disponibilidad. |
| Desbloqueo | *ninguna*, o TRANSFERENCIA | |

#### A2. STAKING_NATIVO — nodo propio o delegación

Idéntico a A1 en calificación (U4.1.3 del manual: la delegación genera RCM tanto para el delegante como para el validador que recibe la delegación). La distinción PoW/PoS es la que separa actividad económica de RCM: si hay ordenación de medios por cuenta propia (minería PoW), es actividad económica del art. 27.1 → tipo **MINERÍA**.

Zona de frontera a vigilar: un validador propio con hardware dedicado y ánimo de empresa puede cruzar a actividad económica. La app debe preguntarlo una vez por ubicación, no por apunte.

#### A3. STAKING_LIQUIDO — se entrega ETH, se recibe rETH/stETH

**Dos capas fiscales**, y el manual es explícito (U4.1.2): la DGT trata cada canje como una **permuta del art. 37.1.h LIRPF**, generadora de ganancia o pérdida patrimonial, y las recompensas siguen siendo RCM.

Patas:

| Momento | Tipo | Observaciones |
|---|---|---|
| Entrada (ETH → rETH) | **PERMUTA** | Consume lote de ETH, abre lote de rETH. GP a base del ahorro. |
| Recompensas explícitas | **RENDIMIENTO** | Solo si el protocolo acredita tokens adicionales. |
| Salida (rETH → ETH) | **PERMUTA** | Consume lote de rETH, abre lote de ETH. |

**Caso especial — tokens de rebase de valor** (stETH que no cambia de cantidad pero sí de valor relativo, o rETH cuyo valor crece frente a ETH): aquí no hay acreditación de tokens nuevos, luego no hay RCM que imputar periódicamente; toda la renta aflora en la permuta de salida como mayor valor de transmisión del rETH. Frente a los tokens de rebase *de cantidad* (el saldo crece), donde sí hay acreditación imputable. **La app debe distinguirlos en el catálogo de activos**, porque el tratamiento periódico es opuesto. Ninguna consulta resuelve esto expresamente: es zona gris (ver §9).

El propio manual advierte que la materia «no es pacífica» y anticipa modificaciones sustanciales.

### Familia B · Préstamo

#### B1. LENDING_PRESTAMISTA — se presta cripto y se cobran intereses

Tributación, según U3.3.2 del manual (préstamo en especie, arts. 1740 y 1753 CC): tesis neutra. **Entrega sin efecto fiscal, devolución sin efecto fiscal, y los intereses son RCM** (V0648-24, que confirma la calificación para el lending de criptomonedas).

Tres límites que el manual subraya y que la app debe convertir en avisos:

1. No hay consulta de la DGT que resuelva expresamente la neutralidad de la entrega. Tesis fundada, **no confirmada**.
2. Si lo devuelto no es «otro tanto de la misma especie y calidad» —devolución en otra cripto, en euros o en un token derivado— no hay mutuo neutro sino **permuta o dación en pago**, con alteración patrimonial plena.
3. Si el prestatario no devuelve, la operación sale del régimen del préstamo y entra en el de los créditos vencidos y no cobrados del **art. 14.2.k LIRPF**, con su regla especial de imputación temporal.

Patas:

| Momento | Tipo | Observaciones |
|---|---|---|
| Entrega al protocolo | **TRANSFERENCIA** | A una ubicación que represente el protocolo. Sin efecto fiscal. La comisión de red sí sale del patrimonio. |
| Interés cobrado | **RENDIMIENTO** | RCM, base del ahorro, sin gastos deducibles. |
| Devolución | **TRANSFERENCIA** | Solo si es el mismo activo y la misma cantidad. |
| Devolución en activo distinto | **PERMUTA** | Salta el aviso del límite 2. |
| **Ejecución de la garantía** | **COMPRA** | Ver abajo. Valor de adquisición = valor de mercado del colateral **en la fecha de la ejecución**. |
| Impago sin garantía | **PÉRDIDA** | Con el régimen del art. 14.2.k: no computable hasta que concurra una de las tres circunstancias. |

> **Criterio del autor (16-08-2026).** La neutralidad del lado del prestamista se mantiene **salvo que se ejecute la garantía**. Cuando el prestamista se queda con el colateral, esa adquisición es una **COMPRA**, y el valor de adquisición que abre el lote FIFO es el valor de mercado del activo en el momento de la ejecución —no el importe del crédito impagado ni el valor que tuviera al constituirse la garantía—.
>
> La consecuencia práctica es doble y conviene que la app la haga visible: el prestamista incorpora un activo con base actualizada, y el crédito impagado deja de seguir el camino del art. 14.2.k porque ha sido satisfecho en especie. La ejecución cierra la operación en lugar de abrir la espera de las tres circunstancias.

Nota sobre los *receipt tokens* (aUSDC de Aave, cTokens de Compound): si el protocolo entrega un token que representa la posición, la operación deja de parecerse a una entrega neutra y se aproxima al esquema del staking líquido. La tesis prudente los trata como permuta. Es zona gris.

#### B2. LENDING_PRESTATARIO — se pide prestado aportando colateral

Tributación (U3.3.2 y U4.3 del manual):

- **Aportación del colateral: traslado en garantía, no transmisión.** El deudor sigue siendo propietario. Sin efecto fiscal.
- **Recepción del principal: no es renta.** Es un pasivo.
- **Intereses pagados: no deducibles.** En la gestión patrimonial privada del IRPF no hay cauce para restar el coste financiero de la inversión especulativa.
- **Ejecución del colateral por impago: transmisión plena.** Es una dación en pago forzosa. El deudor realiza ganancia o pérdida por diferencia entre el importe de la deuda cancelada (valor de transmisión) y el valor de adquisición FIFO del activo entregado.

Patas:

| Momento | Tipo | Observaciones |
|---|---|---|
| Aportar colateral | **TRANSFERENCIA** | Traslado en garantía. Marcar la posición como colateralizada. |
| Recibir el principal | **COMPRA** a valor de mercado | Ver el aviso de abajo. Abre lote; la contrapartida no es EUR, es la deuda. Sin hecho imponible. |
| Pagar interés en cripto | **PAGO** | Doble efecto: el interés no es deducible **y** entregar cripto para pagarlo es una transmisión que consume FIFO y genera su propia GP. |
| Devolver el principal | **PAGO** | Consume el lote. Ver el aviso de abajo. |
| Recuperar el colateral | **TRANSFERENCIA** | Nunca salió del patrimonio. |
| **Liquidación forzosa** | **PAGO** | Transmisión. Valor de transmisión = deuda cancelada. Aviso rojo en la app: es un hecho imponible que el usuario no espera. |

El manual llama la atención sobre esto último con razón: «quien apalanca su cartera debe saber que una liquidación de colateral es un hecho imponible».

> **Criterio del autor (16-08-2026): la recepción del principal es neutra, pero abre lote con valor de adquisición.**
>
> No hay implicación fiscal en la recepción —no es renta, no hay hecho imponible—, y sin embargo el activo recibido **sí tiene valor de adquisición**: el equivalente en euros de lo recibido **en el momento de recibirlo**. Recibir 10.000 USDC abre un lote de 10.000 USDC cuyo coste es su contravalor en euros ese día.
>
> Es exactamente el comportamiento del tipo **COMPRA** del catálogo: sin hecho imponible, fija lote FIFO. Con esto se resuelve el problema que motivaba la pregunta: si el prestatario vende después esos USDC, la ganancia se calcula contra un coste real y no contra cero.
>
> *Nota: la validación cubre expresamente la recepción. La pata de devolución sigue la recomendación previa —**PAGO**, que consume el lote—, con la consecuencia de que la variación de valor del activo entre la recepción y la devolución aflora como ganancia o pérdida patrimonial. Si la intención era neutralidad plena también en la devolución, hay que decirlo: cambia el resultado y el modelado.*

**Antecedente de la cuestión** (se conserva porque explica por qué se preguntó):
>
> La tesis neutra del manual (U3.3.2) está construida desde la posición del **prestamista**: no realiza valor alguno porque recupera exactamente la misma cantidad de la misma especie. Del lado del prestatario el razonamiento no se traslada sin más, porque el art. 1753 CC dice que quien recibe en préstamo cosa fungible **adquiere su propiedad**.
>
> Modelar la recepción del principal como TRANSFERENCIA —que fue mi primer impulso— produce un error de cálculo grave: TRANSFERENCIA no abre lote FIFO, de modo que si el prestatario vende después esos 10.000 USDC prestados, el motor computaría una ganancia por el **100 %** del importe, sin coste de adquisición. Simétricamente, devolver el principal como TRANSFERENCIA dejaría en la cola un lote fantasma que nunca se consume.
>
> Por eso la propuesta usa COMPRA a valor de mercado en la entrada y PAGO en la devolución: el par abre y cierra el lote, el resultado neto tiende a cero si el activo no se ha movido de precio, y aflora la diferencia si sí lo ha hecho —que es económicamente lo que ocurre cuando se devuelve un fungible que ahora vale otra cosa.
>
> Es una construcción **fundada pero no confirmada**, y con una consecuencia que conviene ver: hace tributar la variación de valor del activo prestado. Si la tesis correcta fuera la plena neutralidad también para el prestatario, habría que modelarlo de otro modo. **Requiere criterio del autor antes de implementarse** y, entretanto, `criterioAplicado` obligatorio. Es la segunda decisión abierta de este documento, después de §7.

### Familia C · Provisión de liquidez

#### C1. POOL_APORTACION — se depositan dos activos y se recibe un LP token

Tributación: **la DGT no se ha pronunciado** sobre si la recepción del LP token es en sí un hecho imponible. Conviven dos lecturas (U4.5):

- **Prudente:** cada canje entre los activos y el LP token es una permuta del art. 37.1.h → GP en base del ahorro.
- **Benévola:** el LP token es un simple resguardo; no hay alteración hasta la retirada.

> **Criterio del autor (16-08-2026): se implementa la BENÉVOLA por defecto.** La app debe **advertir siempre** de que existen las dos lecturas y permitir recalcular bajo la prudente, registrando la elección en `criterioAplicado`.

Consecuencias de esta elección, que son de calado y conviene enunciarlas:

**a) La aportación no es un hecho imponible.** No hay permuta, no se consumen lotes y no se abre lote de LP token. Los activos aportados no salen del patrimonio: se trasladan.

Pata: **una TRANSFERENCIA por activo aportado**, con destino a la ubicación que representa el pool. Sin efecto fiscal, con el CUADRE siguiendo el saldo por ubicación.

**b) Desaparece el problema de modelado.** Con la tesis prudente había que partir la aportación en dos permutas y repartir el LP token en proporción al contravalor de cada activo. Con la benévola eso ya no hace falta: **el LP token no es un activo con cola FIFO**, sino un resguardo. Entra en el catálogo de activos marcado como *no computable*, únicamente para que la posición sea reconstruible y para que el usuario vea en Cartera lo que tiene.

Es un beneficio secundario nada menor: la tesis benévola es además la que produce el registro más simple y la que no ensucia las colas FIFO con lotes de un token que nadie negocia.

**c) El hecho imponible se traslada íntegro a la retirada**, y allí se calcula por diferencia entre lo aportado y lo recuperado (ver C3).

**d) Queda un caso que la tesis benévola debe resolver: la venta del LP token sin retirar.** Si el titular transmite el resguardo a un tercero en lugar de canjearlo por los subyacentes, hay transmisión y hace falta un valor de adquisición.

La salida de Vikay —recalificar retroactivamente la aportación como permuta— no sirve: haría depender la calificación de un hecho pasado de un hecho futuro y ajeno (Anexo A, punto f). La solución coherente con la tesis benévola es tratar la venta del LP **como transmisión de la posición subyacente**: se consumen los lotes FIFO de los activos aportados que siguen representados por ese resguardo, y el valor de transmisión es el precio obtenido por el LP. El resguardo nunca llega a tener coste propio, que es justo lo que sostiene la tesis benévola.

#### C2. POOL_RECOMPENSA — comisiones de intercambio e incentivos

**RCM del art. 25.2 LIRPF**, base del ahorro, valorado a mercado el día en que el titular puede disponer de ellos, sin gastos deducibles. Es la respuesta expresa de la **V0648-24** para pools de liquidez y para plataformas de optimización de rendimientos (*yield farming*).

Pata: **RENDIMIENTO**, con `posicionId` apuntando al pool. Se imputa con independencia de que se reinviertan o se pasen a euros.

#### C3. POOL_RETIRADA — se canjea el LP token por los subyacentes

Aquí es donde, bajo la tesis benévola, aflora todo. El cálculo se hace **por diferencia entre lo aportado y lo recuperado, activo a activo**:

1. Para cada activo, `neto_i = cantidad_recuperada_i − cantidad_aportada_i`.
2. Los activos con `neto_i < 0` han salido del patrimonio: son la **entrega**.
3. Los activos con `neto_i > 0` han entrado: son la **contraprestación**.
4. Se registra una **PERMUTA** entre unos y otros. Los activos cuyo neto es cero no generan apunte alguno: nunca dejaron de ser del titular.
5. Vuelta de los saldos: **una TRANSFERENCIA por activo** desde la ubicación del pool, para que el CUADRE cierre.

En el ejemplo de §C6 —entran 10 ETH + 30.000 DAI, salen 5 ETH + 60.000 DAI— el resultado es **una sola permuta: 5 ETH por 30.000 DAI**. Los otros 5 ETH y los 30.000 DAI iniciales no se tocan: siguen en la cartera, con su antigüedad y su coste FIFO intactos.

Esto es exactamente lo que persigue la tesis benévola, y es también lo que hace desaparecer el artefacto que denunciaba Vikay: no se computa una transmisión de activos que el titular conserva.

Cuando el pool tenga **más de dos activos** con netos de signo contrario (típico en pools tricrypto), la permuta es multiactivo y sí hace falta el reparto proporcional por contravalor en euros:

```
asignado_ij = entrada_j × (contravalorEUR_salida_i / Σ contravalorEUR_salidas)
```

Es la única situación en la que sobrevive la fórmula de reparto, y por eso sigue en §4.2.

#### C4. IMPERMANENT_LOSS — **no es un evento registrable**

Esto merece un epígrafe propio porque es el error más probable del usuario. El manual es tajante (U4.5): la pérdida no permanente es **lucro cesante, no pérdida fiscal**, y no puede computarse mientras la posición siga abierta. Solo al retirar la liquidez nace, en su caso, una pérdida patrimonial computable, por diferencia entre lo aportado y lo recuperado, calculada con FIFO.

**Requisito de producto: la app no debe ofrecer ninguna forma de registrar una pérdida no permanente.** Si la interfaz muestra el valor de la posición abierta, tiene que etiquetarlo como informativo y no fiscal. Y cuando el usuario cierre la posición, el resultado debe salir del cálculo FIFO de C3, no de una resta de valores de mercado.

#### C5. VAULT_AUTOCOMPUESTO — agregadores tipo Yearn

Dos sub-casos con tratamiento distinto:

- El vault entrega un **token cuyo valor crece** (yvToken): no hay acreditación periódica; toda la renta aflora en la permuta de salida. Riesgo: convierte en GP del ahorro lo que económicamente son rendimientos. La calificación no está resuelta.
- El vault **acredita tokens adicionales**: RCM periódico, como C2.

Zona gris en el primer caso. `criterioAplicado` obligatorio.

#### C6. La valoración de la permuta: dónde está el problema de verdad

Etiquetar la salida del pool como permuta no dice todavía **por cuánto**. Y ahí está el verdadero conflicto, porque el art. 37.1.h LIRPF no valora por lo recibido, sino por el **mayor de dos valores**: el de mercado del bien entregado y el de mercado del bien recibido. La **V0612-26** aplica expresamente esa regla a los canjes del staking líquido, y es la referencia más próxima que hay para los LP tokens.

Un ejemplo hace visible el problema. Aportación de 10 ETH (coste 3.000 $/ETH) + 30.000 DAI. Al retirar, el AMM ha reequilibrado y salen 5 ETH + 60.000 DAI, con el ETH a 12.000 $:

| Cálculo | Valor de transmisión | Ganancia |
|---|---|---|
| Permuta con la regla del art. 37.1.h (mayor de los dos valores) | 5 ETH × 12.000 = **60.000** | 60.000 − 15.000 = **45.000** |
| Precio efectivamente obtenido (30.000 DAI por 5 ETH ⇒ 6.000 $/ETH) | **30.000** | 30.000 − 15.000 = **15.000** |

La diferencia —30.000 $ de tributación sobre valor que el titular nunca recibió— no nace de calificar la operación como permuta. Nace de aplicar la regla del mayor valor a un **evento sintético**: un pool no hace un intercambio al salir, hace miles de micro-operaciones de arbitraje a lo largo del tiempo, cada una al precio vigente en ese instante. Si se pudieran registrar todas, el importe acumulado de las transmisiones de ETH sería ≈ 30.000, no 60.000. Colapsar esa secuencia en un único canje de salida es una simplificación contable, y es esa simplificación —no la calificación— la que infla la base.

Consecuencia para la app: cuando el registro de la posición permita reconstruir el precio medio efectivamente obtenido, **conviene guardarlo junto al valor de mercado del activo entregado**. Son los dos números que hacen falta para sostener cualquiera de las dos posiciones ante una comprobación, y hoy ningún software cripto los conserva. Esto se implementa en cualquier caso.

> **Criterio del autor (16-08-2026): se valora por el precio efectivamente obtenido.**
>
> Conviene subrayar por qué hacían falta las dos piezas, porque es contraintuitivo. La tesis benévola (C1) determina **qué** se transmite —solo el neto de 5 ETH, no el canje completo contra el LP token—, pero no dice por cuánto. Si a esa permuta neta se le aplicara literalmente la regla del mayor de los dos valores del art. 37.1.h (60.000 frente a 30.000), el resultado volvería a ser **45.000**. La benévola por sí sola no produce el resultado que persigue.
>
> El fundamento de la elección: en un AMM el valor de transmisión real es el que arroja la **secuencia de micro-operaciones de arbitraje**, cada una ejecutada al precio vigente en su instante. El «evento de salida» es una construcción contable, no un negocio jurídico único, y aplicarle una regla de valoración pensada para permutas singulares sobrevalora la transmisión en el importe exacto que el titular nunca recibió.
>
> Ganancia en el ejemplo: **15.000**.

El motor guarda de todos modos los dos importes —el del art. 37.1.h y el efectivo— porque son los que permiten defender el criterio o recalcular bajo el contrario. Solo el efectivo alimenta el informe fiscal.

### Familia D · Derivados

#### D1. DERIVADO_LIQUIDADO_POR_DIFERENCIAS — perpetuos, futuros, opciones, CFD

Ver §7. Es la familia que no encaja en el catálogo cerrado.

Lo que sí está claro de la calificación (U4.3 del manual): las ganancias o pérdidas de operaciones apalancadas son **alteraciones patrimoniales computables en la base del ahorro**, y en las plataformas que liquidan por resultado neto es ese resultado el que se integra. Los intereses de la financiación **no son deducibles**.

Precisión técnica importante: el **art. 37.1.m LIRPF** —regla específica de futuros y opciones— se refiere solo a los mercados «regulados por el Real Decreto 1814/1991». Un perpetuo en un exchange cripto **no está en ese ámbito**; se le aplica la regla general de los arts. 33.1 y 34. La doctrina de referencia por analogía es la línea de consultas sobre CFD y forex: V0076-09, V0917-14, V0597-18, V2770-19, V0503-21, V2115-21, V0885-21. *Pendiente de lectura directa antes de fijar el criterio de imputación temporal en el motor: la V2115-21 versa precisamente sobre si se imputan solo las posiciones cerradas en el período o también los resultados de las abiertas.*

### Familia E · Cambio de forma del activo

#### E1. WRAPPING — BTC → WBTC, ETH → WETH

**No hay criterio administrativo.** La lógica del manual empuja a la tesis prudente (permuta del art. 37.1.h), coherente con la regla de identidad de DOMINIO.md y con el trato del staking líquido. La tesis benévola sostiene que el envoltorio es el mismo valor económico y que no hay alteración real.

Por defecto: **PERMUTA**, con `criterioAplicado` registrado. Aviso al usuario de que es zona gris.

#### E2. BRIDGE — mismo activo, otra cadena

Distinguir:

- Si lo que llega es **el mismo activo** en otra red (mismo emisor, mismo derecho): **TRANSFERENCIA**. Traslado, sin efecto fiscal.
- Si lo que llega es un **token envuelto distinto** (USDC nativo → USDC.e): **PERMUTA**, como E1.

La DGT no ha resuelto los *bridges*. La comisión del puente sigue la regla general de comisiones (§8).

#### E4. ROUTER / MULTIHOP — la red hace 4 saltos para llegar de BNB a USDC

El usuario ordena un intercambio de BNB por USDC y el agregador enruta la operación pasando por tres o cuatro tokens intermedios. En cadena hay cuatro permutas; en la voluntad del contribuyente, una.

Argumento a favor de registrar **una sola PERMUTA** (BNB → USDC): el art. 13 LGT obliga a calificar los hechos conforme a su verdadera naturaleza jurídica, y los saltos intermedios son un mecanismo de ejecución, no negocios queridos por las partes. Los tokens intermedios no llegan a incorporarse al patrimonio de forma efectiva: no hay disponibilidad ni un instante.

Argumento en contra: cada salto es técnicamente una transmisión, y la DGT no ha dicho nada.

Propuesta: **una PERMUTA**, con la traza completa de los saltos guardada en el Archivo y `criterioAplicado` marcado. El resultado fiscal apenas difiere —los saltos intermedios son casi simultáneos y a precios de mercado, de modo que las ganancias intercaladas tienden a cero—, pero el número de apuntes cambia por un factor de cuatro y la cola FIFO se llena de lotes fantasma de tokens que el usuario nunca tuvo. Aquí la simplificación es además la que produce el registro más fiel.

#### E3. HARD_FORK

Zona gris reconocida en el manual (U3.4.4): sin criterio administrativo publicado. Dos posiciones doctrinales:

- Asimilación al airdrop → **AIRDROP**, ganancia patrimonial sin transmisión a valor de mercado, base general (arts. 33.1 y 37.1.l).
- Coste cero → **COMPRA** a contravalor 0, difiriendo toda la tributación a la transmisión posterior.

Decisión manual obligatoria, como ya ocurre con DONACIÓN y AJUSTE.

### Familia F · Incorporaciones gratuitas

#### F1. AIRDROP_CONDICIONADO / RETRODROP / PUNTOS

El airdrop simple ya está resuelto en la app: ganancia patrimonial que no deriva de transmisión, base general, valorada a mercado en el momento de la recepción (Consulta General **0018-23**, de 29 de junio de 2023, **no vinculante**; arts. 33.1 y 37.1.l LIRPF). Ese mismo valor será después el valor de adquisición, evitando la doble imposición.

Los casos nuevos:

- **Airdrop condicionado a una contraprestación** (usar el protocolo, promocionarlo, aportar liquidez): si hay contraprestación real, la calificación se aleja de la incorporación gratuita y puede aproximarse al RCM o incluso a la actividad económica. Sin criterio publicado. Marcar y preguntar.
- **Puntos de protocolo sin token**: no hay bien ni derecho incorporado al patrimonio mientras no exista token con valor de mercado. **No se registra nada.** El apunte nace el día del *claim*.

### Familia G · Bloqueo de gobernanza

#### G1. LOCKING / veTOKENS — se bloquea CRV y se recibe veCRV intransferible

El veToken es intransferible y no negociable, lo que dificulta sostener que haya permuta con valor de mercado determinable. Tesis razonable: el bloqueo es un **traslado sin alteración** (TRANSFERENCIA) y los rendimientos que genere son RCM (RENDIMIENTO). Sin criterio administrativo. Zona gris de baja prioridad.

---

## 3. Tabla resumen — evento → patas → calificación

| # | Evento | Patas (tipos del catálogo) | Calificación de la renta | Base | Apoyo |
|---|---|---|---|---|---|
| A1 | Staking centralizado | RENDIMIENTO | RCM art. 25.2 | Ahorro | V1766-22, V0612-26 |
| A2 | Staking nativo / delegación | RENDIMIENTO (o MINERÍA si PoW) | RCM art. 25.2 / AE art. 27.1 | Ahorro / General | V1766-22, V3625-16 |
| A3 | Staking líquido | PERMUTA + RENDIMIENTO + PERMUTA | GP art. 37.1.h + RCM | Ahorro | Manual U4.1.2 |
| B1 | Lending (prestamista) | TRANSFERENCIA + RENDIMIENTO + TRANSFERENCIA | RCM art. 25.2 | Ahorro | V0648-24; arts. 1740/1753 CC |
| B1b | Ejecución de la garantía (prestamista) | **COMPRA** | Adquisición a valor de mercado en la fecha de ejecución | — | Criterio del autor 16-08-2026 |
| B2 | Lending (prestatario) | TRANSFERENCIA (colateral) + PAGO (intereses) | Intereses no deducibles; ejecución = transmisión | Ahorro | **PENDIENTE de criterio** |
| C1 | Aportación a pool | N × TRANSFERENCIA | Sin hecho imponible (tesis benévola) | — | Criterio del autor 16-08-2026 |
| C2 | Recompensas de pool / farming | RENDIMIENTO | RCM art. 25.2 | Ahorro | **V0648-24** |
| C3 | Retirada de pool | PERMUTA **del neto** + N × TRANSFERENCIA | GP sobre la diferencia aportado/recuperado | Ahorro | Criterio del autor; valoración **pendiente** |
| C4 | Impermanent loss | **ninguna** | Lucro cesante, no computable | — | Manual U4.5 |
| C5 | Vault autocompuesto | PERMUTA o RENDIMIENTO | Según acredite tokens | Ahorro | Zona gris |
| D1 | Derivados por diferencias | **LIQUIDACIÓN DE DERIVADO** (12.º tipo) | GP arts. 33.1/34 | Ahorro | Línea CFD; **no** art. 37.1.m |
| E1 | Wrapping | PERMUTA | GP art. 37.1.h | Ahorro | Zona gris |
| E2 | Bridge | TRANSFERENCIA o PERMUTA | Según identidad del activo | — / Ahorro | Sin criterio DGT |
| E4 | Router / multihop | 1 × PERMUTA (no N) | GP art. 37.1.h | Ahorro | Art. 13 LGT — sin criterio DGT |
| E3 | Hard fork | AIRDROP o COMPRA a coste 0 | GP sin transmisión, o diferimiento | General / — | Zona gris (U3.4.4) |
| F1 | Airdrop condicionado | AIRDROP, o RENDIMIENTO si hay contraprestación | GP art. 37.1.l / RCM | General / Ahorro | 0018-23 (no vinculante) |
| G1 | Locking / veTokens | TRANSFERENCIA + RENDIMIENTO | RCM | Ahorro | Zona gris |

---

## 4. Impacto en el motor

Lo que **no** cambia: la firma de las funciones, la cola FIFO única por activo, la fórmula de SALDOS, el semáforo del CUADRE y los golden tests del mini-caso 2024.

Lo que hay que añadir:

**4.1 · Cola FIFO para activos derivados.** Ninguna lógica nueva: basta con que el catálogo de activos admita rETH, LP tokens, etc. La cola ya es genérica por activo. Verificar que ningún punto del motor asuma un conjunto cerrado de activos.

**4.2 · Reparto proporcional en permutas multiactivo.** Función pura nueva en el motor: dado un conjunto de activos aportados con sus contravalores y una cantidad de token recibido, devuelve el reparto. Con `decimal.js`, y con el residuo de redondeo asignado al último tramo para que la suma cuadre exactamente.

**4.3 · Detector del art. 33.5.e — recompra tras pérdida.** Es la pieza fiscal de más valor y hoy no existe. Regla: si una transmisión arroja pérdida y el mismo activo se readquiere **dentro del año siguiente** a esa transmisión, la pérdida **no se computa todavía**; queda diferida hasta que se transmita definitivamente el elemento readquirido.

Precisiones que el motor debe respetar, tomadas del manual (U4.4):

- La letra e) opera sobre cualquier «elemento patrimonial», sin exigencia de homogeneidad. Las letras f) y g) se refieren a valores, y la propia DGT admite en la V0525-25 que las criptomonedas no lo son: **no aplican**.
- La letra e) **solo mira hacia delante**: una compra anterior a la venta no activa por sí sola el diferimiento. Es una asimetría fácil de programar mal.
- El manual advierte que el terreno no es 100 % seguro y que existen además las cláusulas generales de la LGT (arts. 13, 15 y 16). El motor debe **avisar**, no bloquear, y dejar la decisión al usuario con constancia en `criterioAplicado`.

**4.4 · Separación estricta de las dos capas en el informe fiscal.** El bloque FISCAL debe presentar, por posición y por ejercicio: RCM imputado (base del ahorro, **sin restar gastos**), GP por permutas de entrada/salida (base del ahorro), y GP de base general si las hubiera. Que el usuario vea que un pool produce dos rentas distintas es media pedagogía del taller.

**4.5 · Validación: gastos no deducibles contra RCM.** Bloqueo duro. Si un apunte RENDIMIENTO lleva comisión, esa comisión no puede minorar el rendimiento íntegro (art. 26 LIRPF, criterio V0648-24). Debe registrarse como salida patrimonial independiente.

**4.6 · Posiciones abiertas.** Vista derivada de `posicionId`: qué está aportado, qué se ha cobrado, qué falta por recuperar. Sin efecto fiscal, pero es la herramienta que hace utilizable el Libro en DeFi.

---

## 5. Impacto en el Archivo (la carpeta que prueba)

Cada evento nuevo necesita su checklist probatoria, en la línea de DOMINIO.md §3.4. Carpeta propuesta: `05-defi/<protocolo>/<posicionId>/`.

Mínimos por familia:

- **Todas:** hash de la transacción, dirección del contrato, captura del explorador con fecha y hora, fuente de la cotización EUR aplicada.
- **Staking / lending:** condiciones del protocolo en la fecha, histórico de recompensas exportado, y —clave para la imputación— **prueba de la fecha de disponibilidad** frente a la de devengo.
- **Pools:** composición del par en la aportación y en la retirada, cantidad de LP token, y cálculo del reparto proporcional aplicado.
- **Liquidaciones de colateral:** aviso de liquidación de la plataforma, deuda cancelada, activo entregado. Es un hecho imponible que se prueba mal si no se guarda en el momento.
- **Zona gris:** nota fechada con el criterio aplicado y su fundamento. El manual insiste en documentar el criterio cuando la cuestión no está resuelta; esa nota es la diferencia entre una posición defendible y una pérdida no justificada del art. 33.5.a.

---

## 6. Impacto en la UI

- **Asistentes por evento**, no por apunte. El usuario dice «he aportado a un pool» y la app genera las patas, hermanadas y con el reparto ya calculado. Es la única forma de que esto sea usable.
- **Pestaña Posiciones**, junto a Cartera.
- **Distintivo visual de zona gris**: los apuntes con `criterioAplicado` deben verse distintos, y el informe fiscal debe listarlos aparte con su disclaimer.
- **Plantillas rápidas** nuevas en el Diario, en la línea de las tres que ya existen: «Recompensa de pool», «Aportación a pool», «Wrapping».
- El aviso de la impermanent loss debe ser explícito allí donde el usuario espere encontrarla.

---

## 7. La decisión que hay que tomar: derivados liquidados por diferencias

Un perpetuo cerrado con +300 USDT de resultado neto no encaja en ninguno de los 11 tipos, y conviene ver por qué antes de elegir:

- **VENTA** consumiría un lote FIFO de un activo que nunca se entregó. Falso.
- **RENDIMIENTO** abriría lote correctamente, pero lo calificaría como RCM. La renta es ganancia patrimonial, no rendimiento. Error de calificación, y además de base cuando haya pérdidas que compensar.
- **AIRDROP** abriría lote y lo llevaría a la base general. La renta va a la base del ahorro. Error de base.

Es decir: **no hay mapeo correcto**. Tres salidas posibles:

**Opción 1 — Duodécimo tipo: LIQUIDACIÓN DE DERIVADO.**
Correcta fiscalmente y simple de implementar: abre lote por el activo recibido, no consume lotes, y su resultado va a GP de la base del ahorro. Coste: modifica la Tabla 7 del manual y la regla de oro 7. Como el manual y la app tienen el mismo autor, es una decisión que se puede tomar, pero es una decisión **doctrinal**, no técnica.

**Opción 2 — Libro auxiliar de posiciones derivadas.**
Los derivados no son apuntes del Diario, sino una entidad `PosicionDerivada` con sus propios movimientos. Solo entran en el Diario los flujos de margen (TRANSFERENCIA) y el resultado neto al cerrar. Respeta la letra de la regla de oro 7, pero rompe el principio de integridad del manual («se registra TODO movimiento, gravable o no») y crea un segundo lugar donde mirar.

**Opción 3 — Campo `calificacionFiscal` como override.**
Un apunte con forma de PERMUTA que declara expresamente su cajón fiscal. Máxima flexibilidad, y por eso mismo el mayor riesgo: convierte una validación dura en un campo libre y abre la puerta a que cualquier apunte se autocalifique.

**Recomendación: opción 1.** Es la única que mantiene un solo Libro, un solo motor y una calificación correcta. La regla de oro 7 existe para impedir que la app invente tipos por comodidad de implementación; aquí no se trata de comodidad, sino de una familia de operaciones que el catálogo de 2026 no contempló.

> **Criterio del autor (16-08-2026): adoptada la opción 1.** Se crea el duodécimo tipo **LIQUIDACIÓN DE DERIVADO**, con estas propiedades en la Tabla 7: cuadra sí, alteración sí, abre lote sí (por el activo recibido), consume lote no, calificación = ganancia o pérdida patrimonial de la base del ahorro.
>
> El autor incorporará la fila correspondiente al manual por su cuenta; **la app va por delante**. Requisitos al implementarlo: actualizar la regla de oro 7 en `CLAUDE.md` para que diga doce, actualizar la tabla de DOMINIO.md §3.3, y añadir un golden test propio del tipo nuevo antes de tocar el motor.

---

## 8. Cuestión transversal: las comisiones en cripto

Esto ya es un hueco del motor actual, y DeFi lo vuelve crítico porque en DeFi casi todas las comisiones son en cripto, no en euros.

Las reglas de DOMINIO.md §4 suman al coste o restan del valor de transmisión **solo cuando la comisión es en EUR**. El manual (U4.3) fija el criterio material: la comisión ligada a una transmisión forma parte de los gastos inherentes (arts. 35.1 y 35.2 LIRPF); la comisión de un simple traslado entre billeteras propias **no es deducible**.

Cuando el gas se paga en ETH caben dos efectos posibles:

1. Su contravalor en euros minora el valor de transmisión (o incrementa el de adquisición) de la operación a la que sirve.
2. Entregar ese ETH sería **en sí mismo una transmisión** que consume cola FIFO de ETH y genera su propia ganancia o pérdida patrimonial.

> **Criterio del autor (16-08-2026): el pago de gas en ETH NO se considera transmisión.** Se implementa el efecto (1) y **se descarta el efecto (2)**.

Es una elección defendible y además la que evita convertir cada interacción en cadena en una micro-transmisión con su microganancia, que sería inmanejable y de rendimiento fiscal irrelevante. Pero tiene una consecuencia técnica que hay que resolver de forma expresa:

**El ETH sí sale del monedero.** El saldo baja. Si además no se consume lote, la cola FIFO de ETH conservará más unidades de las que el titular tiene realmente, y esa divergencia crece con cada operación hasta romper la conciliación entre SALDOS y FIFO —que es justo lo que el CUADRE existe para detectar—.

> **Criterio del autor (16-08-2026): opción (b) — consumir el lote y trasladar su coste.**
>
> El lote del activo gastado en gas **se consume por su coste FIFO, sin generar ganancia ni pérdida**, y ese coste es el que se incorpora al valor de adquisición (o minora el valor de transmisión) de la operación a la que la comisión sirve —**en lugar** del contravalor en euros del gas—.

Reglas exactas para el motor, que es donde esto se juega:

1. La comisión en cripto **consume cola FIFO** del activo de la comisión, por orden de antigüedad, con troceo parcial de lote como cualquier otro consumo.
2. El resultado de ese consumo es **cero**: no es una transmisión, luego no hay GyP que declarar. El motor debe registrarlo como consumo neutro y **excluirlo del informe fiscal**.
3. El **coste FIFO retirado** se aplica a la operación servida: suma al valor de adquisición si la comisión es de adquisición, resta del valor de transmisión si es de venta.
4. Si la comisión corresponde a un **traslado entre ubicaciones propias**, no hay operación servida a la que aplicar el coste: el lote se consume igualmente (regla 1, para que SALDOS y FIFO no diverjan) y el coste retirado **no es deducible en ninguna parte**, conforme a U4.3 del manual. Se pierde, que es exactamente lo que la ley quiere decir cuando dice que no es deducible.
5. Si la comisión es en EUR, se mantiene el tratamiento actual de DOMINIO.md §4 sin cambios.

La regla 3 es la que se aparta de la letra del art. 35, que mide los gastos inherentes por su importe real en euros. La justificación es de coherencia interna: si la entrega del ETH no es transmisión, su valor de mercado en ese momento nunca llega a realizarse, y lo único que el titular ha sacrificado de verdad es el coste con el que ese ETH entró en la cartera. Es una construcción **fundada pero no confirmada**, y como cualquier otra de este documento debe quedar documentada en `criterioAplicado`.

Conviene resolverlo antes que DeFi: afecta a la exactitud de todas las carteras con actividad en cadena.

---

## 9. Zonas grises y cómo tratarlas

Ocho supuestos de este documento carecen de criterio administrativo publicado:

| Supuesto | Tesis por defecto | Alternativa |
|---|---|---|
| Recepción del LP token | **Simple resguardo, sin alteración** (benévola) | Permuta del art. 37.1.h |
| Neutralidad de la entrega en lending (prestamista) | Neutra, salvo ejecución de la garantía | Transmisión onerosa (lectura estricta del art. 1753 CC) |
| Recepción y devolución del principal (prestatario) | **Sin decidir** | — |
| Receipt tokens (aTokens, cTokens) | Permuta | Resguardo |
| Rebase de valor vs. de cantidad | Según acredite tokens | — |
| Vault autocompuesto de valor creciente | GP a la salida | RCM periódico |
| Wrapping | Permuta | Sin alteración |
| Bridge con token distinto | Permuta | Traslado |
| Hard fork | Airdrop | Coste cero |

Protocolo de la app, tomado de la propia metodología del manual (Unidad 1: identidad de hechos, vigencia del criterio, existencia de pronunciamiento judicial):

1. Aplicar la tesis por defecto, siempre la prudente.
2. Exigir `criterioAplicado` y guardar nota fechada en el Archivo.
3. Mostrarlo separado en el informe fiscal, con el disclaimer de carácter orientativo y fecha de criterio que ya exige la regla de oro 5.
4. Permitir recalcular la cartera entera bajo la tesis alternativa, para ver la diferencia. Esto es una herramienta de trabajo real, no un adorno: cuando una de estas cuestiones se resuelva, el alumno querrá saber cuánto le mueve.

Y una advertencia que el manual hace y conviene que la app repita: el **FIFO global no es hoy criterio cerrado**. Las tres sentencias del TSJ del País Vasco (37/2025 de 9 de enero, 142/2025 de 20 de marzo y 188/2025 de 22 de abril) rechazan extender a las criptomonedas la regla de los valores homogéneos por exigencia de reserva de ley. Interpretan normativa foral y no son jurisprudencia, pero su razón de decidir es trasladable. La app aplica FIFO global —que es lo que aplicará la AEAT— y debe conservar la trazabilidad que permitiría defender un cálculo alternativo.

---

## 10. Plan por fases

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| **D0** | Comisiones en cripto (§8) | Golden test nuevo: cartera con gas en ETH; SALDOS y FIFO siguen conciliados |
| **D1** | Campos `evento`, `posicionId`, `protocolo`, `criterioAplicado` + entidad `Posicion` + migración Dexie | Los 289 tests actuales siguen en verde |
| **D2** | Familias A y B completas (staking, lending de ambos lados, ejecución de garantía) | Caso de ejemplo ampliado; cuadre verde |
| **D3** | Familia C (pools): tesis benévola + valoración por precio efectivo | Test del ejemplo de §C6: la permuta neta es 5 ETH por 30.000 DAI |
| **D4** | Detector del art. 33.5.e (§4.3) | Batería de casos límite: recompra a los 11 meses, a los 13, compra previa a la venta |
| **D5** | Familias E, F, G + panel de zonas grises con recálculo comparativo | Recálculo prudente/benévolo de una cartera con pools |
| **D6** | 12.º tipo LIQUIDACIÓN DE DERIVADO (§7) | `CLAUDE.md` y DOMINIO.md §3.3 actualizados a doce tipos; golden test propio |

---

## 11. Registro de decisiones del autor

Javier Bravezo Durán, autor del manual, 16 de agosto de 2026.

| # | Cuestión | Decisión |
|---|---|---|
| 1 | Derivados por diferencias (§7) | **12.º tipo LIQUIDACIÓN DE DERIVADO.** La app va por delante; el manual se actualiza aparte |
| 2 | Lending, prestamista (B1) | **Neutro, salvo ejecución de la garantía.** La adquisición del colateral es COMPRA a valor de mercado en la fecha de ejecución |
| 3 | Entrada y salida de pool (C1/C3) | **Tesis benévola por defecto**, advirtiendo siempre de la existencia de la prudente y permitiendo el recálculo |
| 4 | Gas pagado en cripto (§8) | **No es transmisión.** Solo el efecto sobre el valor de adquisición/transmisión |
| 5 | Rebase de valor vs. de cantidad (A3) | Confirmada la propuesta |
| 6 | Receipt tokens (aTokens, cTokens) | Permuta |
| 7 | Wrapping (E1) | Permuta |
| 8 | Bridge (E2) | Según identidad del activo |
| 9 | Router / multihop (E4) | Una sola permuta, traza completa al Archivo |
| 10 | Hard fork (E3) | Preguntar siempre |
| 11 | Vault autocompuesto (C5) | GP a la salida |
| 12 | Airdrop condicionado (F1) | Marcar y preguntar |
| 13 | Locking / veTokens (G1) | TRANSFERENCIA + RENDIMIENTO |
| 14 | Art. 33.5.e (§4.3) | Aplica a **unidades equivalentes**; **avisa, no bloquea** |
| 15 | Reducción del 30 % del art. 26.2 (A1) | Se ofrece con aviso |
| 16 | Ubicación del documento | Se implementa en la app; el manual lo actualiza el autor manualmente |

**Segunda ronda, 16-08-2026:**

| # | Cuestión | Decisión |
|---|---|---|
| 17 | Lote del activo gastado en gas (§8) | **Opción (b)**: se consume por su coste FIFO con resultado cero, y ese coste —no el contravalor en euros— se traslada a la operación servida |
| 18 | Valoración de la permuta neta al salir del pool (§C6) | **Precio efectivamente obtenido**. En un AMM el valor de transmisión real es el de la secuencia de micro-operaciones |
| 19 | Recepción del principal por el prestatario (B2) | **Neutra, pero con valor de adquisición**: equivalente en euros en el momento de recibirlo. Se modela como COMPRA |

**Abiertas:** ninguna bloqueante. Pendiente de confirmar únicamente si la **devolución** del principal por el prestatario sigue la recomendación (PAGO, que hace aflorar la variación de valor) o debe ser plenamente neutra.

---

## 12. Fuentes

**Normativa** (verificada contra el texto consolidado del BOE el 16-08-2026): Ley 35/2006 (LIRPF), arts. 14.1.a, 14.2.k, 25.2, 26, 27.1, 33.1, 33.2, 33.5, 34, 35, 37.1.h, 37.1.l, 37.1.m, 43.1, 45, 46, 48. Código Civil, arts. 1740 y 1753. LGT, arts. 13, 15, 16, 89, 105, 106.

**Doctrina DGT** — vinculantes: V1604-18 (FIFO cesta única global), V1766-22 (staking → RCM), V0648-24 (pools, yield farming y lending → RCM; gastos no deducibles), V0525-25 (bienes homogéneos), V0491-26 (reitera FIFO), V0612-26 (staking; criterio de disponibilidad), V1174-25 (robo), V0625-24 y V1828-24 (estafa con autor no identificado), V1134-25 y V0772-25 (deudor identificado), V0652-24 (concurso), V3625-16 (minería, IVA). No vinculante: Consulta General 0018-23 (airdrops).

**Línea CFD / derivados**, por analogía: V0076-09, V0917-14, V0597-18, V2770-19, V0503-21, V2115-21, V0885-21, V2788-21.

**Jurisprudencia**: TSJ País Vasco, Sección 1.ª, sentencias 37/2025 (ECLI:ES:TSJPV:2025:41), 142/2025 (ECLI:ES:TSJPV:2025:1078) y 188/2025 (ECLI:ES:TSJPV:2025:1712).

**Manual del taller**: MANUAL DE FISCALIDAD BITCOIN, Universidad de las Hespérides, Ed. 2026, Javier Bravezo Durán. Unidad 3, aps. 1–5; Unidad 4, aps. 1–6.

**Doctrina privada contrastada**: Pablo Vikay, «Pools de Liquidez e Impermanent Loss: protégete con un tratamiento fiscal favorable», LinkedIn, 28 de marzo de 2022 (ver Anexo A).

---

## Anexo A · Contraste con la tesis Vikay (2022)

La tesis de Pablo Vikay sobre pools de liquidez circula bastante y merece un contraste ordenado, porque **su diagnóstico es certero y su solución es frágil**, y conviene quedarse con lo primero sin arrastrar lo segundo.

### Qué sostiene

1. Ni la entrada ni la salida del pool son permutas: el LP token es un mero resguardo.
2. La salida debe registrarse como una **pérdida de *pooling*** por el valor de mercado del activo que el AMM «ejecuta» (−60.000), más la alteración patrimonial por transmisión de ese activo (+45.000), más un **beneficio de *pooling*** por el activo recibido (+30.000), asimilado a apalancamiento/derivados o a rendimiento del capital mobiliario.
3. Resultado: se tributa por 15.000 en lugar de por 45.000.
4. Excepción: si se vende el LP token sin retirar los activos, la entrada se recalifica retroactivamente como permuta y el LP adquiere valor de adquisición.
5. Los saltos intermedios de un router no deben computarse como permutas sucesivas.

### Lo que hay que conservar

- **El diagnóstico económico es correcto.** Tributar por 45.000 cuando solo se han recibido 30.000 es un resultado injusto, y el aviso sobre los programas que registran automáticamente un *liquidity trade* describe un problema real. La app no debe caer en él (§C6).
- **El argumento de la intención** —el usuario entra en un pool a obtener rendimientos, no a permutar— es un argumento de calificación del art. 13 LGT, y es serio.
- **El punto sobre los routers** es acertado y se ha incorporado como evento E4.
- **La duda sobre la homogeneidad de los LP tokens** a efectos de FIFO es fina y sigue abierta, sobre todo tras la V0525-25 y las sentencias del TSJ del País Vasco.

### Lo que no se sostiene

**a) La fecha.** El artículo es de **marzo de 2022**: anterior a la V0648-24, a la V0525-25, a la V0491-26 y a la V0612-26. Es decir, anterior a todo lo que la DGT ha dicho sobre DeFi. La propia metodología de la Unidad 1 del manual —identidad de hechos, **vigencia del criterio**, existencia de pronunciamiento judicial— obliga a descontar su valor por este motivo antes que por ningún otro.

**b) La V0612-26 apunta en dirección contraria a su tesis central.** Al tratar el canje ETH → rETH del staking líquido como permuta del art. 37.1.h, la DGT ha resuelto —para el caso estructuralmente más parecido que existe— que un token que representa una posición y es canjeable por el subyacente **no** es un simple resguardo. La analogía con el LP token es directa. La tesis de 2022 sigue siendo defendible, pero hoy es la tesis contraria a la línea administrativa más reciente.

**c) La «pérdida de *pooling*» no tiene encaje legal.** En un pool no hay financiación, ni deuda, ni colateral. Importar la categoría de la ejecución de garantías —que el manual reserva, con razón, para el préstamo garantizado real (U3.3.2 y U4.3)— a una operación donde no hay acreedor es una analogía sin apoyo. En el IRPF no existe una «pérdida de *pooling*».

**d) Da efecto fiscal a la impermanent loss, y eso choca de frente con tu propio manual.** El esquema computa −30.000 de resultado por impermanent loss (U4.5 del manual: «se trata de un lucro cesante, no de una pérdida fiscal, y no puede computarse»). Que ese −30.000 se compense después con la ganancia por transmisión no lo salva: lo que se ha hecho es introducir un lucro cesante en la base imponible. Es la contradicción más directa entre el artículo y la doctrina del taller.

**e) Hay una inconsistencia interna en la compensación.** El esquema necesita que la «pérdida de *pooling*» (−60.000) y el «beneficio de *pooling*» (+30.000) se resten entre sí. Pero el propio artículo ofrece calificar el beneficio como **rendimiento del capital mobiliario**, y en la base del ahorro los rendimientos y las ganancias y pérdidas patrimoniales son **compartimentos distintos**, con compensación cruzada limitada al 25 % (art. 49 LIRPF). Si el beneficio es RCM, la compensación que el esquema da por supuesta no se produce, y el resultado deja de ser 15.000.

**f) La recalificación retroactiva no funciona.** Sostener que la entrada al pool «se convierte» en permuta *a posteriori*, si más tarde se vende el LP token, hace depender la calificación de un hecho pasado de un hecho futuro y ajeno. O el LP token se incorporó al patrimonio con un valor, o no. No caben las dos cosas según convenga.

### La conclusión práctica

Vikay llega a **una cifra defendible (15.000) por un camino que no lo es**. Y la cifra es defendible porque el problema real no era la calificación como permuta, sino la **valoración** por el mayor de los dos valores aplicada a un evento sintético (§C6). Por esa vía —precio medio efectivamente obtenido frente a valor de mercado del activo entregado— se llega al mismo 15.000 sin inventar categorías, sin computar lucro cesante y sin depender de compensaciones entre compartimentos que la ley no permite.

Para la app, la consecuencia es concreta y es la de §C6: **registrar los dos valores**. El que exige la regla del art. 37.1.h y el efectivamente obtenido. Con ambos en el Libro, el alumno puede declarar por el criterio prudente y conservar, documentada, la base para defender el otro.
