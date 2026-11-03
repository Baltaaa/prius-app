import { useMemo, useState } from 'react'
import WhatsAppIcon from '../../components/ui/WhatsAppIcon'
import { useFeatureUrlState } from '../../hooks/useFeatureUrlState'
import { useDeepLinkTarget } from '../../hooks/useDeepLinkTarget'
import { useLeads } from '../../hooks/useLeads'
import { normalizarTelefonoAR, waLink } from '../../lib/telefono'
import { formatFechaHora } from '../../lib/format'
import { usePermiso } from '../../context/AuthProvider'
import ConfirmarSuperadminModal from '../../components/crm/ConfirmarSuperadminModal'
import { Mail, Phone, Check, X, RotateCcw, Inbox, Trash2 } from 'lucide-react'

// Logo real de WhatsApp (no hay en lucide-react, se agrega inline para no sumar
// una librería de íconos nueva). fill="currentColor" para heredar el color del
// botón igual que hacían los íconos de lucide.

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
  nuevo: { label: 'Nuevo', cls: 'bg-gold text-ink' },
  contactado: { label: 'Contactado', cls: 'bg-success-soft text-success-ink border border-success/30' },
  descartado: { label: 'Descartado', cls: 'bg-surface text-ink-2 border border-line' },
}

const fmt = formatFechaHora

