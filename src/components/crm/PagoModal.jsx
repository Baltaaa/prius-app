import { useState, useEffect } from 'react'
import { usePagos } from '../../hooks/usePagos'
import { formatCurrency, formatDate, unidadEmoji } from '../../lib/format'
import { MEDIO_PAGO_LABEL, formatMedioPago } from '../../lib/pagos'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import { useDialog } from '../../context/DialogProvider'

const MEDIOS = Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => ({ value, label }))
const CUOTAS_SUGERIDAS = [1, 3, 6, 12]

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FDE047]/50 outline-none font-bold'

// Modal "Registrar pago", único y compartido entre Clientes y Reservas (Fase 2).
// `reservasOptions`: reservas elegibles para recibir el pago (con clientes/
// unidades ya anidados). Si viene una sola, se fija sin selector.
//
// `pagoExistente`: cuando viene seteado (click en una celda YA cargada de
// PagosGrid), el modal entra en modo consulta de solo lectura — muestra el
// detalle del pago ya guardado, sin formulario ni botón de guardar. No se
// tocó la lógica de alta (`handleSubmit`/`createPago`) para esto, es un
// return distinto adentro del mismo componente.
export default function PagoModal({ isOpen, onClose, reservasOptions = [], initialReservaId = '', pagoExistente = null }) {
  const { createPago } = usePagos()
  const { alert } = useDialog()

  const [reservaId, setReservaId] = useState(initialReservaId)
  const [monto, setMonto] = useState(0)
  const [medio, setMedio] = useState('efectivo')
  const [comprobante, setComprobante] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [cuotasTarjeta, setCuotasTarjeta] = useState('')
  const [saving, setSaving] = useState(false)

  const esTarjetaCredito = medio === 'tarjeta_credito'

  // "Nro. Cuota" (instancia de pago sobre el saldo, 1/2/3...) ya NO se carga
  // a mano — permitía repetir el mismo número. Lo asigna siempre el trigger
  // Postgres fn_pago_asigna_nro_cuota como "próximo secuencial" para esa
  // reserva. Acá solo se previsualiza (todos los pagos ya registrados de esa
  // reserva + 1), informativo, no se envía en el insert.
  const { pagos: pagosDeReserva } = usePagos(reservaId)
  const proximaCuota = pagosDeReserva.length + 1

  useEffect(() => {
    if (!isOpen) return
    setReservaId(initialReservaId || reservasOptions[0]?.id || '')
    setMonto(0)
    setMedio('efectivo')
    setComprobante('')
    setFecha(new Date().toISOString().split('T')[0])
    setCuotasTarjeta('')
  }, [isOpen, initialReservaId, reservasOptions])

  // El campo de cuotas solo aplica a tarjeta_credito — si cambian el medio,
  // se oculta y se limpia el valor antes de guardar (no queda cuotas_tarjeta
  // "fantasma" en un pago en efectivo/débito/transferencia).
  const handleMedioChange = (value) => {
    setMedio(value)
    if (value !== 'tarjeta_credito') setCuotasTarjeta('')
  }

  const reservaSeleccionada = reservasOptions.find((r) => r.id === reservaId)

  // Modo consulta: pago ya guardado, solo se muestra el detalle.
  if (pagoExistente) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`Pago N.° ${pagoExistente.nro_cuota}`}>
        <div className="space-y-4">
          {reservaSeleccionada && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-sm font-bold text-white uppercase">{reservaSeleccionada.clientes?.nombre || 'S/N'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {unidadEmoji(reservaSeleccionada.unidades?.tipo)} {reservaSeleccionada.unidades?.tipo} #{reservaSeleccionada.unidades?.numero}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto</p>
              <p className="text-lg font-bold text-green-400 mt-1">{formatCurrency(pagoExistente.monto)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Medio de Pago</p>
              <p className="text-sm font-bold text-white mt-1">{formatMedioPago(pagoExistente)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha</p>
              <p className="text-sm text-white mt-1">{formatDate(pagoExistente.fecha)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Comprobante</p>
              <p className="text-sm text-white mt-1">{pagoExistente.comprobante || '-'}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest text-center pt-2">
            Pago ya registrado — solo lectura.
          </p>
        </div>
      </Modal>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reservaId || monto <= 0) return
    setSaving(true)
    try {
      await createPago({
        reserva_id: reservaId,
        monto,
        medio,
        comprobante: comprobante || null,
        fecha,
        // nro_cuota: no se manda — lo asigna el trigger fn_pago_asigna_nro_cuota.
        cuotas_tarjeta: esTarjetaCredito && cuotasTarjeta ? Number(cuotasTarjeta) : null,
      })
      onClose()
    } catch (err) {
      await alert('No se pudo registrar el pago.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pago">
      <form onSubmit={handleSubmit} className="space-y-6">
        {reservasOptions.length > 1 ? (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reserva a cancelar</label>
            <select
              required
              value={reservaId}
              onChange={(e) => setReservaId(e.target.value)}
              className={`${inputClass} uppercase`}
            >
              <option value="" disabled>Seleccionar...</option>
              {reservasOptions.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#0a0d14]">
                  {r.clientes?.nombre || 'S/N'} — {unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero} (saldo {formatCurrency(r.saldo)})
                </option>
              ))}
            </select>
          </div>
        ) : reservaSeleccionada ? (
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-sm font-bold text-white uppercase">{reservaSeleccionada.clientes?.nombre || 'S/N'}</p>
            <p className="text-xs text-gray-400 mt-1">
              {unidadEmoji(reservaSeleccionada.unidades?.tipo)} {reservaSeleccionada.unidades?.tipo} #{reservaSeleccionada.unidades?.numero} &bull; Saldo actual: {formatCurrency(reservaSeleccionada.saldo)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 uppercase tracking-widest">No hay reservas disponibles para registrar un pago.</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monto</label>
            <CurrencyInput value={monto} onChange={setMonto} required className={inputClass} placeholder="0" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Medio de Pago</label>
            <select value={medio} onChange={(e) => handleMedioChange(e.target.value)} className={`${inputClass} uppercase`}>
              {MEDIOS.map((m) => (
                <option key={m.value} value={m.value} className="bg-[#0a0d14]">{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cuotas de tarjeta: solo con tarjeta_credito. Distinto de "Nro.
            Cuota" de abajo, que es la instancia de pago sobre el saldo. */}
        {esTarjetaCredito && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cantidad de Cuotas (tarjeta)</label>
            <div className="flex gap-2">
              {CUOTAS_SUGERIDAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCuotasTarjeta(String(n))}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                    Number(cuotasTarjeta) === n
                      ? 'bg-[#FDE047] text-black border-[#FDE047]'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min="1"
                value={cuotasTarjeta}
                onChange={(e) => setCuotasTarjeta(e.target.value)}
                placeholder="Otra cantidad"
                className={`${inputClass} flex-1`}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>

        {/* Informativo — el número real lo asigna el trigger al guardar */}
        {reservaId && (
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">
            Este va a quedar registrado como el pago N.° {proximaCuota} de esta reserva.
          </p>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nro. Comprobante (interno)</label>
          <input
            type="text"
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
            placeholder="Ej. REC-0001"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !reservaId}
          className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
        >
          {saving ? 'Registrando...' : 'Confirmar Pago'}
        </button>
      </form>
    </Modal>
  )
}
