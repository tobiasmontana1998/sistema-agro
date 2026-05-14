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

  // 🔹 Cargar gastos
  useEffect(() => {
    const cargarGastos = async () => {
      const { data, error } = await supabase
        .from("facturas")
        .select(`
  id,
  Fecha,
  Fecha_vencimiento,
  Numero_factura,
  Concepto,
  Tipo,
  Pagador,
  Monto,
  monto_usd,
  dolar,
  pagada,
  proveedor_id,
  proveedores:proveedor_id (
    razon_social
  ),
  actividades ( nombre ),
  labores ( numero )
`)

        .order("Fecha", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setGastos(data || []);
    };

    cargarGastos();
  }, []);

  // 🔹 Eliminar gasto
  const eliminarGasto = async (id: string) => {
    const confirmar = confirm("¿Eliminar gasto?");
    if (!confirmar) return;

    const { error } = await supabase
      .from("facturas")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error eliminando");
      return;
    }

    setGastos((prev) => prev.filter((g) => g.id !== id));
  };

  // 🔹 Exportar CSV
  const exportarCSV = () => {
  const encabezado = [
    "Fecha emisión",
    "Fecha vencimiento",
    "Proveedor",
    "Factura",
    "Concepto",
    "Tipo",
    "Pagador",
    "Actividad",
    "Monto ARS",
    "Monto USD",
    "Dólar",
  ];

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
]);

  const csv = [encabezado, ...filas]
    .map((f) => f.join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
  type: "text/csv;charset=utf-8;"
});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "gastos_completo.csv";
  a.click();
};

  const gastosFiltrados = gastos
  .filter((g) =>
    g.proveedores?.razon_social
      ?.toLowerCase()
      .includes(filtro.toLowerCase()) ||
    g.Concepto?.toLowerCase().includes(filtro.toLowerCase())
  )
  .sort((a, b) => {
    if (orden === "fecha") {
      return new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime();
    }
    if (orden === "monto") {
      return b.Monto - a.Monto;
    }
    return 0;
  });


  // 🔹 KPIs
  const totalGastado = gastos.reduce((acc, g) => acc + (g.Monto || 0), 0);
  const cantidadFacturas = gastos.length;

  // 🔹 PIE CHART
  const totalCT = gastos
    .filter((g) => g.Pagador === "CT")
    .reduce((acc, g) => acc + g.Monto, 0);

  const totalOC = gastos
    .filter((g) => g.Pagador === "OC")
    .reduce((acc, g) => acc + g.Monto, 0);

  const totalPagos = totalCT + totalOC;

  const porcentajeCT =
    totalPagos > 0 ? ((totalCT / totalPagos) * 100).toFixed(0) : 0;

  const porcentajeOC =
    totalPagos > 0 ? ((totalOC / totalPagos) * 100).toFixed(0) : 0;

  const dataPie = [
    { name: "CT", value: totalCT },
    { name: "OC", value: totalOC },
  ];

  const COLORS = ["#0f3d2e", "#4dabf7"];

  const cardStyle = {
    flex: 1,
    background: "white",
    padding: 20,
    borderRadius: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  };

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  fontSize: 14,
};


const tdStyle = {
  padding: "12px 10px",
  fontSize: 14,
};
const facturasPendientes = gastos
  .filter((g) => g.pagada === false && g.Fecha_vencimiento)
  .sort(
    (a, b) =>
      new Date(a.Fecha_vencimiento).getTime() -
      new Date(b.Fecha_vencimiento).getTime()
  );
