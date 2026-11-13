// Genera los íconos maskable y las pantallas de arranque (splash) de iOS a
// partir del logo real del repo (public/icons/icon-512.png). Nada de
// placeholders: la fuente es el ícono de marca que ya se usa.
//
// Se corre a mano cuando cambia el logo: `node scripts/generar-iconos-pwa.mjs`.
// Los PNG resultantes se commitean, así el build de Cloudflare no necesita
// sharp.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const ORIGEN = 'public/icons/icon-512.png'
const FONDO = { r: 248, g: 247, b: 242, alpha: 1 } // --background del tema claro

// Maskable: el sistema recorta hasta un 20% de cada lado, así que el logo va
// al 60% del lienzo y el resto es fondo de marca.
async function maskable(tam, salida) {
  const logo = await sharp(ORIGEN).resize(Math.round(tam * 0.6)).toBuffer()
  await sharp({ create: { width: tam, height: tam, channels: 4, background: FONDO } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(salida)
  console.log('✓', salida)
}

// Splash de iOS: lienzo del tamaño exacto de la pantalla, logo centrado al
// 28% del lado corto.
async function splash(w, h, salida) {
  const lado = Math.round(Math.min(w, h) * 0.28)
  const logo = await sharp(ORIGEN).resize(lado).toBuffer()
  await sharp({ create: { width: w, height: h, channels: 4, background: FONDO } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(salida)
  console.log('✓', salida)
}

// Resoluciones reales (en píxeles) de los iPhone en uso.
const PANTALLAS = [
  [1179, 2556, 'iphone-15'],
  [1290, 2796, 'iphone-15-pro-max'],
  [1170, 2532, 'iphone-13'],
  [1284, 2778, 'iphone-12-pro-max'],
  [1125, 2436, 'iphone-x'],
  [1242, 2208, 'iphone-8-plus'],
  [750, 1334, 'iphone-8'],
]

await mkdir('public/icons/splash', { recursive: true })
await maskable(192, 'public/icons/icon-192-maskable.png')
await maskable(512, 'public/icons/icon-512-maskable.png')
for (const [w, h, nombre] of PANTALLAS) {
  await splash(w, h, `public/icons/splash/${nombre}.png`)
}
