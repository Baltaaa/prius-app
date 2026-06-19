import React, { useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { BarChart3, Download, RefreshCw } from 'lucide-react'

export default function Reportes() {
  const { reservas, loading } = useReservas()
  const [temporadaFilter, setTemporadaFilter] = useState('2025-2026')

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0)
  }

  // Filtrado de temporada para reporte
  const activeReservas = reservas.filter(r => temporadaFilter === 'all' || r.temporada === temporadaFilter)

  // Calculos aggregados
  const totalReservasCount = activeReservas.length
  const totalIngresosEsperados = activeReservas.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
  const totalSaldosPendientes = activeReservas.reduce((acc, curr) => acc + Number(curr.saldo || 0), 0)
  const totalCobradoEfectivo = totalIngresosEsperados - totalSaldosPendientes

  // Grouping by type
  const groupedByType = activeReservas.reduce((acc, curr) => {
    const tipo = curr.unidades?.tipo || 'Desconocido'
    if (!acc[tipo]) {
      acc[tipo] = { count: 0, total: 0 }
    }
    acc[tipo].count += 1
    acc[tipo].total += Number(curr.valor_total || 0)
    return acc
  }, {})

  // Download CSV
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
    link.setAttribute("download", `reporte_prius_reservas_${temporadaFilter}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs uppercase tracking-widest font-semibold text-neutral-400">Cargando Reportes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl uppercase tracking-wider font-extrabold font-display">Reportes de Temporada</h1>
          <p className="text-xs text-neutral-500">Métricas analíticas consolidadas de cobros y ocupación.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-3 bg-black hover:bg-neutral-900 text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 rounded-sm"
        >
          <Download size={14} /> Exportar Planilla CSV
        </button>
      </div>

      {/* Select temporada filter */}
      <div className="flex items-center gap-4 p-4 bg-neutral-100 border border-[#E5E5E5]">
        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase text-neutral-500 font-display">Año de Temporada</label>
          <select
            value={temporadaFilter}
            onChange={(e) => setTemporadaFilter(e.target.value)}
            className="block w-48 px-3 py-1.5 bg-white border border-[#E5E5E5] text-xs uppercase outline-none focus:border-black rounded-sm font-semibold"
          >
            <option value="all">TODAS LAS TEMPORADAS</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2024-2025">2024-2025</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 border border-[#E5E5E5] bg-white">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Alquileres Totales</span>
          <p className="text-xl font-bold mt-1 text-black">{totalReservasCount}</p>
          <p className="text-[8px] uppercase tracking-wider text-neutral-500 mt-1">Suma de carpas y sombrillas</p>
        </div>
        <div className="p-5 border border-[#E5E5E5] bg-white">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Facturación Bruta</span>
          <p className="text-xl font-bold mt-1 text-black">{formatCurrency(totalIngresosEsperados)}</p>
          <p className="text-[8px] uppercase tracking-wider text-neutral-500 mt-1">Valor de contratos total</p>
        </div>
        <div className="p-5 border border-[#E5E5E5] bg-white">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total Cobrado</span>
          <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(totalCobradoEfectivo)}</p>
          <p className="text-[8px] uppercase tracking-wider text-neutral-500 mt-1">Ingresos ingresados reales</p>
        </div>
        <div className="p-5 border border-[#E5E5E5] bg-white">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Saldos Deudores</span>
          <p className="text-xl font-bold mt-1 text-red-600">{formatCurrency(totalSaldosPendientes)}</p>
          <p className="text-[8px] uppercase tracking-wider text-neutral-500 mt-1">Cuentas corrientes pendientes</p>
        </div>
      </div>

      {/* Aggregate metrics per type */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest font-bold text-neutral-500 font-display">Distribución por Tipo de Unidad</h2>
        <div className="bg-white border border-[#E5E5E5] overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100 text-neutral-500 text-[9px] font-bold uppercase tracking-widest">
                <th className="p-4 border-b border-[#E5E5E5]">Tipo de Unidad</th>
                <th className="p-4 border-b border-[#E5E5E5]">Cantidad Alquilada</th>
                <th className="p-4 border-b border-[#E5E5E5] text-right">Monto Total Alquilado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {Object.keys(groupedByType).map((tipo) => (
                <tr key={tipo} className="hover:bg-neutral-50">
                  <td className="p-4 font-bold uppercase">{tipo}</td>
                  <td className="p-4">{groupedByType[tipo].count}</td>
                  <td className="p-4 text-right font-bold">{formatCurrency(groupedByType[tipo].total)}</td>
                </tr>
              ))}
              {Object.keys(groupedByType).length === 0 && (
                <tr>
                  <td colSpan="3" className="p-6 text-center text-xs uppercase text-neutral-400">Sin datos de distribución.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}