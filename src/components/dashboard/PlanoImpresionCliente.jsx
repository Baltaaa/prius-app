import { CARPAS_LAYOUT, SOMBRILLAS_LAYOUT, PLANO_PASILLO_CENTRAL } from "../plano/planoLayout"
import { STATUS } from "./constants"
import { formatFecha } from "../../lib/format"
import { unidadEmoji } from "../../lib/unidadIcono"

// Plano de disponibilidad para el CLIENTE (nov 2026) — la hoja que se le
// muestra a quien viene a elegir su unidad.
//
// Es OTRA impresión, distinta de la hoja A4 de los carperos
// (PlanoImpresion.jsx, que no se toca): acá solo hay dos estados, Libre y
// Ocupado, para la fecha elegida en el plano. Todo lo que no está libre
// (temporada, período, día, reservada sin confirmar, bonificada) se imprime
// como Ocupado. Sin nombres, sin montos, sin las letras T/P/D: ningún dato
// interno sale de la oficina en esta hoja.
//
// Se imprime en un iframe propio (lib/imprimirDocumento.js) con su <style>
// adentro: nunca se mezcla con el #print-root de la hoja de los carperos ni
// arrastra el tema oscuro de la app — esta hoja siempre sale clara.
//
// Única fuente de la disposición de unidades: `planoLayout.js`, la misma que
// usa el plano en pantalla. De ahí sale QUÉ unidad va en qué columna/fila y
// de qué lado su número; las medidas son propias (mm, no los px de pantalla).

const PREFIJO = { carpa: "C", sombrilla: "S" }

// --- Geometría (mm/pt) -----------------------------------------------------
// Más grande que la hoja de los carperos: esta no lleva el listado al pie, así
// que las casillas y los números pueden ocupar todo el alto disponible.
const NUM_W_MM = 8
const BOX_W_MM = 9
const BOX_H_MM = 7
const ROW_H_MM = 7.8
const BORDE_MM = 0.35
const NUM_PT = 11.5
// El sector de sombrillas vive bajo una columna más angosta que su propio
// ancho natural (5 celdas por bloque), así que tiene su propia geometría:
// medida contra el espacio real que le deja la grilla de carpas, nunca a ojo.
const SOMB_NUM_W_MM = 6
const SOMB_BOX_W_MM = 7.5
const SOMB_BOX_H_MM = 6.2
const SOMB_ROW_H_MM = 7
const SOMB_NUM_PT = 10.5

/** Libre = sin ninguna reserva vigente en la fecha. Todo lo demás: ocupado. */
const estaLibre = (u) => !u || u.status === STATUS.LIBRE

// Misma derivación de la grilla de carpas que la hoja de los carperos: la
// agrupación, el lado del número y el desfase salen de CARPAS_LAYOUT, nunca
// de un número de carpa escrito acá.
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

function Casilla({ libre, somb = false }) {
  return <span className={`pc-box ${somb ? "pc-box-somb " : ""}${libre ? "pc-libre" : "pc-ocupada"}`} />
}

