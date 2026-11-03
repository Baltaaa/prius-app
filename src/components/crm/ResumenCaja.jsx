import { formatPesos, formatFecha } from '../../lib/format'
import { MEDIO_PAGO_LABEL } from '../../lib/pagos'
import MontoStat from '../ui/MontoStat'
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
  <div className="card-surface card-pad space-y-4">
    <h3 className="text-body font-semibold text-ink flex items-center gap-2">
      {Icon && <Icon size={16} className="text-ink-2" />} {title}
    </h3>
    {children}
  </div>
)

const Fila = ({ label, value, tone, cliente }) => (
  <div className="flex items-center justify-between py-2 border-b border-line last:border-0 gap-3">
    <span className="text-body text-ink-2 min-w-0">
      {label}
      {/* Item 16 (testing oct 2026): nombre del cliente a cargo del
          comprobante, en chico — resumen_caja() ya lo traía, solo faltaba
          mostrarlo acá. */}
      {cliente && <span className="block text-label text-ink-2 truncate">{cliente}</span>}
    </span>
    <span className={`text-body font-semibold tabular-nums shrink-0 ${tone || 'text-ink'}`}>{value}</span>
  </div>
)

// Resumen del día (Tarea 5) — se alimenta siempre de resumen_caja(caja_id)
// (congelado en resumen_snapshot al cerrar): pantalla, impresión A4
// (CajaImpresion) y CSV (lib/caja.js) parten del mismo objeto, así que los
// números nunca pueden desalinearse entre sí.
export default function ResumenCaja({ resumen }) {
  if (!resumen) return null
  const { cabecera, totales, por_medio, arqueo, z, facturas, recibos, sin_comprobante, gastos, anulados } = resumen
  const diferenciaArqueo = Number(arqueo.total?.diferencia || 0)
  const balanceCuadrado = diferenciaArqueo === 0

  return (
    <div className="space-y-6">
      {/* Banner de confirmación de balance (mock 05-caja-desktop-cerrada) */}
      <div className={`rounded-card border p-4 flex items-center justify-between gap-3 flex-wrap ${balanceCuadrado ? 'bg-success-soft border-success/30' : 'bg-gold-100 border-gold-300'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-inner flex items-center justify-center shrink-0 ${balanceCuadrado ? 'bg-success-soft text-success-ink' : 'bg-gold-100 text-ink'}`}>
            <CheckCircle2 size={18} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className={`text-body font-semibold ${balanceCuadrado ? 'text-success-ink' : 'text-ink'}`}>
              {balanceCuadrado ? 'Jornada cerrada — Balance cuadrado sin diferencias' : 'Jornada cerrada con diferencia de arqueo'}
            </span>
            <span className={`text-label ${balanceCuadrado ? 'text-success-ink' : 'text-ink-2'}`}>
              Operaciones del {formatFecha(cabecera.fecha)} conciliadas y archivadas.
            </span>
          </div>
        </div>
        {balanceCuadrado && (
          <span className="text-label text-success-ink bg-card border border-success/30 px-3 py-1 rounded-full">
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
            {/* Pulido UX (oct 2026, item 2): grid-cols-3 pasa a 1+2 en mobile
                (Neto arriba, Ingresos/Egresos abajo) — en 375px tres
                columnas con un monto de 9 cifras ($ 239.947.560) no
                entraban, el "$" se iba a otro renglón. MontoStat size="sm"
                (clamp 14-18px, tope en 18px = mismo tamaño que el text-lg
                fijo de siempre en desktop/tablet) en las tres. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-1 sm:order-3 bg-surface rounded-inner p-4 text-center border border-gold-300 min-w-0">
                <Scale className="text-ink mx-auto mb-2" size={18} />
                <p className="text-label text-ink-2">Neto</p>
                <MontoStat value={totales.neto} size="sm" className="text-ink mt-1 mx-auto" />
              </div>
              <div className="sm:order-1 bg-surface rounded-inner p-4 text-center min-w-0">
                <ArrowUpRight className="text-success-ink mx-auto mb-2" size={18} />
                <p className="text-label text-ink-2">Ingresos</p>
                <MontoStat value={totales.ingresos} size="sm" className="text-success-ink mt-1 mx-auto" />
              </div>
              <div className="sm:order-2 bg-surface rounded-inner p-4 text-center min-w-0">
                <ArrowDownRight className="text-danger mx-auto mb-2" size={18} />
                <p className="text-label text-ink-2">Egresos</p>
                <MontoStat value={totales.egresos} size="sm" className="text-danger mt-1 mx-auto" />
              </div>
            </div>
          </Section>

          {/* Ítem 1 (25/10/2026): el arqueo integra TODOS los medios con
              movimiento, no solo efectivo — una fila por medio (Esperado/
              Contado/Diferencia) más el Total. "Sin declarar" marca un
              medio que no tiene contado propio (cajas cerradas antes de
              este ítem): se muestra = esperado, nunca se inventa un número. */}
          <Section title="Arqueo" icon={Banknote}>
            <div className="divide-y divide-divider">
              {(arqueo.por_medio || []).map((m) => (
                <div key={m.medio} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-body font-semibold text-ink">{MEDIO_PAGO_LABEL[m.medio] || m.medio}</span>
                    {!m.declarado && (
                      <span className="text-label text-ink-2 bg-surface border border-line rounded-full px-2 py-1">
                        Sin declarar
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="min-w-0">
                      <p className="text-label text-ink-2">Esperado</p>
                      <MontoStat value={m.esperado} size="xs" className="text-ink" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-label text-ink-2">Contado</p>
                      <MontoStat value={m.contado} size="xs" className="text-ink" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-label text-ink-2">Diferencia</p>
                      <MontoStat value={m.diferencia} size="xs" className={Number(m.diferencia) === 0 ? 'text-success-ink' : 'text-ink'} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Fila
              label="Total"
              value={formatPesos(arqueo.total?.contado)}
              tone={diferenciaArqueo === 0 ? 'text-success-ink' : 'text-ink'}
            />
            <Fila
              label="Diferencia total"
              value={formatPesos(arqueo.total?.diferencia)}
              tone={diferenciaArqueo === 0 ? 'text-success-ink' : 'text-ink'}
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
                <div className="flex items-start gap-2 mt-2 p-3 bg-gold-100 border border-gold-300 rounded-inner">
                  <AlertTriangle className="text-ink shrink-0 mt-1" size={14} />
                  <p className="text-label text-ink-2">
                    Diferencia vs. lo registrado en el sistema: {formatPesos(z.comparacion.diferencia_total)} en monto,
                    {' '}{z.comparacion.diferencia_cantidad} en cantidad de comprobantes.
                  </p>
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          {/* Item 2 (fix urgente oct 2026): total de TODOS los medios de pago,
              con desglose por medio (cantidad de movimientos, ingresos,
              gastos, neto) — todo sale de resumen_caja(), nunca recalculado
              acá. "Arqueo de Efectivo" de arriba sigue siendo solo el
              conteo físico de billetes (no tiene sentido "contar" una
              transferencia o un swipe de tarjeta). */}
          <Section title="Total General — Todos los Medios" icon={Scale}>
            <Fila label="Movimientos" value={totales.cantidad ?? '—'} />
            <Fila label="Ingresos" value={formatPesos(totales.ingresos)} tone="text-success-ink" />
            <Fila label="Gastos" value={formatPesos(totales.egresos)} tone="text-danger" />
            <Fila label="Neto" value={formatPesos(totales.neto)} tone="text-ink" />
          </Section>

          <Section title="Desglose por Medio de Pago" icon={CreditCard}>
            {(por_medio || []).length === 0 ? (
              <p className="text-label text-ink-2">Sin movimientos.</p>
            ) : (
              <div className="space-y-3">
                {por_medio.map((m) => {
                  const Icono = MEDIO_ICONO[m.medio] || Banknote
                  return (
                    <div key={m.medio} className="bg-surface rounded-inner p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-icon bg-card flex items-center justify-center text-ink-2 shrink-0">
                          <Icono size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-body font-semibold text-ink">{MEDIO_PAGO_LABEL[m.medio] || m.medio}</span>
                          <span className="block text-label text-ink-2">
                            {m.cantidad} movimiento{Number(m.cantidad) === 1 ? '' : 's'}
                            {Number(m.egresos) > 0 && <> · Ingresos {formatPesos(m.ingresos)} · Gastos {formatPesos(m.egresos)}</>}
                          </span>
                        </div>
                      </div>
                      <span className={`text-body font-semibold tabular-nums shrink-0 ${Number(m.neto) < 0 ? 'text-danger' : 'text-ink'}`}>{formatPesos(m.neto)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="Comprobantes de la Jornada" icon={FileCheck2}>
            <div className="space-y-4">
              <div>
                <p className="text-label text-ink-2 mb-2">Recibos ({(recibos || []).length})</p>
                {(recibos || []).length === 0 ? (
                  <p className="text-label text-ink-2 bg-surface rounded-inner p-3">Sin recibos en esta caja.</p>
                ) : recibos.map((r) => (
                  <Fila key={r.etiqueta} label={r.etiqueta} cliente={r.cliente} value={formatPesos(r.monto_total)} tone={r.estado === 'anulado' ? 'text-ink-2 line-through' : undefined} />
                ))}
              </div>
              <div>
                <p className="text-label text-ink-2 mb-2">Facturas ({(facturas || []).length})</p>
                {(facturas || []).length === 0 ? (
                  <p className="text-label text-ink-2 bg-surface rounded-inner p-3">Sin facturas emitidas en esta jornada.</p>
                ) : facturas.map((f) => (
                  <Fila key={f.etiqueta} label={f.etiqueta} cliente={f.cliente} value={formatPesos(f.monto_total)} tone={f.estado === 'anulado' ? 'text-ink-2 line-through' : undefined} />
                ))}
              </div>
              <div>
                <p className="text-label text-ink-2 mb-2">Gastos por categoría</p>
                {(gastos?.por_categoria || []).length === 0 ? (
                  <p className="text-label text-ink-2 bg-surface rounded-inner p-3">Sin gastos registrados en esta caja.</p>
                ) : gastos.por_categoria.map((g) => (
                  <Fila key={g.categoria} label={CATEGORIA_GASTO_LABEL[g.categoria] || g.categoria} value={formatPesos(g.total)} tone="text-danger" />
                ))}
              </div>
            </div>
          </Section>

          {(sin_comprobante || []).length > 0 && (
            <Section title={`Pagos sin comprobante (${sin_comprobante.length})`} icon={FileText}>
              {sin_comprobante.map((p) => (
                <div key={p.pago_id} className="flex items-center justify-between py-2 border-b border-line last:border-0 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-ink-2 shrink-0" />
                    <span className="text-body text-ink-2 truncate">{p.cliente || 'S/N'} — {p.concepto}</span>
                  </div>
                  <span className="text-body font-semibold text-ink tabular-nums shrink-0">{formatPesos(p.monto)}</span>
                </div>
              ))}
            </Section>
          )}

          {((anulados?.pagos || []).length > 0 || (anulados?.gastos || []).length > 0) && (
            <Section title="Anulados">
              {(anulados.pagos || []).map((p) => (
                <Fila key={`p-${p.pago_id}`} label={`Pago — ${p.motivo}`} value={formatPesos(p.monto)} tone="text-ink-2 line-through" />
              ))}
              {(anulados.gastos || []).map((g) => (
                <Fila key={`g-${g.gasto_id}`} label={`Gasto — ${g.motivo}`} value={formatPesos(g.monto)} tone="text-ink-2 line-through" />
              ))}
            </Section>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 pt-6">
        <div className="border-t border-line pt-3 text-center">
          <p className="text-label text-ink-2">Cajero</p>
        </div>
        <div className="border-t border-line pt-3 text-center">
          <p className="text-label text-ink-2">Administración</p>
        </div>
      </div>
    </div>
  )
}
