import { formatPesos, formatFecha, formatFechaHora } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL, formatHora } from '../../lib/caja'

// Hoja A4 del resumen de caja (Tarea 5) — mismo patrón que PlanoImpresion.jsx:
// oculta en pantalla, única cosa visible al imprimir (Caja.jsx la envuelve
// en `.no-print` el resto de la UI). Blanco y negro estricto con acento
// dorado mínimo, encabezados de tabla repetidos en cada página.
export default function CajaImpresion({ resumen }) {
  if (!resumen) return null
  const { cabecera, totales, por_medio, arqueo, z, facturas, recibos, sin_comprobante, gastos, anulados } = resumen

  return (
    <div className="caja-impresion">
      <style>{`
        .caja-impresion { display: none; }
        @media print {
          .caja-impresion { display: block; background: #fff; color: #000; font-family: inherit; }
          .caja-impresion * { color: #000; box-shadow: none !important; }
          .ci-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 0.5mm solid #000; padding-bottom: 2mm; margin-bottom: 4mm; }
          .ci-header h1 { font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
          .ci-header .ci-fecha { font-size: 10pt; font-weight: 600; }
          .ci-section { margin-bottom: 4mm; page-break-inside: avoid; }
          .ci-section h2 { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 0.3mm solid #000; padding-bottom: 1mm; margin-bottom: 1.5mm; }
          .ci-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
          .ci-table thead { display: table-header-group; }
          .ci-table th, .ci-table td { text-align: left; padding: 0.8mm 1.5mm; border-bottom: 0.15mm solid #999; }
          .ci-table th { font-weight: 700; text-transform: uppercase; font-size: 7pt; }
          .ci-table td.num, .ci-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
          .ci-totales { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-bottom: 4mm; }
          .ci-totales div { border: 0.3mm solid #000; padding: 2mm; text-align: center; }
          .ci-totales .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; }
          .ci-totales .valor { font-size: 11pt; font-weight: 700; }
          .ci-accent { color: #b8860b !important; }
          .ci-firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 10mm; page-break-inside: avoid; }
          .ci-firmas div { border-top: 0.3mm solid #000; padding-top: 1.5mm; text-align: center; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.1em; }
          .ci-footer { margin-top: 6mm; font-size: 6.5pt; color: #555 !important; text-align: right; }
        }
      `}</style>

      <div className="ci-header">
        <h1>Prius Playa Grande — Caja Diaria</h1>
        <span className="ci-fecha">{formatFecha(cabecera.fecha)} · {cabecera.estado === 'cerrada' ? 'Cerrada' : 'Abierta'}</span>
      </div>

      <div className="ci-totales">
        <div><div className="label">Ingresos</div><div className="valor">{formatPesos(totales.ingresos)}</div></div>
        <div><div className="label">Egresos</div><div className="valor">{formatPesos(totales.egresos)}</div></div>
        <div><div className="label ci-accent">Neto</div><div className="valor ci-accent">{formatPesos(totales.neto)}</div></div>
      </div>

      <div className="ci-section">
        <h2>Por medio de pago</h2>
        <table className="ci-table">
          <thead><tr><th>Medio</th><th className="num">Ingresos</th><th className="num">Egresos</th><th className="num">Neto</th></tr></thead>
          <tbody>
            {(por_medio || []).map((m) => (
              <tr key={m.medio}>
                <td>{MEDIO_PAGO_LABEL[m.medio] || m.medio}</td>
                <td className="num">{formatPesos(m.ingresos)}</td>
                <td className="num">{formatPesos(m.egresos)}</td>
                <td className="num">{formatPesos(m.neto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ci-section">
        <h2>Arqueo</h2>
        <table className="ci-table">
          <tbody>
            <tr><td>Inicial</td><td className="num">{formatPesos(arqueo.inicial)}</td></tr>
            <tr><td>Esperado</td><td className="num">{formatPesos(arqueo.esperado)}</td></tr>
            <tr><td>Contado</td><td className="num">{formatPesos(arqueo.contado)}</td></tr>
            <tr><td>Diferencia</td><td className="num">{formatPesos(arqueo.diferencia)}</td></tr>
          </tbody>
        </table>
      </div>

      {z?.numero && (
        <div className="ci-section">
          <h2>Cierre Z</h2>
          <table className="ci-table">
            <tbody>
              <tr><td>Número</td><td className="num">{z.numero}</td></tr>
              <tr><td>Total Z</td><td className="num">{formatPesos(z.total)}</td></tr>
              <tr><td>Neto gravado</td><td className="num">{formatPesos(z.neto_gravado)}</td></tr>
              <tr><td>IVA</td><td className="num">{formatPesos(z.iva)}</td></tr>
              <tr><td>Cantidad de comprobantes</td><td className="num">{z.cantidad_comprobantes ?? '—'}</td></tr>
              <tr><td>Diferencia vs. registrado</td><td className="num">{formatPesos(z.comparacion?.diferencia_total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {(facturas?.length > 0 || recibos?.length > 0) && (
        <div className="ci-section">
          <h2>Facturas y recibos</h2>
          <table className="ci-table">
            <thead><tr><th>Comprobante</th><th>Fecha</th><th className="num">Total</th><th>Estado</th></tr></thead>
            <tbody>
              {[...(facturas || []), ...(recibos || [])].map((c) => (
                <tr key={c.etiqueta}>
                  <td>{c.etiqueta}</td><td>{formatFecha(c.fecha)}</td>
                  <td className="num">{formatPesos(c.monto_total)}</td><td>{c.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(sin_comprobante || []).length > 0 && (
        <div className="ci-section">
          <h2>Pagos sin comprobante</h2>
          <table className="ci-table">
            <thead><tr><th>Hora</th><th>Cliente</th><th>Concepto</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {sin_comprobante.map((p) => (
                <tr key={p.pago_id}>
                  <td>{formatHora(p.fecha_hora)}</td><td>{p.cliente || 'S/N'}</td><td>{p.concepto}</td>
                  <td className="num">{formatPesos(p.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ci-section">
        <h2>Gastos</h2>
        <table className="ci-table">
          <thead><tr><th>Hora</th><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th className="num">Monto</th></tr></thead>
          <tbody>
            {(gastos?.detalle || []).map((g) => (
              <tr key={g.gasto_id}>
                <td>{formatHora(g.fecha_hora)}</td><td>{g.concepto}</td>
                <td>{CATEGORIA_GASTO_LABEL[g.categoria] || g.categoria}</td><td>{g.proveedor || '—'}</td>
                <td className="num">{formatPesos(g.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {((anulados?.pagos || []).length > 0 || (anulados?.gastos || []).length > 0) && (
        <div className="ci-section">
          <h2>Anulados</h2>
          <table className="ci-table">
            <thead><tr><th>Tipo</th><th>Motivo</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {(anulados.pagos || []).map((p) => (
                <tr key={`p-${p.pago_id}`}><td>Pago</td><td>{p.motivo}</td><td className="num">{formatPesos(p.monto)}</td></tr>
              ))}
              {(anulados.gastos || []).map((g) => (
                <tr key={`g-${g.gasto_id}`}><td>Gasto</td><td>{g.motivo}</td><td className="num">{formatPesos(g.monto)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ci-firmas">
        <div>Cajero</div>
        <div>Administración</div>
      </div>
      <div className="ci-footer">Impreso {formatFechaHora(new Date())}</div>
    </div>
  )
}
