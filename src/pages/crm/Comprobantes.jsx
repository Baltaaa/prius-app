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
        <span className="text-xs font-semibold text-neutral-400">Cargando Comprobantes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E5E5] pb-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">Emisión de Comprobantes</h1>
          <p className="text-xs text-neutral-500 font-normal">Generación e impresión de recibos de pago y señas para clientes.</p>
        </div>

        {selectedReserva && (
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-[#F2CA50] hover:bg-[#E5BF45] text-black font-semibold text-xs rounded transition-colors flex items-center gap-2"
          >
            <Printer size={16} /> Imprimir Comprobante
          </button>
        )}
      </div>

      {/* Select Reserva Control */}
      <div className="p-4 bg-[#F9F9F9] border border-[#E5E5E5] rounded space-y-1 no-print">
        <label className="text-[10px] font-bold text-neutral-500 uppercase">Seleccionar Contrato de Reserva</label>
        <select
          value={selectedReservaId}
          onChange={(e) => setSelectedReservaId(e.target.value)}
          className="w-full max-w-md px-3 py-2 bg-white border border-[#E5E5E5] text-xs font-semibold rounded focus:border-black outline-none uppercase"
        >
          {reservas.map(r => (
            <option key={r.id} value={r.id}>
              {r.clientes?.nombre || 'S/N'} — {r.unidades?.tipo} #{r.unidades?.numero} ({r.temporada})
            </option>
          ))}
        </select>
      </div>

      {/* Printable Voucher Ticket */}
      {selectedReserva ? (
        <div className="max-w-2xl mx-auto bg-white border border-black p-8 rounded space-y-6 text-black print:border-none print:p-0">
          
          {/* Header Voucher */}
          <div className="flex justify-between items-start border-b border-black pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-black text-[#F2CA50] rounded flex items-center justify-center font-bold text-xs">P</div>
                <h2 className="font-extrabold text-base tracking-tight">PriusAdmin</h2>
              </div>
              <p className="text-[10px] uppercase font-bold text-neutral-500 mt-1">Balneario Prius Playa Grande &bull; Mar del Plata</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-black text-[#F2CA50] rounded">
                COMPROBANTE OFICIAL
              </span>
              <p className="text-[11px] font-mono mt-2 font-bold">NRO: {selectedReserva.numero_factura || `REC-${selectedReserva.id.slice(0, 8).toUpperCase()}`}</p>
            </div>
          </div>

          {/* Client & Unit Data */}
          <div className="grid grid-cols-2 gap-6 text-xs border-b border-[#E5E5E5] pb-4">
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Datos del Titular</p>
              <p className="font-bold text-sm uppercase">{selectedReserva.clientes?.nombre || 'S/N'}</p>
              <p className="text-neutral-600">CUIT/DNI: {selectedReserva.clientes?.cuit || 'N/A'}</p>
              <p className="text-neutral-600">Tel: {selectedReserva.clientes?.telefono || 'N/A'}</p>
              <p className="text-neutral-600">Mail: {selectedReserva.clientes?.mail || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Detalle del Alquiler</p>
              <p className="font-bold text-sm uppercase">{selectedReserva.unidades?.tipo || 'Unidad'} #{selectedReserva.unidades?.numero || 'N/A'}</p>
              <p className="text-neutral-600">Temporada: {selectedReserva.temporada}</p>
              <p className="text-neutral-600">
                Fechas: {selectedReserva.fecha_inicio ? `${selectedReserva.fecha_inicio} al ${selectedReserva.fecha_fin}` : 'Temporada Completa'}
              </p>
            </div>
          </div>

          {/* Pricing breakdown */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E5E5E5]">
              <span>Monto Total Contratado:</span>
              <strong className="font-bold text-black">{formatCurrency(selectedReserva.valor_total)}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E5E5E5]">
              <span>Monto Abonado a la Fecha:</span>
              <strong className="font-bold text-green-700">{formatCurrency(Number(selectedReserva.valor_total) - Number(selectedReserva.saldo))}</strong>
            </div>
            <div className="flex justify-between py-1 text-sm font-bold pt-2">
              <span>Saldo Pendiente:</span>
              <strong className={Number(selectedReserva.saldo) > 0 ? 'text-red-600' : 'text-black'}>
                {formatCurrency(selectedReserva.saldo)}
              </strong>
            </div>
          </div>

          {/* Footer note */}
          <div className="border-t border-black pt-4 text-[10px] text-neutral-500 text-center space-y-1">
            <p className="font-bold uppercase text-black">Comprobante de pago emitido por PriusAdmin Playa Grande.</p>
            <p>Gracias por elegirnos. Ante cualquier duda comuníquese con la administración del balneario.</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-center text-neutral-400 py-8">No hay reservas registradas para generar comprobante.</p>
      )}
    </div>
  )
}