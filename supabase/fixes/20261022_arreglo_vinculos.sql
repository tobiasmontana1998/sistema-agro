-- ════════════════════════════════════════════════════════════════════════════
-- ARREGLO DE VÍNCULOS REMITO ↔ FACTURA E INSUMOS DUPLICADOS (una sola vez)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Unificar insumos duplicados ──────────────────────────────────────────
-- Pasa TODAS las referencias del duplicado al insumo correcto y borra el duplicado.
do $$
declare
  pares text[][] := array[
    array['MICROESSENTIAL SZ 12-40-0-0-10', 'Microessential sz 12-40-0-0-10'],
    array['Urea',                           'Urea Granulada']
  ];
  v_dup text; v_ok text; t record; i int;
begin
  for i in 1 .. array_length(pares, 1) loop
    select id::text into v_dup from insumos where nombre = pares[i][1];
    select id::text into v_ok  from insumos where nombre = pares[i][2];
    if v_dup is null or v_ok is null or v_dup = v_ok then
      raise notice 'Salteo % → % (no encontrado o ya unificado)', pares[i][1], pares[i][2];
      continue;
    end if;
    for t in
      select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'insumo_id' and tb.table_type = 'BASE TABLE'
    loop
      begin
        execute format('update %I set insumo_id = (select id from insumos where id::text = %L) where insumo_id::text = %L',
                       t.table_name, v_ok, v_dup);
      exception when unique_violation then
        -- La tabla admite una sola fila por insumo (ej. precios_insumos) y el
        -- insumo correcto ya tiene la suya: se conserva esa y se borra la del duplicado.
        execute format('delete from %I where insumo_id::text = %L', t.table_name, v_dup);
        raise notice '  % : el insumo correcto ya tenía fila, se borró la del duplicado', t.table_name;
      end;
    end loop;
    begin
      execute format('delete from insumos where id::text = %L', v_dup);
    exception when others then
      raise notice 'No se pudo borrar el duplicado %: %', pares[i][1], sqlerrm;
    end;
    raise notice 'Unificado: % → %', pares[i][1], pares[i][2];
  end loop;
end $$;

-- ── 2. Mover líneas de remito a la factura correcta ─────────────────────────
-- Factura "actual" de una línea = la de la línea o, si no, la del remito entero.
create or replace function pg_temp.factura_de(p_num text) returns text
language sql as $$ select id::text from facturas where "Numero_factura" = p_num limit 1 $$;

create or replace function pg_temp.mover(p_insumo_like text, p_desde text, p_hasta text, p_cantidad numeric default null)
returns int language plpgsql as $$
declare n int;
begin
  update stock_movimientos sm
     set factura_id = (select id from facturas where id::text = pg_temp.factura_de(p_hasta))
    from insumos i
   where i.id = sm.insumo_id and sm.tipo = 'entrada'
     and lower(i.nombre) like lower(p_insumo_like)
     and (p_cantidad is null or abs(sm.cantidad - p_cantidad) < 0.001)
     and coalesce(sm.factura_id::text, (select r.factura_id::text from remitos r where r.id = sm.remito_id)) = pg_temp.factura_de(p_desde);
  get diagnostics n = row_count;
  raise notice 'Movidas % línea(s) de % : % → %', n, p_insumo_like, p_desde, p_hasta;
  return n;
end $$;

-- Microessential 1,94 t → Agrosur 0012-00041557
select pg_temp.mover('microessential%', '0012-00040905', '0012-00041557', 1.94);
-- Daser 37460 ↔ 37461 (cruzadas)
select pg_temp.mover('glifosato%',      '1001-00037460', '1001-00037461');
select pg_temp.mover('mso max%',        '1001-00037460', '1001-00037461');
select pg_temp.mover('cletodim%',       '1001-00037461', '1001-00037460');
select pg_temp.mover('2,4d%',           '1001-00037461', '1001-00037460');
-- MSO 10 L: 38042 (es de Cletodim) → 38043 (tiene MSO 10 L)
select pg_temp.mover('mso max%',        '1001-00038042', '1001-00038043', 10);

-- S-Metolacloro y Pyroxasulfone: a la ÚNICA factura de Daser que tenga ese insumo
do $$
declare r record; v_dest text; v_cant int;
begin
  for r in
    select sm.id, sm.insumo_id, i.nombre
    from stock_movimientos sm join insumos i on i.id = sm.insumo_id
    where sm.tipo = 'entrada'
      and (lower(i.nombre) like 's-metolacloro%' or lower(i.nombre) like 'pyroxasulfone%')
      and coalesce(sm.factura_id::text, (select x.factura_id::text from remitos x where x.id = sm.remito_id)) = pg_temp.factura_de('1001-00038582')
  loop
    select count(distinct fi.factura_id), min(fi.factura_id::text) into v_cant, v_dest
      from factura_items fi join facturas f on f.id = fi.factura_id
     where fi.insumo_id = r.insumo_id
       and f.proveedor_id = (select proveedor_id from facturas where id::text = pg_temp.factura_de('1001-00038582'));
    if v_cant = 1 then
      update stock_movimientos set factura_id = (select id from facturas where id::text = v_dest) where id = r.id;
      raise notice '% → factura %', r.nombre, (select "Numero_factura" from facturas where id::text = v_dest);
    else
      raise notice '% : % facturas candidatas, no se mueve (vincular a mano)', r.nombre, v_cant;
    end if;
  end loop;
end $$;

-- ── 3. BRV830PWUE: asignar el insumo al ítem sin insumo de la factura 38446 ─
update factura_items
   set insumo_id = (select id from insumos where nombre = 'BRV830PWUE' limit 1)
 where factura_id::text = pg_temp.factura_de('1001-00038446')
   and insumo_id is null
   and (select id from insumos where nombre = 'BRV830PWUE' limit 1) is not null;

-- ── 4. Recalcular todo ───────────────────────────────────────────────────────
select contab_regenerar_todo();
