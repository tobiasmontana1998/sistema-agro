-- Marca de "precio revisado" para los ítems de factura en USD con precio alto
-- (pestaña Pendientes → Precios a revisar). Si después editás la factura y
-- los ítems se vuelven a grabar, vuelven a aparecer para revisar.
alter table public.factura_items
  add column if not exists precio_revisado boolean not null default false;
