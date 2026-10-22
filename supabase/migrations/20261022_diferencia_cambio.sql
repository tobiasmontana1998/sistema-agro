-- ════════════════════════════════════════════════════════════════════════════
-- DIFERENCIA DE CAMBIO — Sistema Agro
-- ----------------------------------------------------------------------------
-- Cuenta para las Notas de Débito / Crédito por diferencia de cambio que
-- mandan los proveedores cuando una factura en USD se paga en pesos a un
-- dólar distinto al de la factura. En "Cargar Gasto", la nota se vincula a la
-- factura original y se tilda "Por diferencia de cambio": su neto va a esta
-- cuenta (resultado financiero) en vez de a Stock de insumos o Servicios.
--
-- Requiere haber corrido antes 20261013_contabilidad.sql.
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ════════════════════════════════════════════════════════════════════════════

insert into cuentas (codigo, nombre, tipo, imputable)
values ('5.4.04', 'Diferencias de cambio', 'egreso', true)
on conflict (codigo) do nothing;
