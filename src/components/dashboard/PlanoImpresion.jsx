import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CARPAS_LAYOUT, SOMBRILLAS_LAYOUT, PLANO_PASILLO_CENTRAL } from "../plano/planoLayout"
import { STATUS } from "./constants"
import { formatFechaCorta } from "../../lib/format"

// Hoja A4 de 1 sola hoja para los carperos — replica exacta del plano en
// papel (Plano General Temporada 25-26). Corrección de clipping (oct 2026):
// el componente vivía DENTRO del árbol del dashboard (Viewport con zoom/
// transform, contenedores con overflow:hidden) y Chrome recortaba ~1/4 de
// la hoja en la vista previa real, aunque medido "a mano" en pantalla
// pareciera entrar. Ahora se renderiza por `createPortal` directo a
// `document.body`, en `#print-root`, totalmente fuera del layout del
// dashboard — nada de lo que le pase al layout de pantalla puede volver a
// recortarlo.
//
// Única fuente de la disposición de unidades: `planoLayout.js` (la misma
// que usa PlanoGrid.jsx en pantalla) — de ahí solo se toma QUÉ unidad va en
// qué columna/fila/lado, nunca tamaños (los px de pantalla no aplican acá,
// todo en mm). Si el layout real cambia, cambia en un solo lugar.

const PREFIJO = { carpa: "C", sombrilla: "S" }
const codigo = (tipo, numero) => `${PREFIJO[tipo]}.${numero}`

// --- Geometría (mm/pt), Arreglo 2 ------------------------------------------
const NUM_W_MM = 5.5
const BOX_W_MM = 7
const BOX_H_MM = 5.2
const ROW_H_MM = 5.6
const BORDE_MM = 0.3
const NUM_PT = 8.5
const LETRA_PT = 7.5
const SOMBRILLA_BLOQUE_MAX_MM = 90

function tituloTemporada(fechaISO) {
  if (!fechaISO) return "PLANO GENERAL"
  const [y, m] = fechaISO.split("-").map(Number)
  const inicio = m >= 7 ? y : y - 1
  const fin = inicio + 1
  return `PLANO GENERAL TEMPORADA ${String(inicio).slice(2)}-${String(fin).slice(2)}`
}

function pctTexto(pct) {
  return `${Math.round((pct || 0) * 100)}%`
}

// Color de fondo + color de texto explícitos por estado (nunca derivados de
// "si el fondo es blanco" — ese cálculo dejaba la T invisible). Período y
// día (oct 2026): mismo relleno negro, pero con su letra en blanco — antes
// salían negras lisas e indistinguibles entre sí. Bloqueada/fuera de
// servicio (X) no se implementa: no existe esa columna en `unidades`
// (`reservas.bloqueada` es otra cosa).
const CASILLA = {
  [STATUS.LIBRE]: { bg: "#fff", color: "#000", texto: "" },
  [STATUS.TEMPORADA]: { bg: "#c8c8c8", color: "#000", texto: "T" },
  [STATUS.PERIODO]: { bg: "#000", color: "#fff", texto: "P" },
  [STATUS.DIA]: { bg: "#000", color: "#fff", texto: "D" },
  [STATUS.PENDIENTE_CONFIRMACION]: { bg: "#fff", color: "#000", texto: "R" },
}
function casillaDe(u) {
  return CASILLA[u?.status] || CASILLA[STATUS.LIBRE]
}

