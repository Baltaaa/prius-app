import { formatCurrency } from '../../lib/format'
import { CreditCard } from 'lucide-react'

// Grilla de pagos por reserva, estilo el cuadro que ya usa el administrador
// en Excel: Precio de Venta | Mes 1..N | Saldo. Una grilla por reserva (no
// una fila por cliente) porque valor_total/saldo son datos de la reserva,
// no del cliente — un cliente con varias temporadas ve una grilla por cada
// una, dentro de su misma fila expandida.
//
// Cada columna de mes corresponde al pago cuyo `pagos.nro_cuota` sea ese
// número — hoy es puramente el orden secuencial en el que se cargaron los
// pagos de esa reserva (lo asigna el trigger fn_pago_asigna_nro_cuota como
// "próximo número", no un mes calendario real). Pendiente confirmar con el
// administrador si más adelante hace falta atarlo a un mes calendario.
//
// Solo la PRÓXIMA celda vacía (nro_cuota = cantidad de pagos + 1) es
// clickeable para cargar un pago nuevo: el trigger de saldo no permite
// "saltar" cuotas (siempre asigna el próximo secuencial), así que una celda
// de un mes más adelante no podría recibir ese pago aunque se clickee —
// queda visualmente pendiente pero deshabilitada hasta que le llegue el turno.
export default function PagosGrid({ reserva, pagos, onCellClick }) {
  const nextCuota = pagos.length + 1
  const maxNro = pagos.reduce((m, p) => Math.max(m, p.nro_cuota || 0), 0)
  const totalMeses = Math.max(6, maxNro, nextCuota > 6 ? nextCuota : 6)
  const meses = Array.from({ length: totalMeses }, (_, i) => i + 1)

  const cellBase = 'shrink-0 w-[110px] flex flex-col items-center justify-center gap-1 rounded-lg py-3 text-xs font-bold transition-all'

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
        <span className="text-cyan-400 font-bold">{reserva.temporada}</span>
        <span>&bull; {reserva.unidades?.tipo} #{reserva.unidades?.numero}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-fit pb-1">
          {/* Precio de venta — informativo, no clickeable */}
          <div className={`${cellBase} bg-white/5 border border-white/10 text-white`}>
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">Precio Venta</span>
            {formatCurrency(reserva.valor_total)}
          </div>

          {meses.map((n) => {
            const pago = pagos.find((p) => p.nro_cuota === n)
            if (pago) {
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onCellClick(reserva, pago)}
                  className={`${cellBase} bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 cursor-pointer`}
                  title="Ver detalle del pago"
                >
                  <span className="text-[8px] text-gray-500 uppercase tracking-widest">Mes {n}</span>
                  {formatCurrency(pago.monto)}
                  {pago.medio === 'tarjeta_credito' && pago.cuotas_tarjeta && (
                    <span className="flex items-center gap-0.5 text-[8px] text-[#FDE047] font-bold">
                      <CreditCard size={10} /> {pago.cuotas_tarjeta}x
                    </span>
                  )}
                </button>
              )
            }
            const isNext = n === nextCuota
            return (
              <button
                key={n}
                type="button"
                disabled={!isNext}
                onClick={isNext ? () => onCellClick(reserva, null) : undefined}
                className={`${cellBase} border border-dashed ${
                  isNext
                    ? 'border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 cursor-pointer'
                    : 'border-white/10 text-gray-600 cursor-not-allowed'
                }`}
                title={isNext ? 'Cargar pago de este mes' : 'Se habilita al cargar el mes anterior'}
              >
                <span className="text-[8px] text-gray-500 uppercase tracking-widest">Mes {n}</span>
                {isNext ? '+ Cargar' : '—'}
              </button>
            )
          })}

          {/* Saldo — informativo, no clickeable */}
          <div className={`${cellBase} bg-white/5 border border-white/10 ${Number(reserva.saldo) > 0 ? 'text-red-400' : 'text-green-400'}`}>
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">Saldo</span>
            {formatCurrency(reserva.saldo)}
          </div>
        </div>
      </div>
    </div>
  )
}
