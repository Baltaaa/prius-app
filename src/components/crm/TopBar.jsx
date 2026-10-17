import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNotificaciones } from '../../context/NotificacionesProvider'
import NotificacionesBandeja from './NotificacionesBandeja'
import { useData } from '../../context/DataProvider'
import { useAuth } from '../../context/AuthProvider'
import { useDebounced } from '../../hooks/useDebounced'
import { unidadEmoji, normalizeText, formatComprobante } from '../../lib/format'
import { parseDNI, parseUnidadQuery, normalizarNumeroComprobante } from '../../lib/parse'
import { estadoBadgeStatus } from '../../lib/reservas'
import { linkToCliente, linkToReserva, linkToPlano, linkToRecepcion } from '../../lib/deepLinks'
import { useOverlay } from '../../context/OverlayProvider'
import { isFeatureEnabled } from '../../lib/features'
import SearchInput from '../inputs/SearchInput'
import {
  Search, Bell, User, LogOut, ChevronDown, X, Wallet,
  LayoutDashboard, Map, CalendarClock, Users, BarChart2, Inbox,
  Activity, FileText, UserCheck, DoorClosed, QrCode,
} from 'lucide-react'
import StatusBadge from './StatusBadge'

// Título + subtítulo + ícono de cada sección, unificados acá (antes vivían
// duplicados: sidebar, este label chico, y de nuevo como bloque grande en
// cada página). Sincronizado con las rutas del Sidebar (mismo listado que
// mainNav + additionalNav en Sidebar.jsx). Los subtítulos son el texto que
// antes estaba debajo del <h1> grande de cada página.
// `shortName` (Fase 1 mobile, oct 2026): versión corta del título para <768px
// — en 360px los 3-4 botones de la derecha (QR, búsqueda, notificaciones,
// perfil) le dejan al bloque del título muy poco ancho real, y el `name`
// completo terminaba truncado a 2-3 letras ("Directo…", "Notifica…"). Debajo
// de md se usa `shortName` (o `name` si no hace falta acortarlo); en desktop
// siempre el `name` completo, sin cambios.
const SECTION_TITLES = [
  {
    path: '/app/home', name: 'Dashboard', shortName: 'Inicio', subtitle: 'Resumen de métricas y actividades principales en tiempo real.',
    icon: LayoutDashboard, iconBg: 'bg-gold/10', iconBorder: 'border-gold/20', iconColor: 'text-gold',
  },
  {
    path: '/app/plano', name: 'Plano de Playa', shortName: 'Plano', subtitle: 'Gestión de Unidades Prius Playa Grande',
    icon: Map, iconBg: 'bg-sky-400/10', iconBorder: 'border-sky-400/20', iconColor: 'text-sky-400',
  },
  {
    path: '/app/cabinas-lockers', name: 'Cabinas y Lockers', shortName: 'Cabinas', subtitle: 'Sección en desarrollo — solo lectura.',
    icon: DoorClosed, iconBg: 'bg-prius-subtle', iconBorder: 'border-hairline', iconColor: 'text-prius-slate',
  },
  {
    path: '/app/reservas', name: 'Cola de Reservas', shortName: 'Reservas', subtitle: 'Alquileres por período y día, ordenados por llegada.',
    icon: CalendarClock, iconBg: 'bg-gold/10', iconBorder: 'border-gold/20', iconColor: 'text-gold',
  },
  {
    path: '/app/clientes', name: 'Directorio de Clientes', shortName: 'Clientes', subtitle: 'Historial completo: temporadas y alquileres pasados.',
    icon: Users, iconBg: 'bg-cyan-400/10', iconBorder: 'border-cyan-400/20', iconColor: 'text-cyan-400',
  },
  {
    path: '/app/caja', name: 'Caja Diaria', shortName: 'Caja', subtitle: 'Arqueo, historial y cruce automático con pagos.',
    icon: Wallet, iconBg: 'bg-green-400/10', iconBorder: 'border-green-400/20', iconColor: 'text-prius-success',
  },
  {
    path: '/app/reportes', name: 'Reportes', subtitle: 'Métricas avanzadas de facturación y ocupación.',
    icon: BarChart2, iconBg: 'bg-purple-400/10', iconBorder: 'border-purple-400/20', iconColor: 'text-purple-400',
  },
  {
    path: '/app/leads', name: 'Leads', subtitle: 'Consultas del formulario de la web, en tiempo real.',
    icon: Inbox, iconBg: 'bg-orange-400/10', iconBorder: 'border-orange-400/20', iconColor: 'text-orange-400',
  },
  {
    path: '/app/historial', name: 'Historial', subtitle: 'Toda acción sobre reservas, pagos, clientes y unidades.',
    icon: Activity, iconBg: 'bg-teal-400/10', iconBorder: 'border-teal-400/20', iconColor: 'text-teal-400',
  },
  {
    path: '/app/notificaciones', name: 'Notificaciones', shortName: 'Avisos', subtitle: 'Alertas de sistema, saldos y operaciones diarias.',
    icon: Bell, iconBg: 'bg-amber-400/10', iconBorder: 'border-amber-400/20', iconColor: 'text-amber-400',
  },
  {
    path: '/app/comprobantes', name: 'Comprobantes', subtitle: 'Generación de recibos oficiales para clientes.',
    icon: FileText, iconBg: 'bg-violet-400/10', iconBorder: 'border-violet-400/20', iconColor: 'text-violet-400',
  },
  {
    path: '/app/perfil', name: 'Perfil y Tarifas', shortName: 'Perfil', subtitle: 'Configuración de cuenta y valores de temporada.',
    icon: UserCheck, iconBg: 'bg-pink-400/10', iconBorder: 'border-pink-400/20', iconColor: 'text-pink-400',
  },
]

