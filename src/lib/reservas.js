// Un $0 en pantalla es ambiguo: puede ser "no se cargó nada todavía"
// (bonificada, monto real cero) o "no sabemos el monto real" (costo_total
// quedó null a propósito, pendiente_verificacion=true — caso Ana Lescano,
// ver CLAUDE.md/auditoría sep 2026: 3 períodos de duración distinta sin
// reparto confiable de los $3.100.000 reales). Este helper distingue los dos
// casos para que la UI nunca muestre "$0" liso cuando en realidad es "no
// verificado".
export function montoInfo(reserva) {
  const pendiente = reserva?.pendiente_verificacion === true
  return {
    pendiente,
    bonificada: reserva?.bonificada === true,
    valorTotal: reserva?.valor_total,
    montoGrupoReferencia: reserva?.monto_grupo_referencia ?? null,
  }
}

// "pendiente_confirmacion" (sep 2026): clientes fijos de la temporada pasada
// que todavía no se acercaron a confirmar ni a hablar precio/forma de pago
// para la temporada actual. Es un estado propio de `estado_pago`, distinto de
// "pendiente" (precio ya acordado, sin cobrar) — nunca deben verse igual en
// la UI. Único lugar con el string literal para no repetirlo suelto.
export const esPendienteConfirmacion = (reserva) => reserva?.estado_pago === 'pendiente_confirmacion'

// Único lugar que decide qué status le pasa a <StatusBadge>: una reserva
// bonificada siempre muestra el badge "Bonificada" en vez del de estado_pago
// (nunca los dos juntos — mismo principio de "un solo indicador" que ya
// separaba pendiente de pendiente_confirmacion). El trigger de base fuerza
// estado_pago='pagado' en cuanto bonificada=true, así que en teoría nunca
// convive con parcial/pendiente/pendiente_confirmacion, pero este helper es
// el que blindaría la UI si algo quedara desincronizado.
export const estadoBadgeStatus = (reserva) => (reserva?.bonificada ? 'bonificada' : reserva?.estado_pago)

// Una reserva está "saldada" solo si el precio existe y coincide con lo
// cobrado. pendiente_confirmacion nunca cuenta como saldada — el precio ni
// se definió, mostrar "$0"/"Unidad saldada" ahí sería información falsa
// (bug detectado con Adriana Aguero, Sombrilla #11). Válido para reservas
// cuyo `saldo` lo mantiene el trigger `fn_pago_actualiza_saldo` en tiempo
// real (período/día, dadas de alta por RegistrarPago) — para temporada migrada
// desde el excel histórico usar `saldoNumerico` en vez de este helper, ver
// nota abajo.
export function estaSaldada(reserva) {
  if (!reserva || esPendienteConfirmacion(reserva)) return false
  if (montoInfo(reserva).pendiente) return false
  return Number(reserva.saldo) <= 0
}

// ¿El monto de este pago es confiable? En la migración histórica, un pago con
// comprobante cargado pero sin poder leer el importe real quedó con
// `monto = null` y `monto_pendiente_verificacion = true` — sabemos que el
// cliente pagó algo, pero no cuánto.
export const pagoSinVerificar = (pago) => pago?.monto == null || pago?.monto_pendiente_verificacion === true

// ¿Alguno de los pagos de esta reserva tiene un monto sin verificar? Recibe
// los pagos de ESA reserva puntual (no vienen embebidos en `reservas`, hay
// que filtrarlos por reserva_id en el llamador).
export const tienePagoSinVerificar = (pagosDeReserva) => (pagosDeReserva || []).some(pagoSinVerificar)

// Saldo real de una reserva, derivado SIEMPRE de estado_pago + los pagos
// reales — nunca del campo suelto `reserva.saldo`, que para las reservas de
// temporada migradas del excel histórico quedó siempre vacío/"$-" (no es un
// valor calculado, es un campo decorativo sin cargar). Bug detectado con
// AGUSTIN, Sombrilla #27: badge "PARCIAL" (hay un pago con comprobante RB
// 3660 cargado) mostrado junto a "Unidad saldada" en el saldo — dos
// afirmaciones contradictorias sobre el mismo dato, porque `reserva.saldo`
// venía `null` y `Number(null) <= 0` da `true` en JS.
//
// Devuelve un número (0 = saldada) o `null` cuando no hay forma honesta de
// calcularlo (precio total ambiguo — Ana Lescano — o algún pago con monto sin
// verificar — Agustín y compañía). El llamador NUNCA debe tratar `null` como
// 0: hay que mostrar "Sin verificar", no "$0" ni "Unidad saldada".
export function saldoNumerico(reserva, pagosDeReserva = []) {
  // Un pago anulado (motivo + caja abierta, ver CLAUDE.md "Flujo de dinero")
  // nunca cuenta para el saldo ni dispara "sin verificar" — es como si no
  // hubiera existido. Migraciones viejas no tienen `estado` cargado: se
  // tratan como vigentes (!== 'anulado', no === 'vigente').
  const vigentes = (pagosDeReserva || []).filter((p) => p.estado !== 'anulado')
  if (esPendienteConfirmacion(reserva)) return 0 // precio ni se definió, no hay deuda que contar todavía
  if (montoInfo(reserva).pendiente || tienePagoSinVerificar(vigentes)) return null
  const pagado = vigentes.reduce((acc, p) => acc + Number(p.monto || 0), 0)
  return Math.max(Number(reserva.valor_total || 0) - pagado, 0)
}

// Rangos de fechas ya ocupados por otras reservas activas (período/día) de
// una unidad — usado por el date picker del form de Reservas (Tarea 7,
// disponibilidad dinámica) para tachar/bloquear días, con la misma regla que
// el exclusion constraint `reservas_no_overlap_periodo_dia` de la base
// (ver CLAUDE.md). `excludeReservaId` saca la propia reserva al editarla.
export function rangosOcupadosPorUnidad(reservas, unidadId, excludeReservaId) {
  if (!unidadId) return []
  return (reservas || [])
    .filter((r) => {
      if (r.unidad_id !== unidadId || r.estado !== 'activa') return false
      if (excludeReservaId && r.id === excludeReservaId) return false
      return r.tipo_alquiler === 'periodo' || r.tipo_alquiler === 'dia'
    })
    .map((r) => {
      const desde = r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_inicio
      const hasta = r.tipo_alquiler === 'dia' ? r.fecha : r.fecha_fin
      return { desde, hasta }
    })
    .filter((rango) => rango.desde && rango.hasta)
}

// Co-socios de una reserva: personas vinculadas a la misma unidad además del
// titular (`reserva.cliente_id`), vía la tabla puente `reserva_clientes`
// (embebida por RESERVA_SELECT en DataProvider). Excluye al titular para no
// listarlo dos veces si también aparece ahí.
export function coSocios(reserva) {
  const titularId = reserva?.cliente_id
  const filas = reserva?.reserva_clientes || []
  const vistos = new Set()
  const result = []
  for (const fila of filas) {
    const c = fila?.clientes
    if (!c || c.id === titularId || vistos.has(c.id)) continue
    vistos.add(c.id)
    result.push(c)
  }
  return result
}
