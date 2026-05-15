"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PROVINCIAS = ["Buenos Aires","CABA","Córdoba","Santa Fe","Entre Ríos","Mendoza","Tucumán","Salta","Chaco","Corrientes","Misiones","Santiago del Estero","San Juan","San Luis","La Rioja","Catamarca","Jujuy","Formosa","La Pampa","Neuquén","Río Negro","Chubut","Santa Cruz","Tierra del Fuego"];

const FORM_VACIO = { cuit: "", razon_social: "", tipo_persona: "JURIDICA", condicion_iva: "RESPONSABLE_INSCRIPTO", domicilio_fiscal: "", localidad: "", provincia: "", telefono: "", email: "", cbu: "", alias_cbu: "", banco: "", contacto_nombre: "", contacto_telefono: "", notas: "" };

export default function ProveedoresPage() {
  const [vista, setVista] = useState<"lista" | "form">("lista");
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardado, setGuardado] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => { cargarProveedores(); }, []);

  const cargarProveedores = async () => {
    const { data } = await supabase.from("proveedores").select("*").order("razon_social");
    setProveedores(data || []);
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setVista("form");
  };

  const abrirEdicion = (p: any) => {
    setEditandoId(p.id);
    setForm({
      cuit: p.cuit || "",
      razon_social: p.razon_social || "",
      tipo_persona: p.tipo_persona || "JURIDICA",
      condicion_iva: p.condicion_iva || "RESPONSABLE_INSCRIPTO",
      domicilio_fiscal: p.domicilio_fiscal || "",
      localidad: p.localidad || "",
      provincia: p.provincia || "",
      telefono: p.telefono || "",
      email: p.email || "",
      cbu: p.cbu || "",
      alias_cbu: p.alias_cbu || "",
      banco: p.banco || "",
      contacto_nombre: p.contacto_nombre || "",
      contacto_telefono: p.contacto_telefono || "",
      notas: p.notas || "",
    });
    setVista("form");
  };

  const set = (campo: string, valor: string) => setForm(prev => ({ ...prev, [campo]: valor }));

  const guardarProveedor = async () => {
    if (!form.cuit || !form.razon_social) { alert("Completá CUIT y Razón Social"); return; }

    const payload = {
      ...form,
      emite_factura_a: form.condicion_iva === "RESPONSABLE_INSCRIPTO",
      emite_factura_b: form.condicion_iva === "RESPONSABLE_INSCRIPTO",
      emite_factura_c: form.condicion_iva === "MONOTRIBUTISTA",
      activo: true,
    };

    let error;
    if (editandoId) {
      const { error: e } = await supabase.from("proveedores").update(payload).eq("id", editandoId);
      error = e;
    } else {
      const { error: e } = await supabase.from("proveedores").insert([payload]);
      error = e;
    }

    if (error) { alert(error.message); return; }

    setGuardado(true);
    await cargarProveedores();
    setTimeout(() => { setGuardado(false); setVista("lista"); }, 1500);
  };

  const proveedoresFiltrados = proveedores.filter(p =>
    p.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.cuit?.includes(busqueda)
  );

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };
  const section: React.CSSProperties = { borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 20 };

  // LISTA
  if (vista === "lista") return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Proveedores</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>{proveedores.length} proveedores registrados</p>
        </div>
        <button onClick={abrirNuevo} style={{ padding: "10px 20px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          + Nuevo proveedor
        </button>
      </div>

      <input
        placeholder="Buscar por razón social o CUIT..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, width: 320, marginBottom: 16 }}
      />

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #eee" }}>
              {["RAZÓN SOCIAL", "CUIT", "CONDICIÓN IVA", "LOCALIDAD", "TELÉFONO", "EMAIL", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#888", fontWeight: 600, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proveedoresFiltrados.map((p) => (
           <tr key={p.id}
  style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9f9f9"}
  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
  onContextMenu={async (e) => {
    e.preventDefault();
    if (!confirm(`¿Eliminar a ${p.razon_social}?`)) return;
    const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
    if (error) { alert("Error: " + error.message); return; }
    setProveedores(prev => prev.filter(x => x.id !== p.id));
  }}
>
                <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 14 }}>{p.razon_social}</td>
                <td style={{ padding: "12px 14px", fontSize: 13, color: "#888" }}>{p.cuit}</td>
                <td style={{ padding: "12px 14px", fontSize: 13 }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: p.condicion_iva === "RESPONSABLE_INSCRIPTO" ? "#e8f5e9" : p.condicion_iva === "MONOTRIBUTISTA" ? "#e3f2fd" : "#f5f5f5",
                    color: p.condicion_iva === "RESPONSABLE_INSCRIPTO" ? "#2e7d32" : p.condicion_iva === "MONOTRIBUTISTA" ? "#1565c0" : "#555",
                  }}>
                    {p.condicion_iva === "RESPONSABLE_INSCRIPTO" ? "Resp. Inscripto" : p.condicion_iva === "MONOTRIBUTISTA" ? "Monotributista" : p.condicion_iva}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", fontSize: 13, color: "#888" }}>{p.localidad || "—"}</td>
                <td style={{ padding: "12px 14px", fontSize: 13, color: "#888" }}>{p.telefono || "—"}</td>
                <td style={{ padding: "12px 14px", fontSize: 13, color: "#888" }}>{p.email || "—"}</td>
                <td style={{ padding: "12px 14px" }}>
                  <button onClick={() => abrirEdicion(p)} style={{ padding: "6px 14px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    ✏️ Editar
                  </button>
                </td>
              </tr>
            ))}
            {proveedoresFiltrados.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#bbb" }}>No hay proveedores</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // FORMULARIO
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => setVista("lista")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888" }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{editandoId ? "✏️ Editar Proveedor" : "Nuevo Proveedor"}</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Completá los datos del proveedor.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28 }}>

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📋 Datos fiscales</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div><div style={lbl}>CUIT *</div><input value={form.cuit} onChange={(e) => set("cuit", e.target.value)} style={input} placeholder="30-50000000-1" /></div>
            <div><div style={lbl}>RAZÓN SOCIAL *</div><input value={form.razon_social} onChange={(e) => set("razon_social", e.target.value)} style={input} /></div>
            <div>
              <div style={lbl}>TIPO DE PERSONA</div>
              <select value={form.tipo_persona} onChange={(e) => set("tipo_persona", e.target.value)} style={input}>
                <option value="JURIDICA">Jurídica</option>
                <option value="FISICA">Física</option>
              </select>
            </div>
            <div>
              <div style={lbl}>CONDICIÓN IVA</div>
              <select value={form.condicion_iva} onChange={(e) => set("condicion_iva", e.target.value)} style={input}>
                <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                <option value="MONOTRIBUTISTA">Monotributista</option>
                <option value="EXENTO">Exento</option>
                <option value="NO_RESPONSABLE">No responsable</option>
              </select>
            </div>
          </div>

          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📍 Domicilio fiscal</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div style={{ gridColumn: "1 / -1" }}><div style={lbl}>DIRECCIÓN</div><input value={form.domicilio_fiscal} onChange={(e) => set("domicilio_fiscal", e.target.value)} style={input} placeholder="Calle 123" /></div>
              <div><div style={lbl}>LOCALIDAD</div><input value={form.localidad} onChange={(e) => set("localidad", e.target.value)} style={input} /></div>
              <div>
                <div style={lbl}>PROVINCIA</div>
                <select value={form.provincia} onChange={(e) => set("provincia", e.target.value)} style={input}>
                  <option value="">Seleccionar</option>
                  {PROVINCIAS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div><div style={lbl}>TELÉFONO</div><input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} style={input} placeholder="+54 11 1234-5678" /></div>
            </div>
            <div style={{ marginTop: 20 }}><div style={lbl}>EMAIL</div><input value={form.email} onChange={(e) => set("email", e.target.value)} style={input} placeholder="contacto@proveedor.com" /></div>
          </div>

          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🏦 Datos bancarios</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div style={{ gridColumn: "1 / -1" }}><div style={lbl}>CBU</div><input value={form.cbu} onChange={(e) => set("cbu", e.target.value)} style={input} placeholder="0000000000000000000000" /></div>
              <div><div style={lbl}>ALIAS CBU</div><input value={form.alias_cbu} onChange={(e) => set("alias_cbu", e.target.value)} style={input} placeholder="alias.proveedor" /></div>
              <div><div style={lbl}>BANCO</div><input value={form.banco} onChange={(e) => set("banco", e.target.value)} style={input} placeholder="Banco Nación" /></div>
            </div>
          </div>

          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>👤 Contacto comercial</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div><div style={lbl}>NOMBRE</div><input value={form.contacto_nombre} onChange={(e) => set("contacto_nombre", e.target.value)} style={input} placeholder="Juan García" /></div>
              <div><div style={lbl}>TELÉFONO</div><input value={form.contacto_telefono} onChange={(e) => set("contacto_telefono", e.target.value)} style={input} placeholder="+54 11 1234-5678" /></div>
            </div>
          </div>

          <div style={section}>
            <div style={lbl}>NOTAS INTERNAS</div>
            <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} style={{ ...input, height: 80, resize: "vertical" }} placeholder="Condiciones comerciales, observaciones..." />
          </div>

          {guardado && (
            <div style={{ marginTop: 16, background: "#e8f5e9", borderRadius: 8, padding: "12px 16px", color: "#2e7d32", fontWeight: 600, fontSize: 14 }}>
              ✅ Proveedor {editandoId ? "actualizado" : "guardado"} correctamente
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button onClick={guardarProveedor} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              💾 {editandoId ? "Guardar cambios" : "Guardar proveedor"}
            </button>
            <button onClick={() => setVista("lista")} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
              Cancelar
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📋 Tipos de factura</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ background: "#e8f5e9", padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>Factura A</span><span style={{ color: "#888", marginLeft: 8 }}>Resp. Inscripto</span></div>
            <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ background: "#fff3e0", padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>Factura B</span><span style={{ color: "#888", marginLeft: 8 }}>Resp. Inscripto</span></div>
            <div style={{ fontSize: 13 }}><span style={{ background: "#e3f2fd", padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>Factura C</span><span style={{ color: "#888", marginLeft: 8 }}>Monotributista</span></div>
          </div>
          <div style={{ background: "#fff8e1", borderRadius: 12, padding: 16, fontSize: 13, color: "#7c5c00" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>💡 Tip</div>
            Verificá el CUIT en AFIP antes de guardar para evitar errores en la liquidación de IVA.
          </div>
        </div>
      </div>
    </div>
  );
}