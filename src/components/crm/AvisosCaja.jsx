import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock } from 'lucide-react'
import { useCaja } from '../../hooks/useCaja'
import { cajasConArqueoPendiente, ddmm, nivelAvisoCierre } from '../../lib/cierreCaja'

// Cierre inminente: a las 23:30 y a las 23:55 ART, si la caja de hoy sigue abierta, un banner con
// el botón al cierre manual (a las 00:00 ART el sistema la cierra solo, sin arqueo).
export function AvisoCierreInminente() {
  const { cajaHoy } = useCaja()
  const navigate = useNavigate()
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  if (cajaHoy?.estado !== 'abierta') return null
  const aviso = nivelAvisoCierre(ahora)
  if (!aviso) return null
  const urgente = aviso.nivel === 'urgente'
  return (
    <div role="alert" className={`no-print mb-grid p-card rounded-card flex flex-wrap items-center gap-3 border ${urgente ? 'bg-danger-soft border-danger/30 text-danger-ink' : 'bg-gold-100 border-gold-300 text-ink'}`}>
      <Clock size={18} className="shrink-0" />
      <p className="flex-1 min-w-[220px] text-body">
        {urgente ? `Faltan ${aviso.falta} min:` : 'La caja sigue abierta.'} A las 00:00 el sistema la cierra solo y queda pendiente el arqueo.
      </p>
      <button type="button" onClick={() => navigate('/app/caja?cerrar=1')} className="btn btn-secondary h-11 md:h-10 min-h-0">Ir al cierre</button>
    </div>
  )
}

// Arqueo pendiente: la caja de un día anterior se cerró automáticamente y falta el arqueo y la Z.
export function AvisoArqueoPendiente({ compacto = false, className = '' }) {
  const { historialCajas } = useCaja()
  const navigate = useNavigate()
  const pendientes = cajasConArqueoPendiente(historialCajas)
  if (pendientes.length === 0) return null
  const c = pendientes[0]
  const ir = () => navigate(`/app/caja?fecha=${c.fecha}&cerrar=1`)
  const texto = `La caja del ${ddmm(c.fecha)} se cerró automáticamente: falta el arqueo`
  if (compacto) {
    return (
      <button type="button" onClick={ir} className={`mt-3 w-full text-left rounded-inner bg-gold text-ink px-3 py-2 text-label ${className}`}>
        {texto}{pendientes.length > 1 ? ` (+${pendientes.length - 1} más)` : ''} · Hacer arqueo
      </button>
    )
  }
  return (
    <div role="alert" className={`no-print p-card rounded-card flex flex-wrap items-center gap-3 bg-gold-100 border border-gold-300 text-ink ${className}`}>
      <AlertTriangle size={18} className="shrink-0" />
      <p className="flex-1 min-w-[220px] text-body">
        {texto}{pendientes.length > 1 ? ` (y ${pendientes.length - 1} más)` : ''}. Hacé el arqueo y cargá la Z.
      </p>
      <button type="button" onClick={ir} className="btn btn-secondary h-11 md:h-10 min-h-0">Hacer arqueo y Z</button>
    </div>
  )
}
