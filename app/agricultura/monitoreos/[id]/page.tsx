"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useParams } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ESTADIOS: Record<string, string[]> = {
  "Soja 1ra": ["VE — Emergencia", "V1 — 1er nudo", "V2", "V3", "V4", "V5", "V6+", "R1 — Floración", "R2 — Plena flor", "R3 — Inicio vainas", "R4 — Vainas llenas", "R5 — Inicio llenado", "R6 — Pleno llenado", "R7 — Madurez fisiológica", "R8 — Cosecha"],
  "Soja 2da": ["VE — Emergencia", "V1 — 1er nudo", "V2", "V3", "V4", "V5", "V6+", "R1 — Floración", "R2 — Plena flor", "R3 — Inicio vainas", "R4 — Vainas llenas", "R5 — Inicio llenado", "R6 — Pleno llenado", "R7 — Madurez fisiológica", "R8 — Cosecha"],
  "Maíz 1ra": ["VE — Emergencia", "V1", "V2", "V3", "V4", "V5", "V6", "V8", "V10", "VT — Panoja", "R1 — Silking", "R2 — Ampolla", "R3 — Lechoso", "R4 — Masoso", "R5 — Dentado", "R6 — Madurez fisiológica"],
  "Maíz 2da": ["VE — Emergencia", "V1", "V2", "V3", "V4", "V5", "V6", "V8", "V10", "VT — Panoja", "R1 — Silking", "R2 — Ampolla", "R3 — Lechoso", "R4 — Masoso", "R5 — Dentado", "R6 — Madurez fisiológica"],
  "Trigo": ["Germinación", "Z10 — 1 hoja", "Z21 — Macollaje", "Z30 — Elongación", "Z31 — 1er nudo", "Z37 — Hoja bandera", "Z51 — Espigazón", "Z65 — Plena floración", "Z71 — Grano acuoso", "Z83 — Grano pastoso", "Z87 — Madurez fisiológica"],
  "Girasol": ["VE — Emergencia", "V2", "V4", "V6", "V8", "R1 — Estrella", "R2 — Elongación", "R3 — Capítulo visible", "R4 — Antesis", "R5 — Llenado", "R6 — Madurez fisiológica", "R9 — Cosecha"],
  "Sorgo": ["VE — Emergencia", "V1", "V3", "V5", "V7", "V9", "V10+", "R1 — Panoja", "R2 — Floración", "R3 — Lechoso", "R4 — Pastoso", "R5 — Duro", "R6 — Madurez"],
};

const CULTIVOS_ICONOS: Record<string, string> = {
  "Maíz 1ra": "🌽", "Maíz 2da": "🌽",
  "Soja 1ra": "🌿", "Soja 2da": "🌿",
  "Trigo": "🌾", "Girasol": "🌻", "Sorgo": "🌱",
};

const CONDICIONES = ["Muy buena", "Buena", "Regular", "Mala", "Muy mala"];

