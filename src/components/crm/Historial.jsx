import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays, Wallet, Users, MapPin, Receipt, Ban, StickyNote, Activity, History, Lock, Inbox, UserPlus, LogIn, LogOut, ShieldOff, SlidersHorizontal,
} from 'lucide-react'
import { useHistorial } from '../../hooks/useHistorial'
import { formatFecha, formatFechaLarga, formatHora, formatPesos, formatMontosEnTexto, formatUnidad } from '../../lib/format'
import { useData } from '../../context/DataProvider'
import { linkToCliente, linkToReserva } from '../../lib/deepLinks'
import { staggerDelay } from '../../lib/motion'
import { useEsDesktop } from '../../hooks/useMediaQuery'
import DateInput from '../inputs/DateInput'
import SearchInput from '../inputs/SearchInput'
import BrandSelect from '../ui/BrandSelect'
import Skeleton from '../ui/Skeleton'
import BottomSheet from '../ui-prius/BottomSheet'
import HistorialDetalle from './HistorialDetalle'

// Historial unificado (ítem 2, oct 2026; ampliado Tarea 4 oct 2026con
// actor/cliente y más tablas): un solo componente para el Historial global
// (Actividad.jsx), la temporada de una unidad (UnidadPreviewModal) y la
// ficha de un cliente/reserva. Lee de la tabla `eventos` (ver
// useHistorial.js) — global pagina de a 20 con filtros, el resto contra la
// RPC historial_entidad.
// `tono` (nov 2026, rebranding Stitch 07): familia semántica del evento.
// Alimenta el tile de ícono de cada fila — fondo con el tinte suave y el
// ícono con el `ink` de la misma familia, los dos verificados a contraste
// AA (ver tailwind.config.js). Reemplaza los `text-sky-400`/`text-purple-400`
// sueltos, que venían del tema oscuro viejo y sobre blanco quedaban lavados.
const TONOS = {
  acento: 'bg-accent-soft text-accent-ink',
  exito: 'bg-success-soft text-success-ink',
  aviso: 'bg-warning-soft text-warning-ink',
  peligro: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
}

