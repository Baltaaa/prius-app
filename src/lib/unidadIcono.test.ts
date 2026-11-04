import { describe, it, expect } from 'vitest'
import { UNIDAD_EMOJI, unidadEmoji, unidadConEmoji, emojiEnTexto } from './unidadIcono'

describe('unidadIcono', () => {
  it('carpa = 🏠 y sombrilla = 🏖️, cabina y locker sin emoji', () => {
    expect(UNIDAD_EMOJI.carpa).toBe('🏠')
    expect(UNIDAD_EMOJI.sombrilla).toBe('🏖️')
    expect(unidadEmoji('cabina')).toBe('')
    expect(unidadEmoji('locker')).toBe('')
    expect(unidadEmoji('otra')).toBe('')
  })

  it('arma "🏠 Carpa 19" y "Cabina 2" sin espacio de más', () => {
    expect(unidadConEmoji('carpa', 19)).toBe('🏠 Carpa 19')
    expect(unidadConEmoji('sombrilla', 4)).toBe('🏖️ Sombrilla 4')
    expect(unidadConEmoji('cabina', 2)).toBe('Cabina 2')
  })

  it('lleva textos del servidor al mismo formato', () => {
    expect(emojiEnTexto('carpa 80')).toBe('🏠 Carpa 80')
    expect(emojiEnTexto('Reserva de Sombrilla #13 confirmada')).toBe('Reserva de 🏖️ Sombrilla 13 confirmada')
    expect(emojiEnTexto(null)).toBe(null)
  })
})
