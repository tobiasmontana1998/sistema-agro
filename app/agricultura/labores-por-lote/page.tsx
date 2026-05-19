"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LaboresPorLote() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<any>(null);
  const [labores, setLabores] = useState<any[]>([]);
  const [laborExpandida, setLaborExpandida] = useState<string | null>(null);
  const [insumosLabor, setInsumosLabor] = useState<Record<string, any[]>>({});
  const [laborEditando, setLaborEditando] = useState<any>(null);
  const [editForm, setEditForm] = useState({ Tipo: "", Fecha: "", Costo_total: "", hectareas: "" });
  const [eliminando, setEliminando] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("lotes").select().then(({ data }) => setLotes(data || []));
  }, []);

  useEffect(() => {
    if (!loteSeleccionado) return;
    cargarLabores();
  }, [loteSeleccionado]);

  const cargarLabores = async () => {
    const { data } = await supabase.from("labores").select("*").eq("Lote_id", loteSeleccionado.id).order("Fecha", { ascending: false });
    setLabores(data || []);
    setLaborExpandida(null);
    setInsumosLabor({});
  };

  const toggleLabor = async (labor: any) => {
    if (laborExpandida === labor.id) { setLaborExpandida(null); return; }
    setLaborExpandida(labor.id);
    if (insumosLabor[labor.id]) return;
    const { data } = await supabase.from("stock_movimientos").select("*, insumos(nombre, unidad)").eq("referencia_id", labor.id).eq("tipo", "salida");
    setInsumosLabor((prev) => ({ ...prev, [labor.id]: data || [] }));
  };

  const abrirEdicion = (labor: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setLaborEditando(labor);
    setEditForm({
      Tipo: labor.Tipo || "",
      Fecha: labor.Fecha || "",
      Costo_total: labor.Costo_total?.toString() || "",
      hectareas: labor.hectareas?.toString() || "",
    });
  };

  const guardarEdicion = async () => {
    if (!laborEditando) return;
    await supabase.from("labores").update({
      Tipo: editForm.Tipo,
      Fecha: editForm.Fecha,
      Costo_total: Number(editForm.Costo_total),
      hectareas: editForm.hectareas ? Number(editForm.hectareas) : null,
    }).eq("id", laborEditando.id);
    setLaborEditando(null);
    cargarLabores();
  };

 const confirmarEliminar = async (id: string) => {
  const { data: laborData } = await supabase
    .from("labores")
    .select("numero, factura_id")
    .eq("id", id)
    .single();

  if (laborData?.factura_id) {
    alert(`No se puede eliminar la labor L-${String(laborData.numero).padStart(3, "0")} porque tiene una factura vinculada. Desvinculala primero desde Gastos.`);
    setEliminando(null);
    return;
  }

  await supabase.from("stock_movimientos").delete().eq("referencia_id", id);
  await supabase.from("labores").delete().eq("id", id);
  setEliminando(null);
  cargarLabores();
};
const router = useRouter();
  const totalCosto = labores.reduce((acc, l) => acc + (l.Costo_total || 0), 0);

  const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box", marginTop: 4 };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#888" };

  return (
    <div>
      {/* MODAL EDICION */}
      {laborEditando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>✏️ Editar Labor</div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div style={lbl}>TIPO DE LABOR</div>
                <select value={editForm.Tipo} onChange={(e) => setEditForm({ ...editForm, Tipo: e.target.value })} style={input}>
                  <option>Siembra</option>
                  <option>Fertilización</option>
                  <option>Pulverización</option>
                  <option>Cosecha</option>
                </select>
              </div>
              <div>
                <div style={lbl}>FECHA</div>
                <input type="date" value={editForm.Fecha} onChange={(e) => setEditForm({ ...editForm, Fecha: e.target.value })} style={input} />
              </div>
              <div>
                <div style={lbl}>COSTO TOTAL</div>
                <input type="number" value={editForm.Costo_total} onChange={(e) => setEditForm({ ...editForm, Costo_total: e.target.value })} style={input} />
              </div>
              <div>
                <div style={lbl}>HECTÁREAS</div>
                <input type="number" value={editForm.hectareas} onChange={(e) => setEditForm({ ...editForm, hectareas: e.target.value })} style={input} placeholder="Ej: 50" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={guardarEdicion} style={{ flex: 1, padding: "10px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                💾 Guardar
              </button>
              <button onClick={() => setLaborEditando(null)} style={{ flex: 1, padding: "10px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {eliminando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>¿Eliminar esta labor?</div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Se eliminarán también los movimientos de stock asociados. Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => confirmarEliminar(eliminando)} style={{ flex: 1, padding: "10px", background: "#c62828", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                Eliminar
              </button>
              <button onClick={() => setEliminando(null)} style={{ flex: 1, padding: "10px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Labores por Lote</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Historial de trabajos por campo.</p>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        {/* IZQUIERDA */}
        <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 12, letterSpacing: 0.5 }}>LOTES ACTIVOS</div>
            {lotes.map((l) => (
              <div key={l.id} onClick={() => { if (loteSeleccionado?.id === l.id) { setLoteSeleccionado(null); setLabores([]); } else setLoteSeleccionado(l); }}
                style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: loteSeleccionado?.id === l.id ? "#f0faf4" : "transparent", borderLeft: loteSeleccionado?.id === l.id ? "3px solid #f5c542" : "3px solid transparent", fontWeight: loteSeleccionado?.id === l.id ? 600 : 400 }}>
                {l.nombre}
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 12, overflow: "hidden", position: "relative", height: 160 }}>
            <img src="/campo.png" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }} />
            <div style={{ position: "absolute", bottom: 12, left: 14, color: "white" }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Vista satelital</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{loteSeleccionado?.nombre || "Seleccionar lote"}</div>
            </div>
          </div>
        </div>

        {/* DERECHA */}
        <div style={{ flex: 1 }}>
          {!loteSeleccionado ? (
            <div style={{ background: "white", borderRadius: 12, padding: 40, textAlign: "center", color: "#bbb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontWeight: 600 }}>Seleccioná un lote para ver sus labores</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "white", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: "4px solid #f5c542" }}>
                  <div style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>LABORES</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{labores.length}</div>
                </div>
                <div style={{ background: "white", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: "4px solid #0f1f17" }}>
                  <div style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>COSTO TOTAL</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>${totalCosto.toLocaleString("es-AR")}</div>
                </div>
              </div>

              <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Historial de labores</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>Click en una fila para ver insumos usados</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                     <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>N°</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>FECHA</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>LABOR</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>HA</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}>COSTO</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#888", fontWeight: 600 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {labores.map((l) => (
                      <>
                        <tr key={l.id} onClick={() => toggleLabor(l)}
                          style={{ borderTop: "1px solid #f0f0f0", cursor: "pointer", background: laborExpandida === l.id ? "#f0faf4" : "white" }}
                          onMouseEnter={(e) => { if (laborExpandida !== l.id) e.currentTarget.style.background = "#f9f9f9"; }}
                          onMouseLeave={(e) => { if (laborExpandida !== l.id) e.currentTarget.style.background = "white"; }}>
                          <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#0f1f17" }}>
  L-{String(l.numero || "—").padStart(3, "0")}
</td>
                          <td style={{ padding: "12px 16px", fontSize: 14 }}>{l.Fecha || "-"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>{l.Tipo}</td>
                          <td style={{ padding: "12px 16px", fontSize: 14 }}>{l.hectareas ? `${l.hectareas} ha` : "—"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 14 }}>${l.Costo_total?.toLocaleString("es-AR") || 0}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
<button onClick={(e) => { e.stopPropagation(); router.push(`/agricultura/labores-por-lote/editar/${l.id}`); }}
                                style={{ padding: "4px 10px", background: "#f0f4ff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>✏️</button>
                              <button onClick={(e) => { e.stopPropagation(); setEliminando(l.id); }}
                                style={{ padding: "4px 10px", background: "#fff0f0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🗑️</button>
                              <span style={{ color: "#aaa" }}>{laborExpandida === l.id ? "▲" : "▼"}</span>
                            </div>
                          </td>
                        </tr>
                        {laborExpandida === l.id && (
                          <tr key={`${l.id}-ins`}>
                            <td colSpan={5} style={{ padding: "12px 24px 16px 40px", background: "#f0faf4" }}>
                              {!insumosLabor[l.id] ? <p style={{ color: "#999", fontSize: 13 }}>Cargando...</p>
                                : insumosLabor[l.id].length === 0 ? <p style={{ color: "#999", fontSize: 13 }}>Sin insumos registrados.</p>
                                : (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {insumosLabor[l.id].map((m, i) => (
                                      <span key={i} style={{ background: "#e8f5e9", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                                        {m.insumos?.nombre} — {m.cantidad} {m.insumos?.unidad}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </td>
                          </tr>
                        )}
                      </>
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