// Barra única de cada página (nov 2026). Reemplaza las barras sticky
// apiladas que tenía cada pantalla: ahora hay UN solo contenedor sticky por
// página y esta es su grilla. Slots:
//
//   izquierda     botón circular de 40px (atrás o menú) — solo mobile
//   titulo        título de la sección
//   controlesRef  nodo donde las páginas montan sus controles con
//                 <ToolbarSticky> (una sola fila de 40px, scroll horizontal
//                 con fade en los bordes)
//   acciones      acciones globales (búsqueda, Nueva reserva, campana, avatar)
//
// Desktop (≥768px): UNA sola línea de 64px — título · controles · acciones.
// Nunca pasa a dos líneas.
// Mobile (<768px): fila de 56px (botón circular + título + acciones
// circulares) y, si la página tiene controles, una fila de pills debajo
// DENTRO del mismo contenedor y la misma capa de blur.
//
// La grilla vive en index.css (`.pt-grid`), con `grid-template-areas`
// distintas por breakpoint: así el slot de controles es UN solo nodo del DOM
// que en desktop queda en el medio de la fila y en mobile en su propia fila
// (`.pt-ctrl:empty` lo colapsa cuando la página no tiene controles).
export default function PageTopbar({ izquierda, titulo, controlesRef, acciones }) {
  return (
    <header className="no-print relative pt-grid px-page-max">
      <div className="pt-izq">
        {izquierda}
        {titulo}
      </div>
      <div ref={controlesRef} className="pt-ctrl" />
      <div className="pt-der">{acciones}</div>
    </header>
  )
}

// Botón circular de 40x40 de la barra (atrás, menú y acciones de mobile).
export function BotonCircular({ icono: Icono, etiqueta, onClick, className = '', children, ...resto }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className={`relative shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center text-ink hover:bg-surface transition-colors ${className}`}
      {...resto}
    >
      {Icono ? <Icono size={20} strokeWidth={1.5} /> : null}
      {children}
    </button>
  )
}
