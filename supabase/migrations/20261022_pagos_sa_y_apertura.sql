-- ════════════════════════════════════════════════════════════════════════════
-- TODOS LOS PAGOS DE LA SA + APERTURA SIN TOCAR APORTES — Sistema Agro
-- ----------------------------------------------------------------------------
-- 1. Todos los pagos de facturas quedan como pagados por la SA (banco).
-- 2. El ajuste de apertura ya no manda la diferencia a "Aportes irrevocables"
--    sino a una cuenta propia, "3.9.01 Ajuste de apertura (a conciliar)".
--    Los aportes de capital quedan exactamente como los cargó el usuario.
--
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

insert into cuentas (codigo, nombre, tipo, imputable)
values ('3.9.01', 'Ajuste de apertura (a conciliar)', 'patrimonio', true)
on conflict (codigo) do nothing;

create or replace function contab_asiento_apertura() returns void
language plpgsql security definer set search_path = public as $$
declare
  ap record; v_as uuid;
  v_banco_sis numeric; v_prov_sis numeric;
  v_dif_banco numeric; v_dif_prov numeric;
begin
  select * into ap from contab_apertura where id = 1;
  if not found then
    delete from asientos where origen_tipo = 'apertura';
    return;
  end if;

  -- Saldos del sistema a la fecha de corte, SIN contar el propio ajuste
  select coalesce(sum(l.debe - l.haber), 0) into v_banco_sis
  from asiento_lineas l join asientos a on a.id = l.asiento_id join cuentas c on c.id = l.cuenta_id
  where c.codigo = '1.1.1.90' and a.fecha <= ap.fecha and a.origen_tipo <> 'apertura';

  select coalesce(sum(l.debe - l.haber), 0) into v_prov_sis
  from asiento_lineas l join asientos a on a.id = l.asiento_id join cuentas c on c.id = l.cuenta_id
  where c.codigo = '2.1.1.01' and a.fecha <= ap.fecha and a.origen_tipo <> 'apertura';

  -- Bancos: saldo deudor = banco_real.  Proveedores: saldo acreedor = -deuda
  v_dif_banco := round(ap.banco_real - v_banco_sis, 2);
  -- proveedores_real vacío (null) = no ajustar Proveedores
  v_dif_prov  := case when ap.proveedores_real is null then 0
                      else round(-ap.proveedores_real - v_prov_sis, 2) end;

  v_as := contab_cabecera('apertura', '1', ap.fecha,
    'Ajuste de apertura: saldos reales de banco y proveedores al ' || to_char(ap.fecha, 'DD/MM/YYYY'));
  perform contab_linea(v_as, '1.1.1.90', v_dif_banco, null, null, null, null, null,
    'Saldo real del banco: ' || to_char(ap.banco_real, 'FM999G999G999G990D00'));
  perform contab_linea(v_as, '2.1.1.01', v_dif_prov, null, null, null, null, null,
    'Deuda real con proveedores: ' || coalesce(to_char(ap.proveedores_real, 'FM999G999G999G990D00'), '-'));
  -- La diferencia NO va a Aportes (los aportes solo los carga el usuario):
  -- queda en una cuenta propia de patrimonio, "Ajuste de apertura".
  perform contab_linea(v_as, '3.9.01', -(v_dif_banco + v_dif_prov), null, null, null, null, null,
    'Diferencia de apertura (a conciliar)');
end $$;

-- Todos los pagos: pagados por la SA (esto regenera sus asientos solo)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'pagos_facturas' and column_name = 'pagado_por') then
    update pagos_facturas set pagado_por = null where pagado_por is not null;
  end if;
end $$;

-- Rehacer el ajuste de apertura con la cuenta nueva
select contab_asiento_apertura();

-- ════════════════════════════════════════════════════════════════════════════
-- APORTES COMO AL PRINCIPIO
-- Los aportes solo los maneja el usuario. Se quita el vínculo
-- "aporte que paga una factura": cada aporte vuelve a ser
-- DEBE Bancos / HABER Aportes irrevocables, sin excepciones.
-- ════════════════════════════════════════════════════════════════════════════

-- Trigger de comprobantes sin la parte de aportes vinculados a facturas
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

-- Regla original del aporte: siempre Bancos contra Aportes
create or replace function contab_asiento_aporte(p_id text) returns void language plpgsql as $$
declare a record; v_as uuid; v_tc numeric;
begin
  select * into a from aportes where id::text = p_id;
  if not found then
    delete from asientos where origen_tipo = 'aporte' and origen_id = p_id;
    return;
  end if;
  v_tc := nullif(a.dolar, 0);
  v_as := contab_cabecera('aporte', p_id, a.fecha, concat_ws(' ', 'Aporte', a.socio, '-', a.concepto));
  perform contab_linea(v_as, '1.1.1.90', coalesce(a.monto, 0),  v_tc, null, null, null, null, 'Aporte ' || coalesce(a.socio, ''));
  perform contab_linea(v_as, '3.1.02',  -coalesce(a.monto, 0),  v_tc, null, null, null, null, a.socio);
end $$;

-- La tabla aportes vuelve a su forma original
alter table aportes drop column if exists factura_id;

-- Rehacer asientos de aportes y el ajuste de apertura
select contab_asiento_aporte(id::text) from aportes;
select contab_asiento_apertura();