// --- Deriva la grilla de columnas de carpas desde planoLayout.js ----------
// Mismo algoritmo que antes (agrupación/lado/desfase 100% derivados de
// CARPAS_LAYOUT, nunca un número de carpa escrito acá) — solo cambian las
// medidas de cada track (mm fijos de ARREGLO 2, no los px de pantalla).
function buildCarpasGrid() {
  const lados = []
  for (const item of CARPAS_LAYOUT) {
    if (item.tipo === "pasillo") continue
    lados.push(...(item.tipo === "hilera" ? [item] : item.lados))
  }
  const maxRows = Math.max(...lados.map((l) => l.rango[1] - l.rango[0] + 1))

  const tracks = []
  let centralStart = null
  let centralEnd = null
  let offsetRowStart = 2

  for (const item of CARPAS_LAYOUT) {
    if (item.tipo === "pasillo") {
      const esCentral = item.ancho === PLANO_PASILLO_CENTRAL
      if (esCentral) centralStart = tracks.length + 1
      tracks.push({ kind: "pasillo", frPeso: esCentral ? 2 : 1 })
      if (esCentral) centralEnd = tracks.length
      continue
    }
    const hileras = item.tipo === "hilera" ? [item] : item.lados
    for (const lado of hileras) {
      const count = lado.rango[1] - lado.rango[0] + 1
      const rowStart = 2 + (maxRows - count)
      offsetRowStart = Math.max(offsetRowStart, rowStart)
      const numTrack = { kind: "num", lado, rowStart, count }
      const boxTrack = { kind: "box", lado, rowStart, count }
      if (lado.numberSide === "right") tracks.push(boxTrack, numTrack)
      else tracks.push(numTrack, boxTrack)
    }
  }

  const gridTemplateColumns = tracks
    .map((t) => (t.kind === "pasillo" ? `${t.frPeso}fr` : t.kind === "num" ? `${NUM_W_MM}mm` : `${BOX_W_MM}mm`))
    .join(" ")

  return { tracks, gridTemplateColumns, totalTracks: tracks.length, centralStart, centralEnd, offsetRowStart }
}

// Oct 2026: las listas dejaron de ser "todo lo que no es temporada" — ahora
// SOLO alquileres por período o día vigentes en la fecha del plano (libres,
// pendientes de confirmar y temporada ya están resueltos por su propia
// casilla en la grilla, no hace falta repetirlos acá). Formato en una sola
// línea: "C.59 (P) NOMBRE 01/01 AL 15/01" / "C.61 (D) NOMBRE 13/10".
function buildListado(units) {
  const toTexto = (u) => {
    const cod = codigo(u.type, u.number)
    const letra = u.status === STATUS.DIA ? "D" : "P"
    const nombres = [u.clientName, ...(u.coSocios || [])].filter(Boolean).join(" / ").toUpperCase()
    const fechas = u.tipoAlquiler === "dia"
      ? formatFechaCorta(u.startDate, false)
      : `${formatFechaCorta(u.startDate, false)} AL ${formatFechaCorta(u.endDate, false)}`
    const obs = (u.reserva?.observaciones || "").trim()
    return `${cod} (${letra}) ${nombres} ${fechas}${obs ? ` (${obs.toUpperCase()})` : ""}`
  }
  const listable = (u) => u.status === STATUS.PERIODO || u.status === STATUS.DIA
  const porTipo = (tipo) =>
    Object.values(units)
      .filter((u) => u.type === tipo && listable(u))
      .sort((a, b) => a.number - b.number)
      .map((u) => ({ id: u.id, texto: toTexto(u) }))
  return { carpas: porTipo("carpa"), sombrillas: porTipo("sombrilla") }
}

