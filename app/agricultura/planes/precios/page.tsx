"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PreciosInsumosPage() {
  const [insumos, setInsumos] = useState<any[]>([]);
  const [precios, setPrecios] = useState<Record<string, any>>({});
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    const [{ data: insumosData }, { data: preciosData }] = await Promise.all([
      supabase.from("insumos").select().order("categoria").order("nombre"),
      supabase.from("precios_insumos").select("*"),
    ]);
    setInsumos(insumosData || []);
    const preciosMap: Record<string, any> = {};
    (preciosData || []).forEach(p => { preciosMap[p.insumo_id] = p; });
    setPrecios(preciosMap);
  };

  const actualizarPrecio = (insumoId: string, valor: string) => {
    setEditados(prev => ({ ...prev, [insumoId]: valor }));
  };

  const guardarTodo = async () => {
    setGuardando(true);
    for (const [insumoId, precio] of Object.entries(editados)) {
      if (precio === "") continue;
      const existing = precios[insumoId];
      if (existing) {
        await supabase.from("precios_insumos").update({ precio: Number(precio), fecha_actualizacion: new Date().toISOString().split("T")[0] }).eq("id", existing.id);
      } else {
        await supabase.from("precios_insumos").insert([{ insumo_id: insumoId, precio: Number(precio), moneda: "USD", fecha_actualizacion: new Date().toISOString().split("T")[0] }]);
      }
    }
    await cargarDatos();
    setEditados({});
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const categorias = [...new Set(insumos.map(i => i.categoria))].filter(Boolean);

  const insumosFiltrados = insumos.filter(i => {
    const matchTexto = i.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchCategoria = !filtroCategoria || i.categoria === filtroCategoria;
    return matchTexto && matchCategoria;
  });

  const getPrecio = (insumoId: string) => {
    if (editados[insumoId] !== undefined) return editados[insumoId];
    return precios[insumoId]?.precio?.toString() || "";
  };

  const hayEditados = Object.keys(editados).length > 0;
  const conPrecio = insumos.filter(i => precios[i.id]).length;

  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#888", fontWeight: 600, letterSpacing: 0.5, background: "#f8f9fa" };
  const td: React.CSSProperties = { padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => window.location.href = "/agricultura/planes"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888" }}>←</button>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Precios de Insumos</h1>
            <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>{conPrecio} de {insumos.length} insumos con precio cargado</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {guardado && <span style={{ color: "#2e7d32", fontWeight: 600, fontSize: 14 }}>✅ Guardado</span>}
          {hayEditados && (
            <button onClick={guardarTodo} disabled={guardando}
              style={{ padding: "10px 20px", background: guardando ? "#888" : "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              {guardando ? "Guardando..." : `💾 Guardar cambios (${Object.keys(editados).length})`}
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#f0faf4", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#2e7d32" }}>
        💡 Los precios que cargues acá se aplican automáticamente a todos los planes de cultivo.
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Buscar insumo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, width: 240 }} />
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c}>{c}</option>)}
        </select>
        {filtroCategoria && (
          <button onClick={() => setFiltroCategoria("")} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, background: "white", cursor: "pointer" }}>
            Limpiar
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>INSUMO</th>
              <th style={th}>CATEGORÍA</th>
              <th style={th}>UNIDAD</th>
              <th style={{ ...th, textAlign: "right" }}>PRECIO USD</th>
              <th style={{ ...th, textAlign: "center" }}>ÚLTIMA ACT.</th>
            </tr>
          </thead>
          <tbody>
            {insumosFiltrados.map((insumo) => {
              const precioActual = getPrecio(insumo.id);
              const tieneEditado = editados[insumo.id] !== undefined;
              return (
                <tr key={insumo.id}
                  style={{ backgroundColor: tieneEditado ? "#fffde7" : "white" }}
                  onMouseEnter={(e) => { if (!tieneEditado) e.currentTarget.style.backgroundColor = "#f9f9f9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tieneEditado ? "#fffde7" : "white"; }}
                >
                  <td style={{ ...td, fontWeight: 500 }}>{insumo.nombre}</td>
                  <td style={td}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#f0f0f0" }}>{insumo.categoria}</span></td>
                  <td style={{ ...td, color: "#888" }}>{insumo.unidad}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <span style={{ color: "#888", fontSize: 13 }}>USD</span>
                      <input type="number" value={precioActual} onChange={(e) => actualizarPrecio(insumo.id, e.target.value)} placeholder="0.00"
                        style={{ width: 90, padding: "6px 10px", borderRadius: 6, border: tieneEditado ? "2px solid #f5c542" : "1px solid #e0e0e0", fontSize: 14, textAlign: "right", fontWeight: tieneEditado ? 700 : 400, background: tieneEditado ? "#fffde7" : "white" }} />
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: "center", color: "#888", fontSize: 12 }}>
                    {precios[insumo.id] ? precios[insumo.id].fecha_actualizacion : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hayEditados && (
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={guardarTodo} disabled={guardando}
            style={{ padding: "12px 24px", background: guardando ? "#888" : "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            {guardando ? "Guardando..." : `💾 Guardar ${Object.keys(editados).length} cambios`}
          </button>
        </div>
      )}
    </div>
  );
}