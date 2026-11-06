import { useCallback, useEffect, useState } from 'react'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { formatMonto, formatMontoUSD, formatFecha } from '../../lib/format'
import SegmentedControl from '../brand/SegmentedControl'

// Switch único Pesos/Dólares para las pantallas de plata (Caja, Dashboard,
// Reportes) — 31/10/2026.
//
// IMPORTANTE: es solo PRESENTACIÓN. El peso es la fuente de verdad
// (pagos.monto siempre está en pesos, ver fn_registrar_pago_interno); esto
// divide por la cotización vigente nada más para mostrar. Por eso al lado
// del switch siempre va el chip con la cotización usada y su fecha.
//
// La elección se recuerda por dispositivo (localStorage): el dueño que mira
// todo en dólares no quiere volver a tildarlo en cada pantalla.
const STORAGE_KEY = 'prius_moneda_vista'

export function useMonedaVista() {
  const [moneda, setMonedaState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'USD' ? 'USD' : 'ARS'
    } catch {
      return 'ARS'
    }
  })
  const tc = useTipoCambio()

  const setMoneda = useCallback((m) => {
    setMonedaState(m)
    try { localStorage.setItem(STORAGE_KEY, m) } catch { /* modo privado: queda solo en memoria */ }
  }, [])

  // Si otra pestaña cambia la preferencia, esta se entera.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setMonedaState(e.newValue === 'USD' ? 'USD' : 'ARS')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const cotizacion = tc.valor
  /** Formatea un importe EN PESOS según la moneda elegida para mostrar. */
  const fmt = useCallback((pesos) => {
    if (moneda === 'USD') {
      if (!cotizacion || cotizacion <= 0) return '—'
      return formatMontoUSD((Number(pesos) || 0) / cotizacion)
    }
    return formatMonto(pesos)
  }, [moneda, cotizacion])

  return { moneda, setMoneda, fmt, cotizacion, stale: tc.stale, fecha: tc.fecha, tipo: tc.tipo, lado: tc.lado }
}

export default function MonedaSwitch({ moneda, onChange, cotizacion, fecha, stale, compacto = false }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {moneda === 'USD' && (
        <span
          className="text-label tabular-nums whitespace-nowrap"
          title={fecha ? `Cotización del ${formatFecha(fecha)}` : undefined}
        >
          {cotizacion ? formatMonto(cotizacion) : 'sin cotización'}
          {stale && <span className="font-semibold"> · vieja</span>}
        </span>
      )}
      <SegmentedControl
        label="Moneda"
        className="bg-card/60"
        value={moneda}
        onChange={onChange}
        options={[
          { value: 'ARS', label: compacto ? 'ARS' : 'Pesos' },
          { value: 'USD', label: compacto ? 'USD' : 'Dólares' },
        ]}
      />
    </div>
  )
}
