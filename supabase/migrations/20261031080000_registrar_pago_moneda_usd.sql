-- Punto 4, SEGUNDA ETAPA (31/10/2026). Aplicada en producción vía MCP.
--
-- `pagos.monto` sigue siendo el importe EN PESOS que usan saldos, triggers de
-- caja y reportes. `monto_ars` es una columna generada espejo de `monto`, así
-- que NINGÚN trigger cambió: los que leen `monto` ya leen el importe en pesos.
-- Para ARS el comportamiento es idéntico al anterior.
-- Para USD el cliente manda DÓLARES: la multiplicación la hace el servidor.
--
-- El cuerpo completo de fn_registrar_pago_interno y registrar_pago está en la
-- base; acá queda el registro del cambio. Puntos clave:
--   * 3 params nuevos con default: p_moneda ('ARS'), p_monto_original, p_tipo_cambio
--   * se borraron las versiones de 10 args para no dejar overloads ambiguos
--     en PostgREST; los 4 llamadores (crear_reserva, fn_crear_reserva_con_pago,
--     recepcion_cobrar, registrar_pago) resuelven contra la nueva usando defaults
--   * banda de +-30% contra fn_cotizacion_vigente() para atajar un dedazo en la
--     cotización editable (ej. 156 en vez de 1560)
--   * revoke execute from public, anon sobre el wrapper nuevo

create or replace function public.fn_cotizacion_vigente()
returns numeric language sql stable security definer set search_path = public as $$
  select case c.lado when 'compra' then tc.compra else tc.venta end
  from public.config_tipo_cambio c
  join public.tipos_cambio tc on tc.tipo = c.tipo
  order by tc.fecha desc limit 1;
$$;