export default function DetalleMonitoreoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);

  // Datos del monitoreo
  const [loteInfo, setLoteInfo] = useState<any>(null);
  const [fecha, setFecha] = useState("");
  const [operador, setOperador] = useState("");
  const [estadoFenologico, setEstadoFenologico] = useState("");
  const [condicion, setCondicion] = useState("");
  const [cobertura, setCobertura] = useState("");
  const [comentario, setComentario] = useState("");
  const [fotosExistentes, setFotosExistentes] = useState<string[]>([]);
  const [fotosNuevas, setFotosNuevas] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => { cargarMonitoreo(); }, [id]);

  const cargarMonitoreo = async () => {
    setCargando(true);
    const { data } = await supabase
      .from("monitoreos")
      .select("*, lotes(nombre, cultivo_activo, hectareas)")
      .eq("id", id)
      .single();

    if (!data) { router.push("/agricultura/monitoreos"); return; }

    setLoteInfo(data.lotes);
    setFecha(data.fecha || "");
    setOperador(data.operador || "");
    setEstadoFenologico(data.estado_fenologico || "");
    setCondicion(data.condicion_general || "");
    setCobertura(data.cobertura?.toString() || "");
    setComentario(data.comentario || "");
    setFotosExistentes(data.fotos || []);
    setCargando(false);
  };

  const handleFotosNuevas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const total = fotosExistentes.length + fotosNuevas.length;
    const nuevas = [...fotosNuevas, ...files].slice(0, Math.max(0, 5 - fotosExistentes.length));
    setFotosNuevas(nuevas);
    setPreviews(nuevas.map(f => URL.createObjectURL(f)));
  };

  const eliminarFotoExistente = (url: string) => {
    setFotosExistentes(prev => prev.filter(f => f !== url));
  };

  const guardar = async () => {
    setGuardando(true);

    // Subir fotos nuevas
    const urlsNuevas: string[] = [];
    for (const foto of fotosNuevas) {
      const ext = foto.name.split(".").pop();
      const path = `monitoreos/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("monitoreos-fotos").upload(path, foto);
      if (!error) {
        const { data: urlData } = supabase.storage.from("monitoreos-fotos").getPublicUrl(path);
        urlsNuevas.push(urlData.publicUrl);
      }
    }

    const todasLasFotos = [...fotosExistentes, ...urlsNuevas];

    const { error } = await supabase.from("monitoreos").update({
      fecha,
      operador: operador || null,
      estado_fenologico: estadoFenologico || null,
      condicion_general: condicion || null,
      cobertura: cobertura ? Number(cobertura) : null,
      comentario: comentario || null,
      fotos: todasLasFotos.length > 0 ? todasLasFotos : null,
    }).eq("id", id);

    setGuardando(false);
    if (error) { alert("Error al guardar: " + error.message); return; }
    setFotosNuevas([]);
    setPreviews([]);
    setFotosExistentes(todasLasFotos);
    setModoEdicion(false);
  };

  const eliminarMonitoreo = async () => {
    if (!confirm("¿Eliminar este monitoreo? Esta acción no se puede deshacer.")) return;
    await supabase.from("monitoreos").delete().eq("id", id);
    router.push("/agricultura/monitoreos");
  };

  const cultivoLote = loteInfo?.cultivo_activo;
  const esBarbecho = !cultivoLote || cultivoLote === "barbecho";
  const estadios = cultivoLote && ESTADIOS[cultivoLote] ? ESTADIOS[cultivoLote] : [];

  const card: React.CSSProperties = {
    background: "white", borderRadius: 12,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28, marginBottom: 20,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 0.8,
    textTransform: "uppercase", marginBottom: 16,
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid #e0e0e0", fontSize: 14, boxSizing: "border-box",
    fontFamily: "inherit", background: "white",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "#555",
    letterSpacing: 0.3, marginBottom: 4, display: "block",
  };

  if (cargando) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 40, textAlign: "center", color: "#bbb" }}>
      Cargando...
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/agricultura/monitoreos")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888", padding: 0 }}
          >
            ←
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>
              {CULTIVOS_ICONOS[cultivoLote] || "🌱"} {loteInfo?.nombre}
            </h1>
            <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>
              {cultivoLote} · {fecha ? new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {!modoEdicion ? (
            <>
              <button
                onClick={() => setModoEdicion(true)}
                style={{ padding: "9px 18px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                ✏️ Editar
              </button>
              <button
                onClick={eliminarMonitoreo}
                style={{ padding: "9px 14px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "red" }}
              >
                🗑
              </button>
            </>
          ) : (
            <>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{ padding: "9px 18px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, opacity: guardando ? 0.7 : 1 }}
              >
                {guardando ? "Guardando..." : "💾 Guardar"}
              </button>
              <button
                onClick={() => { setModoEdicion(false); cargarMonitoreo(); }}
                style={{ padding: "9px 14px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Identificación */}
      <div style={card}>
        <div style={sectionTitle}>Identificación</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          <div>
            <label style={lbl}>LOTE</label>
            <div style={{ padding: "10px 12px", background: "#f8f9fa", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
              {loteInfo?.nombre}
            </div>
          </div>
          <div>
            <label style={lbl}>FECHA</label>
            {modoEdicion ? (
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} />
            ) : (
              <div style={{ padding: "10px 12px", background: "#f8f9fa", borderRadius: 8, fontSize: 14 }}>
                {fecha ? new Date(fecha + "T12:00:00").toLocaleDateString("es-AR") : "—"}
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>OPERADOR</label>
            {modoEdicion ? (
              <input type="text" value={operador} onChange={(e) => setOperador(e.target.value)} placeholder="Nombre del responsable" style={input} />
            ) : (
              <div style={{ padding: "10px 12px", background: "#f8f9fa", borderRadius: 8, fontSize: 14 }}>
                {operador || <span style={{ color: "#ccc" }}>—</span>}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, padding: "12px 16px", background: "#f0faf4", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>{CULTIVOS_ICONOS[cultivoLote] || "🌱"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{cultivoLote || "Barbecho"}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
              {loteInfo?.hectareas ? `${loteInfo.hectareas} ha` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Estado fenológico */}
      {!esBarbecho && (
        <div style={card}>
          <div style={sectionTitle}>Estado fenológico</div>
          {modoEdicion ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {estadios.map((e) => (
                <button
                  key={e}
                  onClick={() => setEstadoFenologico(estadoFenologico === e ? "" : e)}
                  style={{
                    padding: "8px 10px", borderRadius: 8,
                    border: estadoFenologico === e ? "2px solid #2e7d32" : "1px solid #e0e0e0",
                    background: estadoFenologico === e ? "#e8f5e9" : "white",
                    color: estadoFenologico === e ? "#1b5e20" : "#333",
                    fontSize: 12, fontWeight: estadoFenologico === e ? 700 : 400,
                    cursor: "pointer", textAlign: "left",
                    fontFamily: "inherit", transition: "all 0.12s",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <div>
              {estadoFenologico ? (
                <span style={{ padding: "6px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "#e8f5e9", color: "#2e7d32" }}>
                  {estadoFenologico}
                </span>
              ) : (
                <span style={{ color: "#ccc", fontSize: 13 }}>Sin estado registrado</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Condición */}
      <div style={card}>
        <div style={sectionTitle}>Condición y cobertura</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label style={lbl}>CONDICIÓN GENERAL</label>
            {modoEdicion ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                {CONDICIONES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCondicion(condicion === c ? "" : c)}
                    style={{
                      padding: "7px 14px", borderRadius: 20, border: "none",
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: condicion === c ? "#0f1f17" : "#f0f0f0",
                      color: condicion === c ? "white" : "#333",
                      fontFamily: "inherit",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 4 }}>
                {condicion ? (
                  <span style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#f0f0f0", color: "#333" }}>
                    {condicion}
                  </span>
                ) : <span style={{ color: "#ccc", fontSize: 13 }}>—</span>}
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>COBERTURA ESTIMADA (%)</label>
            {modoEdicion ? (
              <input
                type="number" min="0" max="100"
                value={cobertura}
                onChange={(e) => setCobertura(e.target.value)}
                placeholder="Ej: 85"
                style={{ ...input, maxWidth: 140, marginTop: 4 }}
              />
            ) : (
              <div style={{ padding: "10px 12px", background: "#f8f9fa", borderRadius: 8, fontSize: 14, marginTop: 4, display: "inline-block", minWidth: 80 }}>
                {cobertura ? `${cobertura}%` : <span style={{ color: "#ccc" }}>—</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fotos */}
      <div style={card}>
        <div style={sectionTitle}>Fotos del lote</div>

        {/* Fotos existentes */}
        {fotosExistentes.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: modoEdicion ? 16 : 0 }}>
            {fotosExistentes.map((url, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img
                  src={url} alt={`Foto ${i + 1}`}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: "1px solid #eee", cursor: "pointer" }}
                  onClick={() => window.open(url, "_blank")}
                />
                {modoEdicion && (
                  <button
                    onClick={() => eliminarFotoExistente(url)}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      background: "rgba(0,0,0,0.6)", color: "white",
                      border: "none", borderRadius: "50%",
                      width: 24, height: 24, cursor: "pointer",
                      fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Previews fotos nuevas */}
        {previews.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={src} alt={`Nueva ${i + 1}`}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: "2px dashed #2e7d32" }}
                />
                <span style={{ position: "absolute", top: 6, left: 6, background: "#2e7d32", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>NUEVA</span>
              </div>
            ))}
          </div>
        )}

        {fotosExistentes.length === 0 && previews.length === 0 && (
          <div style={{ color: "#ccc", fontSize: 13, marginBottom: modoEdicion ? 16 : 0 }}>Sin fotos cargadas</div>
        )}

        {modoEdicion && fotosExistentes.length + fotosNuevas.length < 5 && (
          <label
            htmlFor="foto-input-edit"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 8,
              border: "1.5px dashed #ccc", borderRadius: 10,
              padding: "20px", cursor: "pointer", background: "#fafafa",
            }}
          >
            <span style={{ fontSize: 24 }}>📷</span>
            <span style={{ fontSize: 13, color: "#666" }}>Agregar más fotos</span>
            <span style={{ fontSize: 11, color: "#bbb" }}>Hasta {5 - fotosExistentes.length - fotosNuevas.length} más</span>
            <input id="foto-input-edit" type="file" accept="image/*" multiple onChange={handleFotosNuevas} style={{ display: "none" }} />
          </label>
        )}
      </div>

      {/* Observaciones */}
      <div style={{ ...card, marginBottom: 40 }}>
        <div style={sectionTitle}>Observaciones</div>
        {modoEdicion ? (
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Describí lo observado..."
            rows={4}
            style={{ ...input, resize: "vertical", lineHeight: 1.6 }}
          />
        ) : (
          <div style={{ fontSize: 14, color: comentario ? "#333" : "#ccc", lineHeight: 1.7 }}>
            {comentario || "Sin observaciones"}
          </div>
        )}
      </div>

    </div>
  );
}