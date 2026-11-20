import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CeldaClara from './CeldaClara'

// CeldaClara es memo(): `.type` es la función real, que devuelve el elemento sin montar.
const render = (props: Record<string, unknown>) => (CeldaClara as unknown as { type: (p: Record<string, unknown>) => any }).type(props)
const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(CeldaClara as any, props))

describe('CeldaClara (vista clientes portable)', () => {
  it('libre: blanca y seleccionable, devuelve el número al tocarla', () => {
    const onClick = vi.fn()
    const el = render({ numero: 74, estado: 'libre', tamano: 'tactil', onClick })
    expect(el.props.className).toContain('bg-white')
    expect(el.props.disabled).toBe(false)
    const evento = { clientX: 10, clientY: 20 }
    el.props.onClick(evento)
    expect(onClick).toHaveBeenCalledWith(74, evento)
  })

  it('ocupada: negra y no seleccionable', () => {
    const onClick = vi.fn()
    const el = render({ numero: 74, estado: 'ocupada', tamano: 'tactil', onClick })
    expect(el.props.className).toContain('bg-black')
    expect(el.props.onClick).toBeUndefined()
    expect(el.props.disabled).toBe(true)
  })

  it('elegida: dorado #F2CA50 sólido y marcada como presionada', () => {
    const markup = html({ numero: 3, estado: 'elegida', tamano: 'compacta', onClick: () => {} })
    expect(markup).toContain('bg-[#F2CA50]')
    expect(markup).toContain('aria-pressed="true"')
  })

  it('sugerida: borde dorado sobre blanco', () => {
    const markup = html({ numero: 3, estado: 'sugerida', tamano: 'compacta' })
    expect(markup).toContain('border-[#F2CA50]')
    expect(markup).toContain('bg-white')
  })

  it('deshabilitada (filtrada por los chips): atenuada y sin click', () => {
    const onClick = vi.fn()
    const compacta = render({ numero: 9, estado: 'libre', tamano: 'compacta', deshabilitada: true, onClick })
    expect(compacta.props.onClick).toBeUndefined()
    expect(html({ numero: 9, estado: 'libre', tamano: 'compacta', deshabilitada: true })).toContain('opacity-20')
    expect(html({ numero: 9, estado: 'libre', tamano: 'tactil', deshabilitada: true })).toContain('opacity-30')
  })

  it('compacta: número afuera del lado pedido; táctil: número adentro', () => {
    const izq = html({ numero: 51, tamano: 'compacta', numberSide: 'left' })
    const der = html({ numero: 51, tamano: 'compacta', numberSide: 'right' })
    expect(izq.indexOf('51')).toBeLessThan(izq.indexOf('<button'))
    expect(der.indexOf('51')).toBeGreaterThan(der.indexOf('<button'))
    const tactil = html({ numero: 51, tamano: 'tactil' })
    expect(tactil.startsWith('<button')).toBe(true)
    expect(tactil).toContain('>51<')
  })

  it('pasa los data-* al botón (deep link del CRM)', () => {
    expect(html({ numero: 1, tamano: 'tactil', 'data-deeplink-id': 'abc' })).toContain('data-deeplink-id="abc"')
  })
})
