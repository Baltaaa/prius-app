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
        // Pulido UX (oct 2026, item 7) — causa raíz del "Dashboard aparece
        // scrolleado": con el teclado de iOS abierto (input de contraseña
        // enfocado) Safari desplaza el viewport para mantenerlo a la
        // vista. Ese desplazamiento queda en window.scrollY incluso
        // después de blurear — hay que forzar el scroll a 0 ACÁ, antes de
        // que se monte el layout autenticado (el blur por sí solo no
        // revierte el desplazamiento ya hecho).
        document.activeElement?.blur?.()
        window.scrollTo(0, 0)
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

  // Rebranding Stitch (oct 2026, item 10) — layout nuevo (desktop pantalla
  // dividida / mobile imagen + bottom sheet) sobre el mismo fondo, logo y
  // lógica de siempre (handleSubmit/handleRecover/estado de arriba sin
  // tocar, solo cambia el JSX/estilos). Fuente de verdad del layout:
  // design/stitch/06-login-desktop.{html,png} y 06-login-mobile.{html,png}
  // — el placeholder "P" amarillo y las fotos de relleno de esos mocks NO
  // se usan, siempre el logo/imagen reales de la app.
  const inputBase =
    "w-full h-12 px-4 rounded-md border border-[#E5E5E5] bg-white text-black placeholder:text-black/30 outline-none transition-colors motion-reduce:transition-none focus:border-[#F2CA50] focus:ring-2 focus:ring-[#F2CA50]/30"
  const labelBase = "block text-xs font-semibold text-black/60 mb-1.5"

  // Aviso de inactividad/error — mismo bloque, se renderiza en DOS lugares
  // distintos según breakpoint (desktop: arriba de los campos; mobile:
  // arriba del botón, ver mocks), nunca los dos juntos — por eso vive acá
  // como variable en vez de JSX inline repetido.
  const aviso = (
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
  )

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black font-sans selection:bg-[#F2CA50] selection:text-black">
      {isSuccess && <GlobalLoader message="Iniciando sesión segura" />}

      {/* Shell: columna en mobile (imagen arriba, sheet abajo) / fila en
          desktop (panel de marca a la izquierda, card a la derecha). */}
      <div className="relative z-10 h-full flex flex-col md:flex-row">
        {/* Panel de marca — imagen + overlay (MISMO asset que ya usaba el
            login, sin cambios: /images/hero-login-opt.jpg, 1600px/250KB,
            sin animación — ver nota de rendimiento original más abajo).
            Mobile: franja superior fija. Desktop: mitad izquierda, full
            height. */}
        <div className="relative shrink-0 h-[34dvh] md:h-full md:w-1/2 overflow-hidden">
          {/*
            Fondo estático (sin cambios respecto al diseño anterior). Antes:
            JPEG de 5405×3601 (~3.5 MB, ~78 MP = ~300 MB de bitmap en RAM)
            con animación `scale()` infinita de 20s Y un
            `backdrop-blur-2xl` + `backdrop-grayscale` encima -> el
            navegador recomponía un blur de radio gigante sobre una imagen
            en movimiento en cada frame. Ahora: imagen de 1600px / 250 KB,
            sin animación, overlays con gradientes.
          */}
          <img
            src="/images/hero-login-opt.jpg"
            alt="Prius Playa Grande"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40 md:bg-gradient-to-br md:from-black/85 md:via-black/55 md:to-black/35" />

          <div className="relative h-full flex flex-col justify-between p-6 md:p-12">
            {/* Wordmark — logo real de la app (/images/prius-icon.png),
                nunca el círculo "P" placeholder del mock. */}
            <div className="flex items-center gap-2 md:gap-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <img src="/images/prius-icon.png" alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
              <div className="leading-tight">
                <p className="text-white font-display font-extrabold text-lg md:text-xl tracking-tight">Prius</p>
                <p className="text-white/70 text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] -mt-0.5">Playa Grande</p>
              </div>
            </div>

            {/* Bloque central — solo desktop (mock 06-login-desktop) */}
            <div className="hidden md:block max-w-md">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F2CA50]" /> Panel de Gestión y Operaciones
              </span>
              <h2 className="text-4xl lg:text-[44px] font-display font-extrabold text-white tracking-tight leading-[1.05]">
                Prius <span className="text-[#F2CA50]">Playa Grande</span>
              </h2>
              <p className="text-white/70 text-base mt-4 leading-relaxed">
                Gestión operativa inteligente para carpas, sombrillas y servicios de balneario.
              </p>
            </div>

            {/* Pie — solo desktop */}
            <div className="hidden md:flex items-center justify-between text-white/50 text-xs border-t border-white/10 pt-6">
              <span>Sistema CRM Interno</span>
              <span>Mar del Plata, Argentina</span>
            </div>
          </div>
        </div>

        {/* Card / bottom sheet del formulario. flex-1 + overflow-y-auto
            propio (pulido UX, oct 2026, item 7/10): si el teclado de iOS
            achica el dvh disponible por debajo de lo que mide el
            formulario, el sheet scrollea internamente en vez de empujar el
            botón "Ingresar" fuera de la pantalla. */}
        <main className="flex-1 min-h-0 flex flex-col md:items-center md:justify-center bg-white md:bg-prius-background overflow-hidden">
          <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain md:flex md:items-center md:justify-center md:py-10">
            <div
              className="w-full md:max-w-[440px] rounded-t-3xl md:rounded-2xl md:border md:border-[#E5E5E5] md:shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-white px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-10 animate-premium-fade"
            >
              {/* Gesto visual de bottom sheet (mobile) */}
              <div className="md:hidden flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-black/10" />
              </div>

              {/* Pill — solo desktop (mock): "Prius App · Panel de Gestión" */}
              <span className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] border border-[#E5E5E5] text-black/70 text-xs font-semibold mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F2CA50]" /> Prius App · Panel de Gestión
              </span>

              {mode === "login" ? (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl md:text-xl font-display font-extrabold text-black tracking-tight">Iniciar sesión</h1>
                    <p className="text-black/50 text-sm mt-1">Acceso exclusivo para el equipo Prius.</p>
                  </div>

                  {/* Aviso — desktop, arriba de los campos (mock desktop) */}
                  <div className="hidden md:block">{aviso}</div>

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

                    {/* Aviso — mobile, arriba del botón (mock mobile) */}
                    <div className="md:hidden">{aviso}</div>

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

              <p className="text-center text-[11px] text-black/30 font-medium mt-8">
                <span className="md:hidden">Prius Balneario Playa Grande · CRM v1.0</span>
                <span className="hidden md:inline">Prius Balneario Playa Grande · CRM Interno</span>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
