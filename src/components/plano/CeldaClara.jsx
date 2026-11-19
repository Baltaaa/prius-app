import { memo } from "react"

// Casilla de la "vista clientes" del Plano (Fase 6A, nov 2026): la que usa la
// landing (beachFlow) en todo el flujo de reserva y la que muestra el modal de
// pantalla completa del CRM. Portable: solo react (ver PORTABILIDAD.md).
//
// estado (la disponibilidad, lo decide quien la usa):
//   "libre"    blanca, seleccionable
//   "ocupada"  negra, no seleccionable (sin titular, saldo ni tipo de alquiler)
//   "elegida"  dorado #F2CA50 sólido (la unidad que el cliente eligió)
//   "sugerida" blanca con borde dorado (propuesta, ej. la vecina para un grupo)
// deshabilitada: el tipo quedó afuera por los chips Todo/Carpas/Sombrillas (atenuada, sin click).
// resaltada: el tipo coincide con el chip elegido (aro dorado, igual que el CRM).
//
// tamano:
//   "compacta" 24×18 / 28×20 con el número afuera, del lado `numberSide` (desktop/tablet)
//   "tactil"   44×36 con el número adentro (mobile)
//
// Colores: en claro, valores fijos (los del CRM en tema claro); las variantes
// `dark:` solo se activan en el CRM (darkMode por clase/atributo) y leen sus
// variables, así el modal del CRM en tema oscuro queda igual que antes.
const COLORES = {
  libre: {
    compacta: "bg-white text-[#999999] border-[#E5E5E5] hover:border-black/30 dark:bg-[rgb(var(--secondary))] dark:text-[rgb(var(--muted-foreground))] dark:border-[rgb(var(--border)_/_var(--border-a))] dark:hover:border-white/30",
    tactil: "bg-white border border-[#E5E5E5] text-black dark:bg-[rgb(var(--card))] dark:border-[rgb(var(--border)_/_var(--border-a))] dark:text-[rgb(var(--primary))]",
  },
  ocupada: {
    compacta: "bg-black text-white border-black dark:bg-[rgb(var(--primary))] dark:text-[rgb(var(--primary-foreground))] dark:border-[rgb(var(--primary))]",
    tactil: "bg-black border border-black text-white dark:bg-[rgb(var(--primary))] dark:border-[rgb(var(--primary))] dark:text-[rgb(var(--primary-foreground))]",
  },
  elegida: {
    compacta: "bg-[#F2CA50] text-black border-[#F2CA50]",
    tactil: "bg-[#F2CA50] border border-[#F2CA50] text-black",
  },
  sugerida: {
    compacta: "bg-white text-black border-[#F2CA50] ring-1 ring-[#F2CA50] dark:bg-[rgb(var(--secondary))]",
    tactil: "bg-white border border-[#F2CA50] ring-1 ring-[#F2CA50] text-black dark:bg-[rgb(var(--card))] dark:text-[rgb(var(--primary))]",
  },
}

const ATENUADA = { compacta: "opacity-20", tactil: "opacity-30" }
const ARO = {
  compacta: "ring-2 ring-[#FDE047] scale-105 z-10 shadow-[0_0_15px_rgba(253,224,71,0.3)]",
  tactil: "ring-2 ring-[#F2CA50] scale-105 z-10",
}

function CeldaClara({
  numero,
  estado = "libre",
  tamano = "compacta",
  numberSide = "left",
  deshabilitada = false,
  resaltada = false,
  onClick,
  etiqueta,
  ...resto // data-* (ej. data-deeplink-id del CRM)
}) {
  const seleccionable = !deshabilitada && estado !== "ocupada" && typeof onClick === "function"
  const colores = (COLORES[estado] || COLORES.libre)[tamano]
  const opacidad = deshabilitada ? ATENUADA[tamano] : "opacity-100"
  const aro = resaltada ? ARO[tamano] : ""
  const elegir = seleccionable ? () => onClick(numero) : undefined

  if (tamano === "tactil") {
    return (
      <button
        type="button"
        onClick={elegir}
        disabled={!seleccionable && typeof onClick === "function"}
        aria-label={etiqueta}
        aria-pressed={estado === "elegida" || undefined}
        className={`relative w-11 h-9 min-w-[44px] min-h-[36px] shrink-0 rounded-[4px] flex items-center justify-center font-semibold text-[13px] tabular-nums transition-colors ${colores} ${opacidad} ${aro}`}
        {...resto}
      >
        <span className="plano-contra">{numero}</span>
      </button>
    )
  }

  const numberLabel = (
    <span
      className={`plano-contra w-7 md:w-8 text-xs md:text-sm font-bold tabular-nums text-black dark:text-[rgb(var(--primary))] ${numberSide === "right" ? "text-left pl-1" : "text-right pr-1"}`}
    >
      {numero}
    </span>
  )

  return (
    <div
      className={`flex items-center relative select-none ${seleccionable ? "cursor-pointer" : ""}`}
      onClick={elegir}
    >
      {numberSide === "left" && numberLabel}
      <button
        type="button"
        tabIndex={seleccionable ? 0 : -1}
        aria-label={etiqueta}
        aria-pressed={estado === "elegida" || undefined}
        className={`w-6 h-[18px] md:w-7 md:h-5 text-[10px] md:text-[11px] font-bold flex flex-col items-center justify-center border rounded-sm transition-colors relative pointer-events-none ${colores} ${opacidad} ${aro}`}
        {...resto}
      >
        <span className="plano-contra leading-none" />
      </button>
      {numberSide === "right" && numberLabel}
    </div>
  )
}

export default memo(CeldaClara)
