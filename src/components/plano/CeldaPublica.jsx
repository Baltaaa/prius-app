import { Lock } from "lucide-react"

// Celda de la landing pública (Fase 4A/4B). Mismo tamaño, forma, tipografía
// y número que Cell.jsx (CRM) — para que el plano se vea idéntico — pero
// SIN colores por tipo_alquiler: la landing no sabe qué tipo de alquiler
// ocupa cada unidad, solo si está libre o bloqueada.
//
// Nota de portabilidad: Cell.jsx (CRM) usa `w-6 h-4.5 md:w-7 md:h-5`
// (24×18 / 28×20px) para que las ~184 celdas entren en pantalla — por
// debajo del mínimo táctil de 44×44 que pide el resto del CRM (ver
// CLAUDE.md "Mobile-first"). Esta celda usa ese mismo tamaño a propósito,
// para verse idéntica a la del CRM — no se infló para cumplir el mínimo,
// tal como ya no lo cumple hoy el Plano del CRM.
//
// estado: "libre" | "bloqueada" | "seleccionada" | "sugerida"
function CeldaPublica({ numero, estado = "libre", onClick, numberSide = "left" }) {
  const isBloqueada = estado === "bloqueada"
  const isSeleccionada = estado === "seleccionada"
  const isSugerida = estado === "sugerida"

  const styles = isBloqueada
    ? "bg-white/5 text-white/20 border-white/10 cursor-not-allowed"
    : isSeleccionada
      ? "bg-[#F2CA50] text-black border-[#F2CA50]"
      : isSugerida
        ? "bg-[#F2CA50]/30 text-white border-[#F2CA50]/50"
        : "bg-white/5 text-white/20 border-white/10 hover:border-white/30 cursor-pointer"

  const numberLabel = (
    <span
      className={`w-5 md:w-6 text-[9px] font-bold text-white/30 ${numberSide === "right" ? "text-left pl-1.5" : "text-right pr-1.5"}`}
    >
      {numero}
    </span>
  )

  return (
    <div className="flex items-center relative">
      {numberSide === "left" && numberLabel}
      <button
        type="button"
        disabled={isBloqueada}
        onClick={() => onClick?.(numero)}
        className={`w-6 h-4.5 md:w-7 md:h-5 text-[9px] font-bold flex items-center justify-center border rounded-sm transition-colors relative ${styles}`}
      >
        {isBloqueada && <Lock size={9} />}
      </button>
      {numberSide === "right" && numberLabel}
    </div>
  )
}

export default CeldaPublica
