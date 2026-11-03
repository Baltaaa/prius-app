// Único punto del front que llama a una Edge Function (hotfix 03/11/2026):
// TODA invocación pasa por acá — nunca `supabase.functions.invoke` directo.
// supabase-js devuelve errores técnicos en inglés ("Failed to send a request
// to the Edge Function"); acá se traducen a mensajes de negocio en español.
//
//   FunctionsFetchError / FunctionsRelayError -> no se pudo conectar (CORS,
//     red caída, función no desplegada). `esConexion: true`: el pedido pudo
//     o no haber llegado — quien llama debe releer el estado antes de
//     reintentar una acción que escribe.
//   FunctionsHttpError -> la función respondió != 2xx: se lee el body y se
//     usa su `mensaje` (contraseña incorrecta, intentos restantes, bloqueado).
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const MENSAJE_CONEXION = 'No pudimos conectar con el servidor. Revisá la conexión e intentá de nuevo.'
export const MENSAJE_GENERICO = 'No pudimos completar la acción. Probá de nuevo en unos minutos.'

type CuerpoError = {
  error?: string
  mensaje?: string
  bloqueado_hasta?: string
  intentos_restantes?: number | null
}

export class FuncionError extends Error {
  code: string
  status: number | null
  esConexion: boolean
  bloqueadoHasta: string | null
  constructor(
    message: string,
    code: string,
    opts: { status?: number | null; esConexion?: boolean; bloqueadoHasta?: string | null } = {},
  ) {
    super(message)
    this.name = 'FuncionError'
    this.code = code
    this.status = opts.status ?? null
    this.esConexion = opts.esConexion ?? false
    this.bloqueadoHasta = opts.bloqueadoHasta ?? null
  }
}

function mensajeBloqueado(bloqueadoHasta: string | null): string {
  const ms = bloqueadoHasta ? new Date(bloqueadoHasta).getTime() - Date.now() : NaN
  if (!Number.isFinite(ms) || ms <= 0) {
    return 'Demasiados intentos con contraseña incorrecta. Probá de nuevo en unos minutos.'
  }
  const minutos = Math.max(1, Math.ceil(ms / 60000))
  return `Demasiados intentos con contraseña incorrecta. Probá de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`
}

function mensajePorStatus(status: number): string {
  if (status === 401) return 'Tu sesión venció. Volvé a iniciar sesión.'
  if (status === 403) return 'No tenés permiso para hacer esto.'
  if (status === 429) return 'Demasiados intentos. Esperá un momento y probá de nuevo.'
  if (status === 400) return 'Los datos enviados no son válidos. Revisalos e intentá de nuevo.'
  return MENSAJE_GENERICO
}

/** Traduce lo que devuelve (o tira) `supabase.functions.invoke` a un FuncionError en español. */
export async function traducirErrorFuncion(error: unknown): Promise<FuncionError> {
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return new FuncionError(MENSAJE_CONEXION, 'conexion', { esConexion: true })
  }
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response | undefined
    const status = res?.status ?? null
    let cuerpo: CuerpoError | null = null
    try {
      cuerpo = await res?.clone().json()
    } catch {
      cuerpo = null
    }
    const code = cuerpo?.error || 'interno'
    const bloqueadoHasta = cuerpo?.bloqueado_hasta || null
    const mensaje =
      code === 'bloqueado'
        ? mensajeBloqueado(bloqueadoHasta)
        : cuerpo?.mensaje || mensajePorStatus(status ?? 500)
    return new FuncionError(mensaje, code, { status, bloqueadoHasta })
  }
  if (error instanceof FuncionError) return error
  // Excepción suelta (p. ej. TypeError "Failed to fetch" antes de armar la
  // request): para el usuario es lo mismo que no tener conexión.
  return new FuncionError(MENSAJE_CONEXION, 'conexion', { esConexion: true })
}

type Opciones = { body?: Record<string, unknown>; method?: 'GET' | 'POST' }

/**
 * Invoca una Edge Function. Devuelve `data` o tira un `FuncionError` con
 * mensaje en español. `nombre` puede incluir query string (`clima-playa?fecha=...`).
 */
export async function invocarFuncion<T = unknown>(nombre: string, opciones: Opciones = {}): Promise<T> {
  let resultado
  try {
    resultado = await supabase.functions.invoke(nombre, opciones)
  } catch (err) {
    throw await traducirErrorFuncion(err)
  }
  if (resultado.error) throw await traducirErrorFuncion(resultado.error)
  return resultado.data as T
}
