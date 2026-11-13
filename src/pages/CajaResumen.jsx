import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileDown, AlertTriangle } from 'lucide-react'
import { useRpc } from '../hooks/useRpcCache'
import { useDialog } from '../context/DialogProvider'
import { usePermiso } from '../context/AuthProvider'
import { supabase } from '../lib/supabase'
import { descargarCierrePdf } from '../lib/reportePdf'
import BadgeFactura from '../components/crm/BadgeFactura'
import Skeleton from '../components/ui/Skeleton'
import { formatMonto, formatPorcentaje, formatFechaLarga } from '../lib/format'
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_EMOJI } from '../lib/pagos'
import { unidadEmoji } from '../lib/unidadIcono'

// Vista mobile del cierre de un día (nov 2026) — es a donde lleva el botón
// del WhatsApp y el tap en la notificación push.
//
// Ruta propia fuera de /app a propósito: se abre desde el celular, de un
// aviso, para mirar un número y cerrar. Sin sidebar ni bottom nav. Los
// números salen de resumen_cierre_caja, la misma fuente que el aviso.
//
// Sin sesión, PrivateRoute manda a /login guardando el deep link, así que
// después de entrar se vuelve acá solo.

function Fila({ label, valor, sub, tono }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-line last:border-0">
      <div className="min-w-0">
        <p className="text-body text-ink truncate">{label}</p>
        {sub && <p className="text-label text-ink-2 truncate">{sub}</p>}
      </div>
      <span className={`text-body font-semibold tabular-nums shrink-0 ${tono || 'text-ink'}`}>{valor}</span>
    </div>
  )
}

