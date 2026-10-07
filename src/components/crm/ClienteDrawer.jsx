import { useId } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Wallet, CalendarPlus, ArrowRight, Phone, Mail } from 'lucide-react'
import { useData } from '../../context/DataProvider'
import { useOverlay } from '../../context/OverlayProvider'
import { formatPesosVisible, formatTelefono, unidadEmoji } from '../../lib/format'
import { saldoNumerico, estadoBadgeStatus } from '../../lib/reservas'
import { linkToCliente, linkToNuevaReservaCliente } from '../../lib/deepLinks'
import StatusBadge from './StatusBadge'
import Historial from './Historial'

/**
 * [feat-3] Drawer de cliente (Tarea 6, oct 2026) — panel lateral (bottom
 * sheet en mobile) con lo esencial de un cliente sin salir de la pantalla
 * donde estás: se abre pasándole `clienteId`, no navega a Clientes.jsx
 * salvo que el usuario pida "Ver ficha completa". Respeta el overlay
 * manager de la Tarea 1 (click afuera / Escape lo cierra, no reintroduce
 * lógica propia de cierre).
 *
 * Deliberadamente liviano: no reimplementa toda la ficha de Clientes.jsx
 * (grilla de pagos completa, alta de comprobante, etc.) — para eso está
 * "Ver ficha completa". Muestra datos, reservas activas con saldo,
 * últimos eventos del Historial y las dos acciones rápidas más usadas.
 */
export default function ClienteDrawer({ clienteId, onClose, onRegistrarPago }) {
  const navigate = useNavigate()
  const { clientes, reservas, pagos } = useData()
  const overlayId = useId()
  const { bind } = useOverlay({ id: `cliente-drawer-${overlayId}`, isOpen: !!clienteId, onRequestClose: () => onClose?.() })

  if (!clienteId) return null
  const cliente = clientes.find((c) => c.id === clienteId)
  if (!cliente) return null

  const reservasCliente = reservas.filter((r) => r.cliente_id === clienteId && r.estado !== 'cancelada')
  const pagosPorReserva = {}
  for (const p of pagos) (pagosPorReserva[p.reserva_id] ||= []).push(p)

  return createPortal(
    <div className="fixed inset-0 z-[996] flex items-end sm:items-stretch sm:justify-end bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={() => onClose?.()}>
      <div
        ref={bind}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[420px] max-h-[88vh] sm:max-h-none sm:h-full glass-card sm:rounded-none rounded-t-3xl border-l border-white/10 flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm uppercase font-bold tracking-widest text-white truncate">{cliente.nombre}</h2>
            {cliente.telefono && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5"><Phone size={11} /> {formatTelefono(cliente.telefono)}</p>
            )}
            {cliente.mail && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 lowercase"><Mail size={11} /> {cliente.mail}</p>}
          </div>
          <button onClick={() => onClose?.()} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { onRegistrarPago?.(cliente); onClose?.() }}
              className="py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Wallet size={14} /> Registrar pago
            </button>
            <button
              onClick={() => { navigate(linkToNuevaReservaCliente(cliente.id)); onClose?.() }}
              className="py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              <CalendarPlus size={14} /> Nueva reserva
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reservas</p>
            {reservasCliente.length === 0 ? (
              <p className="text-xs text-gray-500 uppercase tracking-widest">Sin reservas activas.</p>
            ) : (
              <div className="space-y-2">
                {reservasCliente.map((r) => {
                  const saldo = saldoNumerico(r, pagosPorReserva[r.id] || [])
                  return (
                    <div key={r.id} className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white uppercase truncate">
                          {unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero}
                        </p>
                        <StatusBadge status={estadoBadgeStatus(r)} />
                      </div>
                      {saldo > 0 && <span className="text-xs font-bold text-red-400 shrink-0">{formatPesosVisible(saldo)}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Últimos eventos</p>
            <Historial tipo="cliente" id={clienteId} compact />
          </div>
        </div>

        <button
          onClick={() => { navigate(linkToCliente(cliente.id)); onClose?.() }}
          className="shrink-0 w-full py-4 border-t border-white/10 bg-white/5 text-xs font-bold uppercase tracking-widest text-[#FDE047] hover:bg-white/10 transition-all flex items-center justify-center gap-2"
        >
          Ver ficha completa <ArrowRight size={14} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
