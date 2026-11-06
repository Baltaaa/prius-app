import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Users, ArrowRight, ShieldAlert } from "lucide-react"
import { usePagos } from "../../hooks/usePagos"
import { useReservas } from "../../hooks/useReservas"
import { useDialog } from "../../context/DialogProvider"
import { usePermiso } from "../../context/AuthProvider"
import { coSocios, saldoNumerico, montoInfo, estadoBadgeStatus } from "../../lib/reservas"
import { formatMonto, formatMontoVisible, formatFecha, formatNombre } from '../../lib/format'
import { unidadConEmoji } from '../../lib/unidadIcono'
import { sectorDeUnidad, estadoUnidadInfo } from "../../lib/plano"
import StatusBadge from "../crm/StatusBadge"
import Historial from "../crm/Historial"
import CambiarEstadoPagoModal from "../crm/CambiarEstadoPagoModal"
import GestionCosociosModal from "../crm/GestionCosociosModal"
import { useNuevaReserva } from "../../context/NuevaReservaProvider"
import { linkToCliente, linkToReserva, linkToRecepcion } from "../../lib/deepLinks"
import ScrollFade from '../ui/ScrollFade'

const TIPO_LABEL = { temporada: "Temporada", periodo: "Período", dia: "Día" }

// Contenido real del detalle de unidad del Plano — extraído de
// UnidadPreviewModal.jsx (oct 2026, rediseño mock Stitch 02-plano-*) para
// que el panel lateral fijo de desktop (UnidadDetallePanel.jsx) y la hoja
// inferior de tablet/mobile (UnidadPreviewModal.jsx) rendericen EXACTAMENTE
// el mismo contenido, mismos datos, mismos handlers — una sola fuente,
// nunca una copia. Todas las acciones reales de siempre (incluidas las que
// el mock no muestra: Mover a otra unidad, Liberar unidad, Ir a Recepción,
// historial) se conservan tal cual. El mock trae "Cobrar saldo"/"Check-in
// guardia" y campos DNI/Cta/ocupantes/cochera — ninguno existe hoy en esta
// pantalla (el cobro+check-in real vive en Recepción), así que no se
// inventan: se listan como pendiente en el reporte de la tarea.
export default function UnidadDetalleContent({ unit, reservas, temporadaActiva, onClose, onAsignarTemporada, onMoverUnidad, showCloseButton = true, headerClassName = "", bodyClassName = "" }) {
  const navigate = useNavigate()
  const reserva = unit?.reserva || null
  const { pagos } = usePagos(reserva?.id)
  const { updateReserva, cancelarReserva } = useReservas()
  const { alert, confirm } = useDialog()
  const puedeAjustarEstadoPago = usePermiso('ajustar_estado_pago')
  const { abrirNuevaReserva } = useNuevaReserva()
  const [mostrarCambiarEstado, setMostrarCambiarEstado] = useState(false)
  const [mostrarCosocios, setMostrarCosocios] = useState(false)

  if (!unit) return null

  const sector = sectorDeUnidad(unit.type, unit.number)
  const estado = estadoUnidadInfo(reserva)
  const socios = reserva ? coSocios(reserva) : []
  const saldo = reserva ? saldoNumerico(reserva, pagos) : null
  const { pendiente: precioSinVerificar, bonificada, valorTotal } = reserva ? montoInfo(reserva) : {}
  const esPendienteConfirmacion = reserva?.estado_pago === "pendiente_confirmacion"

  const fechasReserva = !reserva
    ? null
    : reserva.tipo_alquiler === "temporada"
      ? "Temporada completa"
      : reserva.tipo_alquiler === "dia"
        ? formatFecha(reserva.fecha)
        : `${formatFecha(reserva.fecha_inicio)} — ${formatFecha(reserva.fecha_fin)}`

  const irAClientes = () => navigate(linkToCliente(reserva.cliente_id, { reservaId: reserva.id }))
  const irAReserva = () => navigate(linkToReserva(reserva.id))
  const nuevaReservaAcotada = () => abrirNuevaReserva({ unidadId: unit.dbId, tipoAlquiler: 'periodo' })
  const verHistorialCompleto = () => navigate(`/app/reservas?filtroUnidad=${unit.dbId}`)

  const handleLiberarUnidad = async () => {
    if (!reserva) return
    if (reserva.bloqueada) {
      const okDesbloquear = await confirm(
        'Esta reserva está bloqueada. Hay que desbloquearla primero para poder continuar. ¿Desbloquear?',
        { title: 'Desbloquear reserva' },
      )
      if (!okDesbloquear) return
      try {
        await updateReserva(reserva.id, { bloqueada: false })
      } catch (err) {
        await alert('No se pudo desbloquear la reserva.')
        return
      }
    }
    const ok = await confirm(
      `Se va a liberar ${unidadConEmoji(unit.type, unit.number)} y desvincular a este cliente de la reserva. La reserva pasa a "cancelada" (no se borra, queda en el historial) y la unidad queda disponible para asignar a otro cliente. ¿Confirmar?`,
      { title: 'Liberar unidad' },
    )
    if (!ok) return
    try {
      await cancelarReserva(reserva.id)
      onClose?.()
    } catch (err) {
      await alert('No se pudo liberar la unidad.')
    }
  }

  return (
    <>
      {/* Header */}
      <div className={`flex items-start justify-between pb-4 shrink-0 ${headerClassName}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-body text-ink">
              {unidadConEmoji(unit.type, unit.number)}
            </span>
            {sector && <span className="text-label text-ink-2 font-medium">{sector}</span>}
          </div>
          <span
            className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-swatch text-label font-semibold w-fit ${
              estado.key === "libre"
                ? "bg-success-soft text-success-ink"
                : estado.key === "ocupada"
                  ? "bg-gold text-ink"
                  : estado.key === "sin_confirmar"
                    ? "bg-surface text-ink-2"
                    : "bg-danger-soft text-danger"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {estado.label}
          </span>
        </div>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="w-11 h-11 md:w-8 md:h-8 rounded-full bg-surface text-ink-2 hover:text-ink flex items-center justify-center transition-colors shrink-0"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <ScrollFade wrapperClassName="flex-1" className={`overflow-y-auto space-y-4 ${bodyClassName}`}>
        {!reserva ? (
          <div className="space-y-3">
            <div className="px-4 py-4 bg-success-soft rounded-inner text-center">
              <p className="text-label text-success-ink">Unidad disponible</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onAsignarTemporada?.(unit)}
                className="px-4 w-full h-12 bg-card border border-line hover:bg-surface rounded-full text-body font-semibold flex items-center justify-center gap-2 transition-colors text-ink"
              >
                Asignar cliente de temporada <ArrowRight size={14} />
              </button>
              <button
                onClick={nuevaReservaAcotada}
                className="w-full h-11 bg-surface hover:bg-line text-ink rounded-inner text-body font-medium flex items-center justify-center gap-2 transition-colors"
              >
                Nueva reserva por período o día <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Ítem 2 (25/10/2026): aviso de ajuste manual — mismo criterio
                que ReservaDetalleContent.jsx (ficha de Reservas). */}
            {reserva.estado_pago_manual && (
              <div className="flex items-start gap-2 p-3 bg-gold-100 border border-gold-300 rounded-inner">
                <ShieldAlert size={14} className="text-ink shrink-0 mt-1" />
                <p className="text-label text-ink-2">
                  Estado ajustado manualmente{reserva.estado_pago_manual_motivo ? ` — ${reserva.estado_pago_manual_motivo}` : ""}.
                </p>
              </div>
            )}

            {/* Titular + cosocios (reserva_clientes) — cada uno navega a su
                propia ficha (mismo linkToCliente de "Ver ficha del cliente");
                el titular se distingue visualmente (avatar negro + badge) de
                los cosocios (avatar gris, sin badge). */}
            <div className="bg-surface rounded-inner p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label text-ink-2">Titular</span>
                <StatusBadge status={estadoBadgeStatus(reserva)} />
              </div>
              <button
                onClick={irAClientes}
                className="flex items-center gap-2 text-left hover:bg-line/60 rounded-icon -m-1 p-1 transition-colors"
              >
                <div className="w-10 h-10 rounded-inner bg-ink text-on-ink flex items-center justify-center text-body font-semibold shrink-0">
                  {(reserva.clientes?.nombre || "S/N").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body text-ink truncate">{reserva.clientes?.nombre || "S/N"}</p>
                </div>
              </button>
              {socios.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-line">
                  <span className="text-label text-ink-2 flex items-center gap-1 pt-1">
                    <Users size={12} /> Cosocios
                  </span>
                  {socios.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(linkToCliente(s.id))}
                      className="flex items-center gap-2 text-left hover:bg-line/60 rounded-icon -mx-1 p-1 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-icon bg-ink-2/30 text-ink-2 flex items-center justify-center text-body font-semibold shrink-0">
                        {(s.nombre || "S/N").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                      </div>
                      <p className="min-w-0 flex-1 text-body text-ink truncate">{formatNombre(s.nombre) || "S/N"}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {reserva.origen === "web" && reserva.codigo && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface rounded-icon">
                <p className="text-label text-ink-2 truncate">
                  Reserva web · {reserva.codigo} · {estadoBadgeStatus(reserva) === "preconfirmada" ? "Preconfirmada" : estadoBadgeStatus(reserva) === "vencida" ? "Vencida" : "Confirmada"}
                </p>
                <button
                  onClick={() => navigate(linkToRecepcion(reserva.codigo))}
                  className="shrink-0 text-label text-ink-2 hover:text-ink-2"
                >
                  Ir a Recepción
                </button>
              </div>
            )}

            {/* Período y datos */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between py-2">
                <span className="text-label text-ink-2">Período</span>
                <span className="text-body text-ink font-medium text-right">{fechasReserva}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-label text-ink-2">Tipo de alquiler</span>
                <span className="text-body text-ink font-medium">{TIPO_LABEL[reserva.tipo_alquiler] || reserva.tipo_alquiler}</span>
              </div>
              {reserva.notas && (
                <div className="py-2">
                  <span className="block text-label text-ink-2">Notas</span>
                  <span className="text-body text-ink">{reserva.notas}</span>
                </div>
              )}
            </div>

            {/* Estado financiero */}
            <div className="bg-surface rounded-inner p-4 flex flex-col gap-2">
              <span className="text-label text-ink-2">Estado financiero</span>
              <div className="flex items-baseline justify-between">
                <span className="text-body text-ink-2">Costo total</span>
                <span className="text-body text-ink font-medium">
                  {esPendienteConfirmacion ? "Sin confirmar" : bonificada ? "Sin cargo" : precioSinVerificar ? "Sin verificar" : Number(valorTotal) > 0 ? formatMonto(valorTotal) : "Sin precio"}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-body text-ink-2">Saldo</span>
                <span className={`text-body font-semibold ${saldo === null ? "text-ink-2" : "text-danger"}`}>
                  {esPendienteConfirmacion ? "—" : saldo === null ? "Sin verificar" : formatMontoVisible(saldo)}
                </span>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-2">
              {reserva.tipo_alquiler === "temporada" ? (
                <>
                  <button
                    onClick={irAClientes}
                    className="px-4 w-full h-12 bg-card border border-line hover:bg-surface rounded-full text-body font-semibold flex items-center justify-center gap-2 transition-colors text-ink"
                  >
                    {reserva.estado_pago === "pendiente" ? "Registrar pago" : "Ver ficha del cliente"} <ArrowRight size={14} />
                  </button>
                  {!reserva.bloqueada && (
                    <button
                      onClick={() => onMoverUnidad?.(reserva, unit)}
                      className="w-full h-11 bg-ink hover:bg-ink text-on-ink rounded-inner text-body font-medium transition-colors"
                    >
                      Mover a otra unidad
                    </button>
                  )}
                  <button
                    onClick={handleLiberarUnidad}
                    className="w-full h-11 bg-surface hover:bg-line text-ink rounded-inner text-body font-medium transition-colors"
                  >
                    Liberar unidad
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={irAReserva}
                    className="px-4 w-full h-12 bg-card border border-line hover:bg-surface rounded-full text-body font-semibold flex items-center justify-center gap-2 transition-colors text-ink"
                  >
                    {reserva.estado_pago === "pendiente" ? "Registrar pago" : "Ver reserva"} <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={irAClientes}
                    className="w-full h-11 bg-surface hover:bg-line text-ink rounded-inner text-body font-medium transition-colors"
                  >
                    Ver cliente
                  </button>
                </>
              )}
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
          </>
        )}

        {/* Historial */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-label text-ink-2">Historial</p>
            <button
              onClick={verHistorialCompleto}
              className="text-label text-ink hover:underline"
            >
              Ver todas las reservas
            </button>
          </div>
          <Historial tipo="unidad" id={unit.dbId} compact />
        </div>
      </ScrollFade>

      {puedeAjustarEstadoPago && reserva && (
        <CambiarEstadoPagoModal isOpen={mostrarCambiarEstado} onClose={() => setMostrarCambiarEstado(false)} reserva={reserva} />
      )}
      {reserva && (
        <GestionCosociosModal isOpen={mostrarCosocios} onClose={() => setMostrarCosocios(false)} reserva={reserva} pagos={pagos} />
      )}
    </>
  )
}
