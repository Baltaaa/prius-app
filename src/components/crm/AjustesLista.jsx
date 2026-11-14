import { ChevronRight } from 'lucide-react'

// Primitivas de la pantalla de Configuración (nov 2026): listas agrupadas
// estilo ajustes de app nativa (iOS / Mercado Pago).
//
// - GrupoAjustes: título chico en mayúscula + una card redondeada con las
//   filas adentro, separadas por una línea.
// - FilaAjuste: 56px de alto, ícono en cuadrado redondeado, label, valor o
//   descripción secundaria, y chevron si lleva a una subpantalla.
//
// Nada de esto decide qué se muestra: eso vive en Configuracion.jsx, que
// arma las secciones con las funciones y datos que ya existen.

export function GrupoAjustes({ titulo, children, className = '' }) {
  return (
    <section className={className}>
      {titulo && <h2 className="section-label-grupo">{titulo}</h2>}
      <div className="card-surface overflow-hidden divide-y divide-divider">{children}</div>
    </section>
  )
}

function Cuerpo({ icono: Icono, label, valor, descripcion }) {
  return (
    <>
      {Icono && (
        <span className="shrink-0 w-9 h-9 rounded-icon bg-surface text-ink flex items-center justify-center">
          <Icono size={16} strokeWidth={1.5} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-body text-ink truncate">{label}</span>
        {descripcion && <span className="block text-label text-ink-2 truncate">{descripcion}</span>}
      </span>
      {valor != null && valor !== '' && (
        <span className="shrink-0 text-label text-ink-2 tabular-nums max-w-[45%] truncate" title={typeof valor === 'string' ? valor : undefined}>
          {valor}
        </span>
      )}
    </>
  )
}

// `onClick` -> fila que abre su subpantalla (con chevron).
// Sin `onClick` -> fila de solo lectura.
export function FilaAjuste({ icono, label, valor, descripcion, onClick, tono = 'normal' }) {
  const color = tono === 'peligro' ? 'text-danger' : 'text-ink'
  const contenido = <Cuerpo icono={icono} label={label} valor={valor} descripcion={descripcion} />
  const clases = `w-full min-h-14 px-card py-2 flex items-center gap-3 ${color}`
  if (!onClick) {
    return <div className={clases}><Cuerpo icono={icono} label={label} valor={valor} descripcion={descripcion} /></div>
  }
  return (
    <button type="button" onClick={onClick} className={`${clases} hover:bg-row-hover transition-colors`}>
      {contenido}
      <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-2" />
    </button>
  )
}
