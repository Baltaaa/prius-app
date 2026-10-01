import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import { Lock, Eye, EyeOff, Loader2, Check, X } from 'lucide-react'

const REQS = [
  { key: 'len', label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { key: 'letra', label: 'Al menos una letra', test: (p) => /[a-zA-Z]/.test(p) },
  { key: 'numero', label: 'Al menos un número', test: (p) => /\d/.test(p) },
]

// Pantalla de cambio de contraseña (Tarea 4): la usan dos flujos — primer
// ingreso con debe_cambiar_password=true (bloquea el resto de la app, ver
// PrivateRoute) y el link de /restablecer-contrasena (evento PASSWORD_RECOVERY).
// Un solo componente para no duplicar la validación en dos lugares.
export default function CambiarContrasena({ modoRecuperacion = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { refetchPerfil, signOut } = useAuth()

  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkInvalido, setLinkInvalido] = useState(false)

  useEffect(() => {
    if (!modoRecuperacion) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') setLinkInvalido(false)
    })
    // Si después de un momento no hay sesión de recuperación, el link venció/es inválido.
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) setLinkInvalido(true)
    }, 1500)
    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [modoRecuperacion])

  const cumple = REQS.every((r) => r.test(password))
  const coincide = password.length > 0 && password === repetir

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!cumple) { setError('La contraseña no cumple los requisitos.'); return }
    if (!coincide) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password })
      if (updErr) {
        setError(updErr.message.includes('different') ? 'Tiene que ser distinta de la anterior.' : 'No se pudo cambiar la contraseña.')
        setLoading(false)
        return
      }
      if (!modoRecuperacion) {
        await supabase.rpc('marcar_password_cambiada')
        await refetchPerfil()
      }
      const destino = location.state?.from || '/app/home'
      navigate(destino, { replace: true })
    } catch {
      setError('Error de conexión.')
      setLoading(false)
    }
  }

  if (linkInvalido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0d14] px-6">
        <div className="max-w-sm w-full bg-[#0a0d14]/90 border border-white/10 rounded-[32px] p-8 text-center space-y-4">
          <p className="text-white font-bold">El enlace venció o ya se usó.</p>
          <button
            onClick={() => navigate('/recuperar')}
            className="w-full h-14 bg-[#FDE047] hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-full transition-all"
          >
            Pedir uno nuevo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0d14] px-6">
      <div className="max-w-sm w-full bg-[#0a0d14]/90 border border-white/10 rounded-[32px] p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-white">
            {modoRecuperacion ? 'Elegí tu nueva contraseña' : 'Cambiá tu contraseña'}
          </h1>
          {!modoRecuperacion && (
            <p className="text-white/50 text-sm mt-2">Es tu primer ingreso — definí una contraseña nueva para seguir.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="Nueva contraseña"
              style={{ fontSize: 16 }}
              className="w-full h-14 pl-14 pr-14 bg-white/[0.03] border border-white/10 rounded-full outline-none text-white focus:border-[#FDE047]/50"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <input
            type={show ? 'text' : 'password'}
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            autoComplete="new-password"
            required
            placeholder="Repetir contraseña"
            style={{ fontSize: 16 }}
            className="w-full h-14 px-6 bg-white/[0.03] border border-white/10 rounded-full outline-none text-white focus:border-[#FDE047]/50"
          />

          <div className="space-y-1.5 px-2">
            {REQS.map((r) => {
              const ok = r.test(password)
              return (
                <div key={r.key} className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${ok ? 'text-green-400' : 'text-white/30'}`}>
                  {ok ? <Check size={12} /> : <X size={12} />} {r.label}
                </div>
              )
            })}
          </div>

          {error && <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">{error}</p>}

          <button
            type="submit"
            disabled={loading || !cumple || !coincide}
            className="w-full h-14 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-black text-xs uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Guardar y continuar'}
          </button>

          {!modoRecuperacion && (
            <button type="button" onClick={signOut} className="w-full text-center text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-widest">
              Cerrar sesión
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
