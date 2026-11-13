import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Share, Plus, X } from 'lucide-react'

// Invitación a instalar la app (nov 2026, Tarea 6).
//
// Dos caminos, porque los navegadores no se comportan igual:
//   * Android / Chrome: hay `beforeinstallprompt`, así que es un botón
//     "Instalar" que abre el diálogo del sistema.
//   * iPhone / Safari: no existe ese evento. Lo único que se puede hacer es
//     explicar los dos pasos (Compartir → Agregar a inicio) con los íconos
//     reales del sistema.
//
// Se muestra UNA vez por dispositivo: si se descarta o se instala, no vuelve.

const CLAVE = 'prius:instalar-descartado'

function esStandalone() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true
}

function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function yaDescartado() {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    // Safari en privado tira al leer localStorage: mejor no mostrar nada que
    // romper el render.
    return true
  }
}

export default function BannerInstalar() {
  const [visible, setVisible] = useState(false)
  const [promptNativo, setPromptNativo] = useState(null)
  const [enIOS, setEnIOS] = useState(false)

  const descartar = useCallback(() => {
    setVisible(false)
    try { localStorage.setItem(CLAVE, '1') } catch { /* privado: se vuelve a ver, no es grave */ }
  }, [])

  useEffect(() => {
    if (esStandalone() || yaDescartado()) return undefined

    // Android / Chrome.
    const onPrompt = (e) => {
      e.preventDefault()
      setPromptNativo(e)
      setVisible(true)
    }
    const onInstalada = () => descartar()
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalada)

    // iPhone: no hay `beforeinstallprompt`, se decide por el navegador. Un
    // respiro antes de aparecer: que no sea lo primero que se ve.
    let t
    if (esIOS()) {
      setEnIOS(true)
      t = setTimeout(() => setVisible(true), 4000)
    }

    return () => {
      clearTimeout(t)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalada)
    }
  }, [descartar])

  const instalar = async () => {
    if (!promptNativo) return
    promptNativo.prompt()
    await promptNativo.userChoice
    descartar()
  }

  if (!visible) return null

  return createPortal(
    <div
      role="dialog"
      aria-label="Instalar Prius"
      className="fixed left-0 right-0 z-[997] px-page animate-premium-fade"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
    >
      <div className="surface-pop card-pad max-w-md mx-auto relative">
        <button
          type="button"
          onClick={descartar}
          aria-label="Ahora no"
          className="absolute top-2 right-2 w-11 h-11 rounded-full text-ink-2 hover:bg-surface inline-flex items-center justify-center"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pr-10">
          <img src="/icons/icon-192.png" alt="" aria-hidden className="w-10 h-10 rounded-icon shrink-0" />
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink">Tené Prius en la pantalla de inicio</p>
            <p className="text-label text-ink-2 mt-1">
              Abre más rápido, a pantalla completa, y es la única forma de recibir los avisos de cierre de caja.
            </p>
          </div>
        </div>

        {enIOS ? (
          <ol className="mt-4 space-y-2">
            <li className="flex items-center gap-3 text-body text-ink">
              <span className="w-7 h-7 shrink-0 rounded-icon bg-surface inline-flex items-center justify-center text-ink-2">
                <Share size={15} />
              </span>
              Tocá <span className="font-semibold">Compartir</span> abajo en Safari
            </li>
            <li className="flex items-center gap-3 text-body text-ink">
              <span className="w-7 h-7 shrink-0 rounded-icon bg-surface inline-flex items-center justify-center text-ink-2">
                <Plus size={15} />
              </span>
              Elegí <span className="font-semibold">Agregar a inicio</span>
            </li>
          </ol>
        ) : (
          <button
            type="button"
            onClick={instalar}
            className="mt-4 text-label w-full min-h-[44px] rounded-full bg-ink text-on-ink hover:bg-chart-2 inline-flex items-center justify-center gap-2"
          >
            <Download size={16} /> Instalar
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
