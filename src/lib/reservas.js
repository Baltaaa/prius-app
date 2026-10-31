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
//
// Fase 3 (Recepción, D7): una reserva web preconfirmada reemplaza TAMBIÉN al
// badge de estado_pago mientras esté vigente ("Preconfirmada" — su acción
// primaria es "Hacer check-in"); si venció por `vence_at` sin check-in, el
// badge es "Vencida", sin acción. D6 asegura que una reserva saldada ya no
// llega acá con preconfirmada=true, así que no compite con "Pagado".
export function estadoBadgeStatus(reserva) {
  if (reserva?.bonificada) return 'bonificada'
  if (reserva?.origen === 'web' && reserva?.preconfirmada) {
    return reservaActiva(reserva) ? 'preconfirmada' : 'vencida'
  }
  return reserva?.estado_pago
}

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

// ¿Este pago representa un pago REAL (y no una fila vacía del import)? Una
// fila de `pagos` con monto null Y sin ningún comprobante vinculado (9 casos
// detectados, oct 2026 — ej. Natalia Duhalde) es un artefacto de la
// migración del excel, no un pago — nunca cuenta para "hay un pago" ni
// dispara el aviso de monto sin verificar (espejo de `fn_pago_es_real` en
// Postgres, mantener sincronizado). Depende de que `pago.comprobantes`
// venga embebido (como ya lo trae `fetchPagos` en DataProvider.jsx).
export function esPagoReal(pago) {
  if (!pago) return false
  if (pago.monto != null) return true
  return (pago.comprobantes || []).some((c) => c.estado !== 'anulado')
}

// ¿Alguno de los pagos de esta reserva es un pago real? (ver `esPagoReal`) —
// "SIN PAGO" (ningún pago/comprobante registrado) vs "PAGO PARCIAL" (al
// menos uno, con o sin monto) se decide acá, nunca mirando `estado_pago`
// a mano en una pantalla puntual.
export const tieneAlgunPagoReal = (pagosDeReserva) => (pagosDeReserva || []).some(esPagoReal)

// ¿El monto de este pago es confiable? En la migración histórica, un pago con
// comprobante cargado pero sin poder leer el importe real quedó con
// `monto = null` y `monto_pendiente_verificacion = true` — sabemos que el
// cliente pagó algo, pero no cuánto. Una fila fantasma (ver `esPagoReal`) no
// cuenta como "sin verificar": no es que no sepamos el monto, es que no hay
// pago.
export const pagoSinVerificar = (pago) => esPagoReal(pago) && (pago?.monto == null || pago?.monto_pendiente_verificacion === true)

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

// Reservas con precio unificado (oct 2026, caso Ana Lescano): varias reservas
// del mismo cliente comparten un solo precio pactado (`reserva_grupos`,
// `reservas.grupo_id`). Deliberadamente no se tocan pagos: un pago sigue
// contra UNA reserva puntual, el grupo solo cambia cómo se LEE el saldo/
// estado — se suman los pagos de todas las reservas del grupo contra el
// precio_total del grupo, nunca el valor_total individual de cada una.
export const esGrupo = (reserva) => !!reserva?.grupo_id && !!reserva?.reserva_grupos

// Todas las reservas que comparten el mismo grupo_id que `reserva` (ella
// incluida). Si no está agrupada, devuelve solo ella misma.
export function reservasDelGrupo(reserva, todasLasReservas) {
  if (!reserva?.grupo_id) return reserva ? [reserva] : []
  return (todasLasReservas || []).filter((r) => r.grupo_id === reserva.grupo_id)
}

// Saldo del grupo completo: precio_total del grupo menos la suma de los
// pagos vigentes de TODAS sus reservas. `pagosPorReserva` es el mapa
// reserva_id -> pagos[] que ya arma Clientes.jsx. Mismo contrato que
// saldoNumerico: null = no hay forma honesta de calcularlo (pago sin
// verificar en cualquiera de las reservas del grupo).
export function saldoGrupo(reserva, todasLasReservas, pagosPorReserva) {
  const grupo = reserva?.reserva_grupos
  if (!grupo) return null
  const miembros = reservasDelGrupo(reserva, todasLasReservas)
  const pagos = miembros.flatMap((r) => pagosPorReserva?.[r.id] || [])
  const vigentes = pagos.filter((p) => p.estado !== 'anulado')
  if (tienePagoSinVerificar(vigentes)) return null
  const pagado = vigentes.reduce((acc, p) => acc + Number(p.monto || 0), 0)
  return Math.max(Number(grupo.precio_total || 0) - pagado, 0)
}

