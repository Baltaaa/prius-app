import PlanoGrid from "./PlanoGrid"
import PlanoRotable from "./PlanoRotable"

// Cuerpo de la "vista clientes" (Fase 6A, nov 2026): Recreación / Acceso /
// Pileta, las 6 hileras de carpas con sus pasillos, el sector sombrillas y el
// océano, dibujados desde planoLayout.js por PlanoGrid (la geometría vive en
// un solo lugar, acá no se duplica). Portable: ver PORTABILIDAD.md.
//
// `renderCelda(slot)` decide cada casilla (CeldaClara en la landing y en el
// modal del CRM). `rotado`: vista desde la entrada (180°, PlanoRotable); los
// números y rótulos contra-giran y se leen derechos. `mar`: el océano animado
// (MarCliente); en false queda la franja lisa "Océano Atlántico".
export default function PlanoClaro({ unidades, renderCelda, rotado = false, mar = true }) {
  return (
    <PlanoRotable rotado={rotado}>
      <PlanoGrid unidades={unidades} renderCelda={renderCelda} mar={mar} />
    </PlanoRotable>
  )
}
