import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { Printer, Plus, Minus, Maximize, ChevronLeft, ChevronRight } from "lucide-react"

import {
  STATUS,
  PLANO_COL_WIDTH,
  PLANO_PASILLO_LATERAL,
  PLANO_PASILLO_CENTRAL,
  PLANO_BLOQUE_GAP,
  PLANO_SECTOR_WIDTH,
} from "../components/dashboard/constants"
import UnidadPreviewModal from "../components/dashboard/UnidadPreviewModal"
import Cell from "../components/dashboard/Cell"
import PlanoImpresion from "../components/dashboard/PlanoImpresion"
import { useData } from "../context/DataProvider"
import { coSocios } from "../lib/reservas"

// El plano de playa solo dibuja carpas y sombrillas. Cabinas y lockers están
// dentro del complejo y se manejan en su propia sección del CRM.
const PREFIJO = { carpa: "C", sombrilla: "S" }

const todayStr = () => new Date().toISOString().split("T")[0]

// Rango inclusivo de números de unidad, reutilizado por cada hilera del plano.
const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i)

// Mismo helper que Caja.jsx: suma/resta un día a una fecha yyyy-mm-dd sin
// líos de timezone.
const shiftDate = (fecha, delta) => {
  const d = new Date(fecha + "T00:00:00")
  d.setDate(d.getDate() + delta)
  return d.toISOString().split("T")[0]
}

