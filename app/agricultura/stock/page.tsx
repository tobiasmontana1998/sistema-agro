"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function StockPage() {
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaCorte, setFechaCorte] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");

  useEffect(() => { cargarStock(); }, []);

  const cargarStock = async () => {
    const { data: insumos } = await supabase.from("insumos").select();
    const { data: movimientos } = await supabase.from("stock_movimientos").select("*");

    if (!insumos || !movimientos) return;

    const stockCalculado = insumos.map((insumo) => {
      const movsFiltrados = fechaCorte
        ? movimientos.filter(m => m.insumo_id === insumo.id && m.fecha <= fechaCorte)
        : movimientos.filter(m => m.insumo_id === insumo.id);

      const entradas = movsFiltrados
        .filter(m => m.tipo === "entrada")
        .reduce((acc, m) => acc + Number(m.cantidad), 0);

      const salidas = movsFiltrados
        .filter(m => m.tipo === "salida" || m.tipo === "egreso")
        .reduce((acc, m) => acc + Number(m.cantidad), 0);

      return { ...insumo, stock_actual: entradas - salidas };
    }).filter(item => item.stock_actual > 0);

    setStock(stockCalculado);
    setLoading(false);
  };

  useEffect(() => { cargarStock(); }, [fechaCorte]);

  const stockFiltrado = stock.filter(item =>
    !filtroBusqueda || item.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase())
  );

  const cardStyle: React.CSSProperties = { background: "white", padding: 30, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" };
  const input: React.CSSProperties = { padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 };

  const categoriaColor: Record<string, string> = {
    Semillas: "#e8f5e9", Agroquímicos: "#fff3e0", Fertilizantes: "#e3f2fd",
    Combustible: "#fce4ec", Otros: "#f3e5f5",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={cardStyle}>
        <h1>📦 Stock de Insumos</h1>
        <p style={{ color: "#555", marginBottom: 20 }}>Stock calculado en base a remitos y labores.</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            style={{ ...input, width: 250 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>Stock al:</label>
            <input
              type="date"
              value={fechaCorte}
              onChange={(e) => setFechaCorte(e.target.value)}
              style={input}
            />
            {fechaCorte && (
              <button onClick={() => setFechaCorte("")} style={{ ...input, cursor: "pointer", background: "#f5f5f5", border: "1px solid #ddd" }}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p>Cargando...</p>
        ) : stockFiltrado.length === 0 ? (
          <p style={{ color: "#999" }}>No hay insumos con stock.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                <th style={{ padding: "10px 15px" }}>Insumo</th>
                <th style={{ padding: "10px 15px" }}>Categoría</th>
                <th style={{ padding: "10px 15px" }}>Unidad</th>
                <th style={{ padding: "10px 15px" }}>Stock actual</th>
                <th style={{ padding: "10px 15px" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltrado.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px 15px", fontWeight: 600 }}>{item.nombre}</td>
                  <td style={{ padding: "10px 15px" }}>
                    <span style={{ background: categoriaColor[item.categoria] || "#eee", padding: "3px 10px", borderRadius: 20, fontSize: 13 }}>
                      {item.categoria}
                    </span>
                  </td>
                  <td style={{ padding: "10px 15px" }}>{item.unidad}</td>
                  <td style={{ padding: "10px 15px", fontWeight: 700, fontSize: 18 }}>{item.stock_actual}</td>
                  <td style={{ padding: "10px 15px" }}>
                    {item.stock_actual < 10 ? (
                      <span style={{ color: "orange", fontWeight: 600 }}>⚡ Bajo</span>
                    ) : (
                      <span style={{ color: "green", fontWeight: 600 }}>✅ OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}