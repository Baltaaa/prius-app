import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../../lib/supabase"
import { hoyAR } from "../../lib/fechas"
import MarcoPlanoClaro from "../../components/plano/MarcoPlanoClaro"
import PlanoClaro from "../../components/plano/PlanoClaro"
import CeldaClara from "../../components/plano/CeldaClara"

/**
 * Fase 6A.1 (nov 2026) — vista previa interna del marco del flujo de reserva
 * de la landing: MarcoPlanoClaro con todas las props que usa beachFlow en los
 * 6 pasos (barra del paso, pie fijo por portal, cuerpo libre con scroll,
 * fechas y personas en el header, refrescar, chips deshabilitados, aviso y la
 * API del mapa). Herramienta de desarrollo, mismo permiso que
 * /app/dev/plano-publico (solo superadmin). No reserva nada: solo lee
 * disponibilidad_publica() y marca la elección en pantalla.
 *
 * "El primer toque acerca" vive ACÁ, afuera de src/components/plano, como en
 * la landing: si la celda tocada se ve más chica que el mínimo táctil, se
 * acerca en ese punto (mapaRef.acercarEn) en vez de elegirla.
 */
const TOTAL_PASOS = 6
const TITULOS = { 1: "Tipo", 2: "Fechas y personas", 3: "Elegí tu lugar", 4: "Tus datos", 5: "Confirmar", 6: "Listo" }
const MINIMO_TACTIL = 44
const ALTO_CELDA = { amplia: 20, compacta: 36 } // alto de CeldaClara a escala 1 (compacta md / tactil)

function useAmplia() {
  const consulta = "(min-width: 768px)"
  const [amplia, setAmplia] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const cambio = () => setAmplia(mq.matches)
    mq.addEventListener("change", cambio)
    return () => mq.removeEventListener("change", cambio)
  }, [])
  return amplia
}

const PILL = "h-10 px-4 shrink-0 rounded-full bg-surface text-label text-ink flex items-center"

export default function MarcoReservaPreview() {
  const amplia = useAmplia()
  const [paso, setPaso] = useState(3)
  const [tipo, setTipo] = useState(null)
  const [rotado, setRotado] = useState(false)
  const [personas, setPersonas] = useState(2)
  const [unidades, setUnidades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [lecturas, setLecturas] = useState(0)
  const [elegida, setElegida] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [zoom, setZoom] = useState(null)
  const [nodoPie, setNodoPie] = useState(null)
  const mapa = useRef(null)
  const fecha = hoyAR()

  const leer = useCallback(async () => {
    const { data, error } = await supabase.rpc("disponibilidad_publica", { p_desde: fecha, p_hasta: fecha })
    if (!error) setUnidades((data || []).map((u) => ({ ...u, id: u.unidad_id })))
    setLecturas((n) => n + 1)
  }, [fecha])

  useEffect(() => {
    let vivo = true
    leer().finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [leer])

  const refrescar = async () => {
    setRefrescando(true)
    await leer()
    setRefrescando(false)
  }

  const mostrarAviso = (texto) => {
    setAviso(texto)
    setTimeout(() => setAviso(null), 1800)
  }

  const tocar = (slot, evento) => {
    const estado = mapa.current?.estado()
    const alto = ALTO_CELDA[amplia ? "amplia" : "compacta"] * (estado?.escala ?? 1)
    if (alto < MINIMO_TACTIL && evento) {
      mapa.current.acercarEn(evento.clientX, evento.clientY)
      mostrarAviso("Tocá de nuevo para elegir")
      return
    }
    setElegida((actual) => (actual === slot.unidad_id ? null : slot.unidad_id))
  }

  const coincide = (slot) => !tipo || (tipo === "carpas" ? slot.tipo === "carpa" : slot.tipo === "sombrilla")

  const renderCelda = (slot) => {
    const libre = slot.unidad_id && !slot.bloqueada
    return (
      <CeldaClara
        key={`${slot.tipo}-${slot.numero}`}
        numero={slot.numero}
        numberSide={slot.numberSide}
        tamano={amplia ? "compacta" : "tactil"}
        estado={!libre ? "ocupada" : slot.unidad_id === elegida ? "elegida" : "libre"}
        deshabilitada={!!tipo && !coincide(slot)}
        resaltada={!!tipo && coincide(slot)}
        onClick={(_, evento) => tocar(slot, evento)}
        etiqueta={`${slot.tipo === "carpa" ? "Carpa" : "Sombrilla"} ${slot.numero}`}
        data-celda={`${slot.tipo}-${slot.numero}`}
      />
    )
  }

  const botones = (
    <div className="w-full flex items-center justify-between gap-3">
      <button type="button" className="btn btn-secondary h-11" disabled={paso === 1} onClick={() => setPaso((p) => p - 1)}>Volver</button>
      <button type="button" className="btn btn-primary h-11" disabled={paso === TOTAL_PASOS} onClick={() => setPaso((p) => p + 1)}>Siguiente</button>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-overlay flex items-center justify-center">
      <div data-hoja-marco className="bg-card w-full h-dvh md:w-[90vw] md:h-[88dvh] md:rounded-card overflow-hidden flex flex-col p-4 sm:p-6">
        <MarcoPlanoClaro
          variante={amplia ? "amplia" : "compacta"}
          logo={<img src="/images/prius-icon.png" alt="Prius" className="w-11 h-11 object-contain shrink-0" />}
          selectorFecha={<span data-slot-fecha className={PILL}>{fecha}</span>}
          selectorPersonas={(
            <button type="button" data-slot-personas className={PILL} onClick={() => setPersonas((n) => n + 1)}>
              {personas} personas
            </button>
          )}
          tipo={tipo}
          onTipo={setTipo}
          chipsDeshabilitados={paso !== 3}
          onCerrar={amplia ? () => window.history.back() : undefined}
          tituloCerrar="Cerrar"
          onRefrescar={refrescar}
          refrescando={refrescando}
          barra={(
            <div data-barra-paso className="shrink-0 px-1 text-label text-ink-2">
              Paso {paso} de {TOTAL_PASOS} · <span className="text-ink">{TITULOS[paso]}</span>
              <span data-lecturas={lecturas} data-escala={zoom ? zoom.escala.toFixed(3) : ""} data-encuadre={zoom ? zoom.escalaEncuadre.toFixed(3) : ""} />
            </div>
          )}
          cuerpo={paso === 3 ? "mapa" : "libre"}
          claseCuerpo="border border-line"
          leyenda={(
            <span data-leyenda className="flex items-center gap-3 text-label text-ink-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border border-line bg-card" />Libre</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-ink" />Ocupada</span>
            </span>
          )}
          aviso={aviso && (
            <div role="status" className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-ink text-on-ink text-label rounded-full px-4 py-2">
              {aviso}
            </div>
          )}
          pieRef={setNodoPie}
          rotado={rotado}
          onRotar={() => setRotado((v) => !v)}
          cargando={cargando}
          mapaRef={mapa}
          onCambioZoom={setZoom}
          resetKey={tipo ?? ""}
        >
          {paso === 3 ? (
            <PlanoClaro unidades={unidades} renderCelda={renderCelda} rotado={rotado} />
          ) : (
            <div data-contenido-libre className="max-w-[640px] mx-auto p-6 flex flex-col gap-3">
              {Array.from({ length: 40 }, (_, i) => (
                <p key={i} className="text-body text-ink">Paso {paso} · renglón {i + 1}</p>
              ))}
            </div>
          )}
        </MarcoPlanoClaro>
        {nodoPie && createPortal(botones, nodoPie)}
      </div>
    </div>,
    document.body,
  )
}
