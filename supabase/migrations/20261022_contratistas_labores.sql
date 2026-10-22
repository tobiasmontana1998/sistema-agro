-- ════════════════════════════════════════════════════════════════════════════
-- FACTURAS DE CONTRATISTA ↔ LABORES — Sistema Agro
-- ----------------------------------------------------------------------------
-- - Cada labor sabe quién la hizo (labores.contratista_id) o si fue propia
--   (labores.labor_propia).
-- - Una factura de servicios puede cubrir VARIAS labores (ej. pulverización en
--   3 lotes): tabla factura_labores. El neto se reparte entre esas labores en
--   proporción a sus hectáreas, y cada parte va a Sementeras del lote y la
--   campaña de su labor.
-- - facturas."Labor_id" se sigue usando (primera labor) para compatibilidad.
--
-- Requiere 20261022_costeo_stock_labores.sql.
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Contratista / labor propia en labores ────────────────────────────────
do $$
declare v_tipo text;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'labores' and column_name = 'contratista_id') then
    select format_type(a.atttypid, a.atttypmod) into v_tipo
      from pg_attribute a where a.attrelid = 'public.proveedores'::regclass and a.attname = 'id';
    execute format('alter table labores add column contratista_id %s references proveedores(id) on delete set null', v_tipo);
  end if;
end $$;
alter table labores add column if not exists labor_propia boolean not null default false;

-- Labores que ya tienen factura vinculada: su contratista es el de la factura
update labores l set contratista_id = f.proveedor_id
  from facturas f
 where f."Labor_id" = l.id and l.contratista_id is null and f.proveedor_id is not null;

-- ── 2. Tabla factura_labores (una factura → varias labores) ─────────────────
do $$
declare v_tf text; v_tl text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_tf from pg_attribute a where a.attrelid = 'public.facturas'::regclass and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into v_tl from pg_attribute a where a.attrelid = 'public.labores'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists factura_labores (
      id         uuid primary key default gen_random_uuid(),
      factura_id %s not null references facturas(id) on delete cascade,
      labor_id   %s not null references labores(id) on delete cascade,
      hectareas  numeric,             -- para el reparto; si es null usa las ha de la labor
      created_at timestamptz not null default now(),
      unique (factura_id, labor_id)
    )$f$, v_tf, v_tl);
end $$;
alter table factura_labores enable row level security;
drop policy if exists "auth_all" on factura_labores;
create policy "auth_all" on factura_labores for all to authenticated using (true) with check (true);

-- Las facturas que ya tenían Labor_id pasan también a factura_labores
insert into factura_labores (factura_id, labor_id)
select f.id, f."Labor_id" from facturas f
 where f."Labor_id" is not null
on conflict (factura_id, labor_id) do nothing;

-- ── 3. Reparto del neto de la factura entre sus labores ─────────────────────
create or replace function contab_split_factura_labores(p_id text) returns void
language plpgsql as $$
declare
  v_as uuid; ln record; r record;
  v_total numeric; v_tot_ha numeric; v_acum numeric := 0; v_parte numeric; v_n int; v_i int := 0;
begin
  select id into v_as from asientos where origen_tipo = 'factura' and origen_id = p_id;
  if v_as is null then return; end if;
  select count(*) into v_n from factura_labores where factura_id::text = p_id;
  if v_n = 0 then return; end if;

  -- línea del neto que la regla general mandó a Sementeras
  select l.* into ln from asiento_lineas l join cuentas c on c.id = l.cuenta_id
   where l.asiento_id = v_as and c.codigo = '1.1.4.03' limit 1;
  if not found then return; end if;  -- la factura tiene otra cuenta elegida a mano

  v_total := ln.debe - ln.haber;
  select sum(coalesce(fl.hectareas, lb.hectareas, 1)) into v_tot_ha
    from factura_labores fl join labores lb on lb.id = fl.labor_id where fl.factura_id::text = p_id;
  if coalesce(v_tot_ha, 0) = 0 then v_tot_ha := v_n; end if;

  delete from asiento_lineas where id = ln.id;
  for r in
    select fl.labor_id::text as lab, lb."Lote_id"::text as lote, lb.campania_id::text as camp,
           coalesce(fl.hectareas, lb.hectareas, 1) as ha
      from factura_labores fl join labores lb on lb.id = fl.labor_id
     where fl.factura_id::text = p_id
     order by lb."Fecha", fl.labor_id
  loop
    v_i := v_i + 1;
    v_parte := case when v_i = v_n then v_total - v_acum
                    else round(v_total * r.ha / v_tot_ha, 2) end;
    v_acum := v_acum + v_parte;
    perform contab_linea(v_as, '1.1.4.03', v_parte, ln.tipo_cambio, ln.actividad_id, r.lote, r.lab,
                         ln.proveedor_id, concat_ws(' ', ln.detalle, '(' || trim(to_char(r.ha, 'FM999G990D00')) || ' ha)'));
  end loop;
end $$;

-- Asiento completo de una factura: regla general + reparto + campaña
create or replace function contab_asiento_factura_full(p_id text) returns void
language plpgsql as $$
begin
  perform contab_asiento_factura(p_id);
  perform contab_split_factura_labores(p_id);
  update asiento_lineas al set campania_id = l.campania_id::text
    from asientos a, labores l
   where a.id = al.asiento_id and a.origen_tipo = 'factura' and a.origen_id = p_id
     and al.labor_id is not null and l.id::text = al.labor_id;
end $$;

-- Trigger en factura_labores
create or replace function trg_factura_labores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform contab_asiento_factura_full(coalesce(new.factura_id, old.factura_id)::text);
    if tg_op = 'UPDATE' and new.factura_id is distinct from old.factura_id then
      perform contab_asiento_factura_full(old.factura_id::text);
    end if;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error)
    values ('factura', coalesce(new.factura_id, old.factura_id)::text, sqlerrm);
  end;
  return null;
