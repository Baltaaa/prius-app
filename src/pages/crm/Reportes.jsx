import React, { useState, useMemo } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { Download, BarChart3 } from 'lucide-react'
import KpiCard from '../../components/crm/KpiCard'
import { formatCurrency } from '../../lib/format'

export default function Reportes() {
  const { reservas, loading } = useReservas()
  const [temporadaFilter, setTemporadaFilter] = useState('2025-2026')

  const activeReservas = useMemo(
    () => reservas.filter(r => temporadaFilter === 'all' || r.temporada === temporadaFilter),
    [reservas, temporadaFilter]
  )

  const handleExportCSV = () => {
    const headers = ['Cliente', 'CUIT', 'Unidad', 'Temporada', 'Monto Total', 'Saldo', 'Estado Pago']
    const rows = activeReservas.map(r => [
      r.clientes?.nombre || '',
      r.clientes?.cuit || '',
      `${r.unidades?.tipo || ''} #${r.unidades?.numero || ''}`,
      r.temporada || '',
      r.valor_total || 0,
      r.saldo || 0,
      r.estado_pago || '',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-reservas-${temporadaFilter}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const { totalIngresosEsperados, totalSaldosPendientes, totalCobrado } = useMemo(() => {
    const ingresos = activeReservas.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
    const saldos = activeReservas.reduce((acc, curr) => acc + Number(curr.saldo || 0), 0)
    return { totalIngresosEsperados: ingresos, totalSaldosPendientes: saldos, totalCobrado: ingresos - saldos }
  }, [activeReservas])

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Analizando Datos...</span></div>

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Reportes</h1>
          <p className="text-gray-400 text-sm mt-2">Métricas avanzadas de facturación y ocupación.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={activeReservas.length === 0}
          className="glass-card px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#FDE047] hover:text-black transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white"
        >
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
        
        <div className="overflow-x-auto">
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
    </div>
  )
}