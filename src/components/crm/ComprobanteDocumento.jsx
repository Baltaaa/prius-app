import { Tent, Umbrella, Warehouse, Lock as LockIcon } from 'lucide-react'
import { formatFecha, formatFechaHora } from '../../lib/format'

const TIPO_ALQUILER_LABEL = { temporada: 'Temporada', periodo: 'Período', dia: 'Día' }
const UNIDAD_ICON = { carpa: Tent, sombrilla: Umbrella, cabina: Warehouse, locker: LockIcon }
const UNIDAD_LABEL = { carpa: 'Carpa', sombrilla: 'Sombrilla', cabina: 'Cabina', locker: 'Locker' }

const nf = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
function formatMonto(n) {
  return nf.format(Number(n) || 0).replace('ARS', '$').replace(/\s+/, ' ')
}

// Hoja CSS propia del documento — nunca Tailwind (ese no existe en el
// `document` del iframe de impresión, ver `lib/imprimirDocumento.js`). Es la
// ÚNICA definición de diseño del comprobante: la vista previa en pantalla y
// la hoja impresa montan el mismo árbol con el mismo `<style>`, así no
// pueden divergir (criterio "la vista previa coincide con el papel").
const CSS = `
  .cd-root { width: 210mm; min-height: 148mm; background: #fff; padding: 14mm; box-sizing: border-box;
    font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #000; }
  .cd-root * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .cd-root, .cd-root * { break-inside: avoid; }

  .cd-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 0.4mm solid #000; padding-bottom: 5mm; margin-bottom: 6mm; }
  .cd-brand { display: flex; align-items: center; gap: 3mm; }
  .cd-logo { width: 11mm; height: 11mm; object-fit: contain; filter: grayscale(1) brightness(0); flex-shrink: 0; }
  .cd-brand-name { font-weight: 800; font-size: 13pt; letter-spacing: -0.02em; margin: 0; }
  .cd-brand-sub { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin: 1mm 0 0; }
  .cd-doc-tag { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 1.5mm 3mm; border-radius: 1.5mm; display: inline-block; }
  .cd-nro { font-size: 8pt; font-family: monospace; font-weight: 700; margin: 2.5mm 0 0; text-align: right; color: #333; }
  .cd-emision { font-size: 6.5pt; color: #666; text-align: right; margin: 1mm 0 0; }

  .cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; border-bottom: 0.2mm solid #E5E5E5; padding-bottom: 6mm; margin-bottom: 6mm; }
  .cd-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #777; margin: 0 0 2mm; }
  .cd-value { font-size: 11pt; font-weight: 700; text-transform: uppercase; margin: 0; }
  .cd-detail { font-size: 8pt; color: #333; margin: 1.5mm 0 0; line-height: 1.5; }
  .cd-unidad-icon { display: inline-flex; vertical-align: -2px; margin-right: 1.5mm; }

  .cd-linea { display: flex; justify-content: space-between; align-items: baseline; padding: 2.5mm 0; border-bottom: 0.2mm solid #E5E5E5; }
  .cd-linea-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; }
  .cd-linea-valor { font-size: 10pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .cd-saldo-row { display: flex; justify-content: space-between; align-items: center; padding: 5mm 0 2mm; }
  .cd-saldo-label { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .cd-saldo-valor { font-size: 15pt; font-weight: 800; font-variant-numeric: tabular-nums; }

  .cd-pagos { margin-top: 6mm; }
  .cd-pago-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 8pt; padding: 2mm 0; border-bottom: 0.15mm solid #E5E5E5; }
  .cd-pago-desc { color: #333; }
  .cd-pago-desc strong { color: #000; }
  .cd-pago-monto { font-weight: 700; font-variant-numeric: tabular-nums; }

  .cd-footer { margin-top: 8mm; padding-top: 5mm; border-top: 0.2mm solid #E5E5E5; text-align: center; }
  .cd-footer p { font-size: 7pt; margin: 0 0 1.5mm; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .cd-footer p.cd-legal { font-style: italic; font-weight: 500; text-transform: none; letter-spacing: 0; color: #666; }

  /* Modo Color */
  .cd-color .cd-doc-tag { background: #F2CA50; color: #000; }
  .cd-color .cd-abonado { color: #166534; }
  .cd-color .cd-saldo-valor.cd-pendiente { color: #991B1B; }
  .cd-color .cd-saldo-valor.cd-saldada { color: #166534; }

  /* Modo Blanco y Negro: sin fondos llenos, se diferencia por peso/tamaño y un recuadro para el saldo pendiente */
  .cd-bn .cd-doc-tag { background: #fff; color: #000; border: 0.3mm solid #000; }
  .cd-bn .cd-abonado { font-weight: 800; }
  .cd-bn .cd-saldo-row.cd-pendiente { border: 0.4mm solid #000; padding: 3mm 4mm; border-radius: 1.5mm; }
  .cd-bn .cd-saldo-valor { font-weight: 800; }
`

/**
 * Único componente presentacional del comprobante — sin hooks de datos, sin
 * conocer Supabase. Lo usan tanto la vista previa en pantalla (Comprobantes.jsx)
 * como la hoja de impresión (montada dentro del iframe oculto), con las
 * mismas props: así nunca pueden divergir.
 */
