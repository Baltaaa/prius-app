import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { Download, BarChart3 } from 'lucide-react'
import KpiCard from '../../components/crm/KpiCard'
import BrandSelect from '../../components/ui/BrandSelect'
import { formatPesos, unidadEmoji, formatFecha, formatUnidad} from '../../lib/format'
import { linkToCliente } from '../../lib/deepLinks'
import { crearDocumentoCsv } from '../../lib/export/csvBuilder'
import { descargarCsv, nombreArchivoCsv } from '../../lib/export/descargarCsv'
import { formatMontoCsv, etiqueta, unidadNotacionCsv } from '../../lib/export/formatos'
import { isFeatureEnabled } from '../../lib/features'
import ClienteDrawer from '../../components/crm/ClienteDrawer'
import RegistrarPago from '../../components/crm/RegistrarPago'
import { useInitialLoad } from '../../hooks/useInitialLoad'
import Skeleton from '../../components/ui/Skeleton'

const OPCIONES_TEMPORADA = [
  { value: 'all', label: 'Todas las temporadas' },
  { value: '2025-2026', label: '2025-2026' },
]

export default function Reportes() {
  const navigate = useNavigate()
  const { reservas, loading } = useReservas()
  const readyReportes = useInitialLoad(loading)
  const [temporadaFilter, setTemporadaFilter] = useState('2025-2026')
  // [feat-3] drawer de cliente en vez de navegar directo a Clientes.
  const [drawerClienteId, setDrawerClienteId] = useState(null)
  const [pagoCliente, setPagoCliente] = useState(null)
  const drawerFeatureOn = isFeatureEnabled('feat-3-drawer-cliente')
  const abrirCliente = (res) => drawerFeatureOn
    ? setDrawerClienteId(res.cliente_id)
    : navigate(linkToCliente(res.cliente_id, { reservaId: res.id }))

  const activeReservas = useMemo(
    () => reservas.filter(r => temporadaFilter === 'all' || r.temporada === temporadaFilter),
    [reservas, temporadaFilter]
  )

  // Migrado al estándar único de exportación CSV (oct 2026, ver
  // src/lib/export/) — mismo builder que usa Caja, reemplaza al CSV a mano
  // de antes (coma, sin BOM real, etiquetas técnicas).
  const handleExportCSV = () => {
    const filas = activeReservas.map((r) => [
      r.clientes?.nombre || '',
      r.clientes?.cuit || '',
      unidadNotacionCsv(r.unidades?.tipo, r.unidades?.numero),
      r.temporada || '',
      formatMontoCsv(r.valor_total),
      formatMontoCsv(r.saldo),
      etiqueta('estado_pago', r.estado_pago),
    ])
    const csv = crearDocumentoCsv({
      titulo: 'Reporte de reservas',
      metadatos: [
        ['Temporada', temporadaFilter === 'all' ? 'Todas' : temporadaFilter],
        ['Exportado el', formatFecha(new Date())],
      ],
      secciones: [{
        titulo: 'Reservas',
        columnas: ['Cliente', 'CUIT', 'Unidad', 'Temporada', 'Monto total', 'Saldo', 'Estado de pago'],
        filas,
      }],
    })
    descargarCsv(csv, nombreArchivoCsv('reportes', new Date().toISOString().split('T')[0], temporadaFilter))
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

  if (!readyReportes) {
    return (
      <div className="space-y-10 font-ui">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <KpiCard title="Facturación Bruta" value={formatPesos(totalIngresosEsperados)} icon={BarChart3} highlight />
        <KpiCard title="Total Cobrado" value={formatPesos(totalCobrado)} icon={BarChart3} />
        <KpiCard title="Deuda Externa" value={formatPesos(totalSaldosPendientes)} icon={BarChart3} />
      </div>

      <div className="card-light p-4 sm:p-8 rounded-3xl card-light-inner">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-8">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-black">Detalle de Contratos</h2>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="w-56">
              <BrandSelect value={temporadaFilter} onChange={setTemporadaFilter} options={OPCIONES_TEMPORADA} className="py-2.5" />
            </div>
            <button
              onClick={handleExportCSV}
              disabled={activeReservas.length === 0}
              className="card-light px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-gold hover:text-black transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-black"
            >
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Mobile: tarjetas */}
        <div className="sm:hidden space-y-3">
          {activeReservas.map(res => (
            <button
              type="button"
              key={res.id}
              onClick={() => abrirCliente(res)}
              className="w-full text-left p-4 bg-prius-subtle border border-hairline rounded-xl flex items-center justify-between gap-3 hover:bg-prius-subtle transition-all"
            >
              <div className="min-w-0">
                <p className="font-bold uppercase text-black truncate">{res.clientes?.nombre}</p>
                <p className="text-xs text-prius-slate uppercase mt-0.5">{unidadEmoji(res.unidades?.tipo)} {formatUnidad(res.unidades?.tipo, res.unidades?.numero)}</p>
              </div>
              <p className="font-bold text-gold shrink-0">{formatPesos(res.valor_total)}</p>
            </button>
          ))}
        </div>

        {/* Desktop: tabla */}
        <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-hairline text-[10px] font-bold uppercase tracking-widest text-prius-muted">
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Unidad</th>
              <th className="px-6 py-4 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm text-prius-slate">
            {activeReservas.map(res => (
              <tr
                key={res.id}
                onClick={() => abrirCliente(res)}
                className="hover:bg-prius-subtle transition-all cursor-pointer"
              >
                <td className="px-6 py-4 font-bold uppercase text-black">{res.clientes?.nombre}</td>
                <td className="px-6 py-4 uppercase font-medium">{unidadEmoji(res.unidades?.tipo)} {formatUnidad(res.unidades?.tipo, res.unidades?.numero)}</td>
                <td className="px-6 py-4 text-right font-bold text-gold">{formatPesos(res.valor_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {drawerFeatureOn && (
        <ClienteDrawer
          clienteId={drawerClienteId}
          onClose={() => setDrawerClienteId(null)}
          onRegistrarPago={(cliente) => setPagoCliente(cliente)}
        />
      )}
      <RegistrarPago
        isOpen={!!pagoCliente}
        onClose={() => setPagoCliente(null)}
        cliente={pagoCliente}
        reservasOptions={pagoCliente ? activeReservas.filter((r) => r.cliente_id === pagoCliente.id && !r.bonificada) : []}
      />
    </div>
  )
}