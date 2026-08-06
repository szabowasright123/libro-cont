# RELEASE.md — checklist de publicación

Guía para publicar una versión de Libro Hespérides. La app se despliega a GitHub Pages
automáticamente al hacer `push` a `main` (ver `.github/workflows/deploy.yml`).

## Antes de etiquetar

- [ ] `npm test` en verde (motor, unidad y rendimiento).
- [ ] `npm run test:e2e` en verde (camino crítico, ciclo XLSX y teclado).
- [ ] `npm run build` sin errores de TypeScript.
- [ ] Golden tests del mini-caso 2024 intactos (Regla de oro 9): BTC 0,4068 · ETH 1,049 ·
      USDC 305 · EUR 4.254 · ADA 0 · TOKENX 0.
- [ ] `CHANGELOG.md` actualizado con la versión y la fecha.
- [ ] `package.json` → `version` actualizada (es la que muestra «Acerca de»).
- [ ] Revisado que no queden `console.log` de depuración ni herramientas de dev visibles
      por defecto (la sección de desarrollo de Ajustes va oculta salvo `hesperides.dev`).

## Comprobaciones de la PWA (manuales)

- [ ] Servir el build: `npm run build && npm run preview` y abrir la URL con `/libro-cont/`.
- [ ] En DevTools → Application: el **manifiesto** carga con iconos 192/512 y *maskable*;
      el **service worker** queda «activated».
- [ ] Recargar y activar el modo **offline** (DevTools → Network → Offline, o modo avión):
      la app sigue funcionando y navegando entre secciones.
- [ ] Instalar la app (icono de instalación del navegador) en escritorio y, si se puede,
      en móvil; comprobar que arranca en ventana propia.
- [ ] Publicar una versión nueva y confirmar que aparece el aviso **«Nueva versión
      disponible»** y que «Actualizar» recarga sin perder los datos locales.

## Calidad (Lighthouse ≥ 90)

- [ ] Ejecutar Lighthouse (Chrome DevTools → Lighthouse) sobre el `preview` en modo
      incógnito, categorías **Rendimiento**, **Accesibilidad** y **PWA/Best Practices**.
- [ ] Objetivo: ≥ 90 en rendimiento y accesibilidad; PWA instalable y offline. Anotar la
      puntuación obtenida en el PR de la versión.

> Nota: Lighthouse no se ejecuta en CI (requiere Chrome headless con flags); es una
> comprobación manual del responsable antes de etiquetar.

## Textos pendientes (no bloquean, pero conviene revisar)

- [ ] `{{TEXTO-MANUAL}}` de la guía y el módulo fiscal (docs/PENDIENTE_TEXTOS.md).
- [ ] `TODO-REVISION` de las convenciones fiscales (docs/DECISIONES.md, D1 y D2).
- [ ] Autoría, licencia y repositorio en `src/ui/acerca/datosAcerca.ts`
      (`{{AUTOR}}`, `{{LICENCIA}}`, `{{REPO-URL}}`).

## Etiquetar y desplegar

1. [ ] Commit de la versión con mensaje en español (p. ej. `P8: pulido, PWA y v1.0`).
2. [ ] Crear la etiqueta anotada:
   ```bash
   git tag -a v1.0.0 -m "Libro Hespérides v1.0.0"
   git push origin main --tags
   ```
3. [ ] Verificar que GitHub Actions termina en verde y que Pages sirve la nueva versión.
4. [ ] (Opcional) Crear la *release* en GitHub pegando la sección del `CHANGELOG.md`.

## Regenerar iconos (si cambia el diseño)

```bash
node scripts/gen-iconos.mjs
```

Regenera los PNG de `public/` a partir de `public/icon.svg` e `public/icon-maskable.svg`.
