"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LaboresPorLote() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null);
  const [labores, setLabores] = useState<any[]>([]);

  // 🔹 Cargar lotes
  useEffect(() => {
    const cargarLotes = async () => {
      const { data } = await supabase
        .from("lotes")
        .select("id, nombre")
        .order("nombre");

      setLotes(data || []);
    };

    cargarLotes();
  }, []);

  // 🔹 Cargar labores del lote seleccionado
  useEffect(() => {
    if (!loteSeleccionado) return;

    console.log("BUSCANDO LABORES DEL LOTE:", loteSeleccionado);

    const cargarLabores = async () => {
      const { data, error } = await supabase
        .from("labores")
        .select("id, Tipo, Fecha, Costo_total")
        .eq("Lote_id", loteSeleccionado)
        .order("Fecha", { ascending: false });

      console.log("LABORES OBTENIDAS:", data, error);

      setLabores(data || []);
    };

    cargarLabores();
  }, [loteSeleccionado]);

  return (
    <div style={{ padding: 40 }}>
      <h1>Labores por lote</h1>

      <h3>Lotes</h3>
      <ul>
        {lotes.map((lote) => (
          <li key={lote.id}>
            <button onClick={() => setLoteSeleccionado(lote.id)}>
              {lote.nombre}
            </button>
          </li>
        ))}
      </ul>

      {loteSeleccionado && (
        <>
          <hr />
          <h3>Labores</h3>

          {labores.length === 0 ? (
            <p>No hay labores para este lote</p>
          ) : (
            <table border={1} cellPadding={8}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {labores.map((l) => (
                  <tr key={l.id}>
                    <td>{l.Tipo}</td>
                    <td>{l.Fecha}</td>
                    <td>{l.Costo_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}