import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  QrCode, Search, CheckCircle2, AlertTriangle, Clock, Receipt, Wallet, Users as UsersIcon,
} from 'lucide-react'
import { useData } from '../context/DataProvider'
import { useDialog } from '../context/DialogProvider'
import { usePermiso } from '../context/AuthProvider'
import { reservaActiva, estadoBadgeStatus, coSocios } from '../lib/reservas'
import { normalizarCodigoReserva, codigoReservaValido } from '../lib/parse'
import { formatPesos, formatPesosVisible, formatFecha, formatFechaHora, formatRangoFechas, formatTelefono, unidadEmoji, formatUnidad, formatNombre} from '../lib/format'
import { MEDIO_PAGO_LABEL, ERROR_CAJA_CERRADA } from '../lib/pagos'
import { linkToComprobante } from '../lib/deepLinks'
import StatusBadge from '../components/crm/StatusBadge'
import MoneyInput from '../components/inputs/MoneyInput'
import { supabase } from '../lib/supabase'

// Lazy (Fase 1 mobile, oct 2026): EscanearQR importa `html5-qrcode`, que por
// sí solo pesa ~105KB gzip — antes se importaba eager acá arriba, así que
// se descargaba apenas se entraba a /app/recepcion aunque el flujo más común
// en el mostrador es tipear el código a mano. Ahora el chunk recién se pide
// cuando `scannerOpen` pasa a true (ver el render condicional más abajo); el
// ingreso manual no espera nada de esto.
const EscanearQR = lazy(() => import('../components/recepcion/EscanearQR'))

function EscanearQRFallback() {
  return (
    <div className="fixed inset-0 z-[999] bg-ink flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-line border-t-gold rounded-full animate-spin" />
      <p className="text-body text-ink-2">Abriendo cámara…</p>
    </div>
  )
}

const chipClass = (active) =>
  `px-3 py-2.5 rounded-icon text-xs font-bold border transition-all min-h-[44px] ${
    active ? 'bg-ink text-on-ink border-ink' : 'bg-surface text-ink-2 border-line hover:text-ink'
  }`

// Mismo +1 inclusivo que Reservas.jsx (balneario, no hotel — ver CLAUDE.md).
function diasEntre(desdeIso, hastaIso) {
  if (!desdeIso || !hastaIso) return null
  const [y1, m1, d1] = desdeIso.split('-').map(Number)
  const [y2, m2, d2] = hastaIso.split('-').map(Number)
  const ms = new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)
  return Math.round(ms / 86400000) + 1
}

function hoyIso() {
  return new Date().toISOString().split('T')[0]
}

function enRangoHoy(r, hoy) {
  if (r.tipo_alquiler === 'dia') return r.fecha === hoy
  if (r.tipo_alquiler === 'periodo') return r.fecha_inicio <= hoy && hoy <= r.fecha_fin
  return false
}

