-- Un comprobante anulado no debe bloquear volver a cargar el mismo
-- tipo + punto_venta + numero (caso real: RB 1-3661 de Silvina Sasso,
-- anulado por error de monto, no se podía volver a cargar correctamente
-- porque la unicidad vieja contaba también los anulados).
-- Verificado antes de aplicar: no hay duplicados vigentes que rompan el
-- índice nuevo (0 filas con tipo+punto_venta+numero repetido entre no
-- anulados).
create unique index comprobantes_tipo_punto_venta_numero_vigente_key
  on comprobantes (tipo, punto_venta, numero)
  where estado <> 'anulado';

alter table comprobantes
  drop constraint comprobantes_tipo_punto_venta_numero_key;
