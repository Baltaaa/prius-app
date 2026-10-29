import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { usePagos } from '../../hooks/usePagos'
import { useAuth } from '../../context/AuthProvider'
import { useDialog } from '../../context/DialogProvider'
import { useData } from '../../context/DataProvider'
import { usePreferenciaUsuario } from '../../hooks/usePreferenciaUsuario'
import { isFeatureEnabled } from '../../lib/features'
import { formatFecha, formatPesos, formatComprobante } from '../../lib/format'
import { formatMedioPago } from '../../lib/pagos'
import { pagoSinVerificar, tieneAlgunPagoReal } from '../../lib/reservas'
import { numeroComprobante, armarDatosComprobante, validarComprobante } from '../../lib/comprobante'
import { imprimirDocumento } from '../../lib/imprimirDocumento'
import ComprobanteDocumento from '../../components/crm/ComprobanteDocumento'
import ComprobanteImpresionDoble from '../../components/crm/ComprobanteImpresionDoble'
import BrandSelect from '../../components/ui/BrandSelect'
import LoadingButton from '../../components/ui/LoadingButton'
import { Printer, FileText, Receipt, HelpCircle } from 'lucide-react'

const UNIDAD_LABEL = { carpa: 'Carpa', sombrilla: 'Sombrilla', cabina: 'Cabina', locker: 'Locker' }

// Item 4 (fix urgente oct 2026): `p.comprobante` es la columna de texto
// vieja de `pagos` (previa a la tabla relacional `comprobantes`, solo
// poblada en pagos migrados) — para cualquier pago cargado con el sistema
// actual el comprobante real vive en `p.comprobantes[]` (join de
// fetchPagos), con tipo+número de verdad. Mismo criterio que lib/comprobante.js.
function etiquetaComprobantePago(p) {
  const vigentes = (p.comprobantes || []).filter((c) => c.estado !== 'anulado')
  if (vigentes.length > 0) return vigentes.map((c) => formatComprobante(c.tipo, c.numero)).join(', ')
  return p.comprobante || null
}

