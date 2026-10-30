-- Punto 5 (30/10/2026) — ver detalle en el comentario de cada objeto.
-- Aplicada en producción vía MCP el 30/10/2026.

alter table public.leads
  add column if not exists telefono_normalizado text;

comment on column public.leads.telefono_normalizado is
  'E.164 (+549...) calculado con libphonenumber-js en el cliente / el trigger de abajo. NULL = no se pudo validar ("a revisar"). El original vive en `telefono`.';

create index if not exists leads_telefono_normalizado_idx
  on public.leads (telefono_normalizado)
  where telefono_normalizado is not null;

create or replace function public.fn_normalizar_telefono_ar(p_raw text)
returns text language plpgsql immutable as $$
declare d text; nac text;
begin
  if p_raw is null or btrim(p_raw) = '' then return null; end if;
  d := regexp_replace(p_raw, '\D', '', 'g');
  if d = '' then return null; end if;
  d := regexp_replace(d, '^0', '');
  d := regexp_replace(d, '^(\d{2,4})15(\d{6,8})$', '\1\2');
  nac := regexp_replace(d, '^54', '');
  nac := regexp_replace(nac, '^9', '');
  if length(nac) <> 10 then return null; end if;
  return '+549' || nac;
end;
$$;

create or replace function public.fn_leads_set_telefono_normalizado()
returns trigger language plpgsql as $$
begin
  if new.telefono is distinct from coalesce(old.telefono, null)
     or new.telefono_normalizado is null then
    new.telefono_normalizado := public.fn_normalizar_telefono_ar(new.telefono);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_telefono_normalizado on public.leads;
create trigger trg_leads_telefono_normalizado
  before insert or update of telefono on public.leads
  for each row execute function public.fn_leads_set_telefono_normalizado();
