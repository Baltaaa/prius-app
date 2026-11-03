import { describe, expect, it, vi } from 'vitest'
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'

const invoke = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

import { FuncionError, MENSAJE_CONEXION, invocarFuncion } from './invocarFuncion'

const http = (status: number, cuerpo: unknown) =>
  new FunctionsHttpError(new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status }))

const capturar = (p: Promise<unknown>) =>
  p.then(
    () => { throw new Error('invocarFuncion no tiró') },
    (e: unknown) => e as FuncionError,
  )

describe('invocarFuncion', () => {
  it('devuelve data cuando la función responde bien', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null })
    await expect(invocarFuncion('x')).resolves.toEqual({ ok: true })
  })

  it('FunctionsFetchError -> mensaje de conexión en español, marcado esConexion', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new TypeError('Failed to fetch')) })
    const err = await capturar(invocarFuncion('x'))
    expect(err).toBeInstanceOf(FuncionError)
    expect(err.message).toBe(MENSAJE_CONEXION)
    expect(err.esConexion).toBe(true)
  })

  it('FunctionsRelayError -> mismo mensaje de conexión', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsRelayError({ message: 'relay' }) })
    const err = await capturar(invocarFuncion('x'))
    expect(err.message).toBe(MENSAJE_CONEXION)
    expect(err.esConexion).toBe(true)
  })

  it('excepción suelta (TypeError) -> mensaje de conexión', async () => {
    invoke.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const err = await capturar(invocarFuncion('x'))
    expect(err.message).toBe(MENSAJE_CONEXION)
    expect(err.esConexion).toBe(true)
  })

  it('FunctionsHttpError -> usa el mensaje de negocio del body, sin esConexion', async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: http(401, { ok: false, error: 'password_incorrecta', mensaje: 'Contraseña incorrecta. Te quedan 4 intentos.' }),
    })
    const err = await capturar(invocarFuncion('x'))
    expect(err.message).toBe('Contraseña incorrecta. Te quedan 4 intentos.')
    expect(err.code).toBe('password_incorrecta')
    expect(err.status).toBe(401)
    expect(err.esConexion).toBe(false)
  })

  it('bloqueado -> minutos restantes calculados desde bloqueado_hasta', async () => {
    const hasta = new Date(Date.now() + 14 * 60000 + 30000).toISOString()
    invoke.mockResolvedValueOnce({
      data: null,
      error: http(429, { ok: false, error: 'bloqueado', mensaje: 'x', bloqueado_hasta: hasta }),
    })
    const err = await capturar(invocarFuncion('x'))
    expect(err.message).toBe('Demasiados intentos con contraseña incorrecta. Probá de nuevo en 15 minutos.')
    expect(err.code).toBe('bloqueado')
  })

  it('FunctionsHttpError con body ilegible -> mensaje por status, nunca en inglés', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: http(503, '<html>Service Unavailable</html>') })
    const err = await capturar(invocarFuncion('x'))
    expect(err.message).toMatch(/Probá de nuevo/)
    expect(err.message).not.toMatch(/Edge Function|Failed/)
    expect(err.esConexion).toBe(false)
  })
})
