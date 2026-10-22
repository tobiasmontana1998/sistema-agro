-- ════════════════════════════════════════════════════════════════════════════
-- CONTABILIDAD DE GESTIÓN — Sistema Agro
-- ----------------------------------------------------------------------------
-- Asientos automáticos estilo ERP (Finnegans): cada comprobante que se carga
-- en el sistema (factura de compra, pago, aporte) genera su asiento solo, por
-- trigger. No reemplaza la contabilidad legal de la contadora: es una
-- contabilidad de gestión bimoneda (ARS + USD) para tener saldos, mayores y
-- márgenes, y para pasarle a la contadora la información ya ordenada.
--
-- Cómo correrla: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. PLAN DE CUENTAS ──────────────────────────────────────────────────────
create table if not exists cuentas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,          -- ej. 1.1.3.01
  nombre      text not null,
  tipo        text not null check (tipo in ('activo','pasivo','patrimonio','ingreso','egreso')),
  imputable   boolean not null default true,  -- false = cuenta "título" (agrupa, no recibe movimientos)
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── 2. ASIENTOS ─────────────────────────────────────────────────────────────
create table if not exists asientos (
  id           uuid primary key default gen_random_uuid(),
  numero       bigserial,
  fecha        date not null,
  descripcion  text,
  origen_tipo  text not null,   -- 'factura' | 'pago' | 'aporte' | 'manual'
  origen_id    text not null,   -- id del comprobante que lo generó (como texto)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (origen_tipo, origen_id)
);

create table if not exists asiento_lineas (
  id            uuid primary key default gen_random_uuid(),
  asiento_id    uuid not null references asientos(id) on delete cascade,
  cuenta_id     uuid not null references cuentas(id),
  debe          numeric(18,2) not null default 0,
  haber         numeric(18,2) not null default 0,
  debe_usd      numeric(18,2),
  haber_usd     numeric(18,2),
  tipo_cambio   numeric(18,6),
  -- Dimensiones de gestión (como texto para no depender del tipo de id de
  -- cada tabla). Permiten sacar el margen por actividad / lote / labor.
  actividad_id  text,
  lote_id       text,
  labor_id      text,
  proveedor_id  text,
  detalle       text
);
create index if not exists asiento_lineas_asiento_idx on asiento_lineas(asiento_id);
create index if not exists asiento_lineas_cuenta_idx  on asiento_lineas(cuenta_id);
create index if not exists asientos_fecha_idx         on asientos(fecha);

-- Errores de generación: si un asiento no se puede generar, el comprobante se
-- guarda igual y el error queda acá para revisarlo desde la pantalla.
create table if not exists asientos_errores (
  id          uuid primary key default gen_random_uuid(),
  origen_tipo text not null,
  origen_id   text not null,
  error       text,
  created_at  timestamptz not null default now()
);

-- ── 3. CUENTA DE IMPUTACIÓN EN FACTURAS Y PROVEEDORES ───────────────────────
-- facturas.cuenta_id   → fuerza la cuenta de esa factura puntual.
-- proveedores.cuenta_id → cuenta por defecto del proveedor (ej. el estudio
--                         contable → Honorarios). Se usa si la factura no tiene.
alter table facturas    add column if not exists cuenta_id uuid references cuentas(id);
alter table proveedores add column if not exists cuenta_id uuid references cuentas(id);