const TIPO_EVENTO_META = {
  reserva_alta: { icon: CalendarDays, label: 'Reserva nueva', tono: 'acento', filtro: 'reservas' },
  reserva_editada: { icon: CalendarDays, label: 'Reserva editada', tono: 'acento', filtro: 'reservas' },
  reserva_cancelada: { icon: Ban, label: 'Reserva cancelada', tono: 'peligro', filtro: 'reservas' },
  reserva_eliminada: { icon: Ban, label: 'Reserva eliminada', tono: 'peligro', filtro: 'reservas' },
  cambio_unidad: { icon: MapPin, label: 'Cambio de unidad', tono: 'info', filtro: 'cambios_unidad' },
  nota: { icon: StickyNote, label: 'Nota', tono: 'info', filtro: 'notas' },
  pago: { icon: Wallet, label: 'Pago registrado', tono: 'exito', filtro: 'pagos' },
  pago_editado: { icon: Wallet, label: 'Pago editado', tono: 'exito', filtro: 'pagos' },
  pago_eliminado: { icon: Wallet, label: 'Pago eliminado', tono: 'peligro', filtro: 'pagos' },
  anulacion: { icon: Ban, label: 'Anulación', tono: 'peligro', filtro: 'anulaciones' },
  gasto_anulado: { icon: Ban, label: 'Gasto anulado', tono: 'peligro', filtro: 'anulaciones' },
  comprobante: { icon: Receipt, label: 'Comprobante cargado', tono: 'aviso', filtro: 'comprobantes' },
  comprobante_editado: { icon: Receipt, label: 'Comprobante editado', tono: 'aviso', filtro: 'comprobantes' },
  comprobante_eliminado: { icon: Receipt, label: 'Comprobante eliminado', tono: 'peligro', filtro: 'comprobantes' },
  cliente_alta: { icon: Users, label: 'Cliente nuevo', tono: 'info', filtro: 'otros' },
  cliente_editado: { icon: Users, label: 'Cliente editado', tono: 'info', filtro: 'otros' },
  cliente_eliminado: { icon: Users, label: 'Cliente eliminado', tono: 'peligro', filtro: 'otros' },
  unidad_estado: { icon: MapPin, label: 'Unidad', tono: 'info', filtro: 'otros' },
  gasto: { icon: Receipt, label: 'Gasto registrado', tono: 'peligro', filtro: 'otros' },
  gasto_editado: { icon: Receipt, label: 'Gasto editado', tono: 'peligro', filtro: 'otros' },
  // Tarea 4 (oct 2026): tablas nuevas cubiertas por el trigger.
  co_socio_agregado: { icon: UserPlus, label: 'Co-socio agregado', tono: 'info', filtro: 'otros' },
  co_socio_quitado: { icon: UserPlus, label: 'Co-socio quitado', tono: 'peligro', filtro: 'otros' },
  caja_apertura: { icon: Lock, label: 'Caja abierta', tono: 'exito', filtro: 'caja' },
  caja_cierre: { icon: Lock, label: 'Caja cerrada', tono: 'aviso', filtro: 'caja' },
  caja_reapertura: { icon: Lock, label: 'Caja reabierta', tono: 'peligro', filtro: 'caja' },
  caja_editada: { icon: Lock, label: 'Caja editada', tono: 'info', filtro: 'caja' },
  lead_nuevo: { icon: Inbox, label: 'Lead nuevo', tono: 'aviso', filtro: 'otros' },
  lead_editado: { icon: Inbox, label: 'Lead editado', tono: 'aviso', filtro: 'otros' },
  temporada_insert: { icon: CalendarDays, label: 'Temporada nueva', tono: 'acento', filtro: 'otros' },
  temporada_update: { icon: CalendarDays, label: 'Temporada editada', tono: 'acento', filtro: 'otros' },
  temporada_delete: { icon: CalendarDays, label: 'Temporada eliminada', tono: 'peligro', filtro: 'otros' },
  migracion_historica: { icon: History, label: 'Migración histórica', tono: 'info', filtro: 'otros' },
  // Seguimiento (oct 2026, Tarea 2): eventos de auth, vía fn_registrar_evento_auth.
  login: { icon: LogIn, label: 'Inicio de sesión', tono: 'exito', filtro: 'otros' },
  logout: { icon: LogOut, label: 'Cierre de sesión', tono: 'info', filtro: 'otros' },
  logout_inactividad: { icon: ShieldOff, label: 'Cierre por inactividad', tono: 'aviso', filtro: 'otros' },
}

const FILTROS = [
  { key: 'todos', label: 'Todo' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'comprobantes', label: 'Comprobantes' },
  { key: 'cambios_unidad', label: 'Cambios de unidad' },
  { key: 'caja', label: 'Caja' },
  { key: 'anulaciones', label: 'Anulaciones' },
  { key: 'notas', label: 'Notas' },
]

const todayStr = () => new Date().toISOString().split('T')[0]
const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().split('T')[0]
}

// (nov 2026) TIPOS_MODIFICACION / TIPOS_CANCELACION se borraron junto con la
// barra de estadísticas: solo servían para contar "Modificaciones" y
// "Cancelaciones" en esos KPIs. No había queries propias que sacar — los
// cinco números se calculaban en memoria sobre los eventos ya paginados.

function etiquetaFecha(fecha) {
  if (fecha === todayStr()) return 'Hoy'
  if (fecha === addDays(todayStr(), -1)) return 'Ayer'
  return formatFechaLarga(fecha)
}

function metaDe(evento) {
  return TIPO_EVENTO_META[evento.tipo_evento] || { icon: Activity, label: formatMontosEnTexto(evento.descripcion), tono: 'info', filtro: 'otros' }
}

/**
 * Datos sueltos del evento que valen como línea secundaria en la fila:
 * monto, cliente, unidad y comprobante, SOLO cuando existen de verdad en
 * `datos` (el mock de Stitch los muestra siempre; la tabla `eventos` no los
 * tiene para todos los tipos — los de auth, por ejemplo, no traen ninguno).
 */
