import { useMemo, useState } from 'react'
import { Inbox, ChevronDown } from 'lucide-react'
import ToolbarSticky from '../../components/brand/ToolbarSticky'
import SegmentedScroll from '../../components/brand/SegmentedScroll'
import ScrollFade from '../../components/ui/ScrollFade'
import SearchInput from '../../components/inputs/SearchInput'
import LeadDetalle, { ESTADO_META, contactoDe } from '../../components/crm/LeadDetalle'
import ConfirmarSuperadminModal from '../../components/crm/ConfirmarSuperadminModal'
import { useFeatureUrlState } from '../../hooks/useFeatureUrlState'
import { useDeepLinkTarget } from '../../hooks/useDeepLinkTarget'
import { useLeads } from '../../hooks/useLeads'
import { useEsDesktop } from '../../hooks/useMediaQuery'
import { usePermiso } from '../../context/AuthProvider'
import { normalizeText } from '../../lib/format'
import { fechaRelativa } from '../../lib/fechaRelativa'

// Bandeja de leads en tiempo real (tabla `leads`, alimentada por el form de la
// landing beachFlow vía n8n). La tabla `leads` es la fuente de verdad única; acá
// solo se leen y se cambian estados con las funciones de siempre (updateLead /
// deleteLead). No toca el flujo de n8n/WhatsApp.
//
// Mobile: lista compacta (72-84px por lead); al tocar, la fila se expande
// (250ms) con mensaje, contacto y acciones. Uno expandido a la vez.
// Desktop (≥1024px): lista + panel de detalle a la derecha, como Clientes.
const FILTROS = [
  { key: 'todos', label: 'Todo' },
  { key: 'nuevo', label: 'Sin contactar' },
  { key: 'contactado', label: 'Contactados' },
  { key: 'descartado', label: 'Descartados' },
]

const estadoDe = (l) => l.estado || 'nuevo'

