"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LaboresPorLote() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<any>(null);
  const [labores, setLabores] = useState<any[]>([]);

  // ✅ cargar lotes
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("lotes").select();
      setLotes(data || []);
    };
    fetch();
  }, []);

  // ✅ cargar labores
  useEffect(() => {
    if (!loteSeleccionado) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("labores")
        .select("*")
        .eq("Lote_id", loteSeleccionado.id)
        .order("Fecha", { ascending: false });

      setLabores(data || []);
    };

    fetch();
  }, [loteSeleccionado]);

  // ✅ métricas
  const totalCosto = labores.reduce(
    (acc, l) => acc + (l.Costo_total || 0),
    0
  );
const cardStyle: React.CSSProperties = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
};

const cardMini: React.CSSProperties = {
  flex: 1,
  background: "white",
  padding: 15,
  borderRadius: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
};

const tdStyle: React.CSSProperties = {
  padding: 10,
};
  return (
    <div>

      <h1 style={{ marginBottom: 20 }}>Labores por lote</h1>

      <div style={{ display: "flex", gap: 30 }}>

        {/* 🔹 IZQUIERDA */}
        <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 20 }}>

  {/* ✅ LISTA LOTES */}
  <div style={cardStyle}>
    <h3>Lotes</h3>

    {lotes.map((l) => (
      <div
        key={l.id}
        onClick={() => {
          if (loteSeleccionado?.id === l.id) {
            setLoteSeleccionado(null);
            setLabores([]);
          } else {
            setLoteSeleccionado(l);
          }
        }}
        style={{
          padding: 10,
          borderRadius: 8,
          cursor: "pointer",
          marginBottom: 5,
          background:
            loteSeleccionado?.id === l.id
              ? "#e9f5ef"
              : "transparent",
        }}
      >
        <strong>{l.nombre}</strong>
      </div>
    ))}
  </div>

  {/* ✅ TARJETA SATELITAL */}
  <div
    style={{
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
      height: 180,
    }}
  >
    <img
      src="/campo.png"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />

    {/* overlay */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
      }}
    />

    {/* texto */}
    <div
      style={{
        position: "absolute",
        bottom: 10,
        left: 15,
        color: "white",
      }}
    >
      <p style={{ fontSize: 12, margin: 0 }}>Vista satelital</p>
      <strong>
        Lote: {loteSeleccionado?.nombre || "Seleccionar"}
      </strong>
    </div>
  </div>

</div>

        {/* 🔹 DERECHA */}
        <div style={{ flex: 1 }}>

          {!loteSeleccionado ? (
            <p>Seleccioná un lote</p>
          ) : (
            <>
              {/* ✅ MÉTRICAS */}
              <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>

                <div style={cardMini}>
                  <p>Labores</p>
                  <h2>{labores.length}</h2>
                </div>

                <div style={cardMini}>
                  <p>Costo total</p>
                  <h2>${totalCosto.toLocaleString()}</h2>
                </div>

              </div>

              {/* ✅ TABLA */}
              <div style={cardStyle}>

                <h3 style={{ marginBottom: 15 }}>Historial de labores</h3>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ddd" }}>
                      <th style={thStyle}>Fecha</th>
                      <th style={thStyle}>Labor</th>
                      <th style={thStyle}>Costo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {labores.map((l) => (
                      <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={tdStyle}>{l.Fecha || "-"}</td>
                        <td style={tdStyle}>{l.Tipo}</td>
                        <td style={tdStyle}>
                          ${l.Costo_total?.toLocaleString() || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
}