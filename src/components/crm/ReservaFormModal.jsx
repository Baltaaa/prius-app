import { useState, useEffect, useMemo, useRef } from 'react'
import { useReservas } from '../../hooks/useReservas'
import { useClientes } from '../../hooks/useClientes'
import { formatPesos, formatRangoFechas, formatFecha, unidadEmoji } from '../../lib/format'
import { estaSaldada, rangosOcupadosPorUnidad, estadoBadgeStatus } from '../../lib/reservas'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import { usePagoComprobanteForm } from '../../hooks/usePagoComprobanteForm'
import { useRevealOnCheck } from '../../hooks/useRevealOnCheck'
import LoadingButton from '../ui/LoadingButton'
import Modal from './Modal'
import DateInput from '../inputs/DateInput'
import BrandSelect from '../ui/BrandSelect'
import MoneyInput from '../inputs/MoneyInput'
import ClienteSelector from './ClienteSelector'
import StatusBadge from './StatusBadge'
import ReservaCalendar from './ReservaCalendar'
import PagoComprobanteCampos from './PagoComprobanteCampos'
import Historial from './Historial'
import { Lock, Unlock, ChevronDown } from 'lucide-react'

function SeccionTitulo({ children }) {
  return (
    <p className="text-[9px] font-bold text-prius-muted uppercase tracking-[0.2em] border-b border-hairline pb-2">
      {children}
    </p>
  )
}

function diasEntre(desdeIso, hastaIso) {
  if (!desdeIso || !hastaIso) return null
  const [y1, m1, d1] = desdeIso.split('-').map(Number)
  const [y2, m2, d2] = hastaIso.split('-').map(Number)
  const ms = new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)
  return Math.round(ms / 86400000) + 1
}

const rangosSolapan = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && bStart <= aEnd

const GRUPO_UNIDAD = { carpa: 'Carpas', sombrilla: 'Sombrillas', cabina: 'Cabinas', locker: 'Lockers' }

