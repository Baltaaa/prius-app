import React, { useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { Printer, FileText, CheckCircle } from 'lucide-react'

export default function Comprobantes() {
  const { reservas, loading } = useReservas()
  const [selectedReservaId, setSelectedReservaId] = useState('')

  const selectedReserva = reservas.find(r => r.id === selectedReservaId) || reservas[0]

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Sincronizando Comprobantes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 no-print">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Emisión de Comprobantes</h1>
          <p className="text-gray-400 text-sm mt-2">Generación de recibos oficiales para clientes.</p>
        </div>

        {selectedReserva && (
          <button
            onClick={() => window.print()}
            className="bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl"
          >
            <Printer size={18} /> Imprimir Comprobante
          </button>
        )}
      </div>

      {/* Select Reserva Control */}
      <div className="glass-card p-6 rounded-2xl glass-card-inner space-y-2 no-print">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Seleccionar Contrato de Reserva</label>
        <select
          value={selectedReservaId}
          onChange={(e) => setSelectedReservaId(e.target.value)}
          className="w-full max-w-xl px-4 py-3 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-xl focus:border-[#FDE047]/50 outline-none uppercase"
        >
          {reservas.map(r => (
            <option key={r.id} value={r.id} className="bg-[#0a0d14]">
              {r.clientes?.nombre || 'S/N'} — {r.unidades?.tipo} #{r.unidades?.numero} ({r.temporada})
            </option>
          ))}
        </select>
      </div>

      {/* Printable Voucher Ticket */}
      {selectedReserva ? (
        <div className="max-w-2xl mx-auto glass-card border border-white/10 p-12 rounded-3xl space-y-10 text-white print:border-black print:p-8 print:text-black print:bg-white print:shadow-none">
          
          {/* Header Voucher */}
          <div className="flex justify-between items-start border-b border-white/10 pb-6 print:border-black">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#FDE047] rounded-xl flex items-center justify-center p-2 shrink-0 shadow-[0_0_15px_rgba(253,224,71,0.2)]">
                <img src="/images/prius-icon.png" alt="P" className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="font-extrabold text-xl tracking-tighter italic">Prius<span className="text-[#FDE047] print:text-black">Admin</span></h2>
                <p className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Playa Grande &bull; Mar del Plata</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white/10 text-[#FDE047] rounded-lg border border-white/5 print:border-black print:text-black">
                DOC. INTERNO
              </span>
              <p className="text-xs font-mono mt-3 font-bold text-gray-400">NRO: {selectedReserva.numero_factura || `REC-${selectedReserva.id.slice(0, 8).toUpperCase()}`}</p>
            </div>
          </div>

          {/* Client & Unit Data */}
          <div className="grid grid-cols-2 gap-10 text-sm border-b border-white/5 pb-8 print:border-black print:text-black">
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">Datos del Titular</p>
              <div>
                <p className="font-bold text-base uppercase text-white print:text-black">{selectedReserva.clientes?.nombre || 'S/N'}</p>
                <div className="text-xs text-gray-400 space-y-1 mt-2 print:text-black">
                  <p>CUIT/DNI: {selectedReserva.clientes?.cuit || 'N/A'}</p>
                  <p>Tel: {selectedReserva.clientes?.telefono || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1">Detalle del Alquiler</p>
              <div>
                <p className="font-bold text-base uppercase text-white print:text-black">{selectedReserva.unidades?.tipo || 'Unidad'} #{selectedReserva.unidades?.numero || 'N/A'}</p>
                <div className="text-xs text-gray-400 space-y-1 mt-2 print:text-black">
                  <p>Temporada: {selectedReserva.temporada}</p>
                  <p>Ingreso: {selectedReserva.fecha_inicio || 'T. Completa'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-white/5 print:border-black">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Monto Total Contratado:</span>
              <strong className="text-sm font-bold text-white print:text-black">{formatCurrency(selectedReserva.valor_total)}</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5 print:border-black">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Monto Abonado:</span>
              <strong className="text-sm font-bold text-green-400 print:text-black">{formatCurrency(Number(selectedReserva.valor_total) - Number(selectedReserva.saldo))}</strong>
            </div>
            <div className="flex justify-between py-4 pt-6">
              <span className="text-sm text-gray-300 font-bold uppercase tracking-[0.2em]">Saldo Pendiente:</span>
              <strong className={`text-xl font-bold ${Number(selectedReserva.saldo) > 0 ? 'text-[#FDE047]' : 'text-green-400'} print:text-black`}>
                {formatCurrency(selectedReserva.saldo)}
              </strong>
            </div>
          </div>

          {/* Footer note */}
          <div className="border-t border-white/5 pt-8 text-[10px] text-gray-500 text-center space-y-2 print:border-black print:text-black">
            <p className="font-bold uppercase tracking-widest text-white print:text-black">Comprobante de pago emitido por PriusAdmin Playa Grande.</p>
            <p className="italic opacity-60 font-medium">Este documento no es válido como factura legal. Válido únicamente como comprobante interno de reserva.</p>
          </div>
        </div>
      ) : (
        <div className="p-20 glass-card rounded-3xl text-center glass-card-inner">
           <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
           <p className="text-sm text-gray-400 uppercase font-bold tracking-widest">No hay reservas registradas para generar comprobantes.</p>
        </div>
      )}
    </div>
  )
}