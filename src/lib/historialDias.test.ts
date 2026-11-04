import { describe, expect, it } from 'vitest'
import { agruparPorDia, diaDeEvento, etiquetaDia, limitesDeRango, sumarDias } from './historialDias'

// Instante (ISO UTC) de una hora local de Buenos Aires: ART = UTC-3.
const art = (dia: string, hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  const d = new Date(`${dia}T00:00:00.000Z`)
  d.setUTCHours(h + 3, m)
  return d.toISOString()
}

describe('diaDeEvento', () => {
  it('un evento a las 23:30 hora local cae en su día, no en el siguiente (UTC)', () => {
    expect(diaDeEvento({ ts: art('2026-11-03', '23:30'), fecha_ref: '2026-11-04' })).toBe('2026-11-03')
  })
  it('22:23 y 23:41 del martes no son del miércoles', () => {
    expect(diaDeEvento({ ts: art('2026-11-03', '22:23') })).toBe('2026-11-03')
    expect(diaDeEvento({ ts: art('2026-11-03', '23:41') })).toBe('2026-11-03')
    expect(diaDeEvento({ ts: art('2026-11-04', '00:52') })).toBe('2026-11-04')
  })
  it('límites exactos: 00:00 local abre el día y 23:59:59 lo cierra', () => {
    expect(diaDeEvento({ ts: '2026-11-04T03:00:00.000Z' })).toBe('2026-11-04')
    expect(diaDeEvento({ ts: '2026-11-04T02:59:59.999Z' })).toBe('2026-11-03')
    expect(diaDeEvento({ ts: '2026-11-05T02:59:59.999Z' })).toBe('2026-11-04')
  })
  it('sin ts usa fecha_ref; sin nada devuelve null', () => {
    expect(diaDeEvento({ fecha_ref: '2026-10-30' })).toBe('2026-10-30')
    expect(diaDeEvento({})).toBeNull()
  })
})

describe('agruparPorDia', () => {
  const evs = [
    { id: 'a', ts: art('2026-11-04', '00:52'), fecha_ref: '2026-11-04' },
    { id: 'b', ts: art('2026-11-03', '23:41'), fecha_ref: '2026-11-04' },
    { id: 'c', ts: art('2026-11-03', '22:23'), fecha_ref: '2026-11-04' },
    { id: 'd', ts: art('2026-11-01', '10:00'), fecha_ref: '2026-11-01' },
    { id: 'e' },
  ]
  it('separa por día calendario argentino, más nuevo primero y sin fecha al final', () => {
    const g = agruparPorDia(evs)
    expect(g.map(([d]) => d)).toEqual(['2026-11-04', '2026-11-03', '2026-11-01', 'sin-fecha'])
    expect(g[0][1].map((e: { id?: string }) => e.id)).toEqual(['a'])
    expect(g[1][1].map((e: { id?: string }) => e.id)).toEqual(['b', 'c'])
  })
})

describe('limitesDeRango', () => {
  it('toma el día completo en hora de Buenos Aires', () => {
    const l = limitesDeRango('2026-11-03', '2026-11-04')
    expect(new Date(l.desde!).toISOString()).toBe('2026-11-03T03:00:00.000Z')
    expect(new Date(l.hasta!).toISOString()).toBe('2026-11-05T02:59:59.999Z')
  })
  it('un evento a las 23:30 del último día entra en el rango', () => {
    const l = limitesDeRango('2026-11-03', '2026-11-03')
    const ts = new Date(art('2026-11-03', '23:30')).getTime()
    expect(ts).toBeGreaterThanOrEqual(new Date(l.desde!).getTime())
    expect(ts).toBeLessThanOrEqual(new Date(l.hasta!).getTime())
  })
})

describe('sumarDias / etiquetaDia', () => {
  it('cruza fin de mes y de año', () => {
    expect(sumarDias('2026-11-01', -1)).toBe('2026-10-31')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('Hoy, Ayer y sin fecha', () => {
    expect(etiquetaDia('2026-11-04', '2026-11-04')).toBe('Hoy')
    expect(etiquetaDia('2026-11-03', '2026-11-04')).toBe('Ayer')
    expect(etiquetaDia('sin-fecha', '2026-11-04')).toBe('Sin fecha')
  })
})
