import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield, DollarSign, Save, Check, Info, Clock, RefreshCw } from 'lucide-react'
import MoneyInput from '../../components/inputs/MoneyInput'
import BrandSelect from '../../components/ui/BrandSelect'
import LoadingButton from '../../components/ui/LoadingButton'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { useDialog } from '../../context/DialogProvider'
import { usePermiso, useAuth } from '../../context/AuthProvider'
import { formatPesos, formatFecha, formatNombre } from '../../lib/format'
import { unidadEmoji } from '../../lib/unidadIcono'

// Perfil y tarifas — rebranding Stitch (nov 2026, Bloque 4).
// Fuente: design/stitch/08_perfil_desktop.{html,png} y 08_perfil_mobile.*
//
// Cambia SOLO la presentación: perfil compacto arriba y los dos bloques de
// acción (Tarifas base / Cotización del dólar) al lado en desktop y
// apilados en mobile. Los handlers (`handleGuardarTarifas`,
// `handleGuardarCotizacion`) y el permiso `ajustes_precio` quedan igual.
//
// Novedad de estado: los botones arrancan deshabilitados y se activan recién
// cuando hay algo distinto que guardar — en el mock son los estados
// "1. Normal" y "2. Editando tarifas". Antes se podía guardar cien veces el
// mismo valor.

