import { useState } from "react"
import { X, Umbrella, Home, DollarSign, MessageSquare } from "lucide-react"
import { STATUS } from "./constants"

export default function UnitModal({ unit, onClose, onSave }) {
  const [formData, setFormData] = useState({
    status: unit?.status || STATUS.LIBRE,
    clientName: unit?.clientName || "",
    clientPhone: unit?.clientPhone || "",
    clientEmail: unit?.clientEmail || "",
    startDate: unit?.startDate || "",
    endDate: unit?.endDate || "",
    notes: unit?.notes || "",
    isPaid: unit?.isPaid ?? false,
    isTemporada: unit?.isTemporada ?? false
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const newStatus = formData.isTemporada 
      ? STATUS.TEMPORADA 
      : (formData.startDate ? STATUS.PERIODO : STATUS.LIBRE)
    
    onSave({ 
      ...unit, 
      ...formData, 
      status: newStatus 
    })
  }

  const handleClear = () => {
    const cleared = {
      status: STATUS.LIBRE,
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      startDate: "",
      endDate: "",
      notes: "",
      isPaid: false,
      isTemporada: false
    }
    setFormData(cleared)
    onSave({ ...unit, ...cleared })
  }

  const handleWhatsAppShare = () => {
    const text = `Hola ${formData.clientName || "Cliente"}, te confirmamos tu reserva en Prius Playa Grande:\n\n` +
      `📍 Unidad: ${unit?.type === "sombrilla" ? "Sombrilla" : "Carpa"} #${unit?.number}\n` +
      `📅 Tipo: ${formData.isTemporada ? "Temporada Completa" : `Desde ${formData.startDate} hasta ${formData.endDate}`}\n` +
      `💳 Estado de Pago: ${formData.isPaid ? "PAGADO" : "PENDIENTE"}\n\n` +
      `¡Te esperamos para disfrutar de la mejor experiencia de costa! 🌊☀️`
    
    const encodedText = encodeURIComponent(text)
    window.open(`https://wa.me/${formData.clientPhone.replace(/\D/g, "")}?text=${encodedText}`, "_blank")
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999] p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="text-white">
            <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-[0.2em] text-[#FDE047]">
              {unit?.type === "sombrilla" ? <Umbrella size={18} /> : <Home size={18} />}
              {unit?.type === "sombrilla" ? "Sombrilla" : "Carpa"} #{unit?.number}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Nombre del Cliente</label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value.toUpperCase() }))}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white placeholder-white/20 uppercase font-bold"
              placeholder="NOMBRE COMPLETO"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Teléfono</label>
              <input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white placeholder-white/20"
                placeholder="+54 9..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Email</label>
              <input
                type="email"
                value={formData.clientEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white placeholder-white/20"
                placeholder="ejemplo@mail.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all group">
              <input
                type="checkbox"
                checked={formData.isTemporada}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  isTemporada: e.target.checked,
                  startDate: e.target.checked ? "" : prev.startDate,
                  endDate: e.target.checked ? "" : prev.endDate
                }))}
                className="w-4 h-4 accent-[#FDE047] cursor-pointer"
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors">Temporada</span>
            </label>

            <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all group">
              <input
                type="checkbox"
                checked={formData.isPaid}
                onChange={(e) => setFormData(prev => ({ ...prev, isPaid: e.target.checked }))}
                className="w-4 h-4 accent-green-400 cursor-pointer"
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 flex items-center gap-1 group-hover:text-white transition-colors">
                <DollarSign size={12} className="text-green-400" /> Pagado
              </span>
            </label>
          </div>

          {!formData.isTemporada && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Desde</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white invert-[0.8] brightness-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Hasta</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none text-sm text-white invert-[0.8] brightness-200"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Notas / Observaciones</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-[#FDE047]/50 outline-none resize-none text-sm text-white placeholder-white/20"
              placeholder="Detalles adicionales..."
            />
          </div>

          {formData.clientName && formData.clientPhone && (
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
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 py-4 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all text-gray-400"
            >
              Liberar Unidad
            </button>
            <button
              type="submit"
              className="flex-1 py-4 bg-[#FDE047] hover:bg-yellow-300 text-black rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}