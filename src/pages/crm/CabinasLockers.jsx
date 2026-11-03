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
        <span className="text-label text-ink-2 animate-pulse">Cargando...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-premium-fade">
      {/* Aviso de sección en desarrollo */}
      <div className="card-surface card-pad border-gold-300 bg-gold-100 flex items-start gap-3">
        <div className="w-10 h-10 rounded-inner bg-gold-100 border border-gold-300 flex items-center justify-center shrink-0">
          <Construction size={18} className="text-ink" />
        </div>
        <p className="text-body text-ink-2 font-medium leading-snug">
          Sección en desarrollo — próximamente vas a poder administrar cabinas y lockers desde acá.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-grid">
        {[
          { label: 'Cabinas', value: resumen.cabinas.total, icon: DoorClosed },
          { label: 'Lockers', value: resumen.lockers.total, icon: Lock },
          { label: 'Ocupados', value: resumen.cabinas.ocupadas + resumen.lockers.ocupadas, icon: Wallet },
          { label: 'Libres', value: resumen.cabinas.libres + resumen.lockers.libres, icon: UserPlus },
        ].map((kpi) => (
          <div key={kpi.label} className="card-surface card-pad min-w-0">
            <div className="w-9 h-9 rounded-icon bg-surface border border-line flex items-center justify-center mb-3">
              <kpi.icon size={16} className="text-ink-2" />
            </div>
            <p className="text-stat text-ink">{kpi.value}</p>
            <p className="text-label text-ink-2 mt-1 truncate">{kpi.label}</p>
          </div>
        ))}
      </div>

      {esEjemplo && (
        <p className="text-label text-ink-2">
          Todavía no hay cabinas ni lockers cargados — se muestran tarjetas de ejemplo.
        </p>
      )}

      {/* Grilla de unidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-grid">
        {items.map((item) => (
          <div key={item.id} className="card-surface card-pad space-y-3 relative">
            {esEjemplo && (
              <span className="text-label absolute top-3 right-3 text-ink-2 border border-line rounded-swatch px-2 py-1">
                Ejemplo
              </span>
            )}
            <div className="flex items-center gap-2">
              {item.tipo === 'cabina' ? <DoorClosed size={16} className="text-ink-2" /> : <Lock size={16} className="text-ink-2" />}
              <p className="text-label text-ink">{TIPO_LABEL[item.tipo]} {item.numero}</p>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-swatch text-label font-semibold border ${
              item.estado === 'libre'
                ? 'bg-success-soft text-success-ink border-success/30'
                : 'bg-gold-100 text-ink border-gold-300'
            }`}>
              {ESTADO_LABEL[item.estado]}
            </span>
            <p className="text-label text-ink-2">
              {item.titular ? <span className="text-ink-2 font-semibold">{item.titular}</span> : <span className="text-ink-2">Sin titular</span>}
            </p>
            <div className="flex gap-2 pt-1">
              <button disabled title="Asignar — próximamente" className="text-label flex-1 py-3 min-h-[44px] bg-surface border border-line rounded-full text-ink-2 cursor-not-allowed">
                Próximamente
              </button>
              <button disabled title="Registrar pago — próximamente" className="text-label flex-1 py-3 min-h-[44px] bg-surface border border-line rounded-full text-ink-2 cursor-not-allowed">
                Próximamente
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