/** Tarjeta blanca de sección, con su ícono y bajada. */
function BloqueAccion({ icono: Icono, titulo, bajada, children }) {
  return (
    <section className="card-surface card-pad flex flex-col gap-4 anim-fade-up">
      <header className="flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-inner bg-surface text-ink flex items-center justify-center">
          <Icono size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-body text-ink">{titulo}</h2>
          <p className="text-label text-ink-2 mt-1">{bajada}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

export default function Perfil() {
  const { perfil } = useAuth()
  const [userEmail, setUserEmail] = useState('')
  const [tarifaCarpa, setTarifaCarpa] = useState(() => Number(localStorage.getItem('prius_tarifa_carpa')) || 1500000)
  const [tarifaSombrilla, setTarifaSombrilla] = useState(() => Number(localStorage.getItem('prius_tarifa_sombrilla')) || 900000)
  const [saved, setSaved] = useState(false)
  // Cotización del dólar (31/10/2026): qué fuente usa el balneario para
  // convertir los pagos en USD. Solo superadmin — es una decisión de negocio
  // y la policy de config_tipo_cambio lo valida igual del lado del servidor.
  const tc = useTipoCambio()
  const { toast } = useDialog()
  const puedeEditarCotizacion = usePermiso('ajustes_precio')
  const [guardandoTc, setGuardandoTc] = useState(false)
  const [tcTipo, setTcTipo] = useState('oficial')
  const [tcLado, setTcLado] = useState('venta')
  useEffect(() => { setTcTipo(tc.tipo); setTcLado(tc.lado) }, [tc.tipo, tc.lado])

  const handleGuardarCotizacion = async () => {
    setGuardandoTc(true)
    try {
      const { error } = await supabase
        .from('config_tipo_cambio')
        .update({ tipo: tcTipo, lado: tcLado, updated_at: new Date().toISOString() })
        .eq('id', true)
      if (error) throw error
      await tc.refrescar()
      toast('Cotización actualizada', { tone: 'success' })
    } catch (err) {
      toast(err.message || 'No se pudo guardar la cotización.', { tone: 'error' })
    } finally {
      setGuardandoTc(false)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || 'Admin')
    })
  }, [])

  const handleGuardarTarifas = () => {
    localStorage.setItem('prius_tarifa_carpa', String(tarifaCarpa || 0))
    localStorage.setItem('prius_tarifa_sombrilla', String(tarifaSombrilla || 0))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ¿Hay algo distinto de lo guardado? Define el estado del botón.
  const tarifasSucias =
    tarifaCarpa !== (Number(localStorage.getItem('prius_tarifa_carpa')) || 1500000) ||
    tarifaSombrilla !== (Number(localStorage.getItem('prius_tarifa_sombrilla')) || 900000)
  const cotizacionSucia = tcTipo !== tc.tipo || tcLado !== tc.lado

  // Nombre en formato título a partir del dato que ya existe: `perfiles.nombre`
  // si está cargado, y si no la parte local del email. No se guarda nada
  // distinto en la base, es solo cómo se muestra.
  const nombreMostrado = formatNombre(perfil?.nombre || userEmail.split('@')[0].replace(/[._-]+/g, ' ')) || 'Equipo Prius'
  const inicial = (nombreMostrado[0] || 'P').toUpperCase()

  const botonPrimario =
    'w-full h-12 rounded-inner font-semibold text-body flex items-center justify-center gap-2 anim-press anim-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    // pb-bottom-nav-safe: en mobile la bottom nav es fija y sin esto tapaba
    // el botón de "Guardar cotización", que es el último de la página.
    <div className="space-y-3 anim-fade-up-page pb-bottom-nav-safe md:pb-0">
      {/* Perfil compacto */}
      <section className="card-surface card-pad ">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 md:flex-1">
            <span className="shrink-0 w-14 h-14 rounded-card bg-gold text-ink flex items-center justify-center text-stat">
              {inicial}
            </span>
            <div className="min-w-0">
              <h1 className="text-card-title text-ink break-words">{nombreMostrado}</h1>
              <p className="text-label text-ink-2 mt-1">Administración general</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2 md:shrink-0">
            <div className="bg-surface rounded-inner px-3 py-2 min-w-0">
              <p className="text-label text-ink-2">Email</p>
              <p className="text-body text-ink truncate">{userEmail || '—'}</p>
            </div>
            <div className="bg-surface rounded-inner px-3 py-2 flex items-center justify-between gap-3">
              <p className="text-label text-ink-2">Seguridad</p>
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-icon bg-success-soft text-success-ink text-label">
                <Shield size={11} /> Protegida
              </span>
            </div>
            {perfil?.rol && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-inner bg-ink text-on-ink text-label justify-center">
                {perfil.rol}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-grid items-start">
        {/* Tarifas base */}
        <BloqueAccion
          icono={DollarSign}
          titulo="Tarifas base"
          bajada="Valores de referencia para alquileres de temporada."
        >
          <div className="space-y-3">
            <MoneyInput label={`${unidadEmoji('carpa')} Precio base carpa`} value={tarifaCarpa} onChange={setTarifaCarpa} max={100_000_000} />
            <MoneyInput label={`${unidadEmoji('sombrilla')} Precio base sombrilla`} value={tarifaSombrilla} onChange={setTarifaSombrilla} max={100_000_000} />
          </div>

          <p className="text-label text-ink-2 flex items-start gap-2">
            <Info size={13} className="shrink-0 mt-1 text-ink-2" />
            Las tarifas actualizadas impactan en las nuevas reservas del plano y en el cálculo de presupuestos.
          </p>

          <button
            onClick={handleGuardarTarifas}
            disabled={!tarifasSucias && !saved}
            className={`${botonPrimario} ${
              saved ? 'bg-success-soft text-success-ink' : 'bg-card border border-line hover:bg-surface text-ink'
            }`}
          >
            {saved ? <><Check size={16} /> Tarifas guardadas</> : <><Save size={16} /> Actualizar tarifas</>}
          </button>
        </BloqueAccion>

        {/* Cotización del dólar */}
        <BloqueAccion
          icono={RefreshCw}
          titulo="Cotización del dólar"
          bajada="Define qué cotización se usa para convertir a pesos los pagos en dólares. El peso sigue siendo la moneda de la caja y los reportes."
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <label className="text-label text-ink-2">Fuente</label>
              <BrandSelect
                value={tcTipo}
                onChange={setTcTipo}
                disabled={!puedeEditarCotizacion}
                options={[{ value: 'oficial', label: 'Oficial' }, { value: 'blue', label: 'Blue' }]}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <label className="text-label text-ink-2">Valor</label>
              <BrandSelect
                value={tcLado}
                onChange={setTcLado}
                disabled={!puedeEditarCotizacion}
                options={[{ value: 'venta', label: 'Venta' }, { value: 'compra', label: 'Compra' }]}
              />
            </div>
          </div>

          <div className="bg-surface rounded-inner p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-label text-ink-2">Cotización utilizada</p>
              <span className="text-label text-ink-2">ARS / USD</span>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
              <p className="text-card-title text-ink tabular-nums">{tc.valor ? formatPesos(tc.valor) : '—'}</p>
              {/* Chip ámbar si la cotización no es de hoy, verde si está al día. */}
              {tc.fecha && (
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-icon text-label ${
                    tc.stale ? 'bg-gold-100 text-ink' : 'bg-success-soft text-success-ink'
                  }`}
                >
                  <Clock size={11} /> {formatFecha(tc.fecha)} · {tc.stale ? 'No es de hoy' : 'Al día'}
                </span>
              )}
            </div>
          </div>

          {puedeEditarCotizacion && (
            <LoadingButton
              loading={guardandoTc}
              loadingText="Guardando…"
              onClick={handleGuardarCotizacion}
              disabled={!cotizacionSucia}
              className={`${botonPrimario} bg-card border border-line hover:bg-surface text-ink`}
            >
              <Save size={16} /> Guardar cotización
            </LoadingButton>
          )}
        </BloqueAccion>
      </div>
    </div>
  )
}
