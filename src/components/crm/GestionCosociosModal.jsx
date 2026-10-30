import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import Modal from './Modal'
import ConfirmarSuperadminModal from './ConfirmarSuperadminModal'
import ClienteSelector from './ClienteSelector'
import LoadingButton from '../ui/LoadingButton'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso } from '../../context/AuthProvider'
import { coSocios } from '../../lib/reservas'

// Ítem 3 (25/10/2026): agregar/quitar cosocios de una reserva, desde la
// ficha de Reservas y el panel de unidad del Plano (mismo modal en los dos
// lugares). Agregar: cliente existente o alta rápida (ClienteSelector, ya
// valida con el módulo único) — sigue sin restricción de rol. Quitar pasó a
// ser una acción de superadmin con contraseña (mini-prompt 26/10/2026,
// cambio de criterio explícito: antes cualquier usuario activo podía
// hacerlo) — bloqueado además si ese cosocio ya tiene algún pago vigente
// registrado en esta reserva, no se puede desvincular a alguien que ya
// puso plata ahí sin perder el rastro de quién pagó qué.
export default function GestionCosociosModal({ isOpen, onClose, reserva, pagos = [] }) {
  const { agregarCosocio, quitarCosocio } = useData()
  const { toast, alert } = useDialog()
  const puedeQuitarCosocio = usePermiso('quitar_cosocio')
  const [nuevoId, setNuevoId] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [cosocioAQuitar, setCosocioAQuitar] = useState(null)

  if (!reserva) return null
  const socios = coSocios(reserva)

  const tienePagos = (clienteId) => pagos.some((p) => p.cliente_id === clienteId && p.estado === 'vigente')

  const handleAgregar = async () => {
    if (!nuevoId) return
    setAgregando(true)
    try {
      await agregarCosocio(reserva.id, nuevoId)
      setNuevoId('')
      toast('Cosocio agregado', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo agregar el cosocio.', { tone: 'error' })
    } finally {
      setAgregando(false)
    }
  }

  const handleQuitarClick = async (cliente) => {
    if (tienePagos(cliente.id)) {
      await alert(`${cliente.nombre} ya tiene pagos registrados en esta reserva — no se puede quitar.`, { title: 'No se puede quitar' })
      return
    }
    setCosocioAQuitar(cliente)
  }

  const handleConfirmQuitar = async (password) => {
    if (!cosocioAQuitar) return
    await quitarCosocio(reserva.id, cosocioAQuitar.id, password)
    toast('Cosocio quitado', { tone: 'success' })
    setCosocioAQuitar(null)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cosocios" maxWidthClass="sm:max-w-sm">
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Titular</p>
        {/* 30/10/2026: el titular no se puede editar desde acá, así que dejó
            de mostrarse en una caja con pinta de input (confundía: parecía
            editable). Ahora es un bloque de solo lectura con avatar de
            iniciales, mismo lenguaje visual que las cards de Clientes. */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0">
            {(reserva.clientes?.nombre || 'S/N').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </div>
          <span className="font-bold text-black truncate">{reserva.clientes?.nombre || 'S/N'}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Cosocios ({socios.length})</p>
        {socios.length === 0 ? (
          <p className="text-xs text-prius-muted">Sin cosocios todavía.</p>
        ) : (
          <div className="space-y-2">
            {socios.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-prius-subtle border border-hairline rounded-xl">
                <span className="text-sm font-semibold text-black truncate">{s.nombre}</span>
                {puedeQuitarCosocio && (
                  <button
                    type="button"
                    onClick={() => handleQuitarClick(s)}
                    title={tienePagos(s.id) ? 'Tiene pagos registrados — no se puede quitar' : 'Quitar (pide contraseña de superadmin)'}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-prius-error hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest">Agregar cosocio</p>
        <ClienteSelector value={nuevoId} onChange={(id) => setNuevoId(id)} />
        <LoadingButton
          loading={agregando}
          loadingText="Agregando..."
          disabled={!nuevoId}
          onClick={handleAgregar}
          className="w-full py-3 bg-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <UserPlus size={14} /> Agregar
        </LoadingButton>
      </div>

      <ConfirmarSuperadminModal
        isOpen={!!cosocioAQuitar}
        onClose={() => setCosocioAQuitar(null)}
        onConfirm={handleConfirmQuitar}
        titulo="Quitar cosocio"
        afectaLinea={`${cosocioAQuitar?.nombre || 'Este cosocio'} deja de estar vinculado a esta reserva.`}
        confirmLabel="Quitar"
      />
    </Modal>
  )
}
