import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { X, Umbrella, Home, MessageSquare } from "lucide-react"

// Carga rápida de reserva desde el plano (CRM interno, no pasa por Edge Function).
// Al confirmar devuelve un payload plano; Dashboard.jsx hace el INSERT en reservas
// y el trigger de Postgres deriva el estado de la unidad.
const TIPOS = [
  { key: "temporada", label: "Temporada" },
  { key: "periodo", label: "Período" },
  { key: "dia", label: "Día" },
]

export default function UnitModal({ unit, clientes = [], onClose, onSave }) {
  const tieneReserva = Boolean(unit?.reservaId)

  const [clienteNombre, setClienteNombre] = useState(unit?.clientName || "")
  const [clienteTelefono, setClienteTelefono] = useState(unit?.clientPhone || "")
  const [clienteEmail, setClienteEmail] = useState(unit?.clientEmail || "")
  const [tipoAlquiler, setTipoAlquiler] = useState(unit?.tipoAlquiler || "temporada")
  const [fechaInicio, setFechaInicio] = useState(unit?.startDate || "")
  const [fechaFin, setFechaFin] = useState(unit?.endDate || "")
  const [fecha, setFecha] = useState(unit?.startDate || "")
  const [pagado, setPagado] = useState(unit?.isPaid ?? false)
  const [notas, setNotas] = useState(unit?.notes || "")

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

  const clienteExistente = useMemo(
    () =>
      clientes.find(
        (c) => c.nombre?.trim().toLowerCase() === clienteNombre.trim().toLowerCase(),
      ) || null,
    [clientes, clienteNombre],
  )
  const esClienteNuevo = clienteNombre.trim().length > 0 && !clienteExistente

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!clienteNombre.trim()) return

    onSave({
      action: "reservar",
      reservaId: unit?.reservaId || null,
      dbId: unit?.dbId,
      cliente: clienteExistente
        ? { id: clienteExistente.id }
        : { nombre: clienteNombre, telefono: clienteTelefono, mail: clienteEmail },
      tipo_alquiler: tipoAlquiler,
      fecha_inicio: tipoAlquiler === "periodo" ? fechaInicio || null : null,
      fecha_fin: tipoAlquiler === "periodo" ? fechaFin || null : null,
      fecha: tipoAlquiler === "dia" ? fecha || null : null,
      estado_pago: pagado ? "pagado" : "pendiente",
      notas: notas || null,
    })
  }

  const handleLiberar = () => {
    onSave({ action: "liberar", reservaId: unit?.reservaId || null, dbId: unit?.dbId })
  }

  const handleWhatsAppShare = () => {
    const detalleFechas =
      tipoAlquiler === "temporada"
        ? "Temporada completa"
        : tipoAlquiler === "dia"
          ? `Día ${fecha}`
          : `Del ${fechaInicio} al ${fechaFin}`
    const text =
      `Hola ${clienteNombre || "Cliente"}, te confirmamos tu reserva en Prius Playa Grande:\n\n` +
      `📍 Unidad: ${unit?.type === "sombrilla" ? "Sombrilla" : "Carpa"} #${unit?.number}\n` +
      `📅 ${detalleFechas}\n` +
      `💳 Estado de Pago: ${pagado ? "PAGADO" : "PENDIENTE"}\n\n` +
      `¡Te esperamos para disfrutar de la mejor experiencia de costa! 🌊☀️`
    window.open(
      `https://wa.me/${clienteTelefono.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
      "_blank",
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999] p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-[0.2em] text-[#FDE047]">
            {unit?.type === "sombrilla" ? <Umbrella size={18} /> : <Home size={18} />}
            {unit?.type === "sombrilla" ? "Sombrilla" : "Carpa"} #{unit?.number}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Cliente */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cliente</label>
            <input
              type="text"
              list="clientes-existentes"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white placeholder-white/20 uppercase font-bold"
              placeholder="BUSCAR O CARGAR NUEVO"
            />
            <datalist id="clientes-existentes">
              {clientes.map((c) => (
                <option key={c.id} value={c.nombre} />
              ))}
            </datalist>
            <p className="text-[9px] uppercase tracking-widest font-bold text-gray-600">
              {clienteExistente
                ? "Cliente existente"
                : esClienteNuevo
                  ? "Cliente nuevo — se crea al guardar"
                  : " "}
            </p>
          </div>

          {esClienteNuevo && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Teléfono</label>
                <input
                  type="tel"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white placeholder-white/20"
                  placeholder="+54 9..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Email</label>
                <input
                  type="email"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white placeholder-white/20"
                  placeholder="ejemplo@mail.com"
                />
              </div>
            </div>
          )}

          {/* Tipo de alquiler */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Tipo de alquiler</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipoAlquiler(t.key)}
                  className={`py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all ${
                    tipoAlquiler === t.key
                      ? "bg-[#FDE047] text-black border-[#FDE047]"
                      : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas según tipo */}
          {tipoAlquiler === "periodo" && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Desde</label>
                <input
                  type="date"
                  required
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white invert-[0.8] brightness-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Hasta</label>
                <input
                  type="date"
                  required
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white invert-[0.8] brightness-200"
                />
              </div>
            </div>
          )}

          {tipoAlquiler === "dia" && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Fecha</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white invert-[0.8] brightness-200"
              />
            </div>
          )}

          {tipoAlquiler === "temporada" && (
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Temporada completa — sin fechas
            </p>
          )}

          {/* Pago */}
          <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all group">
            <input
              type="checkbox"
              checked={pagado}
              onChange={(e) => setPagado(e.target.checked)}
              className="w-4 h-4 accent-green-400 cursor-pointer"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors">
              Pago recibido
            </span>
          </label>

          {/* Notas */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Notas / Observaciones</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none resize-none text-sm text-white placeholder-white/20"
              placeholder="Detalles adicionales..."
            />
          </div>

          {clienteNombre && clienteTelefono && (
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full py-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl font-bold text-[10px] uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare size={16} />
              Enviar Confirmación WhatsApp
            </button>
          )}

          <div className="flex gap-3 pt-4">
            {tieneReserva && (
              <button
                type="button"
                onClick={handleLiberar}
                className="flex-1 py-4 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all text-gray-400"
              >
                Liberar Unidad
              </button>
            )}
            <button
              type="submit"
              disabled={!clienteNombre.trim()}
              className="flex-1 py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-[#FDE047] text-black rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl"
            >
              {tieneReserva ? "Guardar Cambios" : "Crear Reserva"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
