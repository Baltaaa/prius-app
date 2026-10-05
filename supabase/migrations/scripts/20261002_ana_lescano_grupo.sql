-- Script de corrección de datos (NO migración de schema) — mostrar antes de
-- ejecutar, por pedido explícito del dueño del repo.
--
-- Ítem 1: Ana Lescano (cliente_id 58c5acd3-4bdf-4277-878b-be1555024ee0) tiene
-- 3 reservas de carpa 74 (01/01–31/01, 01/02–28/02, 01/03–10/03, temporada
-- 2026/2027) bajo un solo pactado de $3.100.000, comprobante RB-1891 —
-- today: 3 pagos con monto=null, comprobante_id=null ("MONTO NULO" / "SIN
-- PAGO" en pantalla). Este script arma el grupo nuevo (reserva_grupos, ver
-- migración 20261002120100) y consolida el pago real.

begin;

-- 1. Grupo con precio unificado
insert into reserva_grupos (cliente_id, temporada, precio_total, notas)
values (
  '58c5acd3-4bdf-4277-878b-be1555024ee0', '2026/2027', 3100000,
  'Migración Excel: 3 períodos de Carpa 74 bajo un pactado único, comprobante RB-1891.'
);

-- 2. Asociar las 3 reservas al grupo recién creado
update reservas set grupo_id = (
  select id from reserva_grupos where cliente_id = '58c5acd3-4bdf-4277-878b-be1555024ee0' and precio_total = 3100000
)
where id in (
  'b0664c3f-20b8-4f24-aa63-ce5887b73e03', -- 01/01 al 31/01
  'db2ac43f-3a49-4b56-a510-a57afc8a3952', -- 01/02 al 28/02
  'c272aab8-261b-4ad1-8ff4-41f6a0d0f93e'  -- 01/03 al 10/03
);

-- 3. Comprobante estructurado RB-1891 (antes solo texto libre en pagos.comprobante)
insert into comprobantes (tipo, punto_venta, numero, fecha, cliente_id, razon_social, cuit, condicion_iva, monto_total)
values ('recibo_b', 1, 1891, '2026-09-16', '58c5acd3-4bdf-4277-878b-be1555024ee0', null, null, 'consumidor_final', 3100000);

-- 4. Consolidar en UN pago real (el de enero) con el monto total y el comprobante.
-- monto_pendiente_verificacion=false: el migrado venía en true (monto
-- ambiguo); ahora el monto es real y verificado, si no queda la UI mostrando
-- "Monto nulo" encima de un monto que sí conocemos (bug detectado en QA).
update pagos set
  monto = 3100000, fecha = '2026-09-16', monto_pendiente_verificacion = false,
  comprobante_id = (select id from comprobantes where tipo = 'recibo_b' and numero = 1891)
where id = '2e1b3b50-bb4a-44ac-87a5-24b131e80581'; -- pago de la reserva de enero

-- 5. Los otros 2 pagos (monto null, mismo comprobante) quedan anulados —
-- nada se borra, se anula con motivo (ver CLAUDE.md "Borrado de datos raíz").
update pagos set
  estado = 'anulado',
  anulado_motivo = 'Consolidado en un solo pago bajo el grupo con precio unificado (reserva_grupos) — evita triplicar el monto real de $3.100.000, mismo comprobante RB-1891.',
  anulado_at = now()
where id in (
  '67652cd7-6796-4c1a-8d26-2b56012e7670', -- reserva de febrero
  '3b1c01dc-d3b4-4931-9f97-6dcdfb07e1ab'  -- reserva de marzo
);

-- Revisar antes del commit:
-- select r.id, r.grupo_id, r.saldo, r.estado_pago from reservas r where r.cliente_id = '58c5acd3-4bdf-4277-878b-be1555024ee0';
-- esperado: mismo grupo_id en las 3, saldo=0, estado_pago='pagado' en las 3 (trigger de 20261002120200)

commit; -- cambiar por ROLLBACK para solo previsualizar
