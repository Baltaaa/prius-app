import { useNavigate } from 'react-router-dom'
import { usePagos } from '../../hooks/usePagos'
import { formatMonto, formatFecha, formatUnidad, formatNombre} from '../../lib/format'
import { formatMedioPago } from '../../lib/pagos'
import { coSocios, pagoSinVerificar, estadoBadgeStatus } from '../../lib/reservas'
import { linkToCliente, linkToReserva, linkToComprobante } from '../../lib/deepLinks'
import { HelpCircle, ArrowRight, Receipt } from 'lucide-react'
import Modal from './Modal'
import MontoReserva from './MontoReserva'
import SaldoReserva from './SaldoReserva'
import StatusBadge from './StatusBadge'
import UnidadLabel from './UnidadLabel'

const TIPO_LABEL = { temporada: 'Temporada', periodo: 'Período', dia: 'Día' }

// Detalle de solo lectura de UNA reserva puntual — usado desde "Ver Detalle"
// en Home.jsx (antes navegaba a /app/reservas sin resaltar nada, el usuario
// perdía de vista cuál reserva quería ver). No reutiliza UnitModal: ese es un
// formulario de alta/edición del Plano, no un detalle con historial de pagos.
export default function ReservaDetalleModal({ reserva, onClose }) {
  const navigate = useNavigate()
  const { pagos } = usePagos(reserva?.id)
  if (!reserva) return null

  // Temporada vive en Clientes (directorio maestro), período/día en
  // Reservas (cola operativa) — ver CLAUDE.md "Reservas vs Clientes".
  const verCompleta = () => {
    onClose?.()
    navigate(
      reserva.tipo_alquiler === 'temporada'
        ? linkToCliente(reserva.cliente_id, { reservaId: reserva.id })
        : linkToReserva(reserva.id),
    )
  }

  const socios = coSocios(reserva)
  const esPeriodo = reserva.tipo_alquiler === 'periodo'
  const esDia = reserva.tipo_alquiler === 'dia'

  return (
    <Modal isOpen={!!reserva} onClose={onClose} title="Detalle de Reserva">
      <div className="space-y-6">
        <div>
          <p className="text-label text-ink-2">Titular</p>
          <p className="text-card-title text-ink mt-1">{formatNombre(reserva.clientes?.nombre) || 'S/N'}</p>
          {(reserva.clientes?.telefono || reserva.clientes?.mail) && (
            <p className="text-label text-ink-2 mt-1">
              {reserva.clientes?.telefono} {reserva.clientes?.telefono && reserva.clientes?.mail && '·'} {reserva.clientes?.mail}
            </p>
          )}
          {socios.length > 0 && (
            <p className="text-label text-ink-2 mt-2">
              Co-socios: {socios.map((s) => formatNombre(s.nombre)).join(', ')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-label text-ink-2">Unidad</p>
            <p className="text-label text-ink mt-1"><UnidadLabel tipo={reserva.unidades?.tipo} numero={reserva.unidades?.numero} /></p>
          </div>
          <div>
            <p className="text-label text-ink-2">Tipo de alquiler</p>
            <p className="text-body text-ink mt-1">{TIPO_LABEL[reserva.tipo_alquiler] || reserva.tipo_alquiler}</p>
          </div>
          {esPeriodo && (
            <>
              <div>
                <p className="text-label text-ink-2">Desde</p>
                <p className="text-body text-ink mt-1">{formatFecha(reserva.fecha_inicio)}</p>
              </div>
              <div>
                <p className="text-label text-ink-2">Hasta</p>
                <p className="text-body text-ink mt-1">{formatFecha(reserva.fecha_fin)}</p>
              </div>
            </>
          )}
          {esDia && (
            <div>
              <p className="text-label text-ink-2">Fecha</p>
              <p className="text-body text-ink mt-1">{formatFecha(reserva.fecha)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 bg-surface border border-line rounded-inner">
          <div>
            <p className="text-label text-ink-2">Monto Total</p>
            <MontoReserva reserva={reserva} className="text-body text-ink font-semibold mt-1" />
          </div>
          <div>
            <p className="text-label text-ink-2">Saldo</p>
            <SaldoReserva reserva={reserva} pagos={pagos} className="text-body mt-1" />
          </div>
          <div>
            <p className="text-label text-ink-2">Estado</p>
            <div className="mt-1"><StatusBadge status={estadoBadgeStatus(reserva)} /></div>
          </div>
        </div>

        {reserva.notas && (
          <div>
            <p className="text-label text-ink-2">Notas</p>
            <p className="text-body text-ink-2 mt-1">{reserva.notas}</p>
          </div>
        )}

        <div>
          <p className="text-label text-ink-2 mb-2">Comprobantes</p>
          {pagos.length === 0 ? (
            <p className="text-label text-ink-2">Sin pagos registrados.</p>
          ) : (
            <div className="space-y-2">
              {pagos.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-label px-4 py-3 bg-surface border border-line rounded-inner">
                  <div className="text-ink-2">
                    <span className="text-ink font-semibold">{formatFecha(p.fecha)}</span>
                    {' — '}{formatMedioPago(p)}
                    {p.comprobante && <span> · Comp. {p.comprobante}</span>}
                    {p.nro_cuota && <span> · Cuota {p.nro_cuota}</span>}
                  </div>
                  {pagoSinVerificar(p) ? (
                    <strong className="text-label inline-flex items-center gap-2 text-ink-2">
                      <HelpCircle size={12} /> Sin verificar
                    </strong>
                  ) : (
                    <strong className="text-success-ink">{formatMonto(p.monto)}</strong>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { onClose?.(); navigate(linkToComprobante(reserva.id)) }}
            className="text-label flex-1 py-3 rounded-full bg-surface text-ink border border-line hover:bg-surface transition-all flex items-center justify-center gap-2"
          >
            <Receipt size={14} /> Emitir comprobante
          </button>
          <button
            type="button"
            onClick={verCompleta}
            className="text-label flex-1 py-3 rounded-full bg-surface text-ink border border-gold-300 hover:bg-gold-100 transition-all flex items-center justify-center gap-2"
          >
            Ver reserva completa <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