end $$;
drop trigger if exists factura_labores_contab on factura_labores;
create trigger factura_labores_contab after insert or update or delete on factura_labores
  for each row execute function trg_factura_labores();

-- ── 4. Triggers y "Regenerar" usando el asiento completo ────────────────────
create or replace function contab_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text := tg_argv[0]; v_id text;
begin
  v_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  begin
    if tg_op = 'DELETE' then
      delete from asientos where origen_tipo = v_tipo and origen_id = v_id;
    elsif v_tipo = 'factura' then
      perform contab_asiento_factura_full(v_id);
      perform contab_asiento_pago(pf.id::text) from pagos_facturas pf where pf.factura_id::text = v_id;
    elsif v_tipo = 'pago' then
      perform contab_asiento_pago(v_id);
    elsif v_tipo = 'aporte' then
      perform contab_asiento_aporte(v_id);
    end if;
    perform contab_asiento_apertura();
    delete from asientos_errores where origen_tipo = v_tipo and origen_id = v_id;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error) values (v_tipo, v_id, sqlerrm);
  end;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function contab_regenerar_todo() returns json
language plpgsql security definer set search_path = public as $$
declare r record; v_ok int := 0; v_err int := 0;
begin
  delete from asientos_errores;
  delete from asientos a where a.origen_tipo = 'factura' and not exists (select 1 from facturas f where f.id::text = a.origen_id);
  delete from asientos a where a.origen_tipo = 'pago'    and not exists (select 1 from pagos_facturas p where p.id::text = a.origen_id);
  delete from asientos a where a.origen_tipo = 'aporte'  and not exists (select 1 from aportes x where x.id::text = a.origen_id);
  delete from asientos a where a.origen_tipo = 'labor'   and not exists (select 1 from labores x where x.id::text = a.origen_id);

  for r in select 'factura' t, id::text i from facturas
           union all select 'pago', id::text from pagos_facturas
           union all select 'aporte', id::text from aportes loop
    begin
      if r.t = 'factura' then
        perform contab_asiento_factura_full(r.i);
      elsif r.t = 'pago' then perform contab_asiento_pago(r.i);
      else perform contab_asiento_aporte(r.i); end if;
      v_ok := v_ok + 1;
    exception when others then
      insert into asientos_errores (origen_tipo, origen_id, error) values (r.t, r.i, sqlerrm);
      v_err := v_err + 1;
    end;
  end loop;

  -- Costeo de todos los insumos y asientos de todas las labores
  for r in select distinct insumo_id::text as i from stock_movimientos where insumo_id is not null loop
    begin
      perform stock_recalcular_insumo(r.i);
    exception when others then
      insert into asientos_errores (origen_tipo, origen_id, error) values ('stock', r.i, sqlerrm);
      v_err := v_err + 1;
    end;
  end loop;
  for r in select id::text as i from labores loop
    begin
      perform contab_asiento_labor(r.i);
      v_ok := v_ok + 1;
    exception when others then
      insert into asientos_errores (origen_tipo, origen_id, error) values ('labor', r.i, sqlerrm);
      v_err := v_err + 1;
    end;
  end loop;

  perform contab_asiento_apertura();
  return json_build_object('generados', v_ok, 'errores', v_err);
end $$;

create or replace function trg_labores_contab() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'DELETE' then
      delete from asientos where origen_tipo = 'labor' and origen_id = old.id::text;
    else
      if tg_op = 'UPDATE' and new."Fecha" is distinct from old."Fecha" then
        -- la fecha cambia el orden cronológico → recalcular sus insumos
        perform stock_recalcular_y_asientos(x.ins)
           from (select distinct insumo_id::text as ins from stock_movimientos
                  where motivo = 'labor' and referencia_id::text = new.id::text) x;
      end if;
      perform contab_asiento_labor(new.id::text);
      -- facturas de contratista vinculadas (directa o repartida): lote/campaña de la labor
      perform contab_asiento_factura_full(x.fid)
         from (select f.id::text as fid from facturas f where f."Labor_id"::text = new.id::text
               union
               select fl.factura_id::text from factura_labores fl where fl.labor_id::text = new.id::text) x;
    end if;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error)
    values ('labor', coalesce(new.id::text, old.id::text), sqlerrm);
  end;
  return null;
end $$;

-- ── 5. Vista: costo de contratista asignado a cada labor ───────────────────
create or replace view v_contratista_por_labor as
  with links as (
    select fl.factura_id, fl.labor_id, coalesce(fl.hectareas, l.hectareas, 1)::numeric as ha
      from factura_labores fl join labores l on l.id = fl.labor_id
  )
  select links.labor_id, links.factura_id, f."Numero_factura" as numero_factura,
         p.razon_social as contratista, links.ha,
         (case when coalesce(f.tipo_comprobante, '') ilike 'Nota de Cr%' then -1 else 1 end)
           * coalesce(f.monto_neto, 0) / nullif(f.dolar, 0)
           * links.ha / nullif(sum(links.ha) over (partition by links.factura_id), 0) as usd,
         (case when coalesce(f.tipo_comprobante, '') ilike 'Nota de Cr%' then -1 else 1 end)
           * coalesce(f.monto_neto, 0)
           * links.ha / nullif(sum(links.ha) over (partition by links.factura_id), 0) as ars
    from links
    join facturas f on f.id = links.factura_id
    left join proveedores p on p.id = f.proveedor_id;

-- ── 6. Recalcular ───────────────────────────────────────────────────────────
select contab_regenerar_todo();
