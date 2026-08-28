import React, { useState, useMemo } from 'react'
import { useReservas } from '../../hooks/useReservas'
import StatusBadge from '../../components/crm/StatusBadge'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

export default function Calendario() {
  const { reservas, loading } = useReservas()
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthReservas = useMemo(() => {
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month, daysInMonth)
    return reservas.filter(r => {
      if (!r.fecha_inicio || !r.fecha_fin) return true
      return new Date(r.fecha_inicio) <= monthEnd && new Date(r.fecha_fin) >= monthStart
    })
  }, [reservas, year, month, daysInMonth])

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Cargando Calendario...</span></div>

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Calendario</h1>
          <p className="text-gray-400 text-sm mt-2">Visualización cronológica de ocupación mensual.</p>
        </div>

        <div className="glass-card p-1 rounded-xl flex items-center gap-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
          <span className="text-xs font-bold uppercase tracking-widest px-4 text-[#FDE047]">{monthNames[month]} {year}</span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="glass-card rounded-3xl overflow-x-auto glass-card-inner">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <th className="px-8 py-5">Unidad</th>
              <th className="px-8 py-5">Cliente</th>
              <th className="px-8 py-5">Período</th>
              <th className="px-8 py-5 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-gray-300">
            {monthReservas.map((res) => (
              <tr key={res.id} className="hover:bg-white/5 transition-all group">
                <td className="px-8 py-5 font-bold text-white uppercase">{res.unidades?.tipo} #{res.unidades?.numero}</td>
                <td className="px-8 py-5 uppercase font-medium">{res.clientes?.nombre}</td>
                <td className="px-8 py-5 text-gray-400">
                  {res.fecha_inicio ? `${res.fecha_inicio} al ${res.fecha_fin}` : 'TEMPORADA'}
                </td>
                <td className="px-8 py-5 text-right font-bold text-[#FDE047]">
                  ${res.saldo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}