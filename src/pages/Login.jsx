import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowUpRight, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react"
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
  const [recoverError, setRecoverError] = useState("")

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
      setError("Error de conexión. Verificá tu acceso a internet.")
      setIsLoading(false)
    }
  }

  const handleRecover = async (e) => {
    e.preventDefault()
    setRecoverError("")
    setRecoverStatus("sending")

    try {
      const { error: recoverErr } = await supabase.auth.resetPasswordForEmail(recoverEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (recoverErr) {
        setRecoverStatus("error")
        setRecoverError("No pudimos enviar el email. Verificá la dirección.")
        return
      }

      setRecoverStatus("sent")
    } catch (err) {
      setRecoverStatus("error")
      setRecoverError("Error de conexión. Intentá nuevamente.")
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#0a0d14] font-sans overflow-hidden selection:bg-[#FDE047] selection:text-black">
      {isSuccess && <GlobalLoader message="Iniciando sesión segura" />}

      {/* Background with Dark Atmosphere */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0d14] via-[#0a0d14]/90 to-transparent z-10" />
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#FDE047]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Glass Card Container */}
      <main className="relative z-10 w-full max-w-[440px] p-6 animate-premium-fade">
        <div className="glass-card rounded-[32px] p-10 border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          
          {/* Header Brand */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-[#0a0d14] border border-[#FDE047]/30 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(253,224,71,0.1)] mb-4">
              <img 
                src="/images/prius-icon.png" 
                alt="Prius Logo" 
                className="w-10 h-10 object-contain"
              />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white tracking-tight italic">
                Prius<span className="text-[#FDE047] not-italic font-medium">Admin</span>
              </h2>
              <p className="text-[10px] text-gray-500 font-bold tracking-[0.3em] uppercase mt-1">Playa Grande</p>
            </div>
          </div>

          {mode === "login" ? (
            <>
              <div className="mb-8">
                <h1 className="text-xl font-bold text-white tracking-tight">Acceso Staff</h1>
                <p className="text-gray-400 text-xs mt-1">Ingresá tus credenciales autorizadas.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="CORREO ELECTRÓNICO"
                      className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl outline-none text-white text-xs font-bold tracking-wider uppercase focus:border-[#FDE047]/50 focus:bg-white/[0.08] transition-all"
                    />
                  </div>

                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="CONTRASEÑA"
                      className="w-full h-14 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl outline-none text-white text-xs font-bold tracking-wider uppercase focus:border-[#FDE047]/50 focus:bg-white/[0.08] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-500 hover:text-gray-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#FDE047] focus:ring-0 accent-[#FDE047]"
                    />
                    <span>Recordarme</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setMode("recover")}
                    className="text-gray-500 hover:text-[#FDE047] transition-colors"
                  >
                    ¿Olvidaste la clave?
                  </button>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-[#FDE047] hover:bg-yellow-300 active:scale-[0.98] text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all shadow-xl shadow-yellow-400/5 flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      INGRESAR AL PANEL <ArrowUpRight size={18} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">Recuperar acceso</h2>
                <p className="text-gray-400 text-xs">Te enviaremos un link a tu correo oficial.</p>
              </div>

              {recoverStatus === "sent" ? (
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-widest">
                    <CheckCircle2 size={16} />
                    <span>Correo enviado</span>
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed uppercase font-semibold">
                    Revisá la bandeja de entrada de <strong className="text-white">{recoverEmail}</strong>.
                  </p>
                  <button
                    onClick={() => setMode("login")}
                    className="text-[10px] font-bold text-[#FDE047] uppercase tracking-widest underline underline-offset-4"
                  >
                    Volver al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecover} className="space-y-4">
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={recoverEmail}
                      onChange={(e) => setRecoverEmail(e.target.value)}
                      required
                      placeholder="CORREO REGISTRADO"
                      className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl outline-none text-white text-xs font-bold tracking-wider uppercase focus:border-[#FDE047]/50 focus:bg-white/[0.08] transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={recoverStatus === "sending"}
                    className="w-full h-14 bg-[#FDE047] hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-[0.15em] rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {recoverStatus === "sending" ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      "RECUPERAR CONTRASEÑA"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-center text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest flex items-center justify-center gap-2 pt-2"
                  >
                    <ArrowLeft size={14} /> Volver
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="absolute bottom-6 left-0 right-0 z-10 text-center px-4">
        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.4em]">
          PRIUSADMIN &bull; BALNEARIO PLAYA GRANDE &bull; SISTEMA RESTRINGIDO
        </p>
      </footer>
    </div>
  )
}