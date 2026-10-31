import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { User, Shield, DollarSign, Save, Check } from 'lucide-react'
import MoneyInput from '../../components/inputs/MoneyInput'
import BrandSelect from '../../components/ui/BrandSelect'
import LoadingButton from '../../components/ui/LoadingButton'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import { formatPesos, formatFecha } from '../../lib/format'

export default function Perfil() {
  const [userEmail, setUserEmail] = useState('')
  const [tarifaCarpa, setTarifaCarpa] = useState(() => Number(localStorage.getItem('prius_tarifa_carpa')) || 1500000)
  const [tarifaSombrilla, setTarifaSombrilla] = useState(() => Number(localStorage.getItem('prius_tarifa_sombrilla')) || 900000)
  const [saved, setSaved] = useState(false)
  // Cotización del dólar (31/10/2026): qué fuente usa el balneario para
  // convertir los pagos en USD. Solo superadmin — es una decisión de negocio
  // y la policy de config_tipo_cambio lo valida igual del lado del servidor.
  const tc = useTipoCambio()
  const { toast } = useDialog()
  const puedeEditarCotizacion = usePermiso('ajustes_precio')
  const [guardandoTc, setGuardandoTc] = useState(false)
  const [tcTipo, setTcTipo] = useState('oficial')
  const [tcLado, setTcLado] = useState('venta')
  useEffect(() => { setTcTipo(tc.tipo); setTcLado(tc.lado) }, [tc.tipo, tc.lado])

  const handleGuardarCotizacion = async () => {
    setGuardandoTc(true)
    try {
      const { error } = await supabase
        .from('config_tipo_cambio')
        .update({ tipo: tcTipo, lado: tcLado, updated_at: new Date().toISOString() })
        .eq('id', true)
      if (error) throw error
      await tc.refrescar()
      toast('Cotización actualizada', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo guardar la cotización.', { tone: 'error' })
    } finally {
      setGuardandoTc(false)
    }
  }

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
              className="w-full py-4 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl flex items-center justify-center gap-2"
            >
              {saved ? <><Check size={16} /> Guardado</> : <><Save size={16} /> Actualizar Tarifas</>}
            </button>
          </div>
        </div>

        {/* Cotización del dólar */}
        <div className="card-light p-8 rounded-3xl card-light-inner space-y-8">
          <div className="flex items-center gap-3 border-b border-hairline pb-8">
            <DollarSign className="text-gold" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-black">Cotización del dólar</h2>
          </div>

          <div className="space-y-6">
            <p className="text-xs text-prius-slate">
              Define qué cotización se usa para convertir a pesos los pagos en dólares. El peso sigue
              siendo la moneda de la caja y los reportes.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Fuente</label>
                <BrandSelect
                  value={tcTipo}
                  onChange={setTcTipo}
                  disabled={!puedeEditarCotizacion}
                  options={[{ value: 'oficial', label: 'Oficial' }, { value: 'blue', label: 'Blue' }]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Valor</label>
                <BrandSelect
                  value={tcLado}
                  onChange={setTcLado}
                  disabled={!puedeEditarCotizacion}
                  options={[{ value: 'venta', label: 'Venta' }, { value: 'compra', label: 'Compra' }]}
                />
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2 p-3 bg-prius-subtle border border-hairline rounded-xl">
              <span className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Cotización de hoy</span>
              <span className="text-headline-sm text-black tabular-nums">
                {tc.valor ? formatPesos(tc.valor) : '—'}
                {tc.fecha && <span className="text-body-sm text-prius-slate font-normal"> · {formatFecha(tc.fecha)}</span>}
                {tc.stale && <span className="text-body-sm text-amber-500 font-semibold"> · no es de hoy</span>}
              </span>
            </div>

            {puedeEditarCotizacion && (
              <LoadingButton
                loading={guardandoTc}
                loadingText="Guardando..."
                onClick={handleGuardarCotizacion}
                className="w-full py-4 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <Save size={16} /> Guardar cotización
              </LoadingButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
