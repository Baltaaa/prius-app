import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useCaja } from '../../hooks/useCaja'
import { nivelAvisoCierre } from '../../lib/cierreCaja'

// Nov 2026: acá vivía además `AvisoArqueoPendiente`, el banner amarillo "la caja
// del DD/MM se cerró automáticamente". Se eliminó: aparecía aunque estuvieras
// viendo otra fecha y metía color de más. El acceso al flujo no se perdió —
// cuando la caja que se está viendo quedó sin arqueo, Caja.jsx muestra el botón
// neutro "Hacer arqueo y Z" en su barra de acciones. El cierre automático de las
// 00:00 y la notificación derivada (lib/cierreCaja.js) siguen igual.

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
