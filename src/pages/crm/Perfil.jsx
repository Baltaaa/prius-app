import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DollarSign, Save } from 'lucide-react'

export default function Perfil() {
  const [userEmail, setUserEmail] = useState('')
  const [createdDate, setCreatedDate] = useState('')
  
  // Seasonal Pricing config in localStorage
  const [tarifaCarpa, setTarifaCarpa] = useState(() => localStorage.getItem('prius_tarifa_carpa') || '1500000')
  const [tarifaSombrilla, setTarifaSombrilla] = useState(() => localStorage.getItem('prius_tarifa_sombrilla') || '900000')
  const [mensajeGuardado, setMensajeGuardado] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || 'Admin')
        setCreatedDate(user.created_at ? new Date(user.created_at).toLocaleDateString('es-AR') : '2025')
      }
    })
  }, [])

  const handleSaveTarifas = (e) => {
    e.preventDefault()
    localStorage.setItem('prius_tarifa_carpa', tarifaCarpa)
    localStorage.setItem('prius_tarifa_sombrilla', tarifaSombrilla)
    setMensajeGuardado(true)
    setTimeout(() => setMensajeGuardado(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-xl font-bold text-white tracking-tight">Perfil de Usuario y Tarifas</h1>
        <p className="text-xs text-white/50 font-normal">Información de la cuenta administradora y valores base por temporada.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User profile card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="w-10 h-10 bg-[#F2CA50] text-black rounded-full flex items-center justify-center font-bold text-base">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Usuario Administrador</h2>
              <p className="text-xs text-white/50">{userEmail}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/10">
              <span className="text-white/50">Rol de Seguridad:</span>
              <span className="font-bold text-white uppercase">Administración General</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/10">
              <span className="text-white/50">Fecha de Alta:</span>
              <span className="font-medium text-white">{createdDate}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/50">Estado Cuenta:</span>
              <span className="font-bold text-emerald-400 uppercase text-[10px] bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-xl">
                Activa / Segura
              </span>
            </div>
          </div>
        </div>

        {/* Seasonal rate config */}
        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <DollarSign size={18} className="text-[#F2CA50]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Tarifas Base de Temporada</h2>
          </div>

          <form onSubmit={handleSaveTarifas} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/70 uppercase">
                Precio Base Carpa Completa ($)
              </label>
              <input
                type="number"
                value={tarifaCarpa}
                onChange={(e) => setTarifaCarpa(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] text-xs text-white font-semibold outline-none rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/70 uppercase">
                Precio Base Sombrilla Completa ($)
              </label>
              <input
                type="number"
                value={tarifaSombrilla}
                onChange={(e) => setTarifaSombrilla(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-[#F2CA50] text-xs text-white font-semibold outline-none rounded-xl"
              />
            </div>

            {mensajeGuardado && (
              <p className="text-xs text-emerald-400 font-bold bg-emerald-400/10 p-2 rounded-xl border border-emerald-400/20 text-center uppercase">
                Tarifas de referencia actualizadas
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded-full transition-colors flex items-center justify-center gap-2"
            >
              <Save size={15} /> Guardar Configuración
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}