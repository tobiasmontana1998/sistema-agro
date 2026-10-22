-- ════════════════════════════════════════════════════════════════════════════
-- COSTEO DE STOCK Y VINCULACIÓN FACTURA → REMITO → STOCK → LABOR → LOTE
-- ----------------------------------------------------------------------------
-- Cómo queda todo vinculado (como en Finnegans / Physis, normas CREA):
--
--   FACTURA (factura_items: insumo, cantidad, precio)
--      │ el precio de compra
--      ▼
--   REMITO → stock_movimientos ENTRADA  ── costo unitario USD/ARS de la factura
--      │
--      ▼  costo PROMEDIO PONDERADO (en USD y en ARS) a la fecha
--   LABOR → stock_movimientos SALIDA    ── costo unitario = promedio a esa fecha
--      │
--      ▼  asiento automático por labor:
--          DEBE  Sementeras  [lote · campaña · labor]   (costo del cultivo)
--          HABER Stock de insumos
--   LOTE + CAMPAÑA → margen bruto (etapa 2)
--
-- Reglas:
--  - La entrada toma el precio de la factura vinculada a esa línea de remito
--    (stock_movimientos.factura_id, o el factura_id del remito). Precio neto
--    de descuento, en la moneda de la factura, pasado a USD y a ARS con el
--    dólar de la factura.
--  - Si el remito todavía no tiene factura, la entrada queda con costo
--    PROVISORIO (último costo conocido del insumo). Cuando se carga la
--    factura, se recalcula todo solo.
--  - La salida (labor) toma el costo promedio ponderado del insumo a la fecha
--    de la labor. La fecha de la salida es la fecha de la labor.
--  - Factura de contratista vinculada a una labor: ya iba a Sementeras con el
--    lote de la labor; ahora también lleva la campaña.
--  - Cada labor tiene campaña. Si no se elige, se asigna sola por la fecha
--    (campaña agrícola: 1/7 al 30/6).
--
-- Nada de esto bloquea guardar: si un cálculo falla, el error queda en
-- asientos_errores y se ve en la pantalla de Contabilidad.
--
-- Requiere 20261013_contabilidad.sql y 20261022_pagos_sa_y_apertura.sql.
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. CAMPAÑAS ─────────────────────────────────────────────────────────────
create table if not exists campanias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,        -- ej. 2025/26
  desde      date not null,
  hasta      date not null,
  created_at timestamptz not null default now(),
  check (hasta > desde)
);
insert into campanias (nombre, desde, hasta) values
  ('2024/25', '2024-07-01', '2025-06-30'),
  ('2025/26', '2025-07-01', '2026-06-30'),
  ('2026/27', '2026-07-01', '2027-06-30'),
  ('2027/28', '2027-07-01', '2028-06-30')
on conflict (nombre) do nothing;

alter table campanias enable row level security;
drop policy if exists "auth_all" on campanias;
create policy "auth_all" on campanias for all to authenticated using (true) with check (true);

create or replace function campania_de_fecha(p_fecha date) returns uuid
language sql stable as $$
  select id from campanias where p_fecha between desde and hasta order by desde desc limit 1;
$$;

-- ── 2. CAMPAÑA EN LABORES ───────────────────────────────────────────────────
alter table labores add column if not exists campania_id uuid references campanias(id);
update labores set campania_id = campania_de_fecha("Fecha"::date)
 where campania_id is null and "Fecha" is not null;

create or replace function labores_set_campania() returns trigger
language plpgsql as $$
begin
  if new.campania_id is null and new."Fecha" is not null then
    new.campania_id := campania_de_fecha(new."Fecha"::date);
  end if;
  return new;
end $$;
drop trigger if exists labores_campania on labores;
create trigger labores_campania before insert or update on labores
  for each row execute function labores_set_campania();

-- Dimensión campaña en las líneas de asiento
alter table asiento_lineas add column if not exists campania_id text;

-- ── 3. COSTO EN CADA MOVIMIENTO DE STOCK ────────────────────────────────────
alter table stock_movimientos add column if not exists costo_unit_usd numeric(18,6);
alter table stock_movimientos add column if not exists costo_unit_ars numeric(18,6);
alter table stock_movimientos add column if not exists costo_origen   text;  -- factura | provisorio | promedio | sin_precio

-- Recalcula, en orden cronológico, el costo de TODOS los movimientos de un
-- insumo (promedio ponderado móvil en USD y en ARS).
create or replace function stock_recalcular_insumo(p_insumo text) returns void
language plpgsql as $$
declare
  r record; fi record;
  v_q numeric := 0; v_usd numeric := 0; v_ars numeric := 0;
  v_cu_usd numeric; v_cu_ars numeric; v_origen text;
  v_ult_usd numeric; v_ult_ars numeric;
