-- Reparto de una factura de contratista entre sus labores.
-- Antes: proporcional a las hectáreas (siembra y pulverización quedaban al
-- mismo $/ha). Ahora: proporcional al COSTO cargado en cada labor (en pesos).
-- Si alguna labor de la factura no tiene costo cargado, se reparte por ha.

create or replace function contab_peso_factura_labor(p_factura text) returns table(labor_id text, peso numeric)
language sql stable as $$
  with base as (
    select fl.labor_id::text as labor_id,
           coalesce(fl.hectareas, lb.hectareas, 1)::numeric as ha,
           coalesce(lb."Costo_total", 0)::numeric as costo
      from factura_labores fl join labores lb on lb.id = fl.labor_id
     where fl.factura_id::text = p_factura
  )
  select labor_id,
         case when (select bool_and(costo > 0) from base) then costo else ha end
    from base;
$$;

create or replace function contab_split_factura_labores(p_id text) returns void
language plpgsql as $$
declare
  v_as uuid; ln record; r record;
  v_total numeric; v_tot numeric; v_acum numeric := 0; v_parte numeric; v_n int; v_i int := 0;
begin
  select id into v_as from asientos where origen_tipo = 'factura' and origen_id = p_id;
  if v_as is null then return; end if;
  select count(*) into v_n from factura_labores where factura_id::text = p_id;
  if v_n = 0 then return; end if;

  select l.* into ln from asiento_lineas l join cuentas c on c.id = l.cuenta_id
   where l.asiento_id = v_as and c.codigo = '1.1.4.03' limit 1;
  if not found then return; end if;

  v_total := ln.debe - ln.haber;
  select sum(peso) into v_tot from contab_peso_factura_labor(p_id);
  if coalesce(v_tot, 0) = 0 then return; end if;

  delete from asiento_lineas where id = ln.id;
  for r in
    select w.labor_id as lab, lb."Lote_id"::text as lote, w.peso,
           coalesce(fl.hectareas, lb.hectareas, 1) as ha
      from contab_peso_factura_labor(p_id) w
      join labores lb on lb.id::text = w.labor_id
      join factura_labores fl on fl.labor_id::text = w.labor_id and fl.factura_id::text = p_id
     order by lb."Fecha", w.labor_id
  loop
    v_i := v_i + 1;
    v_parte := case when v_i = v_n then v_total - v_acum
                    else round(v_total * r.peso / v_tot, 2) end;
    v_acum := v_acum + v_parte;
    perform contab_linea(v_as, '1.1.4.03', v_parte, ln.tipo_cambio, ln.actividad_id, r.lote, r.lab,
                         ln.proveedor_id, concat_ws(' ', ln.detalle, '(' || trim(to_char(r.ha, 'FM999G990D00')) || ' ha)'));
  end loop;
end $$;

create or replace view v_contratista_por_labor as
  with links as (
    select fl.factura_id, fl.labor_id, coalesce(fl.hectareas, l.hectareas, 1)::numeric as ha,
           w.peso
      from factura_labores fl
      join labores l on l.id = fl.labor_id
      join lateral contab_peso_factura_labor(fl.factura_id::text) w on w.labor_id = fl.labor_id::text
  )
  select links.labor_id, links.factura_id, f."Numero_factura" as numero_factura,
         p.razon_social as contratista, links.ha,
         (case when coalesce(f.tipo_comprobante, '') ilike 'Nota de Cr%' then -1 else 1 end)
           * coalesce(f.monto_neto, 0) / nullif(f.dolar, 0)
           * links.peso / nullif(sum(links.peso) over (partition by links.factura_id), 0) as usd,
         (case when coalesce(f.tipo_comprobante, '') ilike 'Nota de Cr%' then -1 else 1 end)
           * coalesce(f.monto_neto, 0)
           * links.peso / nullif(sum(links.peso) over (partition by links.factura_id), 0) as ars
    from links
    join facturas f on f.id = links.factura_id
    left join proveedores p on p.id = f.proveedor_id;

-- Rehacer los asientos de las facturas de contratistas con el nuevo reparto
select contab_asiento_factura_full(x.fid)
  from (select distinct factura_id::text as fid from factura_labores) x;
