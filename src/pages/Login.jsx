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
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans bg-white">
      {isSuccess && <GlobalLoader message="Ingresando al panel" />}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes drawLine {
          from { width: 0; }
          to { width: 40px; }
        }
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-3px); }
          40%, 60% { transform: translateX(3px); }
        }
        .anim-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-fade-in { animation: fadeIn 0.8s ease both; }
        .anim-draw-line { animation: drawLine 0.8s 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-shake { animation: shake 0.4s ease; }
        @media (prefers-reduced-motion: reduce) {
          .anim-fade-up, .anim-fade-in, .anim-draw-line, .anim-shake { animation: none; }
        }
      `}</style>

      {/* Hero mobile — banda superior compacta */}
      <div className="relative lg:hidden h-[32vh] min-h-[220px] max-h-[300px] w-full overflow-hidden bg-black shrink-0">
        <img
          src="/images/hero-login.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_30%] opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/10" />
        <div className="relative z-10 h-full flex flex-col justify-between p-6 anim-fade-in">
          <div className="flex items-center gap-2.5">
            <img src="/logo-prius.png" alt="Prius" className="w-7 h-7 object-contain brightness-0 invert" />
            <span className="text-white font-display text-xs tracking-[0.25em] uppercase font-medium">
              Prius Admin
            </span>
          </div>
          <p className="text-white/70 text-[11px] font-medium uppercase tracking-[0.15em]">
            Balneario Playa Grande
          </p>
        </div>
      </div>

      {/* Panel de marca — desktop */}
      <div className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between overflow-hidden bg-black">
        <img
          src="/images/hero-login.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_25%] opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />

        {/* Header: logo */}
        <div className="relative z-10 p-10 xl:p-14 anim-fade-in">
          <div className="flex items-center gap-3">
            <img src="/logo-prius.png" alt="Prius" className="w-9 h-9 object-contain brightness-0 invert" />
            <span className="text-white font-display text-sm tracking-[0.25em] uppercase font-medium">
              Prius Admin
            </span>
          </div>
        </div>

        {/* Footer: mensaje de marca */}
        <div className="relative z-10 p-10 xl:p-14 space-y-5">
          <div className="w-10 h-[2px] bg-gold anim-draw-line" />
          <h1 className="font-display text-3xl xl:text-4xl leading-[1.15] text-white font-medium anim-fade-up" style={{ animationDelay: "0.15s" }}>
            El panel de gestión<br />de Playa Grande.
          </h1>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs anim-fade-up" style={{ animationDelay: "0.3s" }}>
            Plano interactivo, caja diaria y reservas de temporada, todo en un mismo lugar.
          </p>
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.2em] pt-6 anim-fade-up" style={{ animationDelay: "0.45s" }}>
            Balneario Playa Grande &bull; Mar del Plata
          </p>
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 sm:px-10 bg-white relative -mt-5 lg:mt-0 rounded-t-2xl lg:rounded-none z-10">
        <div className="w-full max-w-[380px]">

          {mode === "login" ? (
            <>
              <div className="mb-9 anim-fade-up" style={{ animationDelay: "0.05s" }}>
                <h2 className="text-2xl font-display font-semibold text-black tracking-tight">
                  Iniciar sesión
                </h2>
                <p className="text-sm text-neutral-500 mt-1.5">
                  Ingresá tus credenciales para acceder al panel.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
                  <FloatingInput
                    id="email"
                    type="email"
                    label="Correo electrónico"
                    value={email}
                    onChange={setEmail}
                    icon={<Mail size={16} />}
                    autoComplete="email"
                  />
                </div>

                <div className="anim-fade-up" style={{ animationDelay: "0.17s" }}>
                  <FloatingInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    label="Contraseña"
                    value={password}
                    onChange={setPassword}
                    icon={<Lock size={16} />}
                    autoComplete="current-password"
                    trailing={
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-neutral-400 hover:text-black transition-colors"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                </div>

                <div className="flex items-center justify-between anim-fade-up" style={{ animationDelay: "0.22s" }}>
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <span className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="w-4 h-4 rounded-sm border border-[#D9D9D9] peer-checked:bg-black peer-checked:border-black transition-colors flex items-center justify-center">
                        {remember && <CheckCircle2 size={12} className="text-gold" strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="text-xs text-neutral-500 group-hover:text-black transition-colors">
                      Mantener sesión iniciada
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setMode("recover")}
                    className="text-xs font-medium text-neutral-500 hover:text-black transition-colors underline-offset-4 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded anim-shake">
                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                    <p className="text-red-600 text-xs font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 mt-2 font-semibold text-sm rounded-md bg-black text-white hover:bg-black/85 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed anim-fade-up"
                  style={{ animationDelay: "0.28s" }}
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Ingresar al panel
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 pt-6 border-t border-[#F0F0F0] anim-fade-up" style={{ animationDelay: "0.34s" }}>
                <p className="text-center text-[10px] font-medium text-neutral-400 uppercase tracking-[0.15em]">
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

function FloatingInput({ id, type, label, value, onChange, icon, trailing, autoComplete }) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2.5 h-[52px] px-3.5 border rounded-md bg-white transition-colors duration-150 ${
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
              active ? "top-[7px] text-[10px] font-semibold uppercase tracking-wider" : "top-1/2 -translate-y-1/2 text-sm"
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
            className={`w-full h-full bg-transparent outline-none text-sm text-black font-medium ${
              active ? "pt-[15px]" : ""
            }`}
          />
        </div>
        {trailing}
      </div>
    </div>
  )
}

function RecoverPanel({ email, setEmail, status, error, onSubmit, onBack }) {
  if (status === "sent") {
    return (
      <div className="anim-fade-up">
        <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center mb-5">
          <CheckCircle2 size={20} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-display font-semibold text-black tracking-tight">
          Revisá tu correo
        </h2>
        <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
          Le enviamos un link de recuperación a <span className="text-black font-medium">{email}</span>. Puede tardar unos minutos en llegar.
        </p>
        <button
          onClick={onBack}
          className="mt-8 text-sm font-semibold text-black hover:opacity-60 transition-opacity"
        >
          Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <div className="anim-fade-up">
      <div className="mb-9">
        <h2 className="text-2xl font-display font-semibold text-black tracking-tight">
          Recuperar contraseña
        </h2>
        <p className="text-sm text-neutral-500 mt-1.5">
          Ingresá tu email y te mandamos un link para restablecerla.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <FloatingInput
          id="recover-email"
          type="email"
          label="Correo electrónico"
          value={email}
          onChange={setEmail}
          icon={<Mail size={16} />}
          autoComplete="email"
        />

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded anim-shake">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-red-600 text-xs font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full h-12 mt-2 font-semibold text-sm rounded-md bg-black text-white hover:bg-black/85 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {status === "sending" ? <Loader2 size={16} className="animate-spin" /> : "Enviar link de recuperación"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs font-medium text-neutral-500 hover:text-black transition-colors pt-1"
        >
          Volver al inicio de sesión
        </button>
      </form>
    </div>
  )
}
