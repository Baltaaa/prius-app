import { Wallet, Receipt, Edit2, XCircle, Trash2, QrCode } from 'lucide-react'
import { coSocios, estadoBadgeStatus } from '../../lib/reservas'
import { formatFecha, formatPesosVisible, unidadEmoji, formatUnidad, formatNombre} from '../../lib/format'
import StatusBadge from './StatusBadge'
import MontoReserva from './MontoReserva'

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
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.key} className="space-y-2">
          <p className="text-label-md text-prius-slate uppercase tracking-wider px-1">
            {g.key === 'sin-fecha' ? 'Sin fecha' : formatFecha(g.key)}
          </p>
          <div className="space-y-2">
            {g.items.map((res) => {
              const esTemporada = res.tipo_alquiler === 'temporada'
              return (
                <div
                  key={res.id}
                  onClick={() => (esTemporada ? onIrACliente(res) : onOpenDetalle(res))}
                  className="card-light rounded-2xl p-space-md cursor-pointer active:opacity-80 transition-opacity"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-title-md text-black truncate">{formatNombre(res.clientes?.nombre) || 'S/N'}</p>
                      <p className="text-body-sm text-prius-slate mt-0.5">
                        {unidadEmoji(res.unidades?.tipo)} {formatUnidad(res.unidades?.tipo, res.unidades?.numero)}
                        {esTemporada ? ' · Temporada' : ''}
                      </p>
                      {coSocios(res).length > 0 && (
                        <p className="text-body-sm text-prius-muted truncate">Co-socios: {coSocios(res).map((s) => s.nombre).join(', ')}</p>
                      )}
                    </div>
                    <StatusBadge status={estadoBadgeStatus(res)} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
                    <div>
                      <p className="text-label-md text-prius-muted uppercase">Saldo</p>
                      <p className={`text-title-md font-bold ${Number(res.saldo) > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                        {Number(res.saldo) > 0 ? formatPesosVisible(res.saldo) : <MontoReserva reserva={res} />}
                      </p>
                    </div>
                    {!esTemporada && (
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {estadoBadgeStatus(res) === 'preconfirmada' && (
                          <button onClick={() => onCheckIn(res)} className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-sky-50 text-sky-600 rounded-lg" title="Check-in">
                            <QrCode size={15} />
                          </button>
                        )}
                        {!res.bonificada && (
                          <button
                            onClick={() => onRegistrarPago(res)}
                            disabled={Number(res.saldo) <= 0}
                            className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-green-50 disabled:opacity-30 text-prius-success rounded-lg"
                            title="Registrar pago"
                          >
                            <Wallet size={15} />
                          </button>
                        )}
                        <button onClick={() => onComprobante(res)} className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-prius-subtle text-black rounded-lg" title="Comprobante">
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