// Fase 3 — Recepción (CLAUDE.md "Recepción"): check-in + cobro de una
// reserva web por su código PRIUS-XXXXXX, escaneado o tipeado a mano. Un
// botón, menos de 30s por cliente. Toda la transacción vive en el RPC
// `recepcion_cobrar` — esta pantalla solo arma los parámetros y muestra el
// resultado; el plano, la caja, el Historial y las listas se actualizan
// solos por Realtime (mismo patrón "single write, multiple reactive reads").
export default function Recepcion() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { reservas, codigosReserva, cajaHoy, buscarPorCodigo, recepcionCobrar, iniciarCaja } = useData()
  const { alert, confirm } = useDialog()
  const puedeCheckinSinCobro = usePermiso('recepcion.checkin_sin_cobro')

  const codigoUrl = params.get('codigo') || ''
  const [inputManual, setInputManual] = useState('')
  const [scannerOpen, setScannerOpen] = useState(params.get('scan') === '1')
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [medio, setMedio] = useState('efectivo')
  const [ajustarPrecio, setAjustarPrecio] = useState(true)
  const [precioAjustado, setPrecioAjustado] = useState(null) // suma de cotizar() con el medio elegido, o null/undefined
  const [saving, setSaving] = useState(false)
  const [errorCobro, setErrorCobro] = useState(null) // { error, mensaje }
  const [exito, setExito] = useState(null) // { unidadesLabel, total, pagos }
  const [cajaCerrada, setCajaCerrada] = useState(false)
  const [montoApertura, setMontoApertura] = useState(null)
  const [abriendoCaja, setAbriendoCaja] = useState(false)
  const [checkinPorNombre, setCheckinPorNombre] = useState('')

  const grupo = useMemo(() => (codigoUrl ? buscarPorCodigo(codigoUrl) : null), [codigoUrl, buscarPorCodigo])
  const reservasGrupo = grupo?.reservas || []
  const codigoRow = grupo?.codigoRow || null
  const primera = reservasGrupo[0] || null

  // El medio elegido arranca siempre en el previsto al cargar una reserva nueva.
  useEffect(() => {
    if (codigoRow) { setMedio(codigoRow.metodo_pago_previsto); setAjustarPrecio(true); setErrorCobro(null) }
  }, [codigoRow?.codigo])

  // Preview de precio con el nuevo método (D2) — solo si difiere del previsto.
  useEffect(() => {
    if (!primera || !codigoRow || medio === codigoRow.metodo_pago_previsto) { setPrecioAjustado(null); return }
    let cancelado = false
    Promise.all(reservasGrupo.map((r) =>
      supabase.rpc('cotizar', {
        p_tipo_unidad: r.unidades?.tipo, p_tipo_alquiler: r.tipo_alquiler, p_metodo: medio,
        p_desde: r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_inicio,
        p_hasta: r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_fin,
      }),
    )).then((respuestas) => {
      if (cancelado) return
      if (respuestas.some((res) => res.error || res.data == null)) { setPrecioAjustado(null); return }
      setPrecioAjustado(respuestas.reduce((acc, res) => acc + Number(res.data), 0))
    })
    return () => { cancelado = true }
  }, [medio, codigoRow, primera, reservasGrupo])

  const totalGrupo = reservasGrupo.reduce((acc, r) => acc + Number(r.valor_total || 0), 0)
  const saldoGrupo = reservasGrupo.reduce((acc, r) => acc + Number(r.saldo || 0), 0)
  const pagadoGrupo = totalGrupo - saldoGrupo
  const hoy = hoyIso()
  const todasHoy = reservasGrupo.length > 0 && reservasGrupo.every((r) => enRangoHoy(r, hoy))
  const todasVigentes = reservasGrupo.length > 0 && reservasGrupo.every((r) => reservaActiva(r))
  const badgeStatus = primera ? estadoBadgeStatus(primera) : null
  const vencida = reservasGrupo.length > 0 && !todasVigentes
  const yaCheckin = !!codigoRow?.checkin_at

  // Nombre de quien hizo el check-in — solo se resuelve cuando hace falta
  // mostrarlo (nadie más en el front mantiene una lista de perfiles en memoria).
  useEffect(() => {
    if (!codigoRow?.checkin_por) { setCheckinPorNombre(''); return }
    supabase.from('perfiles').select('nombre').eq('user_id', codigoRow.checkin_por).maybeSingle()
      .then(({ data }) => setCheckinPorNombre(data?.nombre || ''))
  }, [codigoRow?.checkin_por])

  // "Llegan hoy": reservas web activas con código, sin check-in, hoy en rango.
  const lleganHoy = useMemo(() => {
    const codigosConCheckin = new Set(codigosReserva.filter((c) => c.checkin_at).map((c) => c.codigo))
    const porCodigo = {}
    for (const r of reservas) {
      if (r.origen !== 'web' || !r.codigo || codigosConCheckin.has(r.codigo)) continue
      if (!reservaActiva(r) || !enRangoHoy(r, hoy)) continue
      ;(porCodigo[r.codigo] ||= []).push(r)
    }
    return Object.entries(porCodigo).map(([codigo, rs]) => ({
      codigo, reservas: rs,
      titular: `${rs[0].clientes?.nombre || ''} ${rs[0].clientes?.apellido || ''}`.trim() || 'S/N',
      saldo: rs.reduce((acc, r) => acc + Number(r.saldo || 0), 0),
    }))
  }, [reservas, codigosReserva, hoy])

  const cargarCodigo = (raw) => {
    const normalizado = normalizarCodigoReserva(raw)
    if (!codigoReservaValido(normalizado)) {
      setErrorBusqueda('Ese código no tiene el formato correcto.')
      return
    }
    setErrorBusqueda('')
    setExito(null)
    setErrorCobro(null)
    setParams({ codigo: normalizado })
  }

  const handleScan = (texto) => {
    setScannerOpen(false)
    cargarCodigo(texto)
    // Punto 8 (30/10/2026): además de abrirla acá, se avisa al resto de los
    // dispositivos del MISMO usuario (típico: se escanea con el celular y la
    // compu, que está en Recepción, abre la reserva sola). RLS limita la
    // tabla al propio user_id, así que esto nunca cruza cuentas.
    // Best-effort: si falla, el escaneo local ya funcionó igual.
    supabase
      .from('recepcion_eventos')
      .insert({ codigo: String(texto || '').trim() || null, tipo: 'qr_scan' })
      .then(({ error }) => {
        if (error) console.warn('No se pudo avisar a los otros dispositivos:', error.message)
      })
  }

  const volverAlInicio = () => {
    setParams({})
    setInputManual('')
    setExito(null)
    setErrorCobro(null)
  }

  const ejecutarCobro = async ({ cobrar, hacerCheckin }) => {
    setSaving(true)
    setErrorCobro(null)
    try {
      const data = await recepcionCobrar({
        codigo: codigoUrl, medio, cobrar, hacerCheckin,
        ajustarPrecio: ajustarPrecio && medio !== codigoRow.metodo_pago_previsto,
      })
      if (!data.ok) { setErrorCobro(data); return }
      setExito({
        unidadesLabel: reservasGrupo.map((r) => `${unidadEmoji(r.unidades?.tipo)} ${formatUnidad(r.unidades?.tipo, r.unidades?.numero)}`).join(' + '),
        total: data.total_cobrado,
        pagos: data.pagos,
      })
    } catch (err) {
      if (err.code === ERROR_CAJA_CERRADA) { setCajaCerrada(true); return }
      await alert(err.message || 'No se pudo completar la operación.')
    } finally {
      setSaving(false)
    }
  }

  const handleAbrirCajaYReintentar = async (ultimaAccion) => {
    setAbriendoCaja(true)
    try {
      await iniciarCaja(montoApertura || 0)
      setCajaCerrada(false)
      await ejecutarCobro(ultimaAccion)
    } catch (err) {
      await alert(err.message || 'No se pudo abrir la caja.')
    } finally {
      setAbriendoCaja(false)
    }
  }

  const handleCheckinSinCobrar = async () => {
    const ok = await confirm(
      `Queda un saldo de ${formatPesos(saldoGrupo)} sin cobrar. ¿Hacer el check-in igual?`,
      { title: 'Check-in sin cobrar', tone: 'error' },
    )
    if (ok) ejecutarCobro({ cobrar: false, hacerCheckin: true })
  }

  const crearReservaNueva = () => {
    if (!primera) return
    navigate(`/app/reservas?unidad=${primera.unidad_id}&tipo=${primera.tipo_alquiler}`)
  }

  const MENSAJE_ERROR = {
    no_encontrada: 'No encontramos ese código de reserva.',
    vencida: 'Esta reserva venció y la unidad se liberó.',
    ya_checkin: 'Esta reserva ya hizo check-in.',
    fuera_de_fecha: 'Todavía no llegó la fecha de esta reserva.',
    sin_tarifa_medio: 'No hay tarifa cargada para ese método de pago en esas fechas.',
    saldo_pendiente: 'Queda saldo pendiente: solo un superadmin puede hacer el check-in sin cobrar.',
  }

  return (
    <div className="space-y-6 animate-premium-fade">
      {scannerOpen && (
        <Suspense fallback={<EscanearQRFallback />}>
          <EscanearQR isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
        </Suspense>
      )}

      <h1 className="sr-only">Recepción</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda: escanear / tipear / llegan hoy */}
        <div className="space-y-4">
          <button
            onClick={() => setScannerOpen(true)}
            className="text-body font-semibold w-full h-14 bg-ink hover:bg-chart-2 rounded-full transition-all flex items-center justify-center gap-3 text-on-ink"
          >
            <QrCode size={22} /> Escanear QR
          </button>

          <div className="card-surface p-4 space-y-3">
            <label className="text-label text-ink-2">Código de reserva</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputManual}
                onChange={(e) => setInputManual(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') cargarCodigo(inputManual) }}
                placeholder="Ej: PRIUS-A3X9K2"
                className="text-label flex-1 bg-surface rounded-inner px-4 py-3 text-ink text-base outline-none border border-transparent focus:ring-2 focus:ring-gold"
              />
              <button
                onClick={() => cargarCodigo(inputManual)}
                className="px-4 py-3 bg-surface hover:bg-surface border border-line rounded-full text-ink transition-all"
              >
                <Search size={18} />
              </button>
            </div>
            {errorBusqueda && <p className="text-label text-danger">{errorBusqueda}</p>}
          </div>

          <div className="card-surface p-4 space-y-3">
            <p className="text-label text-ink-2">Llegan hoy</p>
            {lleganHoy.length === 0 ? (
              <p className="text-label text-ink-2">Nadie con reserva web pendiente de check-in hoy.</p>
            ) : (
              <div className="space-y-2">
                {lleganHoy.map((item) => (
                  <button
                    key={item.codigo}
                    onClick={() => cargarCodigo(item.codigo)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 bg-surface hover:bg-surface border border-line rounded-inner text-left transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-label text-ink truncate">{item.titular}</p>
                      <p className="text-label text-ink-2">
                        {item.codigo} · {item.reservas.map((r) => `${unidadEmoji(r.unidades?.tipo)} ${r.unidades?.numero}`).join(' ')}
                      </p>
                    </div>
                    {item.saldo > 0 && <span className="shrink-0 text-label font-semibold text-danger">{formatPesos(item.saldo)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: tarjeta de la reserva cargada */}
        <div>
          {!codigoUrl ? (
            <div className="card-surface p-8 text-center text-ink-2 text-body">
              Escaneá un QR o cargá un código para empezar.
            </div>
          ) : exito ? (
            <div className="card-surface p-8 text-center space-y-4">
              <CheckCircle2 className="mx-auto text-success-ink" size={40} />
              <div>
                <p className="text-card-title text-ink">Listo — {exito.unidadesLabel}</p>
                {exito.total > 0 && <p className="text-body text-ink-2 mt-1">Cobrado: {formatPesos(exito.total)}</p>}
              </div>
              {exito.pagos.length > 0 && (
                <div className="space-y-1">
                  {exito.pagos.map((p) => (
                    <button
                      key={p.pago_id}
                      onClick={() => navigate(linkToComprobante(p.reserva_id))}
                      className="text-label text-ink hover:text-ink transition-all flex items-center gap-1 mx-auto"
                    >
                      <Receipt size={12} /> Cargar comprobante
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={volverAlInicio}
                className="text-label w-full py-3.5 bg-ink hover:bg-chart-2 rounded-full transition-all text-on-ink"
              >
                Siguiente cliente
              </button>
            </div>
          ) : !grupo || !primera ? (
            <div className="card-surface p-8 text-center text-ink-2 text-body">
              No encontramos ese código de reserva.
            </div>
          ) : (
            <div className="card-surface p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label text-ink-2">{codigoRow.codigo}</p>
                  <h2 className="text-base font-semibold text-ink truncate">
                    {formatNombre(primera.clientes?.nombre)} {primera.clientes?.apellido}
                  </h2>
                  <p className="text-label text-ink-2">{formatTelefono(primera.clientes?.telefono)}</p>
                </div>
                <StatusBadge status={badgeStatus} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {reservasGrupo.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-line rounded-icon text-label text-ink">
                    {unidadEmoji(r.unidades?.tipo)} {formatUnidad(r.unidades?.tipo, r.unidades?.numero)}
                  </span>
                ))}
              </div>
              {codigoRow.unidades_contiguas === false && (
                <p className="text-label text-ink flex items-center gap-1.5"><AlertTriangle size={12} /> Las unidades no están juntas.</p>
              )}
              {coSocios(primera).length > 0 && (
                <p className="text-label text-ink-2 flex items-center gap-1.5">
                  <UsersIcon size={12} /> Co-socios: {coSocios(primera).map((s) => formatNombre(s.nombre)).join(', ')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-label">
                <div>
                  <p className="text-label text-ink-2">Fechas</p>
                  <p className="text-ink mt-0.5">
                    {primera.tipo_alquiler === 'dia' ? formatFecha(primera.fecha) : formatRangoFechas(primera.fecha_inicio, primera.fecha_fin)}
                    {' · '}{diasEntre(primera.fecha_inicio || primera.fecha, primera.fecha_fin || primera.fecha)} días
                  </p>
                </div>
                <div>
                  <p className="text-label text-ink-2">Personas</p>
                  <p className="text-ink mt-0.5">{reservasGrupo.reduce((acc, r) => acc + (r.cantidad_personas || 0), 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface border border-line rounded-inner text-center">
                  <p className="text-label text-ink-2">Total</p>
                  <p className="text-body font-semibold text-ink mt-1">{formatPesosVisible(totalGrupo)}</p>
                </div>
                <div className="p-3 bg-surface border border-line rounded-inner text-center">
                  <p className="text-label text-ink-2">Pagado</p>
                  <p className="text-body font-semibold text-success-ink mt-1">{formatPesosVisible(pagadoGrupo)}</p>
                </div>
                <div className="p-3 bg-surface border border-line rounded-inner text-center">
                  <p className="text-label text-ink-2">Saldo</p>
                  <p className="text-body font-semibold text-ink mt-1">{formatPesosVisible(saldoGrupo)}</p>
                </div>
              </div>

              {!vencida && !yaCheckin && (
                <div className="space-y-2">
                  <label className="text-label text-ink-2">Medio de pago</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setMedio(value)} className={chipClass(medio === value)}>{label}</button>
                    ))}
                  </div>
                  {medio !== codigoRow.metodo_pago_previsto && (
                    <div className="p-3 bg-gold-100 border border-gold-300 rounded-inner space-y-2">
                      <p className="text-label text-ink-2">
                        Reservó con {MEDIO_PAGO_LABEL[codigoRow.metodo_pago_previsto]}: {formatPesos(totalGrupo)}
                        {' · '}En {MEDIO_PAGO_LABEL[medio]}: {precioAjustado != null ? formatPesos(precioAjustado) : '—'}
                      </p>
                      <label className="flex items-center gap-2 text-label text-ink-2 cursor-pointer">
                        <input type="checkbox" checked={ajustarPrecio} onChange={(e) => setAjustarPrecio(e.target.checked)} className="accent-gold" />
                        Se cobra el precio de {MEDIO_PAGO_LABEL[medio]}
                      </label>
                    </div>
                  )}
                </div>
              )}

              {errorCobro && (
                <p className="text-label text-danger flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {errorCobro.mensaje || MENSAJE_ERROR[errorCobro.error] || 'No se pudo completar la operación.'}
                </p>
              )}

              {vencida ? (
                <div className="space-y-3">
                  <p className="text-body text-ink flex items-center gap-2"><AlertTriangle size={16} /> Reserva vencida — la unidad se liberó.</p>
                  <button
                    onClick={crearReservaNueva}
                    className="text-label w-full py-3.5 bg-surface hover:bg-surface border border-line text-ink rounded-inner transition-all"
                  >
                    Crear reserva nueva
                  </button>
                </div>
              ) : yaCheckin ? (
                <div className="space-y-3">
                  <p className="text-label text-ink-2 flex items-center gap-1.5">
                    <Clock size={13} /> Check-in hecho el {formatFechaHora(codigoRow.checkin_at)}
                    {checkinPorNombre ? ` por ${checkinPorNombre}` : ''}
                  </p>
                  {saldoGrupo > 0 && (
                    <button
                      disabled={saving}
                      onClick={() => ejecutarCobro({ cobrar: true, hacerCheckin: false })}
                      className="text-label w-full py-3.5 bg-ink hover:bg-chart-2 disabled:opacity-50 rounded-full transition-all text-on-ink"
                    >
                      {saving ? 'Registrando...' : `Registrar pago ${formatPesos(saldoGrupo)}`}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    disabled={saving}
                    onClick={() => ejecutarCobro({ cobrar: true, hacerCheckin: todasHoy })}
                    className="text-label w-full py-4 bg-ink hover:bg-chart-2 disabled:opacity-50 rounded-full transition-all text-on-ink"
                  >
                    {saving
                      ? 'Procesando...'
                      : todasHoy
                        ? (saldoGrupo > 0 ? `Cobrar ${formatPesos(precioAjustado && ajustarPrecio ? precioAjustado : saldoGrupo)} y hacer check-in` : 'Hacer check-in')
                        : `Cobrar por adelantado ${formatPesos(precioAjustado && ajustarPrecio ? precioAjustado : saldoGrupo)}`}
                  </button>
                  {!todasHoy && (
                    <p className="text-label text-ink-2 flex items-center gap-1.5">
                      <Clock size={12} /> Llega el {primera.tipo_alquiler === 'dia' ? formatFecha(primera.fecha) : formatFecha(primera.fecha_inicio)}
                    </p>
                  )}
                  {saldoGrupo > 0 && puedeCheckinSinCobro && (
                    <button
                      disabled={saving}
                      onClick={handleCheckinSinCobrar}
                      className="text-label w-full py-2.5 text-ink-2 hover:text-ink transition-all"
                    >
                      Check-in sin cobrar
                    </button>
                  )}
                </div>
              )}

              {/* Oct 2026: antes solo aparecía reactivo, después de que el
                  cobro fallara con P0003 — ahora es proactivo, se ve apenas
                  se abre la reserva si no hay caja hoy, sin esperar a que
                  el usuario intente cobrar primero. */}
              {(cajaCerrada || !cajaHoy) && (
                <div className="p-4 bg-gold-100 border border-gold-300 rounded-inner space-y-3">
                  <p className="text-body text-ink-2 flex items-center gap-2"><Wallet size={16} className="text-ink shrink-0" /> No hay caja abierta hoy — hace falta para cobrar.</p>
                  <MoneyInput label="Monto inicial de caja" value={montoApertura} onChange={setMontoApertura} max={10_000_000} />
                  <button
                    disabled={abriendoCaja}
                    onClick={() => handleAbrirCajaYReintentar({ cobrar: true, hacerCheckin: todasHoy })}
                    className="text-label w-full py-3 min-h-[44px] bg-ink hover:bg-chart-2 disabled:opacity-50 rounded-full transition-all text-on-ink"
                  >
                    {abriendoCaja ? 'Abriendo...' : 'Abrir caja y cobrar'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
