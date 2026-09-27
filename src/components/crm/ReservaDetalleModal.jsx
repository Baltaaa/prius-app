import { usePagos } from '../../hooks/usePagos'
import { formatCurrency, formatDate, unidadEmoji } from '../../lib/format'
import { formatMedioPago } from '../../lib/pagos'
import { coSocios, pagoSinVerificar, estadoBadgeStatus } from '../../lib/reservas'
import { HelpCircle } from 'lucide-react'
import Modal from './Modal'
import MontoReserva from './MontoReserva'
import SaldoReserva from './SaldoReserva'
import StatusBadge from './StatusBadge'

const TIPO_LABEL = { temporada: 'Temporada', periodo: 'Período', dia: 'Día' }

// Detalle de solo lectura de UNA reserva puntual — usado desde "Ver Detalle"
// en Home.jsx (antes navegaba a /app/reservas sin resaltar nada, el usuario
// perdía de vista cuál reserva quería ver). No reutiliza UnitModal: ese es un
// formulario de alta/edición del Plano, no un detalle con historial de pagos.
export default function ReservaDetalleModal({ reserva, onClose }) {
  const { pagos } = usePagos(reserva?.id)
  if (!reserva) return null

  const socios = coSocios(reserva)
  const esPeriodo = reserva.tipo_alquiler === 'periodo'
  const esDia = reserva.tipo_alquiler === 'dia'

  return (
    <Modal isOpen={!!reserva} onClose={onClose} title="Detalle de Reserva">
      <div className="space-y-6">
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Titular</p>
          <p className="text-lg font-bold text-white uppercase mt-1">{reserva.clientes?.nombre || 'S/N'}</p>
          {(reserva.clientes?.telefono || reserva.clientes?.mail) && (
            <p className="text-xs text-gray-400 mt-1">
              {reserva.clientes?.telefono} {reserva.clientes?.telefono && reserva.clientes?.mail && '·'} {reserva.clientes?.mail}
            </p>
          )}
          {socios.length > 0 && (
            <p className="text-[11px] text-cyan-400 uppercase tracking-widest mt-2">
              Co-socios: {socios.map((s) => s.nombre).join(', ')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unidad</p>
            <p className="text-sm text-white mt-1 uppercase">{unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tipo de alquiler</p>
            <p className="text-sm text-white mt-1">{TIPO_LABEL[reserva.tipo_alquiler] || reserva.tipo_alquiler}</p>
          </div>
          {esPeriodo && (
            <>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Desde</p>
                <p className="text-sm text-white mt-1">{formatDate(reserva.fecha_inicio)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hasta</p>
                <p className="text-sm text-white mt-1">{formatDate(reserva.fecha_fin)}</p>
              </div>
            </>
          )}
          {esDia && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha</p>
              <p className="text-sm text-white mt-1">{formatDate(reserva.fecha)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto Total</p>
            <MontoReserva reserva={reserva} className="text-sm text-white font-bold mt-1" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saldo</p>
            <SaldoReserva reserva={reserva} pagos={pagos} className="text-sm mt-1" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estado</p>
            <div className="mt-1"><StatusBadge status={estadoBadgeStatus(reserva)} /></div>
          </div>
        </div>

        {reserva.notas && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Notas</p>
            <p className="text-sm text-gray-300 mt-1">{reserva.notas}</p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Comprobantes</p>
          {pagos.length === 0 ? (
            <p className="text-xs text-gray-500 uppercase tracking-widest">Sin pagos registrados.</p>
          ) : (
            <div className="space-y-2">
              {pagos.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-xs px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-gray-400">
                    <span className="text-white font-bold">{formatDate(p.fecha)}</span>
                    {' — '}{formatMedioPago(p)}
                    {p.comprobante && <span> · Comp. {p.comprobante}</span>}
                    {p.nro_cuota && <span> · Cuota {p.nro_cuota}</span>}
                  </div>
                  {pagoSinVerificar(p) ? (
                    <strong className="inline-flex items-center gap-1.5 text-gray-500 text-[11px] uppercase tracking-widest">
                      <HelpCircle size={12} /> Sin verificar
                    </strong>
                  ) : (
                    <strong className="text-green-400">{formatCurrency(p.monto)}</strong>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
