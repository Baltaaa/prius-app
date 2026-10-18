import { useNavigate } from 'react-router-dom'
import { X, Mail, FileText, Edit2, Trash2, Wallet, CalendarPlus, Receipt, Users } from 'lucide-react'
import { formatPesosVisible, formatFecha, formatCUIT, formatDNI, formatTelefono, unidadEmoji, formatComprobante } from '../../lib/format'
import { coSocios, esPendienteConfirmacion, estadoBadgeStatus, saldoGrupo, estadoPagoGrupo } from '../../lib/reservas'
import { linkToComprobante, linkToRecepcion, linkToNuevaReservaCliente } from '../../lib/deepLinks'
import { isFeatureEnabled } from '../../lib/features'
import { scrollAndHighlight } from '../../lib/highlight'
import StatusBadge from './StatusBadge'
import PagosGrid from './PagosGrid'
import Historial from './Historial'

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
  showCloseButton = true,
}) {
  const navigate = useNavigate()
  if (!cliente || !derivado) return null

  const {
    saldoInfo, unidadesCliente, badgeStatus, sinPrecio, saldoHeaderSaldado,
    reservasPagables, reservasSueltas, gruposCliente, comprobantesPendientesCliente,
    comprobanteMatch,
  } = derivado

  return (
    <>
      <div className="flex items-start justify-between pb-space-md shrink-0">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center text-title-md font-semibold shrink-0">
            {cliente.nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-headline-sm text-black truncate">{cliente.nombre}</span>
              {badgeStatus && <StatusBadge status={badgeStatus} />}
            </div>
            <p className="text-body-sm text-prius-slate mt-1 truncate">
              {cliente.telefono ? formatTelefono(cliente.telefono) : <span className="text-prius-muted">Sin teléfono</span>}
              {unidadesCliente.length > 0 && (
                <> · {unidadesCliente.map((u) => `${unidadEmoji(u.tipo)} ${u.tipo} #${u.numero}`).join(', ')}</>
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

      <div className="flex-1 overflow-y-auto space-y-space-md">
        {/* Saldo + acciones rápidas */}
        <div className="bg-prius-surface rounded-xl p-space-md flex items-center justify-between gap-space-sm flex-wrap">
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
              className="px-4 py-2.5 min-h-[44px] bg-gold hover:bg-gold-hover disabled:opacity-30 disabled:cursor-not-allowed text-black rounded-xl flex items-center gap-2 font-bold uppercase text-label-md transition-all"
            >
              <Wallet size={16} /> Registrar pago
            </button>
            {isFeatureEnabled('feat-2-acciones-rapidas-contexto') && (
              <button
                onClick={() => navigate(linkToNuevaReservaCliente(cliente.id))}
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

        {/* Datos del cliente */}
        <div className="bg-prius-surface rounded-xl p-space-md grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-1">
            <p className="text-label-md text-prius-slate uppercase tracking-wider flex items-center gap-1"><Mail size={11} /> Email</p>
            <p className="text-body-sm text-black mt-1 lowercase break-all">{cliente.mail || <span className="text-prius-muted normal-case">Sin cargar</span>}</p>
          </div>
          <div>
            <p className="text-label-md text-prius-slate uppercase tracking-wider flex items-center gap-1"><FileText size={11} /> CUIT</p>
            <p className="text-body-sm text-black mt-1">{cliente.cuit ? formatCUIT(cliente.cuit) : <span className="text-prius-muted">Sin cargar</span>}</p>
          </div>
          <div>
            <p className="text-label-md text-prius-slate uppercase tracking-wider flex items-center gap-1"><FileText size={11} /> DNI</p>
            <p className="text-body-sm text-black mt-1">{cliente.dni ? formatDNI(cliente.dni) : <span className="text-prius-muted">Sin cargar</span>}</p>
          </div>
          <div>
            <p className="text-label-md text-prius-slate uppercase tracking-wider">Cliente desde</p>
            <p className="text-body-sm text-black mt-1">{formatFecha(cliente.created_at)}</p>
          </div>
          {cliente.notas && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-label-md text-prius-slate uppercase tracking-wider">Notas</p>
              <p className="text-body-sm text-prius-slate mt-1">{cliente.notas}</p>
            </div>
          )}
        </div>

        {/* Grupos con precio unificado */}
        {Object.entries(gruposCliente).map(([grupoId, reservasGrupo]) => {
          const grupo = reservasGrupo[0].reserva_grupos
          const saldo = saldoGrupo(reservasGrupo[0], reservas, pagosPorReserva)
          const estado = estadoPagoGrupo(saldo, grupo)
          const pagoGrupo = reservasGrupo.flatMap((r) => (pagosPorReserva[r.id] || []).map((p) => ({ ...p, __reserva: r })))
            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
          const pagado = Math.max(Number(grupo.precio_total || 0) - (saldo ?? 0), 0)
          const primeraReservaActiva = reservasGrupo.find((r) => r.estado !== 'cancelada') || reservasGrupo[0]
          return (
            <div key={grupoId} className="bg-white border border-hairline rounded-xl p-space-md space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-label-md text-gold uppercase tracking-wider font-bold">
                  Reserva con precio unificado{grupo.temporada ? ` · ${grupo.temporada}` : ''}
                </p>
                {estado && <StatusBadge status={estado} />}
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-label-md text-prius-slate uppercase tracking-wider">Precio total</p>
                  <p className="text-body-md font-bold text-black mt-1">{formatPesosVisible(grupo.precio_total)}</p>
                </div>
                <div>
                  <p className="text-label-md text-prius-slate uppercase tracking-wider">Pagado</p>
                  <p className="text-body-md font-bold text-prius-success mt-1">{formatPesosVisible(pagado)}</p>
                </div>
                <div>
                  <p className="text-label-md text-prius-slate uppercase tracking-wider">Saldo</p>
                  <p className={`text-body-md font-bold mt-1 ${saldo === null ? 'text-prius-error' : saldo > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                    {saldo === null ? 'Saldo sin verificar' : saldo > 0 ? formatPesosVisible(saldo) : 'Unidad saldada'}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-label-md text-prius-slate uppercase tracking-wider">Períodos</p>
                {reservasGrupo.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-prius-slate">
                    <span>{unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero}</span>
                    <span className="text-prius-muted">
                      {r.tipo_alquiler === 'dia' ? formatFecha(r.fecha) : `${formatFecha(r.fecha_inicio)} — ${formatFecha(r.fecha_fin)}`}
                    </span>
                    {r.estado === 'cancelada' && <span className="text-prius-error font-bold uppercase text-[10px]">Cancelada</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-label-md text-prius-slate uppercase tracking-wider">Pagos</p>
                  <button
                    type="button"
                    onClick={() => onPagoCelda({ reserva: { ...primeraReservaActiva, clientes: cliente }, pago: null })}
                    className="text-label-md font-bold uppercase tracking-wider text-prius-success hover:text-green-700 transition-all"
                  >
                    + Cargar pago
                  </button>
                </div>
                {pagoGrupo.length === 0 ? (
                  <p className="text-xs text-prius-muted">Sin pagos registrados.</p>
                ) : (
                  pagoGrupo.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPagoCelda({ reserva: { ...p.__reserva, clientes: cliente }, pago: p })}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                        p.estado === 'anulado' ? 'bg-prius-surface text-prius-muted line-through' : 'bg-prius-surface text-black hover:bg-hairline'
                      }`}
                    >
                      <span>{formatFecha(p.fecha)}</span>
                      <span className="font-bold">{p.monto == null ? 'Monto nulo' : formatPesosVisible(p.monto)}</span>
                      <span className="text-prius-muted">
                        {p.comprobantes?.length > 0 ? p.comprobantes.map((c) => formatComprobante(c.tipo, c.numero)).join(', ') : 'Sin comprobante'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}

        {/* Reservas activas / sueltas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md text-prius-slate uppercase tracking-wider">Reservas ({reservasSueltas.length})</p>
            {reservasSueltas.filter((r) => r.estado !== 'cancelada').length >= 2 && (
              <button onClick={onAgruparReservas} className="text-label-md font-bold uppercase tracking-wider text-gold hover:text-gold-hover transition-all">
                Agrupar reservas
              </button>
            )}
          </div>
          {reservasSueltas.length === 0 ? (
            <p className="text-xs text-prius-muted uppercase tracking-wider">Sin reservas sueltas.</p>
          ) : (
            <div className="space-y-2">
              {reservasSueltas.map((r) => {
                const socios = coSocios(r)
                const badge = estadoBadgeStatus(r)
                const fechas = r.tipo_alquiler === 'temporada'
                  ? r.temporada
                  : r.tipo_alquiler === 'dia' ? formatFecha(r.fecha) : `${formatFecha(r.fecha_inicio)} — ${formatFecha(r.fecha_fin)}`
                return (
                  <div key={r.id} className="bg-white border border-hairline rounded-xl px-4 py-3 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-bold text-gold uppercase tracking-wider">{TIPO_LABEL[r.tipo_alquiler] || r.tipo_alquiler}</span>
                      <span className="text-prius-slate">{unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero}</span>
                      <span className="text-prius-muted">{fechas}</span>
                      {r.estado === 'cancelada' && <span className="text-prius-error font-bold uppercase">Cancelada</span>}
                      <div className="flex-1" />
                      {badge === 'preconfirmada' && (
                        <button onClick={() => navigate(linkToRecepcion(r.codigo))} className="text-label-md font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700 transition-all">
                          Hacer check-in
                        </button>
                      )}
                      {r.estado !== 'cancelada' && !r.bonificada && esPendienteConfirmacion(r) && (
                        <button onClick={() => onConfirmarTemporada(r)} className="text-label-md font-bold uppercase tracking-wider text-gold hover:text-gold-hover transition-all">
                          Confirmar temporada
                        </button>
                      )}
                      {r.estado !== 'cancelada' && !r.bonificada && (r.estado_pago === 'parcial' || r.estado_pago === 'pendiente') && (
                        <button onClick={() => onPagoCelda({ reserva: { ...r, clientes: cliente }, pago: null })} className="text-label-md font-bold uppercase tracking-wider text-prius-success hover:text-green-700 transition-all">
                          Registrar pago
                        </button>
                      )}
                      {r.estado !== 'cancelada' && (
                        <button onClick={() => navigate(linkToComprobante(r.id))} className="inline-flex items-center gap-1 text-label-md font-bold uppercase tracking-wider text-black hover:text-prius-slate transition-all">
                          <Receipt size={11} /> Comprobante
                        </button>
                      )}
                      {r.estado !== 'cancelada' && (
                        <button onClick={() => onLiberarUnidad(r)} className="text-label-md font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 transition-all">
                          Liberar unidad
                        </button>
                      )}
                    </div>
                    {socios.length > 0 && (
                      <p className="text-label-md text-prius-muted uppercase tracking-wider flex items-center gap-1">
                        <Users size={11} /> Co-socios: {socios.map((s) => s.nombre).join(', ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagos por reserva */}
        <div>
          <p className="text-label-md text-prius-slate uppercase tracking-wider mb-2">Pagos por Reserva</p>
          {reservasSueltas.length === 0 ? (
            <p className="text-xs text-prius-muted uppercase tracking-wider">Sin reservas sueltas — nada para cobrar acá (ver pagos del grupo arriba).</p>
          ) : (
            <div className="space-y-4">
              {reservasSueltas.map((r) => (
                <div key={r.id} data-deeplink-id={`reserva-${r.id}`}>
                  <PagosGrid
                    reserva={r}
                    pagos={todosPagos.filter((p) => p.reserva_id === r.id)}
                    onCellClick={(reserva, pago) => onPagoCelda({ reserva: { ...reserva, clientes: cliente }, pago })}
                    onDefinirPrecio={(reserva) => onDefinirPrecio(reserva)}
                    onEditarPrecio={puedeAjustarPrecio ? (reserva) => onEditarPrecio(reserva) : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historial */}
        <div>
          <p className="text-label-md text-prius-slate uppercase tracking-wider mb-2">Historial</p>
          <Historial tipo="cliente" id={cliente.id} compact />
        </div>
      </div>
    </>
  )
}