function datosDeEvento(evento, unidadesPorId = {}) {
  const after = evento.datos?.after || {}
  const before = evento.datos?.before || {}
  const val = (k) => (after[k] != null ? after[k] : before[k])
  const unidadId = val('unidad_id')
  const unidad = unidadId ? unidadesPorId[unidadId] : null
  const monto = val('monto')
  return {
    monto: monto != null ? formatPesos(monto) : null,
    cliente: evento.cliente_nombre || null,
    unidad: unidad ? formatUnidad(unidad.tipo, unidad.numero) : null,
    comprobante: val('comprobante') || null,
  }
}

// Campos cuyo cambio vale la pena mostrar como "antes → después" (Tarea 4)
// — el resto de los campos de `datos.before/after` son ruido para Mado.
const CAMPOS_DIFF = {
  reservas: [
    { campo: 'fecha_inicio', label: 'Fecha inicio', fmt: formatFecha },
    { campo: 'fecha_fin', label: 'Fecha fin', fmt: formatFecha },
    { campo: 'fecha', label: 'Fecha', fmt: formatFecha },
    { campo: 'valor_total', label: 'Monto', fmt: formatPesos },
    // `fmtUnidad` (no `fmt`): necesita el mapa de unidades, que solo existe
    // en runtime. Sin esto el Historial mostraba el UUID crudo
    // ("Unidad: 249cb18c-… → 524e8f62-…") — 31/10/2026.
    { campo: 'unidad_id', label: 'Unidad', fmtUnidad: true },
  ],
  pagos: [{ campo: 'monto', label: 'Monto', fmt: formatPesos }, { campo: 'medio', label: 'Medio' }],
}

// Ruido que nunca se muestra en el diff genérico: claves técnicas, sellos
// de tiempo y relaciones que ya se ven resueltas en otro lado de la ficha.
const CAMPOS_RUIDO = new Set([
  'id', 'created_at', 'updated_at', 'ts', 'usuario', 'registrado_por',
  'cliente_id', 'reserva_id', 'caja_id', 'comprobante_id', 'grupo_id',
  'pago_id', 'anulado_por', 'anulado_at', 'monto_ars',
  // Blobs: se guardan enteros en el evento y como texto no dicen nada.
  'resumen_snapshot', 'contado_por_medio', 'temporada_id', 'abierta_por', 'cerrada_por',
])

const humanizar = (campo) =>
  campo.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

// Ningún número se muestra crudo (regla de la app): en el diff genérico no
// hay una lista de campos escrita a mano, así que el formateador se elige
// por el nombre del campo. Sin esto el panel mostraba "1100000".
const ES_PLATA = /^(monto|total|saldo|precio|valor|efectivo|importe|diferencia|cobros|gastos)/
const ES_FECHA = /(^fecha|_at$)/

const comoTexto = (v, campo = '') => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60)
  if (ES_PLATA.test(campo) && !Number.isNaN(Number(v))) return formatPesos(Number(v))
  if (ES_FECHA.test(campo)) return formatFecha(String(v).slice(0, 10))
  return String(v)
}

/**
 * Diff genérico para las tablas sin mapeo propio en CAMPOS_DIFF
 * (caja_diaria, comprobantes, unidades, leads…). El mock de Stitch muestra
 * siempre el bloque "antes vs después", y para esas tablas el dato existe
 * de verdad en `datos.before/after` — lo que faltaba era la lista de campos
 * a mirar. Se descartan las claves técnicas (CAMPOS_RUIDO) y se corta en 6
 * cambios para que el panel no se vuelva un volcado de la fila entera.
 */
function diffGenerico(before, after) {
  const cambios = []
  for (const campo of Object.keys(after)) {
    if (CAMPOS_RUIDO.has(campo)) continue
    if (!(campo in before)) continue
    const a = before[campo]
    const b = after[campo]
    if (a === b) continue
    const antes = comoTexto(a, campo)
    const despues = comoTexto(b, campo)
    if (antes === despues) continue
    cambios.push({ label: humanizar(campo), antes, despues })
    if (cambios.length === 6) break
  }
  return cambios
}

