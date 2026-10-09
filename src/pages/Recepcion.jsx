import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  QrCode, Search, CheckCircle2, AlertTriangle, Clock, Receipt, Wallet, Users as UsersIcon,
} from 'lucide-react'
import { useData } from '../context/DataProvider'
import { useDialog } from '../context/DialogProvider'
import { usePermiso } from '../context/AuthProvider'
import { reservaActiva, estadoBadgeStatus, coSocios } from '../lib/reservas'
import { normalizarCodigoReserva, codigoReservaValido } from '../lib/parse'
import { formatPesos, formatPesosVisible, formatFecha, formatFechaHora, formatRangoFechas, formatTelefono, unidadEmoji } from '../lib/format'
import { MEDIO_PAGO_LABEL, ERROR_CAJA_CERRADA } from '../lib/pagos'
import { linkToComprobante } from '../lib/deepLinks'
import StatusBadge from '../components/crm/StatusBadge'
import MoneyInput from '../components/inputs/MoneyInput'
import EscanearQR from '../components/recepcion/EscanearQR'
import { supabase } from '../lib/supabase'

const chipClass = (active) =>
  `px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
    active ? 'bg-[#FDE047] text-black border-[#FDE047]' : 'bg-white/5 text-gray-300 border-white/10 hover:text-white'
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
        unidadesLabel: reservasGrupo.map((r) => `${unidadEmoji(r.unidades?.tipo)} ${r.unidades?.tipo} #${r.unidades?.numero}`).join(' + '),
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
      <EscanearQR isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />

      <div className="flex items-center gap-3">
        <QrCode className="text-[#FDE047]" size={22} />
        <h1 className="text-lg font-bold text-white uppercase tracking-wider">Recepción</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda: escanear / tipear / llegan hoy */}
        <div className="space-y-4">
          <button
            onClick={() => setScannerOpen(true)}
            className="w-full py-6 bg-[#FDE047] hover:bg-yellow-300 text-black rounded-2xl font-bold text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            <QrCode size={22} /> Escanear QR
          </button>

          <div className="glass-card p-4 rounded-2xl space-y-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Código de reserva</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputManual}
                onChange={(e) => setInputManual(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') cargarCodigo(inputManual) }}
                placeholder="Ej: PRIUS-A3X9K2"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold uppercase tracking-wider focus:border-[#FDE047]/50 outline-none"
              />
              <button
                onClick={() => cargarCodigo(inputManual)}
                className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all"
              >
                <Search size={18} />
              </button>
            </div>
            {errorBusqueda && <p className="text-[11px] text-red-400">{errorBusqueda}</p>}
          </div>

          <div className="glass-card p-4 rounded-2xl space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Llegan hoy</p>
            {lleganHoy.length === 0 ? (
              <p className="text-xs text-gray-500">Nadie con reserva web pendiente de check-in hoy.</p>
            ) : (
              <div className="space-y-2">
                {lleganHoy.map((item) => (
                  <button
                    key={item.codigo}
                    onClick={() => cargarCodigo(item.codigo)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white uppercase truncate">{item.titular}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                        {item.codigo} · {item.reservas.map((r) => `${unidadEmoji(r.unidades?.tipo)} #${r.unidades?.numero}`).join(' ')}
                      </p>
                    </div>
                    {item.saldo > 0 && <span className="shrink-0 text-xs font-bold text-red-400">{formatPesos(item.saldo)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: tarjeta de la reserva cargada */}
        <div>
          {!codigoUrl ? (
            <div className="glass-card p-8 rounded-2xl text-center text-gray-500 text-sm">
              Escaneá un QR o cargá un código para empezar.
            </div>
          ) : exito ? (
            <div className="glass-card p-8 rounded-2xl text-center space-y-4">
              <CheckCircle2 className="mx-auto text-green-400" size={40} />
              <div>
                <p className="text-lg font-bold text-white">Listo — {exito.unidadesLabel}</p>
                {exito.total > 0 && <p className="text-sm text-gray-400 mt-1">Cobrado: {formatPesos(exito.total)}</p>}
              </div>
              {exito.pagos.length > 0 && (
                <div className="space-y-1">
                  {exito.pagos.map((p) => (
                    <button
                      key={p.pago_id}
                      onClick={() => navigate(linkToComprobante(p.reserva_id))}
                      className="text-[11px] font-bold uppercase tracking-widest text-[#FDE047] hover:text-yellow-300 transition-all flex items-center gap-1 mx-auto"
                    >
                      <Receipt size={12} /> Cargar comprobante
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={volverAlInicio}
                className="w-full py-3.5 bg-[#FDE047] hover:bg-yellow-300 text-black rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all"
              >
                Siguiente cliente
              </button>
            </div>
          ) : !grupo || !primera ? (
            <div className="glass-card p-8 rounded-2xl text-center text-gray-500 text-sm">
              No encontramos ese código de reserva.
            </div>
          ) : (
            <div className="glass-card p-6 rounded-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{codigoRow.codigo}</p>
                  <h2 className="text-base font-bold text-white uppercase truncate">
                    {primera.clientes?.nombre} {primera.clientes?.apellido}
                  </h2>
                  <p className="text-xs text-gray-400">{formatTelefono(primera.clientes?.telefono)}</p>
                </div>
                <StatusBadge status={badgeStatus} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {reservasGrupo.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                    {unidadEmoji(r.unidades?.tipo)} {r.unidades?.tipo} #{r.unidades?.numero}
                  </span>
                ))}
              </div>
              {codigoRow.unidades_contiguas === false && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1.5"><AlertTriangle size={12} /> Las unidades no están juntas.</p>
              )}
              {coSocios(primera).length > 0 && (
                <p className="text-[11px] text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <UsersIcon size={12} /> Co-socios: {coSocios(primera).map((s) => s.nombre).join(', ')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Fechas</p>
                  <p className="text-white mt-0.5">
                    {primera.tipo_alquiler === 'dia' ? formatFecha(primera.fecha) : formatRangoFechas(primera.fecha_inicio, primera.fecha_fin)}
                    {' · '}{diasEntre(primera.fecha_inicio || primera.fecha, primera.fecha_fin || primera.fecha)} días
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Personas</p>
                  <p className="text-white mt-0.5">{reservasGrupo.reduce((acc, r) => acc + (r.cantidad_personas || 0), 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest">Total</p>
                  <p className="text-sm font-bold text-white mt-1">{formatPesosVisible(totalGrupo)}</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest">Pagado</p>
                  <p className="text-sm font-bold text-green-400 mt-1">{formatPesosVisible(pagadoGrupo)}</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest">Saldo</p>
                  <p className="text-sm font-bold text-[#FDE047] mt-1">{formatPesosVisible(saldoGrupo)}</p>
                </div>
              </div>

              {!vencida && !yaCheckin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Medio de pago</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(MEDIO_PAGO_LABEL).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setMedio(value)} className={chipClass(medio === value)}>{label}</button>
                    ))}
                  </div>
                  {medio !== codigoRow.metodo_pago_previsto && (
                    <div className="p-3 bg-[#FDE047]/5 border border-[#FDE047]/20 rounded-xl space-y-2">
                      <p className="text-xs text-gray-300">
                        Reservó con {MEDIO_PAGO_LABEL[codigoRow.metodo_pago_previsto]}: {formatPesos(totalGrupo)}
                        {' · '}En {MEDIO_PAGO_LABEL[medio]}: {precioAjustado != null ? formatPesos(precioAjustado) : '—'}
                      </p>
                      <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={ajustarPrecio} onChange={(e) => setAjustarPrecio(e.target.checked)} className="accent-[#FDE047]" />
                        Se cobra el precio de {MEDIO_PAGO_LABEL[medio]}
                      </label>
                    </div>
                  )}
                </div>
              )}

              {errorCobro && (
                <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {errorCobro.mensaje || MENSAJE_ERROR[errorCobro.error] || 'No se pudo completar la operación.'}
                </p>
              )}

              {vencida ? (
                <div className="space-y-3">
                  <p className="text-sm text-amber-400 flex items-center gap-2"><AlertTriangle size={16} /> Reserva vencida — la unidad se liberó.</p>
                  <button
                    onClick={crearReservaNueva}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all"
                  >
                    Crear reserva nueva
                  </button>
                </div>
              ) : yaCheckin ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Clock size={13} /> Check-in hecho el {formatFechaHora(codigoRow.checkin_at)}
                    {checkinPorNombre ? ` por ${checkinPorNombre}` : ''}
                  </p>
                  {saldoGrupo > 0 && (
                    <button
                      disabled={saving}
                      onClick={() => ejecutarCobro({ cobrar: true, hacerCheckin: false })}
                      className="w-full py-3.5 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all"
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
                    className="w-full py-4 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black font-bold uppercase tracking-[0.2em] rounded-xl text-sm transition-all shadow-xl"
                  >
                    {saving
                      ? 'Procesando...'
                      : todasHoy
                        ? (saldoGrupo > 0 ? `Cobrar ${formatPesos(precioAjustado && ajustarPrecio ? precioAjustado : saldoGrupo)} y hacer check-in` : 'Hacer check-in')
                        : `Cobrar por adelantado ${formatPesos(precioAjustado && ajustarPrecio ? precioAjustado : saldoGrupo)}`}
                  </button>
                  {!todasHoy && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <Clock size={12} /> Llega el {primera.tipo_alquiler === 'dia' ? formatFecha(primera.fecha) : formatFecha(primera.fecha_inicio)}
                    </p>
                  )}
                  {saldoGrupo > 0 && puedeCheckinSinCobro && (
                    <button
                      disabled={saving}
                      onClick={handleCheckinSinCobrar}
                      className="w-full py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
                    >
                      Check-in sin cobrar
                    </button>
                  )}
                </div>
              )}

              {cajaCerrada && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                  <p className="text-sm text-gray-300 flex items-center gap-2"><Wallet size={16} className="text-[#FDE047]" /> No hay caja abierta hoy.</p>
                  <MoneyInput label="Monto inicial de caja" value={montoApertura} onChange={setMontoApertura} max={10_000_000} />
                  <button
                    disabled={abriendoCaja}
                    onClick={() => handleAbrirCajaYReintentar({ cobrar: true, hacerCheckin: todasHoy })}
                    className="w-full py-3 bg-[#FDE047] hover:bg-yellow-300 disabled:opacity-50 text-black rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all"
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
