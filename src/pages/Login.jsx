import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react"
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
      if (session) navigate("/app/home")
    })
  }, [navigate])

  const handleStart = (clientX) => {
    if (isVerified || isLoading) return
    setIsDragging(true)
    startXRef.current = clientX - sliderPosition
  }

  const handleMove = (clientX) => {
    if (!isDragging || isVerified) return
    const sliderWidth = sliderRef.current.clientWidth
    const handleWidth = 48 
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
    setSliderPosition(0)
  }

  const onMouseDown = (e) => handleStart(e.clientX)
  const onMouseMove = (e) => handleMove(e.clientX)
  const onMouseUp = () => handleEnd()

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
        setTimeout(() => {
          navigate("/app/home")
        }, 1500)
      }
    } catch (err) {
      setError("Error de conexión. Verifica tu internet.")
      setIsVerified(false)
      setSliderPosition(0)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-black text-white font-sans overflow-hidden">
      {isLoading && <GlobalLoader message="Iniciando sesión de administrador" />}

      {/* Left panel - Premium image and minimal logo */}
      <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden items-center justify-center p-12 border-r border-neutral-900">
        <div className="absolute inset-0 z-0">
          <img 
            src="/logo-prius.png" 
            alt="Prius" 
            className="w-full h-full object-cover opacity-5 mix-blend-luminosity filter blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
        </div>
        
        <div className="relative z-10 text-center max-w-md">
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#F2CA50] mb-4 block">PRIUS PLAYA GRANDE</span>
          <h1 className="text-3xl font-extralight text-white mb-4 tracking-tight leading-none uppercase font-display">
            SISTEMA DE GESTIÓN <br /><span className="font-bold text-[#F2CA50]">ADMINISTRATIVA</span>
          </h1>
          <p className="text-neutral-500 text-xs uppercase tracking-wider leading-relaxed">
            Plataforma reservada para la coordinación y control operativo del balneario premium en Mar del Plata.
          </p>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-16 bg-black relative">
        <div className="w-full max-w-sm space-y-8 animate-premium-fade">
          <div className="text-center lg:text-left">
            <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-[#F2CA50] block mb-2">GESTIÓN EXCLUSIVA</span>
            <h2 className="text-2xl font-bold uppercase tracking-widest text-white leading-none font-display">
              INGRESAR
            </h2>
            <p className="text-neutral-500 text-[10px] uppercase tracking-wider mt-1.5">
              Identifíquese con sus credenciales autorizadas
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 font-display">EMAIL DE ACCESO</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@priusplayagrande.com"
                required
                className="w-full h-11 px-4 bg-neutral-900 border border-neutral-800 text-xs text-white focus:border-[#F2CA50] outline-none transition-all rounded-none uppercase tracking-wider font-semibold placeholder:text-neutral-700"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 font-display">CONTRASEÑA</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 px-4 bg-neutral-900 border border-neutral-800 text-xs text-white focus:border-[#F2CA50] outline-none transition-all rounded-none tracking-widest font-semibold placeholder:text-neutral-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Slider de Seguridad */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 font-display">VERIFICACIÓN DE SEGURIDAD</label>
              <div 
                ref={sliderRef}
                className={`relative h-11 w-full border flex items-center justify-center select-none overflow-hidden transition-colors duration-300 ${
                  isVerified 
                    ? "bg-[#F2CA50]/10 border-[#F2CA50]" 
                    : "bg-neutral-900 border-neutral-800"
                }`}
              >
                <span className={`text-[8px] font-bold uppercase tracking-widest transition-opacity duration-300 ${
                  isVerified ? "text-[#F2CA50]" : "text-neutral-500"
                }`}>
                  {isVerified ? "CONEXIÓN VERIFICADA" : "DESLICE PARA DESBLOQUEAR SISTEMA"}
                </span>

                <div
                  onMouseDown={onMouseDown}
                  onTouchStart={onTouchStart}
                  style={{ 
                    transform: `translateX(${sliderPosition}px)`,
                    transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                  }}
                  className={`absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors duration-300 ${
                    isVerified 
                      ? "bg-[#F2CA50] text-black" 
                      : "bg-neutral-800 text-neutral-400 hover:bg-[#F2CA50] hover:text-black"
                  }`}
                >
                  {isVerified ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-none text-center">
                <p className="text-red-400 text-[10px] uppercase tracking-wider font-semibold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !isVerified}
              className={`w-full h-12 font-bold text-xs uppercase tracking-widest transition-all rounded-none border ${
                isVerified && !isLoading
                  ? "bg-[#F2CA50] text-black border-[#F2CA50] hover:bg-[#E5BF45] cursor-pointer"
                  : "bg-transparent text-neutral-600 border-neutral-800 cursor-not-allowed"
              }`}
            >
              ACCEDER AL PANEL
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}