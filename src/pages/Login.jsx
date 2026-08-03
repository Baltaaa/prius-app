import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Eye, EyeOff, ShieldCheck, ShieldAlert, Lock } from "lucide-react"
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
    const handleWidth = 44 
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
        setError("Email o contraseña incorrectos.")
        setIsVerified(false)
        setSliderPosition(0)
        setIsLoading(false)
        return
      }

      if (data?.user) {
        setTimeout(() => {
          navigate("/app/home")
        }, 1000)
      }
    } catch (err) {
      setError("Error de conexión. Verifica tu acceso.")
      setIsVerified(false)
      setSliderPosition(0)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex flex-col justify-center items-center p-4 font-sans text-black">
      {isLoading && <GlobalLoader message="Iniciando sesión en PriusAdmin" />}

      <div className="w-full max-w-md bg-white border border-[#E5E5E5] rounded p-8 space-y-6">
        
        {/* Brand Badge Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-md mx-auto flex items-center justify-center overflow-hidden">
            <img src="/logo-prius.png" alt="Prius Logo" className="w-full h-full object-cover scale-125" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-black">PriusAdmin</h1>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-0.5">Playa Grande — Iniciar Sesión</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@priusplayagrande.com"
              required
              className="w-full h-10 px-3 bg-white border border-[#E5E5E5] text-xs text-black focus:border-black outline-none rounded font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-10 px-3 bg-white border border-[#E5E5E5] text-xs text-black focus:border-black outline-none rounded font-medium pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Slide to Verify Security Barrier */}
          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
              <Lock size={12} /> Verificación de Seguridad
            </label>
            <div 
              ref={sliderRef}
              className={`relative h-11 w-full border flex items-center justify-center select-none overflow-hidden rounded transition-colors duration-200 ${
                isVerified 
                  ? "bg-green-50 border-green-300" 
                  : "bg-[#F9F9F9] border-[#E5E5E5]"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider transition-opacity duration-200 ${
                isVerified ? "text-green-700" : "text-neutral-400"
              }`}>
                {isVerified ? "VERIFICADO CORRECTAMENTE" : "DESLIZAR PARA DESBLOQUEAR"}
              </span>

              <div
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                style={{ 
                  transform: `translateX(${sliderPosition}px)`,
                  transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
                className={`absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center cursor-grab active:cursor-grabbing rounded transition-colors duration-200 ${
                  isVerified 
                    ? "bg-green-600 text-white" 
                    : "bg-[#F2CA50] text-black hover:bg-[#E5BF45]"
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
            <div className="p-3 bg-red-50 border border-red-200 rounded text-center">
              <p className="text-red-600 text-xs font-semibold">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !isVerified}
            className={`w-full h-11 font-bold text-xs uppercase tracking-wider rounded transition-colors ${
              isVerified && !isLoading
                ? "bg-[#F2CA50] hover:bg-[#E5BF45] text-black cursor-pointer"
                : "bg-[#E5E5E5] text-neutral-400 cursor-not-allowed"
            }`}
          >
            Ingresar al Panel
          </button>
        </form>

        <div className="text-center border-t border-[#E5E5E5] pt-4">
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
            PriusAdmin &bull; Balneario Playa Grande
          </p>
        </div>
      </div>
    </div>
  )
}