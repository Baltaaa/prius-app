-- ---------------------------------------------------------- registrar_gasto
-- Nueva firma: la categoría se elige por id (tabla administrable) y el tipo
-- de comprobante F / SF es obligatorio. `comprobante_proveedor` sigue siendo
-- el número de factura (no se duplicó la columna).
drop function if exists public.registrar_gasto(text, text, text, numeric, text, text);

create or replace function public.registrar_gasto(
  p_concepto         text,
  p_categoria_id     uuid,
  p_medio_pago       text,
  p_monto            numeric,
  p_tipo_comprobante text,
  p_proveedor        text default null,
  p_numero_factura   text default null,
  p_letra_factura    text default null
) returns gastos_caja
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_caja_id uuid;
  v_gasto   gastos_caja;
  v_fecha   date := public.fn_hoy_ar();
  v_activa  boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto tiene que ser mayor a 0.'; end if;

  if p_tipo_comprobante is null or p_tipo_comprobante not in ('F', 'SF') then
    raise exception 'Elegí si el gasto es con factura (F) o sin factura (SF).';
  end if;

  select activa into v_activa from categorias_gasto where id = p_categoria_id;
  if v_activa is null then raise exception 'Elegí una categoría para el gasto.'; end if;
  if not v_activa then raise exception 'Esa categoría está desactivada.'; end if;

  -- Con factura el proveedor es obligatorio; sin factura, opcional. El número
  -- y la letra solo se guardan cuando el gasto es F.
  if p_tipo_comprobante = 'F' and coalesce(trim(p_proveedor), '') = '' then
    raise exception 'Un gasto con factura necesita el proveedor.';
  end if;

  v_caja_id := fn_resolver_caja_id(v_fecha);

  insert into gastos_caja (
    caja_id, descripcion, categoria_id, medio_pago, monto, proveedor,
    tipo_comprobante, comprobante_proveedor, letra_factura, estado, registrado_por
  ) values (
    v_caja_id, p_concepto, p_categoria_id, p_medio_pago, p_monto, nullif(trim(p_proveedor), ''),
    p_tipo_comprobante,
    case when p_tipo_comprobante = 'F' then nullif(trim(p_numero_factura), '') end,
    case when p_tipo_comprobante = 'F' then nullif(trim(p_letra_factura), '') end,
    'vigente', auth.uid()
  ) returning * into v_gasto;

  perform fn_recalcula_totales_caja(v_caja_id);

  return v_gasto;
end;
$$;

revoke all on function public.registrar_gasto(text, uuid, text, numeric, text, text, text, text) from public, anon;
grant execute on function public.registrar_gasto(text, uuid, text, numeric, text, text, text, text) to authenticated;

-- ------------------------------------------------------------- editar_gasto
-- Corrección de un gasto ya cargado: tipo F/SF, categoría, proveedor y datos
-- de factura. Funciona aunque la caja esté cerrada (misma regla que la
-- corrección de comprobantes de pagos: la caja lee los datos en vivo, el
-- "contado" del arqueo no se toca). Solo superadmin, y solo a través del
-- dispatcher `fn_ejecutar_accion_superadmin`, que ya exige la contraseña.
create or replace function public.editar_gasto(
  p_gasto_id         uuid,
  p_categoria_id     uuid default null,
  p_tipo_comprobante text default null,
  p_proveedor        text default null,
  p_numero_factura   text default null,
  p_letra_factura    text default null,
  p_concepto         text default null
) returns gastos_caja
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_gasto  gastos_caja;
  v_tipo   text;
  v_prov   text;
  v_activa boolean;
begin
  if not es_superadmin() then
    raise exception using errcode = '42501', message = 'Solo superadmin puede corregir un gasto.';
  end if;

  select * into v_gasto from gastos_caja where id = p_gasto_id;
  if not found then raise exception 'Gasto no encontrado.'; end if;
  if v_gasto.estado <> 'vigente' then raise exception 'El gasto está anulado.'; end if;

  v_tipo := coalesce(nullif(p_tipo_comprobante, ''), v_gasto.tipo_comprobante);
  if v_tipo not in ('F', 'SF') then raise exception 'Tipo de comprobante inválido.'; end if;

  if p_categoria_id is not null then
    select activa into v_activa from categorias_gasto where id = p_categoria_id;
    if v_activa is null then raise exception 'Categoría inexistente.'; end if;
  end if;

  -- Un proveedor en blanco explícito borra el dato; null deja el que estaba.
  v_prov := case when p_proveedor is null then v_gasto.proveedor else nullif(trim(p_proveedor), '') end;
  if v_tipo = 'F' and coalesce(v_prov, '') = '' then
    raise exception 'Un gasto con factura necesita el proveedor.';
  end if;

  update gastos_caja set
    categoria_id          = coalesce(p_categoria_id, categoria_id),
    tipo_comprobante      = v_tipo,
    proveedor             = v_prov,
    comprobante_proveedor = case when v_tipo = 'F'
                                 then coalesce(nullif(trim(p_numero_factura), ''), comprobante_proveedor)
                                 else null end,
    letra_factura         = case when v_tipo = 'F'
                                 then coalesce(nullif(trim(p_letra_factura), ''), letra_factura)
                                 else null end,
    descripcion           = coalesce(nullif(trim(p_concepto), ''), descripcion)
  where id = p_gasto_id
  returning * into v_gasto;

  return v_gasto;
