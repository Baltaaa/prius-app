import { useState } from 'react'
import { useData } from '../../context/DataProvider'
import { useDialog } from '../../context/DialogProvider'
import { CATEGORIA_GASTO_EMOJI } from '../../lib/caja'
import TextInput from '../inputs/TextInput'
import IntegerInput from '../inputs/IntegerInput'
import LoadingButton from '../ui/LoadingButton'
import { Plus, Pencil, Eye, EyeOff, Check, X } from 'lucide-react'

// Administración de las categorías de egreso (nov 2026, solo superadmin).
//
// Una categoría NUNCA se borra: se desactiva. Los gastos viejos siguen
// apuntando a ella (si no, el cierre y los reportes de meses anteriores
// perderían su desglose), pero deja de ofrecerse al cargar un gasto nuevo.
export default function CategoriasGastoConfig() {
  const { categoriasGasto, guardarCategoriaGasto } = useData()
  const { toast } = useDialog()

  const [creando, setCreando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [ordenEdit, setOrdenEdit] = useState(null)
  const [saving, setSaving] = useState(false)

  const guardar = async (payload, mensaje) => {
    setSaving(true)
    try {
      await guardarCategoriaGasto(payload)
      toast(mensaje, { tone: 'success' })
      return true
    } catch (err) {
      toast(err.message || 'No se pudo guardar la categoría.', { tone: 'error' })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    if (!nombreNuevo.trim()) return
    const ok = await guardar({ nombre: nombreNuevo.trim() }, 'Categoría creada')
    if (ok) { setNombreNuevo(''); setCreando(false) }
  }

  const handleGuardarEdit = async (cat) => {
    const ok = await guardar(
      { id: cat.id, nombre: nombreEdit.trim() || cat.nombre, orden: ordenEdit ?? cat.orden },
      'Categoría actualizada',
    )
    if (ok) setEditandoId(null)
  }

  const handleToggleActiva = (cat) => guardar(
    { id: cat.id, activa: !cat.activa },
    cat.activa ? 'Categoría desactivada' : 'Categoría reactivada',
  )

  return (
    <div className="card-surface card-pad space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink">Categorías de egreso</h3>
          <p className="text-label text-ink-2 mt-1">
            Las que están activas son las que se pueden elegir al cargar un gasto. No se borran: se desactivan.
          </p>
        </div>
        {!creando && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="text-label shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-surface text-ink border border-line hover:bg-line transition-all"
          >
            <Plus size={14} /> Nueva
          </button>
        )}
      </div>

      {creando && (
        <form onSubmit={handleCrear} className="card-inner space-y-3 animate-premium-fade">
          <TextInput label="Nombre de la categoría" value={nombreNuevo} onChange={setNombreNuevo} maxLength={60} required placeholder="Ej. Alquiler de equipos" />
          <div className="flex gap-3">
            <button type="button" onClick={() => { setCreando(false); setNombreNuevo('') }} className="text-label flex-1 min-h-[44px] rounded-full bg-surface text-ink-2 border border-line">
              Cancelar
            </button>
            <LoadingButton
              type="submit"
              loading={saving}
              loadingText="Creando..."
              disabled={!nombreNuevo.trim()}
              className="text-label flex-1 min-h-[44px] rounded-full bg-ink text-on-ink hover:bg-chart-2"
            >
              Crear categoría
            </LoadingButton>
          </div>
        </form>
      )}

      <ul className="divide-y divide-line">
        {(categoriasGasto || []).map((cat) => (
          <li key={cat.id} className="py-3">
            {editandoId === cat.id ? (
              <div className="space-y-3 animate-premium-fade">
                <TextInput label="Nombre" value={nombreEdit} onChange={setNombreEdit} maxLength={60} />
                <IntegerInput label="Orden" value={ordenEdit} onChange={setOrdenEdit} min={1} max={999} />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditandoId(null)} className="text-label flex-1 min-h-[44px] rounded-full bg-surface text-ink-2 border border-line inline-flex items-center justify-center gap-2">
                    <X size={14} /> Cancelar
                  </button>
                  <button type="button" disabled={saving} onClick={() => handleGuardarEdit(cat)} className="text-label flex-1 min-h-[44px] rounded-full bg-ink text-on-ink hover:bg-chart-2 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                    <Check size={14} /> Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <span aria-hidden className="shrink-0">{CATEGORIA_GASTO_EMOJI[cat.slug] || '📌'}</span>
                  <div className="min-w-0">
                    <p className={`text-body truncate ${cat.activa ? 'text-ink' : 'text-ink-2 line-through'}`} title={cat.nombre}>{cat.nombre}</p>
                    <p className="text-label text-ink-2">Orden {cat.orden}{cat.activa ? '' : ' · desactivada'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Renombrar o reordenar"
                    onClick={() => { setEditandoId(cat.id); setNombreEdit(cat.nombre); setOrdenEdit(cat.orden) }}
                    className="w-11 h-11 rounded-full text-ink-2 hover:bg-surface inline-flex items-center justify-center"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    title={cat.activa ? 'Desactivar' : 'Reactivar'}
                    disabled={saving}
                    onClick={() => handleToggleActiva(cat)}
                    className="w-11 h-11 rounded-full text-ink-2 hover:bg-surface inline-flex items-center justify-center disabled:opacity-50"
                  >
                    {cat.activa ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
