import ToolbarSticky from '../../components/brand/ToolbarSticky'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReservas } from '../../hooks/useReservas'
import { usePagos } from '../../hooks/usePagos'
import { useAuth } from '../../context/AuthProvider'
import { useDialog } from '../../context/DialogProvider'
import { useData } from '../../context/DataProvider'
import { usePreferenciaUsuario } from '../../hooks/usePreferenciaUsuario'
import { isFeatureEnabled } from '../../lib/features'
import { formatFecha, formatMonto, formatComprobante, formatNombre} from '../../lib/format'
import { formatMedioPago } from '../../lib/pagos'
import { pagoSinVerificar, tieneAlgunPagoReal } from '../../lib/reservas'
import { numeroComprobante, armarDatosComprobante, validarComprobante } from '../../lib/comprobante'
import { imprimirDocumento } from '../../lib/imprimirDocumento'
import ComprobantePreview from '../../components/crm/ComprobantePreview'
import ComprobanteVisor from '../../components/crm/ComprobanteVisor'
import BottomSheet from '../../components/brand/BottomSheet'
import ScrollFade from '../../components/ui/ScrollFade'
import { useEsDesktop } from '../../hooks/useMediaQuery'
import ComprobanteImpresionDoble from '../../components/crm/ComprobanteImpresionDoble'
import BrandSelect from '../../components/ui/BrandSelect'
import LoadingButton from '../../components/ui/LoadingButton'
import { Printer, FileText, Receipt, HelpCircle, ListChecks } from 'lucide-react'

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

// Lista de pagos de la reserva con su recibo individual. La usa el panel de
// desktop y el bottom sheet de mobile.
function ListaPagos({ pagos, onRecibo }) {
  return (
    <div className="space-y-2">
      {pagos.map((p) => (
        <div key={p.id} className="flex justify-between items-center text-label px-4 py-3 bg-surface border border-line rounded-inner gap-3">
          <div className="text-ink-2 min-w-0">
            <span className="text-ink font-semibold">{formatFecha(p.fecha)}</span>
            {' — '}{formatMedioPago(p)}
            {/* Item 4 (fix urgente oct 2026): p.comprobante es la columna de
                texto vieja (solo pagos migrados) — p.comprobantes[] (la
                relación real) es la fuente para cualquier pago cargado con
                el sistema actual. */}
            {etiquetaComprobantePago(p) && <span> · Comp. {etiquetaComprobantePago(p)}</span>}
            {p.nro_cuota && <span> · Cuota {p.nro_cuota}</span>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {pagoSinVerificar(p) ? (
              <strong className="text-label inline-flex items-center gap-2 text-ink-2">
                <HelpCircle size={12} /> Sin verificar
              </strong>
            ) : (
              <strong className="text-success-ink">{formatMonto(p.monto)}</strong>
            )}
            <button onClick={() => onRecibo(p.id)} className="btn-icon" title="Emitir recibo de este pago" aria-label="Emitir recibo de este pago">
              <Receipt size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Comprobantes() {
  const { reservas, loading } = useReservas()
  const { perfil } = useAuth()
  const { toast } = useDialog()
  const { emitirComprobante } = useData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [imprimiendo, setImprimiendo] = useState(false)
  const esDesktop = useEsDesktop()
  const [visorAbierto, setVisorAbierto] = useState(false)
  const [pagosAbiertos, setPagosAbiertos] = useState(false)

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
      label: `${formatNombre(r.clientes?.nombre) || 'S/N'} — ${UNIDAD_LABEL[r.unidades?.tipo] || r.unidades?.tipo} ${r.unidades?.numero} — DNI/CUIT ${r.clientes?.dni || r.clientes?.cuit || 's/d'} — ${numeroComprobante(r)}`,
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
        <span className="text-label text-ink-2 animate-pulse">Sincronizando Comprobantes...</span>
      </div>
    )
  }

  const botonImprimir = (cls) => (
    <LoadingButton
      onClick={() => imprimir('estado_cuenta')}
      loading={imprimiendo}
      loadingText="Emitiendo..."
      className={cls}
    >
      <Printer size={18} /> Imprimir
    </LoadingButton>
  )

  // La página nunca scrollea (AppLayout la fija al alto disponible): la
  // preview se escala para entrar en su área y la lista de pagos scrollea
  // por dentro.
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-grid animate-premium-fade">
      <ToolbarSticky>
        <div className="toolbar-40 max-w-xl [&_.field]:bg-card">
          <BrandSelect
            value={selectedReservaId}
            onChange={setSelectedReservaId}
            options={opcionesReserva}
            searchable
            placeholder="Buscar reserva (cliente, DNI/CUIT, unidad)…"
            searchPlaceholder="Nombre, DNI/CUIT o unidad..."
          />
        </div>
      </ToolbarSticky>

      {selectedReserva ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-grid">
          {/* Vista previa WYSIWYG: la hoja real en proporción A4, escalada para
              entrar completa y centrada. Siempre blanco y negro. En mobile,
              tocarla abre el visor a pantalla completa con zoom. */}
          <ComprobantePreview
            datos={datosEstadoCuenta}
            tipo="estado_cuenta"
            onClick={esDesktop ? undefined : () => setVisorAbierto(true)}
            className="flex-1 min-h-0 min-w-0"
          />

          {esDesktop ? (
            <aside className="card-surface w-[360px] shrink-0 min-h-0 flex flex-col overflow-hidden">
              <p className="section-label !mt-0 px-card pt-card shrink-0">Pagos registrados — recibo individual</p>
              {pagosReserva.length > 0 ? (
                <ScrollFade wrapperClassName="flex-1" className="overflow-y-auto px-card pb-card">
                  <ListaPagos pagos={pagosReserva} onRecibo={(id) => imprimir('recibo', id)} />
                </ScrollFade>
              ) : (
                <p className="flex-1 flex items-center justify-center text-label text-ink-2 px-card text-center">Esta reserva todavía no tiene pagos.</p>
              )}
              <div className="shrink-0 p-card border-t border-divider">
                {botonImprimir('btn btn-secondary w-full')}
              </div>
            </aside>
          ) : (
            <div className="shrink-0 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPagosAbiertos(true)}
                disabled={pagosReserva.length === 0}
                className="btn btn-secondary flex-1 min-w-0 h-11 disabled:opacity-50"
              >
                <ListChecks size={16} /> Pagos ({pagosReserva.length})
              </button>
              {botonImprimir('btn btn-primary flex-1 min-w-0 h-11')}
            </div>
          )}
        </div>
      ) : (
        <div className="card-surface card-pad flex-1 min-h-0 flex flex-col items-center justify-center text-center">
          <FileText className="w-12 h-12 text-ink-2 mx-auto mb-4" />
          <p className="text-label text-ink-2">No hay reservas registradas para generar comprobantes.</p>
        </div>
      )}

      {/* Visor y lista de pagos de mobile: portales, se montan solo en mobile. */}
      {!esDesktop && selectedReserva && (
        <>
          <ComprobanteVisor isOpen={visorAbierto} onClose={() => setVisorAbierto(false)} datos={datosEstadoCuenta} />
          <BottomSheet isOpen={pagosAbiertos} onClose={() => setPagosAbiertos(false)} title="Pagos registrados">
            <p className="text-label text-ink-2 mb-3">Recibo individual de cada pago.</p>
            <ListaPagos pagos={pagosReserva} onRecibo={(id) => { setPagosAbiertos(false); imprimir('recibo', id) }} />
          </BottomSheet>
        </>
      )}
    </div>
  )
}
