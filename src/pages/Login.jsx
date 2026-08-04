import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react"
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
        }, 700)
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

  const backToLogin = () => {
    setMode("login")
    setRecoverStatus("idle")
    setRecoverError("")
    setRecoverEmail("")
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans bg-white text-black">
      {isSuccess && <GlobalLoader message="Ingresando al panel" />}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-3px); }
          40%, 60% { transform: translateX(3px); }
        }
        .anim-fade-up { animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-fade-in { animation: fadeIn 0.7s ease both; }
        .anim-shake { animation: shake 0.4s ease; }
        @media (prefers-reduced-motion: reduce) {
          .anim-fade-up, .anim-fade-in, .anim-shake { animation: none; }
        }
      `}</style>

      {/* Hero mobile — banda superior compacta */}
      <div className="relative lg:hidden h-[30vh] min-h-[210px] max-h-[280px] w-full overflow-hidden bg-black shrink-0">
        <img
          src="/images/hero-login.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10" />
        <div className="relative z-10 h-full flex items-end p-5 anim-fade-in">
          <BrandLockup theme="dark" />
        </div>
      </div>

      {/* Panel de marca — desktop */}
      <div className="relative hidden lg:flex lg:w-[44%] xl:w-[40%] flex-col justify-between overflow-hidden bg-black shrink-0">
        <img
          src="/images/hero-login.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_25%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

        <div className="relative z-10 p-10 xl:p-12 anim-fade-in">
          <BrandLockup theme="dark" />
        </div>

        <div className="relative z-10 p-10 xl:p-12 space-y-4">
          <h1 className="text-3xl xl:text-[2.5rem] leading-[1.15] font-bold text-white tracking-tight anim-fade-up" style={{ animationDelay: "0.1s" }}>
            El panel de gestión<br />de Playa Grande.
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs font-normal anim-fade-up" style={{ animationDelay: "0.2s" }}>
            Plano interactivo, caja diaria y reservas de temporada, todo en un mismo lugar.
          </p>
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 sm:px-10 bg-white relative -mt-5 lg:mt-0 rounded-t-lg lg:rounded-none z-10">
        <div className="w-full max-w-[380px]">

          {mode === "login" ? (
            <>
              <div className="mb-8 pb-4 border-b border-[#E5E5E5] anim-fade-up" style={{ animationDelay: "0.05s" }}>
                <h2 className="text-xl font-bold text-black tracking-tight">
                  Iniciar sesión
                </h2>
                <p className="text-xs text-neutral-500 font-normal mt-0.5">
                  Ingresá tus credenciales para acceder al panel.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
                  <FloatingInput
                    id="email"
                    type="email"
                    label="Correo electrónico"
                    value={email}
                    onChange={setEmail}
                    icon={<Mail size={15} />}
                    autoComplete="email"
                  />
                </div>

                <div className="anim-fade-up" style={{ animationDelay: "0.15s" }}>
                  <FloatingInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    label="Contraseña"
                    value={password}
                    onChange={setPassword}
                    icon={<Lock size={15} />}
                    autoComplete="current-password"
                    trailing={
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-neutral-400 hover:text-black transition-colors"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />
                </div>

                <div className="flex items-center justify-between pt-1 anim-fade-up" style={{ animationDelay: "0.2s" }}>
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <span className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="w-4 h-4 rounded-sm border border-[#E5E5E5] peer-checked:bg-black peer-checked:border-black transition-colors flex items-center justify-center">
                        {remember && <CheckCircle2 size={11} className="text-[#F2CA50]" strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-neutral-600 group-hover:text-black transition-colors">
                      Mantener sesión iniciada
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setMode("recover")}
                    className="text-xs font-semibold text-neutral-500 hover:text-black transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded anim-shake">
                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                    <p className="text-red-600 text-xs font-semibold">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 mt-2 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed anim-fade-up"
                  style={{ animationDelay: "0.25s" }}
                >
                  {isLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      Ingresar al panel
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-4 border-t border-[#E5E5E5] anim-fade-up" style={{ animationDelay: "0.3s" }}>
                <p className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  PriusAdmin &bull; Acceso restringido al staff
                </p>
              </div>
            </>
          ) : (
            <RecoverPanel
              email={recoverEmail}
              setEmail={setRecoverEmail}
              status={recoverStatus}
              error={recoverError}
              onSubmit={handleRecover}
              onBack={backToLogin}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function BrandLockup({ theme = "dark" }) {
  const isDark = theme === "dark"
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 flex items-center justify-center shrink-0 overflow-hidden rounded-md bg-white">
        <img src="/logo-prius.png" alt="Prius Logo" className="w-full h-full object-cover scale-125" />
      </div>
      <div>
        <h1 className={`font-bold text-sm tracking-tight leading-none ${isDark ? "text-white" : "text-black"}`}>
          PriusAdmin
        </h1>
        <p className={`text-[10px] font-medium tracking-wide uppercase mt-0.5 ${isDark ? "text-white/60" : "text-neutral-500"}`}>
          Playa Grande
        </p>
      </div>
    </div>
  )
}

function FloatingInput({ id, type, label, value, onChange, icon, trailing, autoComplete }) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0

  return (
    <div
      className={`flex items-center gap-2.5 h-[50px] px-3.5 border rounded bg-white transition-colors duration-150 ${
        focused ? "border-black" : "border-[#E5E5E5]"
      }`}
    >
      <span className={`transition-colors duration-150 ${focused ? "text-black" : "text-neutral-400"}`}>
        {icon}
      </span>
      <div className="relative flex-1 h-full">
        <label
          htmlFor={id}
          className={`absolute left-0 pointer-events-none transition-all duration-150 text-neutral-400 ${
            active ? "top-[6px] text-[10px] font-bold uppercase tracking-wider" : "top-1/2 -translate-y-1/2 text-xs font-medium"
          }`}
        >
          {label}
        </label>
        <input
          id={id}
          type={type}
          value={value}
          required
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full h-full bg-transparent outline-none text-xs text-black font-medium ${active ? "pt-[15px]" : ""}`}
        />
      </div>
      {trailing}
    </div>
  )
}

