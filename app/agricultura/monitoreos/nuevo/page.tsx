"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

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

export default function NuevoMonitoreoPage() {
  const router = useRouter();
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteId, setLoteId] = useState("");
  const [loteInfo, setLoteInfo] = useState<any>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [operador, setOperador] = useState("");
  const [estadoFenologico, setEstadoFenologico] = useState("");
  const [condicion, setCondicion] = useState("");
  const [cobertura, setCobertura] = useState("");
  const [comentario, setComentario] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.from("lotes").select("id, nombre, cultivo_activo, hectareas").order("nombre")
      .then(({ data }) => setLotes(data || []));
  }, []);

  useEffect(() => {
    if (!loteId) { setLoteInfo(null); setEstadoFenologico(""); return; }
    const lote = lotes.find((l) => l.id === loteId);
    setLoteInfo(lote || null);
    setEstadoFenologico("");
  }, [loteId, lotes]);

  const handleFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const nuevas = [...fotos, ...files].slice(0, 5);
    setFotos(nuevas);
    setPreviews(nuevas.map((f) => URL.createObjectURL(f)));
  };

  const quitarFoto = (index: number) => {
    const nuevas = fotos.filter((_, i) => i !== index);
    setFotos(nuevas);
    setPreviews(nuevas.map((f) => URL.createObjectURL(f)));
  };

  const guardar = async () => {
    if (!loteId) { alert("Seleccioná un lote"); return; }
    if (!fecha) { alert("Ingresá la fecha"); return; }
    setGuardando(true);

    const urlsFotos: string[] = [];
    for (const foto of fotos) {
      const ext = foto.name.split(".").pop();
      const path = `monitoreos/${loteId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("monitoreos-fotos").upload(path, foto);
      if (!error) {
        const { data: urlData } = supabase.storage.from("monitoreos-fotos").getPublicUrl(path);
        urlsFotos.push(urlData.publicUrl);
      }
    }

    const { error } = await supabase.from("monitoreos").insert([{
      lote_id: loteId,
      fecha,
      operador: operador || null,
      cultivo: loteInfo?.cultivo_activo || null,
      estado_fenologico: estadoFenologico || null,
      condicion_general: condicion || null,
      cobertura: cobertura ? Number(cobertura) : null,
      comentario: comentario || null,
      fotos: urlsFotos.length > 0 ? urlsFotos : null,
    }]);

    setGuardando(false);
    if (error) { alert("Error al guardar: " + error.message); return; }
    router.push("/agricultura/monitoreos");
  };

  const cultivoLote = loteInfo?.cultivo_activo;
  const esBarbecho = cultivoLote === "barbecho" || !cultivoLote;
  const estadios = cultivoLote && ESTADIOS[cultivoLote] ? ESTADIOS[cultivoLote] : [];

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid #e0e0e0", fontSize: 14, boxSizing: "border-box",
    fontFamily: "inherit", background: "white",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "#555",
    letterSpacing: 0.3, marginBottom: 4, display: "block",
  };
  const card: React.CSSProperties = {
    background: "white", borderRadius: 12,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28, marginBottom: 20,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 0.8,
    textTransform: "uppercase", marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => router.push("/agricultura/monitoreos")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888", padding: 0 }}
        >
          ←
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Nuevo monitoreo</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registrá el estado actual del lote.</p>
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitle}>Identificación</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          <div>
            <label style={lbl}>LOTE *</label>
            <select value={loteId} onChange={(e) => setLoteId(e.target.value)} style={input}>
              <option value="">Seleccioná un lote</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>FECHA *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} />
          </div>
          <div>
            <label style={lbl}>OPERADOR</label>
            <input
              type="text" value={operador}
              onChange={(e) => setOperador(e.target.value)}
              placeholder="Nombre del responsable"
              style={input}
            />
          </div>
        </div>

        {loteInfo && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#f0faf4", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>
              {esBarbecho ? "🟫" : (CULTIVOS_ICONOS[cultivoLote] || "🌱")}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{loteInfo.nombre}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                {esBarbecho
                  ? "Barbecho — sin cultivo activo"
                  : `${cultivoLote}${loteInfo.hectareas ? ` · ${loteInfo.hectareas} ha` : ""}`}
              </div>
            </div>
          </div>
        )}
      </div>

      {loteId && (
        <div style={card}>
          <div style={sectionTitle}>Estado fenológico</div>
          {esBarbecho ? (
            <div style={{ padding: "16px 20px", background: "#f5f0e8", borderRadius: 8, fontSize: 13, color: "#7a5c2e", fontWeight: 500 }}>
              🟫 Este lote está en barbecho — no aplica estado fenológico.
            </div>
          ) : estadios.length > 0 ? (
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
            <div style={{ padding: "16px 20px", background: "#f8f9fa", borderRadius: 8, fontSize: 13, color: "#888" }}>
              No hay escala fenológica definida para "{cultivoLote}".
            </div>
          )}
        </div>
      )}

      {loteId && (
        <div style={card}>
          <div style={sectionTitle}>Condición y cobertura</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={lbl}>CONDICIÓN GENERAL</label>
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
                      fontFamily: "inherit", transition: "all 0.12s",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>COBERTURA ESTIMADA (%)</label>
              <input
                type="number" min="0" max="100"
                value={cobertura}
                onChange={(e) => setCobertura(e.target.value)}
                placeholder="Ej: 85"
                style={{ ...input, maxWidth: 140 }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={card}>
        <div style={sectionTitle}>Fotos del lote</div>
        <label
          htmlFor="foto-input"
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 8,
            border: "1.5px dashed #ccc", borderRadius: 10,
            padding: "28px 20px", cursor: "pointer",
            background: "#fafafa",
          }}
        >
          <span style={{ fontSize: 28 }}>📷</span>
          <span style={{ fontSize: 13, color: "#666" }}>Tocá para agregar fotos</span>
          <span style={{ fontSize: 11, color: "#bbb" }}>JPG, PNG, HEIC · hasta 5 imágenes</span>
          <input
            id="foto-input" type="file"
            accept="image/*" multiple
            onChange={handleFotos}
            style={{ display: "none" }}
          />
        </label>

        {previews.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 14 }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img
                  src={src} alt={`Foto ${i + 1}`}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }}
                />
                <button
                  onClick={() => quitarFoto(i)}
                  style={{
                    position: "absolute", top: 4, right: 4,
                    background: "rgba(0,0,0,0.6)", color: "white",
                    border: "none", borderRadius: "50%",
                    width: 22, height: 22, cursor: "pointer",
                    fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={sectionTitle}>Observaciones</div>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Describí lo observado: presencia de plagas, malezas, condición del suelo, humedad, daños, recomendaciones..."
          rows={4}
          style={{ ...input, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 40 }}>
        <button
          onClick={guardar}
          disabled={guardando}
          style={{
            padding: "12px 28px", background: "#0f1f17", color: "white",
            border: "none", borderRadius: 8, cursor: guardando ? "not-allowed" : "pointer",
            fontWeight: 600, fontSize: 14, opacity: guardando ? 0.7 : 1,
            fontFamily: "inherit",
          }}
        >
          {guardando ? "Guardando..." : "💾 Guardar monitoreo"}
        </button>
        <button
          onClick={() => router.push("/agricultura/monitoreos")}
          style={{ padding: "12px 20px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}