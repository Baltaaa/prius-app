import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  SunMoon, Umbrella, ShieldCheck, DollarSign, Info, Receipt, BellRing,
  UserCircle, KeyRound, LogOut, Clock, Mail, BadgeCheck, CalendarRange,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth, usePermiso } from '../../context/AuthProvider'
import { useData } from '../../context/DataProvider'
import { useTipoCambio } from '../../hooks/useTipoCambio'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useTituloPagina } from '../../components/brand/tituloPagina'
import SelectorTema from '../../components/brand/SelectorTema'
import CategoriasGastoConfig from '../../components/crm/CategoriasGastoConfig'
import NotificacionesConfig from '../../components/crm/NotificacionesConfig'
import { FilaAjuste, GrupoAjustes } from '../../components/crm/AjustesLista'
import ScrollFade from '../../components/ui/ScrollFade'
import { formatFecha, formatMonto, formatNombre } from '../../lib/format'
import { unidadEmoji } from '../../lib/unidadIcono'
import { APP_VERSION, VERSION_PAQUETE } from '../../lib/appVersion'
import { INACTIVITY_TIMEOUT_MS } from '../../config/session'

// Configuración (rediseño nov 2026).
//
// Mobile: ajustes de app nativa — tarjeta de perfil arriba, grupos con título
// chico en mayúscula y listas en tarjetas redondeadas; cada fila abre su
// subpantalla, con el título y el botón "atrás" en la barra única (Tarea 1,
// ver tituloPagina.js). La subpantalla abierta vive en la URL (`?s=<clave>`),
// así "atrás" del navegador y el del topbar hacen lo mismo.
//
// Desktop: subnavegación lateral sticky a la izquierda y las tarjetas de la
// sección a la derecha, en grilla, aprovechando el ancho.
//
// Solo hay opciones conectadas a datos o funciones que ya existen: no hay
// gestión de usuarios en la app, así que "Usuarios y roles" no está. Lo que
// ya vivía acá (categorías de egreso y avisos de cierre de caja) quedó en sus
// propias secciones. Esto es distinto de "Mi cuenta" (/app/perfil), que son
// las preferencias y las tarifas de la propia cuenta.

const MINUTOS_INACTIVIDAD = Math.round(INACTIVITY_TIMEOUT_MS / 60000)