-- ── 4. PLAN DE CUENTAS INICIAL (agro, gestión) ──────────────────────────────
insert into cuentas (codigo, nombre, tipo, imputable) values
  ('1',         'ACTIVO',                                   'activo',     false),
  ('1.1',       'Activo corriente',                         'activo',     false),
  ('1.1.1',     'Disponibilidades',                         'activo',     false),
  ('1.1.1.01',  'Caja',                                     'activo',     true),
  ('1.1.1.02',  'Banco Santander c/c',                      'activo',     true),
  ('1.1.1.90',  'Bancos - a identificar',                   'activo',     true),
  ('1.1.2',     'Créditos por ventas',                      'activo',     false),
  ('1.1.2.01',  'Deudores por venta de granos',             'activo',     true),
  ('1.1.3',     'Créditos impositivos',                     'activo',     false),
  ('1.1.3.01',  'IVA Crédito Fiscal',                       'activo',     true),
  ('1.1.3.02',  'Percepciones de IVA',                      'activo',     true),
  ('1.1.3.03',  'Percepciones de IIBB',                     'activo',     true),
  ('1.1.3.04',  'Imp. ley 25.413 a cuenta de Ganancias',    'activo',     true),
  ('1.1.3.05',  'Retenciones sufridas',                     'activo',     true),
  ('1.1.4',     'Bienes de cambio',                         'activo',     false),
  ('1.1.4.01',  'Stock de insumos',                         'activo',     true),
  ('1.1.4.02',  'Stock de combustible',                     'activo',     true),
  ('1.1.4.03',  'Sementeras (cultivos en curso)',           'activo',     true),
  ('1.1.4.04',  'Stock de granos',                          'activo',     true),
  ('1.2',       'Activo no corriente',                      'activo',     false),
  ('1.2.1.01',  'Maquinarias y equipos',                    'activo',     true),
  ('2',         'PASIVO',                                   'pasivo',     false),
  ('2.1',       'Pasivo corriente',                         'pasivo',     false),
  ('2.1.1.01',  'Proveedores',                              'pasivo',     true),
  ('2.1.2.01',  'IVA Débito Fiscal',                        'pasivo',     true),
  ('2.1.3.01',  'Anticipos de clientes',                    'pasivo',     true),
  ('3',         'PATRIMONIO NETO',                          'patrimonio', false),
  ('3.1.01',    'Capital social',                           'patrimonio', true),
  ('3.1.02',    'Aportes irrevocables',                     'patrimonio', true),
  ('3.2.01',    'Resultados no asignados',                  'patrimonio', true),
  ('4',         'INGRESOS',                                 'ingreso',    false),
  ('4.1.01',    'Ventas de granos',                         'ingreso',    true),
  ('4.9.01',    'Otros ingresos',                           'ingreso',    true),
  ('5',         'EGRESOS',                                  'egreso',     false),
  ('5.1',       'Costos de producción',                     'egreso',     false),
  ('5.1.01',    'Costo de producción agrícola',             'egreso',     true),
  ('5.1.02',    'Servicios contratados (labores)',          'egreso',     true),
  ('5.1.03',    'Combustibles y lubricantes',               'egreso',     true),
  ('5.1.04',    'Arrendamientos',                           'egreso',     true),
  ('5.2',       'Gastos de comercialización',               'egreso',     false),
  ('5.2.01',    'Fletes',                                   'egreso',     true),
  ('5.2.02',    'Comisiones y gastos de venta',             'egreso',     true),
  ('5.3',       'Gastos de administración',                 'egreso',     false),
  ('5.3.01',    'Honorarios profesionales',                 'egreso',     true),
  ('5.3.02',    'Gastos generales',                         'egreso',     true),
  ('5.4',       'Gastos financieros e impositivos',         'egreso',     false),
  ('5.4.01',    'Comisiones y gastos bancarios',            'egreso',     true),
  ('5.4.02',    'Impuesto ley 25.413',                      'egreso',     true),
  ('5.4.03',    'Otros impuestos y tasas',                  'egreso',     true),
  ('5.9',       'Otros',                                    'egreso',     false),
  ('5.9.01',    'Gastos a clasificar',                      'egreso',     true),
  ('5.9.99',    'Diferencias de redondeo',                  'egreso',     true)
on conflict (codigo) do nothing;

-- ── 5. HELPERS ──────────────────────────────────────────────────────────────

