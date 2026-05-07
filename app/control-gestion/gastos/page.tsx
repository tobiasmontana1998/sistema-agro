"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Gastos() {
  const [gastos, setGastos] = useState<any[]>([]);

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
    const confirmar = confirm("¿Estás seguro que querés eliminar este gasto?");
    if (!confirmar) return;

    const { error } = await supabase
      .from("facturas")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error eliminando gasto");
      return;
    }

    setGastos((prev) => prev.filter((g) => g.id !== id));
  };

  // 🔹 Exportar Excel
 const exportarCSV = () => {
  const encabezado = [
    "Fecha emisión",
    "Fecha vencimiento",
    "Proveedor",
    "N° factura",
    "Concepto",
    "Tipo",
    "Pagador",
    "Actividad",
    "Monto",
    "Labor",
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
    g.labores ? `#${g.labores.numero}` : "-",
  ]);

  const csv = [encabezado, ...filas]
    .map((fila) => fila.join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "gastos.csv";
  link.click();
};

  return (
    <div style={{ padding: 40 }}>
      <h1>Gastos</h1>

      <button onClick={exportarCSV}>
        Exportar a Excel
      </button>

      {gastos.length === 0 ? (
        <p>No hay gastos cargados</p>
      ) : (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>F. Emisión</th>
              <th>F. Vto</th>
              <th>Proveedor</th>
              <th>N° Factura</th>
              <th>Concepto</th>
              <th>Tipo</th>
              <th>Pagó</th>
              <th>Actividad</th>
              <th>Monto</th>
              <th>Labor</th>
              <th>Eliminar</th>
            </tr>
          </thead>

          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>{g.Fecha}</td>
                <td>{g.Fecha_vencimiento}</td>
                <td>{g.Proveedor}</td>
                <td>{g.Numero_factura}</td>
                <td>{g.Concepto}</td>
                <td>{g.Tipo}</td>
                <td>{g.Pagador}</td>
                <td>{g.actividades?.nombre}</td>
                <td>{g.Monto}</td>

                <td>
                  {g.labores ? `#${g.labores.numero}` : "-"}
                </td>

                <td>
                  <button onClick={() => eliminarGasto(g.id)}>
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}