import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

const OverlayContext = createContext(null)

/**
 * Mecanismo central único para todo lo que se superpone en Z sobre la app
 * (Tarea 1, oct 2026) — bug real que disparó esto: el search dropdown y el
 * menú de usuario del TopBar podían quedar abiertos a la vez, cada uno con
 * su propia lógica de click-afuera copiada y pegada.
 *
 * Reglas:
 * - Un solo listener de `mousedown` (en fase de captura, así un click que
 *   cierra un overlay no deja pasar el click al elemento de abajo) y uno de
 *   `keydown` para toda la app — antes cada overlay agregaba el suyo.
 * - Al abrir un overlay NUEVO, se detecta solo si es "anidado" de alguno ya
 *   abierto: si el trigger (o cualquier nodo registrado) de este overlay
 *   cae dentro del territorio de un overlay ya abierto, se trata como su
 *   hijo — no lo cierra al abrirse, y clicks adentro suyo tampoco cuentan
 *   como "afuera" del padre. Si NO es hijo de nadie, es de primer nivel: se
 *   cierran todos los demás overlays de primer nivel que estuvieran
 *   abiertos (eso es lo que arregla el bug de search+menú de usuario).
 * - Escape cierra solo el overlay más de arriba del stack (el último
 *   abierto), no todos a la vez.
 *
 * Cada overlay se registra con uno o más nodos DOM ("territorio": trigger +
 * panel + cualquier contenido en portal que sea parte de él) vía
 * `useOverlay()`. Un click es "adentro" de un overlay si cae dentro de
 * CUALQUIERA de sus nodos registrados, sin importar si ese nodo vive en un
 * portal fuera del árbol DOM del resto (mismo problema que ya arreglamos en
 * DateInput.tsx — este mecanismo lo generaliza para no repetirlo ahí ni en
 * ningún overlay nuevo).
 */
export function OverlayProvider({ children }) {
  const overlaysRef = useRef(new Map()) // id -> { nodes: Set<Element>, onRequestClose: () => void }
  const stackRef = useRef([]) // ids, orden de apertura — el último es el de más arriba

  const register = useCallback((id, info) => {
    overlaysRef.current.set(id, info)
  }, [])

  const unregister = useCallback((id) => {
    overlaysRef.current.delete(id)
    stackRef.current = stackRef.current.filter((x) => x !== id)
  }, [])

  // ¿Algún nodo de `id` ya está contenido en el territorio de `otroId`?
  const esHijoDe = (id, otroId) => {
    const info = overlaysRef.current.get(id)
    const otro = overlaysRef.current.get(otroId)
    if (!info || !otro) return false
    for (const n of info.nodes) {
      if (!n) continue
      for (const on of otro.nodes) {
        if (on && on !== n && on.contains(n)) return true
      }
    }
    return false
  }

  const peekTop = useCallback(() => stackRef.current[stackRef.current.length - 1] || null, [])

  const notifyOpen = useCallback((id, explicitParentId) => {
    const padre = explicitParentId || stackRef.current.find((openId) => openId !== id && esHijoDe(id, openId))
    if (!padre) {
      // Top-level nuevo: cierra todo lo que esté abierto (no debería haber
      // nada abierto que sea padre de este, ya lo chequeamos arriba).
      for (const openId of [...stackRef.current]) {
        if (openId === id) continue
        overlaysRef.current.get(openId)?.onRequestClose?.()
      }
      stackRef.current = [id]
    } else {
      stackRef.current = stackRef.current.filter((x) => x !== id).concat(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const notifyClose = useCallback((id) => {
    stackRef.current = stackRef.current.filter((x) => x !== id)
  }, [])

  useEffect(() => {
    const onPointerDown = (e) => {
      const target = e.target
      // De arriba (más nuevo) hacia abajo: el primero que contenga el click
      // frena todo (es "adentro" suyo, y por transitividad de un hijo
      // clickeado, también cuenta como adentro de sus padres). Todo lo que
      // se revisa ANTES de ese (overlays más nuevos que no lo contienen) se
      // cierra.
      for (const id of [...stackRef.current].reverse()) {
        const info = overlaysRef.current.get(id)
        if (!info) continue
        const adentro = [...info.nodes].some((n) => n && n.contains(target))
        if (adentro) return
        info.onRequestClose?.()
      }
    }
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      const topId = stackRef.current[stackRef.current.length - 1]
      if (!topId) return
      overlaysRef.current.get(topId)?.onRequestClose?.()
      e.stopPropagation()
    }
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <OverlayContext.Provider value={{ register, unregister, notifyOpen, notifyClose, peekTop }}>
      {children}
    </OverlayContext.Provider>
  )
}

/**
 * `id`: string estable (no cambia entre renders) — ej. `"topbar-search"`.
 * `isOpen`: estado actual del overlay (lo sigue manejando el componente).
 * `onRequestClose`: qué hacer cuando el manager decide que hay que cerrar
 *   (click afuera, Escape, o se abrió otro overlay de primer nivel que no
 *   es hijo suyo). Si hay cambios sin guardar, chequear acá adentro y
 *   confirmar con `useDialog().confirm` antes de cerrar — este hook no lo
 *   hace por vos a propósito, cada formulario sabe mejor que nadie qué
 *   significa "tiene cambios" (ver Modal.jsx, que sí expone un prop
 *   `isDirty` para el caso común de "modal con formulario").
 * `parentId`: override manual del padre — solo hace falta cuando el
 *   overlay no tiene un trigger DOM detectable (ej. el confirm()/alert()
 *   de DialogProvider, que se dispara desde código, no de un click en un
 *   botón visible). Para el resto (DateInput, BrandSelect, dropdowns con
 *   trigger propio) el anidado se detecta solo, no hace falta pasarlo.
 *
 * Devuelve `bind`: ref callback para adjuntar a CADA nodo DOM que forme
 * parte del "territorio" de este overlay (el trigger, el panel, el
 * contenido en portal) — un click en cualquiera de ellos no cuenta como
 * "afuera".
 */
export function useOverlay({ id, isOpen, onRequestClose, parentId }) {
  const ctx = useContext(OverlayContext)
  if (!ctx) throw new Error('useOverlay debe usarse dentro de <OverlayProvider>')
  const nodesRef = useRef(new Set())
  const onRequestCloseRef = useRef(onRequestClose)
  onRequestCloseRef.current = onRequestClose

  useEffect(() => {
    if (!isOpen) return
    ctx.register(id, {
      nodes: nodesRef.current,
      onRequestClose: () => onRequestCloseRef.current?.(),
    })
    ctx.notifyOpen(id, parentId)
    return () => {
      ctx.unregister(id)
      ctx.notifyClose(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, id, parentId])

  const bind = useCallback((el) => {
    if (el) nodesRef.current.add(el)
  }, [])

  return { bind }
}

/** Id del overlay más de arriba del stack en este momento, o null. Para
 * casos sin trigger DOM (ver `parentId` en `useOverlay`). */
export function useOverlayTop() {
  const ctx = useContext(OverlayContext)
  if (!ctx) throw new Error('useOverlayTop debe usarse dentro de <OverlayProvider>')
  return ctx.peekTop
}
