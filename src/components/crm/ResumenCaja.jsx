import { formatPesos, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL, formatHora } from '../../lib/caja'
import { ArrowUpRight, ArrowDownRight, Scale, FileText, AlertTriangle } from 'lucide-react'

const Section = ({ title, children }) => (
  <div className="glass-card p-6 sm:p-8 rounded-3xl glass-card-inner space-y-4">
    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h3>
    {children}
  </div>
)

const Fila = ({ label, value, tone }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <span className="text-sm text-gray-400">{label}</span>
    <span className={`text-sm font-bold tabular-nums ${tone || 'text-white'}`}>{value}</span>
  </div>
)

// Resumen del día (Tarea 5) — se alimenta siempre de resumen_caja(caja_id)
// (congelado en resumen_snapshot al cerrar): pantalla, impresión A4
// (CajaImpresion) y CSV (lib/caja.js) parten del mismo objeto, así que los
// números nunca pueden desalinearse entre sí.
export default function ResumenCaja({ resumen }) {
  if (!resumen) return null
  const { cabecera, totales, por_medio, arqueo, z, facturas, recibos, sin_comprobante, gastos, anulados } = resumen
  const diferenciaArqueo = Number(arqueo.diferencia || 0)

  return (
    <div className="space-y-6">
      <Section title="Cabecera">
        <Fila label="Fecha" value={formatFecha(cabecera.fecha)} />
        <Fila label="Estado" value={cabecera.estado === 'cerrada' ? 'Cerrada' : 'Abierta'} />
        {cabecera.abierta_at && <Fila label="Apertura" value={formatHora(cabecera.abierta_at)} />}
        {cabecera.cerrada_at && <Fila label="Cierre" value={formatHora(cabecera.cerrada_at)} />}
      </Section>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl glass-card-inner text-center">
          <ArrowUpRight className="text-green-400 mx-auto mb-2" size={18} />
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Ingresos</p>
          <p className="text-lg font-bold text-green-400 tabular-nums mt-1">{formatPesos(totales.ingresos)}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl glass-card-inner text-center">
          <ArrowDownRight className="text-red-400 mx-auto mb-2" size={18} />
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Egresos</p>
          <p className="text-lg font-bold text-red-400 tabular-nums mt-1">{formatPesos(totales.egresos)}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl glass-card-inner text-center border border-[#FDE047]/20">
          <Scale className="text-[#FDE047] mx-auto mb-2" size={18} />
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Neto</p>
          <p className="text-lg font-bold text-[#FDE047] tabular-nums mt-1">{formatPesos(totales.neto)}</p>
        </div>
      </div>

      <Section title="Por medio de pago">
        {(por_medio || []).length === 0 ? (
          <p className="text-xs text-gray-500 uppercase tracking-widest">Sin movimientos.</p>
        ) : por_medio.map((m) => (
          <Fila
            key={m.medio}
            label={MEDIO_PAGO_LABEL[m.medio] || m.medio}
            value={formatPesos(m.neto)}
            tone={Number(m.neto) < 0 ? 'text-red-400' : 'text-white'}
          />
        ))}
      </Section>

      <Section title="Arqueo">
        <Fila label="Inicial" value={formatPesos(arqueo.inicial)} />
        <Fila label="Esperado" value={formatPesos(arqueo.esperado)} />
        <Fila label="Contado" value={formatPesos(arqueo.contado)} />
        <Fila
          label="Diferencia"
          value={formatPesos(arqueo.diferencia)}
          tone={diferenciaArqueo === 0 ? 'text-green-400' : 'text-[#FDE047]'}
        />
      </Section>

      {z?.numero && (
        <Section title="Cierre Z (controlador fiscal)">
          <Fila label="Número Z" value={z.numero} />
          <Fila label="Total Z" value={formatPesos(z.total)} />
          <Fila label="Neto gravado" value={formatPesos(z.neto_gravado)} />
          <Fila label="IVA" value={formatPesos(z.iva)} />
          <Fila label="Cantidad de comprobantes" value={z.cantidad_comprobantes ?? '—'} />
          <Fila label="Primer / último comprobante" value={`${z.primer_comprobante || '—'} / ${z.ultimo_comprobante || '—'}`} />
          {(Number(z.comparacion?.diferencia_total) !== 0 || Number(z.comparacion?.diferencia_cantidad) !== 0) && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-[#FDE047]/5 border border-[#FDE047]/20 rounded-xl">
              <AlertTriangle className="text-[#FDE047] shrink-0 mt-0.5" size={14} />
              <p className="text-xs text-gray-300">
                Diferencia vs. lo registrado en el sistema: {formatPesos(z.comparacion.diferencia_total)} en monto,
                {' '}{z.comparacion.diferencia_cantidad} en cantidad de comprobantes.
              </p>
            </div>
          )}
        </Section>
      )}

      <Section title={`Facturas (${(facturas || []).length})`}>
        {(facturas || []).length === 0 ? (
          <p className="text-xs text-gray-500 uppercase tracking-widest">Sin facturas en esta caja.</p>
        ) : facturas.map((f) => (
          <Fila key={f.etiqueta} label={f.etiqueta} value={formatPesos(f.monto_total)} tone={f.estado === 'anulado' ? 'text-gray-500 line-through' : undefined} />
        ))}
      </Section>

      <Section title={`Recibos (${(recibos || []).length})`}>
        {(recibos || []).length === 0 ? (
          <p className="text-xs text-gray-500 uppercase tracking-widest">Sin recibos en esta caja.</p>
        ) : recibos.map((r) => (
          <Fila key={r.etiqueta} label={r.etiqueta} value={formatPesos(r.monto_total)} tone={r.estado === 'anulado' ? 'text-gray-500 line-through' : undefined} />
        ))}
      </Section>

      {(sin_comprobante || []).length > 0 && (
        <Section title={`Pagos sin comprobante (${sin_comprobante.length})`}>
          {sin_comprobante.map((p) => (
            <div key={p.pago_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="text-gray-500 shrink-0" />
                <span className="text-sm text-gray-300 truncate">{p.cliente || 'S/N'} — {p.concepto}</span>
              </div>
              <span className="text-sm font-bold text-white tabular-nums shrink-0">{formatPesos(p.monto)}</span>
            </div>
          ))}
        </Section>
      )}

      <Section title="Gastos por categoría">
        {(gastos?.por_categoria || []).length === 0 ? (
          <p className="text-xs text-gray-500 uppercase tracking-widest">Sin gastos en esta caja.</p>
        ) : gastos.por_categoria.map((g) => (
          <Fila key={g.categoria} label={CATEGORIA_GASTO_LABEL[g.categoria] || g.categoria} value={formatPesos(g.total)} tone="text-red-400" />
        ))}
      </Section>

      {((anulados?.pagos || []).length > 0 || (anulados?.gastos || []).length > 0) && (
        <Section title="Anulados">
          {(anulados.pagos || []).map((p) => (
            <Fila key={`p-${p.pago_id}`} label={`Pago — ${p.motivo}`} value={formatPesos(p.monto)} tone="text-gray-500 line-through" />
          ))}
          {(anulados.gastos || []).map((g) => (
            <Fila key={`g-${g.gasto_id}`} label={`Gasto — ${g.motivo}`} value={formatPesos(g.monto)} tone="text-gray-500 line-through" />
          ))}
        </Section>
      )}

      <div className="grid grid-cols-2 gap-8 pt-6">
        <div className="border-t border-white/20 pt-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cajero</p>
        </div>
        <div className="border-t border-white/20 pt-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Administración</p>
        </div>
      </div>
    </div>
  )
}
