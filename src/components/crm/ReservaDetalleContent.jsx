import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Wallet, Receipt, Edit2, XCircle, Trash2, QrCode, Globe, MonitorSmartphone, Users, ShieldAlert } from 'lucide-react'
import { usePagos } from '../../hooks/usePagos'
import { coSocios, estadoBadgeStatus, saldoNumerico, pagoSinVerificar } from '../../lib/reservas'
import { formatFecha, formatRangoFechas, formatPesosVisible, formatComprobante, unidadEmoji, formatUnidad, formatNombre} from '../../lib/format'
import { linkToComprobante, linkToRecepcion } from '../../lib/deepLinks'
import { usePermiso } from '../../context/AuthProvider'
import StatusBadge from './StatusBadge'
import MontoReserva from './MontoReserva'
import CambiarEstadoPagoModal from './CambiarEstadoPagoModal'
import GestionCosociosModal from './GestionCosociosModal'

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
      <div className="flex items-start justify-between pb-space-md shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-headline-sm text-black truncate">{formatNombre(reserva.clientes?.nombre) || 'S/N'}</span>
            <StatusBadge status={estadoBadgeStatus(reserva)} />
          </div>
          <p className="text-body-sm text-prius-slate mt-1">
            {unidadEmoji(reserva.unidades?.tipo)} {formatUnidad(reserva.unidades?.tipo, reserva.unidades?.numero)} · {TIPO_LABEL[reserva.tipo_alquiler] || reserva.tipo_alquiler}
          </p>
        </div>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-prius-surface text-prius-slate hover:text-black flex items-center justify-center transition-colors shrink-0"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-space-md">
        {/* Ítem 2 (25/10/2026): aviso cuando el estado de pago fue ajustado
            a mano — visible para todos, no solo superadmin (transparencia
            de por qué el badge no coincide con lo que calcularía el saldo). */}
        {reserva.estado_pago_manual && (
          <div className="flex items-start gap-2 p-3 bg-gold/5 border border-gold/20 rounded-xl">
            <ShieldAlert size={14} className="text-gold shrink-0 mt-0.5" />
            <p className="text-xs text-prius-slate">
              Estado ajustado manualmente{reserva.estado_pago_manual_motivo ? ` — ${reserva.estado_pago_manual_motivo}` : ''}.
            </p>
          </div>
        )}

        {/* Cliente */}
        <div className="bg-prius-surface rounded-xl p-space-md flex flex-col gap-space-sm">
          <span className="text-label-md text-prius-slate uppercase tracking-wider">Cliente</span>
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center text-title-md font-semibold shrink-0">
              {(reserva.clientes?.nombre || 'S/N').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-title-md text-black truncate">{formatNombre(reserva.clientes?.nombre) || 'S/N'}</p>
              {socios.length > 0 && (
                <p className="text-body-sm text-prius-slate truncate flex items-center gap-1">
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
          <div className="grid grid-cols-2 gap-x-space-md gap-y-3">
            <div>
              <span className="block text-label-md text-prius-muted uppercase tracking-wider mb-0.5">Llegada</span>
              <span className="text-body-md text-black font-medium">{formatFecha(fechaLlegada(reserva))}</span>
            </div>
            <div>
              <span className="block text-label-md text-prius-muted uppercase tracking-wider mb-0.5">Fechas</span>
              <span className="text-body-md text-black font-medium">{fechasLabel}</span>
            </div>
            <div>
              <span className="block text-label-md text-prius-muted uppercase tracking-wider mb-0.5">Origen</span>
              <span className="text-body-md text-black font-medium flex items-center gap-1.5">
                {reserva.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                {reserva.origen === 'web' ? 'Web' : 'Manual'}
              </span>
            </div>
            {reserva.notas && (
              <div className="col-span-2">
                <span className="block text-label-md text-prius-muted uppercase tracking-wider mb-0.5">Notas</span>
                <span className="text-body-md text-black">{reserva.notas}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-body-sm text-prius-slate">Llegada</span>
              <span className="text-body-md text-black font-medium">{formatFecha(fechaLlegada(reserva))}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-body-sm text-prius-slate">Fechas</span>
              <span className="text-body-md text-black font-medium text-right">{fechasLabel}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-body-sm text-prius-slate">Origen</span>
              <span className="text-body-md text-black font-medium flex items-center gap-1.5">
                {reserva.origen === 'web' ? <Globe size={13} /> : <MonitorSmartphone size={13} />}
                {reserva.origen === 'web' ? 'Web' : 'Manual'}
              </span>
            </div>
            {reserva.notas && (
              <div className="py-1.5">
                <span className="block text-body-sm text-prius-slate">Notas</span>
                <span className="text-body-md text-black">{reserva.notas}</span>
              </div>
            )}
          </div>
        )}

        {/* Pagos: total/pagado/saldo + lista, estilo mock — lectura, el alta
            de un pago nuevo sigue siendo la acción "Registrar pago" de
            abajo (mismo flujo de siempre, RegistrarPago.jsx). */}
        <div className="bg-prius-surface rounded-xl p-space-md flex flex-col gap-space-sm">
          <span className="text-label-md text-prius-slate uppercase tracking-wider">Pagos</span>
          {wide ? (
            <div className="grid grid-cols-2 gap-space-md">
              <div>
                <span className="block text-label-md text-prius-muted uppercase tracking-wider mb-0.5">Total</span>
                <span className="text-body-md text-black font-medium"><MontoReserva reserva={reserva} /></span>
              </div>
              <div>
                <span className="block text-label-md text-prius-muted uppercase tracking-wider mb-0.5">Saldo</span>
                <span className={`block text-headline-sm font-bold ${saldo === null ? 'text-prius-slate' : saldo > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                  {saldo === null ? 'Sin verificar' : saldo > 0 ? formatPesosVisible(saldo) : 'Saldado'}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-body-md text-prius-slate">Total</span>
                <span className="text-body-md text-black font-medium"><MontoReserva reserva={reserva} /></span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-body-md text-prius-slate">Saldo</span>
                <span className={`text-headline-sm font-bold ${saldo === null ? 'text-prius-slate' : saldo > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                  {saldo === null ? 'Sin verificar' : saldo > 0 ? formatPesosVisible(saldo) : 'Saldado'}
                </span>
              </div>
            </>
          )}
          {cuotas.length > 0 && (
            <div className={wide ? 'pt-2 border-t border-hairline grid grid-cols-2 gap-2' : 'pt-2 border-t border-hairline space-y-1.5'}>
              {cuotas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-deeplink-id={`pago-${p.id}`}
                  onClick={() => onCellClick?.(reserva, p)}
                  className={
                    wide
                      ? 'flex flex-col items-start gap-0.5 text-left bg-white hover:bg-hairline/50 rounded-lg px-space-sm py-2 transition-colors min-w-0'
                      : 'w-full flex items-center justify-between gap-2 text-left hover:bg-hairline/50 rounded-lg -mx-1 px-1 py-0.5 transition-colors'
                  }
                >
                  {/* Jerarquía (testing oct 2026, item 7): comprobante como
                      dato principal, monto como secundario — igual criterio
                      que ReservaPagosCard.jsx (ficha de cliente). Sin truncar
                      (Bloque B, ítem 11, 26/10/2026): "Sin comprobante"
                      entero, no "Sin comprob…" — rompe a otra línea en vez
                      de cortar con elipsis. */}
                  <span className={`min-w-0 break-words font-semibold ${p.estado === 'anulado' ? 'text-prius-muted line-through' : 'text-black'}`}>
                    {p.comprobantes?.length > 0
                      ? p.comprobantes.map((c) => formatComprobante(c.tipo, c.numero)).join(', ')
                      : 'Sin comprobante'}
                    {/* Ítem 3 (25/10/2026): quién pagó esta cuota — nombre
                        chico debajo, relevante con cosocios. */}
                    {p.clientes?.nombre && (
                      <span className="block text-[10px] font-normal text-prius-muted truncate">{formatNombre(p.clientes.nombre)}</span>
                    )}
                  </span>
                  <span className={`shrink-0 text-body-sm ${p.estado === 'anulado' ? 'text-prius-muted line-through' : 'text-prius-slate'}`}>
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
              className="w-full h-11 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-title-md font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <QrCode size={16} /> Hacer check-in
            </button>
          )}
          {!reserva.bonificada && (
            <button
              onClick={() => onRegistrarPago?.(reserva)}
              disabled={Number(reserva.saldo) <= 0}
              className="w-full h-12 bg-gold hover:bg-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl text-title-md font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Wallet size={16} /> Registrar pago
            </button>
          )}
          <div className={wide ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
            <button
              onClick={() => navigate(linkToComprobante(reserva.id))}
              className="w-full h-11 bg-prius-surface hover:bg-hairline text-black rounded-xl text-title-md font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Receipt size={16} /> Ver comprobante
            </button>
            <button
              onClick={() => onEditar?.(reserva)}
              className="w-full h-11 bg-prius-surface hover:bg-hairline text-black rounded-xl text-title-md font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Edit2 size={16} /> Editar reserva
            </button>
            <button
              onClick={() => setMostrarCosocios(true)}
              className="w-full h-11 bg-prius-surface hover:bg-hairline text-black rounded-xl text-title-md font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Users size={16} /> Cosocios{socios.length > 0 ? ` (${socios.length})` : ''}
            </button>
            {puedeAjustarEstadoPago && !reserva.bonificada && (
              <button
                onClick={() => setMostrarCambiarEstado(true)}
                className="w-full h-11 bg-prius-surface hover:bg-hairline text-black rounded-xl text-title-md font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldAlert size={16} /> Cambiar estado de pago
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCancelar?.(reserva)}
              className="flex-1 h-11 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-label-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <XCircle size={14} /> Cancelar
            </button>
            <button
              onClick={() => onEliminar?.(reserva)}
              className="flex-1 h-11 bg-red-50 hover:bg-red-100 text-prius-error rounded-xl text-label-lg font-medium flex items-center justify-center gap-2 transition-colors"
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
