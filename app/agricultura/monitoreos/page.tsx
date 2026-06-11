"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CULTIVOS_ICONOS: Record<string, string> = {
  "Maíz 1ra": "🌽", "Maíz 2da": "🌽",
  "Soja 1ra": "🌿", "Soja 2da": "🌿",
  "Trigo": "🌾", "Girasol": "🌻", "Sorgo": "🌱",
};

const CONDICION_COLOR: Record<string, string> = {
  "Muy buena": "#e8f5e9",
  "Buena": "#f0faf4",
  "Regular": "#fff8e1",
  "Mala": "#fff3e0",
  "Muy mala": "#fce4ec",
};

export default function MonitoreosPage() {
  const router = useRouter();
  const [monitoreos, setMonitoreos] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [filtroLote, setFiltroLote] = useState("");
  const [filtroCultivo, setFiltroCultivo] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setCargando(true);
    const [{ data: monData }, { data: lotesData }] = await Promise.all([
      supabase
        .from("monitoreos")
        .select("*, lotes(nombre, cultivo_activo, hectareas)")
        .order("fecha", { ascending: false }),
      supabase.from("lotes").select("id, nombre, cultivo_activo").order("nombre"),
    ]);
    setMonitoreos(monData || []);
    setLotes(lotesData || []);
    setCargando(false);
  };

  const eliminarMonitoreo = async (id: string) => {
    if (!confirm("¿Eliminar este monitoreo?")) return;
    await supabase.from("monitoreos").delete().eq("id", id);
    await cargarDatos();
  };

  const monitoreosFiltrados = monitoreos.filter((m) => {
    if (filtroLote && m.lote_id !== filtroLote) return false;
    if (filtroCultivo && m.lotes?.cultivo_activo !== filtroCultivo) return false;
    return true;
  });

  const cultivosUnicos = [...new Set(lotes.map((l) => l.cultivo_activo).filter(Boolean))];

  const th: React.CSSProperties = {
    textAlign: "left", padding: "10px 14px", fontSize: 11,
    color: "#888", fontWeight: 600, letterSpacing: 0.5,
    background: "#f8f9fa", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "12px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0",
    verticalAlign: "middle",
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Monitoreos</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>
            Seguimiento fenológico y estado de lotes.
          </p>
        </div>
        <button
          onClick={() => router.push("/agricultura/monitoreos/nuevo")}
          style={{ padding: "10px 20px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          + Nuevo monitoreo
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select
          value={filtroLote}
          onChange={(e) => setFiltroLote(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, background: "white", minWidth: 160 }}
        >
          <option value="">Todos los lotes</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["", ...cultivosUnicos].map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCultivo(c)}
              style={{
                padding: "7px 14px", borderRadius: 20, border: "none",
                cursor: "pointer", fontWeight: 600, fontSize: 12,
                background: filtroCultivo === c ? "#0f1f17" : "#f0f0f0",
                color: filtroCultivo === c ? "white" : "#333",
              }}
            >
              {c ? `${CULTIVOS_ICONOS[c] || "🌱"} ${c}` : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div style={{ background: "white", borderRadius: 12, padding: 40, textAlign: "center", color: "#bbb" }}>
          Cargando...
        </div>
      ) : monitoreosFiltrados.length === 0 ? (
        <div style={{ background: "white", borderRadius: 12, padding: 60, textAlign: "center", color: "#bbb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Sin monitoreos registrados</div>
          <div style={{ fontSize: 13 }}>Usá el botón "+ Nuevo monitoreo" para cargar el primero.</div>
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>FECHA</th>
                <th style={th}>LOTE</th>
                <th style={th}>CULTIVO</th>
                <th style={th}>ESTADO FENOLÓGICO</th>
                <th style={th}>CONDICIÓN</th>
                <th style={th}>COBERTURA</th>
                <th style={th}>OPERADOR</th>
                <th style={th}>FOTOS</th>
                <th style={th}>OBSERVACIONES</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {monitoreosFiltrados.map((m) => {
                const cultivo = m.lotes?.cultivo_activo || "—";
                const icono = CULTIVOS_ICONOS[cultivo] || "🌱";
                return (
                  <tr key={m.id} onClick={() => router.push(`/agricultura/monitoreos/${m.id}`)} style={{ cursor: "pointer" }}>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "#555" }}>
                      {m.fecha ? new Date(m.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.lotes?.nombre || "—"}</td>
                    <td style={td}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{icono}</span>
                        <span style={{ fontSize: 12, color: "#555" }}>{cultivo}</span>
                      </span>
                    </td>
                    <td style={td}>
                      {m.estado_fenologico ? (
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#e8f5e9", color: "#2e7d32" }}>
                          {m.estado_fenologico}
                        </span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={td}>
                      {m.condicion_general ? (
                        <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: CONDICION_COLOR[m.condicion_general] || "#f5f5f5", color: "#333" }}>
                          {m.condicion_general}
                        </span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>{m.cobertura ? `${m.cobertura}%` : <span style={{ color: "#ccc" }}>—</span>}</td>
                    <td style={{ ...td, color: "#555" }}>{m.operador || <span style={{ color: "#ccc" }}>—</span>}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {m.fotos && m.fotos.length > 0 ? (
                        <span style={{ fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>📷 {m.fotos.length}</span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ ...td, maxWidth: 200, color: "#666" }}>
                      {m.comentario ? (
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12 }}>
                          {m.comentario}
                        </span>
                      ) : <span style={{ color: "#ccc" }}>—</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                     <button
  onClick={(e) => { e.stopPropagation(); eliminarMonitoreo(m.id); }}
                        style={{ padding: "6px 10px", background: "#fee", border: "1px solid #fcc", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "red" }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}