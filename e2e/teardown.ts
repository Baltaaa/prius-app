// Tarea 8 (oct 2026) — teardown de los datos de prueba E2E. Borra TODO lo
// que haya quedado con el prefijo "E2E TEST" (clientes, sus reservas,
// pagos y comprobantes, y los eventos del Historial que generaron) para
// no ensuciar producción. Corre con las mismas credenciales de la cuenta
// de prueba (.env.local) — nunca con más permisos que los que ya tiene
// esa cuenta en la app real.
//
// Fase 2 (oct 2026) — reservas públicas: suma el borrado de los
// `codigos_reserva` que quedan huérfanos al borrar las reservas de
// clientes E2E TEST (la FK reservas.codigo no tiene cascade), y de los
// `leads` con nombre que empieza con el mismo prefijo (los que entran por
// la Edge Function lead-reserva, no por el form de contacto de n8n).
//
// Uso: npx tsx e2e/teardown.ts   (o node --import tsx si no hay tsx global)
import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function cargarEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
cargarEnvLocal()

const PREFIJO = 'E2E TEST'

export default async function teardown() {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!url || !anonKey || !email || !password) {
    console.error('Faltan variables en .env.local (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY/E2E_USER_EMAIL/E2E_USER_PASSWORD).')
    process.exit(1)
  }

  const supabase = createClient(url, anonKey)
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw authError

  // Leads de la Fase 2 (lead-reserva) pueden quedar sin cliente asociado
  // (form abandonado, sin disponibilidad): se borran solos por nombre, antes
  // de cualquier early-return por "no hay clientes E2E".
  const { data: leadsE2E, error: errLeads } = await supabase
    .from('leads').delete().ilike('nombre', `${PREFIJO}%`).select('id')
  if (errLeads) throw errLeads
  console.log(`Leads E2E borrados: ${(leadsE2E || []).length}`)

  const { data: clientes, error: errClientes } = await supabase
    .from('clientes').select('id').ilike('nombre', `${PREFIJO}%`)
  if (errClientes) throw errClientes
  const clienteIds = (clientes || []).map((c) => c.id)
  console.log(`Clientes E2E encontrados: ${clienteIds.length}`)
  if (clienteIds.length === 0) {
    console.log('Nada más para borrar.')
    return
  }

  const { data: reservas } = await supabase.from('reservas').select('id, codigo').in('cliente_id', clienteIds)
  const reservaIds = (reservas || []).map((r) => r.id)
  const codigosReserva = [...new Set((reservas || []).map((r) => r.codigo).filter(Boolean))]
  console.log(`Reservas E2E: ${reservaIds.length}`)

  const { data: pagos } = reservaIds.length
    ? await supabase.from('pagos').select('id').or(`cliente_id.in.(${clienteIds.join(',')}),reserva_id.in.(${reservaIds.join(',')})`)
    : await supabase.from('pagos').select('id').in('cliente_id', clienteIds)
  const pagoIds = (pagos || []).map((p) => p.id)
  console.log(`Pagos E2E: ${pagoIds.length}`)

  // Orden: comprobantes -> pagos -> reservas -> eventos -> clientes.
  if (pagoIds.length) {
    await supabase.from('comprobantes').delete().in('pago_id', pagoIds)
    await supabase.from('pagos').delete().in('id', pagoIds)
  }
  if (reservaIds.length) {
    await supabase.from('reservas').delete().in('id', reservaIds)
  }
  if (codigosReserva.length) {
    await supabase.from('codigos_reserva').delete().in('codigo', codigosReserva)
    console.log(`Códigos de reserva E2E: ${codigosReserva.length}`)
  }
  await supabase.from('eventos').delete().or(`cliente_id.in.(${clienteIds.join(',')}),registro_id.in.(${clienteIds.join(',')}${reservaIds.length ? ',' + reservaIds.join(',') : ''})`)
  await supabase.from('vistas_recientes').delete().in('entidad_id', [...clienteIds, ...reservaIds])
  const { error: errDelCliente } = await supabase.from('clientes').delete().in('id', clienteIds)
  if (errDelCliente) throw errDelCliente

  console.log('Teardown E2E completo.')
}

// Para correrlo a mano (npm run test:e2e:teardown) además de automático
// al final de la suite (globalTeardown en playwright.config.ts).
if (process.argv[1]?.includes('teardown')) {
  teardown().catch((err) => { console.error(err); process.exit(1) })
}
