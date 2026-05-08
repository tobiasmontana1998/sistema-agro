"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NuevaLabor() {

  const [tipo, setTipo] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [lote, setLote] = useState("");
  const [costo, setCosto] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [lotes, setLotes] = useState<any[]>([]);

  // ✅ cargar lotes
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("lotes").select();
      setLotes(data || []);
    };
    fetch();
  }, []);

  // ✅ guardar labor
  const guardarLabor = async () => {
    if (!tipo || !lote) {
      alert("Faltan campos obligatorios");
      return;
    }

    const { error } = await supabase.from("labores").insert([
      {
        Tipo: tipo,
        Cultivo: cultivo,
        Lote_id: lote,
        Costo_total: Number(costo) || 0,
        Observaciones: observaciones,
      },
    ]);

    if (error) {
      console.error(error);
      alert("Error al guardar");
      return;
    }

    alert("Labor guardada ✅");

    setTipo("");
    setCultivo("");
    setLote("");
    setCosto("");
    setObservaciones("");
  };
const cardStyle: React.CSSProperties = {
  background: "white",
  padding: 30,
  borderRadius: 12,
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  marginTop: 5,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 20px",
  background: "#0f3d2e",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "12px 20px",
  background: "#eee",
  border: "none",
  borderRadius: 8,
};

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>

      <div style={{ width: "100%", maxWidth: 900 }}>

        <div style={cardStyle}>

          <h1>Cargar Labor</h1>

          <p style={{ color: "#555", marginBottom: 25 }}>
            Registro de trabajos realizados en campo.
          </p>

          {/* ✅ GRID */}
          <div style={grid2}>

            <div>
              <label>Tipo de labor *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option>Siembra</option>
                <option>Fertilización</option>
                <option>Cosecha</option>
                <option>Pulverización</option>
              </select>
            </div>

            <div>
              <label>Cultivo</label>
              <select value={cultivo} onChange={(e) => setCultivo(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option>Soja</option>
                <option>Maíz</option>
                <option>Trigo</option>
              </select>
            </div>

            <div>
              <label>Lote *</label>
              <select value={lote} onChange={(e) => setLote(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Costo total</label>
              <input
                type="number"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                style={inputStyle}
                placeholder="$"
              />
            </div>

          </div>

          {/* ✅ OBSERVACIONES */}
          <div style={{ marginTop: 20 }}>
            <label>Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              style={{
                ...inputStyle,
                height: 100,
              }}
              placeholder="Detalles de la labor..."
            />
          </div>

          {/* ✅ BOTONES */}
          <div style={{ marginTop: 30, display: "flex", gap: 10 }}>

            <button onClick={guardarLabor} style={btnPrimary}>
              💾 Guardar labor
            </button>

            <button style={btnSecondary}>
              Cancelar
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}