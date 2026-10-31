import { useState } from 'react'
import { Receipt, Unlock, Wallet, QrCode, CalendarCheck, Users, Pencil } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ScrollFade from '../ui/ScrollFade'
import {
  formatPesosVisible, formatFecha, formatComprobante, formatNombre, unidadEmoji, formatUnidad,
} from '../../lib/format'

// Tarjeta ÚNICA de reserva + pagos en la ficha de cliente (31/10/2026).
//
// Antes convivían dos diseños distintos: la tarjeta rica de "Reserva con
// precio unificado" (solo para grupos) y una tarjeta pobre para las reservas
// sueltas, más la grilla ReservaPagosCard en otra columna. Ahora las tres cosas son
// esta misma tarjeta, para TODOS los tipos: temporada, período, día y grupo.
//
// Recibe una "vista" ya normalizada (ver `vistaDeGrupo`/`vistaDeReserva` más
// abajo) para que el componente no tenga que saber si está mostrando un grupo
// o una reserva suelta — esa diferencia se resuelve una sola vez, afuera.

const TIPO_LABEL = { temporada: 'Temporada', periodo: 'Período', dia: 'Día' }

/** Encabezado: "TEMPORADA · 2026/2027", "DÍA · 2026/2027", "RESERVA CON PRECIO UNIFICADO · 2026/2027". */
function tituloDe(tipo, temporada, esGrupo) {
  const label = esGrupo ? 'Reserva con precio unificado' : (TIPO_LABEL[tipo] || tipo || '')
  return temporada ? `${label} · ${temporada}` : label
}

