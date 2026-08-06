# Golden tests — mini-caso 2024

Estos tests son **intocables** (Regla de oro 9). Reproducen el mini-caso genérico de
20 operaciones (`docs/reference/mini_caso_generico.csv`) y comparan los saldos finales
a 31/12/2024 con los valores esperados:

| Activo | Saldo esperado |
|--------|----------------|
| BTC    | 0,4068         |
| ETH    | 1,049          |
| USDC   | 305            |
| EUR    | 4.254          |
| ADA    | 0              |
| TOKENX | 0              |

## Ficheros

- `mini-caso.ts` — **datos** (no es un test): transcribe el CSV a 19 apuntes del
  dominio (la retirada+depósito cripto del 20/03 se fusionan en una TRANSFERENCIA),
  las ubicaciones (Kraken/Ledger/EXTERIOR), los saldos esperados y la tabla de
  contravalores (parte dura del CSV + parte asumida; ver cabecera del fichero y
  `docs/COTEJO_F1.md`).
- `saldos.test.ts` — golden intocable de SALDOS: totales por activo y reparto por
  ubicación a 31/12/2024, más cortes temporales y detección de saldo negativo.
- `fifo.test.ts` — GyP FIFO por transmisión del mini-caso (dependen de los
  contravalores asumidos). Cada esperado va comentado con los lotes que consume.

Property tests del FIFO y pruebas de `cuadre`/`validaciones` viven junto al motor en
`src/engine/*.test.ts`. La tabla de cotejo manual contra la plantilla está en
`docs/COTEJO_F1.md`.