end;
$$;

revoke all on function public.editar_gasto(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;

-- ------------------------------------------------- categorías (configuración)
create or replace function public.guardar_categoria_gasto(
  p_id     uuid default null,
  p_nombre text default null,
  p_orden  integer default null,
  p_activa boolean default null
) returns categorias_gasto
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_cat  categorias_gasto;
  v_slug text;
begin
  if not es_superadmin() then
    raise exception using errcode = '42501', message = 'Solo superadmin puede administrar las categorías.';
  end if;

  if p_id is null then
    if coalesce(trim(p_nombre), '') = '' then raise exception 'La categoría necesita un nombre.'; end if;
    -- Slug estable derivado del nombre: es lo que queda guardado en los gastos.
    -- Sin la extensión unaccent: se traducen a mano las vocales con tilde y la ñ.
    v_slug := translate(lower(trim(p_nombre)), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
    v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '_', 'g');
    v_slug := trim(both '_' from v_slug);
    if v_slug = '' then raise exception 'Ese nombre no sirve como categoría.'; end if;
    if exists (select 1 from categorias_gasto where slug = v_slug) then
      raise exception 'Ya existe una categoría con ese nombre.';
    end if;
    insert into categorias_gasto (slug, nombre, orden, activa)
    values (v_slug, trim(p_nombre), coalesce(p_orden, 100), coalesce(p_activa, true))
    returning * into v_cat;
  else
    update categorias_gasto set
      nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
      orden  = coalesce(p_orden, orden),
      activa = coalesce(p_activa, activa)
    where id = p_id
    returning * into v_cat;
    if not found then raise exception 'Categoría no encontrada.'; end if;
  end if;

  return v_cat;
end;
$$;

revoke all on function public.guardar_categoria_gasto(uuid, text, integer, boolean) from public, anon;
grant execute on function public.guardar_categoria_gasto(uuid, text, integer, boolean) to authenticated;

-- ------------------------------------- editar_gasto en el dispatcher superadmin
-- Corregir un gasto de una caja cerrada es sensible: va por el mismo camino
-- que anular un pago o editar un comprobante (contraseña + registro).
create or replace function public.fn_ejecutar_accion_superadmin(p_user_id uuid, p_accion text, p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (
    select 1 from perfiles where user_id = p_user_id and activo = true and rol = 'superadmin'
  ) then
    raise exception using errcode = '42501', message = 'Solo superadmin puede ejecutar esta acción';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  case p_accion
    when 'eliminar_reserva' then
      perform fn_eliminar_reserva((p_params->>'reserva_id')::uuid);
    when 'eliminar_cliente' then
      perform fn_eliminar_cliente((p_params->>'cliente_id')::uuid);
    when 'quitar_cosocio' then
      perform fn_quitar_cosocio((p_params->>'reserva_id')::uuid, (p_params->>'cliente_id')::uuid);
    when 'eliminar_lead' then
      perform fn_eliminar_lead((p_params->>'lead_id')::uuid);
    when 'anular_pago' then
      perform anular_pago((p_params->>'pago_id')::uuid, p_params->>'motivo');
    when 'editar_comprobante' then
      perform editar_comprobante(
        (p_params->>'comprobante_id')::uuid,
        (p_params->>'monto')::numeric,
        nullif(p_params->>'fecha', '')::date,
        nullif(p_params->>'tipo', '')
      );
    when 'editar_gasto' then
      perform editar_gasto(
        (p_params->>'gasto_id')::uuid,
        nullif(p_params->>'categoria_id', '')::uuid,
        nullif(p_params->>'tipo_comprobante', ''),
        p_params->>'proveedor',
        p_params->>'numero_factura',
        nullif(p_params->>'letra_factura', ''),
        nullif(p_params->>'concepto', '')
      );
    when 'editar_monto_pago_vigente' then
      perform fn_editar_monto_pago_vigente((p_params->>'pago_id')::uuid, (p_params->>'monto')::numeric);
    when 'cambiar_estado_pago_manual' then
      perform cambiar_estado_pago_manual((p_params->>'reserva_id')::uuid, p_params->>'nuevo_estado', p_params->>'motivo');
    when 'revertir_estado_pago_automatico' then
      perform revertir_estado_pago_automatico((p_params->>'reserva_id')::uuid);
    when 'reabrir_caja' then
      perform reabrir_caja((p_params->>'caja_id')::uuid, p_params->>'motivo');
    else
      raise exception 'Acción superadmin no reconocida: %', p_accion;
  end case;

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------- resumen_caja con egresos F / SF
-- El cuerpo original de resumen_caja no se reescribe (es largo y lo consumen
-- la pantalla de Caja, la impresión A4, el CSV y el snapshot de cierre): se
-- renombra a fn_resumen_caja_base y `resumen_caja` queda como un envoltorio
-- que reemplaza SOLO el bloque `gastos` por la versión con F / SF, subtotales
-- y desglose por categoría. Las claves viejas (`por_categoria.categoria`,
-- `por_categoria.total`, `detalle.*`) se mantienen, así que nada de lo que ya
-- leía el resumen se rompe.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fn_resumen_caja_base'
  ) then
    alter function public.resumen_caja(uuid) rename to fn_resumen_caja_base;
  end if;
end $$;

create or replace function public.resumen_caja(p_caja_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_base      jsonb;
  v_cerrada   timestamptz;
  v_total     numeric;
  v_f         numeric;
  v_sf        numeric;
  v_cant      integer;
  v_cant_f    integer;
  v_cant_sf   integer;
  v_categoria jsonb;
  v_detalle   jsonb;
begin
  v_base := public.fn_resumen_caja_base(p_caja_id);
  select cerrada_at into v_cerrada from caja_diaria where id = p_caja_id;

  select
    coalesce(sum(monto), 0),
    coalesce(sum(monto) filter (where tipo_comprobante = 'F'), 0),
    coalesce(sum(monto) filter (where tipo_comprobante = 'SF'), 0),
    count(*),
    count(*) filter (where tipo_comprobante = 'F'),
    count(*) filter (where tipo_comprobante = 'SF')
  into v_total, v_f, v_sf, v_cant, v_cant_f, v_cant_sf
  from gastos_caja where caja_id = p_caja_id and estado = 'vigente';

  select coalesce(jsonb_agg(t order by t->>'nombre'), '[]'::jsonb) into v_categoria
  from (
    select jsonb_build_object(
      'categoria',   g.categoria,
      'nombre',      coalesce(c.nombre, g.categoria),
      'total',       sum(g.monto),
      'total_f',     coalesce(sum(g.monto) filter (where g.tipo_comprobante = 'F'), 0),
      'total_sf',    coalesce(sum(g.monto) filter (where g.tipo_comprobante = 'SF'), 0),
      'cantidad',    count(*)
    ) as t
    from gastos_caja g
    left join categorias_gasto c on c.id = g.categoria_id
    where g.caja_id = p_caja_id and g.estado = 'vigente'
    group by g.categoria, c.nombre
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'gasto_id', g.id, 'fecha_hora', g.created_at, 'concepto', g.descripcion,
    'categoria', g.categoria, 'categoria_nombre', coalesce(c.nombre, g.categoria),
    'medio_pago', g.medio_pago, 'monto', g.monto, 'proveedor', g.proveedor, 'estado', g.estado,
    'tipo_comprobante', g.tipo_comprobante,
    'numero_factura', g.comprobante_proveedor,
    'letra_factura', g.letra_factura,
    'tras_cierre', (v_cerrada is not null and g.created_at > v_cerrada)
  ) order by g.created_at), '[]'::jsonb) into v_detalle
  from gastos_caja g
  left join categorias_gasto c on c.id = g.categoria_id
  where g.caja_id = p_caja_id and g.estado = 'vigente';

  return v_base || jsonb_build_object('gastos', jsonb_build_object(
    'total',        v_total,
    'total_f',      v_f,
    'total_sf',     v_sf,
    -- null (no 0) cuando no hubo egresos: la UI dice "sin datos", no "0%".
    'pct_sf',       case when v_total = 0 then null else round(100 * v_sf / v_total, 1) end,
    'cantidad',     v_cant,
    'cantidad_f',   v_cant_f,
    'cantidad_sf',  v_cant_sf,
    'por_categoria', v_categoria,
    'detalle',       v_detalle
  ));
end;
$$;

revoke all on function public.resumen_caja(uuid) from public, anon;
grant execute on function public.resumen_caja(uuid) to authenticated;
grant execute on function public.fn_resumen_caja_base(uuid) to authenticated;