function FilaPago({ pago, cliente, titularId, onPagoCelda, onCargarMonto }) {
  const sinMonto = pago.monto == null || pago.monto_pendiente_verificacion
  const reservaDelPago = { ...(pago.__reserva || {}), clientes: cliente }
  // El pago guarda el cliente_id de quien pagó: en una unidad compartida
  // puede ser un cosocio, y el dueño quiere ver de quién fue la cuota.
  const pagador = pago.cliente_id && pago.cliente_id !== titularId ? pago.clientes?.nombre : null
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-prius-surface">
      <button
        type="button"
        onClick={() => onPagoCelda({ reserva: reservaDelPago, pago })}
        className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left hover:opacity-70 transition-opacity"
      >
        <span className="text-prius-slate shrink-0">{pago.fecha ? formatFecha(pago.fecha) : '—'}</span>
        {pago.nro_cuota != null && (
          <span className="text-prius-slate shrink-0">Cuota {pago.nro_cuota}</span>
        )}
        <span className="font-bold text-black truncate">
          {sinMonto
            ? <span className="text-gold uppercase tracking-wider text-[10px]">Falta cargar el monto</span>
            : formatPesosVisible(pago.monto)}
        </span>
        <span className="min-w-0 text-right">
          <span className="text-prius-muted truncate block">
            {pago.comprobantes?.length > 0
              ? pago.comprobantes.map((c) => formatComprobante(c.tipo, c.numero)).join(', ')
              : 'Sin comprobante'}
          </span>
          {pagador && <span className="text-prius-muted text-[10px] truncate block">{formatNombre(pagador)}</span>}
        </span>
      </button>
      {/* Acceso directo a editar_monto_pago para los placeholders de la
          migración del Excel — el dato que falta es justamente el importe. */}
      {sinMonto && onCargarMonto && (
        <button
          type="button"
          onClick={() => onCargarMonto({ reserva: reservaDelPago, pago })}
          title="Cargar el monto de este pago"
          className="shrink-0 w-7 h-7 rounded-lg bg-gold/15 hover:bg-gold/30 text-black flex items-center justify-center transition-colors"
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  )
}

export default function ReservaPagosCard({
  vista, cliente, onPagoCelda, onCargarMonto, onLiberarUnidad,
  onConfirmarTemporada, onEditarPrecio, onDefinirPrecio, onIrAComprobante, onCheckin,
}) {
  const {
    key, esGrupo, tipo, temporada, estadoBadge, precioTotal, pagado, saldo,
    unidades, pagos, socios, cancelada, reservaPrincipal, sinPrecio, preconfirmada, pendienteConfirmacion,
  } = vista

  // Una reserva cancelada arranca colapsada: queda el encabezado como
  // registro, sin gastar alto de la columna en algo que ya no está vigente.
  const [abierta, setAbierta] = useState(!cancelada)

  // El precio se edita desde el lápiz del header; al pie quedan solo las
  // acciones sobre la reserva.
  const acciones = [
    preconfirmada && onCheckin && { label: 'Check-in', icon: QrCode, onClick: () => onCheckin(reservaPrincipal) },
    pendienteConfirmacion && onConfirmarTemporada && { label: 'Confirmar', icon: CalendarCheck, onClick: () => onConfirmarTemporada(reservaPrincipal) },
    onIrAComprobante && { label: 'Comprobante', icon: Receipt, onClick: () => onIrAComprobante(reservaPrincipal) },
    onLiberarUnidad && { label: 'Liberar unidad', icon: Unlock, onClick: () => onLiberarUnidad(reservaPrincipal) },
  ].filter(Boolean)

  const onPrecio = sinPrecio ? onDefinirPrecio : onEditarPrecio

  return (
    <div
      key={key}
      data-deeplink-id={`reserva-${reservaPrincipal?.id}`}
      className={`bg-white border border-hairline rounded-xl p-3 ${abierta ? 'space-y-2.5' : ''} ${
        cancelada ? 'opacity-60' : ''
      }`}
    >
      {/* Header: tipo + temporada en dorado, chip de estado y lápiz de precio */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={cancelada ? () => setAbierta((v) => !v) : undefined}
          className={`text-label-md uppercase tracking-wider font-bold text-gold text-left min-w-0 truncate ${
            cancelada ? 'hover:opacity-70 transition-opacity' : 'cursor-default'
          }`}
        >
          {tituloDe(tipo, temporada, esGrupo)}
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {cancelada
            ? <span className="px-2 py-0.5 rounded-full bg-prius-surface text-prius-error text-[10px] font-bold uppercase tracking-wider">Cancelada</span>
            : estadoBadge && <StatusBadge status={estadoBadge} />}
          {!cancelada && onPrecio && (
            <button
              type="button"
              onClick={() => onPrecio(reservaPrincipal)}
              title={sinPrecio ? 'Definir el precio de la reserva' : 'Editar el precio de la reserva'}
              className="w-7 h-7 rounded-lg bg-prius-surface hover:bg-hairline text-prius-slate hover:text-black flex items-center justify-center transition-colors"
            >
              {sinPrecio ? <Wallet size={12} /> : <Pencil size={12} />}
            </button>
          )}
        </div>
      </div>

      {!abierta ? null : (
      <>

      {/* Precio total / Pagado / Saldo. En una columna angosta (ficha a
          1366x768, ~300px) van en 2 columnas: tres importes al lado partían
          el "$ 4.512.000" en dos líneas. El corte lo decide el ancho de la
          tarjeta, no el del viewport — ver `cq-cols-3` en index.css. */}
      <div className="cq grid grid-cols-2 cq-cols-3 gap-3 text-xs">
        <div>
          <p className="text-label-md text-prius-slate uppercase tracking-wider">Precio total</p>
          <p className="text-body-md font-bold text-black mt-0.5">
            {sinPrecio ? <span className="text-prius-slate">Sin precio</span> : (formatPesosVisible(precioTotal) || '—')}
          </p>
        </div>
        <div>
          <p className="text-label-md text-prius-slate uppercase tracking-wider">Pagado</p>
          <p className="text-body-md font-bold text-prius-success mt-0.5">{formatPesosVisible(pagado) || '—'}</p>
        </div>
        <div>
          <p className="text-label-md text-prius-slate uppercase tracking-wider">Saldo</p>
          <p className={`text-body-md font-bold mt-0.5 ${saldo == null || saldo > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
            {saldo == null ? 'Sin verificar' : saldo > 0 ? formatPesosVisible(saldo) : 'Unidad saldada'}
          </p>
        </div>
      </div>

      {/* Unidades con sus fechas */}
      {unidades.length > 0 && (
        <div className="space-y-1">
          {unidades.map((u) => (
            <div key={u.key} className="flex flex-wrap items-center gap-x-2 text-xs text-prius-slate">
              <span>{unidadEmoji(u.tipo)} {formatUnidad(u.tipo, u.numero)}</span>
              {u.fechas && <span className="text-prius-muted">· {u.fechas}</span>}
              {u.cancelada && <span className="text-prius-error font-bold uppercase text-[10px]">Cancelada</span>}
            </div>
          ))}
        </div>
      )}

      {socios.length > 0 && (
        <p className="text-body-sm text-prius-slate flex items-center gap-1">
          <Users size={11} className="shrink-0" /> Co-socios: {socios.map((s) => formatNombre(s.nombre)).join(', ')}
        </p>
      )}

      {/* Pagos. Los anulados no llegan hasta acá: los filtra `_pagosVigentes`
          en lib/reservas.js (siguen en la DB y en el Historial). */}
      {!cancelada && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-label-md text-prius-slate uppercase tracking-wider">Pagos</p>
            <button
              type="button"
              onClick={() => onPagoCelda({ reserva: { ...reservaPrincipal, clientes: cliente }, pago: null })}
              className="text-label-md font-bold uppercase tracking-wider text-prius-success hover:text-green-700 transition-all"
            >
              + Cargar pago
            </button>
          </div>
          {pagos.length === 0 ? (
            <p className="text-xs text-prius-muted">Sin pagos registrados.</p>
          ) : (
            // Con muchas cuotas la lista scrollea DENTRO de la tarjeta, para
            // que la columna izquierda siga entrando en 1366x768 sin que la
            // ficha entera scrollee (ver ClienteDetalleContent).
            <ScrollFade className="space-y-1 max-h-[148px] overflow-y-auto">
              {pagos.map((p) => (
                <FilaPago
                  key={p.id}
                  pago={p}
                  cliente={cliente}
                  titularId={cliente?.id}
                  onPagoCelda={onPagoCelda}
                  onCargarMonto={onCargarMonto}
                />
              ))}
            </ScrollFade>
          )}
        </div>
      )}

      {/* Acciones compactas */}
      {acciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {acciones.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="h-8 px-2.5 rounded-lg bg-prius-surface hover:bg-hairline text-black text-[11px] font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap"
            >
              <Icon size={12} className="shrink-0" /> {label}
            </button>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  )
}
