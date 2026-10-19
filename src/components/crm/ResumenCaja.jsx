import { formatPesos, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import { CATEGORIA_GASTO_LABEL, formatHora } from '../../lib/caja'
import {
  ArrowUpRight, ArrowDownRight, Scale, FileText, AlertTriangle, CheckCircle2,
  CalendarDays, Wallet, Banknote, Landmark, QrCode, CreditCard, Receipt, FileCheck2,
} from 'lucide-react'

const MEDIO_ICONO = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercado_pago: QrCode,
  tarjeta_debito: CreditCard,
  tarjeta_credito: CreditCard,
}

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-white border border-hairline rounded-2xl p-6 space-y-4">
    <h3 className="text-sm font-bold text-black flex items-center gap-2">
      {Icon && <Icon size={16} className="text-prius-slate" />} {title}
    </h3>
    {children}
  </div>
)

const Fila = ({ label, value, tone }) => (
  <div className="flex items-center justify-between py-2 border-b border-hairline last:border-0">
    <span className="text-sm text-prius-slate">{label}</span>
    <span className={`text-sm font-bold tabular-nums ${tone || 'text-black'}`}>{value}</span>
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
  const balanceCuadrado = diferenciaArqueo === 0

  return (
    <div className="space-y-6">
      {/* Banner de confirmación de balance (mock 05-caja-desktop-cerrada) */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between gap-3 flex-wrap ${balanceCuadrado ? 'bg-green-50/40 border-green-200' : 'bg-gold/5 border-gold/20'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${balanceCuadrado ? 'bg-green-100 text-prius-success' : 'bg-gold/10 text-gold'}`}>
            <CheckCircle2 size={18} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className={`text-sm font-bold ${balanceCuadrado ? 'text-green-900' : 'text-black'}`}>
              {balanceCuadrado ? 'Jornada cerrada — Balance cuadrado sin diferencias' : 'Jornada cerrada con diferencia de arqueo'}
            </span>
            <span className={`text-xs ${balanceCuadrado ? 'text-green-700' : 'text-prius-slate'}`}>
              Operaciones del {formatFecha(cabecera.fecha)} conciliadas y archivadas.
            </span>
          </div>
        </div>
        {balanceCuadrado && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-prius-success bg-white border border-green-200 px-3 py-1 rounded-full">
            Balance auditado
          </span>
        )}
      </div>

      {/* Grilla 2 columnas en desktop (mock 05-caja-desktop-cerrada):
          izquierda cabecera/totales/arqueo/Z, derecha medio de pago y
          comprobantes — mobile/tablet siguen apiladas en una sola columna,
          mismo orden de siempre. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-6 lg:space-y-0">
        <div className="space-y-6">
          <Section title="Cabecera de la Jornada" icon={CalendarDays}>
            <Fila label="Fecha" value={formatFecha(cabecera.fecha)} />
            <Fila label="Estado" value={cabecera.estado === 'cerrada' ? 'Cerrada' : 'Abierta'} />
            {cabecera.abierta_at && <Fila label="Apertura" value={formatHora(cabecera.abierta_at)} />}
            {cabecera.cerrada_at && <Fila label="Cierre" value={formatHora(cabecera.cerrada_at)} />}
          </Section>

          <Section title="Totales Operativos" icon={Wallet}>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-prius-surface rounded-xl p-4 text-center">
                <ArrowUpRight className="text-prius-success mx-auto mb-2" size={18} />
                <p className="text-[10px] text-prius-muted uppercase tracking-widest">Ingresos</p>
                <p className="text-lg font-bold text-prius-success tabular-nums mt-1">{formatPesos(totales.ingresos)}</p>
              </div>
              <div className="bg-prius-surface rounded-xl p-4 text-center">
                <ArrowDownRight className="text-prius-error mx-auto mb-2" size={18} />
                <p className="text-[10px] text-prius-muted uppercase tracking-widest">Egresos</p>
                <p className="text-lg font-bold text-prius-error tabular-nums mt-1">{formatPesos(totales.egresos)}</p>
              </div>
              <div className="bg-prius-surface rounded-xl p-4 text-center border border-gold/20">
                <Scale className="text-gold mx-auto mb-2" size={18} />
                <p className="text-[10px] text-prius-muted uppercase tracking-widest">Neto</p>
                <p className="text-lg font-bold text-gold tabular-nums mt-1">{formatPesos(totales.neto)}</p>
              </div>
            </div>
          </Section>

          <Section title="Arqueo de Efectivo" icon={Banknote}>
            <Fila label="Inicial" value={formatPesos(arqueo.inicial)} />
            <Fila label="Esperado" value={formatPesos(arqueo.esperado)} />
            <Fila label="Contado" value={formatPesos(arqueo.contado)} />
            <Fila
              label="Diferencia"
              value={formatPesos(arqueo.diferencia)}
              tone={diferenciaArqueo === 0 ? 'text-prius-success' : 'text-gold'}
            />
          </Section>

          {z?.numero && (
            <Section title="Controlador Fiscal — Cierre Z" icon={Receipt}>
              <Fila label="Número Z" value={z.numero} />
              <Fila label="Total Z" value={formatPesos(z.total)} />
              <Fila label="Neto gravado" value={formatPesos(z.neto_gravado)} />
              <Fila label="IVA" value={formatPesos(z.iva)} />
              <Fila label="Cantidad de comprobantes" value={z.cantidad_comprobantes ?? '—'} />
              <Fila label="Primer / último comprobante" value={`${z.primer_comprobante || '—'} / ${z.ultimo_comprobante || '—'}`} />
              {(Number(z.comparacion?.diferencia_total) !== 0 || Number(z.comparacion?.diferencia_cantidad) !== 0) && (
                <div className="flex items-start gap-2 mt-2 p-3 bg-gold/5 border border-gold/20 rounded-xl">
                  <AlertTriangle className="text-gold shrink-0 mt-0.5" size={14} />
                  <p className="text-xs text-prius-slate">
                    Diferencia vs. lo registrado en el sistema: {formatPesos(z.comparacion.diferencia_total)} en monto,
                    {' '}{z.comparacion.diferencia_cantidad} en cantidad de comprobantes.
                  </p>
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Desglose por Medio de Pago" icon={CreditCard}>
            {(por_medio || []).length === 0 ? (
              <p className="text-xs text-prius-muted uppercase tracking-widest">Sin movimientos.</p>
            ) : (
              <div className="space-y-2.5">
                {por_medio.map((m) => {
                  const Icono = MEDIO_ICONO[m.medio] || Banknote
                  return (
                    <div key={m.medio} className="bg-prius-surface rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-prius-slate shrink-0">
                          <Icono size={16} />
                        </div>
                        <span className="text-sm font-semibold text-black">{MEDIO_PAGO_LABEL[m.medio] || m.medio}</span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${Number(m.neto) < 0 ? 'text-prius-error' : 'text-black'}`}>{formatPesos(m.neto)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="Comprobantes de la Jornada" icon={FileCheck2}>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest mb-2">Recibos ({(recibos || []).length})</p>
                {(recibos || []).length === 0 ? (
                  <p className="text-xs text-prius-muted bg-prius-surface rounded-xl p-3">Sin recibos en esta caja.</p>
                ) : recibos.map((r) => (
                  <Fila key={r.etiqueta} label={r.etiqueta} value={formatPesos(r.monto_total)} tone={r.estado === 'anulado' ? 'text-prius-muted line-through' : undefined} />
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest mb-2">Facturas ({(facturas || []).length})</p>
                {(facturas || []).length === 0 ? (
                  <p className="text-xs text-prius-muted bg-prius-surface rounded-xl p-3">Sin facturas emitidas en esta jornada.</p>
                ) : facturas.map((f) => (
                  <Fila key={f.etiqueta} label={f.etiqueta} value={formatPesos(f.monto_total)} tone={f.estado === 'anulado' ? 'text-prius-muted line-through' : undefined} />
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold text-prius-muted uppercase tracking-widest mb-2">Gastos por categoría</p>
                {(gastos?.por_categoria || []).length === 0 ? (
                  <p className="text-xs text-prius-muted bg-prius-surface rounded-xl p-3">Sin gastos registrados en esta caja.</p>
                ) : gastos.por_categoria.map((g) => (
                  <Fila key={g.categoria} label={CATEGORIA_GASTO_LABEL[g.categoria] || g.categoria} value={formatPesos(g.total)} tone="text-prius-error" />
                ))}
              </div>
            </div>
          </Section>

          {(sin_comprobante || []).length > 0 && (
            <Section title={`Pagos sin comprobante (${sin_comprobante.length})`} icon={FileText}>
              {sin_comprobante.map((p) => (
                <div key={p.pago_id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-prius-muted shrink-0" />
                    <span className="text-sm text-prius-slate truncate">{p.cliente || 'S/N'} — {p.concepto}</span>
                  </div>
                  <span className="text-sm font-bold text-black tabular-nums shrink-0">{formatPesos(p.monto)}</span>
                </div>
              ))}
            </Section>
          )}

          {((anulados?.pagos || []).length > 0 || (anulados?.gastos || []).length > 0) && (
            <Section title="Anulados">
              {(anulados.pagos || []).map((p) => (
                <Fila key={`p-${p.pago_id}`} label={`Pago — ${p.motivo}`} value={formatPesos(p.monto)} tone="text-prius-muted line-through" />
              ))}
              {(anulados.gastos || []).map((g) => (
                <Fila key={`g-${g.gasto_id}`} label={`Gasto — ${g.motivo}`} value={formatPesos(g.monto)} tone="text-prius-muted line-through" />
              ))}
            </Section>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 pt-6">
        <div className="border-t border-hairline pt-3 text-center">
          <p className="text-[10px] text-prius-muted uppercase tracking-widest">Cajero</p>
        </div>
        <div className="border-t border-hairline pt-3 text-center">
          <p className="text-[10px] text-prius-muted uppercase tracking-widest">Administración</p>
        </div>
      </div>
    </div>
  )
}