const DEFAULT_SECTION = { name: 'Balneario Playa Grande', shortName: 'Prius', subtitle: '', icon: LayoutDashboard, iconBg: 'bg-prius-subtle', iconBorder: 'border-hairline', iconColor: 'text-prius-slate' }

function useSection(pathname) {
  return SECTION_TITLES.find((s) => pathname.startsWith(s.path)) || DEFAULT_SECTION
}

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
  const SectionIcon = section.icon
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
  const { clientes, reservas, unidades, pagos } = useData()
  const { perfil, rol, signOut } = useAuth()

  const nombreMostrado = perfil?.nombre || perfil?.usuario || 'Usuario'
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
  const searchOverlay = useOverlay({ id: 'topbar-search', isOpen: showDropdown, onRequestClose: closeSearch })
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
    <header className="no-print relative h-20 flex items-center gap-3 px-4 sm:px-6 md:px-8 bg-white border-b border-hairline sticky top-0 z-20 shrink-0">
      {/* Ancho fijo: el título de sección cambia de largo (Dashboard vs
          Perfil y Tarifas) pero no puede correr la barra de búsqueda, que se
          centra contra el nav completo (ver div absoluto más abajo), no
          contra este espacio. Título + subtítulo + ícono de color: antes
          vivían repetidos como bloque grande en cada página, ahora viven acá
          una sola vez. */}
      <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-64 md:w-80">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl ${section.iconBg} border ${section.iconBorder} flex items-center justify-center shrink-0`}>
            <SectionIcon size={18} className={section.iconColor} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-display font-extrabold text-black tracking-tight truncate">
              <span className="md:hidden">{section.shortName || section.name}</span>
              <span className="hidden md:inline">{section.name}</span>
            </h1>
            {section.subtitle && (
              <p className="hidden sm:block text-[9px] text-prius-muted font-semibold uppercase tracking-wider truncate">{section.subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Búsqueda global (desktop): centrada respecto al nav completo
          (posición absoluta, independiente del ancho del título o del bloque
          de notificaciones/perfil) para que no se corra al cambiar de
          sección. En mobile pasa a un ícono que abre pantalla completa (ver
          bloque debajo del header) — no compite por espacio con título/avatar. */}
      <div ref={searchOverlay.bind} className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[calc(100%-2rem)] z-10">
        <SearchInput
          ref={searchInputRef}
          value={searchValue}
          onChange={setSearchValue}
          onKeyDown={handleSearchKeyDown}
          placeholder="Buscar cliente, reserva, unidad o comprobante..."
        />

        {showDropdown && (
            <div className="absolute left-0 right-0 mt-2 popover-light rounded-xl overflow-hidden z-50 max-h-96 overflow-y-auto">
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

      <div className="flex items-center gap-1 sm:gap-6 shrink-0 ml-auto">
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
          className="sm:hidden text-prius-slate hover:text-black p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-prius-subtle transition-all"
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
            className="text-prius-slate hover:text-black relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-prius-subtle transition-all"
          >
            <Bell size={20} />
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
            <div className="hidden sm:block absolute right-0 top-full pt-3 w-[380px] max-w-[90vw] z-50">
              <div className="max-h-[70vh] popover-light rounded-xl overflow-hidden">
                <NotificacionesBandeja onNavigate={() => setShowNotifications(false)} />
              </div>
            </div>
          )}
        </div>

        {showNotifications && createPortal(
          <div ref={notifOverlay.bind} className="sm:hidden fixed inset-0 z-[997] bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 h-20 border-b border-hairline shrink-0">
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
            className="flex items-center gap-3 p-1 min-h-[44px] hover:bg-prius-subtle rounded-lg transition-all"
          >
            <div className="w-8 h-8 bg-gold text-black rounded flex items-center justify-center font-bold text-sm">
              {nombreMostrado.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-black hidden sm:block">
              {nombreMostrado}
            </span>
            <ChevronDown size={14} className="text-prius-muted" />
          </button>

          {showProfileMenu && (
            // Mismo patrón que Notificaciones: padding-top en vez de margin,
            // para que el hueco visual quede adentro del territorio
            // hovereable (ver comentario arriba).
            <div className="absolute right-0 top-full pt-3 w-56 z-50">
              <div className="popover-light rounded-xl overflow-hidden p-1">
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
        <div ref={mobileSearchOverlay.bind} className="sm:hidden fixed inset-0 z-[997] bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 h-20 border-b border-hairline shrink-0">
            <SearchInput
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Buscar cliente, reserva, unidad o comprobante..."
              autoFocus
              className="flex-1 min-w-0"
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
