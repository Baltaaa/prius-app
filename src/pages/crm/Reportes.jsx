import React, { useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { Download, BarChart3 } from 'lucide-react'
import KpiCard from '../../components/crm/KpiCard'

export default function Reportes() {
  const { reservas, loading } = useReservas()
  const [temporadaFilter, setTemporadaFilter] = useState('2025-2026')

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

  const activeReservas = reservas.filter(r => temporadaFilter === 'all' || r.temporada === temporadaFilter)

  const totalIngresosEsperados = activeReservas.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
  const totalSaldosPendientes = activeReservas.reduce((acc, curr) => acc + Number(curr.saldo || 0), 0)
  const totalCobrado = totalIngresosEsperados - totalSaldosPendientes

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Analizando Datos...</span></div>

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Reportes</h1>
          <p className="text-gray-400 text-sm mt-2">Métricas avanzadas de facturación y ocupación.</p>
        </div>
        <button className="glass-card px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#FDE047] hover:text-black transition-all flex items-center gap-2">
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Facturación Bruta" value={formatCurrency(totalIngresosEsperados)} icon={BarChart3} highlight />
        <KpiCard title="Total Cobrado" value={formatCurrency(totalCobrado)} icon={BarChart3} />
        <KpiCard title="Deuda Externa" value={formatCurrency(totalSaldosPendientes)} icon={BarChart3} />
      </div>

      <div className="glass-card p-8 rounded-3xl glass-card-inner">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Detalle de Contratos</h2>
          <select 
            value={temporadaFilter} 
            onChange={(e) => setTemporadaFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs font-bold uppercase text-gray-400 outline-none focus:border-[#FDE047]"
          >
            <option value="all">Todas las temporadas</option>
            <option value="2025-2026">2025-2026</option>
          </select>
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Unidad</th>
              <th className="px-6 py-4 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-gray-300">
            {activeReservas.map(res => (
              <tr key={res.id} className="hover:bg-white/5 transition-all">
                <td className="px-6 py-4 font-bold uppercase text-white">{res.clientes?.nombre}</td>
                <td className="px-6 py-4 uppercase font-medium">{res.unidades?.tipo} #{res.unidades?.numero}</td>
                <td className="px-6 py-4 text-right font-bold text-[#FDE047]">{formatCurrency(res.valor_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}