begin
  if p_insumo is null then return; end if;

  for r in
    select sm.id, sm.tipo, coalesce(sm.cantidad, 0)::numeric as cant,
           coalesce(sm.fecha::date, l."Fecha"::date, current_date) as f_ef,
           coalesce(sm.factura_id::text, rm.factura_id::text) as fact_id
    from stock_movimientos sm
    left join labores l  on sm.motivo = 'labor' and l.id::text = sm.referencia_id::text
    left join remitos rm on rm.id::text = sm.remito_id::text
    where sm.insumo_id::text = p_insumo
    order by f_ef, case when sm.tipo = 'entrada' then 0 else 1 end, sm.id
  loop
    v_cu_usd := null; v_cu_ars := null; v_origen := null;

    if r.tipo = 'entrada' then
      -- Precio de la factura vinculada (promedio si el insumo aparece en varias líneas)
      if r.fact_id is not null then
        select sum(coalesce(i.precio_neto, i.precio_unitario * (1 - coalesce(i.descuento, 0) / 100)) * i.cantidad)
                 / nullif(sum(i.cantidad), 0) as precio,
               max(f.moneda) as moneda, max(f.dolar) as dolar
          into fi
          from factura_items i join facturas f on f.id = i.factura_id
         where i.factura_id::text = r.fact_id and i.insumo_id::text = p_insumo and coalesce(i.cantidad, 0) > 0;
        if fi.precio is not null then
          if fi.moneda = 'USD' then
            v_cu_usd := fi.precio;              v_cu_ars := fi.precio * nullif(fi.dolar, 0);
          else
            v_cu_ars := fi.precio;              v_cu_usd := fi.precio / nullif(fi.dolar, 0);
          end if;
          v_origen := 'factura';
        end if;
      end if;
      -- Sin factura todavía: costo provisorio = último costo conocido
      if v_cu_usd is null and v_ult_usd is not null then
        v_cu_usd := v_ult_usd; v_cu_ars := v_ult_ars; v_origen := 'provisorio';
      end if;
      if v_cu_usd is null then
        v_cu_usd := 0; v_cu_ars := 0; v_origen := 'sin_precio';
      end if;

      v_q   := v_q + r.cant;
      v_usd := v_usd + r.cant * v_cu_usd;
      v_ars := v_ars + r.cant * coalesce(v_cu_ars, 0);
      if v_origen = 'factura' then v_ult_usd := v_cu_usd; v_ult_ars := v_cu_ars; end if;

    else
      -- Salida: costo promedio ponderado a la fecha
      if v_q > 0 then
        v_cu_usd := v_usd / v_q; v_cu_ars := v_ars / v_q; v_origen := 'promedio';
      else
        v_cu_usd := coalesce(v_ult_usd, 0); v_cu_ars := coalesce(v_ult_ars, 0);
        v_origen := case when v_ult_usd is null then 'sin_precio' else 'promedio' end;
      end if;
      v_q   := v_q - r.cant;
      v_usd := v_usd - r.cant * v_cu_usd;
      v_ars := v_ars - r.cant * v_cu_ars;
      if v_q <= 0 then v_usd := 0; v_ars := 0; end if;  -- stock en cero o negativo
    end if;

    update stock_movimientos
       set costo_unit_usd = round(v_cu_usd, 6), costo_unit_ars = round(v_cu_ars, 6), costo_origen = v_origen
     where id = r.id;
  end loop;
end $$;

-- ── 4. ASIENTO DE CADA LABOR ────────────────────────────────────────────────
--   Por cada insumo aplicado:  DEBE Sementeras [lote · campaña · labor]
--   Total:                     HABER Stock de insumos
create or replace function contab_asiento_labor(p_labor text) returns void
language plpgsql as $$
declare
  lb record; r record; v_as uuid; v_total_ars numeric := 0; v_total_usd numeric := 0;
  v_lote text;
