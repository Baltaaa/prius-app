import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { User, Shield, DollarSign, Save, Check } from 'lucide-react'
import MoneyInput from '../../components/inputs/MoneyInput'

export default function Perfil() {
  const [userEmail, setUserEmail] = useState('')
  const [tarifaCarpa, setTarifaCarpa] = useState(() => Number(localStorage.getItem('prius_tarifa_carpa')) || 1500000)
  const [tarifaSombrilla, setTarifaSombrilla] = useState(() => Number(localStorage.getItem('prius_tarifa_sombrilla')) || 900000)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || 'Admin')
    })
  }, [])

  const handleGuardarTarifas = () => {
    localStorage.setItem('prius_tarifa_carpa', String(tarifaCarpa || 0))
    localStorage.setItem('prius_tarifa_sombrilla', String(tarifaSombrilla || 0))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card-light p-8 rounded-3xl card-light-inner space-y-8">
          <div className="flex items-center gap-6 border-b border-hairline pb-8">
            <div className="w-16 h-16 bg-gold text-black rounded-2xl flex items-center justify-center font-bold text-2xl shadow-[0_0_20px_rgba(253,224,71,0.2)]">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-black tracking-tight uppercase">{userEmail.split('@')[0]}</h2>
              <p className="text-prius-muted text-xs font-semibold uppercase tracking-wider mt-1">Administración General</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-hairline">
              <span className="text-prius-muted text-xs font-bold uppercase tracking-widest">Email</span>
              <span className="text-black text-sm font-medium">{userEmail}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-hairline">
              <span className="text-prius-muted text-xs font-bold uppercase tracking-widest">Seguridad</span>
              <span className="text-prius-success text-xs font-bold uppercase flex items-center gap-1">
                <Shield size={12} /> Protegida
              </span>
            </div>
          </div>
        </div>

        <div className="card-light p-8 rounded-3xl card-light-inner space-y-8">
          <div className="flex items-center gap-3 border-b border-hairline pb-8">
            <DollarSign className="text-gold" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-black">Tarifas Base</h2>
          </div>

          <div className="space-y-6">
            <MoneyInput label="🏠 Precio Base Carpa" value={tarifaCarpa} onChange={setTarifaCarpa} max={100_000_000} />
            <MoneyInput label="⛱️ Precio Base Sombrilla" value={tarifaSombrilla} onChange={setTarifaSombrilla} max={100_000_000} />
            <button
              onClick={handleGuardarTarifas}
              className="w-full py-4 bg-gold hover:bg-yellow-300 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl flex items-center justify-center gap-2"
            >
              {saved ? <><Check size={16} /> Guardado</> : <><Save size={16} /> Actualizar Tarifas</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
