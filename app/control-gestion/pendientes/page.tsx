"use client";

// ════════════════════════════════════════════════════════════════════════════
// BANDEJA DE PENDIENTES
// ----------------------------------------------------------------------------
// Lo que falta vincular para que stock, costos y márgenes den bien:
//   1. Remitos pendientes de facturar  → entró mercadería sin factura (costo 0
//      o provisorio). Botón: cargar la factura de ese proveedor.
//   2. Facturas de insumos sin remito  → se facturó algo que no entró al stock.
//   3. Precios sospechosos             → factura en USD con precios que
//      parecen estar en pesos.
//   4. Insumos aplicados sin costo     → labores que usan insumos sin precio.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = "remitos" | "facturas" | "precios" | "labores" | "servicios" | "sinfactura";

const fmt = (n: number, dec = 2) => (n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: dec });

export default function Pendientes() {
  const [tab, setTab] = useState<Tab>("remitos");
  const [cargando, setCargando] = useState(true);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [lineasSinFactura, setLineasSinFactura] = useState<any[]>([]);
  const [facturasSinRemito, setFacturasSinRemito] = useState<any[]>([]);
  const [preciosRaros, setPreciosRaros] = useState<any[]>([]);
  const [aplicadosSinCosto, setAplicadosSinCosto] = useState<any[]>([]);
  // Líneas vinculadas a una factura que NO tiene ese insumo en sus ítems
  // (vínculo equivocado): no aparecen como pendientes pero quedan sin precio.
  const [malVinculadas, setMalVinculadas] = useState<any[]>([]);
  const [recargar, setRecargar] = useState(0);
  // Contratistas: facturas de servicios sin labor / labores sin factura
  const [serviciosSinLabor, setServiciosSinLabor] = useState<any[]>([]);
  const [laboresSinFactura, setLaboresSinFactura] = useState<any[]>([]);

  const marcarPropia = async (laborId: string) => {
    const { error } = await supabase.from("labores").update({ labor_propia: true }).eq("id", laborId);
    if (error) { alert("Error: " + error.message); return; }
    setLaboresSinFactura((prev) => prev.filter((l) => String(l.id) !== String(laborId)));
  };

  // Marca precios de ítems en USD como revisados (ya no aparecen en "Precios a revisar")
  const marcarPrecioOk = async (ids: any[]) => {
    const { error } = await supabase.from("factura_items").update({ precio_revisado: true }).in("id", ids);
    if (error) {
      alert(error.message.includes("precio_revisado")
        ? "Falta correr en Supabase el SQL 20261022_precio_revisado.sql"
        : "Error: " + error.message);
      return;
    }
    const set = new Set(ids.map(String));
    setPreciosRaros((prev) => prev.filter((x) => !set.has(String(x.id))));
  };

  // Desvincula UNA línea de remito. Si el vínculo venía del remito entero
  // (remitos.factura_id, el selector viejo), primero se pasa ese vínculo a cada
  // línea del remito, así las demás líneas no pierden su factura.
  const desvincular = async (m: any) => {
    if (!confirm(`¿Desvincular ${m.insumos?.nombre} (${m.cantidad} ${m.insumos?.unidad || ""}) de la factura ${m.factura_nombre || ""}? Va a quedar como pendiente para vincularlo a la factura correcta.`)) return;
    if (!m.factura_id && m.remito_id && m.remitos?.factura_id) {
      await supabase.from("stock_movimientos").update({ factura_id: m.remitos.factura_id })
        .eq("remito_id", m.remito_id).is("factura_id", null);
      await supabase.from("remitos").update({ factura_id: null }).eq("id", m.remito_id);
    }
    const { error } = await supabase.from("stock_movimientos").update({ factura_id: null }).eq("id", m.id);
    if (error) { alert("Error: " + error.message); return; }
    setRecargar((n) => n + 1);
  };

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      const [
        { data: provs },
        { data: entradas },
        { data: factsInsumos },
        { data: movsConFactura },
        { data: remitosConFactura },
        { data: items },
        { data: salidas },
        { data: entradasMalCosto },
      ] = await Promise.all([
        supabase.from("proveedores").select("id, razon_social"),
        supabase.from("stock_movimientos")
          .select("id, insumo_id, cantidad, fecha, numero_remito, remito_id, proveedor_id, costo_origen, insumos(nombre, unidad), remitos(numero, numero_remito, fecha, proveedor_id, factura_id)")
          .eq("tipo", "entrada").is("factura_id", null).order("fecha", { ascending: true }).limit(2000),
        supabase.from("facturas")
          .select("id, Fecha, Numero_factura, tipo_comprobante, Concepto, Monto, moneda, monto_usd, proveedor_id, proveedores(razon_social)")
          .eq("Tipo", "Insumos").order("Fecha", { ascending: false }).limit(2000),
        supabase.from("stock_movimientos").select("factura_id").not("factura_id", "is", null).limit(5000),
        supabase.from("remitos").select("factura_id").not("factura_id", "is", null).limit(5000),
        supabase.from("factura_items")
          .select("id, factura_id, cantidad, precio_unitario, insumos(nombre), facturas!factura_items_factura_id_fkey(id, Fecha, Numero_factura, moneda, dolar, proveedores(razon_social))")
          .gt("precio_unitario", 1000).limit(1000),
        supabase.from("stock_movimientos")
          .select("id, insumo_id, cantidad, referencia_id, costo_origen, insumos(nombre, unidad)")
          .eq("tipo", "salida").eq("motivo", "labor").eq("costo_origen", "sin_precio").limit(2000),
        supabase.from("stock_movimientos")
          .select("id, insumo_id, cantidad, fecha, numero_remito, remito_id, proveedor_id, factura_id, costo_origen, insumos(nombre, unidad), remitos(numero, numero_remito, fecha, proveedor_id, factura_id)")
          .eq("tipo", "entrada").in("costo_origen", ["sin_precio", "provisorio"]).limit(2000),
      ]);

      // Entradas sin precio pero CON factura vinculada (en la línea o en el remito)
      const mal = (entradasMalCosto || []).filter((m: any) => m.factura_id || m.remitos?.factura_id);
      const factIds = [...new Set(mal.map((m: any) => m.factura_id || m.remitos?.factura_id))];
      let factMap: Record<string, any> = {};
      if (factIds.length > 0) {
        const { data: fs } = await supabase.from("facturas").select("id, Numero_factura, Fecha, proveedores(razon_social)").in("id", factIds);
        factMap = Object.fromEntries((fs || []).map((f: any) => [String(f.id), f]));
      }
      setMalVinculadas(mal.map((m: any) => {
        const f = factMap[String(m.factura_id || m.remitos?.factura_id)];
        return { ...m, factura_nombre: f ? `${f.Numero_factura} (${f.Fecha})` : "?" };
      }));

      setProveedores(provs || []);

      // Contratistas ↔ labores
      const [{ data: fl }, { data: servs }, { data: labsTodas }] = await Promise.all([
        supabase.from("factura_labores").select("labor_id, factura_id"),
        supabase.from("facturas")
          .select("id, Fecha, Numero_factura, tipo_comprobante, Concepto, Monto, monto_neto, moneda, monto_usd, proveedor_id, cuenta_id, Labor_id, proveedores(razon_social)")
          .eq("Tipo", "Labor contratada").is("Labor_id", null).order("Fecha", { ascending: false }).limit(1000),
        supabase.from("labores").select("id, Fecha, Tipo, hectareas, contratista_id, labor_propia, Lote_id").order("Fecha", { ascending: false }).limit(2000),
      ]);
      const factConLabor = new Set((fl || []).map((x: any) => String(x.factura_id)));
      const labConFactura = new Set((fl || []).map((x: any) => String(x.labor_id)));
      setServiciosSinLabor((servs || []).filter((f: any) => !factConLabor.has(String(f.id))));
      const { data: lotesTodos } = await supabase.from("lotes").select("id, nombre");
      const nombreLote = Object.fromEntries((lotesTodos || []).map((x: any) => [String(x.id), x.nombre]));
      setLaboresSinFactura((labsTodas || [])
        .filter((l: any) => !l.labor_propia && !labConFactura.has(String(l.id)))
        .map((l: any) => ({ ...l, lotes: { nombre: nombreLote[String(l.Lote_id)] || "" } })));

      // 1. Líneas de remito sin factura (ni a nivel línea ni a nivel remito)
      setLineasSinFactura((entradas || []).filter((m: any) => !m.remitos?.factura_id));

      // 2. Facturas de insumos que no tienen ninguna línea de stock vinculada
      const conRemito = new Set<string>([
        ...(movsConFactura || []).map((m: any) => String(m.factura_id)),
        ...(remitosConFactura || []).map((r: any) => String(r.factura_id)),
      ]);
      setFacturasSinRemito((factsInsumos || []).filter((f: any) =>
        !conRemito.has(String(f.id)) && !(f.tipo_comprobante || "").startsWith("Nota de")));

      // 3. Ítems de facturas en USD con precio > 1000 (posible precio en pesos)
      // (los que ya marcaste como "Está OK" no aparecen más)
      const { data: revisados } = await supabase.from("factura_items").select("id").eq("precio_revisado", true).limit(5000);
      const yaRevisados = new Set((revisados || []).map((r: any) => String(r.id)));
      setPreciosRaros((items || []).filter((i: any) => i.facturas?.moneda === "USD" && !yaRevisados.has(String(i.id))));

      // 4. Labores que aplicaron insumos sin costo
      const salidasData = salidas || [];
      const laborIds = [...new Set(salidasData.map((s: any) => s.referencia_id).filter(Boolean))];
      let laboresMap: Record<string, any> = {};
      if (laborIds.length > 0) {
        const [{ data: labs }, { data: lts }] = await Promise.all([
          supabase.from("labores").select("id, Tipo, Fecha, Lote_id").in("id", laborIds),
          supabase.from("lotes").select("id, nombre"),
        ]);
        const nom = Object.fromEntries((lts || []).map((x: any) => [String(x.id), x.nombre]));
        laboresMap = Object.fromEntries((labs || []).map((l: any) => [String(l.id), { ...l, lotes: { nombre: nom[String(l.Lote_id)] || "" } }]));
      }
      setAplicadosSinCosto(salidasData.map((s: any) => ({ ...s, labor: laboresMap[String(s.referencia_id)] })));

      setCargando(false);
    };
    cargar();
  }, [recargar]);

  const nombreProveedor = (pid: any) => proveedores.find((p) => String(p.id) === String(pid))?.razon_social || "Sin proveedor";

  // Remitos pendientes agrupados por proveedor
  const remitosPorProveedor = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const m of lineasSinFactura) {
      const pid = String(m.proveedor_id || m.remitos?.proveedor_id || "");
      (g[pid] ||= []).push(m);
    }
    return Object.entries(g).sort(([a], [b]) => nombreProveedor(a).localeCompare(nombreProveedor(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineasSinFactura, proveedores]);

  // ── estilos ──
  const card: React.CSSProperties = { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 };
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, borderBottom: "2px solid #eee", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f3f3f3" };
  const tdR: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const btn: React.CSSProperties = { padding: "5px 12px", fontSize: 12, borderRadius: 6, border: "none", background: "#0f1f17", color: "white", cursor: "pointer", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" };
  const tabBtn = (t: Tab): React.CSSProperties => ({
    padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
    background: tab === t ? "#0f1f17" : "transparent", color: tab === t ? "white" : "#555",
  });
  const badge = (n: number) => n > 0
    ? <span style={{ background: "#e65100", color: "white", borderRadius: 10, padding: "1px 7px", marginLeft: 6, fontSize: 11 }}>{n}</span>
    : <span style={{ background: "#2e7d32", color: "white", borderRadius: 10, padding: "1px 7px", marginLeft: 6, fontSize: 11 }}>✓</span>;

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Pendientes</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>
          Lo que falta vincular para que el stock, el costo de las labores y los márgenes den bien.
        </p>
      </div>

      <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 10, padding: 3, gap: 2, marginBottom: 16, width: "fit-content", flexWrap: "wrap" }}>
        <button style={tabBtn("remitos")} onClick={() => setTab("remitos")}>Remitos sin facturar {badge(lineasSinFactura.length + malVinculadas.length)}</button>
        <button style={tabBtn("facturas")} onClick={() => setTab("facturas")}>Facturas sin remito {badge(facturasSinRemito.length)}</button>
        <button style={tabBtn("precios")} onClick={() => setTab("precios")}>Precios a revisar {badge(preciosRaros.length)}</button>
        <button style={tabBtn("labores")} onClick={() => setTab("labores")}>Labores sin costo {badge(aplicadosSinCosto.length)}</button>
        <button style={tabBtn("sinfactura")} onClick={() => setTab("sinfactura")}>Labores sin factura {badge(laboresSinFactura.length)}</button>
        <button style={tabBtn("servicios")} onClick={() => setTab("servicios")}>Contratistas sin labor {badge(serviciosSinLabor.length)}</button>
      </div>

      {cargando && <div style={{ ...card, color: "#888", fontSize: 14 }}>Cargando…</div>}

      {/* ── 1. REMITOS SIN FACTURAR ── */}
      {!cargando && tab === "remitos" && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555" }}>
            Mercadería que entró al stock sin factura vinculada: su costo es <strong>0</strong> o <strong>provisorio</strong>.
            Tocá <em>Cargar factura</em>: se abre la carga con el proveedor elegido y sus remitos pendientes listos para tildar.
            Si la factura ya está cargada, abrila desde Gastos y tildá las líneas en &ldquo;Remitos pendientes de facturar&rdquo;.
          </p>
          {malVinculadas.length > 0 && (
            <div style={{ background: "#fff3e0", border: "1px solid #ffe0b2", borderRadius: 8, padding: 12, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#e65100", marginBottom: 6 }}>
                ⚠️ Vinculados a una factura que no tiene ese insumo ({malVinculadas.length})
              </div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
                Estas líneas de remito apuntan a una factura en la que ese insumo no figura en los ítems, así que quedan sin precio.
                Desvinculalas y después vinculalas a la factura correcta (Gastos → abrir la factura → tildar la línea).
                Si la factura SÍ es la correcta, lo que falta es cargarle el ítem de ese insumo.
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>FECHA</th><th style={th}>PROVEEDOR</th><th style={th}>REMITO</th><th style={th}>INSUMO</th><th style={{ ...th, textAlign: "right" }}>CANTIDAD</th><th style={th}>VINCULADO A</th><th style={th}></th></tr></thead>
                <tbody>
                  {malVinculadas.map((m) => (
                    <tr key={m.id}>
                      <td style={td}>{m.fecha || m.remitos?.fecha}</td>
                      <td style={td}>{nombreProveedor(m.proveedor_id || m.remitos?.proveedor_id)}</td>
                      <td style={{ ...td, color: "#888" }}>{m.remitos?.numero ? `R-${String(m.remitos.numero).padStart(3, "0")} · ` : ""}{m.remitos?.numero_remito || m.numero_remito || "s/n"}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{m.insumos?.nombre}</td>
                      <td style={tdR}>{fmt(Number(m.cantidad))} {m.insumos?.unidad}</td>
                      <td style={{ ...td, color: "#c62828" }}>{m.factura_nombre}{!m.factura_id && m.remitos?.factura_id ? " (remito entero)" : ""}</td>
                      <td style={td}><button onClick={() => desvincular(m)} style={{ ...btn, background: "#e65100" }}>Desvincular</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {remitosPorProveedor.length === 0 && malVinculadas.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>✅ No hay remitos sin facturar</div>}
          {remitosPorProveedor.map(([pid, lineas]) => (
            <div key={pid} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: 14 }}>{nombreProveedor(pid)}</strong>
                {pid && <Link href={`/control-gestion/facturas?proveedor=${pid}`} style={btn}>+ Cargar factura</Link>}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>FECHA</th><th style={th}>REMITO</th><th style={th}>INSUMO</th><th style={{ ...th, textAlign: "right" }}>CANTIDAD</th><th style={th}>COSTO HOY</th></tr></thead>
                <tbody>
                  {lineas.map((m: any) => (
                    <tr key={m.id}>
                      <td style={td}>{m.fecha || m.remitos?.fecha}</td>
                      <td style={{ ...td, color: "#888" }}>{m.remitos?.numero ? `R-${String(m.remitos.numero).padStart(3, "0")} · ` : ""}{m.remitos?.numero_remito || m.numero_remito || "s/n"}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{m.insumos?.nombre}</td>
                      <td style={tdR}>{fmt(Number(m.cantidad))} {m.insumos?.unidad}</td>
                      <td style={{ ...td, color: m.costo_origen === "sin_precio" ? "#c62828" : "#e65100", fontSize: 12 }}>
                        {m.costo_origen === "sin_precio" ? "Sin precio (0)" : "Provisorio"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ── 2. FACTURAS SIN REMITO ── */}
      {!cargando && tab === "facturas" && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555" }}>
            Facturas de insumos sin ninguna línea de remito vinculada. O la mercadería todavía no llegó (falta cargar el remito),
            o el remito está cargado pero sin vincular: abrí la factura y tildá sus líneas.
          </p>
          {facturasSinRemito.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>✅ Todas las facturas de insumos tienen remito</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>FECHA</th><th style={th}>PROVEEDOR</th><th style={th}>COMPROBANTE</th><th style={th}>CONCEPTO</th><th style={{ ...th, textAlign: "right" }}>TOTAL</th><th style={th}></th></tr></thead>
              <tbody>
                {facturasSinRemito.map((f) => (
                  <tr key={f.id}>
                    <td style={td}>{f.Fecha}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{f.proveedores?.razon_social || "—"}</td>
                    <td style={{ ...td, color: "#888" }}>{f.tipo_comprobante} {f.Numero_factura}</td>
                    <td style={td}>{(f.Concepto || "").slice(0, 40)}</td>
                    <td style={tdR}>{f.moneda === "USD" ? `U$S ${fmt(Number(f.monto_usd))}` : `$${fmt(Number(f.Monto))}`}</td>
                    <td style={td}><Link href={`/control-gestion/facturas?id=${f.id}`} style={btn}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 3. PRECIOS A REVISAR ── */}
      {!cargando && tab === "precios" && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555" }}>
            Ítems de facturas <strong>en dólares</strong> con precio unitario mayor a 1.000. Puede ser correcto (ej. fertilizante a USD 1.180 la
            tonelada, semilla por bolsa) o un precio cargado en pesos por error. Si está en pesos, abrí la factura y corregilo: el costo se recalcula solo.
          </p>
          {preciosRaros.length > 1 && (
            <div style={{ textAlign: "right", marginBottom: 8 }}>
              <button onClick={() => { if (confirm(`¿Marcar los ${preciosRaros.length} precios como correctos?`)) marcarPrecioOk(preciosRaros.map((x) => x.id)); }}
                style={{ ...btn, background: "#2e7d32", color: "#fff", border: "none", cursor: "pointer" }}>✓ Marcar todos como OK</button>
            </div>
          )}
          {preciosRaros.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>✅ Nada para revisar</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>FECHA</th><th style={th}>PROVEEDOR</th><th style={th}>FACTURA</th><th style={th}>ÍTEM</th><th style={{ ...th, textAlign: "right" }}>CANT.</th><th style={{ ...th, textAlign: "right" }}>PRECIO (USD)</th><th style={{ ...th, textAlign: "right" }}>SI FUERAN PESOS</th><th style={th}></th></tr></thead>
              <tbody>
                {preciosRaros.map((i) => (
                  <tr key={i.id}>
                    <td style={td}>{i.facturas?.Fecha}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{i.facturas?.proveedores?.razon_social}</td>
                    <td style={{ ...td, color: "#888" }}>{i.facturas?.Numero_factura}</td>
                    <td style={td}>{i.insumos?.nombre || "(sin insumo)"}</td>
                    <td style={tdR}>{fmt(Number(i.cantidad))}</td>
                    <td style={{ ...tdR, fontWeight: 700 }}>{fmt(Number(i.precio_unitario))}</td>
                    <td style={{ ...tdR, color: "#888" }}>U$S {fmt(Number(i.precio_unitario) / Number(i.facturas?.dolar || 1))}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => marcarPrecioOk([i.id])} style={{ ...btn, background: "#2e7d32", color: "#fff", border: "none", marginRight: 6, cursor: "pointer" }}>✓ Está OK</button>
                      <Link href={`/control-gestion/facturas?id=${i.facturas?.id}`} style={btn}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 4. LABORES CON INSUMOS SIN COSTO ── */}
      {!cargando && tab === "labores" && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555" }}>
            Labores que aplicaron insumos sin ningún precio de compra: su costo cuenta como 0 en el margen del lote.
            Se arregla vinculando el remito de ese insumo con su factura (pestaña &ldquo;Remitos sin facturar&rdquo;).
          </p>
          {aplicadosSinCosto.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>✅ Todas las labores tienen costo</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>FECHA</th><th style={th}>LABOR</th><th style={th}>LOTE</th><th style={th}>INSUMO</th><th style={{ ...th, textAlign: "right" }}>CANTIDAD</th><th style={th}></th></tr></thead>
              <tbody>
                {aplicadosSinCosto.map((s) => (
                  <tr key={s.id}>
                    <td style={td}>{s.labor?.Fecha}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{s.labor?.Tipo || "—"}</td>
                    <td style={td}>{s.labor?.lotes?.nombre || "—"}</td>
                    <td style={td}>{s.insumos?.nombre}</td>
                    <td style={tdR}>{fmt(Number(s.cantidad))} {s.insumos?.unidad}</td>
                    <td style={td}>{s.referencia_id && <Link href={`/agricultura/labores-por-lote/editar/${s.referencia_id}`} style={btn}>Ver labor</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* ── 5. LABORES SIN FACTURA DE CONTRATISTA ── */}
      {!cargando && tab === "sinfactura" && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555" }}>
            Labores sin factura de contratista vinculada. Si la hizo un contratista, cargá su factura (se abre con el contratista
            elegido y sus labores listas para tildar). Si la hiciste con maquinaria propia, marcala como <strong>propia</strong> y no aparece más.
          </p>
          {laboresSinFactura.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>✅ Todas las labores tienen factura o son propias</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>FECHA</th><th style={th}>LABOR</th><th style={th}>LOTE</th><th style={{ ...th, textAlign: "right" }}>HA</th><th style={th}>CONTRATISTA</th><th style={th}></th></tr></thead>
              <tbody>
                {laboresSinFactura.map((l) => (
                  <tr key={l.id}>
                    <td style={td}>{l.Fecha}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{l.Tipo}</td>
                    <td style={td}>{l.lotes?.nombre || "—"}</td>
                    <td style={tdR}>{l.hectareas || "—"}</td>
                    <td style={td}>{l.contratista_id ? nombreProveedor(l.contratista_id) : <span style={{ color: "#999" }}>sin contratista</span>}</td>
                    <td style={{ ...td, display: "flex", gap: 6 }}>
                      {l.contratista_id
                        ? <Link href={`/control-gestion/facturas?proveedor=${l.contratista_id}&tipo=${encodeURIComponent("Labor contratada")}`} style={btn}>+ Cargar factura</Link>
                        : <Link href={`/agricultura/labores-por-lote/editar/${l.id}`} style={{ ...btn, background: "#555" }}>Poner contratista</Link>}
                      <button onClick={() => marcarPropia(String(l.id))} style={{ ...btn, background: "white", color: "#555", border: "1px solid #ddd" }}>Es propia</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 6. FACTURAS DE SERVICIOS SIN LABOR ── */}
      {!cargando && tab === "servicios" && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555" }}>
            Facturas de categoría <em>Labor contratada</em> sin labor vinculada: su costo no llega a ningún lote. Abrila y tildá sus labores.
            Si en realidad no es de una labor (ej. honorarios, fletes), cambiale la categoría a <em>Servicios</em> y deja de aparecer acá.
          </p>
          {serviciosSinLabor.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>✅ Todas las facturas de contratistas tienen labor</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>FECHA</th><th style={th}>PROVEEDOR</th><th style={th}>COMPROBANTE</th><th style={th}>CONCEPTO</th><th style={{ ...th, textAlign: "right" }}>NETO</th><th style={th}></th></tr></thead>
              <tbody>
                {serviciosSinLabor.map((f) => (
                  <tr key={f.id}>
                    <td style={td}>{f.Fecha}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{f.proveedores?.razon_social || "—"}</td>
                    <td style={{ ...td, color: "#888" }}>{f.tipo_comprobante} {f.Numero_factura}</td>
                    <td style={td}>{(f.Concepto || "").slice(0, 40)}</td>
                    <td style={tdR}>${fmt(Number(f.monto_neto))}</td>
                    <td style={td}><Link href={`/control-gestion/facturas?id=${f.id}`} style={btn}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
