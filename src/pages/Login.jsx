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
        }, 600)
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
    <div className="relative min-h-screen w-full flex items-center justify-center md:justify-end bg-[#1A1A1A] font-sans overflow-hidden selection:bg-[#F2CA50] selection:text-[#1A1A1A] p-4 md:pr-16 lg:pr-24 xl:pr-32">
      {isSuccess && <GlobalLoader message="Ingresando al panel..." />}

      {/* Imagen de Fondo con Filtro Cálido Atardecer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="/images/hero-login.jpg"
          alt="Prius Playa Grande"
          className="w-full h-full object-cover object-center"
        />
        {/* Overlay Cálido: Gradiente ámbar/bronce para un look de atardecer de playa */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/40 via-orange-900/10 to-transparent" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Tarjeta Glassmorphic Pura (Transparente + Blur) */}
      <main className="relative z-10 w-full max-w-[420px]">
        <div className="w-full glass-card rounded-3xl shadow-2xl p-8 sm:p-9 text-white transition-all duration-300">
          
          {/* Header con Isotipo P sola */}
          <div className="mb-7">
            <div className="w-12 h-12 rounded-full bg-[#E9C46A] flex items-center justify-center text-[#1A1A1A] font-extrabold shadow-sm shrink-0">
              <span className="italic font-serif text-2xl leading-none">P</span>
            </div>
          </div>

          {mode === "login" ? (
            <>
              {/* Título & Subtítulo */}
              <div className="mb-7 space-y-1">
                <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
                  Iniciar sesión
                </h1>
                <p className="text-white/80 text-xs font-normal">
                  Ingresá tus credenciales para acceder al panel.
                </p>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Input Correo Electrónico */}
                <div className="relative flex items-center bg-white/10 border border-white/20 rounded-full px-4 h-12 transition-all focus-within:border-white/50 focus-within:bg-black/30">
                  <Mail size={16} className="text-white/80 shrink-0 mr-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="CORREO ELECTRÓNICO"
                    autoComplete="email"
                    className="w-full bg-transparent text-white placeholder-white/60 text-xs font-medium uppercase tracking-wider outline-none border-none focus:ring-0"
                  />
                </div>

                {/* Input Contraseña */}
                <div className="relative flex items-center bg-white/10 border border-white/20 rounded-full px-4 h-12 transition-all focus-within:border-white/50 focus-within:bg-black/30">
                  <Lock size={16} className="text-white/80 shrink-0 mr-3" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="CONTRASEÑA"
                    autoComplete="current-password"
                    className="w-full bg-transparent text-white placeholder-white/60 text-xs font-medium uppercase tracking-wider outline-none border-none focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-white/70 hover:text-white transition-colors ml-2 focus:outline-none"
                    aria-label="Ver contraseña"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Checkbox Mantener sesión & Olvidaste contraseña */}
                <div className="flex items-center justify-between text-xs pt-1 text-white/70 font-normal">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-white/30 bg-white/10 text-[#E9C46A] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#E9C46A]"
                    />
                    <span>Mantener sesión iniciada</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setMode("recover")}
                    className="underline text-white/70 hover:text-white transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {/* Mensaje de Error */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-white text-xs font-medium">
                    <AlertCircle size={15} className="text-red-300 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Botón Principal Dorado */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 mt-4 bg-[#E9C46A] hover:bg-[#d8b358] active:scale-[0.99] text-[#1A1A1A] font-bold text-xs uppercase tracking-widest rounded-full transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin text-[#1A1A1A]" />
                  ) : (
                    <>
                      <span>INGRESAR AL PANEL</span>
                      <ArrowUpRight size={18} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Panel de Recuperación de Contraseña */
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Recuperar acceso
                </h2>
                <p className="text-white/80 text-xs">
                  Ingresá tu correo registrado para enviarte las instrucciones.
                </p>
              </div>

              {recoverStatus === "sent" ? (
                <div className="p-4 bg-green-500/20 border border-green-500/40 rounded-2xl text-white text-xs space-y-2">
                  <div className="flex items-center gap-2 text-green-300 font-bold">
                    <CheckCircle2 size={16} />
                    <span>Enlace enviado</span>
                  </div>
                  <p className="text-white/90 leading-relaxed">
                    Te enviamos un correo a <strong className="text-white">{recoverEmail}</strong>. Por favor, revisá tu casilla.
                  </p>
                  <button
                    onClick={() => setMode("login")}
                    className="mt-3 text-xs font-bold text-[#E9C46A] underline block"
                  >
                    Volver a iniciar sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecover} className="space-y-4">
                  <div className="relative flex items-center bg-white/10 border border-white/20 rounded-full px-4 h-12 transition-all focus-within:border-white/50 focus-within:bg-black/30">
                    <Mail size={16} className="text-white/80 shrink-0 mr-3" />
                    <input
                      type="email"
                      value={recoverEmail}
                      onChange={(e) => setRecoverEmail(e.target.value)}
                      required
                      placeholder="CORREO REGISTRADO"
                      className="w-full bg-transparent text-white placeholder-white/60 text-xs font-medium uppercase tracking-wider outline-none border-none focus:ring-0"
                    />
                  </div>

                  {recoverError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-white text-xs">
                      <AlertCircle size={15} className="text-red-300 shrink-0" />
                      <span>{recoverError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={recoverStatus === "sending"}
                    className="w-full h-12 bg-[#E9C46A] hover:bg-[#d8b358] text-[#1A1A1A] font-bold text-xs uppercase tracking-widest rounded-full transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {recoverStatus === "sending" ? (
                      <Loader2 size={18} className="animate-spin text-[#1A1A1A]" />
                    ) : (
                      "ENVIAR LINK DE RECUPERACIÓN"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-center text-xs text-white/80 hover:text-white flex items-center justify-center gap-1.5 pt-1"
                  >
                    <ArrowLeft size={14} />
                    <span>Volver al inicio de sesión</span>
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Footer Fijo en la parte inferior central */}
      <footer className="absolute bottom-4 left-0 right-0 z-10 text-center px-4 pointer-events-none">
        <p className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em] drop-shadow-md">
          PRIUSADMIN &bull; ACCESO RESTRINGIDO AL STAFF
        </p>
      </footer>
    </div>
  )
}