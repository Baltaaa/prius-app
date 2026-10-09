import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { usePagos } from '../../hooks/usePagos'
import { useAuth } from '../../context/AuthProvider'
import { useDialog } from '../../context/DialogProvider'
import { usePreferenciaUsuario } from '../../hooks/usePreferenciaUsuario'
import { isFeatureEnabled } from '../../lib/features'
import { formatFecha, formatPesos } from '../../lib/format'
import { formatMedioPago } from '../../lib/pagos'
import { pagoSinVerificar } from '../../lib/reservas'
import { numeroComprobante, armarDatosComprobante, validarComprobante } from '../../lib/comprobante'
import { imprimirDocumento } from '../../lib/imprimirDocumento'
import ComprobanteDocumento from '../../components/crm/ComprobanteDocumento'
import BrandSelect from '../../components/ui/BrandSelect'
import { Printer, FileText, Receipt, HelpCircle } from 'lucide-react'

const MODO_KEY = 'prius:comprobante:modo'
const UNIDAD_LABEL = { carpa: 'Carpa', sombrilla: 'Sombrilla', cabina: 'Cabina', locker: 'Locker' }

function leerModoGuardado() {
  try {
    const v = localStorage.getItem(MODO_KEY)
    return v === 'bn' ? 'bn' : 'color'
  } catch {
    return 'color'
  }
}

export default function Comprobantes() {
  const { reservas, loading } = useReservas()
  const { perfil } = useAuth()
  const { toast } = useDialog()
  const [searchParams, setSearchParams] = useSearchParams()

  // [feat-9] recuerda la última reserva elegida, por usuario, sin
  // localStorage (preferencias_usuario) — si la feature está apagada,
  // vuelve a ser un useState local que arranca vacío cada vez.
  const [selectedReservaIdPref, setSelectedReservaIdPref] = usePreferenciaUsuario('comprobantes_ultima_reserva', '')
  const [selectedReservaIdLocal, setSelectedReservaIdLocal] = useState('')
  const selectedReservaId = isFeatureEnabled('feat-9-comprobantes-recordar-config') ? selectedReservaIdPref : selectedReservaIdLocal
  const setSelectedReservaId = isFeatureEnabled('feat-9-comprobantes-recordar-config') ? setSelectedReservaIdPref : setSelectedReservaIdLocal

  const [modo, setModo] = useState(leerModoGuardado)
  useEffect(() => {
    try { localStorage.setItem(MODO_KEY, modo) } catch { /* localStorage no disponible (modo privado, etc.) */ }
  }, [modo])

  // Deep link /app/comprobantes?reserva=<id> (PASO 5) — preselecciona la
  // reserva una sola vez; no pisa una selección posterior del usuario.
  useEffect(() => {
    const reservaParam = searchParams.get('reserva')
    if (reservaParam && reservas.some((r) => r.id === reservaParam)) {
      setSelectedReservaId(reservaParam)
      const next = new URLSearchParams(searchParams)
      next.delete('reserva')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservas])

  const selectedReserva = reservas.find((r) => r.id === selectedReservaId) || reservas[0]
  // Pagos vía usePagos -> selector sobre DataProvider, ya suscripto a
  // Realtime para toda la app: si entra un pago nuevo de esta reserva, la
  // vista se actualiza sola, sin query propia.
  const { pagos: pagosReserva } = usePagos(selectedReserva?.id)

  const opcionesReserva = useMemo(
    () => reservas.map((r) => ({
      value: r.id,
      label: `${r.clientes?.nombre || 'S/N'} — ${UNIDAD_LABEL[r.unidades?.tipo] || r.unidades?.tipo} #${r.unidades?.numero} — DNI/CUIT ${r.clientes?.dni || r.clientes?.cuit || 's/d'} — ${numeroComprobante(r)}`,
    })),
    [reservas],
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
      toast(error)
      return
    }
    const apellidoNombre = (datos.cliente.nombre || 'Cliente').trim()
    await imprimirDocumento(
      <ComprobanteDocumento datos={datos} modo={modo} tipo={tipo} />,
      { titulo: `Comprobante ${datos.numero} - ${apellidoNombre}` },
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm font-semibold text-gray-500 animate-pulse uppercase tracking-widest">Sincronizando Comprobantes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-premium-fade">
      <div className="glass-card p-6 rounded-2xl glass-card-inner space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1 min-w-[280px] space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Buscar reserva (cliente, DNI/CUIT, unidad)</label>
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
              <div className="flex rounded-xl border border-white/10 overflow-hidden" role="group" aria-label="Modo de impresión">
                <button
                  type="button"
                  onClick={() => setModo('color')}
                  className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${modo === 'color' ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:bg-white/5'}`}
                >
                  Color
                </button>
                <button
                  type="button"
                  onClick={() => setModo('bn')}
                  className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${modo === 'bn' ? 'bg-[#FDE047] text-black' : 'text-gray-400 hover:bg-white/5'}`}
                >
                  B y N
                </button>
              </div>
              <button
                onClick={() => imprimir('estado_cuenta')}
                className="bg-[#FDE047] hover:bg-yellow-300 text-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-widest shadow-xl"
              >
                <Printer size={18} /> Imprimir Comprobante
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedReserva ? (
        <div className="space-y-6">
          {/* Vista previa WYSIWYG: hoja real en proporción A4, papel blanco, en
              el modo elegido — el tema oscuro queda solo para este contenedor. */}
          <div className="overflow-x-auto rounded-2xl bg-black/20 p-6 md:p-10 flex justify-center">
            <div className="shadow-2xl shrink-0">
              <ComprobanteDocumento datos={datosEstadoCuenta} modo={modo} tipo="estado_cuenta" />
            </div>
          </div>

          {pagosReserva.length > 0 && (
            <div className="glass-card p-6 rounded-2xl glass-card-inner space-y-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Pagos Registrados — recibo individual</p>
              <div className="space-y-2">
                {pagosReserva.map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-xs px-4 py-3 bg-white/5 border border-white/10 rounded-xl gap-3">
                    <div className="text-gray-400 min-w-0">
                      <span className="text-white font-bold">{formatFecha(p.fecha)}</span>
                      {' — '}{formatMedioPago(p)}
                      {p.comprobante && <span> · Comp. {p.comprobante}</span>}
                      {p.nro_cuota && <span> · Cuota {p.nro_cuota}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {pagoSinVerificar(p) ? (
                        <strong className="inline-flex items-center gap-1.5 text-gray-500 text-[11px] uppercase tracking-widest">
                          <HelpCircle size={12} /> Sin verificar
                        </strong>
                      ) : (
                        <strong className="text-green-400">{formatPesos(p.monto)}</strong>
                      )}
                      <button
                        onClick={() => imprimir('recibo', p.id)}
                        className="p-2 hover:bg-white/10 rounded-lg text-[#FDE047] transition-all"
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
        <div className="p-20 glass-card rounded-3xl text-center glass-card-inner">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-sm text-gray-400 uppercase font-bold tracking-widest">No hay reservas registradas para generar comprobantes.</p>
        </div>
      )}
    </div>
  )
}
