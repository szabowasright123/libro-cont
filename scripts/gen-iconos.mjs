/**
 * gen-iconos.mjs — regenera los iconos PNG de la PWA a partir de los SVG fuente
 * (`public/icon.svg` e `public/icon-maskable.svg`). Herramienta de desarrollo:
 * se ejecuta a mano cuando cambia el icono, no en el build.
 *
 *   node scripts/gen-iconos.mjs
 *
 * Local-first: sharp solo se usa aquí, en tiempo de diseño; nunca en runtime.
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const any = readFileSync(join(pub, 'icon.svg'))
const mask = readFileSync(join(pub, 'icon-maskable.svg'))

async function png(svg, size, out) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(pub, out))
  console.log('  ✓', out, size + 'px')
}

await png(any, 192, 'pwa-192x192.png')
await png(any, 512, 'pwa-512x512.png')
await png(any, 180, 'apple-touch-icon.png')
await png(mask, 512, 'pwa-maskable-512x512.png')
console.log('Iconos generados.')
