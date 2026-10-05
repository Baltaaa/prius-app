import React, { useState, useMemo } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { Download, BarChart3 } from 'lucide-react'
import KpiCard from '../../components/crm/KpiCard'
import BrandSelect from '../../components/ui/BrandSelect'
import { formatPesos, unidadEmoji } from '../../lib/format'

const OPCIONES_TEMPORADA = [
  { value: 'all', label: 'Todas las temporadas' },
  { value: '2025-2026', label: '2025-2026' },
]

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

  // Las reservas bonificadas (valor_total=0 forzado por la base) no aportan
  // facturación ni deuda — se excluyen explícitamente acá para que el
  // reporte no dependa de que ese 0 se mantenga siempre así en la base.
  const { totalIngresosEsperados, totalSaldosPendientes, totalCobrado } = useMemo(() => {
    const facturables = activeReservas.filter((r) => !r.bonificada)
    const ingresos = facturables.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
    const saldos = facturables.reduce((acc, curr) => acc + Number(curr.saldo || 0), 0)
    return { totalIngresosEsperados: ingresos, totalSaldosPendientes: saldos, totalCobrado: ingresos - saldos }
  }, [activeReservas])

  if (loading) return <div className="flex items-center justify-center h-64"><span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Analizando Datos...</span></div>

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <KpiCard title="Facturación Bruta" value={formatPesos(totalIngresosEsperados)} icon={BarChart3} highlight />
        <KpiCard title="Total Cobrado" value={formatPesos(totalCobrado)} icon={BarChart3} />
        <KpiCard title="Deuda Externa" value={formatPesos(totalSaldosPendientes)} icon={BarChart3} />
      </div>

      <div className="glass-card p-4 sm:p-8 rounded-3xl glass-card-inner">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-8">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white">Detalle de Contratos</h2>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="w-56">
              <BrandSelect value={temporadaFilter} onChange={setTemporadaFilter} options={OPCIONES_TEMPORADA} className="py-2.5" />
            </div>
            <button
              onClick={handleExportCSV}
              disabled={activeReservas.length === 0}
              className="glass-card px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#FDE047] hover:text-black transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white"
            >
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Mobile: tarjetas */}
        <div className="sm:hidden space-y-3">
          {activeReservas.map(res => (
            <div key={res.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold uppercase text-white truncate">{res.clientes?.nombre}</p>
                <p className="text-xs text-gray-400 uppercase mt-0.5">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</p>
              </div>
              <p className="font-bold text-[#FDE047] shrink-0">{formatPesos(res.valor_total)}</p>
            </div>
          ))}
        </div>

        {/* Desktop: tabla */}
        <div className="hidden sm:block overflow-x-auto">
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
                <td className="px-6 py-4 uppercase font-medium">{unidadEmoji(res.unidades?.tipo)} {res.unidades?.tipo} #{res.unidades?.numero}</td>
                <td className="px-6 py-4 text-right font-bold text-[#FDE047]">{formatPesos(res.valor_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}