import {
  PLANO_COL_WIDTH,
  PLANO_PASILLO_LATERAL,
  PLANO_PASILLO_CENTRAL,
  PLANO_BLOQUE_GAP,
} from "./constants"
import { formatFechaCorta } from "../../lib/format"

// Hoja A4 diaria para los carperos — reemplaza la planilla Excel que se
// llevaba a la playa. Es de SOLO LECTURA: lee `units` (ya armado por
// Dashboard.jsx a partir de reservas/unidades, mismo dato que pinta el
// plano en pantalla) y no dispara ningún write ni suscripción propia.
//
// Oculta en pantalla (`display:none` fuera de @media print), es lo único
// visible al imprimir — Dashboard.jsx oculta el resto de la app con la
// clase `.no-print` (sidebar, topbar, toolbar, modales).
//
// El layout geométrico (hileras, pasillos, bloques espalda-con-espalda) es
// el mismo que el plano en pantalla, pero expresado como columnas `fr` de
// un CSS Grid en vez de anchos en píxeles — así el plano impreso escala solo
// al ancho útil de la hoja sin perder las proporciones de PLANO_* (constants.js,
// única fuente de esos anchos).

const PREFIJO = { carpa: "C", sombrilla: "S" }
const LETRA = { temporada: "T", periodo: "P", dia: "D" }

const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i)

function formatFechaLarga(fecha) {
  if (!fecha) return ""
  const [y, m, d] = fecha.split("-")
  return `${d}/${m}/${y}`
}

function PIRow({ number, letter, side }) {
  return (
    <div className="pi-cellrow" style={{ flexDirection: side === "right" ? "row-reverse" : "row" }}>
      <span className="pi-num">{number}</span>
      <span className="pi-box">{letter}</span>
    </div>
  )
}

function PICol({ nums, side, letterFn }) {
  return (
    <div className="pi-col" style={{ alignItems: side === "right" ? "flex-end" : "flex-start" }}>
      {nums.map((n) => (
        <PIRow key={n} number={n} letter={letterFn(n)} side={side} />
      ))}
    </div>
  )
}

function buildListado(units) {
  const toTexto = (u) => {
    const codigo = `${PREFIJO[u.type]}.${String(u.number).padStart(2, "0")}`
    const nombres = [u.clientName, ...(u.coSocios || [])].filter(Boolean).join(" / ")
    const fechas =
      u.tipoAlquiler === "dia"
        ? formatFechaCorta(u.startDate, true)
        : `del ${formatFechaCorta(u.startDate, false)} al ${formatFechaCorta(u.endDate, true)}`
    return `${codigo} ${nombres} ${fechas}`
  }

  const activos = Object.values(units).filter((u) => u.tipoAlquiler === "periodo" || u.tipoAlquiler === "dia")
  const porTipo = (tipo) =>
    activos
      .filter((u) => u.type === tipo)
      .sort((a, b) => a.number - b.number)
      .map((u) => ({ id: u.id, texto: toTexto(u) }))

  return { carpas: porTipo("carpa"), sombrillas: porTipo("sombrilla") }
}

