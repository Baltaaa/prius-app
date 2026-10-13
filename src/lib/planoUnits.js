// Mapa de unidades con estado derivado para una fecha — misma lógica que ya
// usaba `src/pages/Dashboard.jsx` (el Plano) de forma inline, extraída acá
// (oct 2026) para que el Dashboard real (`pages/crm/Home.jsx`) calcule sus
// KPIs de ocupación con el mismo criterio exacto, sin reinventar la regla ni
// pegarle una query nueva — ambos reciben `reservas`/`unidades` ya traídos
// por `useData()`. No es parte de la geometría del plano (`planoLayout.js`,
// `PlanoGrid.jsx`, `Cell.jsx`): es el cálculo de "qué estado tiene cada
// unidad hoy", que vive naturalmente al lado de `lib/planoStats.js`.
import { STATUS } from "../components/dashboard/constants"
import { coSocios, reservaActiva } from "./reservas"

const PREFIJO = { carpa: "C", sombrilla: "S" }

// Reserva vigente en `selectedDate` por unidad. Un abonado de temporada
// completa cubre cualquier fecha dentro de la temporada, sin importar cuál
// se elija.
export function buildReservaPorUnidad(reservas, selectedDate) {
  const map = {}
  for (const r of reservas) {
    if (!r.unidad_id || !reservaActiva(r)) continue
    const vigente =
      r.tipo_alquiler === "temporada" ||
      (r.tipo_alquiler === "dia" && r.fecha === selectedDate) ||
      (r.tipo_alquiler === "periodo" && r.fecha_inicio <= selectedDate && selectedDate <= r.fecha_fin)
    if (vigente) map[r.unidad_id] = r
  }
  return map
}

/** Mapa `{"C19": {...}}` con status/T-P-D/datos de cliente por unidad, listo
 * para `calcularPlanoStats()` (`lib/planoStats.js`) o para pintar celdas. */
export function buildUnitsMap(unidades, reservas, selectedDate) {
  const reservaPorUnidad = buildReservaPorUnidad(reservas, selectedDate)
  const map = {}
  for (const u of unidades) {
    const px = PREFIJO[u.tipo]
    if (!px) continue
    const r = reservaPorUnidad[u.id]
    const status = !r
      ? STATUS.LIBRE
      : r.estado_pago === "pendiente_confirmacion"
        ? STATUS.PENDIENTE_CONFIRMACION
        : r.tipo_alquiler === "temporada"
          ? STATUS.TEMPORADA
          : r.tipo_alquiler === "dia"
            ? STATUS.DIA
            : STATUS.PERIODO
    map[`${px}${u.numero}`] = {
      id: `${px}${u.numero}`,
      dbId: u.id,
      reservaId: r?.id || null,
      number: u.numero,
      type: u.tipo,
      status,
      tipoAlquiler: r?.tipo_alquiler || null,
      clientName: r?.clientes?.nombre || "",
      clientPhone: r?.clientes?.telefono || "",
      clientEmail: r?.clientes?.mail || "",
      coSocios: r ? coSocios(r).map((c) => c.nombre) : [],
      startDate: r?.fecha_inicio || r?.fecha || "",
      endDate: r?.fecha_fin || r?.fecha || "",
      notes: r?.notas || "",
      isPaid: r?.estado_pago === "pagado",
      isTemporada: r?.tipo_alquiler === "temporada",
      esPreconfirmadaWeb: r?.origen === "web" && r?.preconfirmada === true,
      reserva: r || null,
    }
  }
  return map
}
