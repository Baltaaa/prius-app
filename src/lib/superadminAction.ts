// Confirmación con contraseña de superadmin para acciones sensibles
// (mini-prompt 26/10/2026) — único punto del front que llama la Edge
// Function `superadmin-action`. La verificación real de la contraseña y
// el chequeo de rol pasan del lado servidor (nunca acá); este helper solo
// empaqueta la llamada y traduce el error a algo que el modal pueda
// mostrar. Ver supabase/functions/superadmin-action/index.ts.
import { supabase } from './supabase'

export type AccionSuperadmin =
  | 'eliminar_reserva'
  | 'eliminar_cliente'
  | 'quitar_cosocio'
  | 'eliminar_lead'
  | 'anular_pago'
  | 'editar_comprobante'
  | 'editar_monto_pago_vigente'
  | 'cambiar_estado_pago_manual'
  | 'revertir_estado_pago_automatico'
  | 'reabrir_caja'

export class SuperadminActionError extends Error {
  code: string
  bloqueadoHasta: string | null
  constructor(message: string, code: string, bloqueadoHasta: string | null = null) {
    super(message)
    this.code = code
    this.bloqueadoHasta = bloqueadoHasta
  }
}

// `supabase.functions.invoke` ya manda el Authorization: Bearer <JWT de la
// sesión actual> solo — nunca hay que armarlo a mano. Si la Edge Function
// responde != 2xx, supabase-js tira un FunctionsHttpError cuyo `.context`
// es el Response crudo: hay que leer el JSON de ahí para el mensaje real
// (mensaje/error/bloqueado_hasta), si no se pierde toda la info útil.
export async function ejecutarAccionSuperadmin(
  accion: AccionSuperadmin,
  params: Record<string, unknown>,
  password: string,
) {
  const { data, error } = await supabase.functions.invoke('superadmin-action', {
    body: { accion, params, password },
  })
  if (error) {
    let cuerpo: { error?: string; mensaje?: string; bloqueado_hasta?: string } | null = null
    try {
      cuerpo = await error.context?.json()
    } catch {
      cuerpo = null
    }
    throw new SuperadminActionError(
      cuerpo?.mensaje || error.message || 'No se pudo completar la acción.',
      cuerpo?.error || 'interno',
      cuerpo?.bloqueado_hasta || null,
    )
  }
  return data
}
