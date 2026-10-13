import NotificacionesBandeja from '../../components/crm/NotificacionesBandeja'

// Centro de notificaciones completo — mismo contenido que el panel de la
// campana (NotificacionesBandeja), sin chrome de popover: ocupa toda la
// pantalla. Accesible desde Sidebar/BottomNav ("Más") y desde "Ver todas"
// si se agrega en el futuro.
export default function Notificaciones() {
  return (
    <div className="glass-card rounded-3xl overflow-hidden" style={{ height: 'calc(100dvh - 11rem)', minHeight: 420 }}>
      <NotificacionesBandeja />
    </div>
  )
}
