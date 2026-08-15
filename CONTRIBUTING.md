# Contribuir a Libro Hespérides

Gracias por el interés. Este proyecto es **código fuente público para uso personal**
(Personal Use Source License v1.0, ver `LICENSE`) con un modelo de licencias
profesionales que financia su desarrollo. Eso condiciona cómo se aceptan contribuciones.

## Issues y sugerencias

Los informes de errores, propuestas y análisis de auditoría o seguridad son bienvenidos
sin más requisito. Para vulnerabilidades, se agradece comunicación previa a
**javier@legel.es** (cláusula 4.7 de la licencia).

## Pull requests: acuerdo de contribución (CLA)

Conforme a la cláusula 8 de la licencia, **solo se incorporan al proyecto contribuciones
de código o documentación acompañadas de este acuerdo**. Al enviar una pull request
declaras y aceptas que:

1. La contribución es obra tuya original y tienes facultades para licenciarla.
2. Concedes a Javier Bravezo Durán (el Titular) una licencia **mundial, gratuita,
   irrevocable, transferible y sublicenciable** para reproducir, transformar, distribuir,
   comunicar públicamente y explotar tu contribución por cualquier medio y bajo cualquier
   licencia, presente o futura, **incluidas licencias comerciales y versiones
   profesionales del Software**.
3. Conservas la titularidad de tu aportación y el derecho a usarla para cualquier otro fin.
4. La contribución se aporta «tal cual», sin garantías.
5. Serás acreditado en el historial del repositorio y, en su caso, en los avisos de
   autoría del proyecto.

Si no estás conforme con estos términos, abre un issue describiendo la mejora en lugar de
enviar código: la idea podrá implementarse de forma independiente.

## Reglas técnicas

Ver `CLAUDE.md` y `docs/reference/DOMINIO.md`. En particular: el motor (`src/engine/`) y
los golden tests (`tests/golden/`) son intocables sin decisión expresa del responsable, y
la app no hace llamadas de red en runtime (local-first).
