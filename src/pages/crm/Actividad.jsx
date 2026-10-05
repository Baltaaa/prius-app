import Historial from '../../components/crm/Historial'

// Línea de tiempo del CRM — ahora es el mismo componente Historial que usan
// la ficha de cliente, el detalle de reserva y el modal de unidad del
// Plano (ítem 2, oct 2026: unifica lo que antes eran dos secciones
// distintas con lógica de filtrado duplicada). Acá en modo 'global', sin
// acotar a ninguna entidad.
export default function Actividad() {
  return (
    <div className="animate-premium-fade">
      <Historial tipo="global" />
    </div>
  )
}
