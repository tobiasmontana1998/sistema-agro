"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
          Proveedor,
          Numero_factura,
          Concepto,
          Tipo,
          Pagador,
          Monto,
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
      "Monto",
    ];

    const filas = gastos.map((g) => [
      g.Fecha,
      g.Fecha_vencimiento,
      g.Proveedor,
      g.Numero_factura,
      g.Concepto,
      g.Tipo,
      g.Pagador,
      g.actividades?.nombre,
      g.Monto,
    ]);

    const csv = [encabezado, ...filas]
      .map((f) => f.join(";"))
      .join("\n");

    const blob = new Blob([csv]);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "gastos.csv";
    a.click();
  };
  const gastosFiltrados = gastos
  .filter((g) =>
    g.Proveedor?.toLowerCase().includes(filtro.toLowerCase()) ||
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
const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  fontSize: 14,
};

const tdStyle = {
  padding: "12px 10px",
  fontSize: 14,
};

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
    <p>Facturas</p>
    <h2>{cantidadFacturas}</h2>
  </div>

  <div style={cardStyle}>
    <p>Pagos (CT vs OC)</p>

    <div style={{ width: "100%", height: 150 }}>
      <ResponsiveContainer>
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
      <th style={thStyle}>F. Emisión</th>
      <th style={thStyle}>F. Vto</th>
      <th style={thStyle}>Proveedor</th>
      <th style={thStyle}>Factura</th>
      <th style={thStyle}>Concepto</th>
      <th style={thStyle}>Tipo</th>
      <th style={thStyle}>Pagó</th>
      <th style={thStyle}>Monto</th>
      <th style={thStyle}>Labor</th>
      <th style={thStyle}></th>
    </tr>
  </thead>

  {/* BODY */}
  <tbody>
  {gastosFiltrados.map((g) => (
    <tr
      key={g.id}
      style={{
        borderBottom: "1px solid #eee",
      }}
    >
      <td style={tdStyle}>{g.Fecha}</td>
      <td style={tdStyle}>{g.Fecha_vencimiento || "-"}</td>
      <td style={tdStyle}>{g.Proveedor}</td>
      <td style={tdStyle}>{g.Numero_factura}</td>
      <td style={tdStyle}>{g.Concepto}</td>

      <td style={tdStyle}>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 20,
            background: "#e9ecef",
            fontSize: 12,
          }}
        >
          {g.Tipo}
        </span>
      </td>

      <td style={tdStyle}>{g.Pagador}</td>

      <td style={tdStyle}>${g.Monto.toLocaleString()}</td>

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