import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowUpRight, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react"
import GlobalLoader from "../components/ui/GlobalLoader"

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  // Recuperación de contraseña
  const [mode, setMode] = useState("login") // "login" | "recover"
  const [recoverEmail, setRecoverEmail] = useState("")
  const [recoverStatus, setRecoverStatus] = useState("idle") // idle | sending | sent | error

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/app/home")
    })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError("Email o contraseña incorrectos.")
        setIsLoading(false)
        return
      }

      if (data?.user) {
        setIsSuccess(true)
        setTimeout(() => {
          navigate("/app/home")
        }, 1200)
      }
    } catch (err) {
      setError("Error de conexión.")
      setIsLoading(false)
    }
  }

  const handleRecover = async (e) => {
    e.preventDefault()
    setRecoverStatus("sending")
    try {
      const { error: recoverErr } = await supabase.auth.resetPasswordForEmail(recoverEmail)
      if (recoverErr) {
        setRecoverStatus("error")
        return
      }
      setRecoverStatus("sent")
    } catch (err) {
      setRecoverStatus("error")
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-end bg-[#0a0d14] font-sans overflow-hidden px-6 md:px-24 selection:bg-[#FDE047] selection:text-black">
      {isSuccess && <GlobalLoader message="Iniciando sesión segura" />}

      {/* Fullscreen Background Image with Modern CRM Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/images/hero-login.webp" 
          alt="Prius Playa Grande" 
          className="w-full h-full object-cover scale-105 animate-slow-zoom"
        />
        {/* Modern Multi-layer Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0d14]/40 via-transparent to-[#0a0d14] z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/20 to-transparent z-10" />
        <div className="absolute inset-0 bg-[#0a0d14]/10 backdrop-grayscale-[0.2] z-10" />
      </div>

      {/* Glass Card Container (Right Aligned) */}
      <main className="relative z-20 w-full max-w-[480px] animate-premium-fade">
        <div className="bg-[#0a0d14]/70 backdrop-blur-2xl rounded-[40px] p-10 border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative group">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
          
          {/* Header Brand */}
          <div className="flex items-center gap-3 mb-12 relative z-10">
            <div className="w-10 h-10 bg-[#0a0d14] border border-[#FDE047]/30 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(253,224,71,0.15)] p-2">
              <img src="/images/prius-icon.png" alt="P" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xl font-bold text-white italic">Prius<span className="text-[#FDE047] not-italic font-medium">Admin</span></span>
               <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest pt-1 border-l border-white/10 pl-2">ESTATE</span>
            </div>
          </div>

          {mode === "login" ? (
            <div className="space-y-8 relative z-10">
              <div>
                <h1 className="text-5xl font-bold text-white tracking-tight mb-2">Iniciar sesión</h1>
                <p className="text-white/50 text-sm font-medium">Acceso exclusivo para el equipo Prius.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="relative group">
                    <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#FDE047] transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="CORREO ELECTRÓNICO"
                      className="w-full h-16 pl-14 pr-4 bg-white/[0.03] border border-white/10 rounded-full outline-none text-white text-[11px] font-bold tracking-widest uppercase focus:border-[#FDE047]/50 focus:bg-white/[0.08] transition-all placeholder:text-white/20"
                    />
                  </div>

                  <div className="relative group">
                    <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#FDE047] transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="CONTRASEÑA"
                      className="w-full h-16 pl-14 pr-14 bg-white/[0.03] border border-white/10 rounded-full outline-none text-white text-[11px] font-bold tracking-widest uppercase focus:border-[#FDE047]/50 focus:bg-white/[0.08] transition-all placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-white/40">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#FDE047] focus:ring-0 accent-[#FDE047]"
                    />
                    <span className="uppercase tracking-widest">Recordar equipo</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setMode("recover")}
                    className="hover:text-[#FDE047] transition-colors uppercase tracking-widest underline underline-offset-4"
                  >
                    Recuperar clave
                  </button>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-16 bg-[#FDE047] hover:bg-yellow-300 active:scale-[0.98] text-black font-black text-xs uppercase tracking-[0.2em] rounded-full transition-all shadow-xl shadow-yellow-400/10 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      INGRESAR AL PANEL <ArrowUpRight size={20} />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-8 relative z-10">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Recuperar cuenta</h2>
                <p className="text-white/50 text-sm">Enviaremos un enlace seguro a tu email.</p>
              </div>

              {recoverStatus === "sent" ? (
                <div className="p-8 bg-green-500/5 border border-green-500/20 rounded-[32px] space-y-4">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-widest">
                    <CheckCircle2 size={16} />
                    <span>Correo enviado con éxito</span>
                  </div>
                  <p className="text-white/60 text-xs leading-relaxed uppercase font-semibold">Revisá tu casilla para continuar con la restauración.</p>
                  <button
                    onClick={() => setMode("login")}
                    className="text-[10px] font-bold text-[#FDE047] uppercase tracking-widest underline underline-offset-4 pt-2 block"
                  >
                    Volver al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecover} className="space-y-6">
                  <div className="relative group">
                    <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#FDE047] transition-colors" />
                    <input
                      type="email"
                      value={recoverEmail}
                      onChange={(e) => setRecoverEmail(e.target.value)}
                      required
                      placeholder="CORREO ELECTRÓNICO"
                      className="w-full h-16 pl-14 pr-4 bg-white/[0.03] border border-white/10 rounded-full outline-none text-white text-[11px] font-bold tracking-widest uppercase focus:border-[#FDE047]/50 focus:bg-white/[0.08] transition-all placeholder:text-white/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={recoverStatus === "sending"}
                    className="w-full h-16 bg-[#FDE047] hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-[0.15em] rounded-full transition-all flex items-center justify-center gap-2"
                  >
                    {recoverStatus === "sending" ? <Loader2 size={20} className="animate-spin" /> : "ENVIAR INSTRUCCIONES"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-center text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={16} /> Volver
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="absolute bottom-10 left-0 right-0 z-10 text-center px-4">
        <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.6em]">
          PRIUSADMIN &bull; BALNEARIO PLAYA GRANDE &bull; SISTEMA AUTORIZADO
        </p>
      </footer>

      <style>{`
        @keyframes slow-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 20s infinite alternate ease-in-out;
        }
      `}</style>
    </div>
  )
}