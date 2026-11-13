// Compartir un gráfico como imagen (nov 2026).
//
// Sin html2canvas ni ninguna librería nueva: recharts dibuja SVG, así que el
// SVG se serializa, se pinta en un <canvas> y sale un PNG. Encima se dibuja la
// chapa de la marca (fondo sólido, título, período y el logo real de Prius)
// para que la imagen se entienda sola cuando el dueño la manda por WhatsApp.
//
// El logo se carga desde /images/prius-icon.png (el asset real del repo, nunca
// un placeholder). Si no carga, la imagen sale igual sin logo antes que fallar.

const ANCHO = 1080
const PAD = 48
const ALTO_CABECERA = 150
const ALTO_PIE = 56

const LOGO = '/images/prius-icon.png'

function cargarImagen(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Serializa un <svg> del DOM a una imagen lista para dibujar en canvas. */
async function svgAImagen(svg) {
  const clon = svg.cloneNode(true)
  const caja = svg.getBoundingClientRect()
  clon.setAttribute('width', String(Math.round(caja.width)))
  clon.setAttribute('height', String(Math.round(caja.height)))
  clon.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const texto = new XMLSerializer().serializeToString(clon)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`
  const img = await cargarImagen(url)
  return { img, ancho: caja.width, alto: caja.height }
}

/**
 * Convierte el gráfico que haya dentro de `nodo` en un PNG con la chapa de
 * Prius. `tema` define el fondo y el color de texto: la imagen SIEMPRE sale
 * con fondo sólido, nunca transparente.
 */
export async function graficoAPng(nodo, { titulo, periodo, oscuro = false }) {
  const svg = nodo?.querySelector('svg')
  if (!svg) throw new Error('No encontramos el gráfico para compartir.')

  const { img, ancho: aOrig, alto: hOrig } = await svgAImagen(svg)
  if (!img) throw new Error('No pudimos convertir el gráfico en imagen.')

  const escala = (ANCHO - PAD * 2) / Math.max(aOrig, 1)
  const altoGrafico = Math.round(hOrig * escala)
  const alto = ALTO_CABECERA + altoGrafico + ALTO_PIE

  const canvas = document.createElement('canvas')
  // devicePixelRatio para que no salga borrosa en pantallas retina.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = ANCHO * dpr
  canvas.height = alto * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const fondo = oscuro ? '#161615' : '#FFFFFF'
  const tinta = oscuro ? '#F5F4EF' : '#000000'
  const tinta2 = oscuro ? '#A3A29C' : '#6B6B6B'

  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, ANCHO, alto)

  const logo = await cargarImagen(LOGO)
  if (logo) ctx.drawImage(logo, PAD, PAD, 56, 56)

  const xTexto = logo ? PAD + 56 + 20 : PAD
  ctx.fillStyle = tinta
  ctx.font = '700 34px Manrope, system-ui, sans-serif'
  ctx.fillText(titulo, xTexto, PAD + 30)
  ctx.fillStyle = tinta2
  ctx.font = '500 20px Manrope, system-ui, sans-serif'
  ctx.fillText(periodo, xTexto, PAD + 58)

  ctx.drawImage(img, PAD, ALTO_CABECERA, ANCHO - PAD * 2, altoGrafico)

  ctx.fillStyle = tinta2
  ctx.font = '500 17px Manrope, system-ui, sans-serif'
  ctx.fillText('Prius Playa Grande · Mar del Plata', PAD, alto - 22)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No pudimos generar la imagen.'))), 'image/png')
  })
}

/**
 * Comparte el PNG con la hoja nativa del sistema (en iPhone: WhatsApp, Fotos,
 * etc.). Si el dispositivo no puede compartir archivos, lo descarga.
 *
 * Devuelve 'compartido' | 'descargado' para que la pantalla avise bien.
 */
export async function compartirPng(blob, nombre) {
  const archivo = new File([blob], nombre, { type: 'image/png' })
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] })
      return 'compartido'
    } catch (err) {
      // Cancelar la hoja de compartir no es un error que haya que mostrar.
      if (err?.name === 'AbortError') return 'cancelado'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'descargado'
}
