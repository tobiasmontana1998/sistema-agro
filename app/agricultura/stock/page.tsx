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

  useEffect(() => {
    cargarStock();
  }, []);

  const cargarStock = async () => {
    const { data: insumos } = await supabase.from("insumos").select();
    const { data: movimientos } = await supabase.from("stock_movimientos").select();

    if (!insumos || !movimientos) return;

    const stockCalculado = insumos.map((insumo) => {
      const entradas = movimientos
        .filter((m) => m.insumo_id === insumo.id && m.tipo === "entrada")
        .reduce((acc, m) => acc + Number(m.cantidad), 0);

      const salidas = movimientos
        .filter((m) => m.insumo_id === insumo.id && m.tipo === "salida")
        .reduce((acc, m) => acc + Number(m.cantidad), 0);

      return {
        ...insumo,
        stock_actual: entradas - salidas,
      };
    });

    setStock(stockCalculado);
    setLoading(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    padding: 30,
    borderRadius: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };

  const categoriaColor: Record<string, string> = {
    Semillas: "#e8f5e9",
    Agroquímicos: "#fff3e0",
    Fertilizantes: "#e3f2fd",
    Combustible: "#fce4ec",
    Otros: "#f3e5f5",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={cardStyle}>
        <h1>📦 Stock de Insumos</h1>
        <p style={{ color: "#555", marginBottom: 25 }}>
          Stock actual calculado en base a remitos y labores.
        </p>

        {loading ? (
          <p>Cargando...</p>
        ) : stock.length === 0 ? (
          <p style={{ color: "#999" }}>No hay insumos cargados aún.</p>
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
              {stock.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px 15px", fontWeight: 600 }}>{item.nombre}</td>
                  <td style={{ padding: "10px 15px" }}>
                    <span style={{
                      background: categoriaColor[item.categoria] || "#eee",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 13,
                    }}>
                      {item.categoria}
                    </span>
                  </td>
                  <td style={{ padding: "10px 15px" }}>{item.unidad}</td>
                  <td style={{ padding: "10px 15px", fontWeight: 700, fontSize: 18 }}>
                    {item.stock_actual}
                  </td>
                  <td style={{ padding: "10px 15px" }}>
                    {item.stock_actual <= 0 ? (
                      <span style={{ color: "red", fontWeight: 600 }}>⚠️ Sin stock</span>
                    ) : item.stock_actual < 10 ? (
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