import { useState } from 'react'
import { Receipt, Unlock, Wallet, QrCode, CalendarCheck, Users, Pencil } from 'lucide-react'
import StatusBadge from './StatusBadge'
import {
  formatPesosVisible, formatFecha, formatComprobante, formatNombre, formatUnidad,
} from '../../lib/format'
import UnidadLabel from './UnidadLabel'

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

// Tabla de pagos: Fecha | Comprobante (completo, puede partirse en dos líneas)
// | Monto a la derecha. Las columnas son las mismas en todas las filas para
// que queden alineadas; filas de 44px.
const COLUMNAS_PAGO = 'grid-cols-[5.5rem_minmax(0,1fr)_auto]'

function FilaPago({ pago, cliente, titularId, onPagoCelda, onCargarMonto }) {
  const sinMonto = pago.monto == null || pago.monto_pendiente_verificacion
  const reservaDelPago = { ...(pago.__reserva || {}), clientes: cliente }
  // El pago guarda el cliente_id de quien pagó: en una unidad compartida
  // puede ser un cosocio, y el dueño quiere ver de quién fue la cuota.
  const pagador = pago.cliente_id && pago.cliente_id !== titularId ? pago.clientes?.nombre : null
  return (
    <div className="flex items-center gap-2 rounded-icon bg-card">
      <button
        type="button"
        onClick={() => onPagoCelda({ reserva: reservaDelPago, pago })}
        className={`flex-1 min-w-0 min-h-11 px-3 py-2 grid ${COLUMNAS_PAGO} items-center gap-3 text-left text-label hover:bg-row-hover rounded-icon transition-colors`}
      >
        <span className="text-ink-2">{pago.fecha ? formatFecha(pago.fecha) : '—'}</span>
        <span className="min-w-0 break-words text-ink">
          {pago.comprobantes?.length > 0
            ? pago.comprobantes.map((c) => formatComprobante(c.tipo, c.numero)).join(', ')
            : <span className="text-ink-2">Sin comprobante</span>}
          {(pago.nro_cuota != null || pagador) && (
            <span className="block text-ink-2">
              {pago.nro_cuota != null && `Cuota ${pago.nro_cuota}`}
              {pago.nro_cuota != null && pagador && ' · '}
              {pagador && formatNombre(pagador)}
            </span>
          )}
        </span>
        <span className="text-right font-semibold text-ink tabular-nums whitespace-nowrap">
          {sinMonto ? 'Falta monto' : formatPesosVisible(pago.monto)}
        </span>
      </button>
      {/* Acceso directo a editar_monto_pago para los placeholders de la
          migración del Excel — el dato que falta es justamente el importe. */}
      {sinMonto && onCargarMonto && (
        <button
          type="button"
          onClick={() => onCargarMonto({ reserva: reservaDelPago, pago })}
          title="Cargar el monto de este pago"
          aria-label="Cargar el monto de este pago"
          className="shrink-0 w-11 h-11 rounded-full bg-gold-100 text-ink flex items-center justify-center transition-colors"
        >
          <Pencil size={12} strokeWidth={1.5} />
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
      className={`card-inner ${abierta ? 'space-y-4' : ''} ${
        cancelada ? 'opacity-60' : ''
      }`}
    >
      {/* Header: tipo + temporada en dorado, chip de estado y lápiz de precio */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={cancelada ? () => setAbierta((v) => !v) : undefined}
          className={`text-label font-semibold text-ink text-left min-w-0 truncate ${
            cancelada ? 'hover:opacity-70 transition-opacity' : 'cursor-default'
          }`}
        >
          {tituloDe(tipo, temporada, esGrupo)}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {cancelada
            ? <span className="text-label px-2 py-1 rounded-full bg-card text-danger-ink">Cancelada</span>
            : estadoBadge && <StatusBadge status={estadoBadge} />}
          {!cancelada && onPrecio && (
            <button
              type="button"
              onClick={() => onPrecio(reservaPrincipal)}
              title={sinPrecio ? 'Definir el precio de la reserva' : 'Editar el precio de la reserva'}
              className="w-11 h-11 -my-2 rounded-full hover:bg-card text-ink-2 hover:text-ink flex items-center justify-center transition-colors"
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
      <div className="cq grid grid-cols-2 cq-cols-3 gap-3 text-label">
        <div>
          <p className="text-label text-ink-2">Precio total</p>
          <p className="text-body font-semibold text-ink mt-1">
            {sinPrecio ? <span className="text-ink-2">Sin precio</span> : (formatPesosVisible(precioTotal) || '—')}
          </p>
        </div>
        <div>
          <p className="text-label text-ink-2">Pagado</p>
          <p className="text-body font-semibold text-success-ink mt-1">{formatPesosVisible(pagado) || '—'}</p>
        </div>
        <div>
          <p className="text-label text-ink-2">Saldo</p>
          <p className={`text-body font-semibold mt-1 ${saldo == null || saldo > 0 ? 'text-danger' : 'text-success-ink'}`}>
            {saldo == null ? 'Sin verificar' : saldo > 0 ? formatPesosVisible(saldo) : 'Unidad saldada'}
          </p>
        </div>
      </div>

      {/* Unidades con sus fechas */}
      {unidades.length > 0 && (
        <div className="space-y-1">
          {unidades.map((u) => (
            <div key={u.key} className="flex flex-wrap items-center gap-x-2 text-label text-ink-2">
              <span><UnidadLabel tipo={u.tipo} numero={u.numero} /></span>
              {u.fechas && <span className="text-ink-2">· {u.fechas}</span>}
              {u.cancelada && <span className="text-label text-danger">Cancelada</span>}
            </div>
          ))}
        </div>
      )}

      {socios.length > 0 && (
        <p className="text-label text-ink-2 flex items-center gap-1">
          <Users size={11} className="shrink-0" /> Co-socios: {socios.map((s) => formatNombre(s.nombre)).join(', ')}
        </p>
      )}

      {/* Pagos. Los anulados no llegan hasta acá: los filtra `_pagosVigentes`
          en lib/reservas.js (siguen en la DB y en el Historial). */}
      {!cancelada && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-label text-ink-2">Pagos</p>
            <button
              type="button"
              onClick={() => onPagoCelda({ reserva: { ...reservaPrincipal, clientes: cliente }, pago: null })}
              className="text-label text-success-ink hover:text-success-ink transition-all"
            >
              + Cargar pago
            </button>
          </div>
          {pagos.length === 0 ? (
            <p className="text-label text-ink-2">Sin pagos registrados.</p>
          ) : (
            // Con muchas cuotas la lista crece: scrollea la columna entera de
            // la ficha (ver ClienteDetalleContent), no la tarjeta.
            <div className="space-y-1">
              <div className="flex gap-2 text-label text-ink-2">
                <div className={`flex-1 min-w-0 grid ${COLUMNAS_PAGO} gap-3 px-3`}>
                  <span>Fecha</span><span>Comprobante</span><span className="text-right">Monto</span>
                </div>
                {onCargarMonto && pagos.some((p) => p.monto == null || p.monto_pendiente_verificacion) && <span className="w-11 shrink-0" />}
              </div>
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
            </div>
          )}
        </div>
      )}

      {/* Acciones compactas */}
      {acciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {acciones.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="h-11 px-4 rounded-full bg-card border border-line hover:bg-row-hover text-ink text-label font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
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
