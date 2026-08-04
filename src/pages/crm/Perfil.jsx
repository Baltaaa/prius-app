import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { User, Shield, DollarSign, Save } from 'lucide-react'

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
      <div className="border-b border-[#E5E5E5] pb-4">
        <h1 className="text-xl font-bold text-black tracking-tight">Perfil de Usuario y Tarifas</h1>
        <p className="text-xs text-neutral-500 font-normal">Información de la cuenta administradora y valores base por temporada.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User profile card */}
        <div className="bg-white border border-[#E5E5E5] rounded p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E5E5E5]">
            <div className="w-10 h-10 bg-black text-[#F2CA50] rounded flex items-center justify-center font-bold text-base">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-black">Usuario Administrador</h2>
              <p className="text-xs text-neutral-500">{userEmail}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#E5E5E5]">
              <span className="text-neutral-500">Rol de Seguridad:</span>
              <span className="font-bold text-black uppercase">Administración General</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E5E5]">
              <span className="text-neutral-500">Fecha de Alta:</span>
              <span className="font-medium text-black">{createdDate}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-neutral-500">Estado Cuenta:</span>
              <span className="font-bold text-green-700 uppercase text-[10px] bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                Activa / Segura
              </span>
            </div>
          </div>
        </div>

        {/* Seasonal rate config */}
        <div className="bg-white border border-[#E5E5E5] rounded p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E5E5E5]">
            <DollarSign size={18} className="text-black" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">Tarifas Base de Temporada</h2>
          </div>

          <form onSubmit={handleSaveTarifas} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-600 uppercase">
                Precio Base Carpa Completa ($)
              </label>
              <input
                type="number"
                value={tarifaCarpa}
                onChange={(e) => setTarifaCarpa(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-black text-xs font-semibold outline-none rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-600 uppercase">
                Precio Base Sombrilla Completa ($)
              </label>
              <input
                type="number"
                value={tarifaSombrilla}
                onChange={(e) => setTarifaSombrilla(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-black text-xs font-semibold outline-none rounded"
              />
            </div>

            {mensajeGuardado && (
              <p className="text-xs text-green-700 font-bold bg-green-50 p-2 rounded border border-green-200 text-center uppercase">
                Tarifas de referencia actualizadas
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
            >
              <Save size={15} /> Guardar Configuración
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}