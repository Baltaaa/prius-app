import { Wallet, Receipt, Edit2, XCircle, Trash2, QrCode } from 'lucide-react'
import { coSocios, estadoBadgeStatus } from '../../lib/reservas'
import { formatFecha, formatPesosVisible, formatUnidad, formatNombre} from '../../lib/format'
import StatusBadge from './StatusBadge'
import MontoReserva from './MontoReserva'
import UnidadLabel from './UnidadLabel'

// Lista mobile de Reservas (<768px, mock 03-reservas-mobile) — agrupada por
// día de llegada, como un feed de movimientos. Mismos datos/orden que ya
// arma `filteredReservas` en Reservas.jsx (ya viene ordenada por llegada
// desc): acá solo se agrupa visualmente por la fecha que ya devuelve
// `fechaLlegada(r)`, sin resolver nada nuevo. Tap en la fila abre el
// detalle a pantalla completa (mismo patrón que UnidadPreviewModal del
// Plano en mobile) — las acciones rápidas de abajo son las mismas de
// siempre, mismos handlers.
export default function ReservaListaMobile({ reservas, fechaLlegada, onOpenDetalle, onIrACliente, onRegistrarPago, onComprobante, onEditar, onCancelar, onEliminar, onCheckIn }) {
  const grupos = []
  let grupoActual = null
  for (const r of reservas) {
    const key = fechaLlegada(r) || 'sin-fecha'
    if (!grupoActual || grupoActual.key !== key) {
      grupoActual = { key, items: [] }
      grupos.push(grupoActual)
    }
    grupoActual.items.push(r)
  }

  return (
    <div className="flex flex-col gap-section">
      {grupos.map((g) => (
        <div key={g.key}>
          <p className="section-label">
            {g.key === 'sin-fecha' ? 'Sin fecha' : formatFecha(g.key)}
          </p>
          {/* Full-bleed: filas con divisores sobre un solo fondo, sin card por reserva. */}
          <div className="-mx-page bg-card divide-y divide-divider">
            {g.items.map((res) => {
              const esTemporada = res.tipo_alquiler === 'temporada'
              return (
                <div
                  key={res.id}
                  onClick={() => (esTemporada ? onIrACliente(res) : onOpenDetalle(res))}
                  className="px-page py-4 cursor-pointer active:bg-row-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-ink truncate">{formatNombre(res.clientes?.nombre) || 'S/N'}</p>
                      <p className="text-label text-ink-2 mt-1">
                        <UnidadLabel tipo={res.unidades?.tipo} numero={res.unidades?.numero} />
                        {esTemporada ? ' · Temporada' : ''}
                      </p>
                      {coSocios(res).length > 0 && (
                        <p className="text-label text-ink-2 truncate">Co-socios: {coSocios(res).map((s) => formatNombre(s.nombre)).join(', ')}</p>
                      )}
                    </div>
                    <StatusBadge status={estadoBadgeStatus(res)} />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-label text-ink-2">Saldo</p>
                      <p className={`text-body font-semibold ${Number(res.saldo) > 0 ? 'text-danger-ink' : 'text-success-ink'}`}>
                        {Number(res.saldo) > 0 ? formatPesosVisible(res.saldo) : <MontoReserva reserva={res} />}
                      </p>
                    </div>
                    {!esTemporada && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {estadoBadgeStatus(res) === 'preconfirmada' && (
                          <button onClick={() => onCheckIn(res)} className="w-11 h-11 flex items-center justify-center bg-surface text-ink-2 rounded-full" title="Check-in">
                            <QrCode size={15} />
                          </button>
                        )}
                        {!res.bonificada && (
                          <button
                            onClick={() => onRegistrarPago(res)}
                            disabled={Number(res.saldo) <= 0}
                            className="w-11 h-11 flex items-center justify-center bg-success-soft disabled:opacity-30 text-success-ink rounded-full"
                            title="Registrar pago"
                          >
                            <Wallet size={15} />
                          </button>
                        )}
                        <button onClick={() => onComprobante(res)} className="w-11 h-11 flex items-center justify-center bg-surface text-ink rounded-full" title="Comprobante">
                          <Receipt size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
