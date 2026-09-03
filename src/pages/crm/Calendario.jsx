import { useMemo, useState } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

// Fecha local en YYYY-MM-DD (evita el corrimiento de día de toISOString en UTC-3).
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ¿La reserva ocupa la unidad ese día concreto?
function activaEnFecha(r, fechaStr) {
  if (r.estado === 'cancelada') return false
  if (r.tipo_alquiler === 'temporada') return true
  if (r.tipo_alquiler === 'dia') return r.fecha === fechaStr
  if (r.fecha_inicio && r.fecha_fin) return r.fecha_inicio <= fechaStr && fechaStr <= r.fecha_fin
  return false
}

function rangoTexto(r) {
  if (r.tipo_alquiler === 'temporada') return 'TEMPORADA COMPLETA'
  if (r.tipo_alquiler === 'dia') return `DÍA ${r.fecha ?? ''}`
  if (r.fecha_inicio && r.fecha_fin) return `${r.fecha_inicio} al ${r.fecha_fin}`
  return 'SIN FECHAS'
}

export default function Calendario() {
  const { reservas, loading } = useReservas()
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [diaSel, setDiaSel] = useState(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  // Lunes = 0
  const offset = (new Date(year, month, 1).getDay() + 6) % 7

  const prevMes = () => { setDiaSel(null); setCursor(new Date(year, month - 1, 1)) }
  const nextMes = () => { setDiaSel(null); setCursor(new Date(year, month + 1, 1)) }
  const hoyStr = iso(new Date())

  // reservas activas por día del mes
  const porDia = useMemo(() => {
    const map = {}
    for (let d = 1; d <= diasEnMes; d++) {
      const fechaStr = iso(new Date(year, month, d))
      map[d] = reservas.filter((r) => activaEnFecha(r, fechaStr))
    }
    return map
  }, [reservas, year, month, diasEnMes])

  const reservasDelDia = diaSel ? porDia[diaSel] || [] : null

  // reservas que tocan el mes (para el listado cuando no hay día seleccionado)
  const reservasDelMes = useMemo(() => {
    const seen = new Set()
    const out = []
    for (let d = 1; d <= diasEnMes; d++) {
      for (const r of porDia[d] || []) {
        if (!seen.has(r.id)) { seen.add(r.id); out.push(r) }
      }
    }
    return out
  }, [porDia, diasEnMes])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 uppercase animate-pulse">Cargando Calendario...</span>
      </div>
    )
  }

  const listado = reservasDelDia ?? reservasDelMes

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Calendario</h1>
          <p className="text-gray-400 text-sm mt-2">Ocupación real de las unidades día por día. Refleja toda reserva cargada (temporada, período o día).</p>
        </div>
        <div className="glass-card p-1 rounded-xl flex items-center gap-2">
          <button onClick={prevMes} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
          <span className="text-xs font-bold uppercase tracking-widest px-4 text-[#FDE047]">{MESES[month]} {year}</span>
          <button onClick={nextMes} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* Grilla del mes */}
      <div className="glass-card rounded-3xl p-4 md:p-6 glass-card-inner">
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {DIAS.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 py-2">{d}</div>
          ))}
          {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((d) => {
            const fechaStr = iso(new Date(year, month, d))
            const items = porDia[d] || []
            const esHoy = fechaStr === hoyStr
            const activo = diaSel === d
            return (
              <button
                key={d}
                onClick={() => setDiaSel(activo ? null : d)}
                className={`aspect-square rounded-xl border p-1.5 flex flex-col items-start justify-between text-left transition-all ${
                  activo
                    ? 'border-[#FDE047] bg-[#FDE047]/10'
                    : esHoy
                      ? 'border-[#FDE047]/40 bg-white/5'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                <span className={`text-[11px] font-bold ${esHoy ? 'text-[#FDE047]' : 'text-gray-300'}`}>{d}</span>
                {items.length > 0 && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 leading-tight">
                    {items.length} {items.length === 1 ? 'unidad' : 'unidades'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Listado */}
      <div className="glass-card rounded-3xl overflow-x-auto glass-card-inner">
        <div className="px-8 pt-6 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {diaSel
            ? `Reservas activas el ${diaSel} de ${MESES[month]}`
            : `Reservas del mes (${listado.length})`}
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <th className="px-8 py-4">Unidad</th>
              <th className="px-8 py-4">Cliente</th>
              <th className="px-8 py-4">Tipo / Fechas</th>
              <th className="px-8 py-4 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-gray-300">
            {listado.length === 0 && (
              <tr><td colSpan={4} className="px-8 py-8 text-center text-gray-600 uppercase text-xs tracking-widest">Sin reservas</td></tr>
            )}
            {listado.map((res) => (
              <tr key={res.id} className="hover:bg-white/5 transition-all">
                <td className="px-8 py-5 font-bold text-white uppercase">{res.unidades?.tipo} #{res.unidades?.numero}</td>
                <td className="px-8 py-5 uppercase font-medium">{res.clientes?.nombre || 'S/N'}</td>
                <td className="px-8 py-5 text-gray-400 text-xs">{rangoTexto(res)}</td>
                <td className={`px-8 py-5 text-right font-bold ${Number(res.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>${res.saldo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
