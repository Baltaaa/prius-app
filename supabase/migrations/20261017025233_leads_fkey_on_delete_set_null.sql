-- Borrado definitivo de leads (oct 2026): codigos_reserva.lead_id es
-- nullable y referencia leads sin ON DELETE — bloqueaba el borrado de
-- cualquier lead que haya generado una reserva web (ej. "Testing Jorge").
-- SET NULL es correcto: el código de reserva sigue existiendo (no se
-- borra una reserva real por borrar un lead), solo pierde el link al lead.
alter table codigos_reserva drop constraint codigos_reserva_lead_id_fkey;
alter table codigos_reserva add constraint codigos_reserva_lead_id_fkey
  foreign key (lead_id) references leads(id) on delete set null;