// fix deploy

  return (
    <div>

      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h1>Listado de Gastos</h1>
        <p style={{ color: "#555" }}>
          Visualización completa de erogaciones y costos.
        </p>
      </div>

      {/* BOTON */}
      <button
        onClick={exportarCSV}
        style={{
          marginBottom: 25,
          padding: "10px 15px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "white",
          cursor: "pointer",
        }}
      >
        ⬇ Exportar a Excel
      </button>
{/* CARDS */}
<div style={{ display: "flex", gap: 20, marginBottom: 30 }}>

  <div style={cardStyle}>
    <p>Total Gastado</p>
    <h2>${totalGastado.toLocaleString()}</h2>
  </div>
<div style={cardStyle}>
  <p>Facturas pendientes</p>

  {facturasPendientes.length === 0 ? (
    <p style={{ marginTop: 10, color: "green" }}>
      ✅ No hay facturas pendientes
    </p>
  ) : (
    <div style={{ marginTop: 10, fontSize: 13 }}>
      
      {/* HEADER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px 1fr 80px 90px",
          fontWeight: "bold",
          borderBottom: "1px solid #ddd",
          paddingBottom: 6,
          marginBottom: 6,
        }}
      >
        <div>Vto</div>
        <div>Proveedor</div>
        <div>Fact.</div>
        <div>Monto</div>
      </div>

      {/* FILAS */}
      {facturasPendientes.slice(0, 5).map((f) => (
        <div
          key={f.id}
          style={{
            display: "grid",
            gridTemplateColumns: "80px 1fr 80px 90px",
            padding: "4px 0",
            borderBottom: "1px solid #f0f0f0",
            color:
              new Date(f.Fecha_vencimiento) < new Date()
                ? "red"
                : "#000",
          }}
        >
          <div>{f.Fecha_vencimiento}</div>
          <div>{f.proveedores?.razon_social || "—"}</div>
          <div>{f.Numero_factura}</div>
          <div>${Number(f.Monto).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )}
</div>

 
  <div style={cardStyle}>
    <p>Pagos (CT vs OC)</p>

   <div style={{ width: "100%", height: 150 }}>
  <ResponsiveContainer width="100%" height={150}>
    <PieChart>
      <Pie data={dataPie} dataKey="value" outerRadius={60}>
        {dataPie.map((entry, index) => (
          <Cell key={index} fill={COLORS[index]} />
        ))}
      </Pie>
    </PieChart>
  </ResponsiveContainer>
</div>
    <div style={{ marginTop: 10 }}>
      <p>CT: {porcentajeCT}%</p>
      <p>OC: {porcentajeOC}%</p>
    </div>
  </div>

</div>

{/* FILTRO */}
<div style={{ display: "flex", gap: 15, marginBottom: 20 }}>
  <input
    type="text"
    placeholder="Buscar proveedor o concepto..."
    value={filtro}
    onChange={(e) => setFiltro(e.target.value)}
    style={{
      padding: 8,
      borderRadius: 6,
      border: "1px solid #ccc",
      width: 250,
    }}
  />

  <select
    value={orden}
    onChange={(e) => setOrden(e.target.value)}
    style={{
      padding: 8,
      borderRadius: 6,
      border: "1px solid #ccc",
    }}
  >
    <option value="fecha">Ordenar por fecha</option>
    <option value="monto">Ordenar por monto</option>
  </select>
</div>

{/* TABLA */}
<table
  style={{
    width: "100%",
    background: "white",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  }}
>

    


  {/* HEADER */}
  <thead style={{ background: "#f8f9fa" }}>
  <tr>
  <th>F. Emisión</th>
<th>F. Vto</th>
<th>Proveedor</th>
<th>Factura</th>
<th>Concepto</th>
<th>Tipo</th>
<th>Pagador</th>
<th>Pagó</th>
<th>Monto</th>
<th>Monto USD</th>
<th>Dólar</th>
<th>Labor</th>

  </tr>
</thead>

  {/* BODY */}
  <tbody>
  {gastosFiltrados.map((g) => (
    <tr
  key={g.id}
 onDoubleClick={() => {
  console.log("ID DE LA FILA:", g.id);
  window.location.href = `/control-gestion/facturas?id=${g.id}`;
}}
  style={{
  borderBottom: "1px solid #eee",
  cursor: "pointer",
  backgroundColor: g.pagada ? "#d4edda" : "white", // ✅ verde claro
}}
  
>

      
      <td style={tdStyle}>{g.Fecha}</td>
      <td style={tdStyle}>{g.Fecha_vencimiento || "-"}</td>
      <td style={tdStyle}>{g.proveedores?.razon_social}</td>
      <td style={tdStyle}>{g.Numero_factura}</td>
      <td style={tdStyle}>{g.Concepto}</td>

      <td style={tdStyle}>
        <span style={{
          padding: "4px 10px",
          borderRadius: 20,
          background: "#e9ecef",
          fontSize: 12,
        }}>
          {g.Tipo}
        </span>
      </td>

    <td style={tdStyle}>{g.Pagador}</td>

<td style={tdStyle}>
  <label style={{ cursor: "pointer" }}>
    <input
      type="checkbox"
      checked={g.pagada || false}
      onChange={async (e) => {
  const nuevoEstado = e.target.checked;

  // ✅ Si estaba pagada y la quieren desmarcar
  if (g.pagada && !nuevoEstado) {
    const confirmar = confirm("¿Seguro que querés marcar esta factura como NO pagada?");
    if (!confirmar) {
      return; // ⛔ cancelamos el cambio
    }
  }

  const { error } = await supabase
    .from("facturas")
    .update({ pagada: nuevoEstado })
    .eq("id", g.id);

  if (error) {
    alert("Error al actualizar");
    return;
  }

  setGastos((prev) =>
    prev.map((factura) =>
      factura.id === g.id
        ? { ...factura, pagada: nuevoEstado }
        : factura
    )
  );
}}
      style={{ display: "none" }}
    />

    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: "2px solid #ccc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: g.pagada ? "#28a745" : "white",
      }}
    >
      {g.pagada && (
        <span style={{ color: "white", fontWeight: "bold" }}>
          ✓
        </span>
      )}
    </div>
  </label>
</td>

      <td style={tdStyle}>
        ${g.Monto?.toLocaleString()}
      </td>

      <td style={tdStyle}>
  USD {Number(g.monto_usd).toFixed(2)}
</td>
      <td style={tdStyle}>
        {g.dolar || "-"}
      </td>

      <td style={tdStyle}>
        {g.labores ? `#${g.labores.numero}` : "-"}
      </td>

      <td style={tdStyle}>
        <button onClick={() => eliminarGasto(g.id)}>
          ❌
        </button>
      </td>

    </tr>
  ))}
</tbody>
</table>

</div>
);
}