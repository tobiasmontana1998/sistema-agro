"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NuevaLabor() {
  const [tipo, setTipo] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [lote, setLote] = useState("");
  const [costo, setCosto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lotes, setLotes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [insumosUsados, setInsumosUsados] = useState<{ insumo_id: string; cantidad: string }[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  useEffect(() => {
    const fetchData = async () => {
      const { data: lotesData } = await supabase.from("lotes").select();
      const { data: insumosData } = await supabase.from("insumos").select();
      setLotes(lotesData || []);
      setInsumos(insumosData || []);
    };
    fetchData();
  }, []);

  const agregarInsumo = () => {
    setInsumosUsados([...insumosUsados, { insumo_id: "", cantidad: "" }]);
  };

  const actualizarInsumo = (index: number, campo: string, valor: string) => {
    const updated = [...insumosUsados];
    updated[index] = { ...updated[index], [campo]: valor };
    setInsumosUsados(updated);
  };

  const quitarInsumo = (index: number) => {
    setInsumosUsados(insumosUsados.filter((_, i) => i !== index));
  };

  const guardarLabor = async () => {
    if (!tipo || !lote) {
      alert("Faltan campos obligatorios");
      return;
    }
    // Validar que los insumos tengan remito anterior a la fecha de la labor

for (const item of insumosUsados) {
  if (!item.insumo_id || !item.cantidad) continue;

  const { data: entradas } = await supabase
    .from("stock_movimientos")
    .select("cantidad, fecha")
    .eq("insumo_id", item.insumo_id)
    .eq("tipo", "entrada")
    .lte("fecha", fecha);
  const totalEntradas = (entradas || []).reduce((acc, m) => acc + Number(m.cantidad), 0);

  const { data: salidas } = await supabase
    .from("stock_movimientos")
    .select("cantidad")
    .eq("insumo_id", item.insumo_id)
    .eq("tipo", "salida")
    .lte("fecha", fecha);

  const totalSalidas = (salidas || []).reduce((acc, m) => acc + Number(m.cantidad), 0);

  const stockDisponible = totalEntradas - totalSalidas;
  const insumoNombre = insumos.find(i => i.id === item.insumo_id)?.nombre || "Insumo";

  if (stockDisponible < Number(item.cantidad)) {
    alert(`Stock insuficiente de ${insumoNombre}. Disponible: ${stockDisponible}`);
    return;
  }
}

  const { data: laborData, error } = await supabase
  .from("labores")
  .insert([{
    Tipo: tipo,
    Lote_id: lote,
    Costo_total: Number(costo) || 0,
    Fecha: fecha,
    Cultivo_id: null,
  }])
  .select()
  .single();

    if (error) {
      alert("Error guardando labor");
      return;
    }

    // Descontar insumos del stock
    for (const item of insumosUsados) {
      if (item.insumo_id && item.cantidad) {
        await supabase.from("stock_movimientos").insert([{
          insumo_id: item.insumo_id,
          tipo: "salida",
          cantidad: Number(item.cantidad),
          motivo: "labor",
          referencia_id: laborData.id,
          observaciones: `Labor: ${tipo} - Lote: ${lote}`,
        }]);
      }
    }

    alert("Labor guardada ✅");
    setTipo(""); setCultivo(""); setLote(""); setCosto("");
    setObservaciones(""); setInsumosUsados([]);
  };

  const cardStyle: React.CSSProperties = {
    background: "white", padding: 30, borderRadius: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };
  const grid2: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 10, borderRadius: 8,
    border: "1px solid #ccc", marginTop: 5,
  };
  const btnPrimary: React.CSSProperties = {
    padding: "12px 20px", background: "#0f3d2e", color: "white",
    border: "none", borderRadius: 8, cursor: "pointer",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "12px 20px", background: "#eee", border: "none", borderRadius: 8, cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 900 }}>
        <div style={cardStyle}>
          <h1>Cargar Labor</h1>
          <p style={{ color: "#555", marginBottom: 25 }}>Registro de trabajos realizados en el lote.</p>

          <div style={grid2}>
            <div>
              <label>Tipo de labor *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option>Siembra</option>
                <option>Fertilización</option>
                <option>Pulverización</option>
                <option>Cosecha</option>
              </select>
            </div>
            <div>
  <label>Fecha de labor *</label>
  <input
    type="date"
    value={fecha}
    onChange={(e) => setFecha(e.target.value)}
    style={inputStyle}
  />
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
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Costo total</label>
              <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* INSUMOS USADOS */}
          <div style={{ marginTop: 25 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontWeight: 600 }}>Insumos utilizados</label>
              <button onClick={agregarInsumo} style={{ ...btnSecondary, padding: "6px 14px" }}>
                + Agregar insumo
              </button>
            </div>

            {insumosUsados.length === 0 && (
              <p style={{ color: "#999", fontSize: 14, marginTop: 8 }}>
                Sin insumos — opcional para labores sin consumo de stock.
              </p>
            )}

            {insumosUsados.map((item, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginTop: 10, alignItems: "end" }}>
                <div>
                  <label style={{ fontSize: 13 }}>Insumo</label>
                  <select
                    value={item.insumo_id}
                    onChange={(e) => actualizarInsumo(index, "insumo_id", e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Seleccionar</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13 }}>Cantidad</label>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => actualizarInsumo(index, "cantidad", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <button
                  onClick={() => quitarInsumo(index)}
                  style={{ padding: "10px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", color: "red" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* OBSERVACIONES */}
          <div style={{ marginTop: 20 }}>
            <label>Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              style={{ ...inputStyle, height: 100 }}
            />
          </div>

          <div style={{ marginTop: 30, display: "flex", gap: 10 }}>
            <button onClick={guardarLabor} style={btnPrimary}>💾 Guardar labor</button>
            <button style={btnSecondary}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}