function LeadFila({ lead, activo, onClick, expandible, children }) {
  const estado = estadoDe(lead)
  const meta = ESTADO_META[estado] || ESTADO_META.nuevo
  const primeraLinea = (lead.mensaje || '').split('\n').find((x) => x.trim()) || 'Sin mensaje'
  return (
    <div data-deeplink-id={lead.id} className={`${estado === 'nuevo' ? 'border-l-2 border-gold' : 'border-l-2 border-transparent'} ${activo ? 'bg-gold-50' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expandible ? activo : undefined}
        className="w-full min-h-[72px] max-h-[84px] px-3 py-3 text-left flex items-center gap-3 whitespace-normal hover-row"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {estado === 'nuevo' && <span className="w-2 h-2 rounded-full bg-gold shrink-0" />}
            <h3 className="text-body font-semibold text-ink truncate">{lead.nombre}</h3>
            <span className={`shrink-0 text-label px-2 rounded-full ${meta.cls}`}>{meta.label}</span>
          </div>
          <p className="text-label text-ink-2 truncate">{lead.asunto} · {fechaRelativa(lead.created_at)}</p>
          <p className="text-label text-ink-2 truncate">{primeraLinea}</p>
        </div>
        {expandible && <ChevronDown size={18} className={`shrink-0 text-ink-2 transition-transform duration-[250ms] ${activo ? 'rotate-180' : ''}`} />}
      </button>
      {expandible && (
        // Expansión de 250ms: la fila anima su alto de 0 a su contenido.
        <div className="grid" style={{ gridTemplateRows: activo ? '1fr' : '0fr', transition: 'grid-template-rows 250ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden min-h-0">
            <div className="px-3 pb-4 pt-1">{activo ? children : null}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Leads() {
  const { leads, loading, updateLead, deleteLead } = useLeads()
  const puedeEliminar = usePermiso('eliminar_lead')
  const esDesktop = useEsDesktop()
  const [filtro, setFiltro] = useFeatureUrlState('feat-8-leads-filtro-url', 'estado', 'todos')
  const [q, setQ] = useState('')
  const [abiertoId, setAbiertoId] = useState(null) // mobile: uno expandido; desktop: el seleccionado
  const [leadAEliminar, setLeadAEliminar] = useState(null)

  // Deep link desde la notificación lead_nuevo: abre ese lead.
  useDeepLinkTarget({
    params: ['id'],
    ready: !loading,
    resolve: ({ id }) => {
      if (!leads.some((l) => l.id === id)) return null
      setAbiertoId(id)
      return id
    },
  })

  const contadores = useMemo(() => {
    const c = { todos: leads.length, nuevo: 0, contactado: 0, descartado: 0 }
    for (const l of leads) c[estadoDe(l)] = (c[estadoDe(l)] || 0) + 1
    return c
  }, [leads])

  const visibles = useMemo(() => {
    const t = normalizeText(q).trim()
    return leads.filter((l) => {
      if (filtro !== 'todos' && estadoDe(l) !== filtro) return false
      if (!t) return true
      return [l.nombre, l.email, l.telefono, l.asunto, l.mensaje].some((v) => v && normalizeText(String(v)).includes(t))
    })
  }, [leads, filtro, q])

  const seleccionado = esDesktop ? (visibles.find((l) => l.id === abiertoId) || null) : null

  const contactar = (lead) => {
    const { wa } = contactoDe(lead)
    if (wa) window.open(wa, '_blank', 'noopener,noreferrer')
    if (estadoDe(lead) === 'nuevo') updateLead(lead.id, { estado: 'contactado' }).catch(() => {})
  }
  const setEstado = (lead, estado) => updateLead(lead.id, { estado }).catch(() => {})
  const confirmarEliminar = async (password) => {
    await deleteLead(leadAEliminar.id, password)
    if (leadAEliminar.id === abiertoId) setAbiertoId(null)
    setLeadAEliminar(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-label text-ink-2 animate-pulse">Cargando leads...</span>
      </div>
    )
  }

  const detalle = (lead) => (
    <LeadDetalle lead={lead} onEstado={setEstado} onContactar={contactar} onEliminar={setLeadAEliminar} puedeEliminar={puedeEliminar} />
  )

  return (
    <div className="animate-premium-fade">
      {/* Toolbar: buscador + tabs con contador (una sola línea, scroll con snap). */}
      <ToolbarSticky>
        <div className="toolbar-40 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar nombre, email, teléfono o mensaje" className="md:w-80 md:shrink-0" inputClassName="!bg-card" />
          <SegmentedScroll
            label="Estado del lead"
            options={FILTROS.map((f) => ({ value: f.key, label: `${f.label} ${contadores[f.key] ?? 0}` }))}
            value={filtro}
            onChange={setFiltro}
            className="min-w-0"
          />
        </div>
      </ToolbarSticky>

      {visibles.length === 0 ? (
        <div className="card-surface card-pad py-10 text-label text-center text-ink-2 flex flex-col items-center gap-3">
          <Inbox size={28} className="opacity-40" />
          Sin leads en esta vista
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-grid lg:items-start lg:pt-3">
          <div className="card-surface overflow-hidden divide-y divide-divider min-w-0">
            {visibles.map((lead) => (
              <LeadFila
                key={lead.id}
                lead={lead}
                expandible={!esDesktop}
                activo={abiertoId === lead.id}
                onClick={() => setAbiertoId((prev) => (prev === lead.id && !esDesktop ? null : lead.id))}
              >
                {!esDesktop && detalle(lead)}
              </LeadFila>
            ))}
          </div>

          {esDesktop && (
            <aside className="sticky top-3 card-surface overflow-hidden flex flex-col max-h-[calc(100dvh-var(--zona-h)-32px)] min-h-[320px]">
              {seleccionado ? (
                <ScrollFade wrapperClassName="flex-1" className="overflow-y-auto card-pad">
                  <div key={seleccionado.id} className="content-crossfade space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-card-title text-ink break-words">{seleccionado.nombre}</h2>
                      <span className={`text-label px-2 py-1 rounded-full ${(ESTADO_META[estadoDe(seleccionado)] || ESTADO_META.nuevo).cls}`}>
                        {(ESTADO_META[estadoDe(seleccionado)] || ESTADO_META.nuevo).label}
                      </span>
                    </div>
                    {detalle(seleccionado)}
                  </div>
                </ScrollFade>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 card-pad text-ink-2">
                  <Inbox size={22} />
                  <p className="text-label max-w-[220px]">Elegí un lead para ver el mensaje y contactarlo.</p>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

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
