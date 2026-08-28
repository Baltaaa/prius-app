import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { User, Shield, DollarSign, Save, Check } from 'lucide-react'

export default function Perfil() {
  const [userEmail, setUserEmail] = useState('')
  const [tarifaCarpa, setTarifaCarpa] = useState(() => localStorage.getItem('prius_tarifa_carpa') || '1500000')
  const [tarifaSombrilla, setTarifaSombrilla] = useState(() => localStorage.getItem('prius_tarifa_sombrilla') || '900000')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || 'Admin')
    })
  }, [])

  const handleGuardarTarifas = () => {
    localStorage.setItem('prius_tarifa_carpa', tarifaCarpa)
    localStorage.setItem('prius_tarifa_sombrilla', tarifaSombrilla)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Perfil y Tarifas</h1>
        <p className="text-gray-400 text-sm mt-2">Configuración de cuenta y valores de temporada.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-3xl glass-card-inner space-y-8">
          <div className="flex items-center gap-6 border-b border-white/5 pb-8">
            <div className="w-16 h-16 bg-[#FDE047] text-black rounded-2xl flex items-center justify-center font-bold text-2xl shadow-[0_0_20px_rgba(253,224,71,0.2)]">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight uppercase">{userEmail.split('@')[0]}</h2>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mt-1">Administración General</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Email</span>
              <span className="text-white text-sm font-medium">{userEmail}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Seguridad</span>
              <span className="text-green-400 text-xs font-bold uppercase flex items-center gap-1">
                <Shield size={12} /> Protegida
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl glass-card-inner space-y-8">
          <div className="flex items-center gap-3 border-b border-white/5 pb-8">
            <DollarSign className="text-[#FDE047]" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Tarifas Base</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Precio Base Carpa</label>
              <input
                type="number"
                value={tarifaCarpa}
                onChange={(e) => setTarifaCarpa(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-[#FDE047]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Precio Base Sombrilla</label>
              <input
                type="number"
                value={tarifaSombrilla}
                onChange={(e) => setTarifaSombrilla(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-[#FDE047]"
              />
            </div>
            <button
              onClick={handleGuardarTarifas}
              className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl flex items-center justify-center gap-2"
            >
              {saved ? <><Check size={16} /> Guardado</> : <><Save size={16} /> Actualizar Tarifas</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}