import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthProvider"
import { markActivity, consumeLogoutMotivo } from "../lib/activity"
import { LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS } from "../config/session"
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react"
import GlobalLoader from "../components/ui/GlobalLoader"

export default function Login({ modo }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session, perfil, loading: authLoading, logLoginEvent } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  // Tarea 2 (fix doble login): el submit solo marca la intención de navegar;
  // la navegación real la decide el efecto de abajo, recién cuando el
  // contexto de auth (session + perfil) terminó de resolver. Navegar antes
  // -> PrivateRoute ve perfil=null y hace signOut (ese era el bug).
  const [awaitingContext, setAwaitingContext] = useState(false)

  // Tarea 4d: bloqueo client-side tras intentos fallidos, complementa el
  // rate limit nativo de Supabase (no lo reemplaza).
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(null)
  const [lockCountdown, setLockCountdown] = useState(0)
  const lockTimerRef = useRef(null)

  // Tarea 5: aviso de Bloq Mayús en el campo de contraseña.
  const [capsLockOn, setCapsLockOn] = useState(false)
  const handlePasswordKeyEvent = (e) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"))
    }
  }

  // sessionStorage es la fuente confiable (seguimiento, oct 2026): el
  // query string compite con el propio redirect de PrivateRoute cuando la
  // sesión expira (carrera real, ver useInactivityLogout.js) y a veces se
  // pierde. Se lee una sola vez al montar (lazy initializer), con el query
  // como fallback por si sessionStorage no está disponible.
  const [motivo] = useState(() => consumeLogoutMotivo() || searchParams.get("motivo"))

  // Ya hay sesión activa (y perfil resuelto) -> no tiene sentido ver el
  // login. Se apoya en el contexto único de auth, no en una segunda lectura
  // de getSession() independiente.
  // `!motivo`: si llegamos acá por un logout forzado (PrivateRoute nos
  // mandó por inactividad), `signOut()` puede seguir en vuelo (es async) y
  // `session` todavía verse verdadero por un instante — sin este freno este
  // efecto rebotaba de vuelta a Home antes de que signOut() terminara,
  // generando un ping-pong que terminaba perdiendo el motivo/banner (bug
  // real de QA, oct 2026, caso "pestaña reabierta después del timeout").
  useEffect(() => {
    if (!authLoading && session && perfil && !motivo) {
      navigate(location.state?.from || "/app/home", { replace: true })
    }
  }, [authLoading, session, perfil, motivo, navigate, location.state])

  // Recuperación de contraseña
  const [mode, setMode] = useState(modo === "recover" ? "recover" : "login") // "login" | "recover"
  const [recoverEmail, setRecoverEmail] = useState("")
  const [recoverStatus, setRecoverStatus] = useState("idle") // idle | sending | sent | error

  useEffect(() => {
    if (!awaitingContext) return
    if (!authLoading && session && perfil) {
      navigate(location.state?.from || "/app/home", { replace: true })
    }
  }, [awaitingContext, authLoading, session, perfil, navigate, location.state])

  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setLockCountdown(0)
        setFailedAttempts(0)
        clearInterval(lockTimerRef.current)
      } else {
        setLockCountdown(remaining)
      }
    }
    tick()
    lockTimerRef.current = setInterval(tick, 1000)
    return () => clearInterval(lockTimerRef.current)
  }, [lockedUntil])

  const isLocked = lockedUntil !== null && lockCountdown > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLocked) return
    setError("")
    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Mensaje genérico a propósito: nunca revelar si el email existe.
        setError("Email o contraseña incorrectos.")
        setIsLoading(false)
        const next = failedAttempts + 1
        setFailedAttempts(next)
        if (next >= LOGIN_MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOGIN_LOCKOUT_MS)
        }
        return
      }

      if (data?.user) {
        setFailedAttempts(0)
        // Se marca ANTES de navegar (Tarea 3): si no, useInactivityLogout
        // podría leer un prius_last_activity viejo/ausente apenas se monta
        // el layout autenticado y reintroducir un cierre de sesión espurio.
        markActivity()
        // "Inicio de sesión" en Historial: se dispara ACÁ, no reactivamente
        // en AuthProvider al evento SIGNED_IN — Supabase puede emitir ese
        // mismo evento también al recargar la página con sesión persistida
        // (confirmado en QA, oct 2026), así que solo este punto (submit
        // exitoso) distingue un login real de un refresh. Fire-and-forget.
        logLoginEvent()
        setIsSuccess(true)
        setAwaitingContext(true)
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
      const { error: recoverErr } = await supabase.auth.resetPasswordForEmail(recoverEmail, {
        redirectTo: `${window.location.origin}/restablecer-contrasena`,
      })
      if (recoverErr) {
        setRecoverStatus("error")
        return
      }
      setRecoverStatus("sent")
    } catch (err) {
      setRecoverStatus("error")
    }
  }

  // Tarea 5 (oct 2026): rediseño visual puro — mismo fondo, misma lógica de
  // arriba (handleSubmit/handleRecover/estado), solo cambia el JSX/estilos.
  // Desktop: card blanca centrada. Mobile: bottom sheet blanco anclado abajo
  // sobre el fondo, como app nativa.
  const inputBase =
    "w-full h-12 px-4 rounded-md border border-[#E5E5E5] bg-white text-black placeholder:text-black/30 outline-none transition-colors motion-reduce:transition-none focus:border-[#F2CA50] focus:ring-2 focus:ring-[#F2CA50]/30"
  const labelBase = "block text-xs font-semibold text-black/60 mb-1.5"

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black font-sans selection:bg-[#F2CA50] selection:text-black">
      {isSuccess && <GlobalLoader message="Iniciando sesión segura" />}

      {/*
        Fondo estático (sin cambios respecto al diseño anterior). Antes: JPEG
        de 5405×3601 (~3.5 MB, ~78 MP = ~300 MB de bitmap en RAM) con
        animación `scale()` infinita de 20s Y un `backdrop-blur-2xl` +
        `backdrop-grayscale` encima -> el navegador recomponía un blur de
        radio gigante sobre una imagen en movimiento en cada frame. Ahora:
        imagen de 1600px / 250 KB, sin animación, overlays con gradientes.
      */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/hero-login-opt.jpg"
          alt="Prius Playa Grande"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
      </div>

      {/* Wordmark (mobile) + card/sheet comparten una sola columna flex de
          altura completa -- si el wordmark viviera fuera de <main> como
          hermano con su propia altura, se sumaría a los 100dvh de <main> y
          empujaría el botón fuera de la pantalla (bug real, visto en la
          captura de 360px). */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Visible en mobile (donde no hay card con logo propio arriba);
            oculto en desktop (el wordmark vive dentro de la card blanca). */}
        <div className="md:hidden shrink-0 flex items-center gap-2 px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <img src="/images/prius-icon.png" alt="" className="w-8 h-8 object-contain" />
          <div className="leading-tight">
            <p className="text-black font-display font-extrabold text-lg tracking-tight">Prius</p>
            <p className="text-prius-slate text-[10px] font-semibold uppercase tracking-[0.2em] -mt-0.5">Playa Grande</p>
          </div>
        </div>

        {/* Mobile: bottom sheet anclado abajo. Desktop: card centrada. */}
        <main className="flex-1 min-h-0 flex flex-col justify-end md:items-center md:justify-center">
        <div
          className="w-full md:max-w-[420px] bg-white rounded-t-3xl md:rounded-lg border-t md:border border-[#E5E5E5] shadow-[0_-8px_30px_rgba(0,0,0,0.25)] md:shadow-[0_8px_30px_rgba(0,0,0,0.12)] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-10 animate-premium-fade"
        >
          {/* Gesto visual de bottom sheet (mobile) */}
          <div className="md:hidden flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full bg-black/10" />
          </div>

          {/* Wordmark desktop (oculto en mobile, ya está sobre el fondo) */}
          <div className="hidden md:flex items-center gap-3 mb-8">
            <img src="/images/prius-icon.png" alt="" className="w-9 h-9 object-contain" />
            <div className="leading-tight">
              <p className="text-black font-display font-extrabold text-lg tracking-tight">
                Prius <span className="font-semibold text-black/60">Playa Grande</span>
              </p>
              <p className="text-black/40 text-[11px] font-medium">Panel de gestión</p>
            </div>
          </div>

          {mode === "login" ? (
            <div className="space-y-5">
              <div className="md:hidden">
                <h1 className="text-2xl font-display font-extrabold text-black tracking-tight">Iniciar sesión</h1>
                <p className="text-black/50 text-sm mt-1">Acceso exclusivo para el equipo Prius.</p>
              </div>
              <div className="hidden md:block">
                <h1 className="text-xl font-display font-extrabold text-black tracking-tight">Iniciar sesión</h1>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="login-email" className={labelBase}>Email</label>
                  <input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    enterKeyHint="next"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    style={{ fontSize: 16 }}
                    className={inputBase}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className={labelBase + " mb-0"}>Contraseña</label>
                    <button
                      type="button"
                      onClick={() => setMode("recover")}
                      className="text-xs font-semibold text-black/50 hover:text-black transition-colors motion-reduce:transition-none underline underline-offset-2"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      enterKeyHint="go"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={handlePasswordKeyEvent}
                      onKeyDown={handlePasswordKeyEvent}
                      required
                      placeholder="••••••••"
                      style={{ fontSize: 16 }}
                      className={inputBase + " pr-11"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors motion-reduce:transition-none p-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {capsLockOn && (
                    <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1" aria-live="polite">
                      <AlertCircle size={12} /> Bloq Mayús activado
                    </p>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-black/60 select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E5E5] text-[#F2CA50] focus:ring-[#F2CA50]/40 accent-[#F2CA50]"
                  />
                  Recordar equipo en este dispositivo
                </label>

                <div aria-live="polite" className="space-y-3">
                  {motivo === "inactividad" && !error && !isLocked && (
                    <div className="p-3 bg-black/[0.03] border border-[#E5E5E5] rounded-md flex items-center gap-2.5">
                      <AlertCircle size={16} className="text-black/40 shrink-0" />
                      <span className="text-xs font-medium text-black/60">
                        Cerramos tu sesión por inactividad. Volvé a ingresar para continuar.
                      </span>
                    </div>
                  )}

                  {isLocked && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2.5">
                      <AlertCircle size={16} className="text-red-600 shrink-0" />
                      <span className="text-xs font-semibold text-red-700">
                        Demasiados intentos. Probá de nuevo en {lockCountdown}s.
                      </span>
                    </div>
                  )}

                  {error && !isLocked && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                      <AlertCircle size={16} className="text-red-600 shrink-0" />
                      <span className="text-xs font-semibold text-red-700">{error}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || awaitingContext || isLocked}
                  className="w-full h-12 bg-[#F2CA50] hover:bg-[#E5BF45] active:scale-[0.98] text-black font-bold text-sm rounded-md transition-all duration-150 motion-reduce:transition-none motion-reduce:active:scale-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                >
                  {isLoading || awaitingContext ? (
                    <>
                      <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> Ingresando…
                    </>
                  ) : isLocked ? (
                    `Bloqueado (${lockCountdown}s)`
                  ) : (
                    "Ingresar"
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-display font-extrabold text-black tracking-tight">Recuperar cuenta</h2>
                <p className="text-black/50 text-sm mt-1">Te enviamos un enlace seguro a tu email.</p>
              </div>

              {recoverStatus === "sent" ? (
                <div className="p-5 bg-green-50 border border-green-200 rounded-md space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                    <CheckCircle2 size={16} />
                    <span>Correo enviado con éxito</span>
                  </div>
                  <p className="text-green-700/80 text-xs leading-relaxed">Revisá tu casilla para continuar con la restauración.</p>
                  <button
                    onClick={() => setMode("login")}
                    className="text-xs font-semibold text-black underline underline-offset-2"
                  >
                    Volver al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecover} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="recover-email" className={labelBase}>Email</label>
                    <input
                      id="recover-email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      enterKeyHint="go"
                      value={recoverEmail}
                      onChange={(e) => setRecoverEmail(e.target.value)}
                      required
                      placeholder="tu@email.com"
                      style={{ fontSize: 16 }}
                      className={inputBase}
                    />
                  </div>

                  {recoverStatus === "error" && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2.5" aria-live="polite">
                      <AlertCircle size={16} className="text-red-600 shrink-0" />
                      <span className="text-xs font-semibold text-red-700">No pudimos enviar el correo. Probá de nuevo.</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={recoverStatus === "sending"}
                    className="w-full h-12 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-bold text-sm rounded-md transition-all duration-150 motion-reduce:transition-none flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {recoverStatus === "sending" ? <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> : "Enviar instrucciones"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-center text-xs font-semibold text-black/50 hover:text-black transition-colors motion-reduce:transition-none flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft size={14} /> Volver
                  </button>
                </form>
              )}
            </div>
          )}

          <p className="hidden md:block text-center text-[11px] text-black/30 font-medium mt-8">
            Prius Playa Grande · Mar del Plata
          </p>
        </div>
        </main>
      </div>
    </div>
  )
}