// Bloque de sombrillas (1-20 o 21-40): 4 filas x 5 columnas, número a la
// izquierda de su casilla (mismo lado que usa Cell.jsx por default en
// pantalla — SOMBRILLAS_LAYOUT no trae numberSide propio).
//
// Ancho: el span real bajo Recreación/Piscina (columna 1 a 2 del plano de
// carpas) mide lo que mida según el template fijo de ARREGLO 2 — no
// necesariamente 90mm (medido: ~66mm). "Máximo 90mm" es un techo, no un
// ancho fijo: `width:100%` + `max-width:90mm` toma el menor de los dos. El
// gap entre celdas lo reparte el propio flex (`justify-content:space-
// between`), nunca un mm calculado a mano — así nunca se puede pasar del
// ancho real disponible, sea cual sea.
function SombrillasBloque({ filas, bloqueIdx, units }) {
  return (
    <div className="pi-somb-sub" style={{ maxWidth: `${SOMBRILLA_BLOQUE_MAX_MM}mm` }}>
      {filas.map((filaDef) => {
        const [desde, hasta] = filaDef.columnas[bloqueIdx]
        return (
          <div key={filaDef.fila} className="pi-somb-fila">
            {Array.from({ length: hasta - desde + 1 }, (_, i) => {
              const numero = desde + i
              const st = casillaDe(units[`${PREFIJO.sombrilla}${numero}`])
              return (
                <div key={numero} className="pi-somb-celda">
                  <span className="pi-somb-num" style={{ width: `${NUM_W_MM}mm` }}>{numero}</span>
                  <span className="pi-somb-box" style={{ background: st.bg, color: st.color }}>{st.texto}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// Arreglo 3 — red de seguridad: mide el contenido real de #print-root
// contra el área útil (190x277mm, expresada en los mismos px que use el
// motor de impresión) justo antes de imprimir, y si no entra aplica un
// `zoom` (nunca `transform: scale`, que no libera espacio de layout y
// Chrome igual recorta) al contenedor completo. Logueado en consola.
function useAjusteImpresion(printRootRef, printContentRef) {
  const zoomRef = useRef(1)

  useEffect(() => {
    const aplicar = () => {
      const root = printRootRef.current
      const content = printContentRef.current
      if (!root || !content) return
      root.style.zoom = ""
      // Fuerza reflow antes de medir "real" sin el zoom todavía aplicado.
      void content.offsetHeight

      const anchoUtilPx = root.clientWidth // = 190mm en px (padding 10mm, box-sizing:border-box, width:210mm)
      const pxPorMm = anchoUtilPx / 190
      const altoUtilPx = pxPorMm * 277

      const anchoRealPx = content.scrollWidth
      const altoRealPx = content.scrollHeight

      const factor = Math.min(1, anchoUtilPx / anchoRealPx, altoUtilPx / altoRealPx)
      zoomRef.current = factor
      if (factor < 1) {
        root.style.zoom = factor
        console.warn(`[PlanoImpresion] El contenido no entra en 1 hoja a tamaño real — zoom aplicado: ${factor.toFixed(3)} (ancho: ${anchoRealPx.toFixed(0)}px / ${anchoUtilPx.toFixed(0)}px útiles, alto: ${altoRealPx.toFixed(0)}px / ${altoUtilPx.toFixed(0)}px útiles).`)
      } else {
        console.info("[PlanoImpresion] Entra en 1 hoja a tamaño real — zoom: 1.")
      }
    }
    const resetear = () => {
      if (printRootRef.current) printRootRef.current.style.zoom = ""
    }
    window.addEventListener("beforeprint", aplicar)
    window.addEventListener("afterprint", resetear)
    return () => {
      window.removeEventListener("beforeprint", aplicar)
      window.removeEventListener("afterprint", resetear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// Ítems en una sola línea (`white-space:nowrap`) a 7.5pt por default — si
// alguno no entra en su subcolumna (nombre largo en la carpas a 2
// columnas), baja a 7pt, nunca corta ni parte el ítem. Igual que el ajuste
// de hoja (ARREGLO 3, intocado), se mide recién en `beforeprint` — en
// pantalla `#print-root` está en `display:none` y no tiene layout real
// todavía para medir.
function useFontListado(contenedorRef) {
  const [fontPt, setFontPt] = useState(7.5)
  useEffect(() => {
    const medir = () => {
      const el = contenedorRef.current
      if (!el) return
      setFontPt(7.5)
      requestAnimationFrame(() => {
        const items = el.querySelectorAll(".pi-listado-item")
        const desborda = [...items].some((it) => it.scrollWidth > it.clientWidth + 0.5)
        if (desborda) setFontPt(7)
      })
    }
    window.addEventListener("beforeprint", medir)
    return () => window.removeEventListener("beforeprint", medir)
  }, [contenedorRef])
  return fontPt
}

export default function PlanoImpresion({ units, selectedDate, stats }) {
  const u = units || {}
  const lista = Object.values(u)
  const contar = (st) => lista.filter((x) => x.status === st).length
  const nTemporada = contar(STATUS.TEMPORADA)
  const nPeriodo = contar(STATUS.PERIODO)
  const nDia = contar(STATUS.DIA)
  const nPendConf = contar(STATUS.PENDIENTE_CONFIRMACION)
  const { carpas: listadoCarpas, sombrillas: listadoSombrillas } = buildListado(u)

  const { tracks, gridTemplateColumns, totalTracks, centralStart, centralEnd, offsetRowStart } = buildCarpasGrid()
  const gridTemplateRows = `auto repeat(25, ${ROW_H_MM}mm)`

  const printRootRef = useRef(null)
  const printContentRef = useRef(null)
  useAjusteImpresion(printRootRef, printContentRef)

  const listadoCarpasRef = useRef(null)
  const listaFontPt = useFontListado(listadoCarpasRef)

  return createPortal(
    <div id="print-root" ref={printRootRef}>
      <style>{`
        #print-root { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            margin: 0 !important; padding: 0 !important;
            width: 210mm !important; height: 297mm !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body > *:not(#print-root) { display: none !important; }

          #print-root, #print-root * { box-sizing: border-box; }
          #print-root {
            display: block !important;
            position: static;
            width: 210mm; height: 297mm;
            padding: 10mm;
            overflow: visible;
            transform: none;
            background: #fff; color: #000;
            font-family: inherit;
            print-color-adjust: exact; -webkit-print-color-adjust: exact;
          }
          #print-root * { color: #000; box-shadow: none !important; overflow: visible; max-height: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }

          .pi-content { width: 190mm; }

          .pi-titulo-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; }
          .pi-titulo { grid-column: 2; text-align: center; font-size: 12pt; font-weight: 800; letter-spacing: 0.06em; }
          .pi-fecha { grid-column: 3; justify-self: end; font-size: 20pt; font-weight: 800; line-height: 1; }
          .pi-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.5mm 3.5mm; font-size: 7pt; font-weight: 600; margin-top: 1.5mm; }
          .pi-stats span::after { content: "·"; margin-left: 3.5mm; font-weight: 400; color: #666; }
          .pi-stats span:last-child::after { content: ""; }

          .pi-plano { display: grid; margin: 3mm 0; }
          .pi-head-bar { border: ${BORDE_MM}mm solid #000; display: flex; align-items: center; justify-content: center; font-size: 6.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.8mm 0; }
          .pi-piscina-rect { background: #595959 !important; color: #fff !important; font-size: 6.5pt; font-weight: 800; letter-spacing: 0.08em; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }

          .pi-num { display: flex; align-items: center; justify-content: center; font-size: ${NUM_PT}pt; font-weight: 800; }
          .pi-box { width: ${BOX_W_MM}mm; height: ${BOX_H_MM}mm; align-self: center; border: ${BORDE_MM}mm solid #000; display: flex; align-items: center; justify-content: center; font-size: ${LETRA_PT}pt; font-weight: 800; line-height: 1; }

          .pi-sombrillas-title { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; text-align: center; margin: 3mm 0 2mm; }
          .pi-sombrillas-outer { display: grid; margin-bottom: 3mm; }
          .pi-sombrillas-bloque { display: flex; align-items: center; justify-content: center; width: 100%; }
          .pi-somb-sub { display: flex; flex-direction: column; gap: 0; width: 100%; margin: 0 auto; }
          .pi-somb-fila { display: flex; justify-content: space-between; width: 100%; }
          .pi-somb-celda { display: flex; align-items: center; gap: 0.5mm; height: ${ROW_H_MM}mm; flex: 0 0 auto; }
          .pi-somb-num { font-size: ${NUM_PT}pt; font-weight: 800; text-align: center; }
          .pi-somb-box { width: ${BOX_W_MM}mm; height: ${BOX_H_MM}mm; border: ${BORDE_MM}mm solid #000; display: flex; align-items: center; justify-content: center; font-size: ${LETRA_PT}pt; font-weight: 800; line-height: 1; }

          .pi-mar { background: #595959 !important; color: #fff !important; text-align: center; font-size: 7.5pt; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; padding: 1.3mm 0; margin-bottom: 1.5mm; }
          .pi-leyenda { text-align: center; font-size: 6.5pt; margin-bottom: 2mm; }
          .pi-leyenda-box { display: inline-flex; align-items: center; justify-content: center; width: 3mm; height: 3mm; background: #000 !important; color: #fff !important; font-weight: 800; font-size: 6pt; vertical-align: -0.5mm; margin: 0 0.3mm; }

          .pi-listado-outer { display: flex; flex: 1; gap: 4mm; align-items: flex-start; }
          .pi-listado-carpas-wrap { flex: 3; min-width: 0; }
          .pi-listado-sombrillas-wrap { flex: 1; min-width: 0; }
          .pi-listado-titulo { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; margin-bottom: 1mm; }
          .pi-listado-cols { font-size: 7.5pt; }
          .pi-listado-item { line-height: 1.3; break-inside: avoid; white-space: nowrap; margin-bottom: 0.5mm; }
          .pi-listado-vacio { font-size: 7.5pt; color: #888 !important; }
        }
      `}</style>

      <div className="pi-content" ref={printContentRef}>
        <div className="pi-titulo-row">
          <span />
          <span className="pi-titulo">{tituloTemporada(selectedDate)}</span>
          <span className="pi-fecha">{formatFechaCorta(selectedDate)}</span>
        </div>
        {stats && (
          <div className="pi-stats">
            <span>Ocupación {pctTexto(stats.ocupacion.pct)} ({stats.ocupacion.count}/{stats.ocupacion.total})</span>
            <span>Carpas {pctTexto(stats.carpas.pct)}</span>
            <span>Sombrillas {pctTexto(stats.sombrillas.pct)}</span>
            <span>T {nTemporada} · P {nPeriodo} · D {nDia}</span>
            <span>Pendientes de confirmar {nPendConf}</span>
            <span>Libres {stats.libres.count}</span>
          </div>
        )}

        <div className="pi-plano" style={{ gridTemplateColumns, gridTemplateRows }}>
          <div className="pi-head-bar" style={{ gridColumn: `1 / ${centralStart}`, gridRow: 1 }}>Recreación</div>
          <div className="pi-head-bar" style={{ gridColumn: `${centralStart} / ${centralEnd + 1}`, gridRow: 1 }}>Acceso</div>
          <div className="pi-piscina-rect" style={{ gridColumn: `${centralEnd + 1} / ${totalTracks + 1}`, gridRow: `1 / ${offsetRowStart}` }}>Piscina</div>

          {tracks.map((t, trackIdx) => {
            if (t.kind === "pasillo") return null
            const col = trackIdx + 1
            return Array.from({ length: t.count }, (_, i) => {
              const numero = t.lado.rango[0] + i
              const row = t.rowStart + i
              if (t.kind === "num") {
                return <div key={`n-${col}-${numero}`} className="pi-num" style={{ gridColumn: col, gridRow: row }}>{numero}</div>
              }
              const st = casillaDe(u[`${PREFIJO.carpa}${numero}`])
              return (
                <div key={`b-${col}-${numero}`} className="pi-box" style={{ gridColumn: col, gridRow: row, background: st.bg, color: st.color }}>
                  {st.texto}
                </div>
              )
            })
          })}
        </div>

        <div className="pi-sombrillas-title">Sector Sombrillas</div>
        <div className="pi-sombrillas-outer" style={{ gridTemplateColumns }}>
          <div className="pi-sombrillas-bloque" style={{ gridColumn: `1 / ${centralStart}` }}>
            <SombrillasBloque filas={SOMBRILLAS_LAYOUT.filas} bloqueIdx={0} units={u} />
          </div>
          <div className="pi-sombrillas-bloque" style={{ gridColumn: `${centralEnd + 1} / ${totalTracks + 1}` }}>
            <SombrillasBloque filas={SOMBRILLAS_LAYOUT.filas} bloqueIdx={1} units={u} />
          </div>
        </div>

        <div className="pi-mar">Mar</div>
        <div className="pi-leyenda">
          T Temporada · <span className="pi-leyenda-box">P</span> Período · <span className="pi-leyenda-box">D</span> Día · R Reservada sin confirmar · □ Libre
        </div>

        <div className="pi-listado-outer">
          <div className="pi-listado-carpas-wrap">
            <div className="pi-listado-titulo">Carpas</div>
            {listadoCarpas.length === 0 ? (
              <div className="pi-listado-vacio">Sin alquileres por período o día</div>
            ) : (
              <div ref={listadoCarpasRef} className="pi-listado-cols" style={{ columnCount: 2, columnGap: "4mm", fontSize: `${listaFontPt}pt` }}>
                {listadoCarpas.map((item) => (
                  <div key={item.id} className="pi-listado-item">{item.texto}</div>
                ))}
              </div>
            )}
          </div>
          <div className="pi-listado-sombrillas-wrap">
            <div className="pi-listado-titulo">Sombrillas</div>
            {listadoSombrillas.length === 0 ? (
              <div className="pi-listado-vacio">Sin alquileres por período o día</div>
            ) : (
              <div className="pi-listado-cols" style={{ columnCount: 1, fontSize: `${listaFontPt}pt` }}>
                {listadoSombrillas.map((item) => (
                  <div key={item.id} className="pi-listado-item">{item.texto}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
