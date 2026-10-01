import { useMemo, useState } from 'react'
import { useData } from '../../context/DataProvider'
import { formatFechaLarga, formatHora } from '../../lib/format'
import { CalendarDays, Wallet, Users, Map as MapIcon, Receipt, Activity } from 'lucide-react'

// Línea de tiempo del CRM: toda acción sobre reservas, pagos, clientes, unidades
// y gastos, escrita por triggers en la tabla `eventos` y ordenada por su fecha
// de negocio (fecha_ref), no por cuándo se tipeó.
const META = {
  reservas: { icon: CalendarDays, label: 'Reserva', color: 'text-[#FDE047]' },
  pagos: { icon: Wallet, label: 'Pago', color: 'text-green-400' },
  clientes: { icon: Users, label: 'Cliente', color: 'text-sky-400' },
  unidades: { icon: MapIcon, label: 'Unidad', color: 'text-purple-400' },
  gastos_caja: { icon: Receipt, label: 'Gasto', color: 'text-red-400' },
}
const OPS = { INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Baja' }
const FILTROS = [
  { key: 'todos', label: 'Todo' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'unidades', label: 'Unidades' },
  { key: 'gastos_caja', label: 'Gastos' },
]

const fmtFecha = formatFechaLarga
const fmtHora = formatHora

export default function Actividad() {
  const { eventos, loading } = useData()
  const [filtro, setFiltro] = useState('todos')

  const grupos = useMemo(() => {
    const items = filtro === 'todos' ? eventos : eventos.filter((e) => e.tabla === filtro)
    const map = new Map()
    for (const e of items) {
      if (!map.has(e.fecha_ref)) map.set(e.fecha_ref, [])
      map.get(e.fecha_ref).push(e)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [eventos, filtro])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Cargando actividad...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
              filtro === f.key
                ? 'bg-[#FDE047] text-black border-[#FDE047]'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {grupos.length === 0 && (
        <div className="glass-card rounded-3xl p-12 text-center text-gray-600 uppercase text-xs tracking-widest flex flex-col items-center gap-3">
          <Activity size={28} className="opacity-40" />
          Sin actividad registrada todavía
        </div>
      )}

      <div className="space-y-8">
        {grupos.map(([fecha, items]) => (
          <div key={fecha}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FDE047] mb-4 capitalize">{fmtFecha(fecha)}</h2>
            <div className="glass-card rounded-2xl glass-card-inner divide-y divide-white/5">
              {items.map((e) => {
                const meta = META[e.tabla] || { icon: Activity, label: e.tabla, color: 'text-gray-400' }
                const Icon = meta.icon
                return (
                  <div key={e.id} className="flex items-start gap-4 px-6 py-4">
                    <div className={`mt-0.5 shrink-0 ${meta.color}`}><Icon size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-200">{e.descripcion}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mt-1">
                        {meta.label} · {OPS[e.operacion] || e.operacion} · {fmtHora(e.ts)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
