import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../context/DialogProvider'
import Modal from '../crm/Modal'
import BrandSelect from '../ui/BrandSelect'
import { unidadEmoji, formatUnidad, formatNombre} from '../../lib/format'
import UnidadLabel from '../crm/UnidadLabel'

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
    () => [...opciones].sort((a, b) => a.numero - b.numero).map((u) => ({ value: u.id, label: `${unidadEmoji(u.tipo)} ${formatUnidad(u.tipo, u.numero)}` })),
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
        <div className="p-4 bg-surface border border-line rounded-inner space-y-2 text-label">
          <p><span className="text-label text-ink-2">Cliente:</span> <span className="text-ink font-semibold">{formatNombre(reserva.clientes?.nombre) || 'S/N'}</span></p>
          <p><span className="text-label text-ink-2">Origen:</span> <span className="text-ink"><UnidadLabel tipo={unidadOrigen.type} numero={unidadOrigen.number} /></span></p>
        </div>

        <div className="space-y-2">
          <label className="text-label text-ink-2">Unidad destino</label>
          <BrandSelect value={unidadDestinoId} onChange={setUnidadDestinoId} options={opcionesCombo} />
        </div>

        <div className="space-y-2">
          <label className="text-label text-danger">
            Confirmá con tu contraseña de superadmin
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-12 px-4 py-3 bg-surface rounded-inner text-ink text-body outline-none border border-transparent focus:ring-2 focus:ring-gold"
          />
        </div>

        {error && <p className="text-label text-danger">{error}</p>}

        <button
          type="submit"
          disabled={!unidadDestinoId || !password || saving}
          className="text-label w-full py-4 bg-danger hover:bg-danger-ink disabled:opacity-50 text-on-ink rounded-inner transition-all"
        >
          {saving ? 'Moviendo...' : 'Confirmar Movimiento'}
        </button>
      </form>
    </Modal>
  )
}
