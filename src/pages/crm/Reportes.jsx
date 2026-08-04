import React, { useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { Download } from 'lucide-react'

export default function Reportes() {
  const { reservas, loading } = useReservas()
  const [temporadaFilter, setTemporadaFilter] = useState('2025-2026')

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

  const activeReservas = reservas.filter(r => temporadaFilter === 'all' || r.temporada === temporadaFilter)

  const totalReservasCount = activeReservas.length
  const totalIngresosEsperados = activeReservas.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
  const totalSaldosPendientes = activeReservas.reduce((acc, curr) => acc + Number(curr.saldo || 0), 0)
  const totalCobradoEfectivo = totalIngresosEsperados - totalSaldosPendientes

  const groupedByType = activeReservas.reduce((acc, curr) => {
    const tipo = curr.unidades?.tipo || 'Desconocido'
    if (!acc[tipo]) {
      acc[tipo] = { count: 0, total: 0 }
    }
    acc[tipo].count += 1
    acc[tipo].total += Number(curr.valor_total || 0)
    return acc
  }, {})

  const handleExportCSV = () => {
    if (activeReservas.length === 0) {
      alert('No hay reservas para exportar.')
      return
    }

    const csvHeaders = ['Cliente', 'Unidad Nro', 'Tipo', 'Temporada', 'Valor Total', 'Saldo', 'Estado Pago', 'Factura', 'Fecha Inicio', 'Fecha Fin']
    const csvRows = activeReservas.map(res => [
      `"${res.clientes?.nombre || 'S/N'}"`,
      res.unidades?.numero || 'N/A',
      `"${res.unidades?.tipo || 'N/A'}"`,
      `"${res.temporada}"`,
      res.valor_total,
      res.saldo,
      `"${res.estado_pago}"`,
      `"${res.numero_factura || ''}"`,
      res.fecha_inicio || '',
      res.fecha_fin || ''
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + [csvHeaders.join(','), ...csvRows.map(e => e.join(','))].join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `reporte_priusadmin_${temporadaFilter}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-xs font-semibold text-white/40">Cargando Reportes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Reportes de Temporada</h1>
          <p className="text-xs text-white/50 font-normal">Métricas analíticas consolidadas de cobros y ocupación.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-full transition-colors flex items-center gap-2 border border-white/10"
        >
          <Download size={14} /> Exportar Planilla CSV
        </button>
      </div>

      {/* Select temporada filter */}
      <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-white/50 uppercase">Año de Temporada</label>
          <select
            value={temporadaFilter}
            onChange={(e) => setTemporadaFilter(e.target.value)}
            className="block w-48 px-3 py-1.5 bg-[#181818] border border-white/10 text-xs font-semibold text-white outline-none focus:border-[#F2CA50] rounded-xl"
          >
            <option value="all">TODAS LAS TEMPORADAS</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2024-2025">2024-2025</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-white/40 uppercase">Contratos Totales</span>
          <p className="text-2xl font-bold mt-1 text-white">{totalReservasCount}</p>
        </div>
        <div className="p-5 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-white/40 uppercase">Facturación Bruta</span>
          <p className="text-2xl font-bold mt-1 text-white">{formatCurrency(totalIngresosEsperados)}</p>
        </div>
        <div className="p-5 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-white/40 uppercase">Cobrado</span>
          <p className="text-2xl font-bold mt-1 text-emerald-400">{formatCurrency(totalCobradoEfectivo)}</p>
        </div>
        <div className="p-5 border border-white/10 bg-white/5 rounded-2xl backdrop-blur-md">
          <span className="text-xs font-semibold text-white/40 uppercase">Cuentas Corrientes</span>
          <p className="text-2xl font-bold mt-1 text-rose-400">{formatCurrency(totalSaldosPendientes)}</p>
        </div>
      </div>

      {/* Aggregate metrics per type */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase text-white/70">Distribución por Tipo de Unidad</h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 text-white/60 text-[11px] font-bold uppercase border-b border-white/10">
                <th className="p-4">Tipo de Unidad</th>
                <th className="p-4">Cantidad Alquilada</th>
                <th className="p-4 text-right">Monto Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white">
              {Object.keys(groupedByType).map((tipo) => (
                <tr key={tipo} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold uppercase text-white">{tipo}</td>
                  <td className="p-4 font-medium text-white/80">{groupedByType[tipo].count}</td>
                  <td className="p-4 text-right font-bold text-white">{formatCurrency(groupedByType[tipo].total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}