// estado_pago equivalente para un grupo, misma semántica que la columna de
// una reserva suelta (pendiente / parcial / pagado) — pendiente_confirmacion
// y bonificada no aplican a un grupo (un grupo siempre tiene precio pactado).
export function estadoPagoGrupo(saldo, grupo) {
  if (saldo === null) return null
  if (saldo <= 0) return 'pagado'
  return Number(saldo) < Number(grupo.precio_total || 0) ? 'parcial' : 'pendiente'
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
      if (r.unidad_id !== unidadId || !reservaActiva(r)) return false
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

// Espejo de reserva_activa() en Postgres — mantener sincronizado. Único
// criterio de "esta reserva ocupa la unidad" en el front (Plano, Ocupación,
// impresión, selector de fecha): una reserva preconfirmada (web, sin
// compromiso) deja de ocupar en cuanto pasa su `vence_at`, aunque su
// `estado` todavía diga "activa" (el vencimiento lazy del lado del servidor
// solo corre sobre las unidades que una reserva nueva está pidiendo).
export function reservaActiva(reserva, ahora = new Date()) {
  if (!reserva || reserva.estado !== 'activa') return false
  if (!reserva.preconfirmada) return true
  if (!reserva.vence_at) return true
  return ahora < new Date(reserva.vence_at)
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

// ---------------------------------------------------------------------------
// Vistas para ReservaPagosCard (31/10/2026)
//
// La ficha de cliente muestra una sola tarjeta para TODO: grupo con precio
// unificado, temporada, período y día. Estas dos funciones normalizan esos
// dos casos a la misma forma, así el componente no tiene que saber cuál está
// dibujando.
// ---------------------------------------------------------------------------

const _fechasDe = (r, fmt) => {
  // "Temporada completa", no la temporada otra vez: el año ya está en el
  // encabezado de la tarjeta y repetirlo no agrega nada.
  if (r.tipo_alquiler === 'temporada') return 'Temporada completa'
  if (r.tipo_alquiler === 'dia') return fmt(r.fecha)
  return `${fmt(r.fecha_inicio)} — ${fmt(r.fecha_fin)}`
}

/** Los pagos anulados nunca se listan: viven en el Historial, no en la ficha. */
const _pagosVigentes = (lista = []) => [...lista]
  .filter((p) => p.estado !== 'anulado')
  .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))

export function vistaDeGrupo({ grupoId, reservasGrupo, reservas, pagosPorReserva, formatFecha }) {
  const grupo = reservasGrupo[0].reserva_grupos
  const saldo = saldoGrupo(reservasGrupo[0], reservas, pagosPorReserva)
  const pagado = Math.max(Number(grupo?.precio_total || 0) - (saldo ?? 0), 0)
  const pagos = _pagosVigentes(
    reservasGrupo.flatMap((r) => (pagosPorReserva[r.id] || []).map((p) => ({ ...p, __reserva: r }))),
  )
  const principal = reservasGrupo.find((r) => r.estado !== 'cancelada') || reservasGrupo[0]
  return {
    key: `grupo-${grupoId}`,
    esGrupo: true,
    tipo: principal.tipo_alquiler,
    temporada: grupo?.temporada || principal.temporada,
    estadoBadge: estadoPagoGrupo(saldo, grupo),
    precioTotal: grupo?.precio_total,
    pagado,
    saldo,
    sinPrecio: !(Number(grupo?.precio_total) > 0),
    cancelada: reservasGrupo.every((r) => r.estado === 'cancelada'),
    preconfirmada: false,
    pendienteConfirmacion: false,
    unidades: reservasGrupo.map((r) => ({
      key: r.id,
      tipo: r.unidades?.tipo,
      numero: r.unidades?.numero,
      fechas: _fechasDe(r, formatFecha),
      cancelada: r.estado === 'cancelada',
    })),
    pagos,
    socios: coSocios(principal),
    reservaPrincipal: principal,
  }
}

export function vistaDeReserva({ reserva, pagosPorReserva, formatFecha }) {
  const pagos = _pagosVigentes((pagosPorReserva[reserva.id] || []).map((p) => ({ ...p, __reserva: reserva })))
  const saldo = saldoNumerico(reserva, pagosPorReserva[reserva.id] || [])
  const { valorTotal, pendiente, bonificada } = montoInfo(reserva)
  const total = Number(valorTotal) || 0
  return {
    key: `reserva-${reserva.id}`,
    esGrupo: false,
    tipo: reserva.tipo_alquiler,
    temporada: reserva.temporada,
    estadoBadge: estadoBadgeStatus(reserva),
    precioTotal: total,
    pagado: saldo == null ? null : Math.max(total - saldo, 0),
    saldo,
    sinPrecio: !pendiente && !bonificada && !(total > 0),
    cancelada: reserva.estado === 'cancelada',
    preconfirmada: estadoBadgeStatus(reserva) === 'preconfirmada',
    pendienteConfirmacion: esPendienteConfirmacion(reserva),
    unidades: [{
      key: reserva.id,
      tipo: reserva.unidades?.tipo,
      numero: reserva.unidades?.numero,
      fechas: _fechasDe(reserva, formatFecha),
      cancelada: reserva.estado === 'cancelada',
    }],
    pagos,
    socios: coSocios(reserva),
    reservaPrincipal: reserva,
  }
}
