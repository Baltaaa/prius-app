import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthProvider"
import { markActivity, consumeLogoutMotivo } from "../lib/activity"
import { LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS } from "../config/session"
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react"
import GlobalLoader from "../components/ui/GlobalLoader"

// Mobile: el alto del login es el del viewport VISUAL (el que queda sobre el teclado), no el
// layout viewport — iOS no achica el layout viewport al abrir el teclado y empuja la página.
// Con la raíz fija a ese alto/offset la página nunca salta y el formulario queda entero a la vista.
function useViewportVisual() {
  const [vv, setVv] = useState({ alto: null, top: 0, teclado: false })
  useEffect(() => {
    const v = window.visualViewport
    if (!v) return undefined
    const medir = () => {
      const teclado = window.innerHeight - v.height > 120
      setVv({ alto: Math.round(v.height), top: Math.round(v.offsetTop), teclado })
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
    }
    medir()
    v.addEventListener("resize", medir)
    v.addEventListener("scroll", medir)
    return () => { v.removeEventListener("resize", medir); v.removeEventListener("scroll", medir) }
  }, [])
  return vv
}

export default function Login({ modo }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session, perfil, loading: authLoading, logLoginEvent } = useAuth()

  const vv = useViewportVisual()
  // Sin scroll de página ni rebote mientras el login está montado.
  useEffect(() => {
    const html = document.documentElement
    const previo = { o: html.style.overscrollBehavior, b: document.body.style.overflow }
    html.style.overscrollBehavior = "none"
    document.body.style.overflow = "hidden"
    return () => { html.style.overscrollBehavior = previo.o; document.body.style.overflow = previo.b }
  }, [])

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
    "w-full h-12 px-4 rounded-inner bg-surface text-ink placeholder:text-ink-2 outline-none transition-colors motion-reduce:transition-none focus:ring-2 focus:ring-gold border border-transparent focus:ring-2 focus:ring-gold"
  const labelBase = "block text-label font-semibold text-ink-2 mb-2"

  // Aviso de inactividad/error — mismo bloque, se renderiza en DOS lugares
  // distintos según breakpoint (desktop: arriba de los campos; mobile:
  // arriba del botón, ver mocks), nunca los dos juntos — por eso vive acá
  // como variable en vez de JSX inline repetido.
  const aviso = (visibilidad) => (
    <div aria-live="polite" className={`space-y-3 empty:hidden ${visibilidad}`}>
      {motivo === "inactividad" && !error && !isLocked && (
        <div className="p-3 bg-surface border border-line rounded-swatch flex items-center gap-3">
          <AlertCircle size={16} className="text-ink-2 shrink-0" />
          <span className="text-label font-medium text-ink-2">
            Cerramos tu sesión por inactividad. Volvé a ingresar para continuar.
          </span>
        </div>
      )}

      {isLocked && (
        <div className="p-3 bg-danger-soft border border-danger/30 rounded-swatch flex items-center gap-3">
          <AlertCircle size={16} className="text-danger shrink-0" />
          <span className="text-label font-semibold text-danger-ink">
            Demasiados intentos. Probá de nuevo en {lockCountdown}s.
          </span>
        </div>
      )}

      {error && !isLocked && (
        <div className="p-3 bg-danger-soft border border-danger/30 rounded-swatch flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
          <AlertCircle size={16} className="text-danger shrink-0" />
          <span className="text-label font-semibold text-danger-ink">{error}</span>
        </div>
      )}
    </div>
  )

  return (
    <div
      className="max-md:fixed max-md:inset-x-0 max-md:top-[var(--vv-top,0px)] max-md:h-[var(--vv-h,100dvh)] md:relative md:h-[100dvh] w-full overflow-hidden overscroll-none bg-scrim selection:bg-gold selection:text-on-gold"
      style={{ "--vv-h": vv.alto ? `${vv.alto}px` : undefined, "--vv-top": `${vv.top}px` }}
    >
      {isSuccess && <GlobalLoader message="Iniciando sesión segura" />}

      {/* Shell: columna en mobile (imagen arriba, sheet abajo) / fila en
          desktop (panel de marca a la izquierda, card a la derecha). */}
      <div className="relative z-10 h-full flex flex-col md:flex-row">
        {/* Panel de marca — imagen + overlay (MISMO asset que ya usaba el
            login, sin cambios: /images/hero-login-opt.jpg, 1600px/250KB,
            sin animación — ver nota de rendimiento original más abajo).
            Mobile: franja superior fija. Desktop: mitad izquierda, full
            height. */}
        {/* Mobile: la franja de marca se queda con TODO el alto que el formulario no usa (flex-1) —
            ni scroll ni espacio en blanco en ningún celular. Con el teclado abierto se oculta. */}
        <div className={`relative flex-1 min-h-[88px] md:flex-none md:min-h-0 md:h-full md:w-1/2 overflow-hidden ${vv.teclado ? "max-md:hidden" : ""}`}>
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
          <div className="absolute inset-0 bg-gradient-to-t from-scrim/70 via-scrim/20 to-scrim/40 md:bg-gradient-to-br md:from-scrim/85 md:via-scrim/55 md:to-scrim/35" />
          {/* Scrim propio del wordmark (Bloque 2, nov 2026). El gradiente de
              arriba deja la franja superior en negro al 40% en mobile, y
              sobre un cielo claro el blanco del logo quedaba en ~3.8:1 — por
              debajo de AA. Esta banda sube esa zona a negro ~72% y lleva el
              texto a 10:1 largos, sin oscurecer el resto de la foto. */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-scrim/75 to-transparent md:hidden" />

          <div className="relative h-full flex flex-col justify-between p-6 md:p-12">
            {/* Wordmark — logo real de la app (/images/prius-icon.png),
                nunca el círculo "P" placeholder del mock. */}
            <div className="flex items-center gap-2 md:gap-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <img src="/images/prius-icon.png" alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
              <div className="leading-tight">
                <p className="text-on-scrim text-card-title md:text-card-title tracking-tight">Prius</p>
                <p className="text-label text-on-scrim/70 -mt-1">Playa Grande</p>
              </div>
            </div>

            {/* Bloque central — solo desktop (mock 06-login-desktop) */}
            <div className="hidden md:block max-w-md">
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-on-scrim/10 border border-on-scrim/20 text-on-scrim text-label font-semibold mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Panel de Gestión y Operaciones
              </span>
              <h2 className="text-stat lg:text-greeting text-on-scrim">
                Prius <span className="text-gold">Playa Grande</span>
              </h2>
              <p className="text-on-scrim/70 text-base mt-4 leading-relaxed">
                Gestión operativa inteligente para carpas, sombrillas y servicios de balneario.
              </p>
            </div>

            {/* Pie — solo desktop */}
            <div className="hidden md:flex items-center justify-between text-on-scrim/50 text-label border-t border-on-scrim/10 pt-6">
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
        <main
          onFocusCapture={(e) => { const el = e.target; setTimeout(() => el.scrollIntoView?.({ block: "center" }), 250) }}
          className="max-md:shrink max-md:min-h-0 md:flex-1 flex flex-col md:items-center md:justify-center bg-card md:bg-canvas overflow-hidden"
        >
          <div className="min-h-0 w-full overflow-y-auto overscroll-contain md:flex-1 md:flex md:items-center md:justify-center md:py-10">
            {/* Entrada (Bloque 1/2, nov 2026): el sheet sube desde abajo en
                mobile y el formulario entra con fade-up en desktop — dos
                animaciones distintas sobre el mismo nodo vía la variante
                `md:`. Ambas son solo transform+opacity y se apagan con
                prefers-reduced-motion desde index.css. */}
            <div
              className="w-full md:max-w-[440px] rounded-t-card md:rounded-card bg-card px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-10 ui-open-sheet md:anim-fade-up"
            >
              {/* Gesto visual de bottom sheet (mobile) */}
              <div className="md:hidden flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-line" />
              </div>

              {/* Pill — solo desktop (mock): "Prius App · Panel de Gestión" */}
              <span className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-line text-ink-2 text-label font-semibold mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Prius App · Panel de Gestión
              </span>

              {mode === "login" ? (
                <div className="space-y-4 md:space-y-5">
                  <div>
                    <h1 className="text-stat md:text-card-title text-ink tracking-tight">Iniciar sesión</h1>
                    <p className="text-ink-2 text-body mt-1">Acceso exclusivo para el equipo Prius.</p>
                  </div>

                  {/* Aviso — desktop, arriba de los campos (mock desktop) */}
                  {aviso("hidden md:block")}

                  <form onSubmit={handleSubmit} noValidate className="space-y-3 md:space-y-4">
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
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor="login-password" className={labelBase + " mb-0"}>Contraseña</label>
                        <button
                          type="button"
                          onClick={() => setMode("recover")}
                          className="text-label font-semibold text-ink-2 hover:text-ink transition-colors motion-reduce:transition-none underline underline-offset-2"
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
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-ink-2 hover:text-ink transition-colors motion-reduce:transition-none"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {capsLockOn && (
                        <p className="text-label text-ink mt-2 flex items-center gap-1" aria-live="polite">
                          <AlertCircle size={12} /> Bloq Mayús activado
                        </p>
                      )}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-label font-medium text-ink-2 select-none">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="w-4 h-4 rounded-swatch border-line text-gold focus:ring-gold accent-gold"
                      />
                      Recordar equipo en este dispositivo
                    </label>

                    {/* Aviso — mobile, arriba del botón (mock mobile) */}
                    {aviso("md:hidden")}

                    <button
                      type="submit"
                      disabled={isLoading || awaitingContext || isLocked}
                      className="w-full h-12 bg-ink hover:bg-chart-2 active:scale-[0.98] font-semibold text-body rounded-full transition-all duration-150 motion-reduce:transition-none motion-reduce:active:scale-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 text-on-ink"
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
                    <h2 className="text-card-title text-ink tracking-tight">Recuperar cuenta</h2>
                    <p className="text-ink-2 text-body mt-1">Te enviamos un enlace seguro a tu email.</p>
                  </div>

                  {recoverStatus === "sent" ? (
                    <div className="p-5 bg-success-soft border border-success/30 rounded-swatch space-y-3">
                      <div className="flex items-center gap-2 text-success-ink font-semibold text-body">
                        <CheckCircle2 size={16} />
                        <span>Correo enviado con éxito</span>
                      </div>
                      <p className="text-success-ink text-label leading-relaxed">Revisá tu casilla para continuar con la restauración.</p>
                      <button
                        onClick={() => setMode("login")}
                        className="text-label font-semibold text-ink underline underline-offset-2"
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
                        <div className="p-3 bg-danger-soft border border-danger/30 rounded-swatch flex items-center gap-3" aria-live="polite">
                          <AlertCircle size={16} className="text-danger shrink-0" />
                          <span className="text-label font-semibold text-danger-ink">No pudimos enviar el correo. Probá de nuevo.</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={recoverStatus === "sending"}
                        className="w-full h-12 bg-ink hover:bg-chart-2 font-semibold text-body rounded-full transition-all duration-150 motion-reduce:transition-none flex items-center justify-center gap-2 disabled:opacity-50 text-on-ink"
                      >
                        {recoverStatus === "sending" ? <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> : "Enviar instrucciones"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="w-full text-center text-label font-semibold text-ink-2 hover:text-ink transition-colors motion-reduce:transition-none flex items-center justify-center gap-2"
                      >
                        <ArrowLeft size={14} /> Volver
                      </button>
                    </form>
                  )}
                </div>
              )}

              <p className="text-center text-label text-ink-2 font-medium mt-4 md:mt-8">
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
