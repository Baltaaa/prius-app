import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import { useDialog } from '../context/DialogProvider'
import { linkToRecepcion } from '../lib/deepLinks'

// Punto 8 (30/10/2026): el administrador tiene la misma cuenta abierta en la
// compu y en el celular. Escanea un QR con el celular y la compu reacciona en
// el momento: si ya está en Recepción abre esa reserva directo; si está en
// otra pantalla muestra un toast con "Abrir en Recepción".
//
// Va montado una sola vez en AppLayout (no en Recepcion.jsx) justamente para
// que funcione desde cualquier sección.
//
// El puente es la tabla `recepcion_eventos`, con RLS por user_id: cada
// usuario solo ve lo suyo, así que el canal nunca cruza datos entre cuentas.
export function useRecepcionRemota() {
  const { perfil } = useAuth()
  const { toast } = useDialog()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = perfil?.user_id

  // Refs (no state): el callback del canal se registra una sola vez y tiene
  // que leer SIEMPRE la ruta actual, no la que había al suscribirse.
  const locationRef = useRef(location)
  locationRef.current = location
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const toastRef = useRef(toast)
  toastRef.current = toast
  // Anti-duplicado: escanear dos veces el mismo QR no tiene que abrir la
  // reserva dos veces ni apilar toasts.
  const ultimoRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    const canal = supabase
      .channel(`recepcion-remota-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recepcion_eventos',
          filter: `user_id=eq.${userId}`,
        },
        ({ new: ev }) => {
          if (!ev || ev.tipo !== 'qr_scan') return
          if (ultimoRef.current === ev.id) return
          ultimoRef.current = ev.id

          const codigo = ev.codigo || null
          const destino = linkToRecepcion(codigo)
          const yaEnRecepcion = locationRef.current.pathname.startsWith('/app/recepcion')

          if (yaEnRecepcion) {
            // Ya está operando en Recepción: se abre la reserva sin
            // interrumpir con un toast que pediría un click de más.
            navigateRef.current(destino, { replace: true })
            return
          }

          toastRef.current(
            codigo ? `Reserva ${codigo} escaneada desde el celular` : 'Reserva escaneada desde el celular',
            {
              tone: 'info',
              action: { label: 'Abrir en Recepción', onClick: () => navigateRef.current(destino) },
            },
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [userId])
}