/**
 * Cambios "antes → después" del evento, como lista estructurada
 * ({ label, antes, despues }). Antes devolvía un string ya armado; ahora el
 * panel de detalle necesita las dos puntas por separado para pintarlas
 * distinto (tachado vs resaltado), y la fila compacta sigue armando su
 * texto con `cambiosATexto`.
 */
function cambiosDe(evento, unidadesPorId = {}) {
  const before = evento.datos?.before
  const after = evento.datos?.after
  if (!before || !after) return []
  const campos = CAMPOS_DIFF[evento.tabla]
  if (!campos) return diffGenerico(before, after)
  const resolverUnidad = (id) => {
    const u = unidadesPorId[id]
    return u ? formatUnidad(u.tipo, u.numero) : 'otra unidad'
  }
  const cambios = []
  for (const { campo, label, fmt, fmtUnidad } of campos) {
    const a = before[campo]
    const b = after[campo]
    if (a === b || a == null || b == null) continue
    const fa = fmtUnidad ? resolverUnidad(a) : fmt ? fmt(a) : a
    const fb = fmtUnidad ? resolverUnidad(b) : fmt ? fmt(b) : b
    if (fa === fb) continue
    cambios.push({ label, antes: String(fa), despues: String(fb) })
  }
  return cambios
}

/**
 * Descripción del evento, o null si no agrega nada sobre la etiqueta del
 * tipo. Muchas descripciones arrancan repitiendo la etiqueta ("Caja cerrada
 * — Total $2.525.000" debajo del título "Caja cerrada"): en ese caso se
 * recorta el prefijo y queda solo la parte que informa.
 */
function descripcionExtra(evento, meta) {
  if (!evento.descripcion) return null
  const texto = formatMontosEnTexto(evento.descripcion).trim()
  const norm = (s) => String(s).trim().toLowerCase()
  const label = norm(meta.label)
  if (norm(texto) === label) return null
  if (norm(texto).startsWith(label)) {
    const resto = texto.slice(meta.label.length).replace(/^\s*[—–\-·:]\s*/, '').trim()
    return resto || null
  }
  return texto
}

// Atajos de rango del mock (07): Hoy / 7 días / Mes / Personalizado.
// "Personalizado" no fija fechas: solo revela los dos date pickers.
const ATAJOS = [
  { key: 'hoy', label: 'Hoy', dias: 0 },
  { key: '7d', label: '7 días', dias: 7 },
  { key: 'mes', label: 'Mes', dias: 30 },
  { key: 'custom', label: 'Personalizado' },
]

function atajoActivo(desde, hasta) {
  if (hasta !== todayStr()) return 'custom'
  for (const a of ATAJOS) {
    if (a.dias == null) continue
    if (desde === addDays(todayStr(), -a.dias)) return a.key
  }
  return 'custom'
}

