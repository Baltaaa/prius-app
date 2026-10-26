import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import NotificacionesBandeja from './NotificacionesBandeja'
import { supabase } from '../../lib/supabase'
import { useData } from '../../context/DataProvider'
import { useAuth } from '../../context/AuthProvider'
import { useDebounced } from '../../hooks/useDebounced'
import { unidadEmoji, normalizeText, formatComprobante, formatFechaLarga } from '../../lib/format'
import { parseDNI, parseUnidadQuery, normalizarNumeroComprobante } from '../../lib/parse'
import { estadoBadgeStatus } from '../../lib/reservas'
import { linkToCliente, linkToReserva, linkToPlano, linkToRecepcion } from '../../lib/deepLinks'
import { useOverlay } from '../../context/OverlayProvider'
import { isFeatureEnabled } from '../../lib/features'
import SearchInput from '../inputs/SearchInput'
import {
  Search, Bell, User, LogOut, ChevronDown, X,
  QrCode, Calendar, EyeOff,
} from 'lucide-react'

// B5 (oct 2026): modo incógnito — visible SOLO para esta cuenta puntual.
// Esto es nada más una comodidad de UI (ocultar el botón a quien no debería
// verlo); la seguridad real está del lado del servidor, en
// fn_toggle_modo_incognito() (verifica auth.uid() contra este mismo id,
// con excepción si no coincide) — ver migración
// 20261018082719_modo_incognito_perfiles.sql.
const USER_ID_MODO_INCOGNITO = 'ccae0faf-3b4c-402b-902e-b0cd3c5dc1e8'
import StatusBadge from './StatusBadge'
import { useSection } from '../../lib/sectionTitles'

const normalize = normalizeText

