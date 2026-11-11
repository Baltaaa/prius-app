import { createPortal } from 'react-dom'
import { formatFechaHora, formatMontoReal } from '../../lib/format'

// Hoja A4 del Directorio de Clientes (nov 2026) — mismo mecanismo que
// PlanoImpresion.jsx: portal a un root propio y `body > *:not(#...)` oculto al
// imprimir, así no sale nada de la UI de la app (sidebar, topbar, botones ni
// el panel de detalle).
//
// Paginado A MANO, no por el flujo del navegador: cada hoja es un div de
// 277mm (A4 menos los 10mm de margen) con su propio <thead>, así los títulos
// se repiten en todas, ninguna fila se corta entre hojas y el pie puede decir
// "Página X de Y" (los contadores de página de CSS no andan en Chrome).
// Para que el alto de cada fila sea exacto y el corte no se corra, TODA celda
// es de una sola línea (nowrap + ellipsis) con ancho fijo.
//
// `filas` ya viene armada por Clientes.jsx con el filtro y la búsqueda
// activos: acá no se filtra ni se ordena nada. Los saldos llegan como número
// y se formatean acá con `formatMontoReal`: una impresión sale siempre con los
// montos reales, aunque el modo privacidad esté activo.

const ALTO_FILA_MM = 5.4
const FILAS_PRIMERA = 42
const FILAS_RESTO = 46

// Suman exactamente los 190mm útiles (210 − 2×10 de margen). Medidos contra el
// contenido real: el teléfono entra completo ("+54 9 223 595-1234") y "Sin
// confirmar" no se corta.
const COLUMNAS = [
  { key: 'n', label: 'N°', mm: 8, align: 'right' },
  { key: 'cliente', label: 'Cliente', mm: 43 },
  { key: 'documento', label: 'DNI / CUIT', mm: 22 },
  { key: 'telefono', label: 'Teléfono', mm: 32 },
  { key: 'unidades', label: 'Unidades', mm: 23 },
  { key: 'tipo', label: 'Tipo de alquiler', mm: 19 },
  { key: 'estado', label: 'Estado', mm: 21 },
  { key: 'saldo', label: 'Saldo pendiente', mm: 22, align: 'right' },
]

function repartirEnHojas(filas) {
  const hojas = []
  let i = 0
  while (i < filas.length) {
    const cupo = hojas.length === 0 ? FILAS_PRIMERA : FILAS_RESTO
    hojas.push(filas.slice(i, i + cupo))
    i += cupo
  }
  return hojas.length ? hojas : [[]]
}

const Encabezado = () => (
  <thead>
    <tr>
      {COLUMNAS.map((c) => (
        <th key={c.key} style={{ width: `${c.mm}mm`, textAlign: c.align || 'left' }}>{c.label}</th>
      ))}
    </tr>
  </thead>
)

export default function ClientesImpresion({ filas, filtroTexto, busqueda, totalSaldo }) {
  const hojas = repartirEnHojas(filas)
  const impresoEl = formatFechaHora(new Date())

  return createPortal(
    <div id="print-clientes-root">
      <style>{`
        #print-clientes-root { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body > *:not(#print-clientes-root) { display: none !important; }

          #print-clientes-root, #print-clientes-root * { box-sizing: border-box; }
          #print-clientes-root {
            display: block !important;
            background: #fff; color: #000;
            font-family: inherit;
            print-color-adjust: exact; -webkit-print-color-adjust: exact;
          }
          #print-clientes-root * { color: #000 !important; background: transparent !important; box-shadow: none !important; }

          .cl-hoja { width: 190mm; height: 277mm; position: relative; overflow: hidden; break-after: page; page-break-after: always; }
          .cl-hoja:last-child { break-after: auto; page-break-after: auto; }

          .cl-cabecera { border-bottom: 0.5mm solid #000; padding-bottom: 2mm; margin-bottom: 2.5mm; }
          .cl-cabecera h1 { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
          .cl-meta { display: flex; justify-content: space-between; gap: 4mm; font-size: 7.5pt; margin-top: 1.2mm; }
          .cl-meta span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .cl-tabla { width: 190mm; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }
          /* El título puede ir en dos líneas ("TIPO DE / ALQUILER"): es una sola
             fila por hoja y así ningún rótulo se pisa ni se corta. */
          .cl-tabla th {
            font-size: 6.5pt; font-weight: 800; text-transform: uppercase;
            text-align: left; padding: 0 1mm 0.8mm; border-bottom: 0.35mm solid #000;
            white-space: normal; line-height: 1.15; vertical-align: bottom;
          }
          .cl-tabla td {
            height: ${ALTO_FILA_MM}mm; padding: 0 1mm; line-height: ${ALTO_FILA_MM}mm;
            border-bottom: 0.1mm solid #bbb;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .cl-tabla tr { break-inside: avoid; page-break-inside: avoid; }
          .cl-num { font-variant-numeric: tabular-nums; }
          /* Mismos emojis que la app (lib/unidadIcono.js), en gris: la hoja es B/N. */
          .cl-unidades { filter: grayscale(1); }
          .cl-cliente { font-weight: 600; }

          .cl-totales { margin-top: 1.5mm; padding-top: 1.2mm; border-top: 0.35mm solid #000; font-size: 8pt; font-weight: 700; display: flex; justify-content: space-between; }
          .cl-pie { position: absolute; bottom: 0; left: 0; right: 0; font-size: 7pt; text-align: right; }
        }
      `}</style>

      {hojas.map((filasHoja, idx) => (
        <div className="cl-hoja" key={idx}>
          {idx === 0 && (
            <div className="cl-cabecera">
              <h1>Prius Playa Grande — Listado de clientes</h1>
              <div className="cl-meta">
                <span>{filtroTexto}{busqueda ? ` · Búsqueda: "${busqueda}"` : ''}</span>
                <span>{filas.length} cliente{filas.length === 1 ? '' : 's'}</span>
                <span>Impreso {impresoEl}</span>
              </div>
            </div>
          )}

          <table className="cl-tabla">
            <Encabezado />
            <tbody>
              {filasHoja.map((f) => (
                <tr key={f.id}>
                  <td className="cl-num" style={{ textAlign: 'right' }}>{f.n}</td>
                  <td className="cl-cliente">{f.cliente}</td>
                  <td className="cl-num">{f.documento}</td>
                  <td className="cl-num">{f.telefono}</td>
                  <td className="cl-unidades">{f.unidades}</td>
                  <td>{f.tipo}</td>
                  <td>{f.estado}</td>
                  <td className="cl-num" style={{ textAlign: 'right' }}>
                    {f.saldoNota || (f.saldo > 0 ? formatMontoReal(f.saldo) : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {idx === hojas.length - 1 && (
            <div className="cl-totales">
              <span>Total: {filas.length} cliente{filas.length === 1 ? '' : 's'}</span>
              <span>Saldo pendiente total: {formatMontoReal(totalSaldo)}</span>
            </div>
          )}

          <div className="cl-pie">Página {idx + 1} de {hojas.length}</div>
        </div>
      ))}
    </div>,
    document.body,
  )
}
