"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Gastos() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState("fecha");

  useEffect(() => {
    const cargarGastos = async () => {
      const { data, error } = await supabase
        .from("facturas")
        .select(`
          id, Fecha, Fecha_vencimiento, Numero_factura, Concepto, Tipo, Pagador, pdf_url,
          Monto, monto_usd, dolar, pagada, proveedor_id,
          proveedores:proveedor_id (razon_social),
          actividades (nombre),
          labores (numero)
        `)
        .order("Fecha", { ascending: false });
      if (error) { console.error(error); return; }
      setGastos(data || []);
    };
    cargarGastos();
  }, []);

  const eliminarGasto = async (id: string) => {
    if (!confirm("¿Eliminar gasto?")) return;
    const { error } = await supabase.from("facturas").delete().eq("id", id);
    if (error) { alert("Error eliminando"); return; }
    setGastos((prev) => prev.filter((g) => g.id !== id));
  };

  const exportarCSV = () => {
    const encabezado = ["Fecha emisión", "Fecha vencimiento", "Proveedor", "Factura", "Concepto", "Tipo", "Pagador", "Actividad", "Monto ARS", "Monto USD", "Dólar", "PDF"];
    const filas = gastos.map((g) => [
      g.Fecha,
      g.Fecha_vencimiento,
      g.proveedores?.razon_social,
      g.Numero_factura,
      g.Concepto,
      g.Tipo,
      g.Pagador,
      g.actividades?.nombre || "",
      Number(g.Monto).toFixed(2),
      Number(g.monto_usd).toFixed(2),
      Number(g.dolar).toFixed(2),
      g.pdf_url || "",
    ]);
    const csv = [encabezado, ...filas].map((f) => f.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gastos_completo.csv";
    a.click();
  };

  const gastosFiltrados = gastos
    .filter((g) =>
      g.proveedores?.razon_social?.toLowerCase().includes(filtro.toLowerCase()) ||
      g.Concepto?.toLowerCase().includes(filtro.toLowerCase())
    )
    .sort((a, b) => {
      if (orden === "fecha") return new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime();
      if (orden === "monto") return b.Monto - a.Monto;
      return 0;
    });

  const totalGastado = gastos.reduce((acc, g) => acc + (g.Monto || 0), 0);
  const totalCT = gastos.filter((g) => g.Pagador === "CT").reduce((acc, g) => acc + g.Monto, 0);
  const totalOC = gastos.filter((g) => g.Pagador === "OC").reduce((acc, g) => acc + g.Monto, 0);
  const totalPagos = totalCT + totalOC;
  const porcentajeCT = totalPagos > 0 ? ((totalCT / totalPagos) * 100).toFixed(0) : 0;
  const porcentajeOC = totalPagos > 0 ? ((totalOC / totalPagos) * 100).toFixed(0) : 0;
  const dataPie = [{ name: "CT", value: totalCT }, { name: "OC", value: totalOC }];
  const COLORS = ["#f5c542", "#0f1f17"];

  const facturasPendientes = gastos
    .filter((g) => g.pagada === false && g.Fecha_vencimiento)
    .sort((a, b) => new Date(a.Fecha_vencimiento).getTime() - new Date(b.Fecha_vencimiento).getTime());

  const card: React.CSSProperties = { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24 };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#888", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Gastos del Período</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Visualización completa de erogaciones y costos.</p>
        </div>
        <button
          onClick={exportarCSV}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#0f1f17", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          ⬇ Exportar CSV
        </button>
      </div>

      {/* MÉTRICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 20, marginBottom: 24 }}>

        <div style={{ ...card, borderLeft: "4px solid #f5c542" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TOTAL GASTADO</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>${totalGastado.toLocaleString("es-AR")}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{gastos.length} facturas registradas</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>FACTURAS PENDIENTES</div>
          {facturasPendientes.length === 0 ? (
            <div style={{ color: "green", fontWeight: 600 }}>✅ No hay facturas pendientes</div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 100px", fontWeight: 700, fontSize: 12, color: "#888", borderBottom: "1px solid #eee", paddingBottom: 6, marginBottom: 6 }}>
                <div>Vto</div><div>Proveedor</div><div>Fact.</div><div>Monto</div>
              </div>
              {facturasPendientes.slice(0, 5).map((f) => (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 100px", padding: "5px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13, color: new Date(f.Fecha_vencimiento) < new Date() ? "red" : "#333" }}>
                  <div style={{ fontWeight: 600 }}>{f.Fecha_vencimiento}</div>
                  <div>{f.proveedores?.razon_social || "—"}</div>
                  <div style={{ color: "#888" }}>{f.Numero_factura}</div>
                  <div style={{ fontWeight: 700 }}>${Number(f.Monto).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>PAGOS CT vs OC</div>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={dataPie} dataKey="value" outerRadius={50} innerRadius={28}>
                {dataPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, fontSize: 13, marginTop: 4 }}>
            <span><span style={{ color: "#f5c542", fontWeight: 700 }}>●</span> CT: {porcentajeCT}%</span>
            <span><span style={{ color: "#0f1f17", fontWeight: 700 }}>●</span> OC: {porcentajeOC}%</span>
          </div>
        </div>

      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar proveedor o concepto..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, width: 280 }}
        />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
        >
          <option value="fecha">Ordenar por fecha</option>
          <option value="monto">Ordenar por monto</option>
        </select>
      </div>

      {/* TABLA */}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #eee" }}>
              <th style={th}>F. EMISIÓN</th>
              <th style={th}>F. VTO</th>
              <th style={th}>PROVEEDOR</th>
              <th style={th}>FACTURA</th>
              <th style={th}>CONCEPTO</th>
              <th style={th}>TIPO</th>
              <th style={th}>PAGADOR</th>
              <th style={th}>PAGÓ</th>
              <th style={th}>MONTO</th>
              <th style={th}>USD</th>
              <th style={th}>DÓLAR</th>
              <th style={th}>LABOR</th>
              <th style={th}>PDF</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {gastosFiltrados.map((g) => (
              <tr
                key={g.id}
                onDoubleClick={() => { window.location.href = `/control-gestion/facturas?id=${g.id}`; }}
                style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", backgroundColor: g.pagada ? "#d4edda" : "white" }}
                onMouseEnter={(e) => { if (!g.pagada) e.currentTarget.style.backgroundColor = "#f9f9f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = g.pagada ? "#d4edda" : "white"; }}
              >
                <td style={td}>{g.Fecha}</td>
                <td style={{ ...td, color: g.Fecha_vencimiento && new Date(g.Fecha_vencimiento) < new Date() && !g.pagada ? "red" : "#333", fontWeight: g.Fecha_vencimiento && new Date(g.Fecha_vencimiento) < new Date() && !g.pagada ? 700 : 400 }}>
                  {g.Fecha_vencimiento || "-"}
                </td>
                <td style={{ ...td, fontWeight: 600 }}>{g.proveedores?.razon_social || "-"}</td>
                <td style={{ ...td, color: "#888" }}>{g.Numero_factura}</td>
                <td style={td}>{g.Concepto}</td>
                <td style={td}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, background: "#f0f0f0", fontSize: 12, fontWeight: 600 }}>
                    {g.Tipo}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: g.Pagador === "CT" ? "#fff8e1" : "#e8f5e9", color: g.Pagador === "CT" ? "#f59f00" : "#2e7d32" }}>
                    {g.Pagador}
                  </span>
                </td>
                <td style={td}>
                  <label style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={g.pagada || false}
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const nuevoEstado = e.target.checked;
                        if (g.pagada && !nuevoEstado) {
                          const confirmar = confirm("¿Seguro que querés marcar esta factura como NO pagada?");
                          if (!confirmar) return;
                        }
                        const { error } = await supabase.from("facturas").update({ pagada: nuevoEstado }).eq("id", g.id);
                        if (error) { alert("Error al actualizar"); return; }
                        setGastos((prev) => prev.map((factura) => factura.id === g.id ? { ...factura, pagada: nuevoEstado } : factura));
                      }}
                    />
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: g.pagada ? "#28a745" : "white" }}>
                      {g.pagada && <span style={{ color: "white", fontWeight: "bold", fontSize: 13 }}>✓</span>}
                    </div>
                  </label>
                </td>
                <td style={{ ...td, fontWeight: 700 }}>${g.Monto?.toLocaleString("es-AR")}</td>
                <td style={{ ...td, color: "#888" }}>USD {Number(g.monto_usd || 0).toFixed(2)}</td>
                <td style={{ ...td, color: "#888" }}>{g.dolar || "-"}</td>
                <td style={{ ...td, color: "#888" }}>{g.labores ? `#${g.labores.numero}` : "-"}</td>
                <td style={td}>
                  {g.pdf_url ? (
                    
                      <a href={g.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 6, color: "#0f1f17", fontWeight: 600, fontSize: 12, textDecoration: "none" }}
                    >
                      📄 Ver PDF
                    </a>
                  ) : (
                    <span style={{ color: "#ccc", fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={td}>
                  <button
                    onClick={(e) => { e.stopPropagation(); eliminarGasto(g.id); }}
                    style={{ background: "#fee", border: "1px solid #fcc", color: "red", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}