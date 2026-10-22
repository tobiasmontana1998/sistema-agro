-- ════════════════════════════════════════════════════════════════════════════
-- AJUSTE DE APERTURA — Sistema Agro
-- ----------------------------------------------------------------------------
-- Para "arrancar de cero" la cuenta del banco y la de proveedores sin tener
-- que reconstruir quién pagó cada factura vieja.
--
-- Se indican, a una FECHA DE CORTE, los saldos REALES:
--   - cuánta plata había en el banco (según el resumen del Santander)
--   - cuánto se les debía a los proveedores
-- El sistema genera un asiento de ajuste a esa fecha que lleva Bancos y
-- Proveedores a esos valores reales. La diferencia va a Aportes irrevocables:
-- es lo que los socios pusieron de su bolsillo (pagando facturas) antes de que
-- existiera la cuenta, sin identificar qué socio.
--
-- El asiento se recalcula solo si después se corrigen datos anteriores al
-- corte (se vuelve a generar con "Regenerar asientos").
--
-- Requiere haber corrido antes 20261013_contabilidad.sql.
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

insert into cuentas (codigo, nombre, tipo, imputable)
values ('3.9.01', 'Ajuste de apertura (a conciliar)', 'patrimonio', true)
on conflict (codigo) do nothing;

create table if not exists contab_apertura (
  id                int primary key default 1 check (id = 1),   -- una sola fila
  fecha             date not null,
  banco_real        numeric(18,2) not null default 0,
  proveedores_real  numeric(18,2) not null default 0,          -- deuda real (positivo)
  updated_at        timestamptz not null default now()
);
alter table contab_apertura enable row level security;
drop policy if exists "auth_read" on contab_apertura;
create policy "auth_read" on contab_apertura for select to authenticated using (true);

-- Genera / regenera el asiento de ajuste a partir de contab_apertura
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

-- Deuda con proveedores opcional: vacío = no se ajusta Proveedores
alter table contab_apertura alter column proveedores_real drop not null;
alter table contab_apertura alter column proveedores_real drop default;

-- Guardar los saldos reales (lo llama la pantalla)
create or replace function contab_set_apertura(p_fecha date, p_banco_real numeric, p_proveedores_real numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into contab_apertura (id, fecha, banco_real, proveedores_real, updated_at)
  values (1, p_fecha, coalesce(p_banco_real, 0), p_proveedores_real, now())
  on conflict (id) do update set fecha = excluded.fecha, banco_real = excluded.banco_real,
    proveedores_real = excluded.proveedores_real, updated_at = now();
  perform contab_asiento_apertura();
end $$;

create or replace function contab_borrar_apertura() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from contab_apertura;
  delete from asientos where origen_tipo = 'apertura';
end $$;

revoke execute on function contab_set_apertura(date, numeric, numeric) from public, anon;
grant  execute on function contab_set_apertura(date, numeric, numeric) to authenticated;
revoke execute on function contab_borrar_apertura() from public, anon;
grant  execute on function contab_borrar_apertura() to authenticated;

-- "Regenerar asientos" también recalcula el ajuste de apertura al final
create or replace function contab_regenerar_todo() returns json
language plpgsql security definer set search_path = public as $$
declare r record; v_ok int := 0; v_err int := 0;
begin
  delete from asientos_errores;
  delete from asientos a where a.origen_tipo = 'factura' and not exists (select 1 from facturas f where f.id::text = a.origen_id);
  delete from asientos a where a.origen_tipo = 'pago'    and not exists (select 1 from pagos_facturas p where p.id::text = a.origen_id);
  delete from asientos a where a.origen_tipo = 'aporte'  and not exists (select 1 from aportes x where x.id::text = a.origen_id);

  for r in select 'factura' t, id::text i from facturas
           union all select 'pago', id::text from pagos_facturas
           union all select 'aporte', id::text from aportes loop
    begin
      if r.t = 'factura' then perform contab_asiento_factura(r.i);
      elsif r.t = 'pago' then perform contab_asiento_pago(r.i);
      else perform contab_asiento_aporte(r.i); end if;
      v_ok := v_ok + 1;
    exception when others then
      insert into asientos_errores (origen_tipo, origen_id, error) values (r.t, r.i, sqlerrm);
      v_err := v_err + 1;
    end;
  end loop;

  perform contab_asiento_apertura();
  return json_build_object('generados', v_ok, 'errores', v_err);
end $$;

-- El trigger de comprobantes también recalcula el ajuste de apertura, así
-- si se corrige una factura/pago/aporte anterior al corte, Bancos y
-- Proveedores siguen quedando en los saldos reales.
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
