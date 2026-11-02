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
        <span className="text-body font-semibold text-ink-2 animate-pulse uppercase tracking-widest">Cargando...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-premium-fade">
      {/* Aviso de sección en desarrollo */}
      <div className="card-light border border-gold-300 bg-gold-100 rounded-card p-4 sm:p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-inner bg-gold-100 border border-gold-300 flex items-center justify-center shrink-0">
          <Construction size={18} className="text-ink" />
        </div>
        <p className="text-body text-ink-2 font-medium leading-snug">
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
          <div key={kpi.label} className="card-light p-4 sm:p-5 rounded-card min-w-0">
            <div className="w-9 h-9 rounded-icon bg-surface border border-line flex items-center justify-center mb-3">
              <kpi.icon size={16} className="text-ink-2" />
            </div>
            <p className="text-2xl font-black text-ink">{kpi.value}</p>
            <p className="text-[10px] text-ink-2 font-bold uppercase tracking-widest mt-1 truncate">{kpi.label}</p>
          </div>
        ))}
      </div>

      {esEjemplo && (
        <p className="text-[10px] text-ink-2 uppercase tracking-widest font-bold">
          Todavía no hay cabinas ni lockers cargados — se muestran tarjetas de ejemplo.
        </p>
      )}

      {/* Grilla de unidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((item) => (
          <div key={item.id} className="card-light rounded-card p-4 space-y-3 relative">
            {esEjemplo && (
              <span className="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-widest text-ink-2 border border-line rounded-swatch px-1.5 py-0.5">
                Ejemplo
              </span>
            )}
            <div className="flex items-center gap-2">
              {item.tipo === 'cabina' ? <DoorClosed size={16} className="text-ink-2" /> : <Lock size={16} className="text-ink-2" />}
              <p className="font-bold text-ink uppercase text-body">{TIPO_LABEL[item.tipo]} {item.numero}</p>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-swatch text-[10px] font-bold tracking-wider uppercase border ${
              item.estado === 'libre'
                ? 'bg-success-soft text-success-ink border-success/30'
                : 'bg-gold-100 text-ink border-gold-300'
            }`}>
              {ESTADO_LABEL[item.estado]}
            </span>
            <p className="text-xs text-ink-2">
              {item.titular ? <span className="text-ink-2 font-bold uppercase">{item.titular}</span> : <span className="text-ink-2">Sin titular</span>}
            </p>
            <div className="flex gap-2 pt-1">
              <button disabled title="Asignar — próximamente" className="flex-1 py-2.5 min-h-[44px] bg-surface border border-line rounded-inner text-[9px] font-bold uppercase tracking-widest text-ink-2 cursor-not-allowed">
                Próximamente
              </button>
              <button disabled title="Registrar pago — próximamente" className="flex-1 py-2.5 min-h-[44px] bg-surface border border-line rounded-inner text-[9px] font-bold uppercase tracking-widest text-ink-2 cursor-not-allowed">
                Próximamente
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
