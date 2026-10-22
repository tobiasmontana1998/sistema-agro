-- ════════════════════════════════════════════════════════════════════════════
-- CATEGORÍA "LABOR CONTRATADA" — Sistema Agro
-- ----------------------------------------------------------------------------
-- Solo las facturas de categoría "Labor contratada" se vinculan con labores
-- (y aparecen en Pendientes si no tienen). Los "Servicios" comunes
-- (honorarios, fletes, mantenimiento…) ya no piden labor.
--
--   Labor contratada + labor  → Sementeras del lote (repartido por ha)
--   Labor contratada sin labor→ 5.1.02 Servicios contratados (labores)
--   Servicios                 → 5.3.02 Gastos generales (o la cuenta por
--                               defecto del proveedor, o la elegida a mano)
--
-- Requiere 20261022_contratistas_labores.sql.
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Las facturas que ya están vinculadas a labores pasan a "Labor contratada"
update facturas f set "Tipo" = 'Labor contratada'
 where coalesce(f."Tipo", '') <> 'Labor contratada'
   and (f."Labor_id" is not null
        or exists (select 1 from factura_labores fl where fl.factura_id = f.id));

-- 2. Regla de cuentas con la categoría nueva
create or replace function contab_asiento_factura(p_id text) returns void language plpgsql as $$
declare
  f        record;
  v_tc     numeric;
  v_mult   numeric;
  v_signo  int;
  v_cta    text;
  v_lote   text;
  v_prov_cta text;
  v_as     uuid;
  v_rs     text;
begin
  select * into f from facturas where id::text = p_id;
  if not found then
    delete from asientos where origen_tipo = 'factura' and origen_id = p_id;
    return;
  end if;

  v_tc    := nullif(f.dolar, 0);
  v_mult  := case when f.moneda = 'USD' then coalesce(v_tc, 1) else 1 end;
  v_signo := case when coalesce(f.tipo_comprobante, '') ilike 'Nota de Cr%' then -1 else 1 end;

  if f."Labor_id" is not null then
    select "Lote_id"::text into v_lote from labores where id::text = f."Labor_id"::text;
  end if;

  select c.codigo into v_prov_cta from proveedores p join cuentas c on c.id = p.cuenta_id
   where p.id::text = f.proveedor_id::text;
  select razon_social into v_rs from proveedores where id::text = f.proveedor_id::text;

  v_cta := coalesce(
    (select codigo from cuentas where id = f.cuenta_id),
    case when f."Tipo" = 'Insumos'      then '1.1.4.01' end,
    case when f."Labor_id" is not null  then '1.1.4.03' end,
    v_prov_cta,
    case when f."Tipo" = 'Labor contratada' then '5.1.02'   -- contratista sin labor vinculada
         when f."Tipo" = 'Servicios'        then '5.3.02'   -- servicios generales
         when f."Tipo" = 'Combustible'      then '5.1.03' end,
    '5.9.01'
  );

  v_as := contab_cabecera('factura', p_id, f."Fecha",
    concat_ws(' ', coalesce(f.tipo_comprobante, 'Comprobante'), f."Numero_factura", '-', v_rs));

  perform contab_linea(v_as, v_cta,
    v_signo * (coalesce(f.monto_neto, 0) + coalesce(f.no_gravado, 0) * v_mult), v_tc,
    f."Actividad_id"::text, v_lote, f."Labor_id"::text, f.proveedor_id::text, f."Concepto");
  perform contab_linea(v_as, '1.1.3.01', v_signo * coalesce(f.monto_iva, 0), v_tc,
    null, null, null, f.proveedor_id::text, 'IVA crédito fiscal');
  perform contab_linea(v_as, '1.1.3.03', v_signo * coalesce(f.percepciones, 0) * v_mult, v_tc,
    null, null, null, f.proveedor_id::text, 'Percepción IIBB');
  perform contab_linea(v_as, '5.4.03', v_signo * coalesce(f.retenciones, 0) * v_mult, v_tc,
    f."Actividad_id"::text, null, null, f.proveedor_id::text, 'Otros tributos');
  perform contab_linea(v_as, '2.1.1.01', -v_signo * coalesce(f."Monto", 0), v_tc,
    null, null, null, f.proveedor_id::text, v_rs);

  perform contab_cerrar(v_as, v_tc);
end $$;

-- 3. Recalcular
select contab_regenerar_todo();
