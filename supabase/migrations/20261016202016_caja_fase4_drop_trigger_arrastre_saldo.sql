-- Causa real reencontrada (oct 2026): este trigger BEFORE INSERT/UPDATE
-- reintroducía el arrastre de saldo_apertura (= total_neto del día
-- anterior) en cada caja_diaria nueva, y pisaba total_neto en cada UPDATE
-- (incluidas las de fn_recalcula_totales_caja) sumándole ese arrastre —
-- exactamente la regla que la Tarea 3 vino a eliminar ("toda caja empieza
-- en 0, nunca se arrastra"). No se había visto en la primera pasada porque
-- no apareció en la búsqueda de funciones por nombre conocido.
drop trigger if exists trg_caja_calcula_totales on caja_diaria;
drop function if exists fn_caja_calcula_totales();

-- Corrige la caja de hoy, ya contaminada por el trigger antes de dropearlo.
update caja_diaria set saldo_apertura = 0 where fecha >= fn_caja_inicio() and saldo_apertura <> 0;

do $$
declare v_id uuid;
begin
  for v_id in select id from caja_diaria where fecha >= fn_caja_inicio() loop
    perform fn_recalcula_totales_caja(v_id);
  end loop;
end $$;