/** Fila de evento. Misma pieza para el listado global y para las fichas. */
function EventoFila({ evento, meta, datos, cambios, activo, onClick, indice, total }) {
  const Icon = meta.icon
  const esHistorico = evento.datos?.after?.es_historico || evento.datos?.before?.es_historico
  const Tag = onClick ? 'button' : 'div'
  const secundario = [datos.monto, datos.cliente, datos.unidad, datos.comprobante].filter(Boolean)
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ animationDelay: staggerDelay(indice, total) }}
      className={`w-full flex items-start gap-3 px-3 py-3 text-left rounded-xl anim-colors anim-stagger ${
        onClick ? 'hover-row' : ''
      } ${activo ? 'bg-accent-soft' : ''}`}
    >
      {/* Tile de ícono por tipo de evento, con el tinte de su familia. */}
      <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${TONOS[meta.tono] || TONOS.info}`}>
        <Icon size={16} />
      </span>
      {/* min-w-0 + [overflow-wrap:anywhere]: impide que strings largos sin
          espacios (e.g. un comprobante, "Cierredesesion…") expandan la fila
          más allá del viewport. `break-words` (overflow-wrap: break-word)
          solo rompe cuando no hay otra opción; `anywhere` rompe siempre y
          previene el scroll horizontal en mobile. */}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-body-md text-black font-semibold truncate">{evento.actor_nombre || 'Sistema'}</p>
          <span className="text-body-sm text-prius-muted shrink-0 tabular-nums">{formatHora(evento.ts)}</span>
        </div>
        {/* La descripción solo se agrega si dice algo distinto de la
            etiqueta del tipo: para los eventos de auth las dos son "Inicio
            de sesión" y quedaba repetido. */}
        <p className="text-body-md text-prius-slate mt-0.5">
          <span className="text-black">{meta.label}</span>
          {descripcionExtra(evento, meta) ? <> — {descripcionExtra(evento, meta)}</> : null}
        </p>
        {/* Solo los datos que el evento realmente tiene. max-w-full para que
            ningún chip empuje más allá del contenedor. */}
        {secundario.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {secundario.map((s) => (
              <span key={s} className="text-body-sm text-prius-slate bg-prius-surface rounded-lg px-2 py-0.5 max-w-full">{s}</span>
            ))}
          </div>
        )}
        {/* Cambios como chips individuales (antes: una sola línea larga
            que podía exceder el ancho en mobile). Se muestran los 2
            primeros; si hay más, un chip "+N más" lleva al detalle. */}
        {cambios.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {cambios.slice(0, 2).map((c) => (
              <span
                key={c.label}
                className="inline-flex flex-wrap items-baseline gap-x-1 text-body-sm bg-info-soft rounded-lg px-2 py-0.5 max-w-full"
              >
                <span className="text-prius-muted font-medium">{c.label}:</span>
                <span className="text-prius-muted line-through tabular-nums">{c.antes}</span>
                <span className="text-info-ink">→</span>
                <span className="text-info-ink font-semibold tabular-nums">{c.despues}</span>
              </span>
            ))}
            {cambios.length > 2 && (
              <span className="text-body-sm text-prius-muted bg-prius-surface rounded-lg px-2 py-0.5">
                +{cambios.length - 2} más
              </span>
            )}
          </div>
        )}
        {esHistorico && (
          <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-prius-muted bg-prius-surface border border-hairline rounded-full px-2 py-0.5 mt-1.5">
            Histórico
          </span>
        )}
      </div>
    </Tag>
  )
}

/** Skeleton del listado — misma forma que las filas reales, no un bloque genérico. */
function HistorialSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando historial">
      {[0, 1].map((g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-4 w-40 rounded-lg" />
          <div className="bg-white border border-hairline rounded-2xl p-2 space-y-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3 rounded-md" />
                  <Skeleton className="h-3.5 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// tipo: 'global' | 'cliente' | 'reserva' | 'unidad'; id: uuid de la entidad
// (ignorado en 'global'). onEventoClick(evento) es opcional — si no se pasa,
// el evento se muestra pero no navega a ningún lado.
export default function Historial({ tipo = 'global', id, onEventoClick, compact = false }) {
  // Mapa id -> unidad, para que el diff muestre "Carpa 12 → Carpa 58" en vez
  // del UUID crudo (31/10/2026). Las unidades ya están en memoria.
  const { unidades } = useData()
  const unidadesPorId = useMemo(() => {
    const map = {}
    for (const u of unidades || []) map[u.id] = u
    return map
  }, [unidades])
  const [filtro, setFiltro] = useState('todos')
  const navigate = useNavigate()
  const esDesktop = useEsDesktop()

  const mostrarFiltrosGlobales = tipo === 'global' && !compact
  const [searchParams, setSearchParams] = useSearchParams()
  const desde = mostrarFiltrosGlobales ? (searchParams.get('hDesde') || addDays(todayStr(), -7)) : null
  const hasta = mostrarFiltrosGlobales ? (searchParams.get('hHasta') || todayStr()) : null
  const q = mostrarFiltrosGlobales ? (searchParams.get('hq') || '') : ''
  const usuarioFiltro = mostrarFiltrosGlobales ? (searchParams.get('hUsuario') || '') : ''
  const setRango = (key, value, fallback) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev)
    value === fallback ? next.delete(key) : next.set(key, value)
    return next
  }, { replace: true })

  // Filtros colapsables en mobile (mock 07 mobile): la barra queda fija
  // arriba y los controles finos se despliegan con el botón de ajustes.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  // Evento abierto en el detalle (panel derecho en desktop, sheet en mobile).
  const [seleccionado, setSeleccionado] = useState(null)

  const filtrosGlobal = mostrarFiltrosGlobales ? { desde, hasta, q, usuario: usuarioFiltro || undefined } : undefined
  const { items: todos, loading, hasMore, loadMore } = useHistorial(tipo, id, null, filtrosGlobal)

  // Usuarios distintos vistos en la página actual, para el filtro — no es
  // un combobox contra toda la tabla (no hay un endpoint de usuarios acá),
  // pero alcanza para filtrar por quién aparece en lo ya cargado.
  const opcionesUsuario = useMemo(() => {
    const vistos = new Map()
    for (const e of todos) {
      if (e.usuario && e.actor_nombre) vistos.set(e.usuario, e.actor_nombre)
    }
    return [{ value: '', label: 'Todos los usuarios' }, ...[...vistos.entries()].map(([value, label]) => ({ value, label }))]
  }, [todos])

  const filtrados = useMemo(
    () => (filtro === 'todos' ? todos : todos.filter((e) => metaDe(e).filtro === filtro)),
    [todos, filtro],
  )

  const grupos = useMemo(() => {
    const map = new Map()
    for (const e of filtrados) {
      const key = e.fecha_ref || 'sin-fecha'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    const entries = [...map.entries()]
    const conFecha = entries.filter(([k]) => k !== 'sin-fecha').sort((a, b) => (a[0] < b[0] ? 1 : -1))
    const sinFecha = entries.filter(([k]) => k === 'sin-fecha')
    return [...conFecha, ...sinFecha]
  }, [filtrados])

  // Navegación del evento. Sin cambios respecto de la versión anterior: en
  // el listado global ahora se dispara desde el botón del detalle en vez
  // del click directo en la fila, pero la lógica es la misma.
  const handleClick = (evento) => {
    if (onEventoClick) return onEventoClick(evento)
    const after = evento.datos?.after || {}
    const before = evento.datos?.before || {}
    const clienteId = evento.cliente_id || after.cliente_id || before.cliente_id
    if (evento.tabla === 'reservas') return navigate(linkToReserva(evento.registro_id))
    if (evento.tabla === 'clientes') return navigate(linkToCliente(evento.registro_id))
    if (evento.tabla === 'pagos' && clienteId) {
      return navigate(linkToCliente(clienteId, { pagoId: evento.registro_id }))
    }
    if (evento.tabla === 'comprobantes' && clienteId) {
      return navigate(linkToCliente(clienteId))
    }
    if (clienteId) return navigate(linkToCliente(clienteId))
  }

  const puedeNavegar = (e) => {
    const clienteId = e.cliente_id || e.datos?.after?.cliente_id || e.datos?.before?.cliente_id
    return !!onEventoClick || e.tabla === 'reservas' || e.tabla === 'clientes' || !!clienteId
  }

  /** Props del detalle para el evento abierto. */
  const detalle = useMemo(() => {
    if (!seleccionado) return null
    const meta = metaDe(seleccionado)
    const datos = datosDeEvento(seleccionado, unidadesPorId)
    return {
      evento: seleccionado,
      meta: {
        ...meta,
        tile: TONOS[meta.tono] || TONOS.info,
        titulo: meta.label,
        descripcion: descripcionExtra(seleccionado, meta),
        accionLabel: datos.cliente ? `Ver ficha de ${datos.cliente}` : 'Abrir registro',
      },
      cambios: cambiosDe(seleccionado, unidadesPorId),
      datos,
      onIr: puedeNavegar(seleccionado) ? () => handleClick(seleccionado) : null,
    }
  }, [seleccionado, unidadesPorId])

  if (loading && todos.length === 0) {
    return mostrarFiltrosGlobales
      ? <HistorialSkeleton />
      : <p className="text-xs text-prius-muted uppercase tracking-widest animate-pulse">Cargando historial...</p>
  }

  // ───────────────────────── listado (compartido) ─────────────────────────
  const listado = (
    <div className="space-y-4">
      {grupos.length === 0 ? (
        <div className="bg-white border border-hairline rounded-2xl p-10 text-center flex flex-col items-center gap-3 anim-fade-up">
          <span className="w-12 h-12 rounded-2xl bg-prius-surface flex items-center justify-center">
            <History size={20} className="text-prius-muted" />
          </span>
          <p className="text-body-md font-semibold text-black">Sin movimientos</p>
          <p className="text-body-sm text-prius-slate max-w-xs">
            No hay eventos para los filtros elegidos. Probá ampliar el rango de fechas o sacar los filtros.
          </p>
        </div>
      ) : (
        grupos.map(([fecha, items]) => (
          <div key={fecha}>
            {/* Encabezado de día sticky, con contador (mock 07). */}
            <div className={`flex items-center justify-between gap-2 py-2 ${
              mostrarFiltrosGlobales ? 'sticky top-0 z-10 sticky-blur' : 'bg-prius-background'
            }`}>
              <h3 className="text-label-lg uppercase tracking-wider text-black capitalize truncate">
                {fecha === 'sin-fecha' ? 'Sin fecha' : etiquetaFecha(fecha)}
              </h3>
              <span className="shrink-0 text-label-md uppercase tracking-wider text-prius-slate bg-prius-surface rounded-full px-2.5 py-1">
                {items.length} {items.length === 1 ? 'evento' : 'eventos'}
              </span>
            </div>
            <div className="bg-white border border-hairline rounded-2xl p-2 space-y-1">
              {items.map((e, i) => {
                const meta = metaDe(e)
                const abrible = mostrarFiltrosGlobales || puedeNavegar(e)
                return (
                  <EventoFila
                    key={e.id}
                    evento={e}
                    meta={meta}
                    datos={datosDeEvento(e, unidadesPorId)}
                    cambios={cambiosDe(e, unidadesPorId)}
                    activo={seleccionado?.id === e.id}
                    indice={i}
                    total={items.length}
                    onClick={
                      !abrible ? undefined
                        : mostrarFiltrosGlobales ? () => setSeleccionado(e)
                          : () => handleClick(e)
                    }
                  />
                )
              })}
            </div>
          </div>
        ))
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full h-12 rounded-xl text-label-lg uppercase tracking-wider bg-white border border-hairline text-prius-slate hover:bg-prius-surface disabled:opacity-50 anim-press anim-colors"
        >
          {loading ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </div>
  )

  // ───────────────────── fichas (cliente/reserva/unidad) ──────────────────
  if (!mostrarFiltrosGlobales) {
    return <div className="space-y-4">{!compact && <ChipsTipo filtro={filtro} setFiltro={setFiltro} />}{listado}</div>
  }

  // ─────────────────────────── Historial global ───────────────────────────
  return (
    <div className="anim-fade-up-page">
      {/* Barra de filtros. En mobile queda fija arriba y los controles finos
          se despliegan; en desktop está todo a la vista. */}
      {/* sticky-blur: fondo semi-opaco + backdrop-filter para que el
          contenido que scrollea por detrás se difumine en vez de cortar
          en seco. El ::after (solo mobile) extiende el fade al área de
          pb-3 bajo la card de filtros. En md:static el blur no tiene
          efecto visual (nada scrollea por detrás de un elemento estático
          en flujo normal). */}
      <div className="sticky top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 md:static pb-3 sticky-blur">
        <div className="bg-white border border-hairline rounded-2xl p-3 space-y-3">
          <div className="flex items-center gap-2">
            <SearchInput
              value={q}
              onChange={(v) => setRango('hq', v, '')}
              placeholder="Buscar por usuario, cliente o comprobante"
              className="flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              aria-expanded={filtrosAbiertos}
              aria-label="Mostrar filtros"
              className={`md:hidden shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center anim-colors anim-press ${
                filtrosAbiertos ? 'bg-accent-soft border-gold text-accent-ink' : 'bg-white border-hairline text-prius-slate'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Rango + usuario: siempre visible en desktop, desplegable en mobile. */}
          <div className={`${filtrosAbiertos ? 'grid' : 'hidden'} md:grid gap-2 grid-cols-2 md:flex md:flex-wrap md:items-center`}>
            <div className="col-span-2 flex items-center gap-1 bg-prius-surface rounded-xl p-1 overflow-x-auto md:col-auto">
              {ATAJOS.map((a) => {
                const activo = atajoActivo(desde, hasta) === a.key
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => {
                      if (a.dias == null) return setFiltrosAbiertos(true)
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev)
                        const d = addDays(todayStr(), -a.dias)
                        d === addDays(todayStr(), -7) ? next.delete('hDesde') : next.set('hDesde', d)
                        next.delete('hHasta')
                        return next
                      }, { replace: true })
                    }}
                    className={`shrink-0 px-3 h-9 rounded-lg text-label-md uppercase tracking-wider anim-colors ${
                      activo ? 'bg-black text-white' : 'text-prius-slate hover:text-black'
                    }`}
                  >
                    {a.label}
                  </button>
                )
              })}
            </div>
            <DateInput value={desde} onChange={(v) => setRango('hDesde', v || addDays(todayStr(), -7), addDays(todayStr(), -7))} className="w-full md:w-36" />
            <DateInput value={hasta} onChange={(v) => setRango('hHasta', v || todayStr(), todayStr())} min={desde} className="w-full md:w-36" />
            <BrandSelect value={usuarioFiltro} onChange={(v) => setRango('hUsuario', v, '')} options={opcionesUsuario} className="col-span-2 w-full md:w-48" />
          </div>

          <ChipsTipo filtro={filtro} setFiltro={setFiltro} />
        </div>
      </div>

      {/* Lista + panel de detalle (desktop). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4 lg:items-start">
        <div className="min-w-0">{listado}</div>
        <aside className="hidden lg:block sticky top-4 max-h-[calc(100dvh-8rem)] bg-white border border-hairline rounded-2xl p-4">
          {detalle ? (
            <div key={detalle.evento.id} className="content-crossfade h-full">
              <HistorialDetalle {...detalle} onCerrar={() => setSeleccionado(null)} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-16 text-prius-muted">
              <History size={22} />
              <p className="text-body-sm max-w-[200px]">Elegí un movimiento para ver el detalle.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Detalle en mobile: bottom sheet. BottomSheet va en portal a
          document.body (así nunca queda atrapado por un ancestro con
          transform), y justamente por eso el montaje se decide en JS con
          `esDesktop`: envolverlo en un `lg:hidden` no esconde nada, porque
          el contenido del portal no está adentro de ese div. */}
      {!esDesktop && (
        <BottomSheet isOpen={!!seleccionado} onClose={() => setSeleccionado(null)} title="Detalle del movimiento">
          {detalle && <HistorialDetalle {...detalle} onCerrar={() => setSeleccionado(null)} enSheet />}
        </BottomSheet>
      )}
    </div>
  )
}

/** Chips de tipo de evento. En mobile van en una sola fila con scroll. */
function ChipsTipo({ filtro, setFiltro }) {
  return (
    <div className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible -mx-1 px-1 pb-0.5">
      {FILTROS.map((f) => (
        <button
          key={f.key}
          onClick={() => setFiltro(f.key)}
          aria-pressed={filtro === f.key}
          className={`shrink-0 px-3 h-9 rounded-xl text-label-md uppercase tracking-wider border anim-colors anim-press ${
            filtro === f.key
              ? 'bg-gold text-black border-gold'
              : 'bg-white text-prius-slate border-hairline hover:text-black hover-accent'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
