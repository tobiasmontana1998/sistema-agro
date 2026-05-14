"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const [laboresCount, setLaboresCount] = useState(0);
  const [gastosTotal, setGastosTotal] = useState(0);
  const [stockBajo, setStockBajo] = useState<any[]>([]);
  const [ultimasLabores, setUltimasLabores] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];

    const [{ data: labores }, { data: facturas }, { data: insumos }, { data: movimientos }] = await Promise.all([
      supabase.from("labores").select("*").gte("Fecha", primerDiaMes),
      supabase.from("facturas").select("Monto"),
      supabase.from("insumos").select("*"),
      supabase.from("stock_movimientos").select("*"),
    ]);

    setLaboresCount(labores?.length || 0);
setGastosTotal((facturas || []).reduce((acc, f) => acc + (f.Monto || 0), 0));
    // Stock bajo
    const stockCalculado = (insumos || []).map((insumo) => {
      const entradas = (movimientos || []).filter(m => m.insumo_id === insumo.id && m.tipo === "entrada").reduce((acc, m) => acc + Number(m.cantidad), 0);
      const salidas = (movimientos || []).filter(m => m.insumo_id === insumo.id && m.tipo === "salida").reduce((acc, m) => acc + Number(m.cantidad), 0);
      return { ...insumo, stock_actual: entradas - salidas };
    }).filter(i => i.stock_actual <= 10);
    setStockBajo(stockCalculado);

    // Últimas labores
    const { data: ultimas } = await supabase.from("labores").select("*, lotes(nombre)").order("Fecha", { ascending: false }).limit(5);
    setUltimasLabores(ultimas || []);
  };

  const card: React.CSSProperties = {
    background: "white", borderRadius: 12,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24,
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Panel de Control</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>
          {new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* HERO */}
      <div style={{
        borderRadius: 16, overflow: "hidden", position: "relative",
        height: 200, marginBottom: 24,
      }}>
        <img src="/campo.png" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 24, left: 28, color: "white" }}>
          <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 2, textTransform: "uppercase" }}>Bienvenido a</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>El Encuentro</div>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ ...card, borderLeft: "4px solid #f5c542" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>LABORES DEL MES</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{laboresCount}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Actividades registradas</div>
        </div>

        <div style={{ ...card, borderLeft: "4px solid #0f3d2e" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>GASTOS TOTALES</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>${gastosTotal.toLocaleString("es-AR")}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Facturas del mes</div>
        </div>

        <div style={{ ...card, borderLeft: "4px solid #e53935" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>STOCK BAJO</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{stockBajo.length}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {stockBajo.length === 0 ? "Todo en orden ✅" : "Insumos con stock crítico"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>

        {/* ÚLTIMAS LABORES */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Actividad Reciente</h2>
            <a href="/agricultura/labores-por-lote" style={{ fontSize: 13, color: "#f5c542", textDecoration: "none", fontWeight: 600 }}>
              Ver historial →
            </a>
          </div>

          {ultimasLabores.length === 0 ? (
            <p style={{ color: "#999" }}>Sin labores registradas.</p>
          ) : (
            ultimasLabores.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0faf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    🚜
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.Tipo}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {l.lotes?.nombre || "Sin lote"} · {l.Fecha || "Sin fecha"}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  ${l.Costo_total?.toLocaleString("es-AR") || 0}
                </div>
              </div>
            ))
          )}
        </div>

        {/* STOCK BAJO */}
        <div style={card}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>⚠️ Stock Crítico</h2>
          {stockBajo.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#888" }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>Todo el stock en orden</div>
            </div>
          ) : (
            stockBajo.map((item) => (
              <div key={item.id} style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.nombre}</div>
                  <div style={{ color: item.stock_actual <= 0 ? "red" : "orange", fontWeight: 700 }}>
                    {item.stock_actual} {item.unidad}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{item.categoria}</div>
              </div>
            ))
          )}
          <a href="/agricultura/stock" style={{ display: "block", marginTop: 16, fontSize: 13, color: "#f5c542", textDecoration: "none", fontWeight: 600 }}>
            Ver stock completo →
          </a>
        </div>

      </div>
    </div>
  );
}