function SombrillasBloque({ filas, bloqueIdx, units }) {
  return (
    <div className="pc-somb-sub">
      {filas.map((filaDef) => {
        const [desde, hasta] = filaDef.columnas[bloqueIdx]
        return (
          <div key={filaDef.fila} className="pc-somb-fila">
            {Array.from({ length: hasta - desde + 1 }, (_, i) => {
              const numero = desde + i
              return (
                <div key={numero} className="pc-somb-celda">
                  <span className="pc-somb-num">{numero}</span>
                  <Casilla somb libre={estaLibre(units[`${PREFIJO.sombrilla}${numero}`])} />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/**
 * `units`: el mapa `{"C19": {...}}` de lib/planoUnits.js para la fecha
 * elegida. `fecha`: la fecha del plano, en ISO.
 */
export default function PlanoImpresionCliente({ units, fecha }) {
  const u = units || {}
  const lista = Object.values(u)
  const libresDe = (tipo) => lista.filter((x) => x.type === tipo && estaLibre(x)).length
  const totalDe = (tipo) => lista.filter((x) => x.type === tipo).length
  const libresCarpas = libresDe("carpa")
  const libresSombrillas = libresDe("sombrilla")

  const { tracks, gridTemplateColumns, totalTracks, centralStart, centralEnd, offsetRowStart } = buildCarpasGrid()
  const gridTemplateRows = `auto repeat(25, ${ROW_H_MM}mm)`

  return (
    <div className="pc-hoja">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .pc-hoja, .pc-hoja * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .pc-hoja {
          width: 210mm; height: 297mm; padding: 10mm;
          background: #fff; color: #000;
          font-family: Manrope, 'Helvetica Neue', Arial, sans-serif;
          display: flex; flex-direction: column;
        }

        .pc-head { display: flex; align-items: center; gap: 4mm; border-bottom: 0.4mm solid #000; padding-bottom: 2.5mm; }
        /* El logo en escala de grises: la hoja entera es blanco y negro. */
        .pc-logo { width: 14mm; height: 14mm; object-fit: contain; filter: grayscale(1); }
        .pc-titulo { font-size: 16pt; font-weight: 800; letter-spacing: -0.01em; line-height: 1.1; }
        .pc-sub { font-size: 9pt; font-weight: 600; color: #333; margin-top: 0.8mm; }
        .pc-conteo { margin-left: auto; text-align: right; font-size: 9pt; font-weight: 700; line-height: 1.5; white-space: nowrap; }
        .pc-conteo-num { font-size: 13pt; font-weight: 800; }
        /* El emoji de la unidad en escala de grises: la hoja es blanco y negro
           (misma regla que el comprobante impreso, ver CLAUDE.md). */
        .pc-emoji { filter: grayscale(1); }

        .pc-plano { display: grid; margin: 4mm 0 0; }
        .pc-zona { border: ${BORDE_MM}mm solid #000; display: flex; align-items: center; justify-content: center; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; padding: 1mm 0; }
        .pc-piscina { background: #D9D9D9; }

        .pc-num { display: flex; align-items: center; justify-content: center; font-size: ${NUM_PT}pt; font-weight: 800; }
        .pc-box { width: ${BOX_W_MM}mm; height: ${BOX_H_MM}mm; align-self: center; border: ${BORDE_MM}mm solid #000; display: block; }
        /* Libre: casilla blanca y limpia. Ocupada: gris con trama diagonal,
           para que se distinga también en una impresora blanco y negro. */
        .pc-libre { background: #fff; }
        .pc-ocupada {
          background-color: #BFBFBF;
          background-image: repeating-linear-gradient(45deg, #000 0, #000 0.3mm, transparent 0.3mm, transparent 1.3mm);
        }

        .pc-somb-titulo { font-size: 8.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; margin: 3mm 0 1.5mm; }
        .pc-sombrillas { display: grid; }
        .pc-sombrillas-bloque { display: flex; align-items: center; justify-content: center; width: 100%; min-width: 0; }
        .pc-somb-sub { display: flex; flex-direction: column; width: 100%; min-width: 0; }
        .pc-somb-fila { display: flex; justify-content: space-between; width: 100%; }
        .pc-somb-celda { display: flex; align-items: center; gap: 0.6mm; height: ${SOMB_ROW_H_MM}mm; flex: 0 0 auto; }
        .pc-box-somb { width: ${SOMB_BOX_W_MM}mm; height: ${SOMB_BOX_H_MM}mm; }
        .pc-somb-num { width: ${SOMB_NUM_W_MM}mm; font-size: ${SOMB_NUM_PT}pt; font-weight: 800; text-align: center; }

        .pc-mar { background: #D9D9D9; text-align: center; font-size: 8pt; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; padding: 1.5mm 0; margin-top: 3mm; border: ${BORDE_MM}mm solid #000; }

        .pc-pie { margin-top: auto; padding-top: 3mm; display: flex; align-items: center; justify-content: center; gap: 10mm; font-size: 9pt; font-weight: 700; }
        .pc-ref { display: flex; align-items: center; gap: 2mm; }
        .pc-ref .pc-box { width: 7mm; height: 5mm; }
      `}</style>

      <header className="pc-head">
        <img className="pc-logo" src={`${window.location.origin}/images/prius-icon.png`} alt="" />
        <div>
          <div className="pc-titulo">Plano de disponibilidad</div>
          <div className="pc-sub">Prius Playa Grande · {formatFecha(fecha)}</div>
        </div>
        <div className="pc-conteo">
          <div><span className="pc-conteo-num">{libresCarpas}</span> de {totalDe("carpa")} <span className="pc-emoji">{unidadEmoji("carpa")}</span> carpas libres</div>
          <div><span className="pc-conteo-num">{libresSombrillas}</span> de {totalDe("sombrilla")} <span className="pc-emoji">{unidadEmoji("sombrilla")}</span> sombrillas libres</div>
        </div>
      </header>

      <div className="pc-plano" style={{ gridTemplateColumns, gridTemplateRows }}>
        <div className="pc-zona" style={{ gridColumn: `1 / ${centralStart}`, gridRow: 1 }}>Recreación</div>
        <div className="pc-zona" style={{ gridColumn: `${centralStart} / ${centralEnd + 1}`, gridRow: 1 }}>Acceso</div>
        <div className="pc-zona pc-piscina" style={{ gridColumn: `${centralEnd + 1} / ${totalTracks + 1}`, gridRow: `1 / ${offsetRowStart}` }}>Pileta</div>

        {tracks.map((t, trackIdx) => {
          if (t.kind === "pasillo") return null
          const col = trackIdx + 1
          return Array.from({ length: t.count }, (_, i) => {
            const numero = t.lado.rango[0] + i
            const row = t.rowStart + i
            if (t.kind === "num") {
              return <div key={`n-${col}-${numero}`} className="pc-num" style={{ gridColumn: col, gridRow: row }}>{numero}</div>
            }
            return (
              <div key={`b-${col}-${numero}`} style={{ gridColumn: col, gridRow: row, display: "flex", alignItems: "center" }}>
                <Casilla libre={estaLibre(u[`${PREFIJO.carpa}${numero}`])} />
              </div>
            )
          })
        })}
      </div>

      <div className="pc-somb-titulo">Sector Sombrillas</div>
      <div className="pc-sombrillas" style={{ gridTemplateColumns }}>
        <div className="pc-sombrillas-bloque" style={{ gridColumn: `1 / ${centralStart}` }}>
          <SombrillasBloque filas={SOMBRILLAS_LAYOUT.filas} bloqueIdx={0} units={u} />
        </div>
        <div className="pc-sombrillas-bloque" style={{ gridColumn: `${centralEnd + 1} / ${totalTracks + 1}` }}>
          <SombrillasBloque filas={SOMBRILLAS_LAYOUT.filas} bloqueIdx={1} units={u} />
        </div>
      </div>

      <div className="pc-mar">Mar</div>

      <footer className="pc-pie">
        <span className="pc-ref"><span className="pc-box pc-libre" /> Libre</span>
        <span className="pc-ref"><span className="pc-box pc-ocupada" /> Ocupado</span>
      </footer>
    </div>
  )
}
