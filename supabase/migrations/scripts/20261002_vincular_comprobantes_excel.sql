-- Vinculación comprobantes <- Excel (TEMPORADA + PERIODOS), oct 2026.
-- Idempotente: ON CONFLICT (tipo, punto_venta, numero) DO NOTHING.
-- No toca caja_diaria (son pagos históricos, es_historico ya estaba en true/fecha<CAJA_INICIO).
begin;

-- Gustavo D´Agostino / Gabriela D´Agostino — sombrilla #1 — 'RB 1131  - RB 1136 - RB 1139 - 1146 - 1863'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1131', reserva_id_cliente.cliente_id, '158ebceb-be7c-4b6c-b587-587d09680820' from (select cliente_id from reservas where id = 'f449dc4f-1c80-4bca-bcb9-745e7639cd7a') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1136', reserva_id_cliente.cliente_id, '17c41ca1-fc79-42ca-aba7-bc36d1a09179' from (select cliente_id from reservas where id = 'f449dc4f-1c80-4bca-bcb9-745e7639cd7a') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1139', reserva_id_cliente.cliente_id, '8917d022-12db-4408-b9e4-64a35fc12de9' from (select cliente_id from reservas where id = 'f449dc4f-1c80-4bca-bcb9-745e7639cd7a') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1146', reserva_id_cliente.cliente_id, '70dccea3-21ee-4f45-8860-75c8b8192efb' from (select cliente_id from reservas where id = 'f449dc4f-1c80-4bca-bcb9-745e7639cd7a') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1863', reserva_id_cliente.cliente_id, '193dbc41-36ee-41a0-8cc1-a4a381d623ce' from (select cliente_id from reservas where id = 'f449dc4f-1c80-4bca-bcb9-745e7639cd7a') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- DIEGO MINOLDO — sombrilla #4 — 'RB 1250 - RB 1867'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1250', reserva_id_cliente.cliente_id, '17f422e1-9d85-400d-923a-7c0efca161be' from (select cliente_id from reservas where id = '9415de53-b636-4f16-8ad4-79cbbdfd856f') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1867', reserva_id_cliente.cliente_id, '7d87bd65-d5cd-44fb-92e2-4360b15715f2' from (select cliente_id from reservas where id = '9415de53-b636-4f16-8ad4-79cbbdfd856f') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Susana Gallego — sombrilla #5 — 'RB 1126 - RB 1871 - RB 1878'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1126', reserva_id_cliente.cliente_id, '3ff0ec53-5d2c-4172-b44e-af9f5f125835' from (select cliente_id from reservas where id = '0c14a106-1628-4e16-8501-9e4f635c58d4') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1871', reserva_id_cliente.cliente_id, '1554b6ec-f62f-43a0-969f-ba7fe5a26773' from (select cliente_id from reservas where id = '0c14a106-1628-4e16-8501-9e4f635c58d4') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1878', reserva_id_cliente.cliente_id, '18c7142c-8900-4f47-8059-c46c40477b60' from (select cliente_id from reservas where id = '0c14a106-1628-4e16-8501-9e4f635c58d4') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- SANDRA ALBIN / OSCAR DI PAOLA — sombrilla #7 — 'RB 1862 - RB 1876 - B 1882'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1862', reserva_id_cliente.cliente_id, '9bd86124-afc5-41f3-93ce-74077ebdccee' from (select cliente_id from reservas where id = '8165ddc8-b5f3-4ff4-97f0-835e42d2b1dd') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1876', reserva_id_cliente.cliente_id, 'f6f5a79d-fabf-4713-a41a-4c8ab7cab571' from (select cliente_id from reservas where id = '8165ddc8-b5f3-4ff4-97f0-835e42d2b1dd') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1882', reserva_id_cliente.cliente_id, '23f0fbfd-d0c3-49f2-9d0b-70b9c4b7769c' from (select cliente_id from reservas where id = '8165ddc8-b5f3-4ff4-97f0-835e42d2b1dd') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Valeria Moretto/ Fernando Gallotti — sombrilla #9 — 'RB 3659'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '3659', reserva_id_cliente.cliente_id, 'e31c9b4c-2993-4006-8189-ee1ad01d1654' from (select cliente_id from reservas where id = '3677447a-f848-4e86-8081-3ad6f7317971') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Nati/Adriana Andreu / Silvia Patrone / Sara Liebana — sombrilla #17 — 'RB 1149 - RB 1872 - RB 1879'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1149', reserva_id_cliente.cliente_id, '5b3d2442-7457-4825-bd88-a7ea197b6dfa' from (select cliente_id from reservas where id = '0bbc3bcf-4147-442f-80b6-dbb49782e327') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1872', reserva_id_cliente.cliente_id, 'aed51bf9-8f9a-4487-a6d2-765d4fc790d7' from (select cliente_id from reservas where id = '0bbc3bcf-4147-442f-80b6-dbb49782e327') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1879', reserva_id_cliente.cliente_id, 'ab13a8f3-e126-4804-8b47-ca5cacc4ad7e' from (select cliente_id from reservas where id = '0bbc3bcf-4147-442f-80b6-dbb49782e327') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Beatriz Recalde — sombrilla #25 — 'RB 3662'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '3662', reserva_id_cliente.cliente_id, '25fae5e3-b8a8-4f70-abc4-211217465617' from (select cliente_id from reservas where id = '67f8936a-ea6b-455c-a99e-45693563a302') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- AGUSTIN/FRANCA PIACENTINI — sombrilla #27 — 'RB 3660'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '3660', reserva_id_cliente.cliente_id, '3a096b88-0f65-400f-9cb7-c8f002a6754c' from (select cliente_id from reservas where id = 'b024344e-fe08-47fc-b5fe-4c92dc08b93a') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Agustina Cepeda / Ximena Elgarrista / Juan  — sombrilla #28 — 'RB 3658'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '3658', reserva_id_cliente.cliente_id, '3c1803af-1baa-40ed-b440-d76fe893acf1' from (select cliente_id from reservas where id = 'fd71eb5b-1ecc-4bf1-a98d-20c2ced54c3f') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Camila Diez/ Patricia / Mirta Bamonde  — sombrilla #31 — 'RB 1145'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1145', reserva_id_cliente.cliente_id, '5ed28519-21ad-42f4-9560-603769ef680a' from (select cliente_id from reservas where id = 'f51ac906-2f55-44ea-ade9-158f7cd44f3b') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Patrizi Eduardo - Alicia Fernandez  — sombrilla #37 — 'FB 713'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '713', reserva_id_cliente.cliente_id, '02c73cd4-66cc-4983-98dd-c848cf697775' from (select cliente_id from reservas where id = 'eaa3f40e-48fd-4fd4-9873-6ac4a4f9de79') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Silvana Gozzi / Irene Martinez — sombrilla #38 — 'RB 1120 - FB 703'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1120', reserva_id_cliente.cliente_id, 'd306e057-012d-4bdd-8f5d-c7e822424d10' from (select cliente_id from reservas where id = '7cb4a3fd-4fe0-4074-a958-b88833eaf412') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '703', reserva_id_cliente.cliente_id, 'b554f295-a484-4767-bf91-69fb1af765da' from (select cliente_id from reservas where id = '7cb4a3fd-4fe0-4074-a958-b88833eaf412') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- MATIAS SUAREZ — carpa #8 — 'FB 702 - RB 1118  - RB 1121'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '702', reserva_id_cliente.cliente_id, '7f66a566-05b1-407e-a146-7c96e6a797d3' from (select cliente_id from reservas where id = '60c46440-6bf6-45b6-86f1-158ee0597837') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1118', reserva_id_cliente.cliente_id, 'a1ec224c-0409-44a2-a3bb-8163a649e4d7' from (select cliente_id from reservas where id = '60c46440-6bf6-45b6-86f1-158ee0597837') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1121', reserva_id_cliente.cliente_id, '4b87e1c6-db61-4239-872e-c0af0330f2a9' from (select cliente_id from reservas where id = '60c46440-6bf6-45b6-86f1-158ee0597837') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- LUJAN SALAS / BRUNO STEFANINI — carpa #9 — 'RB 3651'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '3651', reserva_id_cliente.cliente_id, '50c9cac4-dfb8-4f9d-bc1e-dcd2eed98e1f' from (select cliente_id from reservas where id = '8a80c899-f829-4047-8310-b6ea6b6d51e7') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- IGNACIO ELICHIRIBEHTI - MACARENA ELICHIRIBEHTI  — carpa #10 — 'RB 1856'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1856', reserva_id_cliente.cliente_id, '2015fc2a-772f-4631-9b2d-4dd1f3b3d61d' from (select cliente_id from reservas where id = '34ef07d3-b3e0-4805-8b2c-86e64c0132d7') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- CECILIA JUAN / GISELA BOMBINI / VICTORIA GALLIUZI — carpa #14 — 'RB 1854'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1854', reserva_id_cliente.cliente_id, '74bc170a-65ef-4845-9643-1ea764cd97a4' from (select cliente_id from reservas where id = '3dfc9458-aff4-44ae-ac2d-f1711301632b') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Marita Reboredo  — carpa #21 — 'FB 696'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '696', reserva_id_cliente.cliente_id, '40cebb3c-4102-4257-b5a4-9085883b462c' from (select cliente_id from reservas where id = 'f866cab3-e4d7-4461-9d6f-79a697b5e63f') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Fiorella Speranza/ Josefina Valicenti — carpa #25 — 'RB 1108 - RB 1143'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1108', reserva_id_cliente.cliente_id, '90e0a670-3b38-4448-886a-80659325912c' from (select cliente_id from reservas where id = '3da64f35-efbc-4ce1-ba8d-e80d4de76bfc') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1143', reserva_id_cliente.cliente_id, '8ecad3c8-74bb-40af-a483-e17fbad12ca4' from (select cliente_id from reservas where id = '3da64f35-efbc-4ce1-ba8d-e80d4de76bfc') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- MERCEDES GOTTSCHALK / ALEJANDRO AHALLOUB / PABLO RIZZARDI / SILVINA MARTINEZ — carpa #28 — 'RB 1144 - FA 128'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1144', reserva_id_cliente.cliente_id, 'de2ec4b0-0301-4a6a-b1ec-2208dd789482' from (select cliente_id from reservas where id = 'b981054a-6ab2-442c-8bfa-fd70060523c3') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_a', 1, '128', reserva_id_cliente.cliente_id, '93ded7bf-4ae6-4d04-89a0-9d2a7d471fd9' from (select cliente_id from reservas where id = 'b981054a-6ab2-442c-8bfa-fd70060523c3') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Vanessa Staldeker / Florencia Sanchez — carpa #31 — 'RB 1141 - FB 722 - FB 720 - RB 1852'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1141', reserva_id_cliente.cliente_id, '2fbf42b5-c35b-41d7-adc0-55ed32b62da3' from (select cliente_id from reservas where id = 'a4959ad7-3b62-4f89-a1d0-a010806be553') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '722', reserva_id_cliente.cliente_id, '50b05b54-7814-40a0-9e41-70cdca2bc73f' from (select cliente_id from reservas where id = 'a4959ad7-3b62-4f89-a1d0-a010806be553') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '720', reserva_id_cliente.cliente_id, '29e4f330-9dea-48d1-8fe0-83e7ae994cc0' from (select cliente_id from reservas where id = 'a4959ad7-3b62-4f89-a1d0-a010806be553') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1852', reserva_id_cliente.cliente_id, 'dd6fd764-f11f-4d26-9913-a66fd537f852' from (select cliente_id from reservas where id = 'a4959ad7-3b62-4f89-a1d0-a010806be553') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Sabrina Agostinelli/ Claudia Enrique — carpa #32 — 'RB 1116'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1116', reserva_id_cliente.cliente_id, 'c9e6d308-0c54-4a48-af38-d7f353f5322b' from (select cliente_id from reservas where id = '26e58d3e-a1c0-46dc-b22e-cefd6fb28ba4') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Mari Marchessi — carpa #33 — 'FA 127'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_a', 1, '127', reserva_id_cliente.cliente_id, '8e60fc1b-1aa5-4cd2-92df-cdc53a27a04b' from (select cliente_id from reservas where id = '8e0989de-0f8c-4bf5-904e-4d18933708ed') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Sabrina Mateika/Francisco Gonzalez Calderon — carpa #36 — 'RB 3656'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '3656', reserva_id_cliente.cliente_id, 'e82a887f-2210-4a90-a46c-97fe6d51c4d0' from (select cliente_id from reservas where id = 'a81f7ab0-21de-4201-b16b-7744bf69a730') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Fernanda Elizalde /Silvia Lutteral/Marita Crespo  — carpa #40 — 'FB 707 - FB 709 - FB 714'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '707', reserva_id_cliente.cliente_id, '65b7e86e-e190-4957-ae3e-44eb3d04ab50' from (select cliente_id from reservas where id = '9b6c84f7-286b-4c37-9ba2-31cc0b3c7ff6') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '709', reserva_id_cliente.cliente_id, '69d2090a-c2d5-4a07-8279-a328aeebecf9' from (select cliente_id from reservas where id = '9b6c84f7-286b-4c37-9ba2-31cc0b3c7ff6') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '714', reserva_id_cliente.cliente_id, '9624e78b-d9eb-48c4-ac11-0305ad9b2b30' from (select cliente_id from reservas where id = '9b6c84f7-286b-4c37-9ba2-31cc0b3c7ff6') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Fernando Erdozain — carpa #41 — 'RB 1137 - RB 1884'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1137', reserva_id_cliente.cliente_id, 'ce177331-e063-412e-80de-70e06f7bc259' from (select cliente_id from reservas where id = '24ed89f3-4ee8-45b6-b3b6-0f3b4d154f8d') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1884', reserva_id_cliente.cliente_id, '5a9d0127-5106-4400-8e53-4401df22d612' from (select cliente_id from reservas where id = '24ed89f3-4ee8-45b6-b3b6-0f3b4d154f8d') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Jorge Pando  — carpa #43 — 'RB 1855 - RB 1857 - RB 1875 - RB 1880'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1855', reserva_id_cliente.cliente_id, '1a25c33a-a258-45dd-889f-2e09160a0c09' from (select cliente_id from reservas where id = '40e0e416-776c-4acd-bdc2-4f52429da2dc') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1857', reserva_id_cliente.cliente_id, '9d689469-77af-4898-82e8-741a07178393' from (select cliente_id from reservas where id = '40e0e416-776c-4acd-bdc2-4f52429da2dc') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1875', reserva_id_cliente.cliente_id, 'bad1939c-dcce-4b61-94f8-975cd3ed057b' from (select cliente_id from reservas where id = '40e0e416-776c-4acd-bdc2-4f52429da2dc') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1880', reserva_id_cliente.cliente_id, 'e847e006-1710-4c59-bd7e-31ee38478394' from (select cliente_id from reservas where id = '40e0e416-776c-4acd-bdc2-4f52429da2dc') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Marcelo Saldias — carpa #44 — 'FA 129'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_a', 1, '129', reserva_id_cliente.cliente_id, '7234568d-34b8-47dd-8a33-852336d2288b' from (select cliente_id from reservas where id = 'dac902e2-f543-4296-bb24-53ba15530b9e') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Juan Spiller — carpa #45 — 'RB 1128 - FB 719'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1128', reserva_id_cliente.cliente_id, 'f4f129f5-298e-4ea1-ad52-e331ff17116e' from (select cliente_id from reservas where id = '4b25ad8c-e082-43b9-9b52-bc7359cb24bd') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '719', reserva_id_cliente.cliente_id, 'd1d2b29a-5b96-453c-85cd-26cf90162f3a' from (select cliente_id from reservas where id = '4b25ad8c-e082-43b9-9b52-bc7359cb24bd') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Agustina Diaz /Sebastian Izus /Leo Barbano — carpa #46 — 'RB 1114'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1114', reserva_id_cliente.cliente_id, 'c57d9c29-63c9-41b1-b450-a488c00b579a' from (select cliente_id from reservas where id = 'd2926a9f-9831-4f6f-a2bc-92c8bf66688e') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- MYRIAM MOLINA/ CRISTIAN CARZOLIO — carpa #47 — 'RB 1142 - RB 1869'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1142', reserva_id_cliente.cliente_id, 'd17a0421-752b-4e0d-a33e-35d3d4036b12' from (select cliente_id from reservas where id = '49691007-6069-400d-a178-770ee5fa9a88') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1869', reserva_id_cliente.cliente_id, 'b96ef919-8c5a-45df-9a7f-856625930641' from (select cliente_id from reservas where id = '49691007-6069-400d-a178-770ee5fa9a88') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Alejandro Nieto — carpa #48 — 'RB 1117'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1117', reserva_id_cliente.cliente_id, '899ad01b-e046-4f16-b4c0-4078e6d6b3d7' from (select cliente_id from reservas where id = '2930e124-363f-495f-a3b2-a0aca2592282') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- LAMBERTINI / PIERANGELI — carpa #61 — 'RB 1123'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1123', reserva_id_cliente.cliente_id, '85c27d7a-5903-4ffc-ac80-9f4e4bb03d75' from (select cliente_id from reservas where id = '2cffc826-5043-407a-83cb-4e7423cd436e') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Liliana Fernandez / Ignacio Bonanata — carpa #63 — 'RB 1147'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1147', reserva_id_cliente.cliente_id, '5d27fea9-4b7e-48c3-920b-31270fecf680' from (select cliente_id from reservas where id = '24e0ad77-f9c0-4192-88a4-346a4b0090ad') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Gloria Bianco — carpa #68 — 'RB 1115'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1115', reserva_id_cliente.cliente_id, '8501eb81-77df-4313-accd-14f8f719da4b' from (select cliente_id from reservas where id = '81dd1de4-0f77-4a38-9ffa-f517b0624f3d') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Norma Seniza Puchi — carpa #71 — 'RB 3661'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '3661', reserva_id_cliente.cliente_id, 'cae14f39-7442-4c4b-a88a-db2f04bf3dad' from (select cliente_id from reservas where id = '17f7616a-a559-43d8-9632-16e1a124c42b') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Carolina Fortier  — carpa #81 — 'RB 1132 - RB 1864 - RB 1877'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1132', reserva_id_cliente.cliente_id, '2bdfb9d4-085a-49f2-b177-bd87f9530ab7' from (select cliente_id from reservas where id = 'cf33eeac-a015-4c3f-9a97-009ee3dcfbfb') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1864', reserva_id_cliente.cliente_id, 'f7d55c52-07bb-443d-97bc-6751799f76a6' from (select cliente_id from reservas where id = 'cf33eeac-a015-4c3f-9a97-009ee3dcfbfb') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1877', reserva_id_cliente.cliente_id, 'cde68dff-a047-48d8-878e-5524adb06472' from (select cliente_id from reservas where id = 'cf33eeac-a015-4c3f-9a97-009ee3dcfbfb') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Telma Jara - Alejandro Oliva - Diaz  — carpa #82 — 'FB 735 - RB 1890'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '735', reserva_id_cliente.cliente_id, 'c091c151-ebe4-47df-a5ec-f924df4ec793' from (select cliente_id from reservas where id = '9820ddaa-b13e-4512-a2e8-0708c7d45c49') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1890', reserva_id_cliente.cliente_id, '9c5fe9e3-3f56-4b9a-b2a6-e8771c234121' from (select cliente_id from reservas where id = '9820ddaa-b13e-4512-a2e8-0708c7d45c49') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Andrea Saccon — carpa #83 — 'RB 1112'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1112', reserva_id_cliente.cliente_id, 'e5c00a73-1707-444d-8ea9-5524f6423b1d' from (select cliente_id from reservas where id = '1d0421d6-49b6-45c0-899f-8cf64caa7a37') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Claudina Orunesu / Claudia Rodriguez / Adriana Olivera — carpa #89 — 'FB 711 - FB 712'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '711', reserva_id_cliente.cliente_id, '053b4b80-45c4-4a25-9869-d5f9a144ad24' from (select cliente_id from reservas where id = 'fd95179a-534b-4724-93ae-1ae7a2b50c48') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '712', reserva_id_cliente.cliente_id, 'f00ff2ab-6e57-459d-8202-125d00477860' from (select cliente_id from reservas where id = 'fd95179a-534b-4724-93ae-1ae7a2b50c48') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Martín Travesino  — carpa #91 — 'RB 1148 - RB 1853 - RB 1870'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1148', reserva_id_cliente.cliente_id, 'ac0b3d34-81e1-48be-8d85-b40a8221985f' from (select cliente_id from reservas where id = 'd44655c4-3142-4c65-b334-5bf6f187d540') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1853', reserva_id_cliente.cliente_id, '19ed5c43-f6be-46f2-9b09-cf72cbe2f9d7' from (select cliente_id from reservas where id = 'd44655c4-3142-4c65-b334-5bf6f187d540') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1870', reserva_id_cliente.cliente_id, 'df283e99-a07a-412f-a063-5d37445d0be9' from (select cliente_id from reservas where id = 'd44655c4-3142-4c65-b334-5bf6f187d540') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Monica Zappaterra / Pablo Szpyrnal — carpa #95 — 'FB 710'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '710', reserva_id_cliente.cliente_id, '3a655137-f904-4fb0-9cf6-69dd0e656962' from (select cliente_id from reservas where id = '8671107b-3c6b-4937-a0df-632256a0a5d5') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Bernardo Dalmasso / Maria — carpa #97 — 'RB 1874 - RB 1883'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1874', reserva_id_cliente.cliente_id, '0f02f053-61e2-41a8-b6b2-37f9a7174988' from (select cliente_id from reservas where id = 'c1f31512-5efc-42ce-bd57-2a584551f391') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1883', reserva_id_cliente.cliente_id, '397cee4f-2b39-454a-82f8-650543001cb2' from (select cliente_id from reservas where id = 'c1f31512-5efc-42ce-bd57-2a584551f391') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Navarro Granollers — carpa #105 — 'FB 706'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '706', reserva_id_cliente.cliente_id, '25adfc74-dfdd-4780-9da7-9f2c77af7c17' from (select cliente_id from reservas where id = 'e3c88644-6080-487f-bb16-b337be79dc8d') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- BELEN AMATO — carpa #115 — 'FB 704'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '704', reserva_id_cliente.cliente_id, 'd6b08bed-c14d-4057-a1c9-c30a2ddc756c' from (select cliente_id from reservas where id = 'b772a2b7-a3fd-49e9-9256-5c380cf1946b') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- SARA AZCARATE / GRACIELA FONTANETO / JORGE ETCHEPAREBORDA — carpa #129 — 'RB 1138 - RB 1868'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1138', reserva_id_cliente.cliente_id, '87c9984a-f23c-4cdb-8f70-f10cf09d86fa' from (select cliente_id from reservas where id = '9826342c-dcdc-4ba6-bcb8-b3307447e0b2') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1868', reserva_id_cliente.cliente_id, 'cc053ce6-4e10-43fa-adc3-707f1c6e6dda' from (select cliente_id from reservas where id = '9826342c-dcdc-4ba6-bcb8-b3307447e0b2') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Javier Fernandez — carpa #138 — 'RB 1130'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1130', reserva_id_cliente.cliente_id, 'a73a085c-f36a-4ae7-b4ed-cd72dadbe6f7' from (select cliente_id from reservas where id = '0bc6a703-55ae-414b-a3b5-e50c3b250782') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Guillermo Paredi /// Patricia — carpa #139 — 'RB 1859'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1859', reserva_id_cliente.cliente_id, '25d21cb5-c433-431e-8a2f-ee8fbddfe751' from (select cliente_id from reservas where id = '99856be7-5c38-465b-bf2d-90177f35c628') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Yanina Braschi / Vero Garrido / Maria Luque — carpa #142 — 'FB 728'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '728', reserva_id_cliente.cliente_id, '80abb137-2eb5-451d-add1-c13e91b1ce9e' from (select cliente_id from reservas where id = '812c285a-b9b5-4f93-a304-63e33d956f5b') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- Federico Iza — carpa #144 — 'RB 1865'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'recibo_b', 1, '1865', reserva_id_cliente.cliente_id, '7de850b6-df41-4272-8c60-8bc40cb1d098' from (select cliente_id from reservas where id = '5112abff-8ad0-4bf8-8b72-2c1b59c0b124') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

-- JUAN FRANCISCO LOSSINO — carpa #110 — 'FB 727'
insert into comprobantes (tipo, punto_venta, numero, cliente_id, pago_id) select 'factura_b', 1, '727', reserva_id_cliente.cliente_id, '2d1da588-367f-4e41-9c6a-dfa12397b6f6' from (select cliente_id from reservas where id = 'f95f2cb7-bcdc-48a2-9d79-0e93f7a8c924') as reserva_id_cliente on conflict (tipo, punto_venta, numero) do nothing;

commit;

-- Total INSERTs generados: 85