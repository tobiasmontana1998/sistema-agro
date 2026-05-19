"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditarLabor() {
  const { id } = useParams();
  const router = useRouter();

  const [tipo, setTipo] = useState("");
  const [cultivo, setCultivo] = useState("");
const [cultivos, setCultivos] = useState<any[]>([]);
  const [lote, setLote] = useState("");
  const [costo, setCosto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lotes, setLotes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [insumosUsados, setInsumosUsados] = useState<{ id?: string; insumo_id: string; cantidad: string }[]>([]);
  const [fecha, setFecha] = useState("");
  const [hectareas, setHectareas] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
   const [{ data: lotesData }, { data: insumosData }, { data: laborData }, { data: movData }, { data: cultivosData }] = await Promise.all([
  supabase.from("lotes").select(),
  supabase.from("insumos").select(),
  supabase.from("labores").select("*").eq("id", id).single(),
  supabase.from("stock_movimientos").select("*").eq("referencia_id", id).eq("tipo", "salida"),
  supabase.from("cultivos").select("id, nombre"),
]);
setCultivos(cultivosData || []);
      setInsumos(insumosData || []);
      if (laborData) {
        setTipo(laborData.Tipo || "");
        setLote(laborData.Lote_id || "");
        setCultivo(laborData.Cultivo_id || "");
        setFecha(laborData.Fecha || "");
        setHectareas(laborData.hectareas?.toString() || "");
        const costoTotal = laborData.Costo_total || 0;
        const ha = laborData.hectareas || 1;
        setCosto((costoTotal / ha).toString());
      }
      setInsumosUsados((movData || []).map((m: any) => ({ id: m.id, insumo_id: m.insumo_id, cantidad: m.cantidad.toString() })));
      setCargando(false);
    };
    fetchData();
  }, [id]);

  const agregarInsumo = () => setInsumosUsados([...insumosUsados, { insumo_id: "", cantidad: "" }]);
  const actualizarInsumo = (index: number, campo: string, valor: string) => {
    const updated = [...insumosUsados];
    updated[index] = { ...updated[index], [campo]: valor };
    setInsumosUsados(updated);
  };
  const quitarInsumo = (index: number) => setInsumosUsados(insumosUsados.filter((_, i) => i !== index));

  const costoTotal = costo && hectareas ? Number(costo) * Number(hectareas) : Number(costo) || 0;

  const guardarEdicion = async () => {
    if (!tipo || !lote) { alert("Faltan campos obligatorios"); return; }

    await supabase.from("labores").update({
      Tipo: tipo,
      Lote_id: lote,
      Cultivo_id: cultivo || null,
      Fecha: fecha,
      Costo_total: costoTotal,
      hectareas: hectareas ? Number(hectareas) : null,
    }).eq("id", id);

    // Eliminar movimientos viejos y recrear
    await supabase.from("stock_movimientos").delete().eq("referencia_id", id).eq("tipo", "salida");

    for (const item of insumosUsados) {
      if (item.insumo_id && item.cantidad) {
        await supabase.from("stock_movimientos").insert([{
          insumo_id: item.insumo_id,
          tipo: "salida",
          cantidad: Number(item.cantidad),
          motivo: "labor",
          referencia_id: id,
          observaciones: `Labor: ${tipo} - Lote: ${lote}`,
        }]);
      }
    }

    alert("Labor actualizada ✅");
    router.back();
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };

  if (cargando) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>✏️ Editar Labor</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Modificá los datos de la labor.</p>
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
  {cultivos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
            <p style={{ color: "#bbb", fontSize: 13, margin: "8px 0" }}>Sin insumos registrados.</p>
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
                <input type="number" value={item.cantidad} onChange={(e) => actualizarInsumo(index, "cantidad", e.target.value)} style={input} />
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
          <button onClick={guardarEdicion} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            💾 Guardar cambios
          </button>
          <button onClick={() => router.back()} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}