function RecoverPanel({ email, setEmail, status, error, onSubmit, onBack }) {
  if (status === "sent") {
    return (
      <div className="anim-fade-up">
        <div className="w-10 h-10 rounded flex items-center justify-center mb-5 bg-[#F2CA50]/20">
          <CheckCircle2 size={18} className="text-black" />
        </div>
        <h2 className="text-xl font-bold text-black tracking-tight">
          Revisá tu correo
        </h2>
        <p className="text-xs text-neutral-500 font-normal mt-2 leading-relaxed">
          Le enviamos un link de recuperación a <span className="text-black font-semibold">{email}</span>. Puede tardar unos minutos en llegar.
        </p>
        <button
          onClick={onBack}
          className="mt-8 text-xs font-bold text-black uppercase tracking-wider hover:opacity-60 transition-opacity"
        >
          Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <div className="anim-fade-up">
      <div className="mb-8 pb-4 border-b border-[#E5E5E5]">
        <h2 className="text-xl font-bold text-black tracking-tight">
          Recuperar contraseña
        </h2>
        <p className="text-xs text-neutral-500 font-normal mt-0.5">
          Ingresá tu email y te mandamos un link para restablecerla.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <FloatingInput
          id="recover-email"
          type="email"
          label="Correo electrónico"
          value={email}
          onChange={setEmail}
          icon={<Mail size={15} />}
          autoComplete="email"
        />

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded anim-shake">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-red-600 text-xs font-semibold">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full h-11 mt-2 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {status === "sending" ? <Loader2 size={15} className="animate-spin" /> : "Enviar link de recuperación"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs font-semibold text-neutral-500 hover:text-black transition-colors pt-1"
        >
          Volver al inicio de sesión
        </button>
      </form>
    </div>
  )
}
