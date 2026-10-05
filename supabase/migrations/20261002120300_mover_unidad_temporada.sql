-- Ítem 5: mover un cliente de temporada de una unidad a otra desde el Plano
-- exige confirmación de superadmin con su propia contraseña — la validación
-- de rol y la verificación de contraseña ocurren ACÁ, server-side, con
-- SECURITY DEFINER: un usuario no-superadmin no puede ejecutar esto ni
-- manipulando el frontend (es_superadmin() ya existe, se reutiliza — ver
-- es_admin()). pgcrypto ya está instalado en el proyecto.
create or replace function public.mover_unidad_temporada(
  p_reserva_id uuid,
  p_unidad_destino_id uuid,
  p_password text
)
returns reservas
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva reservas;
  v_password_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.';
  end if;
  if not es_superadmin() then
    raise exception 'Esta acción requiere un usuario superadmin.';
  end if;

  select exists (
    select 1 from auth.users
    where id = auth.uid() and encrypted_password = extensions.crypt(p_password, encrypted_password)
  ) into v_password_ok;
  if not v_password_ok then
    raise exception 'Contraseña incorrecta.';
  end if;

  select * into v_reserva from reservas where id = p_reserva_id;
  if not found then
    raise exception 'La reserva no existe.';
  end if;
  if v_reserva.bloqueada then
    raise exception 'La reserva está bloqueada — desbloqueala primero.';
  end if;
  if v_reserva.tipo_alquiler <> 'temporada' then
    raise exception 'Esta acción es solo para reservas de temporada.';
  end if;

  if exists (
    select 1 from reservas
    where unidad_id = p_unidad_destino_id and estado = 'activa' and tipo_alquiler = 'temporada' and id <> p_reserva_id
  ) then
    raise exception 'La unidad destino ya tiene un cliente de temporada activo.';
  end if;

  update reservas set unidad_id = p_unidad_destino_id where id = p_reserva_id returning * into v_reserva;

  return v_reserva;
end;
$function$;

-- CREATE OR REPLACE crea la función sin grants — hay que otorgarlos a mano
-- (y nunca de más: solo EXECUTE a authenticated, ver CLAUDE.md "Seguridad").
revoke all on function public.mover_unidad_temporada(uuid, uuid, text) from public, anon;
grant execute on function public.mover_unidad_temporada(uuid, uuid, text) to authenticated;