begin
  select * into lb from labores where id::text = p_labor;
  if not found then
    delete from asientos where origen_tipo = 'labor' and origen_id = p_labor;
    return;
  end if;

  -- ¿tiene insumos con costo?
  if not exists (select 1 from stock_movimientos
                  where tipo = 'salida' and motivo = 'labor' and referencia_id::text = p_labor
                    and coalesce(cantidad, 0) * coalesce(costo_unit_ars, 0) <> 0) then
    delete from asientos where origen_tipo = 'labor' and origen_id = p_labor;
    return;
  end if;

  select nombre into v_lote from lotes where id::text = lb."Lote_id"::text;
  v_as := contab_cabecera('labor', p_labor, coalesce(lb."Fecha"::date, current_date),
    concat_ws(' ', 'Labor', lb."Tipo", '- Lote', coalesce(v_lote, '?')));

  for r in
    select i.nombre, sum(sm.cantidad) as cant,
           sum(sm.cantidad * coalesce(sm.costo_unit_ars, 0)) as ars,
           sum(sm.cantidad * coalesce(sm.costo_unit_usd, 0)) as usd
    from stock_movimientos sm left join insumos i on i.id::text = sm.insumo_id::text
    where sm.tipo = 'salida' and sm.motivo = 'labor' and sm.referencia_id::text = p_labor
    group by i.nombre
  loop
    perform contab_linea(v_as, '1.1.4.03', r.ars, case when r.usd > 0 then r.ars / r.usd end,
      null, lb."Lote_id"::text, p_labor, null,
      concat_ws(' ', coalesce(r.nombre, 'Insumo'), '×', trim(to_char(r.cant, 'FM999G999G990D00'))));
    v_total_ars := v_total_ars + coalesce(r.ars, 0);
    v_total_usd := v_total_usd + coalesce(r.usd, 0);
  end loop;

  perform contab_linea(v_as, '1.1.4.01', -v_total_ars,
    case when v_total_usd > 0 then v_total_ars / v_total_usd end,
    null, null, p_labor, null, 'Insumos aplicados');
  perform contab_cerrar(v_as, null);

  update asiento_lineas set campania_id = lb.campania_id::text where asiento_id = v_as;
end $$;

-- Recalcula un insumo y los asientos de TODAS las labores que lo usan
-- (cambia el promedio, cambia el costo de todas las aplicaciones).
create or replace function stock_recalcular_y_asientos(p_insumo text) returns void
language plpgsql as $$
begin
  if p_insumo is null then return; end if;
  perform stock_recalcular_insumo(p_insumo);
  perform contab_asiento_labor(x.ref)
     from (select distinct referencia_id::text as ref from stock_movimientos
            where insumo_id::text = p_insumo and tipo = 'salida' and motivo = 'labor'
              and referencia_id is not null) x;
end $$;

-- ── 5. TRIGGERS ─────────────────────────────────────────────────────────────

-- Movimientos de stock (no se dispara al actualizar solo las columnas de costo)
create or replace function trg_stock_mov() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op in ('UPDATE', 'DELETE') then
      perform stock_recalcular_y_asientos(old.insumo_id::text);
      if old.motivo = 'labor' and old.referencia_id is not null then
        perform contab_asiento_labor(old.referencia_id::text);
      end if;
    end if;
    if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.insumo_id is distinct from old.insumo_id) then
      perform stock_recalcular_y_asientos(new.insumo_id::text);
    end if;
    if tg_op in ('INSERT', 'UPDATE') and new.motivo = 'labor' and new.referencia_id is not null then
      perform contab_asiento_labor(new.referencia_id::text);
    end if;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error)
    values ('stock', coalesce(new.id::text, old.id::text), sqlerrm);
  end;
  return null;
end $$;
drop trigger if exists stock_mov_costeo on stock_movimientos;
create trigger stock_mov_costeo
  after insert or delete or update of insumo_id, cantidad, tipo, fecha, factura_id, remito_id, referencia_id, motivo
  on stock_movimientos for each row execute function trg_stock_mov();

-- Ítems de factura (cambia el precio de compra)
create or replace function trg_factura_items_costeo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op in ('UPDATE', 'DELETE') then perform stock_recalcular_y_asientos(old.insumo_id::text); end if;
    if tg_op in ('INSERT', 'UPDATE') then perform stock_recalcular_y_asientos(new.insumo_id::text); end if;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error)
    values ('factura_item', coalesce(new.factura_id::text, old.factura_id::text), sqlerrm);
  end;
  return null;
end $$;
drop trigger if exists factura_items_costeo on factura_items;
create trigger factura_items_costeo after insert or update or delete on factura_items
  for each row execute function trg_factura_items_costeo();

-- Remitos: si cambia la factura vinculada a nivel remito
create or replace function trg_remitos_costeo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.factura_id is distinct from old.factura_id then
      perform stock_recalcular_y_asientos(x.ins)
         from (select distinct insumo_id::text as ins from stock_movimientos
                where remito_id::text = new.id::text) x;
    end if;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error) values ('remito', new.id::text, sqlerrm);
  end;
  return null;
