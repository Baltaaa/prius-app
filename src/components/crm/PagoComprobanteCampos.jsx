import { formatPesos, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_EMOJI, COMPROBANTE_TIPO_SIGLA, COMPROBANTE_TIPO_LABEL } from '../../lib/pagos'
import MoneyInput from '../inputs/MoneyInput'
import IntegerInput from '../inputs/IntegerInput'
import DateInput from '../inputs/DateInput'
import BrandSelect from '../ui/BrandSelect'

const inputClass =
  'w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-base md:text-sm focus:border-gold/50 outline-none font-bold'

const chipClass = (active) =>
  `px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
    active ? 'bg-gold text-black border-gold' : 'bg-prius-subtle text-prius-slate border-hairline hover:text-black'
  }`

// Campos de monto + medio de pago + comprobante (item 3/4, oct 2026) —
// único bloque, usado tal cual por RegistrarPago.jsx (modal propio) y por
// la sección de pago inline de Nueva Reserva / Asignar Unidad de
// Temporada. Todo el estado y las validaciones vienen de
// usePagoComprobanteForm — este componente solo arma el JSX.
export default function PagoComprobanteCampos({ form }) {
  const {
    monto, setMonto, medio, setMedio, referencia, setReferencia,
    comprobanteTipo, setComprobanteTipo, numero, setNumero,
    fechaComprobante, setFechaComprobante, mismoComprobanteDe, setMismoComprobanteDe,
    duplicado, anuladoPrevio, verificandoDuplicado, verificarDuplicado, limpiarDuplicado,
    excedeSaldo, tipoPago, esHistorico, comprobanteIncompleto,
    pagosConComprobante, saldo, saldoDesconocido,
    moneda, setMoneda, montoUsd, setMontoUsd,
    tipoCambio, setTipoCambioManual, montoArsEquivalente,
    cotizacionStale, cotizacionFecha, cotizacionTipo, cotizacionLado,
  } = form
  const esUsd = moneda === 'USD'

  const tipoLabel = tipoPago
    ? ({ sena: 'Seña', parcial: 'Pago parcial', saldo: 'Saldo', total: 'Pago total', servicio: 'Servicio', otro: 'Otro' }[tipoPago] || 'Pago')
    : null

  return (
    <div className="space-y-6">
      {/* Monto. Toggle ARS/USD (31/10/2026): el peso sigue siendo la moneda
          principal — en USD se carga el importe en dólares y abajo se ve, en
          vivo, el equivalente en pesos que se imputa al saldo. La cotización
          se puede corregir a mano; el servidor igual recalcula y rechaza una
          que se aleje más de 30% de la del día. */}
      <div>
        <div className="flex items-center gap-1 bg-prius-subtle p-1 rounded-xl w-fit mb-2.5">
          {['ARS', 'USD'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMoneda(m)}
              className={`px-3.5 py-1.5 rounded-lg text-label-md font-bold transition-colors ${
                moneda === m ? 'bg-white text-black shadow-sm' : 'text-prius-slate hover:text-black'
              }`}
            >
              {m === 'ARS' ? '🇦🇷 Pesos' : '🇺🇸 Dólares'}
            </button>
          ))}
        </div>

        {esUsd ? (
          <>
            <MoneyInput
              label="Monto en dólares"
              value={montoUsd}
              onChange={setMontoUsd}
              required
              max={1_000_000}
              simbolo="US$"
              error={excedeSaldo ? `El equivalente en pesos supera el saldo pendiente (${formatPesos(saldo)})` : undefined}
            />
            <div className="mt-2.5 p-3 bg-prius-subtle border border-hairline rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest shrink-0">
                  Cotización
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={tipoCambio ?? ''}
                  onChange={(e) => setTipoCambioManual(e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="—"
                  className="w-32 text-right bg-white border border-hairline rounded-lg px-2.5 py-1.5 text-base md:text-sm font-bold text-black outline-none focus:border-gold/50"
                />
              </div>
              <p className="text-[11px] text-prius-muted">
                {cotizacionTipo} · {cotizacionLado}
                {cotizacionFecha ? ` · ${formatFecha(cotizacionFecha)}` : ''}
                {cotizacionStale && <span className="text-amber-500 font-semibold"> · no es de hoy</span>}
              </p>
              <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-hairline">
                <span className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Se imputa</span>
                <span className="text-headline-sm text-black tabular-nums">
                  {montoArsEquivalente ? formatPesos(montoArsEquivalente) : '—'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <MoneyInput
            label="Monto"
            value={monto}
            onChange={setMonto}
            required
            max={100_000_000}
            error={excedeSaldo ? `El monto supera el saldo pendiente (${formatPesos(saldo)})` : undefined}
            chips={!saldoDesconocido && saldo > 0 ? [
              { label: 'Saldo total', value: saldo },
              { label: '50%', value: Math.round(saldo / 2) },
            ] : undefined}
          />
        )}
        {!excedeSaldo && Number(monto) > 0 && (
          <p className="text-[11px] text-prius-slate mt-1.5">
            Se registrará como: <span className="text-prius-slate font-semibold">{tipoLabel}</span>
            {!saldoDesconocido && <> — saldo restante {formatPesos(Math.max(saldo - Number(monto), 0))}</>}
            {saldoDesconocido && <span className="text-amber-400"> · Saldo sin verificar</span>}
          </p>
        )}
      </div>

      {/* Medio de pago + referencia */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Medio de pago</label>
        <BrandSelect
          value={medio}
          onChange={setMedio}
          options={Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({
            value, label: `${MEDIO_PAGO_EMOJI[value] || ''} ${label}`.trim(),
          }))}
        />
        {medio !== 'efectivo' && (
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="N.° de operación / referencia (opcional)"
            className={inputClass}
          />
        )}
      </div>

      {/* Comprobante — obligatorio salvo "mismo comprobante que otro pago" */}
      <div className="border border-hairline rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-prius-subtle text-xs font-bold uppercase tracking-widest text-prius-slate">
          Comprobante
        </div>
        <div className="p-4 space-y-4 bg-white">
          {pagosConComprobante.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Mismo comprobante que otro pago</label>
              <BrandSelect
                value={mismoComprobanteDe}
                onChange={setMismoComprobanteDe}
                options={[
                  { value: '', label: 'No — es un comprobante nuevo' },
                  ...pagosConComprobante.map((p) => ({
                    value: p.comprobante_id,
                    label: `Cuota ${p.nro_cuota} — ${formatPesos(p.monto)}`,
                  })),
                ]}
              />
            </div>
          )}
          {!mismoComprobanteDe && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COMPROBANTE_TIPO_SIGLA).map(([value, sigla]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setComprobanteTipo(value); limpiarDuplicado() }}
                      title={COMPROBANTE_TIPO_LABEL[value]}
                      className={chipClass(comprobanteTipo === value)}
                    >
                      {sigla}
                    </button>
                  ))}
                </div>
              </div>
              {/* Punto de venta: siempre 1, automático — no se muestra ni se
                  pregunta (item 4, oct 2026). Se sigue guardando como siempre. */}
              <IntegerInput
                label="Número" value={numero} onChange={(v) => { setNumero(v); limpiarDuplicado() }}
                onBlur={verificarDuplicado} min={1} max={99999999}
                placeholder="Ej: 727" error={comprobanteIncompleto && !numero ? 'Obligatorio' : undefined}
              />
              {verificandoDuplicado && <p className="text-[11px] text-prius-muted">Verificando...</p>}
              {duplicado && (
                <p className="text-[11px] text-prius-error">
                  Ese comprobante ya está cargado ({duplicado.cliente}{duplicado.fecha ? `, ${formatFecha(duplicado.fecha)}` : ''}).
                </p>
              )}
              {anuladoPrevio && (
                <p className="text-[11px] text-prius-muted">
                  Este número tiene un comprobante anulado previo — se puede volver a cargar.
                </p>
              )}
              <DateInput
                label="Fecha"
                value={fechaComprobante}
                onChange={setFechaComprobante}
                max={new Date().toISOString().split('T')[0]}
                calendarOnly
                hint={esHistorico ? 'Pago histórico: queda en el historial del cliente, no afecta la caja' : undefined}
              />
              {comprobanteIncompleto && (
                <p className="text-[11px] text-prius-error">
                  El comprobante es obligatorio: completá tipo, número y fecha.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
