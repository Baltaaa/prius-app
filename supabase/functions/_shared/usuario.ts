// Usuario logueado de la landing (Fase 5A, nov 2026): cuentas de clientes con
// Google. Lee el `Authorization: Bearer <access_token>` y lo valida contra
// Supabase Auth con getUser() (no alcanza con decodificar el JWT: getUser
// confirma que la sesión existe y no fue revocada).
//
// Ojo: un token válido NO significa "personal del CRM". Para eso hay que
// mirar `perfiles` (ver generar-reporte-pdf / superadmin-action). Acá solo
// se identifica a un cliente.
import type { SupabaseClient, User } from "jsr:@supabase/supabase-js@2"

export function tokenDelRequest(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? ""
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/** Usuario de Supabase Auth del request, o null si no hay token o no es válido. */
export async function usuarioDelRequest(supabase: SupabaseClient, req: Request): Promise<User | null> {
  const token = tokenDelRequest(req)
  if (!token) return null
  // La anon/publishable key también viaja como Bearer cuando no hay sesión:
  // getUser la rechaza (no es el token de un usuario), así que cae en null.
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