export default function Leads() {
  const { leads, loading, sinContactar, updateLead, deleteLead } = useLeads()
  const puedeEliminar = usePermiso('eliminar_lead')
  // [feat-8] filtro "Sin contactar/Todos" persistido en la URL (apagable
  // en lib/features.ts).
  const [filtro, setFiltro] = useFeatureUrlState('feat-8-leads-filtro-url', 'estado', 'todos')
  // Borrado definitivo (oct 2026): solo sobre un lead ya descartado — hay
  // leads de prueba que a veces ensucian la bandeja. Confirmación reforzada
  // (ConfirmDeleteModal), igual que cualquier otro hard delete de la app.
  const [leadAEliminar, setLeadAEliminar] = useState(null)

  // Deep link desde la notificación lead_nuevo (linkToLead): resalta la
  // tarjeta del lead. Si el filtro activo la esconde, no hace falta tocarlo
  // — "Todo" siempre la muestra y es el default.
  useDeepLinkTarget({
    params: ['id'],
    ready: !loading,
    resolve: ({ id }) => (leads.some((l) => l.id === id) ? id : null),
  })

  const visibles = useMemo(() => {
    if (filtro === 'todos') return leads
    return leads.filter((l) => (l.estado || 'nuevo') === filtro)
  }, [leads, filtro])

  const contactar = (lead) => {
    const url = lead.telefono_normalizado
      ? `https://wa.me/${lead.telefono_normalizado.replace('+', '')}`
      : waLink(lead.telefono)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    if ((lead.estado || 'nuevo') === 'nuevo') {
      updateLead(lead.id, { estado: 'contactado' }).catch(() => {})
    }
  }

  const setEstado = (lead, estado) => updateLead(lead.id, { estado }).catch(() => {})

  const confirmarEliminar = async (password) => {
    await deleteLead(leadAEliminar.id, password)
    setLeadAEliminar(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-label text-ink-2 animate-pulse">Cargando leads...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-premium-fade">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-4 py-2 rounded-inner text-[10px] font-bold border transition-all ${
                filtro === f.key
                  ? 'bg-ink text-on-ink border-ink'
                  : 'bg-surface text-ink-2 border-line hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {sinContactar > 0 && (
          <p className="text-body text-ink-2">
            <span className="text-ink font-semibold">{sinContactar} sin contactar</span>
          </p>
        )}
      </div>

      {visibles.length === 0 && (
        <div className="card-surface text-label p-12 text-center text-ink-2 flex flex-col items-center gap-3">
          <Inbox size={28} className="opacity-40" />
          Sin leads en esta vista
        </div>
      )}

      <div className="space-y-4">
        {visibles.map((lead) => {
          const estado = lead.estado || 'nuevo'
          const meta = ESTADO_META[estado] || ESTADO_META.nuevo
          // Punto 5 (30/10/2026): se prioriza `telefono_normalizado` (E.164
          // calculado al dar de alta el lead + backfill). Si está en null el
          // número quedó "a revisar" y el botón de WhatsApp no se habilita.
          const tel = normalizarTelefonoAR(lead.telefono)
          const e164 = lead.telefono_normalizado || tel.e164
          const wa = e164 ? `https://wa.me/${e164.replace('+', '')}` : null
          const telMostrado = tel.valido ? tel.display : lead.telefono
          return (
            <div
              key={lead.id}
              data-deeplink-id={lead.id}
              className={`card-light rounded-card p-4 sm:p-5 md:p-6 ${
                estado === 'nuevo' ? 'border-l-2 border-gold' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {estado === 'nuevo' && (
                    <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                  )}
                  <h3 className="text-base font-semibold text-ink break-words">{lead.nombre}</h3>
                  <span className={`text-label px-2 py-0.5 rounded-full ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-label text-ink-2 mt-1">
                  {lead.asunto} · {fmt(lead.created_at)}
                  {lead.origen ? ` · ${lead.origen}` : ''}
                </p>
              </div>

              {lead.mensaje && (
                <p className="text-body text-ink-2 mt-3 whitespace-pre-wrap break-words">{lead.mensaje}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-label text-ink-2">
                <span className="inline-flex items-center gap-1.5 break-all">
                  <Phone size={12} className="text-ink-2 shrink-0" /> {telMostrado}
                  {!wa && (
                    <span className="text-label px-1.5 py-0.5 rounded-full bg-gold-100 text-ink shrink-0">
                      A revisar
                    </span>
                  )}
                </span>
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-ink break-all">
                  <Mail size={12} className="text-ink-2 shrink-0" /> {lead.email}
                </a>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-4">
                <button
                  onClick={() => contactar(lead)}
                  disabled={!wa}
                  title={wa ? 'Contactar por WhatsApp' : 'Número a revisar'}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-inner text-label font-semibold bg-success text-on-ink hover:bg-success disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                >
                  <WhatsAppIcon size={14} />
                  {wa ? 'Contactar por WhatsApp' : 'Número a revisar'}
                </button>

                <div className="flex gap-2">
                  {estado !== 'contactado' && (
                    <button
                      onClick={() => setEstado(lead, 'contactado')}
                      className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-full text-label font-semibold bg-surface text-ink-2 border border-line hover:text-ink transition-colors"
                    >
                      <Check size={14} /> Marcar contactado
                    </button>
                  )}

                  {estado !== 'descartado' ? (
                    <button
                      onClick={() => setEstado(lead, 'descartado')}
                      className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-full text-label font-semibold bg-surface text-ink-2 border border-line hover:text-ink transition-colors"
                    >
                      <X size={14} /> Descartar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEstado(lead, 'nuevo')}
                        className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-full text-label font-semibold bg-surface text-ink-2 border border-line hover:text-ink transition-colors"
                      >
                        <RotateCcw size={14} /> Reabrir
                      </button>
                      {puedeEliminar && (
                        <button
                          onClick={() => setLeadAEliminar(lead)}
                          className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-full text-label font-semibold bg-danger-soft text-danger border border-danger/30 hover:bg-danger-soft transition-colors"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmarSuperadminModal
        isOpen={!!leadAEliminar}
        onClose={() => setLeadAEliminar(null)}
        onConfirm={confirmarEliminar}
        titulo="Eliminar lead"
        afectaLinea={`${leadAEliminar?.nombre || 'Este lead'} — se borra para siempre, pensado para leads de prueba (uno real descartado por error queda con "Reabrir").`}
        confirmLabel="Eliminar definitivamente"
      />
    </div>
  )
}
