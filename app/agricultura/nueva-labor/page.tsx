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
  const [hectareas, setHectareas] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: lotesData } = await supabase.from("lotes").select();
      const { data: insumosData } = await supabase.from("insumos").select();
      setLotes(lotesData || []);
      setInsumos(insumosData || []);
    };
    fetchData();
  }, []);

  const agregarInsumo = () => setInsumosUsados([...insumosUsados, { insumo_id: "", cantidad: "" }]);

  const actualizarInsumo = (index: number, campo: string, valor: string) => {
    const updated = [...insumosUsados];
    updated[index] = { ...updated[index], [campo]: valor };
    setInsumosUsados(updated);
  };

  const quitarInsumo = (index: number) => setInsumosUsados(insumosUsados.filter((_, i) => i !== index));

  const costoTotal = costo && hectareas ? Number(costo) * Number(hectareas) : Number(costo) || 0;

  const guardarLabor = async () => {
    if (!tipo || !lote) { alert("Faltan campos obligatorios"); return; }

    for (const item of insumosUsados) {
      if (!item.insumo_id || !item.cantidad) continue;
      const { data: entradas } = await supabase.from("stock_movimientos").select("cantidad").eq("insumo_id", item.insumo_id).eq("tipo", "entrada").lte("fecha", fecha);
      const { data: salidas } = await supabase.from("stock_movimientos").select("cantidad").eq("insumo_id", item.insumo_id).eq("tipo", "salida").lte("fecha", fecha);
      const totalEntradas = (entradas || []).reduce((acc, m) => acc + Number(m.cantidad), 0);
      const totalSalidas = (salidas || []).reduce((acc, m) => acc + Number(m.cantidad), 0);
      const stockDisponible = totalEntradas - totalSalidas;
      const insumoNombre = insumos.find(i => i.id === item.insumo_id)?.nombre || "Insumo";
      if (stockDisponible < Number(item.cantidad)) { alert(`Stock insuficiente de ${insumoNombre}. Disponible: ${stockDisponible}`); return; }
    }

    const { data: laborData, error } = await supabase.from("labores").insert([{
      Tipo: tipo, Lote_id: lote, Costo_total: costoTotal, Fecha: fecha, Cultivo_id: null
    }]).select().single();
    if (error) { alert("Error guardando labor"); return; }

    for (const item of insumosUsados) {
      if (item.insumo_id && item.cantidad) {
        await supabase.from("stock_movimientos").insert([{ insumo_id: item.insumo_id, tipo: "salida", cantidad: Number(item.cantidad), motivo: "labor", referencia_id: laborData.id, observaciones: `Labor: ${tipo} - Lote: ${lote}` }]);
      }
    }

    alert("Labor guardada ✅");
    setTipo(""); setCultivo(""); setLote(""); setCosto(""); setObservaciones(""); setInsumosUsados([]);
    setFecha(new Date().toISOString().split("T")[0]); setHectareas("");
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Cargar Labor</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registro de trabajos realizados en el lote.</p>
      </div>

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 30 }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div>
            <div style={lbl}>TIPO DE LABOR *</div>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}>
              <option value="">Seleccionar</option>
              <option>Siembra</option>
              <option>Fertilización</option>
              <option>Pulverización</option>
              <option>Cosecha</option>
            </select>
          </div>
          <div>
            <div style={lbl}>FECHA *</div>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} />
          </div>
          <div>
            <div style={lbl}>CULTIVO</div>
            <select value={cultivo} onChange={(e) => setCultivo(e.target.value)} style={input}>
              <option value="">Seleccionar</option>
              <option>Soja</option>
              <option>Maíz</option>
              <option>Trigo</option>
            </select>
          </div>
          <div>
            <div style={lbl}>LOTE *</div>
            <select value={lote} onChange={(e) => setLote(e.target.value)} style={input}>
              <option value="">Seleccionar</option>
              {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>COSTO POR HA</div>
            <input type="number" value={costo} onChange={(e) => setCosto(e.target.value)} style={input} placeholder="0" />
            {costo && hectareas && (
              <div style={{ fontSize: 12, color: "#0f1f17", marginTop: 6, fontWeight: 600, background: "#f0faf4", padding: "4px 10px", borderRadius: 6, display: "inline-block" }}>
                💰 Total: ${costoTotal.toLocaleString("es-AR")}
              </div>
            )}
          </div>
          <div>
            <div style={lbl}>HECTÁREAS</div>
            <input type="number" value={hectareas} onChange={(e) => setHectareas(e.target.value)} style={input} placeholder="0" />
          </div>
        </div>

        {/* INSUMOS */}
        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Insumos utilizados</div>
            <button onClick={agregarInsumo} style={{ padding: "7px 14px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              + Agregar insumo
            </button>
          </div>

          {insumosUsados.length === 0 && (
            <p style={{ color: "#bbb", fontSize: 13, margin: "8px 0" }}>Sin insumos — opcional para labores sin consumo de stock.</p>
          )}

          {insumosUsados.map((item, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, marginBottom: 16, alignItems: "start" }}>
              <div>
                <div style={{ ...lbl, marginBottom: 4 }}>INSUMO</div>
                <select value={item.insumo_id} onChange={(e) => actualizarInsumo(index, "insumo_id", e.target.value)} style={input}>
                  <option value="">Seleccionar</option>
                  {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                </select>
              </div>
              <div>
                <div style={{ ...lbl, marginBottom: 4 }}>CANTIDAD</div>
                <input
                  type="number"
                  value={item.cantidad}
                  onChange={(e) => actualizarInsumo(index, "cantidad", e.target.value)}
                  style={input}
                />
                {hectareas && item.cantidad && (
                  <div style={{ fontSize: 12, color: "#0f1f17", marginTop: 6, fontWeight: 600, background: "#f0faf4", padding: "4px 10px", borderRadius: 6, display: "inline-block" }}>
                    📐 {(Number(item.cantidad) / Number(hectareas)).toFixed(2)} {insumos.find(i => i.id === item.insumo_id)?.unidad || ""}/ha
                  </div>
                )}
              </div>
              <button onClick={() => quitarInsumo(index)} style={{ padding: "10px 14px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", color: "red", marginTop: 22 }}>✕</button>
            </div>
          ))}
        </div>

        {/* OBSERVACIONES */}
        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 8 }}>
          <div style={lbl}>OBSERVACIONES</div>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} style={{ ...input, height: 90, resize: "vertical" }} />
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <button onClick={guardarLabor} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            💾 Guardar labor
          </button>
          <button onClick={() => { setTipo(""); setCultivo(""); setLote(""); setCosto(""); setObservaciones(""); setInsumosUsados([]); setHectareas(""); }} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}