// Apertura/cierre por hover en desktop (oct 2026) — Notificaciones y menú de
// usuario abren al pasar el mouse (delay chico, evita aperturas accidentales
// al pasar de largo) y cierran con un delay mayor que se cancela si el
// puntero vuelve a entrar a tiempo — al trigger O al panel, da igual: ambos
// viven en el mismo contenedor con estos handlers, así que moverse de uno a
// otro nunca cuenta como "salir". Nunca se usa en touch (`enabled=false`
// cuando no hay hover real, `matchMedia('(hover: hover) and (pointer: fine)')`
// en el llamador) — ahí se sigue abriendo por tap, como siempre.
function useHoverDropdown(isOpen, setIsOpen, enabled) {
  const openTimer = useRef(null)
  const closeTimer = useRef(null)

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const onPointerEnter = (e) => {
    if (!enabled || e.pointerType !== 'mouse') return
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    if (isOpen || openTimer.current) return
    openTimer.current = setTimeout(() => {
      openTimer.current = null
      setIsOpen(true)
    }, 80)
  }

  const onPointerLeave = (e) => {
    if (!enabled || e.pointerType !== 'mouse') return
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null }
    if (closeTimer.current) return
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      setIsOpen(false)
    }, 150)
  }

  return { onPointerEnter, onPointerLeave }
}

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const section = useSection(location.pathname)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  // Mobile (Tarea 4.2): el buscador inline de desktop pasa a un ícono que
  // abre una búsqueda a pantalla completa, para no competir por espacio con
  // título/avatar en 360px.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  const searchFeatureOn = isFeatureEnabled('feat-1-search-global-mejorado')
  const { countPendientes, countNovedadesNoLeidas } = useNotificaciones()
  const { clientes, reservas, unidades, pagos, realtimeConectado } = useData()
  const { perfil, rol, signOut, refetchPerfil } = useAuth()

  const nombreMostrado = perfil?.nombre || perfil?.usuario || 'Usuario'
  const hoyTopbar = useMemo(() => new Date().toISOString().split('T')[0], [])
  const rolLabel = rol === 'superadmin' ? 'Superadmin' : rol === 'admin' ? 'Admin' : ''

  // Hover solo en dispositivos con mouse real — en touch (incluso tablets
  // grandes) se mantiene el comportamiento de siempre por tap (oct 2026).
  const [supportsHover] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
  // Mismo breakpoint que ya usa BottomNav/Sidebar para mobile vs desktop
  // (md:hidden / hidden md:flex, 768px) — gatea el ícono de escanear QR, que
  // en desktop no debe ni montarse (oct 2026).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mql.matches)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  const notifTriggerRef = useRef(null)
  const profileTriggerRef = useRef(null)
  const notifHover = useHoverDropdown(showNotifications, setShowNotifications, supportsHover)
  const profileHover = useHoverDropdown(showProfileMenu, setShowProfileMenu, supportsHover)

  const handleLogout = async () => {
    setShowProfileMenu(false)
    await signOut()
    navigate('/login')
  }

  // B5: la RPC ya valida del lado del servidor que sea esta cuenta puntual
  // — `puedeVerModoIncognito` acá solo decide si se muestra el botón, no es
  // la seguridad real.
  const puedeVerModoIncognito = perfil?.user_id === USER_ID_MODO_INCOGNITO
  const [togglingIncognito, setTogglingIncognito] = useState(false)
  const handleToggleIncognito = async () => {
    if (togglingIncognito) return
    setTogglingIncognito(true)
    try {
      await supabase.rpc('fn_toggle_modo_incognito')
      await refetchPerfil?.()
    } catch (err) {
      // silencioso a propósito: si falla, el perfil no cambió y el ícono
      // de abajo simplemente no aparece — no bloquea el resto del menú.
    } finally {
      setTogglingIncognito(false)
    }
  }

  // Búsqueda global: client-side sobre los datos ya en DataProvider (sin
  // round-trip a Supabase). Debounce de 250ms y mínimo 2 caracteres antes de
  // filtrar — el dato ya está en memoria, esto solo evita renders de más en
  // cada tecla. Busca por nombre, apellido, teléfono, DNI (con o sin puntos)
  // y, en reservas, también por número de unidad ("19", "carpa 19", "c.19").
  const debouncedSearch = useDebounced(searchValue, 250)
  const term = useMemo(() => normalize(debouncedSearch).trim(), [debouncedSearch])
  const dniTerm = useMemo(() => parseDNI(debouncedSearch), [debouncedSearch])
  const unidadQuery = useMemo(() => parseUnidadQuery(debouncedSearch.trim()), [debouncedSearch])
  const activo = term.length >= 2 || (dniTerm.length >= 7) || !!unidadQuery

  const clienteMatches = useMemo(() => {
    if (!activo) return []
    return clientes
      .filter((c) => {
        if (term.length >= 2) {
          if (normalize(c.nombre).includes(term)) return true
          if (c.apellido && normalize(c.apellido).includes(term)) return true
          if (c.telefono && normalize(c.telefono).includes(term)) return true
        }
        if (dniTerm.length >= 7 && c.dni && c.dni.includes(dniTerm)) return true
        return false
      })
      .slice(0, 5)
  }, [clientes, term, dniTerm, activo])

  // Solo período/día: una reserva de temporada no vive en /app/reservas (esa
  // cola solo muestra período/día, ver CLAUDE.md "Reservas vs Clientes") —
  // antes aparecía igual acá, duplicada con su cliente en el grupo CLIENTES,
  // y al clickearla navegaba a una fila que no existe en esa pantalla.
  const reservaMatches = useMemo(() => {
    if (!activo) return []
    return reservas
      .filter((r) => {
        if (r.tipo_alquiler === 'temporada') return false
        const nombre = r.clientes?.nombre
        const telefono = r.clientes?.telefono
        if (term.length >= 2) {
          if (nombre && normalize(nombre).includes(term)) return true
          if (telefono && normalize(telefono).includes(term)) return true
        }
        if (unidadQuery && r.unidades?.numero === unidadQuery.numero) {
          if (!unidadQuery.tipo || r.unidades?.tipo === unidadQuery.tipo) return true
        }
        return false
      })
      .slice(0, 5)
  }, [reservas, term, unidadQuery, activo])

  // [feat-1] unidades por número ("18", "c.19", "sombrilla 14") — antes el
  // search global solo encontraba una unidad indirectamente, si tenía una
  // reserva activa que matcheara. Ahora la unidad aparece aunque esté
  // libre, y lleva al Plano.
  const unidadMatches = useMemo(() => {
    if (!searchFeatureOn || !unidadQuery) return []
    return (unidades || [])
      .filter((u) => u.numero === unidadQuery.numero && (!unidadQuery.tipo || u.tipo === unidadQuery.tipo))
      .slice(0, 5)
  }, [unidades, unidadQuery])

  // [feat-1] comprobantes — mismo normalizarNumeroComprobante() que ya usa
  // el buscador de Clientes (Tarea 3), acá a nivel global.
  const comprobanteMatches = useMemo(() => {
    const termNorm = normalizarNumeroComprobante(debouncedSearch)
    if (!searchFeatureOn || termNorm.length < 2) return []
    const out = []
    for (const p of pagos || []) {
      for (const c of p.comprobantes || []) {
        if (normalizarNumeroComprobante(c.numero).includes(termNorm)) {
          out.push({ pago: p, comprobante: c })
          if (out.length >= 5) return out
        }
      }
    }
    return out
  }, [pagos, debouncedSearch])

  const showDropdown = searchValue.trim().length > 0
  const closeSearch = () => setSearchValue('')
  const closeMobileSearch = () => { setMobileSearchOpen(false); closeSearch() }

  // [feat-1] navegación con flechas + Enter sobre la lista combinada de
  // resultados (clientes, unidades, reservas, comprobantes, en ese orden
  // — mismo orden en que se muestran). Ctrl/Cmd+K enfoca el buscador
  // desde cualquier pantalla.
  const resultadosFlat = useMemo(() => [
    ...clienteMatches.map((x) => ({ tipo: 'cliente', data: x })),
    ...unidadMatches.map((x) => ({ tipo: 'unidad', data: x })),
    ...reservaMatches.map((x) => ({ tipo: 'reserva', data: x })),
    ...comprobanteMatches.map((x) => ({ tipo: 'comprobante', data: x })),
  ], [clienteMatches, unidadMatches, reservaMatches, comprobanteMatches])
  const [activeIdx, setActiveIdx] = useState(-1)
  useEffect(() => { setActiveIdx(-1) }, [debouncedSearch])

  const irAResultado = (r) => {
    if (!r) return
    if (r.tipo === 'cliente') return goToCliente(r.data)
    if (r.tipo === 'reserva') return goToReserva(r.data)
    if (r.tipo === 'unidad') { navigate(linkToPlano(undefined, r.data.id)); closeSearch(); setMobileSearchOpen(false) }
    if (r.tipo === 'comprobante') {
      navigate(linkToCliente(r.data.pago.cliente_id, { pagoId: r.data.pago.id }))
      closeSearch(); setMobileSearchOpen(false)
    }
  }

  const handleSearchKeyDown = (e) => {
    if (!showDropdown || resultadosFlat.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(resultadosFlat.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); irAResultado(resultadosFlat[activeIdx]) }
  }

  // Overlay manager (Tarea 1, oct 2026): un solo mecanismo central —
  // abrir cualquiera de estos tres cierra los otros dos solo, sin cross-calls
  // copiados (antes `setShowNotifications`/`setShowProfileMenu` se pisaban
  // a mano entre sí). `bind` se adjunta al trigger y al panel de cada uno;
  // un click en cualquiera de los dos cuenta como "adentro".
  // No registrar/activar el overlay del buscador desktop mientras la
  // pantalla completa de búsqueda mobile está abierta — comparten
  // `searchValue`, así que tipear activa `showDropdown` para los dos a la
  // vez. El nodo del desktop (oculto por CSS en mobile, no desmontado)
  // igual queda en el DOM, y al no estar contenido dentro del territorio
  // del overlay mobile, el OverlayManager lo trataba como un overlay de
  // primer nivel nuevo y cerraba la búsqueda mobile apenas se escribía
  // una letra (bug real, oct 2026).
  const searchOverlay = useOverlay({ id: 'topbar-search', isOpen: showDropdown && !mobileSearchOpen, onRequestClose: closeSearch })
  const notifOverlay = useOverlay({ id: 'topbar-notif', isOpen: showNotifications, onRequestClose: () => setShowNotifications(false) })
  const profileOverlay = useOverlay({ id: 'topbar-profile', isOpen: showProfileMenu, onRequestClose: () => setShowProfileMenu(false) })
  // Pantalla completa, sin "afuera" — se registra solo para Escape y para
  // que abrirla cierre cualquier otro overlay que hubiera quedado abierto.
  const mobileSearchOverlay = useOverlay({ id: 'topbar-mobile-search', isOpen: mobileSearchOpen, onRequestClose: closeMobileSearch })

  // [feat-1] Ctrl/Cmd+K enfoca el buscador desde cualquier pantalla —
  // desktop enfoca el input inline, mobile abre la búsqueda a pantalla
  // completa (no hay dónde enfocar si no está montada).
  useEffect(() => {
    if (!searchFeatureOn) return
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (window.matchMedia('(max-width: 639px)').matches) setMobileSearchOpen(true)
        else searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFeatureOn])

  const goToCliente = (cliente) => {
    navigate(linkToCliente(cliente.id))
    closeSearch()
  }

  const goToReserva = (reserva) => {
    navigate(linkToReserva(reserva.id))
    closeSearch()
  }

  return (
    <header
      className="no-print relative min-h-16 md:h-20 flex items-center justify-between gap-3 px-4 md:px-gutter-lg bg-white border-b border-hairline sticky top-0 z-20 shrink-0 font-ui"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Izquierda: desktop/tablet (≥768px, mock 01-home-desktop) = ubicación +
          chip Operativo + buscador inline. Mobile (<768px, mock
          01-home-mobile) = "Prius App" + chip + nombre de la sección actual
          chico debajo (el título grande real de cada pantalla ahora vive al
          principio del contenido, ver AppLayout.jsx). */}
      <div className="flex items-center gap-space-lg min-w-0 flex-1 md:flex-initial">
        <div className="hidden md:flex items-center gap-space-sm shrink-0">
          <span className="text-headline-sm text-black">Playa Grande</span>
          <span className="text-body-sm text-prius-slate">•</span>
          <span className="text-body-sm text-prius-slate">Mar del Plata</span>
          {realtimeConectado && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-prius-surface text-label-md text-prius-success">
              <span className="w-1.5 h-1.5 rounded-full bg-prius-success animate-pulse" />
              OPERATIVO
            </span>
          )}
        </div>

        <div className="md:hidden min-w-0">
          {/* Logo (B4, oct 2026): mismo /images/prius-icon.png del Sidebar
              desktop, a 28px. "Prius App" no puede truncar (oct 2026): con
              el ícono de QR de Recepción sumado a la derecha, el chip
              "Operativo" con texto ya no entraba a 390px y el título se
              cortaba a "Prius …" — achicado a solo el punto (mismo
              significado, sin texto) en vez de arriesgar el mismo corte de
              nuevo en una pantalla más angosta (360px incluido). */}
          <div className="flex items-center gap-1.5 min-w-0">
            <img src="/images/prius-icon.png" alt="Prius" className="w-7 h-7 object-contain shrink-0" />
            <span className="text-title-md text-black truncate">Prius App</span>
            {realtimeConectado && (
              <span className="w-1.5 h-1.5 rounded-full bg-prius-success shrink-0" title="Operativo" />
            )}
          </div>
          <p className="text-label-md text-prius-slate truncate">{section.shortName || section.name}</p>
        </div>

        {/* Búsqueda global inline (desktop/tablet) — mismo handler/datos de
            siempre, solo el shell visual cambia (w-80, fondo prius-surface,
            h-9, rounded-xl del mock). En mobile pasa a un ícono que abre
            pantalla completa (ver bloque más abajo). */}
        {/* Item 17 (testing oct 2026): `w-max lg:w-full` dejaba el buscador
            sin tope de ancho — en 1280-1440px (ej. 1397x834) se comía todo
            el espacio disponible del header y tapaba la fecha de la
            derecha (quedaba "…de 2026" cortada). Ancho fijo que crece por
            breakpoint, nunca `w-full` sin techo. */}
        <div ref={searchOverlay.bind} className="hidden md:block relative w-48 lg:w-64 xl:w-80 min-w-0 shrink">
        <SearchInput
          ref={searchInputRef}
          value={searchValue}
          onChange={setSearchValue}
          onKeyDown={handleSearchKeyDown}
          placeholder="Búsqueda inteligente"
          className="rounded-xl transition-shadow duration-200 shadow-[0_0_12px_1px_rgba(242,202,80,0.15)] hover:shadow-[0_0_18px_3px_rgba(242,202,80,0.28)] focus-within:shadow-[0_0_20px_4px_rgba(242,202,80,0.32)]"
          inputClassName="bg-prius-surface border-hairline rounded-xl h-9 min-h-0 py-0 text-body-sm"
        />

        {showDropdown && (
            <div className="absolute left-0 right-0 mt-2 popover-light rounded-xl overflow-hidden z-50 max-h-96 overflow-y-auto ui-open">
              {!activo ? (
                <p className="px-4 py-6 text-center text-xs text-prius-muted">Seguí escribiendo (mínimo 2 caracteres)...</p>
              ) : resultadosFlat.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-prius-muted">Sin resultados para "{searchValue}"</p>
              ) : (
                <>
                  {clienteMatches.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Clientes</p>
                      {clienteMatches.map((cliente) => (
                        <button
                          key={cliente.id}
                          onClick={() => goToCliente(cliente)}
                          className="w-full text-left px-4 py-2.5 hover:bg-prius-subtle transition-colors"
                        >
                          <p className="text-xs font-bold text-black truncate">{cliente.nombre}</p>
                          {cliente.telefono && <p className="text-[11px] text-prius-muted">{cliente.telefono}</p>}
                        </button>
                      ))}
                    </div>
                  )}

                  {unidadMatches.length > 0 && (
                    <div className="border-t border-hairline">
                      <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Unidades</p>
                      {unidadMatches.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => irAResultado({ tipo: 'unidad', data: u })}
                          className="w-full text-left px-4 py-2.5 hover:bg-prius-subtle transition-colors uppercase text-xs font-bold text-black"
                        >
                          {unidadEmoji(u.tipo)} {u.tipo} #{u.numero}
                        </button>
                      ))}
                    </div>
                  )}

                  {reservaMatches.length > 0 && (
                    <div className="border-t border-hairline">
                      <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Reservas</p>
                      {reservaMatches.map((reserva) => (
                        <button
                          key={reserva.id}
                          onClick={() => goToReserva(reserva)}
                          className="w-full text-left px-4 py-2.5 hover:bg-prius-subtle transition-colors flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-black truncate">{reserva.clientes?.nombre || 'S/N'}</span>
                            <span className="block text-[11px] text-prius-muted uppercase truncate">
                              {unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}
                            </span>
                          </span>
                          <StatusBadge status={estadoBadgeStatus(reserva)} />
                        </button>
                      ))}
                    </div>
                  )}

                  {comprobanteMatches.length > 0 && (
                    <div className="border-t border-hairline">
                      <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Comprobantes</p>
                      {comprobanteMatches.map(({ pago, comprobante }) => (
                        <button
                          key={comprobante.id}
                          onClick={() => irAResultado({ tipo: 'comprobante', data: { pago, comprobante } })}
                          className="w-full text-left px-4 py-2.5 hover:bg-prius-subtle transition-colors text-xs font-bold text-black"
                        >
                          {formatComprobante(comprobante.tipo, comprobante.numero)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
        )}
        </div>
      </div>

      {/* Derecha: fecha (solo ≥1024px), campana, avatar — igual en todas
          las pantallas, mock 01-home-desktop. */}
      <div className="flex items-center gap-2 md:gap-space-md shrink-0">
        <div className="hidden lg:flex items-center gap-1.5 text-body-sm text-prius-slate">
          <Calendar size={16} />
          {formatFechaLarga(hoyTopbar)}
        </div>
        {/* Fase 3 (Recepción, D1): acceso directo al escáner de QR — solo
            mobile (oct 2026), mismo breakpoint que BottomNav/Sidebar. No se
            monta en desktop (no solo oculto por CSS): sin uso en escritorio
            y evita dejar en el DOM un botón que dispara cámara. */}
        {isFeatureEnabled('recepcion') && isMobile && (
          <button
            onClick={() => navigate(linkToRecepcion(null, { scan: true }))}
            className="text-prius-slate hover:text-black p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-prius-subtle transition-all"
            title="Recepción — escanear QR"
          >
            <QrCode size={20} />
          </button>
        )}
        {/* Búsqueda (mobile): ícono que abre pantalla completa */}
        <button
          onClick={() => setMobileSearchOpen(true)}
          className="md:hidden text-prius-slate hover:text-black p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-prius-subtle transition-all"
        >
          <Search size={20} />
        </button>
        {/* Notificaciones (oct 2026, modelo "bandeja de pendientes") — punto
            dorado si hay pendientes abiertas, número neutro si solo hay
            novedades sin leer (ver CLAUDE.md "Notificaciones"). Desktop:
            popover anclado acá mismo. Mobile: hoja a pantalla completa
            (mismo patrón que la búsqueda mobile, más abajo). */}
        <div
          ref={notifOverlay.bind}
          className="relative"
          onPointerEnter={notifHover.onPointerEnter}
          onPointerLeave={notifHover.onPointerLeave}
          onFocus={() => setShowNotifications(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowNotifications(false) }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            setShowNotifications(false)
            notifTriggerRef.current?.focus()
          }}
        >
          <button
            ref={notifTriggerRef}
            onClick={() => { if (!supportsHover) setShowNotifications((v) => !v) }}
            aria-haspopup="menu"
            aria-expanded={showNotifications}
            className="relative w-9 h-9 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center rounded-xl text-prius-slate hover:text-black md:bg-prius-surface md:border md:border-hairline transition-colors"
          >
            <Bell size={18} />
            {countPendientes > 0 ? (
              <span className="absolute top-1 right-1 w-2 h-2 bg-gold rounded-full border-2 border-white" />
            ) : countNovedadesNoLeidas > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-prius-subtle text-black text-[10px] font-bold flex items-center justify-center">
                {countNovedadesNoLeidas > 9 ? '9+' : countNovedadesNoLeidas}
              </span>
            ) : null}
          </button>

          {showNotifications && (
            // `top-full pt-3` en vez de `mt-3` en el panel (oct 2026): el
            // padding queda DENTRO del contenedor con los handlers de hover,
            // así el hueco visual entre el ícono y el panel sigue siendo
            // parte del "territorio" hovereable (sin esto, mover el mouse en
            // línea recta del ícono al panel pasaba por una franja que no
            // era descendiente de este contenedor y cerraba el panel antes
            // de llegar). El popover-light real queda en el div de adentro,
            // que no se mueve ni cambia de tamaño — mismo look de siempre.
            <div className="hidden md:block absolute right-0 top-full pt-3 w-[380px] max-w-[90vw] z-50">
              <div className="max-h-[min(70vh,480px)] popover-light rounded-xl overflow-hidden ui-open flex flex-col">
                <NotificacionesBandeja onNavigate={() => setShowNotifications(false)} />
              </div>
            </div>
          )}
        </div>

        {showNotifications && createPortal(
          <div ref={notifOverlay.bind} className="md:hidden fixed inset-0 z-[997] bg-white flex flex-col ui-open">
            <div className="flex items-center justify-between px-4 h-16 border-b border-hairline shrink-0">
              <h1 className="text-sm font-bold uppercase tracking-widest text-black">Notificaciones</h1>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-prius-slate hover:text-black"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NotificacionesBandeja onNavigate={() => setShowNotifications(false)} />
            </div>
          </div>,
          document.body,
        )}

        {/* Profile */}
        <div
          ref={profileOverlay.bind}
          className="relative"
          onPointerEnter={profileHover.onPointerEnter}
          onPointerLeave={profileHover.onPointerLeave}
          onFocus={() => setShowProfileMenu(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowProfileMenu(false) }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            setShowProfileMenu(false)
            profileTriggerRef.current?.focus()
          }}
        >
          <button
            ref={profileTriggerRef}
            onClick={() => { if (!supportsHover) setShowProfileMenu((v) => !v) }}
            aria-haspopup="menu"
            aria-expanded={showProfileMenu}
            className="flex items-center gap-1.5 p-1 min-h-[44px] hover:bg-prius-subtle rounded-full transition-colors"
          >
            {/* B5: indicador discreto mientras el modo incógnito está
                activo — para que no quede prendido sin querer. */}
            {puedeVerModoIncognito && perfil?.modo_incognito && (
              <EyeOff size={14} className="text-prius-slate shrink-0" title="Modo incógnito activo" />
            )}
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-semibold text-sm shrink-0">
              {nombreMostrado.charAt(0).toUpperCase()}
            </div>
            <ChevronDown size={14} className="hidden md:block text-prius-muted" />
          </button>

          {showProfileMenu && (
            // Mismo patrón que Notificaciones: padding-top en vez de margin,
            // para que el hueco visual quede adentro del territorio
            // hovereable (ver comentario arriba).
            <div className="absolute right-0 top-full pt-3 w-56 z-50">
              <div className="popover-light rounded-xl overflow-hidden p-1 ui-open">
                <div className="px-4 py-3 border-b border-hairline">
                  <p className="text-[11px] font-bold text-prius-muted uppercase tracking-wider">{rolLabel}</p>
                  <p className="text-xs font-medium text-black truncate">{nombreMostrado}</p>
                </div>
                <button
                  onClick={() => { navigate('/app/perfil'); setShowProfileMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs text-prius-slate hover:bg-prius-subtle flex items-center gap-2 rounded-lg"
                >
                  <User size={14} /> Perfil
                </button>
                {puedeVerModoIncognito && (
                  <button
                    onClick={handleToggleIncognito}
                    disabled={togglingIncognito}
                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-prius-subtle flex items-center gap-2 rounded-lg disabled:opacity-50 ${perfil?.modo_incognito ? 'text-black font-semibold' : 'text-prius-slate'}`}
                  >
                    <EyeOff size={14} /> Modo incógnito {perfil?.modo_incognito ? '· Activo' : ''}
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-xs text-prius-error hover:bg-red-400/10 flex items-center gap-2 rounded-lg"
                >
                  <LogOut size={14} /> Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Búsqueda mobile a pantalla completa (Tarea 4.2) — mismos resultados
          que el buscador de desktop, reutiliza clienteMatches/reservaMatches. */}
      {mobileSearchOpen && createPortal(
        <div ref={mobileSearchOverlay.bind} className="md:hidden fixed inset-0 z-[997] bg-white flex flex-col ui-open">
          <div className="flex items-center gap-3 px-4 h-16 border-b border-hairline shrink-0">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Búsqueda inteligente"
              autoFocus
              className="flex-1 min-w-0 rounded-xl transition-shadow duration-200 shadow-[0_0_12px_1px_rgba(242,202,80,0.15)] focus-within:shadow-[0_0_20px_4px_rgba(242,202,80,0.32)]"
            />
            <button
              onClick={closeMobileSearch}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-prius-slate hover:text-black shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!showDropdown ? (
              <p className="px-6 py-8 text-center text-xs text-prius-muted">Escribí para buscar un cliente, una reserva o una unidad (ej. "carpa 19").</p>
            ) : !activo ? (
              <p className="px-6 py-8 text-center text-xs text-prius-muted">Seguí escribiendo (mínimo 2 caracteres)...</p>
            ) : resultadosFlat.length === 0 ? (
              <p className="px-6 py-8 text-center text-xs text-prius-muted">Sin resultados para "{searchValue}"</p>
            ) : (
              <>
                {clienteMatches.length > 0 && (
                  <div>
                    <p className="px-4 pt-4 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Clientes</p>
                    {clienteMatches.map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => { goToCliente(cliente); setMobileSearchOpen(false) }}
                        className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-prius-subtle transition-colors border-b border-hairline"
                      >
                        <p className="text-sm font-bold text-black truncate">{cliente.nombre}</p>
                        {cliente.telefono && <p className="text-xs text-prius-muted">{cliente.telefono}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {unidadMatches.length > 0 && (
                  <div>
                    <p className="px-4 pt-4 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Unidades</p>
                    {unidadMatches.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { irAResultado({ tipo: 'unidad', data: u }); setMobileSearchOpen(false) }}
                        className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-prius-subtle transition-colors border-b border-hairline uppercase text-sm font-bold text-black"
                      >
                        {unidadEmoji(u.tipo)} {u.tipo} #{u.numero}
                      </button>
                    ))}
                  </div>
                )}
                {reservaMatches.length > 0 && (
                  <div>
                    <p className="px-4 pt-4 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Reservas</p>
                    {reservaMatches.map((reserva) => (
                      <button
                        key={reserva.id}
                        onClick={() => { goToReserva(reserva); setMobileSearchOpen(false) }}
                        className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-prius-subtle transition-colors border-b border-hairline flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-black truncate">{reserva.clientes?.nombre || 'S/N'}</span>
                          <span className="block text-xs text-prius-muted uppercase truncate">
                            {unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}
                          </span>
                        </span>
                        <StatusBadge status={estadoBadgeStatus(reserva)} />
                      </button>
                    ))}
                  </div>
                )}
                {comprobanteMatches.length > 0 && (
                  <div>
                    <p className="px-4 pt-4 pb-1 text-[11px] font-bold text-prius-muted uppercase tracking-wider">Comprobantes</p>
                    {comprobanteMatches.map(({ pago, comprobante }) => (
                      <button
                        key={comprobante.id}
                        onClick={() => { irAResultado({ tipo: 'comprobante', data: { pago, comprobante } }); setMobileSearchOpen(false) }}
                        className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-prius-subtle transition-colors border-b border-hairline text-sm font-bold text-black"
                      >
                        {formatComprobante(comprobante.tipo, comprobante.numero)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </header>
  )
}
