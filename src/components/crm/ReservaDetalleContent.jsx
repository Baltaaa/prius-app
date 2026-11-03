import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Wallet, Receipt, Edit2, XCircle, Trash2, QrCode, Globe, MonitorSmartphone, Users, ShieldAlert } from 'lucide-react'
import { usePagos } from '../../hooks/usePagos'
import { coSocios, estadoBadgeStatus, saldoNumerico, pagoSinVerificar } from '../../lib/reservas'
import { formatFecha, formatRangoFechas, formatPesosVisible, formatComprobante, formatUnidad, formatNombre} from '../../lib/format'
import { linkToComprobante, linkToRecepcion } from '../../lib/deepLinks'
import { usePermiso } from '../../context/AuthProvider'
import StatusBadge from './StatusBadge'
import MontoReserva from './MontoReserva'
import CambiarEstadoPagoModal from './CambiarEstadoPagoModal'
import GestionCosociosModal from './GestionCosociosModal'
import UnidadLabel from './UnidadLabel'

const TIPO_LABEL = { periodo: 'Período', dia: 'Día', temporada: 'Temporada' }

// Detalle de una reserva período/día — contenido compartido entre el panel
// lateral fijo de desktop (≥1024px), la hoja inferior de tablet y la
// pantalla completa de mobile (mismo patrón que UnidadDetalleContent.jsx
// del Plano: una sola fuente de datos/acciones, cada contenedor solo
// cambia cómo la envuelve). Mismos handlers que ya usaba la fila de la
// tabla/tarjeta — nada nuevo, solo reorganizado en cards tipo mock.
export default function ReservaDetalleContent({
  reserva, fechaLlegada, onClose, onRegistrarPago, onEditar, onCancelar, onEliminar, onCellClick, showCloseButton = true, wide = false,
}) {
  const navigate = useNavigate()
  const { pagos } = usePagos(reserva?.id)
  const puedeAjustarEstadoPago = usePermiso('ajustar_estado_pago')
  const [mostrarCambiarEstado, setMostrarCambiarEstado] = useState(false)
  const [mostrarCosocios, setMostrarCosocios] = useState(false)

  if (!reserva) return null

  const socios = coSocios(reserva)
  const cuotas = [...pagos].sort((a, b) => (a.nro_cuota || 0) - (b.nro_cuota || 0))
  const saldo = saldoNumerico(reserva, cuotas)
  const fechasLabel = reserva.tipo_alquiler === 'dia'
    ? formatFecha(reserva.fecha)
    : formatRangoFechas(reserva.fecha_inicio, reserva.fecha_fin)

  return (
    <>
      <div className="flex items-start justify-between pb-4 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body text-ink truncate">{formatNombre(reserva.clientes?.nombre) || 'S/N'}</span>
            <StatusBadge status={estadoBadgeStatus(reserva)} />
          </div>
          <p className="text-label text-ink-2 mt-1">
            <UnidadLabel tipo={reserva.unidades?.tipo} numero={reserva.unidades?.numero} /> · {TIPO_LABEL[reserva.tipo_alquiler] || reserva.tipo_alquiler}
          </p>
        </div>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface text-ink-2 hover:text-ink flex items-center justify-center transition-colors shrink-0"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Ítem 2 (25/10/2026): aviso cuando el estado de pago fue ajustado
            a mano — visible para todos, no solo superadmin (transparencia
            de por qué el badge no coincide con lo que calcularía el saldo). */}
        {reserva.estado_pago_manual && (
          <div className="flex items-start gap-2 p-3 bg-gold-100 border border-gold-300 rounded-inner">
            <ShieldAlert size={14} className="text-ink shrink-0 mt-1" />
            <p className="text-label text-ink-2">
              Estado ajustado manualmente{reserva.estado_pago_manual_motivo ? ` — ${reserva.estado_pago_manual_motivo}` : ''}.
            </p>
          </div>
        )}

        {/* Cliente */}
        <div className="bg-surface rounded-inner p-4 flex flex-col gap-2">
          <span className="text-label text-ink-2">Cliente</span>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-inner bg-ink text-on-ink flex items-center justify-center text-body font-semibold shrink-0">
              {(reserva.clientes?.nombre || 'S/N').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body text-ink truncate">{formatNombre(reserva.clientes?.nombre) || 'S/N'}</p>
              {socios.length > 0 && (
                <p className="text-label text-ink-2 truncate flex items-center gap-1">
                  <Users size={12} className="shrink-0" /> {socios.map((s) => formatNombre(s.nombre)).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Unidad y fechas — en el panel ancho (Bloque B, 26/10/2026) pasan
            a una grilla de dos columnas en vez de lista vertical, para
            aprovechar el 40% de ancho y bajar la altura total del panel. */}
        {wide ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <span className="block text-label text-ink-2 mb-1">Llegada</span>
              <span className="text-body text-ink font-medium">{formatFecha(fechaLlegada(reserva))}</span>
            </div>
            <div>
              <span className="block text-label text-ink-2 mb-1">Fechas</span>
              <span className="text-body text-ink font-medium">{fechasLabel}</span>
            </div>
            <div>
              <span className="block text-label text-ink-2 mb-1">Origen</span>
              <span className="text-body text-ink font-medium flex items-center gap-2">
                {reserva.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                {reserva.origen === 'web' ? 'Web' : 'Manual'}
              </span>
            </div>
            {reserva.notas && (
              <div className="col-span-2">
                <span className="block text-label text-ink-2 mb-1">Notas</span>
                <span className="text-body text-ink">{reserva.notas}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between py-2">
              <span className="text-label text-ink-2">Llegada</span>
              <span className="text-body text-ink font-medium">{formatFecha(fechaLlegada(reserva))}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-label text-ink-2">Fechas</span>
              <span className="text-body text-ink font-medium text-right">{fechasLabel}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-label text-ink-2">Origen</span>
              <span className="text-body text-ink font-medium flex items-center gap-2">
                {reserva.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                {reserva.origen === 'web' ? 'Web' : 'Manual'}
              </span>
            </div>
            {reserva.notas && (
              <div className="py-2">
                <span className="block text-label text-ink-2">Notas</span>
                <span className="text-body text-ink">{reserva.notas}</span>
              </div>
            )}
          </div>
        )}

        {/* Pagos: total/pagado/saldo + lista, estilo mock — lectura, el alta
            de un pago nuevo sigue siendo la acción "Registrar pago" de
            abajo (mismo flujo de siempre, RegistrarPago.jsx). */}
        <div className="bg-surface rounded-inner p-4 flex flex-col gap-2">
          <span className="text-label text-ink-2">Pagos</span>
          {wide ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-label text-ink-2 mb-1">Total</span>
                <span className="text-body text-ink font-medium"><MontoReserva reserva={reserva} /></span>
              </div>
              <div>
                <span className="block text-label text-ink-2 mb-1">Saldo</span>
                <span className={`block text-body font-semibold ${saldo === null ? 'text-ink-2' : saldo > 0 ? 'text-danger' : 'text-success-ink'}`}>
                  {saldo === null ? 'Sin verificar' : saldo > 0 ? formatPesosVisible(saldo) : 'Saldado'}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-body text-ink-2">Total</span>
                <span className="text-body text-ink font-medium"><MontoReserva reserva={reserva} /></span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-body text-ink-2">Saldo</span>
                <span className={`text-body font-semibold ${saldo === null ? 'text-ink-2' : saldo > 0 ? 'text-danger' : 'text-success-ink'}`}>
                  {saldo === null ? 'Sin verificar' : saldo > 0 ? formatPesosVisible(saldo) : 'Saldado'}
                </span>
              </div>
            </>
          )}
          {cuotas.length > 0 && (
            <div className={wide ? 'pt-2 border-t border-line grid grid-cols-2 gap-2' : 'pt-2 border-t border-line space-y-2'}>
              {cuotas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-deeplink-id={`pago-${p.id}`}
                  onClick={() => onCellClick?.(reserva, p)}
                  className={
                    wide
                      ? 'flex flex-col items-start gap-1 text-left bg-card hover:bg-line/50 rounded-icon px-2 py-2 transition-colors min-w-0'
                      : 'w-full flex items-center justify-between gap-2 text-left hover:bg-line/50 rounded-icon -mx-1 px-1 py-1 transition-colors'
                  }
                >
                  {/* Jerarquía (testing oct 2026, item 7): comprobante como
                      dato principal, monto como secundario — igual criterio
                      que ReservaPagosCard.jsx (ficha de cliente). Sin truncar
                      (Bloque B, ítem 11, 26/10/2026): "Sin comprobante"
                      entero, no "Sin comprob…" — rompe a otra línea en vez
                      de cortar con elipsis. */}
                  <span className={`min-w-0 break-words font-semibold ${p.estado === 'anulado' ? 'text-ink-2 line-through' : 'text-ink'}`}>
                    {p.comprobantes?.length > 0
                      ? p.comprobantes.map((c) => formatComprobante(c.tipo, c.numero)).join(', ')
                      : 'Sin comprobante'}
                    {/* Ítem 3 (25/10/2026): quién pagó esta cuota — nombre
                        chico debajo, relevante con cosocios. */}
                    {p.clientes?.nombre && (
                      <span className="block text-label font-normal text-ink-2 truncate">{formatNombre(p.clientes.nombre)}</span>
                    )}
                  </span>
                  <span className={`shrink-0 text-label ${p.estado === 'anulado' ? 'text-ink-2 line-through' : 'text-ink-2'}`}>
                    {pagoSinVerificar(p) ? 'Sin verificar' : formatPesosVisible(p.monto)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Acciones — mismos handlers que ya usaba la fila/tarjeta de la
            lista, nada nuevo. En el panel ancho (Bloque B, 26/10/2026) las
            secundarias van en una grilla de dos columnas con igual alto;
            "Registrar pago" sigue ocupando el ancho completo arriba. */}
        <div className="flex flex-col gap-2">
          {estadoBadgeStatus(reserva) === 'preconfirmada' && (
            <button
              onClick={() => navigate(linkToRecepcion(reserva.codigo))}
              className="w-full h-11 bg-surface hover:bg-surface text-ink-2 rounded-inner text-body font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <QrCode size={16} /> Hacer check-in
            </button>
          )}
          {!reserva.bonificada && (
            <button
              onClick={() => onRegistrarPago?.(reserva)}
              disabled={Number(reserva.saldo) <= 0}
              className="w-full h-12 bg-card border border-line hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed rounded-full text-body font-semibold flex items-center justify-center gap-2 transition-colors text-ink"
            >
              <Wallet size={16} /> Registrar pago
            </button>
          )}
          <div className={wide ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
            <button
              onClick={() => navigate(linkToComprobante(reserva.id))}
              className="w-full h-11 bg-surface hover:bg-line text-ink rounded-inner text-body font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Receipt size={16} /> Ver comprobante
            </button>
            <button
              onClick={() => onEditar?.(reserva)}
              className="w-full h-11 bg-surface hover:bg-line text-ink rounded-inner text-body font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Edit2 size={16} /> Editar reserva
            </button>
            <button
              onClick={() => setMostrarCosocios(true)}
              className="w-full h-11 bg-surface hover:bg-line text-ink rounded-inner text-body font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Users size={16} /> Cosocios{socios.length > 0 ? ` (${socios.length})` : ''}
            </button>
            {puedeAjustarEstadoPago && !reserva.bonificada && (
              <button
                onClick={() => setMostrarCambiarEstado(true)}
                className="w-full h-11 bg-surface hover:bg-line text-ink rounded-inner text-body font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldAlert size={16} /> Cambiar estado de pago
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCancelar?.(reserva)}
              className="flex-1 h-11 bg-gold-100 hover:bg-gold-100 text-ink rounded-full text-label font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <XCircle size={14} /> Cancelar
            </button>
            <button
              onClick={() => onEliminar?.(reserva)}
              className="flex-1 h-11 bg-danger-soft hover:bg-danger-soft text-danger rounded-full text-label font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>
      </div>

      {puedeAjustarEstadoPago && (
        <CambiarEstadoPagoModal isOpen={mostrarCambiarEstado} onClose={() => setMostrarCambiarEstado(false)} reserva={reserva} />
      )}
      <GestionCosociosModal isOpen={mostrarCosocios} onClose={() => setMostrarCosocios(false)} reserva={reserva} pagos={pagos} />
    </>
  )
}
