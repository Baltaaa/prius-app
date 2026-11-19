import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isFeatureEnabled } from '../lib/features'

// Cuenta web (Google) vinculada a un cliente — Fase 5A, nov 2026. Única
// lectura de `clientes_cuentas` en el front: la ficha de cliente y Recepción
// usan este hook. Las reglas de vínculo viven en la base (mi_cuenta /
// completar_cuenta); acá el personal solo ve el vínculo y lo confirma o lo
// desvincula vía RPC (que valida el permiso y deja el evento en Historial).
//
// Devuelve { cuenta: { email, estado, metodo, vinculado_at } | null, ... }.
export function useCuentaWeb(clienteId) {
  const activo = isFeatureEnabled('cuentas_web')
  const [cuenta, setCuenta] = useState(null)

  const cargar = useCallback(async () => {
    if (!activo || !clienteId) {
      setCuenta(null)
      return
    }
    const { data, error } = await supabase
      .from('clientes_cuentas')
      .select('email, estado, metodo, vinculado_at')
      .eq('cliente_id', clienteId)
      .maybeSingle()
    if (!error) setCuenta(data ?? null)
  }, [activo, clienteId])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Realtime: un vínculo nuevo desde la landing o una confirmación desde
  // otro dispositivo se ve sin recargar. (Un DELETE no trae cliente_id con
  // RLS, por eso las acciones propias recargan a mano.)
  useEffect(() => {
    if (!activo || !clienteId) return undefined
    const canal = supabase
      .channel(`cuenta-web-${clienteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes_cuentas', filter: `cliente_id=eq.${clienteId}` },
        () => { cargar() },
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [activo, clienteId, cargar])

  const confirmar = useCallback(async () => {
    const { error } = await supabase.rpc('confirmar_cuenta_web', { p_cliente_id: clienteId })
    if (error) throw error
    await cargar()
  }, [clienteId, cargar])

  const desvincular = useCallback(async () => {
    const { error } = await supabase.rpc('desvincular_cuenta_web', { p_cliente_id: clienteId })
    if (error) throw error
    await cargar()
  }, [clienteId, cargar])

  return { activo, cuenta, confirmar, desvincular, recargar: cargar }
}

export const METODO_VINCULO_LABEL = {
  email: 'por email',
  alta_web: 'alta desde la web',
  dni: 'por DNI',
  telefono: 'por teléfono',
  manual: 'manual',
}
