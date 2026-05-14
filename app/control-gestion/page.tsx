"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ProveedoresPage() {
  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [tipoPersona, setTipoPersona] = useState("JURIDICA");
  const [condicionIVA, setCondicionIVA] = useState("RESPONSABLE_INSCRIPTO");
  const [guardado, setGuardado] = useState(false);

  const guardarProveedor = async () => {
    if (!cuit || !razonSocial) { alert("Completá CUIT y Razón Social"); return; }
    const { error } = await supabase.from("proveedores").insert([{
      cuit, razon_social: razonSocial, tipo_persona: tipoPersona, condicion_iva: condicionIVA,
      emite_factura_a: condicionIVA === "RESPONSABLE_INSCRIPTO",
      emite_factura_b: condicionIVA === "RESPONSABLE_INSCRIPTO",
      emite_factura_c: condicionIVA === "MONOTRIBUTISTA",
    }]);
    if (error) { alert(error.message); return; }
    setGuardado(true);
    setCuit(""); setRazonSocial("");
    setTimeout(() => setGuardado(false), 3000);
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Alta de Proveedor</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registrá un nuevo proveedor en el sistema.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <div style={lbl}>CUIT *</div>
              <input value={cuit} onChange={(e) => setCuit(e.target.value)} style={input} placeholder="30-50000000-1" />
            </div>
            <div>
              <div style={lbl}>RAZÓN SOCIAL *</div>
              <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} style={input} />
            </div>
            <div>
              <div style={lbl}>TIPO DE PERSONA</div>
              <select value={tipoPersona} onChange={(e) => setTipoPersona(e.target.value)} style={input}>
                <option value="JURIDICA">Jurídica</option>
                <option value="FISICA">Física</option>
              </select>
            </div>
            <div>
              <div style={lbl}>CONDICIÓN IVA</div>
              <select value={condicionIVA} onChange={(e) => setCondicionIVA(e.target.value)} style={input}>
                <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                <option value="MONOTRIBUTISTA">Monotributista</option>
                <option value="EXENTO">Exento</option>
                <option value="NO_RESPONSABLE">No responsable</option>
              </select>
            </div>
          </div>

          {guardado && (
            <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#2e7d32", fontWeight: 600, fontSize: 14 }}>
              ✅ Proveedor guardado correctamente
            </div>
          )}

          <button onClick={guardarProveedor} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            💾 Guardar proveedor
          </button>
        </div>

        {/* INFO */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📋 Tipos de factura</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ background: "#e8f5e9", padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>Factura A</span>
              <span style={{ color: "#888", marginLeft: 8 }}>Resp. Inscripto</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ background: "#fff3e0", padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>Factura B</span>
              <span style={{ color: "#888", marginLeft: 8 }}>Resp. Inscripto</span>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ background: "#e3f2fd", padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>Factura C</span>
              <span style={{ color: "#888", marginLeft: 8 }}>Monotributista</span>
            </div>
          </div>
          <div style={{ background: "#fff8e1", borderRadius: 12, padding: 16, fontSize: 13, color: "#7c5c00" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>💡 Tip</div>
            Verificá el CUIT en la web de AFIP antes de guardar para evitar errores en la liquidación.
          </div>
        </div>
      </div>
    </div>
  );
}