/** Tarjeta de sección del contenido (mismo marco en mobile y desktop). */
function Tarjeta({ titulo, bajada, children }) {
  return (
    <section className="card-surface card-pad space-y-4">
      {(titulo || bajada) && (
        <header className="min-w-0">
          {titulo && <h3 className="text-body font-semibold text-ink">{titulo}</h3>}
          {bajada && <p className="text-label text-ink-2 mt-1">{bajada}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

function PerfilYCuenta({ perfil, email, rolLabel, onCambiarPassword, onCerrarSesion }) {
  return (
    <>
      <Tarjeta titulo="Datos de la cuenta" bajada="Los datos con los que figurás en el Historial y en los comprobantes que emitís.">
        <div className="divide-y divide-divider -mx-card">
          <FilaAjuste icono={UserCircle} label="Nombre" valor={formatNombre(perfil?.nombre) || '—'} />
          <FilaAjuste icono={Mail} label="Email" valor={email || '—'} />
          <FilaAjuste icono={BadgeCheck} label="Rol" valor={rolLabel || '—'} />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Acceso" bajada="La contraseña se cambia con el flujo de siempre; al cerrar sesión vuelve el login.">
        <div className="divide-y divide-divider -mx-card">
          <FilaAjuste icono={KeyRound} label="Cambiar contraseña" onClick={onCambiarPassword} />
          <FilaAjuste icono={LogOut} label="Cerrar sesión" tono="peligro" onClick={onCerrarSesion} />
        </div>
      </Tarjeta>
    </>
  )
}

function Balneario({ temporadaActiva, unidades }) {
  const porTipo = useMemo(() => {
    const cuenta = {}
    for (const u of unidades || []) cuenta[u.tipo] = (cuenta[u.tipo] || 0) + 1
    return cuenta
  }, [unidades])
  const tipos = Object.keys(porTipo).sort()
  return (
    <>
      <Tarjeta titulo="Balneario" bajada="Datos leídos de la base. Solo lectura: no se editan desde acá.">
        <div className="divide-y divide-divider -mx-card">
          <FilaAjuste icono={Umbrella} label="Nombre" valor="Prius Playa Grande" />
          <FilaAjuste
            icono={CalendarRange}
            label="Temporada activa"
            valor={temporadaActiva?.nombre || 'Sin temporada activa'}
            descripcion={temporadaActiva ? `${formatFecha(temporadaActiva.fecha_inicio)} al ${formatFecha(temporadaActiva.fecha_fin)}` : undefined}
          />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Unidades" bajada="Total cargado en la base, por tipo.">
        <div className="divide-y divide-divider -mx-card">
          {tipos.length === 0 ? (
            <FilaAjuste label="Sin unidades cargadas" />
          ) : tipos.map((tipo) => (
            <FilaAjuste
              key={tipo}
              label={`${unidadEmoji(tipo)} ${tipo.charAt(0).toUpperCase()}${tipo.slice(1)}s`.trim()}
              valor={String(porTipo[tipo])}
            />
          ))}
          <FilaAjuste label="Total" valor={String((unidades || []).length)} />
        </div>
      </Tarjeta>
    </>
  )
}

function Seguridad({ onCerrarSesion }) {
  return (
    <Tarjeta
      titulo="Cierre por inactividad"
      bajada={`La sesión se cierra sola después de ${MINUTOS_INACTIVIDAD} minutos sin actividad, con un aviso previo para seguir trabajando. Vale también si cerrás la pestaña y volvés más tarde.`}
    >
      <div className="divide-y divide-divider -mx-card">
        <FilaAjuste icono={Clock} label="Tiempo de inactividad" valor={`${MINUTOS_INACTIVIDAD} min`} />
        <FilaAjuste icono={LogOut} label="Cerrar sesión ahora" tono="peligro" onClick={onCerrarSesion} />
      </div>
    </Tarjeta>
  )
}

function Moneda({ tc }) {
  return (
    <Tarjeta
      titulo="Moneda"
      bajada="El peso es la moneda de la caja y los reportes. La cotización solo sirve para convertir los pagos en dólares; la fuente se elige en Mi cuenta."
    >
      <div className="divide-y divide-divider -mx-card">
        <FilaAjuste icono={DollarSign} label="Moneda principal" valor="Pesos argentinos (ARS)" />
        <FilaAjuste
          icono={DollarSign}
          label="Cotización del día"
          valor={tc.valor ? formatMonto(tc.valor) : '—'}
          descripcion={tc.fecha ? `${tc.tipo === 'blue' ? 'Blue' : 'Oficial'} · ${tc.lado === 'compra' ? 'Compra' : 'Venta'} · ${formatFecha(tc.fecha)}${tc.stale ? ' (no es de hoy)' : ''}` : 'Sin cotización disponible'}
        />
      </div>
    </Tarjeta>
  )
}

function AcercaDe() {
  return (
    <Tarjeta titulo="Acerca de" bajada="Qué versión está corriendo en este dispositivo y a quién pedirle soporte.">
      <div className="divide-y divide-divider -mx-card">
        <FilaAjuste icono={Info} label="Versión" valor={VERSION_PAQUETE} descripcion={APP_VERSION} />
        <FilaAjuste icono={ShieldCheck} label="Soporte" valor="Whats Lead Studio" descripcion="Desarrollo y mantenimiento de Prius App" />
      </div>
    </Tarjeta>
  )
}

export default function Configuracion() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const esMobile = !useMediaQuery('(min-width: 768px)')
  const { perfil, rol, signOut } = useAuth()
  const { temporadaActiva, unidades } = useData()
  const tc = useTipoCambio()
  const esSuperadmin = usePermiso('categorias_gasto')

  // El email es el de auth (la tabla `perfiles` no lo guarda) — misma
  // lectura que hace "Mi cuenta".
  const [email, setEmail] = useState('')
  useEffect(() => {
    let vivo = true
    supabase.auth.getUser().then(({ data: { user } }) => { if (vivo) setEmail(user?.email || '') })
    return () => { vivo = false }
  }, [])
  const rolLabel = rol === 'superadmin' ? 'Superadmin' : rol === 'admin' ? 'Admin' : rol || ''
  const nombreMostrado = formatNombre(perfil?.nombre) || perfil?.usuario || 'Usuario'
  const inicial = (nombreMostrado[0] || 'P').toUpperCase()

  const cerrarSesion = async () => {
    await signOut()
    navigate('/login')
  }

  const secciones = useMemo(() => [
    {
      clave: 'perfil',
      titulo: 'Perfil y cuenta',
      resumen: nombreMostrado,
      icono: UserCircle,
      grupo: 'Tu cuenta',
      contenido: (
        <PerfilYCuenta
          perfil={perfil}
          email={email}
          rolLabel={rolLabel}
          onCambiarPassword={() => navigate('/cambiar-contrasena')}
          onCerrarSesion={cerrarSesion}
        />
      ),
    },
    {
      clave: 'apariencia',
      titulo: 'Apariencia',
      resumen: 'Claro, oscuro o sistema',
      icono: SunMoon,
      grupo: 'Tu cuenta',
      contenido: (
        <Tarjeta titulo="Tema" bajada="Claro, oscuro o el mismo tema que tu dispositivo. Se guarda para tu usuario.">
          <SelectorTema />
        </Tarjeta>
      ),
    },
    {
      clave: 'seguridad',
      titulo: 'Seguridad',
      resumen: `Cierre a los ${MINUTOS_INACTIVIDAD} min`,
      icono: ShieldCheck,
      grupo: 'Tu cuenta',
      contenido: <Seguridad onCerrarSesion={cerrarSesion} />,
    },
    {
      clave: 'balneario',
      titulo: 'Balneario',
      resumen: temporadaActiva?.nombre || 'Sin temporada activa',
      icono: Umbrella,
      grupo: 'El balneario',
      contenido: <Balneario temporadaActiva={temporadaActiva} unidades={unidades} />,
    },
    {
      clave: 'moneda',
      titulo: 'Moneda',
      resumen: tc.valor ? formatMonto(tc.valor) : 'ARS',
      icono: DollarSign,
      grupo: 'El balneario',
      contenido: <Moneda tc={tc} />,
    },
    ...(esSuperadmin ? [
      {
        clave: 'egresos',
        titulo: 'Categorías de egreso',
        resumen: 'Administrar categorías',
        icono: Receipt,
        grupo: 'Sistema',
        contenido: <CategoriasGastoConfig />,
      },
      {
        clave: 'avisos',
        titulo: 'Avisos de cierre de caja',
        resumen: 'WhatsApp y notificaciones',
        icono: BellRing,
        grupo: 'Sistema',
        contenido: <NotificacionesConfig />,
      },
    ] : []),
    {
      clave: 'acerca',
      titulo: 'Acerca de',
      resumen: VERSION_PAQUETE,
      icono: Info,
      grupo: 'Sistema',
      contenido: <AcercaDe />,
    },
    // `cerrarSesion` y `navigate` son estables dentro de un render; el resto
    // son los datos que efectivamente cambian lo que se muestra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [perfil, email, rolLabel, nombreMostrado, temporadaActiva, unidades, tc, esSuperadmin])

  const claveUrl = params.get('s')
  // Mobile: sin `?s` se ve la lista. Desktop: siempre hay una sección abierta.
  const seccionActiva = secciones.find((s) => s.clave === claveUrl) || (esMobile ? null : secciones[0])
  // El título de la barra única pasa a ser el de la subpantalla; con él, el
  // botón circular de la izquierda pasa a "atrás" (ver Topbar.jsx).
  useTituloPagina(esMobile && seccionActiva ? seccionActiva.titulo : null)

  const abrir = (clave) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    next.set('s', clave)
    return next
  })

  const grupos = useMemo(() => {
    const orden = []
    for (const s of secciones) {
      let g = orden.find((x) => x.nombre === s.grupo)
      if (!g) { g = { nombre: s.grupo, items: [] }; orden.push(g) }
      g.items.push(s)
    }
    return orden
  }, [secciones])

  // ------------------------------------------------------------- mobile
  if (esMobile) {
    if (seccionActiva) {
      return <div className="space-y-grid anim-fade-up-page pb-bottom-nav-safe">{seccionActiva.contenido}</div>
    }
    return (
      <div className="space-y-section anim-fade-up-page pb-bottom-nav-safe">
        {/* Tarjeta de perfil */}
        <section className="card-surface card-pad flex items-center gap-3">
          <span className="shrink-0 w-14 h-14 rounded-card bg-gold text-on-gold flex items-center justify-center text-stat">
            {inicial}
          </span>
          <div className="min-w-0">
            <p className="text-card-title text-ink truncate">{nombreMostrado}</p>
            <p className="text-label text-ink-2 truncate">{rolLabel}</p>
            <p className="text-label text-ink-2 truncate">{email || '—'}</p>
          </div>
        </section>

        {grupos.map((g) => (
          <GrupoAjustes key={g.nombre} titulo={g.nombre}>
            {g.items.map((s) => (
              <FilaAjuste
                key={s.clave}
                icono={s.icono}
                label={s.titulo}
                valor={s.resumen}
                onClick={() => abrir(s.clave)}
              />
            ))}
          </GrupoAjustes>
        ))}
      </div>
    )
  }

  // ------------------------------------------------------------ desktop
  return (
    <div className="anim-fade-up-page flex gap-grid items-start">
      {/* Subnavegación lateral sticky. `top-3` = zona + 16px (ver CLAUDE.md). */}
      <nav aria-label="Secciones de configuración" className="sticky top-3 w-60 shrink-0 card-surface p-2 flex flex-col max-h-[calc(100dvh-var(--zona-h)-32px)]">
        <ScrollFade wrapperClassName="flex-1 min-h-0" className="overflow-y-auto scroll-fino">
          {grupos.map((g) => (
            <div key={g.nombre} className="mb-2 last:mb-0">
              <p className="section-label-grupo px-3 pt-2">{g.nombre}</p>
              {g.items.map((s) => {
                const activa = seccionActiva?.clave === s.clave
                return (
                  <button
                    key={s.clave}
                    type="button"
                    aria-current={activa ? 'page' : undefined}
                    onClick={() => abrir(s.clave)}
                    className={`w-full min-h-11 px-3 rounded-nav flex items-center gap-3 text-body transition-colors ${
                      activa ? 'bg-ink text-on-ink' : 'text-ink-2 hover:bg-row-hover hover:text-ink'
                    }`}
                  >
                    <s.icono size={16} strokeWidth={1.5} className="shrink-0" />
                    <span className="truncate text-left">{s.titulo}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </ScrollFade>
      </nav>

      {/* Contenido: tarjetas en grilla, aprovechando el ancho. */}
      <div className="flex-1 min-w-0 grid grid-cols-1 2xl:grid-cols-2 gap-grid items-start [&>*]:min-w-0">
        {seccionActiva?.contenido}
      </div>
    </div>
  )
}
