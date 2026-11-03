import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Mail, FileText, Edit2, Trash2, Wallet, CalendarPlus, Copy, Check } from 'lucide-react'
import { formatPesosVisible, formatFecha, formatCUIT, formatDNI, formatTelefono, formatComprobante, formatUnidad, formatNombre} from '../../lib/format'
import { vistaDeGrupo, vistaDeReserva } from '../../lib/reservas'
import { linkToComprobante, linkToRecepcion } from '../../lib/deepLinks'
import { useNuevaReserva } from '../../context/NuevaReservaProvider'
import { isFeatureEnabled } from '../../lib/features'
import { scrollAndHighlight } from '../../lib/highlight'
import StatusBadge from './StatusBadge'
import ReservaPagosCard from './ReservaPagosCard'
import Historial from './Historial'
import ScrollFade from '../ui/ScrollFade'
import UnidadLabel from './UnidadLabel'

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
  showCloseButton = true,
}) {
  const navigate = useNavigate()
  const { abrirNuevaReserva } = useNuevaReserva()
  const [mailCopiado, setMailCopiado] = useState(false)
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

  const copiarMail = async () => {
    try {
      await navigator.clipboard.writeText(cliente.mail)
      setMailCopiado(true)
      setTimeout(() => setMailCopiado(false), 1500)
    } catch {
      // Sin permiso de portapapeles: el mail igual se ve completo en el title.
    }
  }

  // El panel decide su layout por SU ancho (container query), no por el del
  // viewport: Historial al lado solo desde 880px de panel; por debajo va
  // debajo del detalle y todo scrollea junto.
  return (
    <div className="@container flex flex-col flex-1 min-h-0">
      <div className="flex items-start justify-between gap-3 pb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-ink text-on-ink flex items-center justify-center text-body font-semibold shrink-0">
            {cliente.nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
              <span className="text-row text-ink" title={formatNombre(cliente.nombre)}>{formatNombre(cliente.nombre)}</span>
              {badgeStatus && <StatusBadge status={badgeStatus} />}
            </div>
            <p className="text-label text-ink-2 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{cliente.telefono ? formatTelefono(cliente.telefono) : 'Sin teléfono'}</span>
              {unidadesCliente.map((u) => <UnidadLabel key={u.id ?? `${u.tipo}-${u.numero}`} tipo={u.tipo} numero={u.numero} />)}
            </p>
            {comprobanteMatch && (
              <button
                type="button"
                onClick={() => scrollAndHighlight(`pago-${comprobanteMatch.pago.id}`)}
                className="text-label text-ink font-semibold mt-1 hover:underline text-left"
              >
                Comprobante {formatComprobante(comprobanteMatch.comprobante.tipo, comprobanteMatch.comprobante.numero)}
                {formatPesosVisible(comprobanteMatch.pago.monto) ? ` · ${formatPesosVisible(comprobanteMatch.pago.monto)}` : ''}
              </button>
            )}
          </div>
        </div>
        {showCloseButton && (
          <button onClick={onClose} className="btn-icon bg-surface text-ink-2 hover:text-ink shrink-0" title="Cerrar" aria-label="Cerrar">
            <X size={20} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Un solo scroll mientras el panel es angosto; desde 880px cada columna
          scrollea por su cuenta (la cadena min-h-0 llega hasta la card). */}
      <ScrollFade className="flex-1 min-h-0 overflow-y-auto scroll-fino flex flex-col gap-section @[880px]:overflow-hidden @[880px]:grid @[880px]:grid-cols-2 @[880px]:gap-grid">
        <div className="flex flex-col gap-4 @[880px]:min-h-0 @[880px]:overflow-y-auto @[880px]:scroll-fino">
          {/* Saldo + acciones. Si el panel es angosto, el saldo va arriba y las
              acciones en una segunda fila a todo el ancho. */}
          <div className="card-inner flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-label text-ink-2">Saldo</span>
              <p className={`text-row mt-1 ${saldoInfo.sinVerificar && !saldoHeaderSaldado ? 'text-danger-ink' : sinPrecio ? 'text-ink-2' : 'text-ink'}`}>
                {saldoInfo.sinVerificar
                  ? (saldoHeaderSaldado ? '' : 'Saldo sin verificar')
                  : sinPrecio
                    ? 'Sin precio'
                    : (formatPesosVisible(saldoInfo.total) || '')}
              </p>
              {comprobantesPendientesCliente > 0 && (
                <p className="text-label text-danger-ink mt-1">
                  {comprobantesPendientesCliente} comprobante{comprobantesPendientesCliente > 1 ? 's' : ''} sin monto
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full @[480px]:w-auto">
              <button
                onClick={onRegistrarPago}
                disabled={reservasPagables.length === 0}
                className="btn btn-secondary w-full @[480px]:w-auto"
              >
                <Wallet size={16} strokeWidth={1.5} /> Registrar pago
              </button>
              <div className="flex items-center gap-2">
                {isFeatureEnabled('feat-2-acciones-rapidas-contexto') && (
                  <button onClick={() => abrirNuevaReserva({ clienteId: cliente.id })} className="btn-icon bg-card border border-line text-ink-2 shrink-0" title="Nueva reserva" aria-label="Nueva reserva">
                    <CalendarPlus size={16} strokeWidth={1.5} />
                  </button>
                )}
                <button onClick={onEditar} className="btn-icon bg-card border border-line text-ink-2 shrink-0" title="Editar" aria-label="Editar">
                  <Edit2 size={16} strokeWidth={1.5} />
                </button>
                <button onClick={onEliminar} className="btn-icon bg-card border border-line text-danger-ink hover:bg-danger-soft shrink-0" title="Borrar" aria-label="Borrar">
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Datos: la grilla se arma sola según el ancho (160px mínimo por
              dato); el mail se recorta con title y se copia con el botón. */}
          <div className="card-inner grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="text-label text-ink-2 flex items-center gap-1"><Mail size={12} strokeWidth={1.5} /> Email</p>
              {cliente.mail ? (
                <div className="flex items-center gap-1 mt-1 min-w-0">
                  <p className="text-label text-ink truncate min-w-0" title={cliente.mail}>{cliente.mail.toLowerCase()}</p>
                  <button type="button" onClick={copiarMail} className="shrink-0 w-11 h-11 -my-3 md:w-6 md:h-6 md:my-0 flex items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-card" title="Copiar email" aria-label="Copiar email">
                    {mailCopiado ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
                  </button>
                </div>
              ) : (
                <p className="text-label text-ink-2 mt-1 whitespace-nowrap">Sin cargar</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-label text-ink-2 flex items-center gap-1"><FileText size={12} strokeWidth={1.5} /> CUIT</p>
              <p className="text-label text-ink mt-1">{cliente.cuit ? formatCUIT(cliente.cuit) : <span className="text-ink-2 whitespace-nowrap">Sin cargar</span>}</p>
            </div>
            <div className="min-w-0">
              <p className="text-label text-ink-2 flex items-center gap-1"><FileText size={12} strokeWidth={1.5} /> DNI</p>
              <p className="text-label text-ink mt-1">{cliente.dni ? formatDNI(cliente.dni) : <span className="text-ink-2 whitespace-nowrap">Sin cargar</span>}</p>
            </div>
            <div className="min-w-0">
              <p className="text-label text-ink-2">Cliente desde</p>
              <p className="text-label text-ink mt-1">{formatFecha(cliente.created_at)}</p>
            </div>
            {cliente.notas && (
              <div className="col-span-full">
                <p className="text-label text-ink-2">Notas</p>
                <p className="text-label text-ink mt-1">{cliente.notas}</p>
              </div>
            )}
          </div>

          {/* Reservas y pagos: UNA tarjeta por reserva o grupo, de todos los tipos. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-label text-ink-2">Reservas ({vistasReservas.length})</p>
              {reservasSueltas.filter((r) => r.estado !== 'cancelada').length >= 2 && (
                <button onClick={onAgruparReservas} className="text-label text-ink hover:underline">
                  Agrupar reservas
                </button>
              )}
            </div>
            {vistasReservas.length === 0 ? (
              <p className="text-label text-ink-2">Sin reservas.</p>
            ) : (
              <div className="flex flex-col gap-3">
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
              </div>
            )}
          </div>
        </div>

        {/* Historial: al lado desde 880px de panel, debajo si no. */}
        <div className="@[880px]:min-h-0 @[880px]:overflow-y-auto @[880px]:scroll-fino">
          <p className="section-label">Historial</p>
          <Historial tipo="cliente" id={cliente.id} compact />
        </div>
      </ScrollFade>
    </div>
  )
}
