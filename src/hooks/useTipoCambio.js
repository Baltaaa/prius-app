import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Punto 4 (30/10/2026): cotización vigente del dólar para el CRM.
//
// El peso sigue siendo la moneda principal: esto solo sirve para convertir.
// Lee la preferencia del balneario (oficial/blue, compra/venta) de
// `config_tipo_cambio` y la cotización de `tipos_cambio`, y dispara la Edge
// Function `tipo-cambio` para refrescarla (la API externa nunca se consulta
// desde el browser). Si la API falla, queda la última guardada y `stale`
// pasa a true para que la UI lo avise.
export function useTipoCambio() {
  const [config, setConfig] = useState({ tipo: 'oficial', lado: 'venta' })
  const [cotizaciones, setCotizaciones] = useState({})
  const [loading, setLoading] = useState(true)

  const leerDeBase = useCallback(async () => {
    const [cfg, tc] = await Promise.all([
      supabase.from('config_tipo_cambio').select('tipo, lado').maybeSingle(),
      supabase.from('tipos_cambio').select('fecha, tipo, compra, venta, updated_at').order('fecha', { ascending: false }).limit(10),
    ])
    if (cfg.data) setConfig({ tipo: cfg.data.tipo, lado: cfg.data.lado })
    if (tc.data) {
      // La primera de cada tipo es la más reciente (vienen ordenadas por fecha).
      const porTipo = {}
      for (const fila of tc.data) if (!porTipo[fila.tipo]) porTipo[fila.tipo] = fila
      setCotizaciones(porTipo)
    }
    setLoading(false)
  }, [])

  const refrescar = useCallback(async () => {
    try {
      await supabase.functions.invoke('tipo-cambio')
    } catch {
      // Sin ruido: si no se pudo refrescar, abajo igual se lee lo cacheado.
    }
    await leerDeBase()
  }, [leerDeBase])

  useEffect(() => {
    leerDeBase().then(refrescar)
    // Solo al montar: refrescar en cada render sería pegarle a DolarApi de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fila = cotizaciones[config.tipo] || null
  const valor = fila ? Number(fila[config.lado] ?? fila.venta) : null
  const hoy = new Date().toISOString().split('T')[0]

  return {
    loading,
    /** Cotización efectiva según la preferencia configurada (pesos por dólar). */
    valor: Number.isFinite(valor) && valor > 0 ? valor : null,
    tipo: config.tipo,
    lado: config.lado,
    fecha: fila?.fecha || null,
    updatedAt: fila?.updated_at || null,
    /** true => la cotización no es de hoy (la API falló y se usa la última). */
    stale: !!fila && fila.fecha !== hoy,
    cotizaciones,
    refrescar,
    setConfig,
  }
}

/** Pesos que se imputan al saldo por un importe en dólares. */
export function usdAPesos(montoUsd, cotizacion) {
  const m = Number(montoUsd)
  const c = Number(cotizacion)
  if (!Number.isFinite(m) || !Number.isFinite(c) || c <= 0) return null
  return Math.round(m * c * 100) / 100
}
