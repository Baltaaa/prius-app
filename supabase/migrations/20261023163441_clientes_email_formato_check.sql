-- Testing 23/10/2026, item 18: CHECK de formato de email en clientes, mismo
-- patrón que ya existe para dni/cuit (clientes_dni_formato_check /
-- clientes_cuit_formato_check) — NOT VALID para no fallar sobre datos
-- históricos ya cargados (auditado: 0 de 240 clientes con mail actual
-- rompería esta regla, pero se deja NOT VALID por las dudas con filas
-- futuras migradas). Mismo regex que EMAIL_REGEX en src/lib/parse.ts.
alter table clientes
  add constraint clientes_mail_formato_check
  check (mail is null or mail = '' or mail ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
  not valid;