export default function ComprobanteDocumento({ datos, modo = 'color', tipo = 'estado_cuenta' }) {
  if (!datos) return null

  const UnidadIcon = UNIDAD_ICON[datos.unidad.tipo] || null
  const unidadLabel = UNIDAD_LABEL[datos.unidad.tipo] || datos.unidad.tipo || 'Unidad'
  const saldoPendiente = Number(datos.saldo) > 0
  const pagosAMostrar = tipo === 'recibo' && datos.pagoUnico ? [datos.pagoUnico] : datos.pagos

  return (
    <div className={`cd-root cd-${modo}`}>
      <style>{CSS}</style>

      <div className="cd-header">
        <div className="cd-brand">
          <img src="/prius-icon.png" alt="" className="cd-logo" />
          <div>
            <p className="cd-brand-name">Prius Playa Grande</p>
            <p className="cd-brand-sub">Balneario &bull; Mar del Plata</p>
          </div>
        </div>
        <div>
          <span className="cd-doc-tag">DOC. INTERNO</span>
          <p className="cd-nro">NRO: {datos.numero}</p>
          <p className="cd-emision">
            Emitido {formatFechaHora(datos.fechaEmision)}
            {datos.emitidoPor ? ` · ${datos.emitidoPor}` : ''}
          </p>
        </div>
      </div>

      <div className="cd-grid">
        <div>
          <p className="cd-label">Datos del Titular</p>
          <p className="cd-value">{datos.cliente.nombre || 'S/N'}</p>
          <p className="cd-detail">
            CUIT/DNI: {datos.cliente.cuit || datos.cliente.dni || 'N/A'}<br />
            Tel: {datos.cliente.telefono || 'N/A'}
          </p>
        </div>
        <div>
          <p className="cd-label">Detalle del Alquiler</p>
          <p className="cd-value">
            {UnidadIcon && <UnidadIcon size={13} className="cd-unidad-icon" />}
            {unidadLabel} #{datos.unidad.numero}
          </p>
          <p className="cd-detail">
            Temporada: {datos.temporada}<br />
            {TIPO_ALQUILER_LABEL[datos.tipoAlquiler] || datos.tipoAlquiler}:{' '}
            {datos.tipoAlquiler === 'periodo'
              ? `${formatFecha(datos.fechaInicio)} al ${formatFecha(datos.fechaFin)}`
              : datos.tipoAlquiler === 'dia'
                ? formatFecha(datos.fecha)
                : 'Temporada completa'}
          </p>
        </div>
      </div>

      {tipo === 'recibo' && datos.pagoUnico ? (
        <div className="cd-pagos">
          <p className="cd-label">Recibo de Pago</p>
          <div className="cd-pago-row">
            <span className="cd-pago-desc">
              <strong>{formatFecha(datos.pagoUnico.fecha)}</strong> — {datos.pagoUnico.medioLabel}
              {datos.pagoUnico.comprobante && <> · Comp. {datos.pagoUnico.comprobante}</>}
              {datos.pagoUnico.nroCuota && <> · Cuota {datos.pagoUnico.nroCuota}</>}
            </span>
            <span className="cd-pago-monto cd-abonado">{formatMonto(datos.pagoUnico.monto)}</span>
          </div>
        </div>
      ) : (
        <>
          <div>
            {datos.montoTotal != null && (
              <div className="cd-linea">
                <span className="cd-linea-label">Monto Total Contratado</span>
                <span className="cd-linea-valor">{formatMonto(datos.montoTotal)}</span>
              </div>
            )}
            <div className="cd-linea">
              <span className="cd-linea-label">Monto Abonado</span>
              <span className="cd-linea-valor cd-abonado">{formatMonto(datos.montoAbonado)}</span>
            </div>
          </div>
          <div className={`cd-saldo-row ${saldoPendiente ? 'cd-pendiente' : 'cd-saldada'}`}>
            <span className="cd-saldo-label">Saldo Pendiente</span>
            <span className={`cd-saldo-valor ${saldoPendiente ? 'cd-pendiente' : 'cd-saldada'}`}>
              {saldoPendiente ? formatMonto(datos.saldo) : 'Unidad saldada'}
            </span>
          </div>

          {pagosAMostrar.length > 0 && (
            <div className="cd-pagos">
              <p className="cd-label">Pagos Registrados</p>
              {pagosAMostrar.map((p) => (
                <div key={p.id} className="cd-pago-row">
                  <span className="cd-pago-desc">
                    <strong>{formatFecha(p.fecha)}</strong> — {p.medioLabel}
                    {p.comprobante && <> · Comp. {p.comprobante}</>}
                    {p.nroCuota && <> · Cuota {p.nroCuota}</>}
                  </span>
                  <span className="cd-pago-monto cd-abonado">{formatMonto(p.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="cd-footer">
        <p>Comprobante emitido por Prius Playa Grande</p>
        <p className="cd-legal">Este documento no es válido como factura legal. Válido únicamente como comprobante interno de reserva.</p>
      </div>
    </div>
  )
}
