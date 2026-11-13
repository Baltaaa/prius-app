import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Plus, Send, Trash2, Smartphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDialog } from '../../context/DialogProvider'
import { usePush } from '../../hooks/usePush'
import { invocarFuncion } from '../../lib/invocarFuncion'
import TextInput from '../inputs/TextInput'
import PhoneInput from '../inputs/PhoneInput'
import BrandSelect from '../ui/BrandSelect'
import LoadingButton from '../ui/LoadingButton'

// Avisos de cierre de caja (nov 2026) — solo superadmin.
//
// Dos tarjetas: a quién y por dónde se manda el resumen, y el permiso de
// notificaciones de ESTE dispositivo.

const CANALES = [
  { value: 'cloud_api', label: 'WhatsApp (plantilla oficial con el PDF)' },
  { value: 'callmebot', label: 'WhatsApp por CallMeBot (texto plano)' },
  { value: 'off', label: 'Sin WhatsApp (solo notificación en el teléfono)' },
]

/** Permiso de notificaciones de este dispositivo. */
function TarjetaPush() {
  const { soportado, requiereInstalar, permiso, suscripto, trabajando, error, activar, desactivar } = usePush()
  const { toast } = useDialog()

  return (
    <div className="card-surface card-pad space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-icon bg-gold-100 text-ink flex items-center justify-center">
          {suscripto ? <Bell size={16} /> : <BellOff size={16} />}
        </span>
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink">Notificaciones de cierre de caja</h3>
          <p className="text-label text-ink-2 mt-1">
            Un aviso en este teléfono apenas se cierra la caja, con el neto, la ocupación y los egresos.
          </p>
        </div>
      </div>

      {!soportado ? (
        <p className="text-label text-ink-2 card-inner">
          Este navegador no puede mostrar notificaciones. Probá desde Chrome en Android o desde la app
          instalada en el iPhone.
        </p>
      ) : requiereInstalar ? (
        <p className="text-label text-ink-2 card-inner flex items-start gap-2">
          <Smartphone size={14} className="shrink-0 mt-1" />
          En iPhone los avisos solo funcionan con la app abierta desde la pantalla de inicio. Agregala con
          Compartir → “Agregar a inicio” y volvé a entrar desde ahí.
        </p>
      ) : permiso === 'denied' ? (
        <p className="text-label text-ink-2 card-inner">
          Bloqueaste los avisos para este sitio. Habilitalos en los ajustes del navegador y volvé a entrar.
        </p>
      ) : (
        <div className="flex gap-3">
          {suscripto ? (
            <button
              type="button"
              onClick={async () => { await desactivar(); toast('Avisos desactivados en este dispositivo') }}
              disabled={trabajando}
              className="text-label flex-1 min-h-[44px] rounded-full bg-surface text-ink-2 border border-line disabled:opacity-50"
            >
              Desactivar en este dispositivo
            </button>
          ) : (
            <LoadingButton
              type="button"
              loading={trabajando}
              loadingText="Activando…"
              onClick={async () => { if (await activar()) toast('Listo, vas a recibir los avisos acá', { tone: 'success' }) }}
              className="text-label flex-1 min-h-[44px] rounded-full bg-ink text-on-ink hover:bg-chart-2"
            >
              Activar avisos
            </LoadingButton>
          )}
        </div>
      )}

      {error && <p className="text-label text-danger">{error}</p>}
    </div>
  )
}

