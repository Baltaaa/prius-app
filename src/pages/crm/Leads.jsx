import { useMemo, useState } from 'react'
import { useLeads, waLink } from '../../hooks/useLeads'
import { Mail, Phone, Check, X, RotateCcw, Inbox } from 'lucide-react'

// Logo real de WhatsApp (no hay en lucide-react, se agrega inline para no sumar
// una librería de íconos nueva). fill="currentColor" para heredar el color del
// botón igual que hacían los íconos de lucide.
function WhatsAppIcon({ size = 14, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.005c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2m0 1.67a8.23 8.23 0 0 1 5.83 2.42 8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.55 3.7-8.24 8.25-8.24M8.53 6.95c-.17 0-.45.06-.68.32-.24.25-.9.88-.9 2.15 0 1.27.92 2.5 1.05 2.67.13.17 1.8 2.89 4.45 3.94 2.2.87 2.65.7 3.13.65.48-.04 1.53-.62 1.75-1.22.22-.6.22-1.11.15-1.22-.07-.1-.24-.17-.5-.3-.26-.13-1.53-.75-1.77-.84-.24-.09-.4-.13-.58.13-.17.26-.66.84-.81 1.01-.15.17-.3.19-.56.06-.26-.13-1.08-.4-2.07-1.27-.76-.68-1.28-1.52-1.43-1.78-.15-.26-.02-.4.11-.53.12-.12.26-.3.4-.45.13-.15.17-.26.26-.43.08-.17.04-.32-.02-.45-.06-.13-.58-1.43-.81-1.95-.2-.5-.42-.44-.58-.44z" />
    </svg>
  )
}

// Bandeja de leads en tiempo real (tabla `leads`, alimentada por el form de la
// landing beachFlow vía n8n). Es el canal de lectura de leads del CRM: reemplaza
// en producción a la notificación automática por CallMeBot al WhatsApp
// administrativo. La tabla `leads` sigue siendo la fuente de verdad única.
const FILTROS = [
  { key: 'todos', label: 'Todo' },
  { key: 'nuevo', label: 'Sin contactar' },
  { key: 'contactado', label: 'Contactados' },
  { key: 'descartado', label: 'Descartados' },
]

const ESTADO_META = {
  nuevo: { label: 'Nuevo', cls: 'bg-[#FDE047] text-black' },
  contactado: { label: 'Contactado', cls: 'bg-green-400/15 text-green-400 border border-green-400/20' },
  descartado: { label: 'Descartado', cls: 'bg-white/5 text-gray-500 border border-white/10' },
}

const fmt = (s) =>
  new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Leads() {
  const { leads, loading, sinContactar, updateLead } = useLeads()
  const [filtro, setFiltro] = useState('todos')

  const visibles = useMemo(() => {
    if (filtro === 'todos') return leads
    return leads.filter((l) => (l.estado || 'nuevo') === filtro)
  }, [leads, filtro])

  const contactar = (lead) => {
    const url = waLink(lead.telefono)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    if ((lead.estado || 'nuevo') === 'nuevo') {
      updateLead(lead.id, { estado: 'contactado' }).catch(() => {})
    }
  }

  const setEstado = (lead, estado) => updateLead(lead.id, { estado }).catch(() => {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Cargando leads...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-premium-fade">
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Leads</h1>
        <p className="text-gray-400 text-sm mt-2">
          Consultas del formulario de la web, en tiempo real.
          {sinContactar > 0 && (
            <span className="ml-2 text-[#FDE047] font-semibold">{sinContactar} sin contactar</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
              filtro === f.key
                ? 'bg-[#FDE047] text-black border-[#FDE047]'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibles.length === 0 && (
        <div className="glass-card rounded-3xl p-12 text-center text-gray-600 uppercase text-xs tracking-widest flex flex-col items-center gap-3">
          <Inbox size={28} className="opacity-40" />
          Sin leads en esta vista
        </div>
      )}

      <div className="space-y-4">
        {visibles.map((lead) => {
          const estado = lead.estado || 'nuevo'
          const meta = ESTADO_META[estado] || ESTADO_META.nuevo
          const wa = waLink(lead.telefono)
          return (
            <div
              key={lead.id}
              className={`glass-card rounded-2xl p-4 sm:p-5 md:p-6 ${
                estado === 'nuevo' ? 'border-l-2 border-[#FDE047]' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {estado === 'nuevo' && (
                    <span className="w-2 h-2 rounded-full bg-[#FDE047] shrink-0" />
                  )}
                  <h3 className="text-base font-bold text-white break-words">{lead.nombre}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mt-1">
                  {lead.asunto} · {fmt(lead.created_at)}
                  {lead.origen ? ` · ${lead.origen}` : ''}
                </p>
              </div>

              {lead.mensaje && (
                <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap break-words">{lead.mensaje}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1.5 break-all">
                  <Phone size={12} className="text-gray-600 shrink-0" /> {lead.telefono}
                </span>
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-white break-all">
                  <Mail size={12} className="text-gray-600 shrink-0" /> {lead.email}
                </a>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-4">
                <button
                  onClick={() => contactar(lead)}
                  disabled={!wa}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-xl text-xs font-bold bg-green-500 text-white hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                >
                  <WhatsAppIcon size={14} />
                  {wa ? 'Contactar por WhatsApp' : 'Teléfono inválido'}
                </button>

                <div className="flex gap-2">
                  {estado !== 'contactado' && (
                    <button
                      onClick={() => setEstado(lead, 'contactado')}
                      className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-xl text-xs font-bold bg-white/5 text-gray-300 border border-white/10 hover:text-white transition-colors"
                    >
                      <Check size={14} /> Marcar contactado
                    </button>
                  )}

                  {estado !== 'descartado' ? (
                    <button
                      onClick={() => setEstado(lead, 'descartado')}
                      className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-xl text-xs font-bold bg-white/5 text-gray-500 border border-white/10 hover:text-white transition-colors"
                    >
                      <X size={14} /> Descartar
                    </button>
                  ) : (
                    <button
                      onClick={() => setEstado(lead, 'nuevo')}
                      className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-xl text-xs font-bold bg-white/5 text-gray-400 border border-white/10 hover:text-white transition-colors"
                    >
                      <RotateCcw size={14} /> Reabrir
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
