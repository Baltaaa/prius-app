import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../context/DialogProvider'
import Modal from '../crm/Modal'
import BrandSelect from '../ui/BrandSelect'
import { unidadEmoji } from '../../lib/format'

// Mover un cliente de temporada de una unidad a otra, desde el Plano (ítem 5,
// oct 2026) — exige la contraseña del superadmin logueado. La validación de
// rol y la verificación de contraseña ocurren SERVER-SIDE, en el RPC
// `mover_unidad_temporada` (SECURITY DEFINER) — un usuario no-superadmin no
// puede ejecutar esto ni manipulando el frontend: el RPC rechaza la llamada
// igual aunque este diálogo nunca se hubiera mostrado.
export default function MoverUnidadDialog({ isOpen, onClose, reserva, unidadOrigen, unidadesLibres }) {
  const { alert } = useDialog()
  const [unidadDestinoId, setUnidadDestinoId] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const opciones = useMemo(() => (unidadesLibres || []).filter((u) => u.tipo === unidadOrigen?.type), [unidadesLibres, unidadOrigen])
  const opcionesCombo = useMemo(
    () => [...opciones].sort((a, b) => a.numero - b.numero).map((u) => ({ value: u.id, label: `${unidadEmoji(u.tipo)} ${u.tipo} #${u.numero}` })),
    [opciones],
  )

  const handleConfirmar = async (e) => {
    e.preventDefault()
    if (!unidadDestinoId || !password) return
    setSaving(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('mover_unidad_temporada', {
        p_reserva_id: reserva.id,
        p_unidad_destino_id: unidadDestinoId,
        p_password: password,
      })
      if (rpcError) throw rpcError
      setPassword('')
      setUnidadDestinoId('')
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo mover la unidad.')
    } finally {
      setSaving(false)
    }
  }

  if (!reserva || !unidadOrigen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mover Cliente de Temporada">
      <form onSubmit={handleConfirmar} className="space-y-6">
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2 text-xs">
          <p><span className="text-gray-500 uppercase tracking-widest">Cliente:</span> <span className="text-white font-bold">{reserva.clientes?.nombre || 'S/N'}</span></p>
          <p><span className="text-gray-500 uppercase tracking-widest">Origen:</span> <span className="text-white">{unidadEmoji(unidadOrigen.type)} {unidadOrigen.type} #{unidadOrigen.number}</span></p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unidad destino</label>
          <BrandSelect value={unidadDestinoId} onChange={setUnidadDestinoId} options={opcionesCombo} />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
            Confirmá con tu contraseña de superadmin
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-red-500/50"
          />
        </div>

        {error && <p className="text-[11px] text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!unidadDestinoId || !password || saving}
          className="w-full py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold uppercase tracking-[0.2em] rounded-xl text-xs transition-all shadow-xl"
        >
          {saving ? 'Moviendo...' : 'Confirmar Movimiento'}
        </button>
      </form>
    </Modal>
  )
}
