import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Eye, EyeOff, ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react"
import GlobalLoader from "../components/ui/GlobalLoader"

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Estados para la barrera de seguridad (Slide to Verify)
  const [isVerified, setIsVerified] = useState(false)
  const [sliderPosition, setSliderPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef(null)
  const startXRef = useRef(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard")
    })
  }, [navigate])

  // Manejadores de eventos para el deslizador de seguridad (Soporta Mouse y Touch)
  const handleStart = (clientX) => {
    if (isVerified || isLoading) return
    setIsDragging(true)
    startXRef.current = clientX - sliderPosition
  }

  const handleMove = (clientX) => {
    if (!isDragging || isVerified) return
    const sliderWidth = sliderRef.current.clientWidth
    const handleWidth = 48 // Ancho del botón deslizante
    const maxDistance = sliderWidth - handleWidth
    
    let currentPos = clientX - startXRef.current
    if (currentPos < 0) currentPos = 0
    if (currentPos > maxDistance) currentPos = maxDistance

    const percentage = (currentPos / maxDistance) * 100
    setSliderPosition(currentPos)

    if (percentage >= 98) {
      setIsVerified(true)
      setIsDragging(false)
      setSliderPosition(maxDistance)
    }
  }

  const handleEnd = () => {
    if (isVerified) return
    setIsDragging(false)
    // Si no llegó al final, vuelve al inicio con suavidad
    setSliderPosition(0)
  }

  // Eventos de Mouse
  const onMouseDown = (e) => handleStart(e.clientX)
  const onMouseMove = (e) => handleMove(e.clientX)
  const onMouseUp = () => handleEnd()

  // Eventos de Touch (Mobile)
  const onTouchStart = (e) => handleStart(e.touches[0].clientX)
  const onTouchMove = (e) => handleMove(e.touches[0].clientX)
  const onTouchEnd = () => handleEnd()

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
      window.addEventListener("touchmove", onTouchMove)
      window.addEventListener("touchend", onTouchEnd)
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [isDragging])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isVerified) {
      setError("Por favor, complete la verificación de seguridad.")
      return
    }
    setError("")
    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError("Email o contraseña incorrectos")
        setIsVerified(false)
        setSliderPosition(0)
        setIsLoading(false)
        return
      }

      if (data?.user) {
        // Agregamos un retraso intencional de 2 segundos para que la animación de carga sea visible
        setTimeout(() => {
          navigate("/dashboard")
        }, 2000)
      }
    } catch (err) {
      setError("Error de conexión. Verifica tu internet.")
      setIsVerified(false)
      setSliderPosition(0)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Loader Global durante el inicio de sesión */}
      {isLoading && <GlobalLoader message="Iniciando sesión de administrador" />}

      {/* Panel izquierdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-prius-black relative overflow-hidden items-center justify-center p-12">
        {/* Imagen de fondo con mayor claridad (opacity-20) */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero-bg.png" 
            alt="Prius Playa Grande" 
            className="w-full h-full object-cover object-center opacity-20 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        
        <div className="relative z-10 text-center">
          <img src="/logo-prius.png" alt="Prius" className="h-64 w-auto mx-auto mb-8 brightness-0 invert" />
          <h1 className="text-4xl font-normal text-white mb-4 tracking-tight">
            Gestión de Experiencias <span className="font-serif italic text-gold">Prius</span>
          </h1>
          <p className="text-white/60 max-w-md mx-auto">
            Acceso exclusivo para el equipo de administración de Prius Playa Grande.
          </p>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-prius-black/40 hover:text-prius-black mb-12 transition-colors">
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>

          <div className="mb-10">
            <img src="/logo-prius.png" alt="Prius" className="h-24 w-auto mb-8 lg:hidden" />
            <h2 className="text-3xl font-normal text-prius-black mb-2 tracking-tight">
              Bienvenido
            </h2>
            <p className="text-prius-black/60">
              Ingresa tus credenciales de administrador
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-prius-black/40">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@priusplayagrande.com"
                required
                className="w-full h-12 px-4 border border-hairline rounded-sm focus:border-gold outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-prius-black/40">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  className="w-full h-12 px-4 border border-hairline rounded-sm focus:border-gold outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-prius-black/40 hover:text-prius-black"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Barrera de Seguridad: Slide to Verify */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-prius-black/40">Verificación de Seguridad</label>
              <div 
                ref={sliderRef}
                className={`relative h-12 w-full rounded-sm border flex items-center justify-center select-none overflow-hidden transition-colors duration-300 ${
                  isVerified 
                    ? "bg-green-50 border-green-200" 
                    : "bg-prius-background border-hairline"
                }`}
              >
                {/* Texto de fondo */}
                <span className={`text-[9px] font-bold uppercase tracking-widest transition-opacity duration-300 ${
                  isVerified ? "text-green-700" : "text-prius-black/40"
                }`}>
                  {isVerified ? "SISTEMA VERIFICADO" : "DESLICE PARA VERIFICAR SISTEMA"}
                </span>

                {/* Botón Deslizante */}
                <div
                  onMouseDown={onMouseDown}
                  onTouchStart={onTouchStart}
                  style={{ 
                    transform: `translateX(${sliderPosition}px)`,
                    transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                  }}
                  className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors duration-300 ${
                    isVerified 
                      ? "bg-green-600 text-white" 
                      : "bg-gold text-prius-black hover:bg-gold-hover"
                  }`}
                >
                  {isVerified ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5" />
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-sm">
                <p className="text-red-600 text-xs font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !isVerified}
              className={`w-full h-12 font-bold text-xs uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 ${
                isVerified && !isLoading
                  ? "bg-gold hover:bg-gold-hover text-prius-black cursor-pointer"
                  : "bg-prius-black/10 text-prius-black/30 cursor-not-allowed"
              }`}
            >
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}