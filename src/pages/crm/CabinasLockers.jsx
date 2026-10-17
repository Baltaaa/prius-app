import { useMemo } from 'react'
import { useData } from '../../context/DataProvider'
import { Construction, DoorClosed, Lock, Wallet, UserPlus } from 'lucide-react'

// Maqueta en desarrollo (sep 2026): todavía no hay unidades tipo cabina/locker
// cargadas en la base (auditado — 0 registros), así que esta página muestra
// datos reales cuando existan y cae a tarjetas de EJEMPLO, marcadas
// visualmente como tales, cuando no. Es de solo lectura: no crea, edita ni
// borra nada — ver CLAUDE.md "Cabinas y Lockers (en desarrollo)".
const EJEMPLOS = [
  { id: 'ej-1', tipo: 'cabina', numero: 1, estado: 'ocupada', titular: 'Familia Rodríguez' },
  { id: 'ej-2', tipo: 'cabina', numero: 2, estado: 'libre', titular: null },
  { id: 'ej-3', tipo: 'locker', numero: 1, estado: 'ocupada', titular: 'Martín Sosa' },
  { id: 'ej-4', tipo: 'locker', numero: 2, estado: 'libre', titular: null },
]

const ESTADO_LABEL = { libre: 'Libre', ocupada: 'Ocupada' }
const TIPO_LABEL = { cabina: 'Cabina', locker: 'Locker' }

export default function CabinasLockers() {
  const { unidades, loading } = useData()

  const unidadesReales = useMemo(
    () => unidades.filter((u) => u.tipo === 'cabina' || u.tipo === 'locker'),
    [unidades],
  )
  const esEjemplo = unidadesReales.length === 0
  const items = esEjemplo ? EJEMPLOS : unidadesReales.map((u) => ({
    id: u.id,
    tipo: u.tipo,
    numero: u.numero,
    estado: u.estado === 'libre' ? 'libre' : 'ocupada',
    titular: null, // solo lectura de unidades — sin reserva embebida acá todavía
  }))

  const resumen = useMemo(() => {
    const cabinas = items.filter((i) => i.tipo === 'cabina')
    const lockers = items.filter((i) => i.tipo === 'locker')
    const ocupadas = (list) => list.filter((i) => i.estado === 'ocupada').length
    return {
      cabinas: { total: cabinas.length, ocupadas: ocupadas(cabinas), libres: cabinas.length - ocupadas(cabinas) },
      lockers: { total: lockers.length, ocupadas: ocupadas(lockers), libres: lockers.length - ocupadas(lockers) },
    }
  }, [items])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-prius-muted animate-pulse uppercase tracking-widest">Cargando...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-premium-fade">
      {/* Aviso de sección en desarrollo */}
      <div className="card-light border border-gold/30 bg-gold/5 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
          <Construction size={18} className="text-gold" />
        </div>
        <p className="text-sm text-prius-slate font-medium leading-snug">
          Sección en desarrollo — próximamente vas a poder administrar cabinas y lockers desde acá.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Cabinas', value: resumen.cabinas.total, icon: DoorClosed },
          { label: 'Lockers', value: resumen.lockers.total, icon: Lock },
          { label: 'Ocupados', value: resumen.cabinas.ocupadas + resumen.lockers.ocupadas, icon: Wallet },
          { label: 'Libres', value: resumen.cabinas.libres + resumen.lockers.libres, icon: UserPlus },
        ].map((kpi) => (
          <div key={kpi.label} className="card-light p-4 sm:p-5 rounded-2xl min-w-0">
            <div className="w-9 h-9 rounded-lg bg-prius-subtle border border-hairline flex items-center justify-center mb-3">
              <kpi.icon size={16} className="text-prius-slate" />
            </div>
            <p className="text-2xl font-black text-black">{kpi.value}</p>
            <p className="text-[10px] text-prius-muted font-bold uppercase tracking-widest mt-1 truncate">{kpi.label}</p>
          </div>
        ))}
      </div>

      {esEjemplo && (
        <p className="text-[10px] text-prius-muted uppercase tracking-widest font-bold">
          Todavía no hay cabinas ni lockers cargados — se muestran tarjetas de ejemplo.
        </p>
      )}

      {/* Grilla de unidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((item) => (
          <div key={item.id} className="card-light rounded-2xl p-4 space-y-3 relative">
            {esEjemplo && (
              <span className="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-widest text-prius-muted border border-hairline rounded px-1.5 py-0.5">
                Ejemplo
              </span>
            )}
            <div className="flex items-center gap-2">
              {item.tipo === 'cabina' ? <DoorClosed size={16} className="text-prius-slate" /> : <Lock size={16} className="text-prius-slate" />}
              <p className="font-bold text-black uppercase text-sm">{TIPO_LABEL[item.tipo]} #{item.numero}</p>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
              item.estado === 'libre'
                ? 'bg-green-500/10 text-prius-success border-green-500/20'
                : 'bg-gold/10 text-gold border-gold/20'
            }`}>
              {ESTADO_LABEL[item.estado]}
            </span>
            <p className="text-xs text-prius-slate">
              {item.titular ? <span className="text-prius-slate font-bold uppercase">{item.titular}</span> : <span className="text-prius-muted">Sin titular</span>}
            </p>
            <div className="flex gap-2 pt-1">
              <button disabled title="Asignar — próximamente" className="flex-1 py-2.5 min-h-[44px] bg-prius-subtle border border-hairline rounded-xl text-[9px] font-bold uppercase tracking-widest text-prius-muted cursor-not-allowed">
                Próximamente
              </button>
              <button disabled title="Registrar pago — próximamente" className="flex-1 py-2.5 min-h-[44px] bg-prius-subtle border border-hairline rounded-xl text-[9px] font-bold uppercase tracking-widest text-prius-muted cursor-not-allowed">
                Próximamente
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
