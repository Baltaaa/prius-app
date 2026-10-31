import { useNavigate } from 'react-router-dom'
import { X, Mail, FileText, Edit2, Trash2, Wallet, CalendarPlus } from 'lucide-react'
import { formatPesosVisible, formatFecha, formatCUIT, formatDNI, formatTelefono, unidadEmoji, formatComprobante, formatUnidad, formatNombre} from '../../lib/format'
import { vistaDeGrupo, vistaDeReserva } from '../../lib/reservas'
import { linkToComprobante, linkToRecepcion } from '../../lib/deepLinks'
import { useNuevaReserva } from '../../context/NuevaReservaProvider'
import { isFeatureEnabled } from '../../lib/features'
import { scrollAndHighlight } from '../../lib/highlight'
import StatusBadge from './StatusBadge'
import ReservaPagosCard from './ReservaPagosCard'
import Historial from './Historial'
import ScrollFade from '../ui/ScrollFade'

const TIPO_LABEL = { temporada: 'Temporada', periodo: 'Período', dia: 'Día' }

// Ficha de cliente — contenido compartido entre el panel lateral fijo de
// desktop (≥1024px, master-detalle) y la pantalla completa de mobile/tablet
// (mismo patrón que ReservaDetalleContent.jsx): una sola fuente de datos y
// handlers, cada contenedor solo cambia cómo la envuelve. Mismos cálculos y
// acciones que ya tenía el acordeón inline de Clientes.jsx, reorganizados en
// cards tipo mock — ninguna lógica de negocio nueva.
export default function ClienteDetalleContent({
  cliente, derivado, reservas, pagosPorReserva, todosPagos, puedeAjustarPrecio,
  onClose, onEditar, onEliminar, onRegistrarPago, onPagoCelda, onDefinirPrecio,
  onEditarPrecio, onAgruparReservas, onLiberarUnidad, onConfirmarTemporada,
  showCloseButton = true, wide = false,
}) {
  const navigate = useNavigate()
  const { abrirNuevaReserva } = useNuevaReserva()
  if (!cliente || !derivado) return null

  const {
    saldoInfo, unidadesCliente, badgeStatus, sinPrecio, saldoHeaderSaldado,
    reservasPagables, reservasSueltas, gruposCliente, comprobantesPendientesCliente,
    comprobanteMatch,
  } = derivado

  // Una vista normalizada por tarjeta: primero los grupos con precio
  // unificado, después las reservas sueltas, y las canceladas al final
  // (atenuadas) para que no empujen lo operativo hacia abajo.
  const vistasReservas = [
    ...Object.entries(gruposCliente).map(([grupoId, reservasGrupo]) =>
      vistaDeGrupo({ grupoId, reservasGrupo, reservas, pagosPorReserva, formatFecha })),
    ...reservasSueltas.map((reserva) => vistaDeReserva({ reserva, pagosPorReserva, formatFecha })),
  ].sort((a, b) => Number(a.cancelada) - Number(b.cancelada))

  return (
    <>
      <div className="flex items-start justify-between pb-space-md shrink-0">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center text-title-md font-semibold shrink-0">
            {cliente.nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-headline-sm text-black truncate">{formatNombre(cliente.nombre)}</span>
              {badgeStatus && <StatusBadge status={badgeStatus} />}
            </div>
            <p className="text-body-sm text-prius-slate mt-1 truncate">
              {cliente.telefono ? formatTelefono(cliente.telefono) : <span className="text-prius-muted">Sin teléfono</span>}
              {unidadesCliente.length > 0 && (
                <> · {unidadesCliente.map((u) => `${unidadEmoji(u.tipo)} ${formatUnidad(u.tipo, u.numero)}`).join(', ')}</>
              )}
            </p>
            {comprobanteMatch && (
              <button
                type="button"
                onClick={() => scrollAndHighlight(`pago-${comprobanteMatch.pago.id}`)}
                className="text-label-md text-gold font-bold mt-1 hover:underline truncate block text-left"
              >
                Comprobante {formatComprobante(comprobanteMatch.comprobante.tipo, comprobanteMatch.comprobante.numero)}
                {formatPesosVisible(comprobanteMatch.pago.monto) ? ` · ${formatPesosVisible(comprobanteMatch.pago.monto)}` : ''}
              </button>
            )}
          </div>
        </div>
        {showCloseButton && (
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-prius-surface text-prius-slate hover:text-black flex items-center justify-center transition-colors shrink-0" title="Cerrar">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Scroll (31/10/2026): en desktop (`wide`) la ficha NO scrollea como un
          todo. La columna izquierda queda fija y la ÚNICA zona scrolleable es
          la lista del Historial, a la derecha. Por debajo de `lg` sigue
          scrolleando entera, como siempre. */}
      <div className={`flex-1 min-h-0 ${wide ? 'lg:grid lg:grid-cols-2 lg:gap-space-md lg:items-stretch lg:overflow-hidden overflow-y-auto space-y-space-md lg:space-y-0' : 'overflow-y-auto space-y-space-md'}`}>
      <div className="cq space-y-2.5 lg:flex lg:flex-col lg:min-h-0 lg:h-full lg:space-y-0 lg:gap-2.5">
        {/* Saldo + acciones rápidas */}
        <div className="bg-prius-surface rounded-xl px-3 py-2.5 flex items-center justify-between gap-space-sm flex-wrap">
          <div>
            <span className="text-label-md text-prius-slate uppercase tracking-wider">Saldo</span>
            <p className={`text-headline-sm mt-0.5 ${saldoInfo.sinVerificar && !saldoHeaderSaldado ? 'text-prius-error' : sinPrecio ? 'text-prius-slate' : 'text-black'}`}>
              {saldoInfo.sinVerificar
                ? (saldoHeaderSaldado ? '' : 'Saldo sin verificar')
                : sinPrecio
                  ? 'Sin precio'
                  : (formatPesosVisible(saldoInfo.total) || '')}
            </p>
            {comprobantesPendientesCliente > 0 && (
              <p className="text-label-md text-prius-error mt-0.5">
                {comprobantesPendientesCliente} comprobante{comprobantesPendientesCliente > 1 ? 's' : ''} sin monto
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRegistrarPago}
              disabled={reservasPagables.length === 0}
              className="px-4 py-2.5 min-h-[44px] bg-gold hover:bg-gold-hover disabled:opacity-30 disabled:cursor-not-allowed text-black rounded-xl flex items-center gap-2 font-semibold text-[13px] sm:text-sm transition-all"
            >
              <Wallet size={16} /> Registrar pago
            </button>
            {isFeatureEnabled('feat-2-acciones-rapidas-contexto') && (
              <button
                onClick={() => abrirNuevaReserva({ clienteId: cliente.id })}
                className="w-11 h-11 flex items-center justify-center bg-white border border-hairline hover:bg-prius-surface rounded-xl text-prius-slate transition-all"
                title="Nueva reserva"
              >
                <CalendarPlus size={16} />
              </button>
            )}
            <button onClick={onEditar} className="w-11 h-11 flex items-center justify-center bg-white border border-hairline hover:bg-prius-surface rounded-xl text-prius-slate transition-all" title="Editar">
              <Edit2 size={16} />
            </button>
            <button onClick={onEliminar} className="w-11 h-11 flex items-center justify-center bg-white border border-hairline hover:bg-red-50 rounded-xl text-prius-error transition-all" title="Borrar">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Datos del cliente. grid-cols-2 fijo (nunca md:grid-cols-4, oct
            2026): este panel vive adentro de un contenedor angosto (aside
            fijo, bottom sheet, pantalla completa) que casi nunca llega al
            ancho real del viewport — un breakpoint de Tailwind responde al
            viewport, no al contenedor, así que md:grid-cols-4 metía 4
            columnas en ~365px reales (aside del breakpoint lg más angosto)
            y el email terminaba partido letra por letra por el break-all. */}
        {/* 31/10/2026: una fila de 4 datos en vez de grid 2x2 con padding
            grande — la columna izquierda tiene que entrar entera en
            1366x768 y este bloque se llevaba 172px para 4 campos cortos. */}
        {/* 31/10/2026 bis: las 4 columnas se piden con container query (`cq-cols-4`,
            ver index.css), no con `sm:` — a 1366x768 esta columna mide ~300px
            reales y un breakpoint de viewport volvía a pisar los campos. */}
        <div className="bg-prius-surface rounded-xl px-3 py-2.5 grid grid-cols-2 cq-cols-4 gap-x-3 gap-y-2">
          <div className="col-span-2 cq-span-1 min-w-0">
            <p className="text-label-md text-prius-slate uppercase tracking-wider flex items-center gap-1"><Mail size={11} /> Email</p>
            <p className="text-body-sm text-black mt-1 lowercase break-all">{cliente.mail || <span className="text-prius-muted normal-case whitespace-nowrap">Sin cargar</span>}</p>
          </div>
          <div>
            <p className="text-label-md text-prius-slate uppercase tracking-wider flex items-center gap-1"><FileText size={11} /> CUIT</p>
            <p className="text-body-sm text-black mt-1">{cliente.cuit ? formatCUIT(cliente.cuit) : <span className="text-prius-muted whitespace-nowrap">Sin cargar</span>}</p>
          </div>
          <div>
            <p className="text-label-md text-prius-slate uppercase tracking-wider flex items-center gap-1"><FileText size={11} /> DNI</p>
            <p className="text-body-sm text-black mt-1">{cliente.dni ? formatDNI(cliente.dni) : <span className="text-prius-muted whitespace-nowrap">Sin cargar</span>}</p>
          </div>
          <div>
            <p className="text-label-md text-prius-slate uppercase tracking-wider">Cliente desde</p>
            <p className="text-body-sm text-black mt-1">{formatFecha(cliente.created_at)}</p>
          </div>
          {cliente.notas && (
            <div className="col-span-2">
              <p className="text-label-md text-prius-slate uppercase tracking-wider">Notas</p>
              <p className="text-body-sm text-prius-slate mt-1">{cliente.notas}</p>
            </div>
          )}
        </div>

        {/* Reservas y pagos — UNA sola tarjeta para todo (31/10/2026):
            grupo con precio unificado, temporada, período y día. Antes había
            dos diseños distintos (la tarjeta rica solo para grupos, una pobre
            para las sueltas) más la grilla ReservaPagosCard en la otra columna. */}
        {/* La lista de reservas se queda con el alto sobrante y scrollea por
            dentro (31/10/2026). Así la columna izquierda entra SIEMPRE en el
            viewport, sin importar cuántas reservas tenga el cliente, y la
            ficha nunca scrollea como un todo. */}
        <div className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <p className="text-label-md text-prius-slate uppercase tracking-wider">
              Reservas ({vistasReservas.length})
            </p>
            {reservasSueltas.filter((r) => r.estado !== 'cancelada').length >= 2 && (
              <button onClick={onAgruparReservas} className="text-label-md font-bold uppercase tracking-wider text-gold hover:text-gold-hover transition-all">
                Agrupar reservas
              </button>
            )}
          </div>
          {vistasReservas.length === 0 ? (
            <p className="text-xs text-prius-muted uppercase tracking-wider">Sin reservas.</p>
          ) : (
            <ScrollFade className="space-y-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
              {vistasReservas.map((vista) => (
                <ReservaPagosCard
                  key={vista.key}
                  vista={vista}
                  cliente={cliente}
                  onPagoCelda={onPagoCelda}
                  onCargarMonto={onPagoCelda}
                  onLiberarUnidad={onLiberarUnidad}
                  onConfirmarTemporada={onConfirmarTemporada}
                  onDefinirPrecio={onDefinirPrecio}
                  onEditarPrecio={puedeAjustarPrecio ? onEditarPrecio : undefined}
                  onIrAComprobante={(r) => navigate(linkToComprobante(r.id))}
                  onCheckin={(r) => navigate(linkToRecepcion(r.codigo))}
                />
              ))}
            </ScrollFade>
          )}
        </div>
      </div>

      {/* Columna derecha: SOLO Historial, y es lo único que scrollea. */}
      <div className={wide ? 'lg:flex lg:flex-col lg:min-h-0 lg:h-full' : ''}>
        <p className="text-label-md text-prius-slate uppercase tracking-wider mb-2 shrink-0">Historial</p>
        <ScrollFade className={wide ? 'lg:flex-1 lg:min-h-0 lg:overflow-y-auto' : ''}>
          <Historial tipo="cliente" id={cliente.id} compact />
        </ScrollFade>
      </div>
      </div>
    </>
  )
}
