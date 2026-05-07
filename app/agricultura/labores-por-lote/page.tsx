"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LaboresPorLote() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null);
  const [labores, setLabores] = useState<any[]>([]);

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

  useEffect(() => {
    if (!loteSeleccionado) return;

    const cargarLabores = async () => {
      const { data } = await supabase
        .from("labores")
        .select("id, numero, Tipo, Fecha, Costo_total")
        .eq("Lote_id", loteSeleccionado)
        .order("Fecha", { ascending: false });

      setLabores(data || []);
    };

    cargarLabores();
  }, [loteSeleccionado]);

  const eliminarLabor = async (id: string) => {
    const confirmar = confirm("¿Querés eliminar esta labor?");
    if (!confirmar) return;

    const { data } = await supabase
      .from("facturas")
      .select("id")
      .eq("Labor_id", id);

    if (data && data.length > 0) {
      alert("No se puede eliminar: esta labor tiene gastos asociados");
      return;
    }

    await supabase.from("labores").delete().eq("id", id);

    setLabores((prev) => prev.filter((l) => l.id !== id));
  };

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
          <h3>Labores</h3>

          {labores.length === 0 ? (
            <p>No hay labores</p>
          ) : (
            <table border={1} cellPadding={8}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Costo</th>
                  <th>Eliminar</th>
                </tr>
              </thead>
              <tbody>
                {labores.map((l) => (
                  <tr key={l.id}>
                    <td>#{l.numero}</td>
                    <td>{l.Tipo}</td>
                    <td>{l.Fecha}</td>
                    <td>{l.Costo_total}</td>
                    <td>
                      <button onClick={() => eliminarLabor(l.id)}>
                        ❌
                      </button>
                    </td>
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