export default function Dashboard() {
  const { unidades, reservas, loading, temporadaActiva } = useData()

  // Se guarda el ID, no una copia de `units[...]`: así el modal de preview
  // sigue leyendo el objeto vivo del useMemo de abajo en cada render y se
  // actualiza solo si la reserva cambia por Realtime mientras está abierto
  // (ver CLAUDE.md "Modal de unidad en el Plano").
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [zoom, setZoom] = useState(0.95)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const esHoy = selectedDate === todayStr()

  // Deslizamiento del mapa al cambiar de fecha: animación por clase CSS sobre
  // un wrapper (ver index.css), nunca por `key` — un `key` en un ancestro de
  // las ~184 Cell forzaría un remount completo y ahí sí habría lag.
  const mapSlideRef = useRef(null)
  const mapSlideTimeoutRef = useRef(null)
  const slideMap = (direction) => {
    const el = mapSlideRef.current
    if (!el) return
    const cls = direction === "forward" ? "plano-slide-left" : "plano-slide-right"
    el.classList.remove("plano-slide-left", "plano-slide-right")
    void el.offsetWidth // fuerza reflow para poder re-disparar la misma animación en clicks seguidos
    el.classList.add(cls)
    // Fallback además de onAnimationEnd: en una pestaña sin foco (o con
    // "prefers-reduced-motion") el evento animationend puede no llegar a
    // tiempo — igual hay que soltar la clase para no dejarla pegada.
    clearTimeout(mapSlideTimeoutRef.current)
    mapSlideTimeoutRef.current = setTimeout(() => el.classList.remove("plano-slide-left", "plano-slide-right"), 250)
  }
  const goToDate = (newDate) => {
    if (newDate === selectedDate) return
    slideMap(newDate > selectedDate ? "forward" : "backward")
    setSelectedDate(newDate)
  }

  // El estado de cada unidad lo escribe el trigger de Postgres al vencer/crear
  // reservas, y el pg_cron nocturno libera las que vencieron sin actividad.
  // Al abrir el plano forzamos ese recálculo para no depender del cron.
  useEffect(() => {
    supabase.rpc("fn_recalcular_estados_unidades").then(({ error }) => {
      if (error) console.error("No se pudo recalcular estados del plano:", error.message)
    })
  }, [])

  // Reserva vigente en `selectedDate` (hoy por defecto) por unidad. La celda
  // se pinta según su tipo_alquiler (T/P/D); si no hay reserva vigente ese
  // día, la unidad va libre. Un abonado de temporada completa cubre
  // cualquier fecha dentro de la temporada, sin importar cuál se elija.
  const reservaPorUnidad = useMemo(() => {
    const map = {}
    for (const r of reservas) {
      if (!r.unidad_id || r.estado === "cancelada") continue
      const vigente =
        r.tipo_alquiler === "temporada" ||
        (r.tipo_alquiler === "dia" && r.fecha === selectedDate) ||
        (r.tipo_alquiler === "periodo" && r.fecha_inicio <= selectedDate && selectedDate <= r.fecha_fin)
      if (vigente) map[r.unidad_id] = r
    }
    return map
  }, [reservas, selectedDate])

  const units = useMemo(() => {
    const map = {}
    for (const u of unidades) {
      const px = PREFIJO[u.tipo]
      if (!px) continue
      const r = reservaPorUnidad[u.id]
      const status = !r
        ? STATUS.LIBRE
        : r.estado_pago === "pendiente_confirmacion"
          ? STATUS.PENDIENTE_CONFIRMACION
          : r.tipo_alquiler === "temporada"
            ? STATUS.TEMPORADA
            : r.tipo_alquiler === "dia"
              ? STATUS.DIA
              : STATUS.PERIODO
      map[`${px}${u.numero}`] = {
        id: `${px}${u.numero}`,
        dbId: u.id,
        reservaId: r?.id || null,
        number: u.numero,
        type: u.tipo,
        status,
        tipoAlquiler: r?.tipo_alquiler || null,
        clientName: r?.clientes?.nombre || "",
        clientPhone: r?.clientes?.telefono || "",
        clientEmail: r?.clientes?.mail || "",
        coSocios: r ? coSocios(r).map((c) => c.nombre) : [],
        startDate: r?.fecha_inicio || r?.fecha || "",
        endDate: r?.fecha_fin || r?.fecha || "",
        notes: r?.notas || "",
        isPaid: r?.estado_pago === "pagado",
        isTemporada: r?.tipo_alquiler === "temporada",
        // Fila cruda de `reservas` (con clientes/unidades/reserva_clientes
        // embebidos por el select del DataProvider) — el preview del modal la
        // usa directo en vez de reconstruir un objeto plano a mano.
        reserva: r || null,
      }
    }
    return map
  }, [unidades, reservaPorUnidad])

  const selectedUnit = selectedUnitId ? units[selectedUnitId] : null

  // useCallback: referencia estable para no romper el React.memo de las 184 Cell
  const handleUnitClick = useCallback((unit) => {
    if (unit) setSelectedUnitId(unit.id)
  }, [])

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.5))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5))
  const handleResetZoom = () => setZoom(0.95)

  const getCarpa = (num) => units[`C${num}`]
  const getSombrilla = (num) => units[`S${num}`]

  return (
    <div className="h-full flex flex-col animate-premium-fade overflow-hidden">
    <div className="no-print flex-1 flex flex-col space-y-4 overflow-hidden pb-4">
      {/* Toolbar: navegación por fecha (izquierda) + vista/impresión (derecha),
          todo en una sola fila para liberar alto vertical para el mapa. El
          título grande vive ahora en el TopBar. */}
      <div className="flex flex-wrap justify-between items-center gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => goToDate(shiftDate(selectedDate, -1))}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all"
            title="Día anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && goToDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#FDE047]/50 outline-none [color-scheme:dark]"
          />
          <button
            onClick={() => goToDate(shiftDate(selectedDate, 1))}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all"
            title="Día siguiente"
          >
            <ChevronRight size={16} />
          </button>
          {!esHoy && (
            <button
              onClick={() => goToDate(todayStr())}
              className="text-[10px] font-bold uppercase tracking-widest text-[#FDE047] hover:text-yellow-300 transition-all px-2"
            >
              Volver a hoy
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="glass-card px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"><Printer size={14} /> Imprimir A4</button>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex-1 min-h-0 glass-card rounded-3xl glass-card-inner relative overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-[10px] font-bold uppercase tracking-widest">
            Cargando plano…
          </div>
        ) : (
          <>
            <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
              <button onClick={handleZoomIn} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-[#FDE047] hover:text-black transition-all">
                <Plus size={20} />
              </button>
              <button onClick={handleZoomOut} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-[#FDE047] hover:text-black transition-all">
                <Minus size={20} />
              </button>
              <button onClick={handleResetZoom} className="w-10 h-10 glass-card rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all">
                <Maximize size={18} />
              </button>
            </div>

            <div
              ref={mapSlideRef}
              onAnimationEnd={(e) => e.currentTarget.classList.remove("plano-slide-left", "plano-slide-right")}
              className="flex-1 overflow-auto p-12 flex justify-center items-start"
            >
              <div
                className="transition-transform duration-200 origin-top flex flex-col items-center"
                style={{ transform: `scale(${zoom})` }}
              >
                {/*
                  Layout definido con el dueño (sept 2026, ver CLAUDE.md):
                  1 hilera sola (1-25) + pasillo A + bloque doble espalda-con-
                  espalda (26-50/51-75) + pasillo B (central, ancho, alineado
                  con Acceso) + bloque doble (76-98/99-121) + pasillo C +
                  1 hilera sola (122-144). Anchos en PLANO_* (constants.js),
                  único lugar con estos valores — también los usa
                  PlanoImpresion.jsx (como fr) para la hoja A4.
                */}

                {/* Row Superior Unificada */}
                <div className="flex justify-center gap-0 items-start mb-6">
                  {/* Recreación: sector izquierdo completo (hilera + pasillo A + bloque doble) */}
                  <div style={{ width: PLANO_SECTOR_WIDTH }} className="h-[50px] flex items-center justify-center border border-white/10 rounded-l-lg bg-white/5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                    Recreación
                  </div>

                  {/* Acceso: mismo ancho que el Pasillo B, centrado con él */}
                  <div style={{ width: PLANO_PASILLO_CENTRAL }} className="h-[50px] flex items-center justify-center border-y border-white/10 bg-white/10 text-[9px] font-bold uppercase tracking-widest text-white">
                    Acceso
                  </div>

                  {/* Pileta: sector derecho completo, bajando para ocupar el espacio físico */}
                  <div style={{ width: PLANO_SECTOR_WIDTH }} className="h-[122px] bg-sky-500/10 border border-sky-500/30 rounded-r-lg flex flex-col items-center justify-center relative group overflow-hidden">
                    <div className="absolute inset-0 bg-sky-400/5" />
                    <span className="relative z-10 text-[10px] font-black text-sky-400 uppercase tracking-[0.6em]">Pileta</span>
                    <div className="w-12 h-1 bg-sky-400/20 rounded-full mt-2" />
                  </div>
                </div>

                {/* Contenedor de Carpas */}
                <div className="flex justify-center items-end pb-12">
                  {/* Hilera 1-25, número a la izquierda */}
                  <div className="flex flex-col gap-1">
                    {range(1, 25).map(num => (
                      <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} numberSide="left" />
                    ))}
                  </div>

                  {/* Pasillo A */}
                  <div style={{ width: PLANO_PASILLO_LATERAL }} />

                  {/* Bloque doble 26-50 (izq) + 51-75 (der), espalda con espalda */}
                  <div className="flex items-end" style={{ gap: PLANO_BLOQUE_GAP }}>
                    <div className="flex flex-col gap-1">
                      {range(26, 50).map(num => (
                        <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} numberSide="left" />
                      ))}
                    </div>
                    <div className="flex flex-col gap-1">
                      {range(51, 75).map(num => (
                        <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} numberSide="right" />
                      ))}
                    </div>
                  </div>

                  {/* Pasillo B, central, más ancho, alineado con Acceso */}
                  <div style={{ width: PLANO_PASILLO_CENTRAL }} />

                  {/* Bloque doble 76-98 (izq) + 99-121 (der), espalda con espalda */}
                  <div className="flex items-end" style={{ gap: PLANO_BLOQUE_GAP }}>
                    <div className="flex flex-col gap-1">
                      {range(76, 98).map(num => (
                        <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} numberSide="left" />
                      ))}
                    </div>
                    <div className="flex flex-col gap-1">
                      {range(99, 121).map(num => (
                        <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} numberSide="right" />
                      ))}
                    </div>
                  </div>

                  {/* Pasillo C */}
                  <div style={{ width: PLANO_PASILLO_LATERAL }} />

                  {/* Hilera 122-144, número a la derecha */}
                  <div className="flex flex-col gap-1">
                    {range(122, 144).map(num => (
                      <Cell key={num} number={num} unit={getCarpa(num)} onClick={handleUnitClick} numberSide="right" />
                    ))}
                  </div>
                </div>

                {/* Sector Sombrillas */}
                <div className="mt-16 flex flex-col items-center">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="h-[1px] w-12 bg-white/10" />
                    <span className="text-[11px] font-black uppercase tracking-[0.5em] text-gray-500">⛱️ Sector Sombrillas</span>
                    <div className="h-[1px] w-12 bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-20">
                    {[
                      [1, 6, 11, 16], [21, 26, 31, 36]
                    ].map((starts, colIdx) => (
                      <div key={colIdx} className="space-y-1">
                        {starts.map(start => (
                          <div key={start} className="flex gap-1">
                            {[0, 1, 2, 3, 4].map(off => (
                              <Cell key={start + off} number={start + off} unit={getSombrilla(start + off)} onClick={handleUnitClick} />
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-16 w-full bg-white/5 border border-white/5 py-5 text-center text-gray-600 font-black text-[11px] tracking-[1em] uppercase rounded-2xl">
                  Océano Atlántico
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedUnit && (
        <UnidadPreviewModal
          unit={selectedUnit}
          reservas={reservas}
          temporadaActiva={temporadaActiva}
          onClose={() => setSelectedUnitId(null)}
        />
      )}
    </div>

    {/* Hoja A4 de impresión: oculta en pantalla, única cosa visible al imprimir. */}
    {!loading && <PlanoImpresion units={units} selectedDate={selectedDate} />}

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
        .overflow-auto::-webkit-scrollbar { width: 8px; height: 8px; }
        .overflow-auto::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        .overflow-auto::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .overflow-auto::-webkit-scrollbar-thumb:hover { background: #FDE047; }
      `}</style>
    </div>
  )
}
