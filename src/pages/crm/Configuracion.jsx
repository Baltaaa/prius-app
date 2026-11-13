import { usePermiso } from '../../context/AuthProvider'
import CategoriasGastoConfig from '../../components/crm/CategoriasGastoConfig'
import NotificacionesConfig from '../../components/crm/NotificacionesConfig'
import { ShieldAlert } from 'lucide-react'

// Configuración del sistema (nov 2026) — solo superadmin.
//
// Acá viven los ajustes que cambian cómo se comporta la app para todos, no
// las preferencias de una cuenta (esas siguen en "Mi cuenta"): las categorías
// de egreso, y los destinatarios y el canal de los avisos de cierre de caja.
export default function Configuracion() {
  const esSuperadmin = usePermiso('categorias_gasto')

  if (!esSuperadmin) {
    return (
      <div className="card-surface card-pad flex items-start gap-3 animate-premium-fade">
        <ShieldAlert size={18} className="text-ink-2 shrink-0 mt-0.5" />
        <div>
          <p className="text-body text-ink">Esta pantalla es solo para el superadmin.</p>
          <p className="text-label text-ink-2 mt-1">Si necesitás cambiar algo de acá, pedíselo a quien administre el sistema.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-grid animate-premium-fade">
      <NotificacionesConfig />
      <CategoriasGastoConfig />
    </div>
  )
}
