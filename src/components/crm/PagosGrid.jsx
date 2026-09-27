import { formatMontoVisible, unidadEmoji } from '../../lib/format'
import { esPendienteConfirmacion, pagoSinVerificar, saldoNumerico } from '../../lib/reservas'
import { CreditCard, Hourglass, Gift } from 'lucide-react'

// "Monto nulo" (sep 2026, reemplaza "Sin verificar" acá y en el header de
// Clientes.jsx): mismo concepto — un pago con comprobante cargado pero sin
// poder leer el importe real — pero con label más corto, rojo y en una sola
// línea, para que quepa cómodo dentro de una celda angosta de la grilla.
const MontoNulo = () => (
  <span className="text-red-400 text-[8px] font-bold uppercase tracking-widest whitespace-nowrap">Monto nulo</span>
)

// Grilla de pagos por reserva, estilo el cuadro que ya usa el administrador
// en Excel: Precio de Venta | Cuota 1..N | Saldo. Una grilla por reserva (no
// una fila por cliente) porque valor_total/saldo son datos de la reserva,
// no del cliente — un cliente con varias temporadas ve una grilla por cada
// una, dentro de su misma fila expandida.
//
// Cada columna de cuota corresponde al pago cuyo `pagos.nro_cuota` sea ese
// número — es el orden secuencial en el que se cargaron los pagos de esa
// reserva (lo asigna el trigger fn_pago_asigna_nro_cuota como "próximo
// número", no un mes calendario real).
//
// La grilla ya NO rellena hasta un mínimo fijo de columnas (antes eran 6):
// muestra una celda por cada pago ya registrado y, si la reserva no está
// saldada, una única celda "+ Cargar" después del último pago — al
// registrarlo, esa celda se corre un lugar más.
export default function PagosGrid({ reserva, pagos, onCellClick, onDefinirPrecio }) {
  // Unidad bonificada (sep 2026): sin cargo, no admite pagos — bloqueado a
  // nivel base (trigger trg_pago_bloquea_bonificada). No tiene sentido
  // mostrar ninguna grilla ni "Definir precio" acá.
  if (reserva.bonificada) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
          <span className="text-cyan-400 font-bold">{reserva.temporada}</span>
          <span>&bull; {unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 bg-cyan-400/5 border border-dashed border-cyan-400/20 rounded-lg text-xs text-cyan-300">
          <Gift size={14} className="shrink-0" />
          Carpa bonificada — no registra pagos.
        </div>
      </div>
    )
  }

  // Cliente histórico sin confirmar: el precio ni se definió todavía, así que
  // no hay grilla de cuotas que mostrar ni celda "+ Cargar" que habilitar —
  // eso dejaría registrar un pago contra un precio que no existe. Antes esto
  // mostraba "$0" de Precio Venta y "Unidad saldada" de saldo (bug detectado
  // con Adriana Aguero, Sombrilla #11).
  if (esPendienteConfirmacion(reserva)) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
          <span className="text-cyan-400 font-bold">{reserva.temporada}</span>
          <span>&bull; {unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-dashed border-white/15 rounded-lg text-xs text-gray-400">
          <Hourglass size={14} className="text-gray-500 shrink-0" />
          Cliente de la temporada pasada, sin confirmar ni pagar nada todavía — no hay precio definido para cargar pagos.
        </div>
      </div>
    )
  }

  // Reserva ya confirmada (no pendiente_confirmacion) pero a la que nunca se
  // le cargó un valor_total real — mostrar la grilla acá repetiría el mismo
  // "$0" ambiguo que ya se sacó de MontoReserva/SaldoReserva. El estado
  // (badge único) ya se ve en la tarjeta de arriba, este bloque no lo repite.
  if (!(Number(reserva.valor_total) > 0)) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border border-dashed border-white/15 rounded-lg text-xs text-gray-400">
        <span>Todavía no hay precio definido para esta reserva.</span>
        {onDefinirPrecio && (
          <button
            type="button"
            onClick={() => onDefinirPrecio(reserva)}
            className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all shrink-0"
          >
            Definir precio
          </button>
        )}
      </div>
    )
  }

  // Cuotas ya registradas, en el orden real en que se cargaron.
  const cuotas = [...pagos].sort((a, b) => (a.nro_cuota || 0) - (b.nro_cuota || 0))
  const nextCuota = cuotas.length + 1

  // "Saldada" acá es una regla propia de la grilla (Tarea 4), distinta de
  // saldoNumerico/estaSaldada usados en el resto de la app: no vuelve `null`
  // ante un monto sin verificar, porque lo que importa para cerrar/bloquear
  // la grilla es si YA se cubrió el total con lo que sí se conoce, no si cada
  // cuota individual está verificada.
  const montosConocidos = cuotas.reduce((acc, p) => acc + (p.monto != null ? Number(p.monto) : 0), 0)
  const saldada = reserva.estado_pago === 'pagado' || montosConocidos >= Number(reserva.valor_total || 0)

  // Saldo mostrado: sigue siendo el real (saldoNumerico, nunca reserva.saldo
  // suelto) — `null` cuando hay algún pago sin verificar y la reserva todavía
  // no está saldada por la regla de arriba.
  const saldoCalculado = saldoNumerico(reserva, cuotas)

  const cellBase = 'shrink-0 w-[110px] flex flex-col items-center justify-center gap-1 rounded-lg py-3 text-xs font-bold transition-all'

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
        <span className="text-cyan-400 font-bold">{reserva.temporada}</span>
        <span>&bull; {unidadEmoji(reserva.unidades?.tipo)} {reserva.unidades?.tipo} #{reserva.unidades?.numero}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-fit pb-1">
          {/* Precio de venta — informativo, no clickeable. Nunca se
              renderiza en $0 (ver lib/format.js formatMontoVisible); en la
              práctica esta rama ya solo se alcanza con valor_total > 0 (el
              guard de más arriba corta antes si no lo es), pero se aplica el
              mismo helper acá para no formatear montos a mano. */}
          {formatMontoVisible(reserva.valor_total) && (
            <div className={`${cellBase} bg-white/5 border border-white/10 text-white`}>
              <span className="text-[8px] text-gray-500 uppercase tracking-widest">Precio Venta</span>
              {formatMontoVisible(reserva.valor_total)}
            </div>
          )}

          {cuotas.map((pago) => {
            // Comprobante cargado en la migración pero sin poder leer el
            // importe real (Agustín y compañía): mostrar "$0" acá sería la
            // misma mentira que "Unidad saldada" en el saldo — sabemos que
            // pagó, no cuánto.
            const sinVerificar = pagoSinVerificar(pago)
            return (
              <button
                key={pago.id}
                type="button"
                disabled={saldada}
                onClick={saldada ? undefined : () => onCellClick(reserva, pago)}
                className={`${cellBase} ${
                  saldada
                    ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
                    : sinVerificar
                      ? 'bg-gray-500/10 border border-gray-500/30 text-gray-400 hover:bg-gray-500/20 cursor-pointer'
                      : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 cursor-pointer'
                }`}
                title={saldada ? 'Reserva saldada — cuota bloqueada' : 'Ver detalle del pago'}
              >
                <span className="text-[8px] text-gray-500 uppercase tracking-widest">Cuota {pago.nro_cuota}</span>
                {sinVerificar ? <MontoNulo /> : formatMontoVisible(pago.monto)}
                {pago.medio === 'tarjeta_credito' && pago.cuotas_tarjeta && (
                  <span className="flex items-center gap-0.5 text-[8px] text-[#FDE047] font-bold">
                    <CreditCard size={10} /> {pago.cuotas_tarjeta}x
                  </span>
                )}
              </button>
            )
          })}

          {/* Próxima cuota a cargar — solo existe si la reserva no está
              saldada; al registrarla, esta celda se corre una posición. */}
          {!saldada && (
            <button
              type="button"
              onClick={() => onCellClick(reserva, null)}
              className={`${cellBase} border border-dashed border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 cursor-pointer`}
              title="Cargar pago"
            >
              <span className="text-[8px] text-gray-500 uppercase tracking-widest">Cuota {nextCuota}</span>
              + Cargar
            </button>
          )}

          {/* Saldo — informativo, no clickeable. Saldada => "Unidad saldada"
              (nunca "$0" liso); si no, el monto solo se muestra si es > 0. */}
          <div className={`${cellBase} bg-white/5 border border-white/10 ${
            saldada ? 'text-green-400' : saldoCalculado === null ? 'text-gray-400' : 'text-red-400'
          }`}>
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">Saldo</span>
            {saldada ? 'Unidad saldada' : saldoCalculado === null ? <MontoNulo /> : formatMontoVisible(saldoCalculado)}
          </div>
        </div>
      </div>
    </div>
  )
}