// Ítem 8 (25/10/2026): modal de Nueva Reserva / Editar Reserva, extraído de
// Reservas.jsx para que un solo botón global (Sidebar, "+" de la bottom nav
// en mobile) lo pueda abrir desde cualquier sección — antes solo existía
// montado dentro de la página Reservas, así que abrir "Nueva reserva" desde
// otro lado significaba navegar primero. Mismo state/handlers/JSX que tenía
// la página, sin reescribir lógica — ahora vive en NuevaReservaProvider
// (montado una sola vez en AppLayout) y Reservas.jsx lo controla vía
// useNuevaReserva() para su propio flujo de edición (deep-link ?id=, click
// de fila).
//
// `prefill` ({ clienteId, unidadId, tipoAlquiler }): precarga del alta nueva
// — reemplaza los deep-links ?cliente=/?unidad=&tipo= que antes navegaban a
// /app/reservas; ahora los triggers (Clientes.jsx, panel de unidad del
// Plano) abren el modal directo con el prefill, sin cambiar de pantalla.
export default function ReservaFormModal({ isOpen, onClose, editingReserva, prefill }) {
  const { reservas, unidades, temporadas, temporadaActiva, crearReservaConPago, updateReserva } = useReservas()
  const { clientes } = useClientes()
  const { confirm, alert, toast } = useDialog()
  const puedeBonificar = usePermiso('bonificar')

  const [masOpcionesAbierto, setMasOpcionesAbierto] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mql.matches)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  const [clienteId, setClienteId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [tipoAlquiler, setTipoAlquiler] = useState('periodo')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [fecha, setFecha] = useState('')
  const [valorTotal, setValorTotal] = useState(0)
  const [notas, setNotas] = useState('')
  const [bloqueada, setBloqueada] = useState(false)
  const [bonificada, setBonificada] = useState(false)
  const [cargarMasTarde, setCargarMasTarde] = useState(false)
  const revealPagoInicialRef = useRevealOnCheck(!cargarMasTarde)
  const [mobileStep, setMobileStep] = useState(0)
  const MOBILE_STEPS = ['Cliente', 'Unidad y fechas', 'Monto']

  const formSnapshotRef = useRef('')
  const snapshotForm = (f) => JSON.stringify(f)

  // Seedea el form al abrir — reemplaza handleOpenCreate/handleOpenEdit, que
  // antes se llamaban desde el click del botón. Acá el "abrir" lo decide el
  // padre (isOpen pasa a true) y este efecto arma el form según venga o no
  // editingReserva/prefill.
  useEffect(() => {
    if (!isOpen) return
    setMasOpcionesAbierto(false)
    setMobileStep(0)
    if (editingReserva) {
      setClienteId(editingReserva.cliente_id || '')
      setUnidadId(editingReserva.unidad_id || '')
      setTipoAlquiler(editingReserva.tipo_alquiler || 'periodo')
      setFechaInicio(editingReserva.fecha_inicio || '')
      setFechaFin(editingReserva.fecha_fin || '')
      setFecha(editingReserva.fecha || '')
      setValorTotal(editingReserva.valor_total ?? 0)
      setNotas(editingReserva.notas || '')
      setBloqueada(editingReserva.bloqueada || false)
      setBonificada(editingReserva.bonificada || false)
      setCargarMasTarde(false)
      formSnapshotRef.current = snapshotForm({
        clienteId: editingReserva.cliente_id || '', unidadId: editingReserva.unidad_id || '', tipoAlquiler: editingReserva.tipo_alquiler || 'periodo',
        fechaInicio: editingReserva.fecha_inicio || '', fechaFin: editingReserva.fecha_fin || '', fecha: editingReserva.fecha || '',
        valorTotal: editingReserva.valor_total ?? 0, notas: editingReserva.notas || '', bloqueada: editingReserva.bloqueada || false, bonificada: editingReserva.bonificada || false,
      })
    } else {
      setClienteId(prefill?.clienteId || '')
      setUnidadId(prefill?.unidadId || '')
      setTipoAlquiler(prefill?.tipoAlquiler || 'periodo')
      setFechaInicio('')
      setFechaFin('')
      setFecha('')
      setValorTotal(0)
      setNotas('')
      setBloqueada(false)
      setBonificada(false)
      setCargarMasTarde(false)
      formSnapshotRef.current = snapshotForm({
        clienteId: prefill?.clienteId || '', unidadId: prefill?.unidadId || '', tipoAlquiler: prefill?.tipoAlquiler || 'periodo', fechaInicio: '', fechaFin: '',
        fecha: '', valorTotal: 0, notas: '', bloqueada: false, bonificada: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingReserva])

  const isFormDirty = () => snapshotForm({
    clienteId, unidadId, tipoAlquiler, fechaInicio, fechaFin, fecha, valorTotal, notas, bloqueada, bonificada,
  }) !== formSnapshotRef.current || Number(pagoForm.monto) > 0 || !!pagoForm.numero

  const handleToggleBloqueada = async () => {
    if (!editingReserva) return
    if (bloqueada) {
      const ok = await confirm(
        'Vas a desbloquear esta reserva para poder editar fecha/unidad. ¿Confirmás?',
        { title: 'Desbloquear reserva' },
      )
      if (!ok) return
    }
    const nuevoValor = !bloqueada
    try {
      await updateReserva(editingReserva.id, { bloqueada: nuevoValor })
      setBloqueada(nuevoValor)
    } catch (err) {
      await alert('No se pudo actualizar el candado de la reserva.')
    }
  }

  const unidadesBloqueadasPorTemporada = useMemo(() => {
    const set = new Set()
    for (const r of reservas) {
      if (r.tipo_alquiler === 'temporada' && r.estado === 'activa' && r.unidad_id) set.add(r.unidad_id)
    }
    return set
  }, [reservas])

  const unidadTieneConflictoDeFechas = (uId) => {
    const candStart = tipoAlquiler === 'dia' ? fecha : tipoAlquiler === 'temporada' ? temporadaActiva?.fecha_inicio : fechaInicio
    const candEnd = tipoAlquiler === 'dia' ? fecha : tipoAlquiler === 'temporada' ? temporadaActiva?.fecha_fin : fechaFin
    if (!candStart || !candEnd) return false
    return reservas.some((r) => {
      if (r.unidad_id !== uId || r.estado !== 'activa') return false
      if (editingReserva && r.id === editingReserva.id) return false
      if (r.tipo_alquiler !== 'periodo' && r.tipo_alquiler !== 'dia') return false
      const rStart = r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_inicio
      const rEnd = r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_fin
      return rStart && rEnd && rangosSolapan(candStart, candEnd, rStart, rEnd)
    })
  }

  const unidadesDisponibles = useMemo(
    () =>
      unidades.filter(
        (u) => u.id === unidadId || (!unidadesBloqueadasPorTemporada.has(u.id) && !unidadTieneConflictoDeFechas(u.id)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unidades, unidadesBloqueadasPorTemporada, unidadId, tipoAlquiler, fechaInicio, fechaFin, fecha, reservas, editingReserva, temporadaActiva],
  )

  const conflictoFechas = unidadId ? unidadTieneConflictoDeFechas(unidadId) : false

  const opcionesUnidad = useMemo(
    () =>
      [...unidadesDisponibles]
        .sort((a, b) => (GRUPO_UNIDAD[a.tipo] || a.tipo).localeCompare(GRUPO_UNIDAD[b.tipo] || b.tipo) || a.numero - b.numero)
        .map((u) => ({
          value: u.id,
          group: GRUPO_UNIDAD[u.tipo] || u.tipo,
          label: `${unidadEmoji(u.tipo)} ${u.tipo} #${u.numero}${u.id === unidadId && conflictoFechas ? ' (ocupada esas fechas)' : ''}`,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unidadesDisponibles, unidadId, conflictoFechas],
  )

  const unidadSeleccionadaLabel = opcionesUnidad.find((o) => o.value === unidadId)?.label || ''
  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) || null
  const pagoForm = usePagoComprobanteForm({
    resetKey: isOpen && !editingReserva ? 'nueva-reserva-abierta' : 'cerrado',
    cliente: clienteSeleccionado,
    reservaInfo: {
      total: bonificada ? 0 : Number(valorTotal || 0),
      saldo: bonificada ? 0 : Number(valorTotal || 0),
      saldoDesconocido: false,
      pagado: 0,
      unidadLabel: unidadSeleccionadaLabel,
      temporadaOTipo: tipoAlquiler === 'temporada' ? temporadaActiva?.nombre : tipoAlquiler,
      sinReserva: false,
    },
  })

  const rangosOcupados = useMemo(
    () => rangosOcupadosPorUnidad(reservas, unidadId, editingReserva?.id),
    [reservas, unidadId, editingReserva],
  )

  const [savingReserva, setSavingReserva] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clienteId) {
      await alert('Seleccioná un cliente antes de continuar.')
      return
    }
    if (!bloqueada) {
      if (tipoAlquiler === 'periodo' && (!fechaInicio || !fechaFin)) {
        await alert('Elegí el rango de fechas de la reserva en el calendario.')
        return
      }
      if (tipoAlquiler === 'dia' && !fecha) {
        await alert('Elegí la fecha de la reserva en el calendario.')
        return
      }
    }
    if (unidadTieneConflictoDeFechas(unidadId)) {
      await alert('Esa unidad ya está ocupada en las fechas elegidas por otra reserva. Elegí otra unidad o cambiá las fechas.')
      return
    }
    const payload = {
      cliente_id: clienteId,
      unidad_id: bloqueada && editingReserva ? editingReserva.unidad_id : unidadId,
      tipo_alquiler: bloqueada && editingReserva ? editingReserva.tipo_alquiler : tipoAlquiler,
      estado: 'activa',
      origen: 'manual',
      fecha_inicio:
        bloqueada && editingReserva
          ? editingReserva.fecha_inicio
          : tipoAlquiler === 'periodo' ? fechaInicio || null : null,
      fecha_fin:
        bloqueada && editingReserva
          ? editingReserva.fecha_fin
          : tipoAlquiler === 'periodo' ? fechaFin || null : null,
      fecha:
        bloqueada && editingReserva
          ? editingReserva.fecha
          : tipoAlquiler === 'dia' ? fecha || null : null,
      valor_total: bonificada ? 0 : Number(valorTotal || 0),
      bonificada,
      notas,
    }
    const requierePago = !editingReserva && !bonificada && !cargarMasTarde
    if (requierePago) {
      if (Number(pagoForm.monto) <= 0) {
        await alert('Cargá el monto del primer pago, o tildá "Cargar más tarde".')
        return
      }
      if (pagoForm.excedeSaldo) {
        await alert(`El monto supera el total de la reserva (${formatPesos(valorTotal)}).`)
        return
      }
      if (pagoForm.comprobanteIncompleto) {
        await alert('El comprobante del primer pago es obligatorio: completá tipo, número y fecha.')
        return
      }
      if (pagoForm.duplicado) {
        await alert('Ese número de comprobante ya está cargado en otro pago.')
        return
      }
    }

    setSavingReserva(true)
    try {
      if (editingReserva) {
        await updateReserva(editingReserva.id, payload)
        onClose()
        toast('Reserva actualizada con éxito', { tone: 'success' })
      } else {
        const pagoPayload = requierePago ? {
          cliente_id: clienteId,
          monto: pagoForm.monto,
          medio: pagoForm.medio,
          tipo_pago: pagoForm.tipoPago || 'parcial',
          concepto: pagoForm.concepto,
          referencia: pagoForm.referencia,
          comprobante: pagoForm.construirComprobantePayload(),
          fecha: pagoForm.fechaComprobante,
        } : null
        await crearReservaConPago({ reserva: payload, pago: pagoPayload })
        onClose()
        toast(pagoPayload ? 'Reserva y pago registrados' : 'Reserva creada con éxito', { tone: 'success' })
      }
    } catch (err) {
      toast(err.message || 'Error guardando la reserva.', { tone: 'error' })
    } finally {
      setSavingReserva(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}
      isDirty={isFormDirty}
      maxWidthClass="sm:max-w-4xl"
      footer={
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold text-prius-muted uppercase tracking-widest">Total</p>
            <p className="text-lg font-bold text-black">{formatPesos(bonificada ? 0 : valorTotal)}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => (isMobile && mobileStep > 0 ? setMobileStep((s) => s - 1) : onClose())}
              className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-prius-slate bg-prius-subtle hover:bg-prius-subtle border border-hairline transition-all"
            >
              {isMobile && mobileStep > 0 ? 'Atrás' : 'Cancelar'}
            </button>
            {isMobile && mobileStep < MOBILE_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setMobileStep((s) => s + 1)}
                className="px-6 py-3 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
              >
                Siguiente
              </button>
            ) : (
              <LoadingButton
                type="submit"
                form="form-reserva"
                loading={savingReserva}
                loadingText="Guardando..."
                disabled={
                  !editingReserva && !bonificada && !cargarMasTarde
                  && (Number(pagoForm.monto) <= 0 || pagoForm.excedeSaldo || pagoForm.comprobanteIncompleto || !!pagoForm.duplicado)
                }
                className="px-6 py-3 bg-gold hover:bg-gold-hover text-black font-bold uppercase tracking-[0.2em] rounded-xl text-xs shadow-xl"
              >
                {editingReserva ? 'Guardar Cambios' : 'Crear reserva'}
              </LoadingButton>
            )}
          </div>
        </div>
      }
    >
      <form id="form-reserva" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {isMobile && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gold uppercase tracking-widest">
                Paso {mobileStep + 1} de {MOBILE_STEPS.length}
              </span>
              <span className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">{MOBILE_STEPS[mobileStep]}</span>
            </div>
            <div className="h-1 rounded-full bg-prius-subtle overflow-hidden flex gap-0.5">
              {MOBILE_STEPS.map((s, i) => (
                <div key={s} className={`flex-1 rounded-full ${i <= mobileStep ? 'bg-gold' : 'bg-hairline'}`} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          <div className={isMobile && mobileStep !== 0 ? 'hidden' : 'space-y-5'}>
          <SeccionTitulo>{isMobile ? 'Cliente' : 'Cliente y unidad'}</SeccionTitulo>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Seleccionar Cliente</label>
            <ClienteSelector
              value={clienteId}
              onChange={(id) => setClienteId(id)}
            />
          </div>

          {editingReserva && (
            <div className="flex items-center justify-between p-3 bg-prius-subtle border border-hairline rounded-xl">
              <div className="flex items-center gap-2 text-[10px] text-prius-slate uppercase tracking-widest font-bold">
                {bloqueada ? <Lock size={14} className="text-prius-error" /> : <Unlock size={14} className="text-prius-muted" />}
                {bloqueada ? 'Fecha y unidad bloqueadas' : 'Fecha y unidad editables'}
              </div>
              <button
                type="button"
                onClick={handleToggleBloqueada}
                className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                  bloqueada ? 'bg-red-500/10 text-prius-error hover:bg-red-500/20' : 'bg-prius-subtle text-prius-slate hover:text-black'
                }`}
              >
                {bloqueada ? 'Desbloquear' : 'Bloquear'}
              </button>
            </div>
          )}
          </div>

          <div className={isMobile && mobileStep !== 1 ? 'hidden' : 'space-y-5'}>
          {isMobile && <SeccionTitulo>Unidad y fechas</SeccionTitulo>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Unidad</label>
              <BrandSelect
                value={unidadId}
                onChange={setUnidadId}
                disabled={bloqueada}
                options={opcionesUnidad}
                invalid={conflictoFechas}
                searchable
                searchPlaceholder="Buscar unidad..."
              />
              {conflictoFechas && (
                <p className="text-[10px] text-prius-error uppercase tracking-widest font-bold">
                  Ocupada en esas fechas — elegí otra unidad o cambiá las fechas.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Temporada</label>
              <p className="w-full h-9 flex items-center bg-prius-subtle border border-hairline rounded-xl px-4 text-prius-slate text-sm font-bold truncate">
                {editingReserva?.temporada || temporadaActiva?.nombre || '—'}
              </p>
            </div>
          </div>

          <SeccionTitulo>Fechas</SeccionTitulo>

          <div className="space-y-2">
            <div className={`grid gap-2 ${editingReserva ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {[
                ...(editingReserva ? [] : [{ key: 'temporada', label: 'Temporada' }]),
                { key: 'periodo', label: 'Período' },
                { key: 'dia', label: 'Día' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  disabled={bloqueada}
                  onClick={() => setTipoAlquiler(t.key)}
                  className={`h-9 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    tipoAlquiler === t.key
                      ? 'bg-gold text-black border-gold'
                      : 'bg-prius-subtle text-prius-slate border-hairline hover:text-black'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tipoAlquiler === 'temporada' && (
              <p className="text-[9px] text-prius-muted uppercase tracking-widest">
                Se asigna toda la temporada vigente ({temporadaActiva?.nombre || '—'}), sin elegir fechas.
              </p>
            )}
          </div>

          {tipoAlquiler === 'temporada' && (
            <div className="space-y-2">
              <div className="bg-prius-subtle border border-hairline rounded-xl p-4 text-center">
                <p className="text-[9px] font-bold text-prius-muted uppercase tracking-widest">Temporada vigente</p>
                <p className="text-sm font-bold text-black mt-1">{temporadaActiva?.nombre || '—'}</p>
              </div>
              {unidadId && conflictoFechas && (
                <p className="text-[11px] text-prius-error">
                  Esa unidad ya tiene una reserva de período o día dentro de esta temporada — no se puede asignar toda la temporada. Elegí otra unidad.
                </p>
              )}
            </div>
          )}

          {tipoAlquiler === 'periodo' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Fechas (Inicio — Fin)</label>
                <span className="text-xs font-bold text-gold">
                  {fechaInicio || '—'} → {fechaFin || '—'}
                </span>
              </div>
              {!unidadId && (
                <p className="text-[10px] text-prius-muted uppercase tracking-widest">Elegí una unidad para ver sus días ocupados.</p>
              )}
              <div className="bg-prius-subtle border border-hairline rounded-xl p-3 flex justify-center">
                <ReservaCalendar
                  mode="range"
                  value={{ desde: fechaInicio, hasta: fechaFin }}
                  onChange={({ desde, hasta }) => {
                    setFechaInicio(desde)
                    setFechaFin(hasta)
                  }}
                  rangosOcupados={rangosOcupados}
                  disabled={bloqueada}
                />
              </div>
            </div>
          )}

          {tipoAlquiler === 'dia' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Fecha</label>
                <span className="text-xs font-bold text-gold">{fecha || '—'}</span>
              </div>
              {!unidadId && (
                <p className="text-[10px] text-prius-muted uppercase tracking-widest">Elegí una unidad para ver sus días ocupados.</p>
              )}
              <div className="bg-prius-subtle border border-hairline rounded-xl p-3 flex justify-center">
                <ReservaCalendar mode="single" value={fecha} onChange={setFecha} rangosOcupados={rangosOcupados} disabled={bloqueada} />
              </div>
            </div>
          )}
          </div>
        </div>

        <div className={isMobile && mobileStep !== 2 ? 'hidden' : 'space-y-5'}>
          <SeccionTitulo>Precio y pago</SeccionTitulo>

          {puedeBonificar && (
            <div className="flex items-center justify-between p-3 bg-prius-subtle border border-hairline rounded-xl">
              <label htmlFor="reserva-bonificada" className="text-[10px] font-bold text-prius-slate uppercase tracking-widest cursor-pointer">
                Unidad bonificada
              </label>
              <input
                id="reserva-bonificada"
                type="checkbox"
                checked={bonificada}
                onChange={(e) => setBonificada(e.target.checked)}
                className="accent-cyan-400 w-4 h-4 cursor-pointer"
              />
            </div>
          )}

          <MoneyInput
            label="Monto Total"
            value={bonificada ? 0 : valorTotal}
            onChange={setValorTotal}
            required
            disabled={bonificada}
            max={100_000_000}
            hint={bonificada ? 'Carpa bonificada: sin cargo, no registra pagos.' : undefined}
          />

          {editingReserva && (
            <div className="flex items-center justify-between p-4 bg-prius-subtle border border-hairline rounded-xl">
              <div>
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Saldo Pendiente</p>
                <p className={`text-lg font-bold ${Number(editingReserva.saldo) > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                  {estaSaldada(editingReserva) ? 'Unidad saldada' : formatPesos(editingReserva.saldo)}
                </p>
              </div>
              <StatusBadge status={estadoBadgeStatus(editingReserva)} />
            </div>
          )}

          <div className="p-4 bg-prius-subtle border border-gold/20 rounded-xl space-y-2">
            <p className="text-[9px] font-bold text-gold uppercase tracking-[0.2em]">Resumen</p>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              <span className="text-prius-muted uppercase tracking-widest">Unidad</span>
              <span className="text-black font-bold text-right truncate">
                {opcionesUnidad.find((o) => o.value === unidadId)?.label || '—'}
              </span>
              <span className="text-prius-muted uppercase tracking-widest">Fechas</span>
              <span className="text-black font-bold text-right truncate">
                {tipoAlquiler === 'temporada'
                  ? temporadaActiva?.nombre || '—'
                  : tipoAlquiler === 'dia' ? (fecha ? formatFecha(fecha) : '—') : (fechaInicio && fechaFin ? formatRangoFechas(fechaInicio, fechaFin) : '—')}
              </span>
              <span className="text-prius-muted uppercase tracking-widest">Días</span>
              <span className="text-black font-bold text-right">
                {tipoAlquiler === 'temporada'
                  ? 'Temporada completa'
                  : tipoAlquiler === 'dia' ? (fecha ? 1 : '—') : (diasEntre(fechaInicio, fechaFin) ?? '—')}
              </span>
              <span className="text-prius-muted uppercase tracking-widest">Total</span>
              <span className="text-black font-bold text-right">{formatPesos(bonificada ? 0 : valorTotal)}</span>
              <span className="text-prius-muted uppercase tracking-widest">Saldo</span>
              <span className={`font-bold text-right ${editingReserva && Number(editingReserva.saldo) > 0 ? 'text-prius-error' : 'text-prius-success'}`}>
                {editingReserva ? (estaSaldada(editingReserva) ? 'Saldado' : formatPesos(editingReserva.saldo)) : '—'}
              </span>
            </div>
          </div>

          {!editingReserva && !bonificada && (
            <div className="space-y-4">
              {!cargarMasTarde && (
                <div ref={revealPagoInicialRef} className="animate-premium-fade">
                  <PagoComprobanteCampos form={pagoForm} />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cargarMasTarde}
                  onChange={(e) => setCargarMasTarde(e.target.checked)}
                  className="accent-gold w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-black uppercase tracking-widest">Cargar más tarde</span>
              </label>
            </div>
          )}

          <div className="border border-hairline rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setMasOpcionesAbierto((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-prius-slate uppercase tracking-widest hover:text-black transition-all"
            >
              Más opciones
              <ChevronDown size={14} className={`transition-transform ${masOpcionesAbierto ? 'rotate-180' : ''}`} />
            </button>
            {masOpcionesAbierto && (
              <div className="px-4 pb-4 space-y-4 border-t border-hairline pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Notas</label>
                  <textarea
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full bg-prius-subtle border border-hairline rounded-xl px-4 py-3 text-black text-sm focus:border-gold/50 outline-none resize-none"
                  />
                </div>
                {editingReserva && (
                  <div>
                    <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest mb-2">Historial</p>
                    <Historial tipo="reserva" id={editingReserva.id} compact />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  )
}