export default function CajaResumen() {
  const { fecha } = useParams()
  const navigate = useNavigate()
  const { toast } = useDialog()
  const puedeReenviar = usePermiso('reabrir_caja') // superadmin
  const [cajaId, setCajaId] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [buscando, setBuscando] = useState(true)

  // La ruta trae la fecha, no el id: se resuelve una vez por fecha.
  useEffect(() => {
    let vivo = true
    setBuscando(true)
    supabase
      .from('caja_diaria').select('id').eq('fecha', fecha).maybeSingle()
      .then(({ data }) => { if (vivo) { setCajaId(data?.id ?? null); setBuscando(false) } })
    return () => { vivo = false }
  }, [fecha])

  const params = useMemo(() => (cajaId ? { p_caja_id: cajaId } : null), [cajaId])
  const { datos: r, cargando } = useRpc('resumen_cierre_caja', params, { activo: !!cajaId })

  const handlePdf = async () => {
    if (!cajaId) return
    setGenerando(true)
    try {
      await descargarCierrePdf(cajaId)
    } catch (err) {
      toast(err.message || 'No pudimos generar el PDF.', { tone: 'error' })
    } finally {
      setGenerando(false)
    }
  }

  const egr = r?.egresos || {}
  const ocup = r?.ocupacion || {}

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 bg-canvas/90 backdrop-blur border-b border-line">
        <div className="flex items-center gap-3 px-page h-14 pt-topbar box-content">
          <button
            type="button"
            onClick={() => navigate('/app/caja')}
            aria-label="Volver a Caja"
            className="w-11 h-11 -ml-2 rounded-full inline-flex items-center justify-center text-ink-2 hover:bg-surface"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-label text-ink-2">Cierre de caja</p>
            <h1 className="text-body font-semibold text-ink truncate">{formatFechaLarga(fecha)}</h1>
          </div>
        </div>
      </header>

      <main className="px-page py-grid space-y-grid max-w-2xl mx-auto pb-24">
        {buscando || cargando ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : !cajaId ? (
          <div className="card-surface card-pad flex items-start gap-3">
            <AlertTriangle size={18} className="text-ink-2 shrink-0 mt-1" />
            <div>
              <p className="text-body text-ink">No hay ninguna caja para ese día.</p>
              <p className="text-label text-ink-2 mt-1">Revisá la fecha o abrí Caja diaria y navegá con las flechas.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="card-surface card-pad-hero">
              <p className="text-label text-ink-2">Resultado neto</p>
              <p className={`text-kpi tabular-nums whitespace-nowrap mt-1 ${Number(r?.neto || 0) >= 0 ? 'text-ink' : 'text-danger'}`}>
                {formatMonto(r?.neto)}
              </p>
              <p className="text-label text-ink-2 mt-2">
                {r?.cierre?.quien || '—'}
                {r?.cierre?.arqueo_pendiente ? ' · arqueo pendiente' : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-grid">
              <div className="card-surface card-pad">
                <p className="text-label text-ink-2">Ingresos</p>
                <p className="text-card-title text-ink tabular-nums mt-1">{formatMonto(r?.ingresos?.total)}</p>
              </div>
              <div className="card-surface card-pad">
                <p className="text-label text-ink-2">Egresos</p>
                <p className="text-card-title text-danger tabular-nums mt-1">{formatMonto(egr.total)}</p>
                <p className="text-label text-ink-2 mt-1">
                  {egr.pct_sf == null ? 'Sin egresos' : `${formatPorcentaje(egr.pct_sf, 1)} sin factura`}
                </p>
              </div>
            </div>

            <section className="card-surface card-pad space-y-2">
              <h2 className="section-label text-ink">Ingresos por medio de pago</h2>
              {(r?.ingresos?.por_medio || []).length === 0 ? (
                <p className="text-label text-ink-2">Sin cobros en esta caja.</p>
              ) : r.ingresos.por_medio.map((m) => (
                <Fila
                  key={m.medio}
                  label={`${MEDIO_PAGO_EMOJI[m.medio] || ''} ${MEDIO_PAGO_LABEL[m.medio] || m.medio}`.trim()}
                  sub={`${m.cantidad} ${m.cantidad === 1 ? 'movimiento' : 'movimientos'}`}
                  valor={formatMonto(m.ingresos)}
                />
              ))}
            </section>

            <section className="card-surface card-pad space-y-2">
              <h2 className="section-label text-ink">Egresos</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="card-inner">
                  <p className="text-label text-ink-2 flex items-center gap-2"><BadgeFactura tipo="F" /> Con factura</p>
                  <p className="text-body text-ink tabular-nums mt-1">{formatMonto(egr.total_f)}</p>
                </div>
                <div className="card-inner">
                  <p className="text-label text-ink-2 flex items-center gap-2"><BadgeFactura tipo="SF" /> Sin factura</p>
                  <p className="text-body text-ink tabular-nums mt-1">{formatMonto(egr.total_sf)}</p>
                </div>
              </div>
              {(egr.por_categoria || []).map((c) => (
                <Fila key={c.categoria} label={c.nombre || c.categoria} valor={formatMonto(c.total)} tono="text-danger" />
              ))}
            </section>

            <section className="card-surface card-pad space-y-2">
              <h2 className="section-label text-ink">Ocupación del día</h2>
              <Fila
                label="Total"
                valor={ocup.total?.pct == null ? '—' : formatPorcentaje(ocup.total.pct, 1)}
                sub={`${ocup.total?.ocupadas ?? 0} de ${ocup.total?.total ?? 0}`}
              />
              {(ocup.por_tipo || []).map((t) => (
                <Fila
                  key={t.tipo}
                  label={`${unidadEmoji(t.tipo) || ''} ${t.tipo}`.trim()}
                  sub={`${t.ocupadas} de ${t.total}`}
                  valor={t.pct == null ? '—' : formatPorcentaje(t.pct, 1)}
                />
              ))}
            </section>

            {r?.z?.numero && (
              <section className="card-surface card-pad space-y-2">
                <h2 className="section-label text-ink">Cierre Z</h2>
                <Fila label={`Z N° ${r.z.numero}`} sub={`${r.z.cantidad_comprobantes ?? 0} comprobantes`} valor={formatMonto(r.z.total)} />
              </section>
            )}
          </>
        )}
      </main>

      {cajaId && (
        <div className="fixed bottom-0 inset-x-0 px-page pt-3 bg-canvas/90 backdrop-blur border-t border-line"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <div className="max-w-2xl mx-auto flex gap-3">
            <button
              type="button"
              onClick={handlePdf}
              disabled={generando}
              className="flex-1 min-h-[44px] rounded-full bg-ink text-on-ink text-label inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileDown size={16} /> {generando ? 'Generando…' : 'Descargar PDF'}
            </button>
            {puedeReenviar && <ReenviarAviso cajaId={cajaId} />}
          </div>
        </div>
      )}
    </div>
  )
}

/** Reenviar el aviso de esta caja. Solo superadmin; no crea ni toca cajas. */
function ReenviarAviso({ cajaId }) {
  const { toast } = useDialog()
  const [enviando, setEnviando] = useState(false)
  const handle = async () => {
    setEnviando(true)
    try {
      const { invocarFuncion } = await import('../lib/invocarFuncion')
      const data = await invocarFuncion('notificar-cierre-caja', { body: { modo: 'reenviar', caja_id: cajaId } })
      const ok = Object.values(data?.resultado || {}).some((c) => c?.ok)
      toast(ok ? 'Resumen reenviado' : 'No se pudo enviar por ningún canal. Revisá Configuración.', { tone: ok ? 'success' : 'error' })
    } catch (err) {
      toast(err.message || 'No pudimos reenviar el resumen.', { tone: 'error' })
    } finally {
      setEnviando(false)
    }
  }
  return (
    <button
      type="button"
      onClick={handle}
      disabled={enviando}
      className="min-h-[44px] px-4 rounded-full bg-surface text-ink border border-line text-label disabled:opacity-50"
    >
      {enviando ? 'Enviando…' : 'Reenviar'}
    </button>
  )
}