end $$;
drop trigger if exists remitos_costeo on remitos;
create trigger remitos_costeo after update on remitos
  for each row execute function trg_remitos_costeo();

-- Labores: cambio de fecha / lote / campaña / borrado
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
      -- facturas de contratista vinculadas: lote/campaña de la labor
      perform contab_asiento_factura(f.id::text) from facturas f where f."Labor_id"::text = new.id::text;
      update asiento_lineas al set campania_id = new.campania_id::text
        from asientos a
       where a.id = al.asiento_id and a.origen_tipo = 'factura' and al.labor_id = new.id::text;
    end if;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error)
    values ('labor', coalesce(new.id::text, old.id::text), sqlerrm);
  end;
  return null;
end $$;
drop trigger if exists labores_contab on labores;
create trigger labores_contab after insert or update or delete on labores
  for each row execute function trg_labores_contab();

-- Trigger de comprobantes: además pone la campaña de la labor en las facturas
-- de contratista. (Misma lógica que 20261022_pagos_sa_y_apertura.sql.)
create or replace function contab_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text := tg_argv[0]; v_id text;
begin
  v_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  begin
    if tg_op = 'DELETE' then
      delete from asientos where origen_tipo = v_tipo and origen_id = v_id;
    elsif v_tipo = 'factura' then
      perform contab_asiento_factura(v_id);
      update asiento_lineas al set campania_id = l.campania_id::text
        from asientos a, labores l
       where a.id = al.asiento_id and a.origen_tipo = 'factura' and a.origen_id = v_id
         and al.labor_id is not null and l.id::text = al.labor_id;
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

-- ── 6. "REGENERAR ASIENTOS" TAMBIÉN RECALCULA STOCK Y LABORES ───────────────
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
        perform contab_asiento_factura(r.i);
        update asiento_lineas al set campania_id = l.campania_id::text
          from asientos a, labores l
         where a.id = al.asiento_id and a.origen_tipo = 'factura' and a.origen_id = r.i
           and al.labor_id is not null and l.id::text = al.labor_id;
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

-- ── 7. VISTAS PARA PANTALLAS ────────────────────────────────────────────────
-- Stock valuado por insumo (cantidad y valor a costo promedio)
create or replace view v_stock_valuado as
  select i.id as insumo_id, i.nombre, i.categoria, i.unidad,
         coalesce(sum(case when sm.tipo = 'entrada' then sm.cantidad else -sm.cantidad end), 0) as cantidad,
         coalesce(sum(case when sm.tipo = 'entrada' then sm.cantidad * coalesce(sm.costo_unit_usd, 0)
                           else -sm.cantidad * coalesce(sm.costo_unit_usd, 0) end), 0) as valor_usd,
         coalesce(sum(case when sm.tipo = 'entrada' then sm.cantidad * coalesce(sm.costo_unit_ars, 0)
                           else -sm.cantidad * coalesce(sm.costo_unit_ars, 0) end), 0) as valor_ars,
         bool_or(sm.costo_origen in ('provisorio', 'sin_precio')) as tiene_costo_provisorio
  from insumos i
  left join stock_movimientos sm on sm.insumo_id::text = i.id::text
  group by i.id, i.nombre, i.categoria, i.unidad;

-- Costo de cada labor (insumos valuados + factura de contratista)
create or replace view v_costo_labores as
  select l.id as labor_id, l."Fecha" as fecha, l."Tipo" as tipo, l."Lote_id" as lote_id,
         l.campania_id, l.hectareas,
         coalesce((select sum(sm.cantidad * coalesce(sm.costo_unit_usd, 0)) from stock_movimientos sm
                    where sm.tipo = 'salida' and sm.motivo = 'labor' and sm.referencia_id::text = l.id::text), 0) as insumos_usd,
         coalesce((select sum(case when f.moneda = 'USD' then coalesce(f.monto_neto, 0) / nullif(f.dolar, 0)
                                   else coalesce(f.monto_neto, 0) / nullif(f.dolar, 0) end)
                     from facturas f where f."Labor_id"::text = l.id::text), 0) as contratista_usd,
         exists (select 1 from stock_movimientos sm where sm.tipo = 'salida' and sm.motivo = 'labor'
                  and sm.referencia_id::text = l.id::text and sm.costo_origen in ('sin_precio')) as falta_precio
  from labores l;

-- ── 8. CÁLCULO INICIAL ──────────────────────────────────────────────────────
select contab_regenerar_todo();
