import React, { useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import StatusBadge from '../../components/crm/StatusBadge'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

export default function Calendario() {
  const { reservas, unidades, loading } = useReservas()
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)) // Enero 2026 por defecto

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-neutral-400">Cargando Calendario de Ocupación...</span>
      </div>
    )
  }

  // Filtrar reservas que caigan o se solapen en el mes actual
  const monthReservas = reservas.filter(r => {
    if (!r.fecha_inicio || !r.fecha_fin) return true // Temporada completa se muestra siempre
    const inicio = new Date(r.fecha_inicio)
    const fin = new Date(r.fecha_fin)
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month, daysInMonth)

    return (inicio <= monthEnd && fin >= monthStart)
  })

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">Calendario de Ocupación</h1>
          <p className="text-xs text-neutral-500 font-normal">Vista cronológica mensual de alquileres por unidad.</p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2 bg-[#F9F9F9] border border-[#E5E5E5] p-1.5 rounded">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-white rounded border border-transparent hover:border-[#E5E5E5] text-black"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold uppercase tracking-wider px-3 min-w-[120px] text-center">
            {monthNames[month]} {year}
          </span>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-white rounded border border-transparent hover:border-[#E5E5E5] text-black"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar Summary Table */}
      <div className="bg-white border border-[#E5E5E5] rounded p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <CalendarIcon size={16} className="text-black" />
            <span>Alquileres Activos ({monthNames[month]} {year})</span>
          </h2>
          <span className="text-xs text-neutral-500 font-medium">
            Total: {monthReservas.length} contrataciones
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E5E5E5] text-[11px] font-bold uppercase text-neutral-600">
                <th className="p-3">Unidad</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Período de Alquiler</th>
                <th className="p-3">Estado Pago</th>
                <th className="p-3 text-right">Saldo Deuda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {monthReservas.map((res) => (
                <tr key={res.id} className="hover:bg-[#F9F9F9] transition-colors">
                  <td className="p-3 font-bold uppercase text-black">
                    {res.unidades?.tipo || 'Unidad'} #{res.unidades?.numero || 'S/N'}
                  </td>
                  <td className="p-3 uppercase font-semibold text-neutral-800">
                    {res.clientes?.nombre || 'S/N'}
                  </td>
                  <td className="p-3 text-neutral-600">
                    {res.fecha_inicio ? `${res.fecha_inicio} al ${res.fecha_fin}` : 'TEMPORADA COMPLETA'}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={res.estado_pago} />
                  </td>
                  <td className={`p-3 text-right font-bold ${Number(res.saldo) > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                    ${res.saldo}
                  </td>
                </tr>
              ))}
              {monthReservas.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400">
                    No hay reservas registradas para este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}