export default function Comprobantes() {
  const { reservas, loading } = useReservas()
  const { perfil } = useAuth()
  const { toast } = useDialog()
  const { emitirComprobante } = useData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [imprimiendo, setImprimiendo] = useState(false)

  // [feat-9] recuerda la última reserva elegida, por usuario, sin
  // localStorage (preferencias_usuario) — si la feature está apagada,
  // vuelve a ser un useState local que arranca vacío cada vez.
  const [selectedReservaIdPref, setSelectedReservaIdPref] = usePreferenciaUsuario('comprobantes_ultima_reserva', '')
  const [selectedReservaIdLocal, setSelectedReservaIdLocal] = useState('')
  const selectedReservaId = isFeatureEnabled('feat-9-comprobantes-recordar-config') ? selectedReservaIdPref : selectedReservaIdLocal
  const setSelectedReservaId = isFeatureEnabled('feat-9-comprobantes-recordar-config') ? setSelectedReservaIdPref : setSelectedReservaIdLocal

  // Oct 2026: el selector solo lista reservas con al menos un pago real
  // registrado (ver `tieneAlgunPagoReal`) — una reserva SIN PAGO (ej.
  // Gustavo Martini, carpa #118, $0 abonado) no tiene nada que mostrar acá:
  // ni comprobante propio ni historial de pagos, así que no tiene sentido
  // ofrecerla. `todosPagos` (sin filtrar por reserva) viene de usePagos()
  // sin argumento, mismo dato ya cargado en DataProvider, sin query nueva.
  const { pagos: todosPagos } = usePagos()
  const pagosPorReserva = useMemo(() => {
    const map = {}
    for (const p of todosPagos) {
      if (!p.reserva_id) continue
      ;(map[p.reserva_id] ||= []).push(p)
    }
    return map
  }, [todosPagos])
  const reservasConPagos = useMemo(
    () => reservas.filter((r) => tieneAlgunPagoReal(pagosPorReserva[r.id])),
    [reservas, pagosPorReserva],
  )

  // Deep link /app/comprobantes?reserva=<id> (PASO 5) — preselecciona la
  // reserva una sola vez; no pisa una selección posterior del usuario.
  useEffect(() => {
    const reservaParam = searchParams.get('reserva')
    if (reservaParam && reservasConPagos.some((r) => r.id === reservaParam)) {
      setSelectedReservaId(reservaParam)
      const next = new URLSearchParams(searchParams)
      next.delete('reserva')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservasConPagos])

  const selectedReserva = reservasConPagos.find((r) => r.id === selectedReservaId) || reservasConPagos[0]
  // Pagos vía usePagos -> selector sobre DataProvider, ya suscripto a
  // Realtime para toda la app: si entra un pago nuevo de esta reserva, la
  // vista se actualiza sola, sin query propia.
  const { pagos: pagosReserva } = usePagos(selectedReserva?.id)

  const opcionesReserva = useMemo(
    () => reservasConPagos.map((r) => ({
      value: r.id,
      label: `${r.clientes?.nombre || 'S/N'} — ${UNIDAD_LABEL[r.unidades?.tipo] || r.unidades?.tipo} ${r.unidades?.numero} — DNI/CUIT ${r.clientes?.dni || r.clientes?.cuit || 's/d'} — ${numeroComprobante(r)}`,
    })),
    [reservasConPagos],
  )

  const datosEstadoCuenta = useMemo(
    () => selectedReserva ? armarDatosComprobante({ reserva: selectedReserva, pagos: pagosReserva, perfil, tipo: 'estado_cuenta' }) : null,
    [selectedReserva, pagosReserva, perfil],
  )

  const imprimir = async (tipo, pagoId = null) => {
    const datos = tipo === 'recibo'
      ? armarDatosComprobante({ reserva: selectedReserva, pagos: pagosReserva, perfil, tipo, pagoId })
      : datosEstadoCuenta
    const error = validarComprobante(datos, tipo)
    if (error) {
      toast(error, { tone: 'error' })
      return
    }
    setImprimiendo(true)
    try {
      // Item 15 (testing oct 2026): número correlativo real, asignado en la
      // base (nunca calculado en el front) — reemplaza el slice de uuid de
      // numeroComprobante(). Snapshot guardado para auditoría/reimpresión.
      const emitido = await emitirComprobante({
        reservaId: selectedReserva.id,
        pagoId: tipo === 'recibo' ? pagoId : null,
        tipo,
        snapshot: datos,
      })
      const datosConNumero = { ...datos, numero: String(emitido.numero).padStart(3, '0') }
      const apellidoNombre = (datos.cliente.nombre || 'Cliente').trim()
      await imprimirDocumento(
        <ComprobanteImpresionDoble datos={datosConNumero} tipo={tipo} />,
        { titulo: `Comprobante ${datosConNumero.numero} - ${apellidoNombre}` },
      )
    } catch (err) {
      toast(err.message || 'No se pudo emitir el comprobante.', { tone: 'error' })
    } finally {
      setImprimiendo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-prius-muted animate-pulse uppercase tracking-widest">Sincronizando Comprobantes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="card-light p-6 rounded-2xl card-light-inner space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1 min-w-[280px] space-y-2">
            <label className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Buscar reserva (cliente, DNI/CUIT, unidad)</label>
            <div className="max-w-xl">
              <BrandSelect
                value={selectedReservaId}
                onChange={setSelectedReservaId}
                options={opcionesReserva}
                searchable
                placeholder="Seleccionar reserva..."
                searchPlaceholder="Nombre, DNI/CUIT o unidad..."
              />
            </div>
          </div>

          {selectedReserva && (
            <div className="flex items-center gap-3 shrink-0">
              <LoadingButton
                onClick={() => imprimir('estado_cuenta')}
                loading={imprimiendo}
                loadingText="Emitiendo..."
                className="bg-gold hover:bg-gold-hover text-black px-6 py-3 rounded-xl flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl"
              >
                <Printer size={18} /> Imprimir Comprobante
              </LoadingButton>
            </div>
          )}
        </div>
      </div>

      {selectedReserva ? (
        <div className="space-y-6">
          {/* Vista previa WYSIWYG: hoja real en proporción A4, papel blanco.
              Siempre blanco y negro (item 15, testing oct 2026) — se sacó el
              selector de color para ahorrar tinta. */}
          <div className="overflow-x-auto rounded-2xl p-6 md:p-10 flex justify-start md:justify-center">
            <div className="shadow-2xl shrink-0">
              <ComprobanteDocumento datos={datosEstadoCuenta} tipo="estado_cuenta" />
            </div>
          </div>

          {pagosReserva.length > 0 && (
            <div className="card-light p-6 rounded-2xl card-light-inner space-y-3">
              <p className="text-[10px] font-bold text-prius-muted uppercase tracking-[0.2em]">Pagos Registrados — recibo individual</p>
              <div className="space-y-2">
                {pagosReserva.map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-xs px-4 py-3 bg-prius-subtle border border-hairline rounded-xl gap-3">
                    <div className="text-prius-slate min-w-0">
                      <span className="text-black font-bold">{formatFecha(p.fecha)}</span>
                      {' — '}{formatMedioPago(p)}
                      {/* Item 4 (fix urgente oct 2026): p.comprobante es la
                          columna de texto vieja (solo pagos migrados) —
                          p.comprobantes[] (la relación real) es la fuente
                          para cualquier pago cargado con el sistema actual. */}
                      {etiquetaComprobantePago(p) && <span> · Comp. {etiquetaComprobantePago(p)}</span>}
                      {p.nro_cuota && <span> · Cuota {p.nro_cuota}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {pagoSinVerificar(p) ? (
                        <strong className="inline-flex items-center gap-1.5 text-prius-muted text-[11px] uppercase tracking-widest">
                          <HelpCircle size={12} /> Sin verificar
                        </strong>
                      ) : (
                        <strong className="text-prius-success">{formatPesos(p.monto)}</strong>
                      )}
                      <button
                        onClick={() => imprimir('recibo', p.id)}
                        className="p-2 hover:bg-prius-subtle rounded-lg text-gold transition-all"
                        title="Emitir recibo de este pago"
                      >
                        <Receipt size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-20 card-light rounded-3xl text-center card-light-inner">
          <FileText className="w-12 h-12 text-prius-muted mx-auto mb-4" />
          <p className="text-sm text-prius-slate uppercase font-bold tracking-widest">No hay reservas registradas para generar comprobantes.</p>
        </div>
      )}
    </div>
  )
}