export default function PlanoImpresion({ units, selectedDate }) {
  const carpaLetter = (n) => LETRA[units[`C${n}`]?.tipoAlquiler] || ""
  const sombrillaLetter = (n) => LETRA[units[`S${n}`]?.tipoAlquiler] || ""
  const { carpas: listadoCarpas, sombrillas: listadoSombrillas } = buildListado(units)

  const gridTemplateColumns = [
    PLANO_COL_WIDTH, PLANO_PASILLO_LATERAL,
    PLANO_COL_WIDTH, PLANO_BLOQUE_GAP, PLANO_COL_WIDTH,
    PLANO_PASILLO_CENTRAL,
    PLANO_COL_WIDTH, PLANO_BLOQUE_GAP, PLANO_COL_WIDTH,
    PLANO_PASILLO_LATERAL, PLANO_COL_WIDTH,
  ].map((v) => `${v}fr`).join(" ")

  return (
    <div className="plano-impresion">
      <style>{`
        .plano-impresion { display: none; }
        @media print {
          .plano-impresion {
            display: block;
            background: #fff;
            color: #000;
            font-family: inherit;
            page-break-inside: avoid;
          }
          .plano-impresion * { color: #000; box-shadow: none !important; }

          .pi-fecha { font-size: 11pt; font-weight: 700; margin-bottom: 3mm; }

          .pi-header { display: grid; align-items: stretch; margin-bottom: 3mm; height: 8mm; }
          .pi-header > div { border: 0.3mm solid #000; display: flex; align-items: center; justify-content: center; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
          .pi-header .pi-header-recreacion { border-right: none; }
          .pi-header .pi-header-pileta { border-left: none; }

          .pi-plano { display: grid; align-items: end; margin-bottom: 4mm; }
          .pi-col { display: flex; flex-direction: column; gap: 0.35mm; }
          .pi-cellrow { display: flex; align-items: center; gap: 0.4mm; }
          .pi-num { font-size: 4pt; width: 2.8mm; text-align: center; }
          .pi-box { width: 3mm; height: 3mm; border: 0.15mm solid #000; display: flex; align-items: center; justify-content: center; font-size: 4pt; font-weight: 700; line-height: 1; }

          .pi-sombrillas { margin-bottom: 4mm; }
          .pi-sombrillas-title { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; text-align: center; margin-bottom: 1.5mm; }
          .pi-sombrillas-grid { display: flex; justify-content: center; gap: 10mm; }
          .pi-somb-col { display: flex; flex-direction: column; gap: 0.35mm; }
          .pi-somb-row { display: flex; gap: 0.6mm; }

          .pi-oceano { border: 0.3mm solid #000; text-align: center; font-size: 7pt; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; padding: 1.5mm 0; margin-bottom: 3mm; }

          .pi-listado { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; text-align: left; page-break-inside: avoid; }
          .pi-listado-titulo { font-size: 7pt; font-weight: 700; text-transform: uppercase; margin-bottom: 1mm; }
          .pi-listado-item { font-size: 7.5pt; line-height: 1.35; }
          .pi-listado.pi-cols-2 .pi-listado-carpas { column-count: 2; column-gap: 4mm; }
          .pi-listado-carpas, .pi-listado-sombrillas { break-inside: avoid; }
          .pi-listado-item { break-inside: avoid; }
        }
      `}</style>

      <div className="pi-fecha">{formatFechaLarga(selectedDate)}</div>

      <div className="pi-header" style={{ gridTemplateColumns }}>
        <div className="pi-header-recreacion" style={{ gridColumn: "1 / 6" }}>Recreación</div>
        <div className="pi-header-acceso" style={{ gridColumn: "6 / 7" }}>Acceso</div>
        <div className="pi-header-pileta" style={{ gridColumn: "7 / 12" }}>Pileta</div>
      </div>

      <div className="pi-plano" style={{ gridTemplateColumns }}>
        <PICol nums={range(1, 25)} side="left" letterFn={carpaLetter} />
        <div />
        <PICol nums={range(26, 50)} side="left" letterFn={carpaLetter} />
        <div />
        <PICol nums={range(51, 75)} side="right" letterFn={carpaLetter} />
        <div />
        <PICol nums={range(76, 98)} side="left" letterFn={carpaLetter} />
        <div />
        <PICol nums={range(99, 121)} side="right" letterFn={carpaLetter} />
        <div />
        <PICol nums={range(122, 144)} side="right" letterFn={carpaLetter} />
      </div>

      <div className="pi-sombrillas">
        <div className="pi-sombrillas-title">Sector Sombrillas</div>
        <div className="pi-sombrillas-grid">
          {[[1, 6, 11, 16], [21, 26, 31, 36]].map((starts, gi) => (
            <div key={gi} className="pi-somb-col">
              {starts.map((start) => (
                <div key={start} className="pi-somb-row">
                  {[0, 1, 2, 3, 4].map((off) => (
                    <PIRow key={start + off} number={start + off} letter={sombrillaLetter(start + off)} side="left" />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="pi-oceano">Océano Atlántico</div>

      <div className={`pi-listado ${listadoCarpas.length > 18 ? "pi-cols-2" : ""}`}>
        <div className="pi-listado-carpas">
          <div className="pi-listado-titulo">Carpas</div>
          {listadoCarpas.map((item) => (
            <div key={item.id} className="pi-listado-item">{item.texto}</div>
          ))}
        </div>
        <div className="pi-listado-sombrillas">
          <div className="pi-listado-titulo">Sombrillas</div>
          {listadoSombrillas.map((item) => (
            <div key={item.id} className="pi-listado-item">{item.texto}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
