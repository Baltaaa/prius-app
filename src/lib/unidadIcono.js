// Única fuente del emoji de cada tipo de unidad. Carpa = 🏠, sombrilla = 🏖️
// (el de la ficha de unidad del Plano). Cabinas y lockers no llevan emoji.
// Toda pantalla, texto, select o toast que nombre una unidad lo toma de acá:
// nunca se escribe el emoji suelto ni se usa un ícono de lucide para esto.
export const UNIDAD_EMOJI = Object.freeze({ carpa: '🏠', sombrilla: '🏖️', cabina: '', locker: '' })

const NOMBRE = { carpa: 'Carpa', sombrilla: 'Sombrilla', cabina: 'Cabina', locker: 'Locker' }

export function unidadEmoji(tipo) {
  return UNIDAD_EMOJI[tipo] || ''
}

/** "🏠 Carpa 19" para strings (selects, toasts, confirmaciones). Sin emoji: "Cabina 2". */
export function unidadConEmoji(tipo, numero) {
  const emoji = unidadEmoji(tipo)
  return `${emoji ? `${emoji} ` : ''}${NOMBRE[tipo] || tipo} ${numero}`
}

// Textos armados en el servidor ("carpa 80", "Sombrilla #13") que llegan ya
// como string: los lleva al mismo formato sin tocar el resto del texto.
export function emojiEnTexto(texto) {
  if (!texto) return texto
  return String(texto).replace(/\b(carpa|sombrilla)\s+#?(\d+)/gi, (_, tipo, n) => unidadConEmoji(tipo.toLowerCase(), n))
}
