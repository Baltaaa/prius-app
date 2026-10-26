import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Users, ArrowRight, ShieldAlert } from "lucide-react"
import { usePagos } from "../../hooks/usePagos"
import { useReservas } from "../../hooks/useReservas"
import { useDialog } from "../../context/DialogProvider"
import { usePermiso } from "../../context/AuthProvider"
import { coSocios, saldoNumerico, montoInfo, estadoBadgeStatus } from "../../lib/reservas"
import { formatPesos, formatPesosVisible, formatFecha, unidadEmoji } from "../../lib/format"
import { sectorDeUnidad, estadoUnidadInfo } from "../../lib/plano"
import StatusBadge from "../crm/StatusBadge"
import Historial from "../crm/Historial"
import CambiarEstadoPagoModal from "../crm/CambiarEstadoPagoModal"
import { linkToCliente, linkToReserva, linkToRecepcion } from "../../lib/deepLinks"

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
export default function UnidadDetalleContent({ unit, reservas, temporadaActiva, onClose, onAsignarTemporada, onMoverUnidad, showCloseButton = true }) {
  const navigate = useNavigate()
  const reserva = unit?.reserva || null
  const { pagos } = usePagos(reserva?.id)
  const { updateReserva, cancelarReserva } = useReservas()
  const { alert, confirm } = useDialog()
  const puedeAjustarEstadoPago = usePermiso('ajustar_estado_pago')
  const [mostrarCambiarEstado, setMostrarCambiarEstado] = useState(false)

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
  const nuevaReservaAcotada = () => navigate(`/app/reservas?unidad=${unit.dbId}&tipo=periodo`)
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
      `Se va a liberar ${unidadEmoji(unit.type)} ${unit.type} #${unit.number} y desvincular a este cliente de la reserva. La reserva pasa a "cancelada" (no se borra, queda en el historial) y la unidad queda disponible para asignar a otro cliente. ¿Confirmar?`,
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
      <div className="flex items-start justify-between pb-space-md shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-headline-sm text-black">
              {unidadEmoji(unit.type)} {unit.type === "sombrilla" ? "Sombrilla" : "Carpa"} {unit.number}
            </span>
            {sector && <span className="text-body-sm text-prius-slate font-medium">{sector}</span>}
          </div>
          <span
            className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-label-md uppercase font-bold tracking-wider w-fit ${
              estado.key === "libre"
                ? "bg-green-50 text-prius-success"
                : estado.key === "ocupada"
                  ? "bg-gold text-black"
                  : estado.key === "sin_confirmar"
                    ? "bg-prius-surface text-prius-slate"
                    : "bg-red-50 text-prius-error"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {estado.label}
          </span>
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
        {!reserva ? (
          <div className="space-y-3">
            <div className="px-4 py-4 bg-green-50 rounded-xl text-center">
              <p className="text-body-md font-bold text-prius-success uppercase tracking-widest">Unidad disponible</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onAsignarTemporada?.(unit)}
                className="w-full h-12 bg-gold hover:bg-gold-hover text-black rounded-xl text-title-md font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Asignar cliente de temporada <ArrowRight size={14} />
              </button>
              <button
                onClick={nuevaReservaAcotada}
                className="w-full h-11 bg-prius-surface hover:bg-hairline text-black rounded-xl text-title-md font-medium flex items-center justify-center gap-2 transition-colors"
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
              <div className="flex items-start gap-2 p-3 bg-gold/5 border border-gold/20 rounded-xl">
                <ShieldAlert size={14} className="text-gold shrink-0 mt-0.5" />
                <p className="text-body-sm text-prius-slate">
                  Estado ajustado manualmente{reserva.estado_pago_manual_motivo ? ` — ${reserva.estado_pago_manual_motivo}` : ""}.
                </p>
              </div>
            )}

            {/* Titular + cosocios (reserva_clientes) — cada uno navega a su
                propia ficha (mismo linkToCliente de "Ver ficha del cliente");
                el titular se distingue visualmente (avatar negro + badge) de
                los cosocios (avatar gris, sin badge). */}
            <div className="bg-prius-surface rounded-xl p-space-md flex flex-col gap-space-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label-md text-prius-slate uppercase tracking-wider">Titular</span>
                <StatusBadge status={estadoBadgeStatus(reserva)} />
              </div>
              <button
                onClick={irAClientes}
                className="flex items-center gap-space-sm text-left hover:bg-hairline/60 rounded-lg -m-1 p-1 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center text-title-md font-semibold shrink-0">
                  {(reserva.clientes?.nombre || "S/N").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-title-md text-black truncate">{reserva.clientes?.nombre || "S/N"}</p>
                </div>
              </button>
              {socios.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-hairline">
                  <span className="text-label-md text-prius-slate uppercase tracking-wider flex items-center gap-1 pt-1">
                    <Users size={12} /> Cosocios
                  </span>
                  {socios.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(linkToCliente(s.id))}
                      className="flex items-center gap-space-sm text-left hover:bg-hairline/60 rounded-lg -mx-1 p-1 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-prius-slate/30 text-prius-slate flex items-center justify-center text-body-md font-semibold shrink-0">
                        {(s.nombre || "S/N").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                      </div>
                      <p className="min-w-0 flex-1 text-body-md text-black truncate">{s.nombre || "S/N"}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {reserva.origen === "web" && reserva.codigo && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-sky-50 rounded-lg">
                <p className="text-body-sm text-sky-700 truncate">
                  Reserva web · {reserva.codigo} · {estadoBadgeStatus(reserva) === "preconfirmada" ? "Preconfirmada" : estadoBadgeStatus(reserva) === "vencida" ? "Vencida" : "Confirmada"}
                </p>
                <button
                  onClick={() => navigate(linkToRecepcion(reserva.codigo))}
                  className="shrink-0 text-label-md text-sky-700 hover:text-sky-900 font-bold uppercase"
                >
                  Ir a Recepción
                </button>
              </div>
            )}

            {/* Período y datos */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-body-sm text-prius-slate">Período</span>
                <span className="text-body-md text-black font-medium text-right">{fechasReserva}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-body-sm text-prius-slate">Tipo de alquiler</span>
                <span className="text-body-md text-black font-medium">{TIPO_LABEL[reserva.tipo_alquiler] || reserva.tipo_alquiler}</span>
              </div>
              {reserva.notas && (
                <div className="py-1.5">
                  <span className="block text-body-sm text-prius-slate">Notas</span>
                  <span className="text-body-md text-black">{reserva.notas}</span>
                </div>
              )}
            </div>

            {/* Estado financiero */}
            <div className="bg-prius-surface rounded-xl p-space-md flex flex-col gap-space-sm">
              <span className="text-label-md text-prius-slate uppercase tracking-wider">Estado financiero</span>
              <div className="flex items-baseline justify-between">
                <span className="text-body-md text-prius-slate">Costo total</span>
                <span className="text-body-md text-black font-medium">
                  {esPendienteConfirmacion ? "Sin confirmar" : bonificada ? "Sin cargo" : precioSinVerificar ? "Sin verificar" : Number(valorTotal) > 0 ? formatPesos(valorTotal) : "Sin precio"}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-body-md text-prius-slate">Saldo</span>
                <span className={`text-headline-sm font-bold ${saldo === null ? "text-prius-slate" : "text-prius-error"}`}>
                  {esPendienteConfirmacion ? "—" : saldo === null ? "Sin verificar" : formatPesosVisible(saldo)}
                </span>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-2">
              {reserva.tipo_alquiler === "temporada" ? (
                <>
                  <button
                    onClick={irAClientes}
                    className="w-full h-12 bg-gold hover:bg-gold-hover text-black rounded-xl text-title-md font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {reserva.estado_pago === "pendiente" ? "Registrar pago" : "Ver ficha del cliente"} <ArrowRight size={14} />
                  </button>
                  {!reserva.bloqueada && (
                    <button
                      onClick={() => onMoverUnidad?.(reserva, unit)}
                      className="w-full h-11 bg-black hover:bg-[#222222] text-white rounded-xl text-title-md font-medium transition-colors"
                    >
                      Mover a otra unidad
                    </button>
                  )}
                  <button
                    onClick={handleLiberarUnidad}
                    className="w-full h-11 bg-prius-surface hover:bg-hairline text-amber-700 rounded-xl text-title-md font-medium transition-colors"
                  >
                    Liberar unidad
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={irAReserva}
                    className="w-full h-12 bg-gold hover:bg-gold-hover text-black rounded-xl text-title-md font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {reserva.estado_pago === "pendiente" ? "Registrar pago" : "Ver reserva"} <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={irAClientes}
                    className="w-full h-11 bg-prius-surface hover:bg-hairline text-black rounded-xl text-title-md font-medium transition-colors"
                  >
                    Ver cliente
                  </button>
                </>
              )}
              {puedeAjustarEstadoPago && !reserva.bonificada && (
                <button
                  onClick={() => setMostrarCambiarEstado(true)}
                  className="w-full h-11 bg-prius-surface hover:bg-hairline text-black rounded-xl text-title-md font-medium flex items-center justify-center gap-2 transition-colors"
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
            <p className="text-label-md text-prius-slate uppercase tracking-wider">Historial</p>
            <button
              onClick={verHistorialCompleto}
              className="text-label-md text-black hover:underline font-bold uppercase"
            >
              Ver todas las reservas
            </button>
          </div>
          <Historial tipo="unidad" id={unit.dbId} compact />
        </div>
      </div>

      {puedeAjustarEstadoPago && reserva && (
        <CambiarEstadoPagoModal isOpen={mostrarCambiarEstado} onClose={() => setMostrarCambiarEstado(false)} reserva={reserva} />
      )}
    </>
  )
}
