import { Mail, Phone, Check, X, RotateCcw, Copy, Trash2 } from 'lucide-react'
import WhatsAppIcon from '../ui/WhatsAppIcon'
import { useDialog } from '../../context/DialogProvider'
import { normalizarTelefonoAR, waLink } from '../../lib/telefono'
import { formatFechaHora } from '../../lib/format'

export const ESTADO_META = {
  nuevo: { label: 'Nuevo', cls: 'bg-gold text-ink' },
  contactado: { label: 'Contactado', cls: 'bg-success-soft text-success-ink border border-success/30' },
  descartado: { label: 'Descartado', cls: 'bg-surface text-ink-2 border border-line' },
}

// Datos de contacto de un lead, con el criterio de siempre: se prioriza
// `telefono_normalizado` (E.164) y si no hay, el número queda "a revisar".
export function contactoDe(lead) {
  const tel = normalizarTelefonoAR(lead.telefono)
  const e164 = lead.telefono_normalizado || tel.e164
  return {
    e164,
    wa: e164 ? `https://wa.me/${e164.replace('+', '')}` : null,
    telMostrado: tel.valido ? tel.display : lead.telefono,
  }
}

const btn = 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full text-label font-semibold border transition-colors min-w-0'
const btnNeutro = `${btn} bg-surface text-ink border-line hover:bg-card`

// Detalle de un lead: mensaje, teléfono, email y acciones. Lo usa la fila
// expandida de mobile y el panel de desktop. Las acciones de estado son las
// funciones existentes (updateLead / deleteLead); no toca el flujo de n8n.
export default function LeadDetalle({ lead, onEstado, onContactar, onEliminar, puedeEliminar }) {
  const { toast } = useDialog()
  const estado = lead.estado || 'nuevo'
  const { wa, e164, telMostrado } = contactoDe(lead)
  const llamar = e164 ? `tel:${e164}` : lead.telefono ? `tel:${String(lead.telefono).replace(/\s+/g, '')}` : null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(telMostrado || lead.telefono || '')
      toast('Teléfono copiado', { tone: 'success' })
    } catch {
      toast('No se pudo copiar el teléfono', { tone: 'error' })
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-label text-ink-2">
        {lead.asunto} · {formatFechaHora(lead.created_at)}{lead.origen ? ` · ${lead.origen}` : ''}
      </p>
      {lead.mensaje && <p className="text-body text-ink whitespace-pre-wrap break-words">{lead.mensaje}</p>}

      <div className="space-y-2 text-label text-ink-2">
        <p className="inline-flex flex-wrap items-center gap-2 break-all">
          <Phone size={14} className="shrink-0" /> <span className="text-ink">{telMostrado}</span>
          {!wa && <span className="px-2 py-1 rounded-full bg-gold-100 text-ink">A revisar</span>}
        </p>
        <p className="flex items-center gap-2 break-all"><Mail size={14} className="shrink-0" /> <span className="text-ink">{lead.email}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onContactar(lead)}
          disabled={!wa}
          title={wa ? 'Contactar por WhatsApp' : 'Número a revisar'}
          className={`${btn} bg-success text-on-ink border-success disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <WhatsAppIcon size={14} /> WhatsApp
        </button>
        <a href={llamar || undefined} aria-disabled={!llamar} className={`${btnNeutro} ${llamar ? '' : 'opacity-40 pointer-events-none'}`}>
          <Phone size={14} /> Llamar
        </a>
        <a href={lead.email ? `mailto:${lead.email}` : undefined} aria-disabled={!lead.email} className={`${btnNeutro} ${lead.email ? '' : 'opacity-40 pointer-events-none'}`}>
          <Mail size={14} /> Email
        </a>
        <button type="button" onClick={copiar} className={btnNeutro}><Copy size={14} /> Copiar</button>
        {estado !== 'contactado' && (
          <button type="button" onClick={() => onEstado(lead, 'contactado')} className={btnNeutro}>
            <Check size={14} /> <span className="truncate">Marcar contactado</span>
          </button>
        )}
        {estado !== 'descartado' ? (
          <button type="button" onClick={() => onEstado(lead, 'descartado')} className={btnNeutro}><X size={14} /> Descartar</button>
        ) : (
          <>
            <button type="button" onClick={() => onEstado(lead, 'nuevo')} className={btnNeutro}><RotateCcw size={14} /> Reabrir</button>
            {puedeEliminar && (
              <button type="button" onClick={() => onEliminar(lead)} className={`${btn} bg-danger-soft text-danger border-danger/30`}>
                <Trash2 size={14} /> Eliminar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
