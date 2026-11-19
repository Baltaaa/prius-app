import { useState } from 'react'
import { Globe, Hourglass, CheckCircle2 } from 'lucide-react'
import { useCuentaWeb, METODO_VINCULO_LABEL } from '../../hooks/useCuentaWeb'
import { usePermiso } from '../../context/AuthProvider'
import { useDialog } from '../../context/DialogProvider'
import { COLOR_ESTADO } from '../../lib/colors'
import LoadingButton from '../ui/LoadingButton'

// Cuenta web (Google) del cliente — Fase 5A, nov 2026.
//
// variante="ficha": línea "Cuenta web: <email> · Confirmada | Pendiente" con
//   Confirmar (solo pendiente) y Desvincular. Sin cuenta, no se muestra nada.
// variante="recepcion": solo si el vínculo está pendiente, un aviso con
//   "Confirmar cuenta web" junto al cobro (el cliente está en el mostrador:
//   es el mejor momento para verificar que es quien dice ser).
//
// Un vínculo pendiente nació de un DNI o teléfono tipeado en la landing: la
// web no le muestra datos al cliente hasta que el personal lo confirma.
export default function CuentaWebCliente({ clienteId, variante = 'ficha' }) {
  const { activo, cuenta, confirmar, desvincular } = useCuentaWeb(clienteId)
  const puede = usePermiso('clientes.cuenta_web')
  const { confirm, toast } = useDialog()
  const [accion, setAccion] = useState(null)

  if (!activo || !cuenta) return null
  const pendiente = cuenta.estado === 'pendiente'
  if (variante === 'recepcion' && (!pendiente || !puede)) return null

  const handleConfirmar = async () => {
    const ok = await confirm(
      `¿Confirmás que ${cuenta.email} es de este cliente? Desde ese momento, en la web va a ver sus datos, su unidad y sus reservas.`,
      { title: 'Confirmar cuenta web', tone: 'info' },
    )
    if (!ok) return
    setAccion('confirmar')
    try {
      await confirmar()
      toast('Cuenta web confirmada', { tone: 'success' })
    } catch (err) {
      toast(err?.message || 'No se pudo confirmar la cuenta web.', { tone: 'error' })
    } finally {
      setAccion(null)
    }
  }

  const handleDesvincular = async () => {
    const ok = await confirm(
      `¿Desvincular ${cuenta.email} de este cliente? La persona deja de ver sus datos en la web; el cliente y sus reservas no cambian.`,
      { title: 'Desvincular cuenta web', tone: 'danger' },
    )
    if (!ok) return
    setAccion('desvincular')
    try {
      await desvincular()
      toast('Cuenta web desvinculada', { tone: 'success' })
    } catch (err) {
      toast(err?.message || 'No se pudo desvincular la cuenta web.', { tone: 'error' })
    } finally {
      setAccion(null)
    }
  }

  if (variante === 'recepcion') {
    return (
      <div className="card-inner space-y-3">
        <p className="text-label text-ink flex items-start gap-2">
          <Globe size={14} strokeWidth={1.5} className="shrink-0 mt-1" />
          <span className="min-w-0">
            Cuenta web pendiente de confirmar: <span className="break-all">{cuenta.email}</span>
            {' '}({METODO_VINCULO_LABEL[cuenta.metodo] || cuenta.metodo}). Verificá la identidad antes de confirmar.
          </span>
        </p>
        <LoadingButton
          onClick={handleConfirmar}
          loading={accion === 'confirmar'}
          loadingText="Confirmando..."
          className="btn btn-secondary w-full"
        >
          <CheckCircle2 size={16} strokeWidth={1.5} /> Confirmar cuenta web
        </LoadingButton>
      </div>
    )
  }

  const color = pendiente ? COLOR_ESTADO.sinConfirmar : COLOR_ESTADO.neutro
  const Icono = pendiente ? Hourglass : CheckCircle2

  return (
    <div className="card-inner flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-label text-ink-2 flex items-center gap-1"><Globe size={12} strokeWidth={1.5} /> Cuenta web</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 min-w-0">
          <span className="text-label text-ink break-all min-w-0" title={cuenta.email}>{cuenta.email}</span>
          <span className={`inline-flex items-center gap-1 h-6 px-3 rounded-full border text-label whitespace-nowrap ${color.bg} ${color.border} ${color.text}`}>
            <Icono size={12} strokeWidth={1.5} />
            {pendiente ? 'Pendiente' : 'Confirmada'}
          </span>
        </div>
        {pendiente && (
          <p className="text-label text-ink-2 mt-1">
            Vinculada {METODO_VINCULO_LABEL[cuenta.metodo] || cuenta.metodo}: la web no le muestra datos hasta que la confirmes.
          </p>
        )}
      </div>
      {puede && (
        <div className="flex flex-wrap items-center gap-2 w-full @[480px]:w-auto">
          {pendiente && (
            <LoadingButton
              onClick={handleConfirmar}
              loading={accion === 'confirmar'}
              disabled={accion !== null}
              loadingText="Confirmando..."
              className="btn btn-secondary flex-1 @[480px]:flex-none"
            >
              Confirmar
            </LoadingButton>
          )}
          <LoadingButton
            onClick={handleDesvincular}
            loading={accion === 'desvincular'}
            disabled={accion !== null}
            loadingText="Desvinculando..."
            className="btn btn-secondary flex-1 @[480px]:flex-none"
          >
            Desvincular
          </LoadingButton>
        </div>
      )}
    </div>
  )
}