-- Crea (o reutiliza) la cabecera del asiento de un comprobante y borra sus
-- líneas viejas. Así el número de asiento se mantiene aunque se regenere.
create or replace function contab_cabecera(
  p_origen_tipo text, p_origen_id text, p_fecha date, p_descripcion text
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into asientos (origen_tipo, origen_id, fecha, descripcion)
  values (p_origen_tipo, p_origen_id, p_fecha, p_descripcion)
  on conflict (origen_tipo, origen_id)
  do update set fecha = excluded.fecha, descripcion = excluded.descripcion, updated_at = now()
  returning id into v_id;
  delete from asiento_lineas where asiento_id = v_id;
  return v_id;
end $$;

-- Agrega una línea. Importe positivo = DEBE, negativo = HABER.
-- p_tc: tipo de cambio ARS por USD (para la columna en dólares).
create or replace function contab_linea(
  p_asiento uuid, p_codigo text, p_importe numeric, p_tc numeric,
  p_actividad text default null, p_lote text default null, p_labor text default null,
  p_proveedor text default null, p_detalle text default null
) returns void language plpgsql as $$
declare v_cuenta uuid; v_imp numeric; v_usd numeric;
begin
  v_imp := round(coalesce(p_importe, 0), 2);
  if v_imp = 0 then return; end if;
  select id into v_cuenta from cuentas where codigo = p_codigo;
  if v_cuenta is null then raise exception 'Cuenta % no existe en el plan de cuentas', p_codigo; end if;
  v_usd := case when coalesce(p_tc, 0) > 0 then round(abs(v_imp) / p_tc, 2) else null end;
  insert into asiento_lineas (asiento_id, cuenta_id, debe, haber, debe_usd, haber_usd, tipo_cambio,
                              actividad_id, lote_id, labor_id, proveedor_id, detalle)
  values (p_asiento, v_cuenta,
          greatest(v_imp, 0), greatest(-v_imp, 0),
          case when v_imp > 0 then v_usd end, case when v_imp < 0 then v_usd end,
          nullif(p_tc, 0), p_actividad, p_lote, p_labor, p_proveedor, p_detalle);
end $$;

-- Cierra el asiento: si por redondeo debe ≠ haber, manda la diferencia a
-- "Diferencias de redondeo" para que siempre balancee.
create or replace function contab_cerrar(p_asiento uuid, p_tc numeric) returns void language plpgsql as $$
declare v_dif numeric;
begin
  select coalesce(sum(debe), 0) - coalesce(sum(haber), 0) into v_dif from asiento_lineas where asiento_id = p_asiento;
  if v_dif <> 0 then
    perform contab_linea(p_asiento, '5.9.99', -v_dif, p_tc, null, null, null, null, 'Ajuste por redondeo');
  end if;
end $$;

-- ── 6. REGLA: FACTURA DE COMPRA ─────────────────────────────────────────────
--   DEBE  cuenta de imputación (neto + no gravado)   ← ver orden de prioridad
--   DEBE  IVA Crédito Fiscal
--   DEBE  Percepciones IIBB
--   DEBE  Otros impuestos y tasas (campo "retenciones" = otros tributos del TXT)
--   HABER Proveedores (total)
-- Nota de crédito → todo al revés.
--
-- Prioridad para la cuenta de imputación del neto:
--   1. facturas.cuenta_id (elegida a mano)
--   2. Categoría "Insumos"          → Stock de insumos (todavía no es costo:
--                                      pasa a costo cuando se aplica en una labor)
--   3. Tiene labor asociada         → Sementeras, con el lote de la labor
--   4. proveedores.cuenta_id        (cuenta por defecto del proveedor)
--   5. Categoría "Servicios"        → Servicios contratados (labores)
--      Categoría "Combustible"      → Combustibles y lubricantes
--   6. Resto                        → Gastos a clasificar
--
-- Importes: monto_neto, monto_iva y "Monto" están guardados en ARS (pesificados
-- con el dólar de la factura). percepciones, retenciones y no_gravado están en
-- la moneda ORIGINAL de la factura, así que en facturas USD se multiplican por
-- el tipo de cambio.
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
    case when f."Tipo" = 'Servicios'    then '5.1.02'
         when f."Tipo" = 'Combustible'  then '5.1.03' end,
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

-- ── 7. REGLA: PAGO A PROVEEDOR ──────────────────────────────────────────────
--   DEBE Proveedores / HABER Bancos - a identificar
-- (Cuando armemos Tesorería, el pago va a elegir la cuenta bancaria real.)
create or replace function contab_asiento_pago(p_id text) returns void language plpgsql as $$
declare p record; f record; v_as uuid; v_rs text;
begin
  select * into p from pagos_facturas where id::text = p_id;
  if not found then
    delete from asientos where origen_tipo = 'pago' and origen_id = p_id;
    return;
  end if;
  select * into f from facturas where id::text = p.factura_id::text;
  select razon_social into v_rs from proveedores where id::text = f.proveedor_id::text;

  v_as := contab_cabecera('pago', p_id, coalesce(p.fecha, current_date),
    concat_ws(' ', 'Pago', f."Numero_factura", '-', v_rs));
  perform contab_linea(v_as, '2.1.1.01', coalesce(p.monto, 0), nullif(f.dolar, 0),
    null, null, null, f.proveedor_id::text, v_rs);
  perform contab_linea(v_as, '1.1.1.90', -coalesce(p.monto, 0), nullif(f.dolar, 0),
    null, null, null, f.proveedor_id::text, 'Pago a ' || coalesce(v_rs, 'proveedor'));
end $$;

-- ── 8. REGLA: APORTE DE CAPITAL ─────────────────────────────────────────────
--   DEBE Bancos - a identificar / HABER Aportes irrevocables
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

-- ── 9. TRIGGERS ─────────────────────────────────────────────────────────────
-- Nunca bloquean el guardado del comprobante: si algo falla, el error queda
-- en asientos_errores y se ve en la pantalla de Contabilidad.
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
      -- si cambió la factura, los pagos dependen de su tipo de cambio/proveedor
      perform contab_asiento_pago(pf.id::text) from pagos_facturas pf where pf.factura_id::text = v_id;
    elsif v_tipo = 'pago' then
      perform contab_asiento_pago(v_id);
    elsif v_tipo = 'aporte' then
      perform contab_asiento_aporte(v_id);
    end if;
    delete from asientos_errores where origen_tipo = v_tipo and origen_id = v_id;
  exception when others then
    insert into asientos_errores (origen_tipo, origen_id, error) values (v_tipo, v_id, sqlerrm);
  end;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists contab_facturas on facturas;
create trigger contab_facturas after insert or update or delete on facturas
  for each row execute function contab_trigger('factura');

drop trigger if exists contab_pagos on pagos_facturas;
create trigger contab_pagos after insert or update or delete on pagos_facturas
  for each row execute function contab_trigger('pago');

drop trigger if exists contab_aportes on aportes;
create trigger contab_aportes after insert or update or delete on aportes
  for each row execute function contab_trigger('aporte');

-- Si cambia la cuenta por defecto de un proveedor, regenerar sus facturas.
create or replace function contab_trigger_proveedor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cuenta_id is distinct from old.cuenta_id or new.razon_social is distinct from old.razon_social then
    perform contab_asiento_factura(f.id::text) from facturas f where f.proveedor_id::text = new.id::text;
  end if;
  return new;
end $$;
drop trigger if exists contab_proveedores on proveedores;
create trigger contab_proveedores after update on proveedores
  for each row execute function contab_trigger_proveedor();

-- ── 10. REGENERAR TODO (botón en la pantalla y carga inicial) ───────────────
create or replace function contab_regenerar_todo() returns json
language plpgsql security definer set search_path = public as $$
declare r record; v_ok int := 0; v_err int := 0;
begin
  delete from asientos_errores;
  -- borra asientos de comprobantes que ya no existen
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
  return json_build_object('generados', v_ok, 'errores', v_err);
end $$;

-- ── 11. REPORTES ────────────────────────────────────────────────────────────
-- Sumas y saldos entre fechas (null = sin límite).
create or replace function contab_sumas_saldos(p_desde date default null, p_hasta date default null)
returns table (cuenta_id uuid, codigo text, nombre text, tipo text,
               debe numeric, haber numeric, saldo numeric,
               debe_usd numeric, haber_usd numeric, saldo_usd numeric)
language sql stable as $$
  select c.id, c.codigo, c.nombre, c.tipo,
         coalesce(sum(l.debe), 0), coalesce(sum(l.haber), 0), coalesce(sum(l.debe - l.haber), 0),
         coalesce(sum(l.debe_usd), 0), coalesce(sum(l.haber_usd), 0),
         coalesce(sum(coalesce(l.debe_usd, 0) - coalesce(l.haber_usd, 0)), 0)
  from cuentas c
  join asiento_lineas l on l.cuenta_id = c.id
  join asientos a on a.id = l.asiento_id
  where (p_desde is null or a.fecha >= p_desde)
    and (p_hasta is null or a.fecha <= p_hasta)
  group by c.id, c.codigo, c.nombre, c.tipo
  order by c.codigo;
$$;

-- Control: asientos que no balancean (debería estar siempre vacía).
create or replace view contab_desbalanceados as
  select a.id, a.numero, a.fecha, a.descripcion, sum(l.debe) debe, sum(l.haber) haber
  from asientos a join asiento_lineas l on l.asiento_id = a.id
  group by a.id having sum(l.debe) <> sum(l.haber);

-- ── 12. SEGURIDAD (RLS): solo usuarios logueados ────────────────────────────
alter table cuentas          enable row level security;
alter table asientos         enable row level security;
alter table asiento_lineas   enable row level security;
alter table asientos_errores enable row level security;

drop policy if exists "auth_all" on cuentas;
create policy "auth_all" on cuentas          for all to authenticated using (true) with check (true);
drop policy if exists "auth_read" on asientos;
create policy "auth_read" on asientos        for select to authenticated using (true);
drop policy if exists "auth_read" on asiento_lineas;
create policy "auth_read" on asiento_lineas  for select to authenticated using (true);
drop policy if exists "auth_read" on asientos_errores;
create policy "auth_read" on asientos_errores for select to authenticated using (true);

revoke execute on function contab_regenerar_todo() from public, anon;
grant  execute on function contab_regenerar_todo() to authenticated;

-- ── 13. CARGA INICIAL: genera los asientos de todo lo ya cargado ────────────
select contab_regenerar_todo();
