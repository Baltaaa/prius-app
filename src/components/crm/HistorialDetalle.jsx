import { X, ArrowRight } from 'lucide-react'
import { formatHora, formatFechaLarga } from '../../lib/format'

// Detalle de un evento del Historial (nov 2026, Bloque 3 del rebranding
// Stitch, fuente design/stitch/07_historial_desktop.png).
//
// El mismo contenido se monta de dos formas: bottom sheet en mobile (lo
// hace Historial.jsx con <BottomSheet>, que ya va en portal a document.body)
// y panel fijo a la derecha en desktop. Por eso acá adentro no hay nada de
// posicionamiento: solo el contenido.
//
// Diferencia contra el mock, a propósito: el mock dibuja SIEMPRE un bloque
// "Detalle de cambios (antes vs después)" con tres atributos. En la tabla
// `eventos` el par before/after solo existe para los UPDATE (reserva
// editada, pago editado, caja editada, comprobante editado, unidad…); los
// INSERT y los eventos de auth no lo tienen. Cuando no hay, se muestra el
// aviso de que ese evento no registró cambios campo por campo en vez de
// inventar valores.

function Campo({ label, children }) {
  return (
    <div>
      <p className="text-label text-ink-2">{label}</p>
      <div className="text-body text-ink mt-1">{children}</div>
    </div>
  )
}

export default function HistorialDetalle({ evento, meta, cambios, datos, onCerrar, onIr, enSheet = false }) {
  if (!evento) return null
  const Icon = meta.icon
  const referencias = [
    datos.cliente && { label: 'Cliente', valor: datos.cliente },
    datos.unidad && { label: 'Unidad', valor: datos.unidad },
    datos.comprobante && { label: 'Comprobante', valor: datos.comprobante },
    datos.monto && { label: 'Monto', valor: datos.monto },
  ].filter(Boolean)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <span className={`text-label inline-flex items-center gap-2 px-2 py-1 rounded-full ${meta.tile}`}>
            <Icon size={11} /> {meta.label}
          </span>
          <h3 className="text-body text-ink mt-2 break-words">{meta.titulo}</h3>
          <p className="text-label text-ink-2 mt-1">
            {formatFechaLarga(evento.fecha_ref)} · {formatHora(evento.ts)} hs
          </p>
        </div>
        {!enSheet && (
          <button
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-ink-2 hover:bg-surface anim-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 space-y-4">
        {/* Quién lo hizo */}
        <div className="bg-surface rounded-inner p-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-ink text-on-ink text-label font-semibold flex items-center justify-center shrink-0">
            {(evento.actor_nombre || 'S').slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink truncate">{evento.actor_nombre || 'Sistema'}</p>
            <p className="text-label text-ink-2">{evento.tabla}</p>
          </div>
        </div>

        {/* Antes vs después */}
        <div>
          <p className="text-label text-ink-2 mb-2">
            Detalle de cambios {cambios.length > 0 && <span className="text-ink-2">· {cambios.length}</span>}
          </p>
          {cambios.length === 0 ? (
            <p className="text-label text-ink-2 bg-surface rounded-inner p-3">
              Este evento no registró cambios campo por campo.
            </p>
          ) : (
            <div className="space-y-2">
              {cambios.map((c) => (
                <div key={c.label} className="bg-surface rounded-inner p-3">
                  <p className="text-label text-ink-2">{c.label}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-label text-ink-2 line-through break-all">{c.antes}</span>
                    <ArrowRight size={12} className="text-ink-2 shrink-0" />
                    <span className="text-body font-semibold text-ink bg-gold-100 rounded-icon px-2 py-1 break-all">
                      {c.despues}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referencias — solo las que el evento realmente trae */}
        {referencias.length > 0 && (
          <div>
            <p className="text-label text-ink-2 mb-2">Referencias</p>
            <div className="grid grid-cols-2 gap-2">
              {referencias.map((r) => (
                <div key={r.label} className="bg-surface rounded-inner p-3 min-w-0">
                  <Campo label={r.label}><span className="break-words font-semibold">{r.valor}</span></Campo>
                </div>
              ))}
            </div>
          </div>
        )}

        {meta.descripcion && (
          <div>
            <p className="text-label text-ink-2 mb-2">Descripción</p>
            <p className="text-body text-ink break-words">{meta.descripcion}</p>
          </div>
        )}
      </div>

      {/* Acción: es exactamente la navegación que antes hacía el click en la
          fila (handleClick de Historial.jsx) — no se agregó ni se cambió
          ningún handler, solo pasó a estar un paso más adentro. */}
      {onIr && (
        <div className="shrink-0 pt-3">
          <button
            onClick={onIr}
            className="w-full h-12 rounded-full bg-card border border-line hover:bg-surface font-semibold text-body flex items-center justify-center gap-2 anim-press anim-colors text-ink"
          >
            {meta.accionLabel}
          </button>
        </div>
      )}
    </div>
  )
}
