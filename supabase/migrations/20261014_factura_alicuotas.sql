-- ════════════════════════════════════════════════════════════════════════════
-- APERTURA DE IVA POR ALÍCUOTA — Sistema Agro
-- ----------------------------------------------------------------------------
-- Una factura puede tener varias alícuotas (ej. semilla 10,5% + agroquímico
-- 21%). Cada fila de factura_alicuotas es una alícuota de una factura.
--   alícuota 0   → importe exento (va al campo "exentas" del TXT de ARCA)
--   alícuota > 0 → una fila en LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS
--
-- Importes:
--   neto_original / iva_original → en la moneda de la factura (USD o ARS).
--                                   Es lo que va al TXT de ARCA.
--   neto_ars / iva_ars           → pesificados con el dólar de la factura.
--
-- Las facturas viejas no necesitan filas: el sistema sigue leyendo
-- facturas.alicuota_iva / monto_neto / monto_iva cuando no hay apertura.
--
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- La columna factura_id se crea con el MISMO tipo que facturas.id (uuid o
-- bigint, según cómo se haya creado la tabla original).
do $$
declare v_tipo text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_tipo
  from pg_attribute a
  where a.attrelid = 'public.facturas'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists factura_alicuotas (
      id            uuid primary key default gen_random_uuid(),
      factura_id    %s not null references facturas(id) on delete cascade,
      alicuota      numeric(5,2) not null check (alicuota in (0, 2.5, 5, 10.5, 21, 27)),
      neto_original numeric(18,2) not null default 0,
      iva_original  numeric(18,2) not null default 0,
      neto_ars      numeric(18,2) not null default 0,
      iva_ars       numeric(18,2) not null default 0,
      orden         int not null default 0,
      created_at    timestamptz not null default now(),
      unique (factura_id, alicuota)
    )$f$, v_tipo);
end $$;

create index if not exists factura_alicuotas_factura_idx on factura_alicuotas(factura_id);

alter table factura_alicuotas enable row level security;
drop policy if exists "auth_all" on factura_alicuotas;
create policy "auth_all" on factura_alicuotas for all to authenticated using (true) with check (true);

-- Control: facturas cuya apertura no suma igual que la cabecera (en ARS).
-- Debería estar vacía o con diferencias de centavos.
create or replace view factura_alicuotas_descuadres as
  select f.id, f."Fecha", f."Numero_factura",
         round(coalesce(f.monto_neto, 0), 2)                          as neto_cabecera,
         sum(a.neto_ars)                                              as neto_alicuotas,
         round(coalesce(f.monto_iva, 0), 2)                           as iva_cabecera,
         sum(a.iva_ars)                                               as iva_alicuotas
  from facturas f
  join factura_alicuotas a on a.factura_id = f.id
  group by f.id
  having abs(round(coalesce(f.monto_neto, 0), 2) - sum(a.neto_ars)) > 1
      or abs(round(coalesce(f.monto_iva, 0), 2)  - sum(a.iva_ars))  > 1;
