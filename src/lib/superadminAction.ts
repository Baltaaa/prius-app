// Confirmación con contraseña de superadmin para acciones sensibles
// (mini-prompt 26/10/2026) — único punto del front que llama la Edge
// Function `superadmin-action`. La verificación real de la contraseña y
// el chequeo de rol pasan del lado servidor (nunca acá); este helper solo
// empaqueta la llamada (el manejo de errores vive en invocarFuncion.ts).
// Ver supabase/functions/superadmin-action/index.ts.
import { invocarFuncion } from './invocarFuncion'

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

// `invocarFuncion` ya manda el Authorization: Bearer <JWT de la sesión
// actual> (supabase-js lo agrega solo) y traduce cualquier falla a un
// FuncionError con mensaje en español: sin conexión, contraseña incorrecta
// con intentos restantes, bloqueado N minutos. Los callers solo muestran
// `err.message`; `err.esConexion` indica que el pedido pudo no haber llegado
// (o haberse aplicado sin que llegara la respuesta).
export async function ejecutarAccionSuperadmin(
  accion: AccionSuperadmin,
  params: Record<string, unknown>,
  password: string,
) {
  return invocarFuncion('superadmin-action', { body: { accion, params, password } })
}
