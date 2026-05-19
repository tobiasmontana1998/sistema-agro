"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MargenesPage() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteId, setLoteId] = useState("");
  const [loteInfo, setLoteInfo] = useState<any>(null);
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [preciosInsumos, setPreciosInsumos] = useState<Record<string, number>>({});
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [labores, setLabores] = useState<any[]>([]);
  const [costoInsumosLote, setCostoInsumosLote] = useState(0);
  const [preciosFuturos, setPreciosFuturos] = useState<any[]>([]);
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null);
  const [precioTemp, setPrecioTemp] = useState("");
  const [rendimientoEsperado, setRendimientoEsperado] = useState("");
  const [bonificacion, setBonificacion] = useState("0");
  const [comision, setComision] = useState("4");
  const [flete, setFlete] = useState("17");
  const [otrosGastos, setOtrosGastos] = useState("0");
  const [administracion, setAdministracion] = useState("0");
  const [rendimientoReal, setRendimientoReal] = useState("");
  const [costoRealPorCategoria, setCostoRealPorCategoria] = useState<Record<string, number>>({});
  const [facturasLabores, setFacturasLabores] = useState<any[]>([]);

  const loteIdRef = useRef(loteId);
  useEffect(() => { loteIdRef.current = loteId; }, [loteId]);

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    if (!loteId) { setLoteInfo(null); return; }
    const lote = lotes.find(l => l.id === loteId);
    setLoteInfo(lote || null);
    if (lote?.rendimiento_esperado) setRendimientoEsperado(lote.rendimiento_esperado.toString());
    else setRendimientoEsperado("");
    if (lote?.rendimiento_real) setRendimientoReal(lote.rendimiento_real.toString());
    else setRendimientoReal("");
    cargarDatosLote(loteId, lote?.plan_id);
  }, [loteId, lotes]);

  const cargarDatos = async () => {
    const [{ data: lotesData }, { data: preciosData }, { data: futuresData }] = await Promise.all([
      supabase.from("lotes").select("*"),
      supabase.from("precios_insumos").select("*"),
      supabase.from("precios_futuros").select("*"),
    ]);
    setLotes(lotesData || []);
    const map: Record<string, number> = {};
    (preciosData || []).forEach((p: any) => { map[p.insumo_id] = p.precio; });
    setPreciosInsumos(map);
    setPreciosFuturos(futuresData || []);
  };

  const cargarDatosLote = async (loteId: string, planId: string | null) => {
    const queries: Promise<any>[] = [
supabase.from("liquidaciones_venta").select("*").eq("lote_id", loteId) as any,
        supabase.from("labores").select("*").eq("Lote_id", loteId),
      supabase.from("stock_movimientos").select("insumo_id, cantidad, referencia_id, insumos(categoria, subcategoria)").eq("tipo", "salida").eq("motivo", "labor"),
      supabase.from("factura_items").select("insumo_id, cantidad, precio_unitario, facturas!factura_items_factura_id_fkey(moneda, dolar)"),
    ];

    if (planId) {
queries.push(supabase.from("plan_items").select("*, insumos(nombre, categoria)").eq("plan_id", planId).order("orden") as any);
    }

    const results = await Promise.all(queries);

    const laboresData = results[1].data || [];
    const laborIds = laboresData.map((l: any) => l.id);

    // Traer facturas vinculadas a estas labores
   const { data: facturasData } = laborIds.length > 0
      ? await supabase.from("facturas").select("id, Monto, monto_neto, monto_usd, dolar, moneda, Labor_id").in("Labor_id", laborIds)
      : { data: [] };

    setFacturasLabores(facturasData || []);
    setLiquidaciones(results[0].data || []);
    setLabores(laboresData);

    const laboresDelLote = laborIds;
    const todasSalidas = results[2].data || [];
    const salidasLote = todasSalidas.filter((s: any) => laboresDelLote.includes(s.referencia_id));
  
    const facturasItems = results[3].data || [];

    const totalesPorInsumo: Record<string, { totalValor: number; totalCantidad: number }> = {};
    for (const fi of facturasItems) {
      const moneda = fi.facturas?.moneda || "ARS";
      const dolar = Number(fi.facturas?.dolar || 1);
      const precioUSD = moneda === "USD" ? Number(fi.precio_unitario) : Number(fi.precio_unitario) / dolar;
      if (!totalesPorInsumo[fi.insumo_id]) totalesPorInsumo[fi.insumo_id] = { totalValor: 0, totalCantidad: 0 };
      totalesPorInsumo[fi.insumo_id].totalValor += precioUSD * Number(fi.cantidad);
      totalesPorInsumo[fi.insumo_id].totalCantidad += Number(fi.cantidad);
    }

    const precioPromedio: Record<string, number> = {};
    for (const [insumoId, datos] of Object.entries(totalesPorInsumo)) {
      precioPromedio[insumoId] = datos.totalCantidad > 0 ? datos.totalValor / datos.totalCantidad : 0;
    }

    const costoInsumos = salidasLote.reduce((acc: number, s: any) => {
      const precio = precioPromedio[s.insumo_id] || 0;
      return acc + Number(s.cantidad) * precio;
    }, 0);

    const costoRealPorCat: Record<string, number> = {};
    const haPorLabor: Record<string, number> = {};
    for (const l of laboresData) {
      haPorLabor[l.id] = Number(l.hectareas) || 1;
    }

    for (const s of salidasLote) {
      const precio = precioPromedio[s.insumo_id] || 0;
      const haLabor = haPorLabor[s.referencia_id] || 1;
      const costoporHa = (Number(s.cantidad) * precio) / haLabor;
      const categoria = (s.insumos?.subcategoria || s.insumos?.categoria || "OTRO").toUpperCase();
      if (!costoRealPorCat[categoria]) costoRealPorCat[categoria] = 0;
      costoRealPorCat[categoria] += costoporHa;
    }

    // Sumar facturas de labores a la categoría LABOR
for (const f of facturasData || []) {
  const montoBase = f.monto_neto || f.Monto || 0;
  const usdTotal = f.moneda === "USD" ? montoBase : montoBase / (f.dolar || 1);
  const laborAsociada = laboresData.find((l: any) => l.id === f.Labor_id);
  const haLabor = Number(laborAsociada?.hectareas) || 1;
  const costoporHa = usdTotal / haLabor;
  if (!costoRealPorCat["LABOR"]) costoRealPorCat["LABOR"] = 0;
  costoRealPorCat["LABOR"] += costoporHa;
}

setCostoRealPorCategoria(costoRealPorCat);
setCostoInsumosLote(costoInsumos);

    if (planId) setPlanItems(results[4]?.data || []);
    else setPlanItems([]);
  };

  const guardarPrecioFuturo = async (cultivo: string) => {
    await supabase.from("precios_futuros").update({
      precio: Number(precioTemp),
      fecha_actualizacion: new Date().toISOString(),
    }).eq("cultivo", cultivo);
    setPreciosFuturos(prev => prev.map(p => p.cultivo === cultivo ? { ...p, precio: Number(precioTemp) } : p));
    setEditandoPrecio(null);
    setPrecioTemp("");
  };

  const guardarRendimiento = async (campo: string, valor: string) => {
    const id = loteIdRef.current;
    if (!id || !valor) return;
    await supabase.from("lotes").update({ [campo]: Number(valor) }).eq("id", id);
    setLotes(prev => prev.map(l => l.id === id ? { ...l, [campo]: Number(valor) } : l));
  };

  const ha = loteInfo?.hectareas || 0;
  const cultivo = loteInfo?.cultivo_activo || "";
  const cultivoBase = cultivo.includes("Soja") ? "Soja" : cultivo.includes("Maíz") ? "Maíz" : cultivo.includes("Trigo") ? "Trigo" : "";
  const precioFuturo = preciosFuturos.find(p => p.cultivo === cultivoBase);
  const precioGranoUSD = precioFuturo?.precio || 0;

  const categorias = ["COADYUVANTE", "COSECHA", "CURASEMILLA", "FERTILIZANTE", "FUNGICIDA", "HERBICIDA", "INSECTICIDA", "LABOR", "SEGURO", "SEMILLA", "OTRO"];
  const costosPorCategoria: Record<string, number> = {};
  for (const cat of categorias) costosPorCategoria[cat] = 0;
  for (const item of planItems) {
    const precio = preciosInsumos[item.insumo_id] || 0;
    const cat = (item.categoria || "OTRO").toUpperCase();
    const costo = Number(item.cantidad_por_ha) * precio;
    costosPorCategoria[cat] = (costosPorCategoria[cat] || 0) + costo;
  }

  const costoImplantacion = categorias.reduce((acc, cat) => acc + (costosPorCategoria[cat] || 0), 0);
  const precioSojaFuturo = preciosFuturos.find(p => p.cultivo === "Soja")?.precio || 0;
  const arrendamientoPorHa = (loteInfo?.arriendo_quintales || 0) * (precioSojaFuturo / 10);
  const costoTotal = costoImplantacion + arrendamientoPorHa;

  const rendEsp = Number(rendimientoEsperado) || 0;
  const rendReal = Number(rendimientoReal) || 0;
  const bon = Number(bonificacion) || 0;
  const com = Number(comision) || 0;
  const flt = Number(flete) || 0;
  const otros = Number(otrosGastos) || 0;
  const admin = Number(administracion) || 0;

  const precioBruto = precioGranoUSD;
  const precioNeto = precioBruto * (1 + bon / 100) - (precioBruto * com / 100) - flt;
  const toneladasEsp = rendEsp / 10;
  const ingresoNetoPresup = toneladasEsp * precioNeto - admin - otros;
  const margenPresup = ingresoNetoPresup - costoTotal;

  const ingresoRealPorHa = ha > 0 ? liquidaciones.reduce((acc, l) => acc + (l.monto_neto || 0), 0) / ha : 0;


 const costoFacturasLabores = facturasLabores.reduce((acc, f) => {
  const montoBase = f.monto_neto || f.Monto || 0;
  const usd = f.moneda === "USD" ? montoBase : montoBase / (f.dolar || 1);
  return acc + usd;
}, 0);

  const costoRealPorHa = ha > 0 ? (costoFacturasLabores + costoInsumosLote) / ha : 0;
  const margenRealPorHa = ingresoRealPorHa - costoRealPorHa - arrendamientoPorHa;

  const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: 0.5 };
  const fmtUSD = (n: number) => `USD ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const colorDif = (dif: number, bueno: boolean) => bueno ? (dif >= 0 ? "#2e7d32" : "#c62828") : (dif <= 0 ? "#2e7d32" : "#c62828");
  const fmtDif = (dif: number) => `${dif >= 0 ? "+" : ""}${fmtUSD(dif)}`;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>📊 Márgenes por Lote</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Margen bruto presupuestado vs real.</p>
      </div>

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>💵 Precios futuros a cosecha</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {preciosFuturos.map(p => (
            <div key={p.cultivo} style={{ background: "#f8f9fa", borderRadius: 8, padding: "12px 16px", minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>{p.cultivo.toUpperCase()} — {p.posicion}</div>
              {editandoPrecio === p.cultivo ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <input type="number" value={precioTemp} onChange={(e) => setPrecioTemp(e.target.value)}
                    style={{ width: 90, padding: "4px 8px", borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 13 }}
                    placeholder="USD/tn" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") guardarPrecioFuturo(p.cultivo); }} />
                  <button onClick={() => guardarPrecioFuturo(p.cultivo)}
                    style={{ padding: "4px 10px", background: "#0f1f17", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✓</button>
                  <button onClick={() => setEditandoPrecio(null)}
                    style={{ padding: "4px 8px", background: "#f5f5f5", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>USD {Number(p.precio).toFixed(2)}/tn</span>
                  <button onClick={() => { setEditandoPrecio(p.cultivo); setPrecioTemp(p.precio?.toString() || ""); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#888" }}>✏️</button>
                </div>
              )}
              {p.fecha_actualizacion && (
                <div style={{ fontSize: 10, color: "#bbb", marginTop: 4 }}>
                  Actualizado: {new Date(p.fecha_actualizacion).toLocaleDateString("es-AR")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", gap: 16, alignItems: "end" }}>
          <div>
            <div style={lbl}>LOTE</div>
            <select value={loteId} onChange={(e) => setLoteId(e.target.value)} style={{ ...input, marginTop: 4 }}>
              <option value="">Seleccionar lote</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre} — {l.cultivo_activo || "Sin cultivo"} — {l.hectareas || "?"} ha</option>)}
            </select>
          </div>
          {loteInfo && (
            <>
              <div>
                <div style={lbl}>REND. ESPERADO (qq/ha)</div>
                <input type="number" value={rendimientoEsperado}
                  onChange={(e) => setRendimientoEsperado(e.target.value)}
                  onBlur={(e) => guardarRendimiento("rendimiento_esperado", e.target.value)}
                  style={{ ...input, marginTop: 4 }} placeholder="Ej: 80" />
              </div>
              <div>
                <div style={lbl}>REND. REAL (qq/ha)</div>
                <input type="number" value={rendimientoReal}
                  onChange={(e) => setRendimientoReal(e.target.value)}
                  onBlur={(e) => guardarRendimiento("rendimiento_real", e.target.value)}
                  style={{ ...input, marginTop: 4 }} placeholder="Ej: 75" />
              </div>
              <div><div style={lbl}>BONIFICACIÓN %</div><input type="number" value={bonificacion} onChange={(e) => setBonificacion(e.target.value)} style={{ ...input, marginTop: 4 }} /></div>
              <div><div style={lbl}>COMISIÓN %</div><input type="number" value={comision} onChange={(e) => setComision(e.target.value)} style={{ ...input, marginTop: 4 }} /></div>
              <div><div style={lbl}>FLETE (USD/tn)</div><input type="number" value={flete} onChange={(e) => setFlete(e.target.value)} style={{ ...input, marginTop: 4 }} /></div>
              <div><div style={lbl}>ADMIN (USD/ha)</div><input type="number" value={administracion} onChange={(e) => setAdministracion(e.target.value)} style={{ ...input, marginTop: 4 }} /></div>
            </>
          )}
        </div>

        {loteInfo && (
          <div style={{ marginTop: 16, background: "#f0faf4", borderRadius: 8, padding: "10px 16px", fontSize: 13, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <span>🌾 <strong>{loteInfo.cultivo_activo || "Sin cultivo"}</strong></span>
            <span>📐 <strong>{loteInfo.hectareas} ha</strong></span>
            {loteInfo.arriendo_quintales && <span>🏠 Arriendo: <strong>{loteInfo.arriendo_quintales} qq {loteInfo.arriendo_grano}/ha</strong></span>}
            {precioGranoUSD > 0 && <span>📈 Precio futuro {cultivoBase}: <strong>USD {precioGranoUSD}/tn</strong></span>}
            {!loteInfo.plan_id && <span style={{ color: "#e65100" }}>⚠️ Sin plan vinculado</span>}
          </div>
        )}
      </div>

      {loteInfo && (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0f1f17" }}>
                <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12, color: "white", fontWeight: 700, width: "40%" }}>CONCEPTO</th>
                <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 12, color: "white", fontWeight: 700 }}>PRESUPUESTO (USD/ha)</th>
                <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 12, color: "white", fontWeight: 700 }}>REAL (USD/ha)</th>
                <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 12, color: "white", fontWeight: 700 }}>DIF.</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(cat => (
                costosPorCategoria[cat] > 0 ? (
                  <tr key={cat} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px 14px", fontSize: 13, color: "#555", paddingLeft: 24 }}>{cat}</td>
                    <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>- {fmtUSD(costosPorCategoria[cat])}</td>
                    <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>
                      {costoRealPorCategoria[cat] > 0 ? `- ${fmtUSD(costoRealPorCategoria[cat])}` : "—"}
                    </td>
                    <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: costoRealPorCategoria[cat] > 0 ? colorDif(costoRealPorCategoria[cat] - costosPorCategoria[cat], false) : "#888" }}>
                      {costoRealPorCategoria[cat] > 0 ? fmtDif(costoRealPorCategoria[cat] - costosPorCategoria[cat]) : "—"}
                    </td>
                  </tr>
                ) : null
              ))}

              <tr style={{ borderBottom: "1px solid #f0f0f0", background: "#fff8e1" }}>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>COSTO DE IMPLANTACIÓN</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, textAlign: "right", color: "#c62828" }}>- {fmtUSD(costoImplantacion)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, textAlign: "right", color: "#c62828" }}>- {fmtUSD(costoRealPorHa)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: colorDif(costoRealPorHa - costoImplantacion, false) }}>
                  {costoImplantacion > 0 ? fmtDif(costoRealPorHa - costoImplantacion) : "—"}
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>
                  ARRENDAMIENTO ({loteInfo.arriendo_quintales} qq × USD {(precioSojaFuturo / 10).toFixed(2)}/qq)
                </td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>- {fmtUSD(arrendamientoPorHa)}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>- {fmtUSD(arrendamientoPorHa)}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
              </tr>

              <tr style={{ borderBottom: "2px solid #eee", background: "#fce4ec" }}>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800 }}>COSTO + ALQ</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800, textAlign: "right", color: "#c62828" }}>- {fmtUSD(costoTotal)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 800, textAlign: "right", color: "#c62828" }}>- {fmtUSD(costoRealPorHa + arrendamientoPorHa)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: colorDif((costoRealPorHa + arrendamientoPorHa) - costoTotal, false) }}>
                  {costoTotal > 0 ? fmtDif((costoRealPorHa + arrendamientoPorHa) - costoTotal) : "—"}
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>RENDIMIENTO (qq/ha)</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right" }}>{rendimientoEsperado || "—"}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right" }}>{rendimientoReal || "—"}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: rendReal > 0 ? colorDif(rendReal - rendEsp, true) : "#888" }}>
                  {rendimientoReal && rendimientoEsperado ? `${rendReal >= rendEsp ? "+" : ""}${(rendReal - rendEsp).toFixed(1)}` : "—"}
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>PRECIO BRUTO (USD/tn)</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right" }}>USD {precioBruto.toFixed(2)}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
                <td style={{ padding: "8px 14px" }}></td>
              </tr>

              {bon > 0 && (
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>BONIFICACIÓN ({bon}%)</td>
                  <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#2e7d32" }}>+ {fmtUSD(precioBruto * bon / 100 * toneladasEsp)}</td>
                  <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
                  <td style={{ padding: "8px 14px" }}></td>
                </tr>
              )}

              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>COMISIÓN ({com}%)</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>- {fmtUSD(precioBruto * com / 100 * toneladasEsp)}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
                <td style={{ padding: "8px 14px" }}></td>
              </tr>

              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>FLETE (USD/tn)</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>- {fmtUSD(flt * toneladasEsp)}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
                <td style={{ padding: "8px 14px" }}></td>
              </tr>

              {otros > 0 && (
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>OTROS GASTOS</td>
                  <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>- {fmtUSD(otros)}</td>
                  <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
                  <td style={{ padding: "8px 14px" }}></td>
                </tr>
              )}

              <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>PRECIO NETO (USD/tn)</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", fontWeight: 600 }}>USD {precioNeto.toFixed(2)}</td>
                <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
                <td style={{ padding: "8px 14px" }}></td>
              </tr>

              {admin > 0 && (
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px 14px", fontSize: 13, color: "#555" }}>ADMINISTRACIÓN (USD/ha)</td>
                  <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#c62828" }}>- {fmtUSD(admin)}</td>
                  <td style={{ padding: "8px 14px", fontSize: 13, textAlign: "right", color: "#888" }}>—</td>
                  <td style={{ padding: "8px 14px" }}></td>
                </tr>
              )}

              <tr style={{ borderBottom: "1px solid #eee", background: "#e3f2fd" }}>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>INGRESO NETO</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, textAlign: "right", color: "#2e7d32" }}>{fmtUSD(ingresoNetoPresup)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, textAlign: "right", color: ingresoRealPorHa > 0 ? "#2e7d32" : "#888" }}>
                  {ingresoRealPorHa > 0 ? fmtUSD(ingresoRealPorHa) : "—"}
                </td>
                <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: ingresoRealPorHa > 0 ? colorDif(ingresoRealPorHa - ingresoNetoPresup, true) : "#888" }}>
                  {ingresoRealPorHa > 0 ? fmtDif(ingresoRealPorHa - ingresoNetoPresup) : "—"}
                </td>
              </tr>

              <tr style={{ background: margenPresup >= 0 ? "#e8f5e9" : "#ffebee" }}>
                <td style={{ padding: "14px", fontSize: 15, fontWeight: 800 }}>MARGEN BRUTO</td>
                <td style={{ padding: "14px", fontSize: 15, fontWeight: 800, textAlign: "right", color: margenPresup >= 0 ? "#2e7d32" : "#c62828" }}>
                  {fmtUSD(margenPresup)}
                </td>
                <td style={{ padding: "14px", fontSize: 15, fontWeight: 800, textAlign: "right", color: margenRealPorHa >= 0 ? "#2e7d32" : "#c62828" }}>
                  {ingresoRealPorHa > 0 ? fmtUSD(margenRealPorHa) : "—"}
                </td>
                <td style={{ padding: "14px", fontSize: 15, textAlign: "right", fontWeight: 800, color: ingresoRealPorHa > 0 ? colorDif(margenRealPorHa - margenPresup, true) : "#888" }}>
                  {ingresoRealPorHa > 0 ? fmtDif(margenRealPorHa - margenPresup) : "—"}
                </td>
              </tr>
            </tbody>
          </table>

          {ha > 0 && (
            <div style={{ padding: 20, background: "#f8f9fa", borderTop: "2px solid #eee" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>💰 Totales ({ha} ha)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
                <div style={{ background: "white", borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 4 }}>INVERSIÓN SIN ALQ.</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>USD {(costoImplantacion * ha).toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ background: "white", borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 4 }}>INVERSIÓN CON ALQ.</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>USD {(costoTotal * ha).toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ background: "white", borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 4 }}>RESULTADO PRESUP. TOTAL</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: margenPresup >= 0 ? "#2e7d32" : "#c62828" }}>
                    USD {(margenPresup * ha).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                </div>
                {ingresoRealPorHa > 0 && (
                  <div style={{ background: margenRealPorHa >= 0 ? "#e8f5e9" : "#ffebee", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 4 }}>RESULTADO REAL TOTAL</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: margenRealPorHa >= 0 ? "#2e7d32" : "#c62828" }}>
                      USD {(margenRealPorHa * ha).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}