export default function NotificacionesConfig() {
  const { toast } = useDialog()
  const [cfg, setCfg] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', telefono: '', callmebot_apikey: '' })

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('config_notificaciones').select('*').eq('id', true).maybeSingle()
    setCfg(data || null)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (cambios, mensaje = 'Configuración guardada') => {
    setGuardando(true)
    try {
      const { data, error } = await supabase
        .from('config_notificaciones')
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq('id', true)
        .select()
        .single()
      if (error) throw error
      setCfg(data)
      toast(mensaje, { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No pudimos guardar la configuración.', { tone: 'error' })
    } finally {
      setGuardando(false)
    }
  }

  const destinatarios = cfg?.destinatarios || []

  const agregar = async (e) => {
    e.preventDefault()
    if (!nuevo.nombre.trim() || !nuevo.telefono) return
    await guardar({
      destinatarios: [...destinatarios, {
        nombre: nuevo.nombre.trim(),
        telefono_e164: nuevo.telefono,
        activo: true,
        ...(nuevo.callmebot_apikey.trim() ? { callmebot_apikey: nuevo.callmebot_apikey.trim() } : {}),
      }],
    }, 'Destinatario agregado')
    setNuevo({ nombre: '', telefono: '', callmebot_apikey: '' })
  }

  const alternar = (i) => guardar({
    destinatarios: destinatarios.map((d, j) => (j === i ? { ...d, activo: !d.activo } : d)),
  }, 'Destinatario actualizado')

  const quitar = (i) => guardar({
    destinatarios: destinatarios.filter((_, j) => j !== i),
  }, 'Destinatario eliminado')

  const enviarPrueba = async () => {
    setProbando(true)
    try {
      const data = await invocarFuncion('notificar-cierre-caja', { body: { modo: 'prueba' } })
      const canales = Object.values(data?.resultado || {})
      const ok = canales.some((c) => c?.ok)
      const motivos = canales.filter((c) => !c?.ok).map((c) => `${c.canal}: ${c.motivo || 'no se pudo'}`).join(' · ')
      toast(
        ok ? `Prueba enviada con la caja del ${data.caja}${motivos ? ` (${motivos})` : ''}` : `No se envió por ningún canal — ${motivos}`,
        { tone: ok ? 'success' : 'error' },
      )
    } catch (err) {
      toast(err.message || 'No pudimos mandar la prueba.', { tone: 'error' })
    } finally {
      setProbando(false)
    }
  }

  if (cargando) return <div className="card-surface card-pad"><p className="text-label text-ink-2">Cargando…</p></div>

  return (
    <div className="space-y-grid">
      <TarjetaPush />

      <div className="card-surface card-pad space-y-4">
        <div>
          <h3 className="text-body font-semibold text-ink">Aviso por WhatsApp al cerrar la caja</h3>
          <p className="text-label text-ink-2 mt-1">
            Apenas se cierra la caja (a mano o sola a las 00:00) se manda el resumen del día con el PDF adjunto.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-label text-ink-2">Cómo se manda</label>
          <BrandSelect
            value={cfg?.canal_whatsapp || 'cloud_api'}
            onChange={(v) => guardar({ canal_whatsapp: v })}
            options={CANALES}
          />
        </div>

        <div>
          <p className="text-label text-ink-2 mb-2">Destinatarios ({destinatarios.length})</p>
          {destinatarios.length === 0 ? (
            <p className="text-label text-ink-2 card-inner">
              Todavía no hay nadie cargado: por ahora el aviso sale solo como notificación en el teléfono.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {destinatarios.map((d, i) => (
                <li key={`${d.telefono_e164}-${i}`} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-body truncate ${d.activo ? 'text-ink' : 'text-ink-2 line-through'}`}>{d.nombre}</p>
                    <p className="text-label text-ink-2 truncate">
                      {d.telefono_e164}{d.callmebot_apikey ? ' · con clave de CallMeBot' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => alternar(i)}
                      disabled={guardando}
                      title={d.activo ? 'Dejar de avisarle' : 'Volver a avisarle'}
                      className="w-11 h-11 rounded-full text-ink-2 hover:bg-surface inline-flex items-center justify-center disabled:opacity-50"
                    >
                      {d.activo ? <Bell size={16} /> : <BellOff size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => quitar(i)}
                      disabled={guardando}
                      title="Quitar"
                      className="w-11 h-11 rounded-full text-danger hover:bg-danger-soft inline-flex items-center justify-center disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bloque con borde y NO `card-inner`: un `.field` tiene fondo
            surface, el mismo que card-inner, y el campo quedaría invisible. */}
        <form onSubmit={agregar} className="rounded-inner border border-line p-4 space-y-3">
          <p className="text-label text-ink-2">Agregar destinatario</p>
          <TextInput label="Nombre" value={nuevo.nombre} onChange={(v) => setNuevo((n) => ({ ...n, nombre: v }))} maxLength={60} required />
          <PhoneInput label="Celular" value={nuevo.telefono} onChange={(v) => setNuevo((n) => ({ ...n, telefono: v }))} required />
          <TextInput
            label="Clave de CallMeBot (opcional)"
            hint="Solo hace falta si se usa CallMeBot como canal."
            value={nuevo.callmebot_apikey}
            onChange={(v) => setNuevo((n) => ({ ...n, callmebot_apikey: v }))}
            maxLength={60}
          />
          <LoadingButton
            type="submit"
            loading={guardando}
            loadingText="Guardando…"
            disabled={!nuevo.nombre.trim() || !nuevo.telefono}
            className="text-label w-full min-h-[44px] rounded-full bg-ink text-on-ink hover:bg-chart-2"
          >
            <Plus size={14} className="inline mr-1" /> Agregar
          </LoadingButton>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-label text-ink-2">No molestar desde</label>
            <input
              type="time"
              value={(cfg?.silencio_desde || '00:00').slice(0, 5)}
              onChange={(e) => guardar({ silencio_desde: e.target.value })}
              className="field"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label text-ink-2">hasta</label>
            <input
              type="time"
              value={(cfg?.silencio_hasta || '08:00').slice(0, 5)}
              onChange={(e) => guardar({ silencio_hasta: e.target.value })}
              className="field"
            />
          </div>
        </div>
        <p className="text-label text-ink-2">
          Un cierre que cae en ese horario no despierta a nadie: el aviso sale al terminar el silencio.
        </p>

        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={cfg?.mostrar_montos_en_push ?? true}
            onChange={(e) => guardar({ mostrar_montos_en_push: e.target.checked })}
            className="w-5 h-5 accent-gold"
          />
          <span className="text-body text-ink">Mostrar los montos en la notificación del teléfono</span>
        </label>

        <button
          type="button"
          onClick={enviarPrueba}
          disabled={probando}
          className="text-label w-full min-h-[44px] rounded-full bg-surface text-ink border border-line hover:bg-line inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send size={14} /> {probando ? 'Enviando prueba…' : 'Enviar prueba'}
        </button>
        <p className="text-label text-ink-2">
          La prueba usa la última caja real ya cerrada y sale marcada como PRUEBA. No crea ni modifica ninguna caja.
        </p>
      </div>
    </div>
  )
}
