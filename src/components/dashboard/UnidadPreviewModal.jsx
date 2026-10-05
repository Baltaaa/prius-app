import { useEffect } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { X, Umbrella, Home, Users, ArrowRight, MapPin } from "lucide-react"
import { usePagos } from "../../hooks/usePagos"
import { coSocios, saldoNumerico, montoInfo, estadoBadgeStatus } from "../../lib/reservas"
import { formatPesos, formatPesosVisible, formatFecha, unidadEmoji } from "../../lib/format"
import { sectorDeUnidad, estadoUnidadInfo } from "../../lib/plano"
import StatusBadge from "../crm/StatusBadge"
import Historial from "../crm/Historial"

const TIPO_LABEL = { temporada: "Temporada", periodo: "Período", dia: "Día" }

// Preview de una unidad del Plano — reemplaza por completo al viejo UnitModal
// (alta/edición). La mayoría de la edición/alta sigue enrutando a
// Clientes/Reservas (ver CLAUDE.md "Modal de unidad en el Plano"); las dos
// excepciones agregadas en oct 2026 son "Asignar cliente de temporada" y
// "Mover a otra unidad", que abren AsignarUnidadModal/MoverUnidadDialog desde
// Dashboard.jsx sin salir del Plano (`onAsignarTemporada`/`onMoverUnidad`).
// Se alimenta de `reservas`/`unit`, ya vivos vía la misma suscripción
// Realtime que usa el Plano — no hace fetch propio, así que se actualiza
// solo si la reserva cambia con el modal abierto.
export default function UnidadPreviewModal({ unit, reservas, temporadaActiva, onClose, onAsignarTemporada, onMoverUnidad }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.()
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const navigate = useNavigate()
  const reserva = unit?.reserva || null
  const { pagos } = usePagos(reserva?.id)

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

  const irAClientes = () => navigate(`/app/clientes?id=${reserva.cliente_id}`)
  const irAReserva = () => navigate(`/app/reservas?id=${reserva.id}`)
  const nuevaReservaAcotada = () => navigate(`/app/reservas?unidad=${unit.dbId}&tipo=periodo`)
  // Historial completo: Reservas.jsx solo lista período/día (la cola
  // operativa) — las de tipo_alquiler='temporada' de esta unidad no van a
  // aparecer ahí, viven en Clientes (ver CLAUDE.md "Reservas vs Clientes").
  const verHistorialCompleto = () => navigate(`/app/reservas?filtroUnidad=${unit.dbId}`)

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-card w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gesto de cierre (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/5 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-[0.2em] text-[#FDE047] truncate">
              {unit.type === "sombrilla" ? <Umbrella size={18} /> : <Home size={18} />}
              {unidadEmoji(unit.type)} {unit.type === "sombrilla" ? "Sombrilla" : "Carpa"} #{unit.number}
            </h2>
            {sector && (
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                <MapPin size={11} /> {sector}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${
                estado.key === "libre"
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : estado.key === "ocupada"
                    ? "bg-[#FDE047]/10 text-[#FDE047] border-[#FDE047]/20"
                    : estado.key === "sin_confirmar"
                      ? "bg-slate-500/10 text-slate-300 border-slate-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {estado.label}
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Bloque Unidad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tipo</p>
              <p className="text-sm text-white mt-1 uppercase">{unidadEmoji(unit.type)} {unit.type}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Número</p>
              <p className="text-sm text-white mt-1">#{unit.number}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temporada</p>
              <p className="text-sm text-white mt-1">{temporadaActiva?.nombre || "—"}</p>
            </div>
          </div>

          {/* Reserva actual, o mensaje de disponibilidad */}
          {!reserva ? (
            <div className="space-y-4">
              <div className="px-4 py-4 bg-green-500/5 border border-green-500/20 rounded-xl text-center">
                <p className="text-sm font-bold text-green-400 uppercase tracking-widest">Unidad disponible</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => onAsignarTemporada?.(unit)}
                  className="w-full py-3.5 bg-[#FDE047] hover:bg-yellow-300 text-black rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  Asignar cliente de temporada <ArrowRight size={14} />
                </button>
                <button
                  onClick={nuevaReservaAcotada}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  Nueva reserva por período o día <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="px-4 py-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white uppercase truncate">{reserva.clientes?.nombre || "S/N"}</p>
                  <StatusBadge status={estadoBadgeStatus(reserva)} />
                </div>
                {socios.length > 0 && (
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Users size={12} className="shrink-0" /> Co-socios: {socios.map((s) => s.nombre).join(", ")}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Tipo de alquiler</p>
                    <p className="text-white mt-0.5">{TIPO_LABEL[reserva.tipo_alquiler] || reserva.tipo_alquiler}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Fechas</p>
                    <p className="text-white mt-0.5">{fechasReserva}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Costo total</p>
                    <p className="text-white mt-0.5">
                      {esPendienteConfirmacion ? "Sin confirmar" : bonificada ? "Sin cargo" : precioSinVerificar ? "Sin verificar" : Number(valorTotal) > 0 ? formatPesos(valorTotal) : "Sin precio"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Saldo</p>
                    {/* Saldo en $0 (pagada/saldada/bonificada): no se muestra
                        nada acá, nunca "$0" ni un texto de reemplazo — ver
                        CLAUDE.md "Nunca $0". */}
                    <p className={`mt-0.5 font-bold ${saldo === null ? "text-gray-400" : "text-red-400"}`}>
                      {esPendienteConfirmacion ? "—" : saldo === null ? "Sin verificar" : formatPesosVisible(saldo)}
                    </p>
                  </div>
                </div>
                {reserva.notas && (
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Notas</p>
                    <p className="text-xs text-gray-300 mt-1">{reserva.notas}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {reserva.tipo_alquiler === "temporada" ? (
                  <>
                    <button
                      onClick={irAClientes}
                      className="w-full py-3.5 bg-[#FDE047] hover:bg-yellow-300 text-black rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                    >
                      {reserva.estado_pago === "pendiente" ? "Registrar pago" : "Ver ficha del cliente"} <ArrowRight size={14} />
                    </button>
                    {!reserva.bloqueada && (
                      <button
                        onClick={() => onMoverUnidad?.(reserva, unit)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all"
                      >
                        Mover a otra unidad
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={irAReserva}
                      className="w-full py-3.5 bg-[#FDE047] hover:bg-yellow-300 text-black rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                    >
                      {reserva.estado_pago === "pendiente" ? "Registrar pago" : "Ver reserva"} <ArrowRight size={14} />
                    </button>
                    <button
                      onClick={irAClientes}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all"
                    >
                      Ver cliente
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Historial de la unidad — mismo componente que la ficha de
              cliente y el detalle de reserva (ítem 2, oct 2026). */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Historial</p>
              <button
                onClick={verHistorialCompleto}
                className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all"
              >
                Ver todas las reservas
              </button>
            </div>
            <Historial tipo="unidad" id={unit.dbId} compact />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
