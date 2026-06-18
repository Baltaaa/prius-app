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
    <div className="fixed inset-0 bg-prius-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-hairline shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-hairline bg-prius-black">
          <div className="text-white">
            <h2 className="text-lg font-extralight flex items-center gap-2 uppercase tracking-tight font-display">
              {unit?.type === "sombrilla" ? <Umbrella className="w-5 h-5 text-gold" /> : <Home className="w-5 h-5 text-gold" />}
              {unit?.type === "sombrilla" ? "Sombrilla" : "Carpa"} #{unit?.number}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-extralight uppercase tracking-widest text-prius-black/40 block mb-2 font-display">Nombre del Cliente</label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value.toUpperCase() }))}
              className="w-full px-4 py-2 border border-hairline rounded-sm focus:border-gold outline-none text-sm"
              placeholder="NOMBRE COMPLETO"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-extralight uppercase tracking-widest text-prius-black/40 block mb-2 font-display">Teléfono</label>
              <input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                className="w-full px-4 py-2 border border-hairline rounded-sm focus:border-gold outline-none text-sm"
                placeholder="+54 9..."
              />
            </div>
            <div>
              <label className="text-[10px] font-extralight uppercase tracking-widest text-prius-black/40 block mb-2 font-display">Email</label>
              <input
                type="email"
                value={formData.clientEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                className="w-full px-4 py-2 border border-hairline rounded-sm focus:border-gold outline-none text-sm"
                placeholder="ejemplo@mail.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-prius-background border border-hairline rounded-sm">
              <input
                type="checkbox"
                id="isTemporada"
                checked={formData.isTemporada}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  isTemporada: e.target.checked,
                  startDate: e.target.checked ? "" : prev.startDate,
                  endDate: e.target.checked ? "" : prev.endDate
                }))}
                className="w-4 h-4 accent-gold cursor-pointer"
              />
              <label htmlFor="isTemporada" className="text-[10px] font-extralight uppercase tracking-widest cursor-pointer select-none font-display">
                Temporada (T)
              </label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-prius-background border border-hairline rounded-sm">
              <input
                type="checkbox"
                id="isPaid"
                checked={formData.isPaid}
                onChange={(e) => setFormData(prev => ({ ...prev, isPaid: e.target.checked }))}
                className="w-4 h-4 accent-gold cursor-pointer"
              />
              <label htmlFor="isPaid" className="text-[10px] font-extralight uppercase tracking-widest cursor-pointer select-none flex items-center gap-1 font-display">
                <DollarSign className="w-3 h-3 text-green-600" /> Pagado
              </label>
            </div>
          </div>

          {!formData.isTemporada && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extralight uppercase tracking-widest text-prius-black/40 block mb-2 font-display">Desde</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-hairline rounded-sm focus:border-gold outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-extralight uppercase tracking-widest text-prius-black/40 block mb-2 font-display">Hasta</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-hairline rounded-sm focus:border-gold outline-none text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-extralight uppercase tracking-widest text-prius-black/40 block mb-2 font-display">Notas / Observaciones</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full px-4 py-2 border border-hairline rounded-sm focus:border-gold outline-none resize-none text-sm"
              placeholder="Detalles adicionales..."
            />
          </div>

          {formData.clientName && formData.clientPhone && (
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-sm font-extralight text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 font-display"
            >
              <MessageSquare className="w-4 h-4" />
              Enviar Confirmación WhatsApp
            </button>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 py-3 border border-hairline hover:bg-red-50 hover:text-red-600 rounded-sm font-extralight text-[10px] uppercase tracking-widest transition-all font-display"
            >
              Liberar Unidad
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-gold hover:bg-gold-hover text-prius-black rounded-sm font-extralight text-[10px] uppercase tracking-widest transition-all font-display"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}