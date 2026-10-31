import { useCallback, useEffect, useState } from 'react'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { formatPesos, formatDolares, formatFecha } from '../../lib/format'

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
      return formatDolares((Number(pesos) || 0) / cotizacion)
    }
    return formatPesos(pesos)
  }, [moneda, cotizacion])

  return { moneda, setMoneda, fmt, cotizacion, stale: tc.stale, fecha: tc.fecha, tipo: tc.tipo, lado: tc.lado }
}

export default function MonedaSwitch({ moneda, onChange, cotizacion, fecha, stale, compacto = false }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-1 bg-prius-subtle p-1 rounded-xl">
        {['ARS', 'USD'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={`px-2.5 py-1 rounded-lg text-label-md font-bold transition-colors ${
              moneda === m ? 'bg-white text-black shadow-sm' : 'text-prius-slate hover:text-black'
            }`}
          >
            {m === 'ARS' ? '🇦🇷' : '🇺🇸'}{compacto ? '' : ` ${m === 'ARS' ? 'Pesos' : 'Dólares'}`}
          </button>
        ))}
      </div>
      {moneda === 'USD' && (
        <span
          className="text-label-md text-prius-slate tabular-nums whitespace-nowrap"
          title={fecha ? `Cotización del ${formatFecha(fecha)}` : undefined}
        >
          {cotizacion ? formatPesos(cotizacion) : 'sin cotización'}
          {stale && <span className="text-amber-500 font-semibold"> · vieja</span>}
        </span>
      )}
    </div>
  )
}
