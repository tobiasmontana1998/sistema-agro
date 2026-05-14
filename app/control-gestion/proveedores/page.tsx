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
  const [domicilioFiscal, setDomicilioFiscal] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [cbu, setCbu] = useState("");
  const [aliasCbu, setAliasCbu] = useState("");
  const [banco, setBanco] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [guardado, setGuardado] = useState(false);

  const guardarProveedor = async () => {
    if (!cuit || !razonSocial) {
      alert("Completá CUIT y Razón Social");
      return;
    }

    const { error } = await supabase.from("proveedores").insert([{
      cuit,
      razon_social: razonSocial,
      tipo_persona: tipoPersona,
      condicion_iva: condicionIVA,
      emite_factura_a: condicionIVA === "RESPONSABLE_INSCRIPTO",
      emite_factura_b: condicionIVA === "RESPONSABLE_INSCRIPTO",
      emite_factura_c: condicionIVA === "MONOTRIBUTISTA",
      domicilio_fiscal: domicilioFiscal,
      localidad,
      provincia,
      telefono,
      email,
      cbu,
      alias_cbu: aliasCbu,
      banco,
      contacto_nombre: contactoNombre,
      contacto_telefono: contactoTelefono,
      notas,
      activo: true,
    }]);

    if (error) { alert(error.message); return; }

    setGuardado(true);
    setCuit(""); setRazonSocial(""); setDomicilioFiscal(""); setLocalidad("");
    setProvincia(""); setTelefono(""); setEmail(""); setCbu(""); setAliasCbu("");
    setBanco(""); setContactoNombre(""); setContactoTelefono(""); setNotas("");
    setTimeout(() => setGuardado(false), 3000);
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };
  const section: React.CSSProperties = { borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 20 };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Alta de Proveedor</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registrá un nuevo proveedor en el sistema.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28 }}>

          {/* DATOS FISCALES */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📋 Datos fiscales</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 4 }}>
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

          {/* DOMICILIO */}
          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📍 Domicilio fiscal</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={lbl}>DIRECCIÓN</div>
                <input value={domicilioFiscal} onChange={(e) => setDomicilioFiscal(e.target.value)} style={input} placeholder="Calle 123" />
              </div>
              <div>
                <div style={lbl}>LOCALIDAD</div>
                <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} style={input} />
              </div>
              <div>
                <div style={lbl}>PROVINCIA</div>
                <select value={provincia} onChange={(e) => setProvincia(e.target.value)} style={input}>
                  <option value="">Seleccionar</option>
                  <option>Buenos Aires</option>
                  <option>CABA</option>
                  <option>Córdoba</option>
                  <option>Santa Fe</option>
                  <option>Entre Ríos</option>
                  <option>Mendoza</option>
                  <option>Tucumán</option>
                  <option>Salta</option>
                  <option>Chaco</option>
                  <option>Corrientes</option>
                  <option>Misiones</option>
                  <option>Santiago del Estero</option>
                  <option>San Juan</option>
                  <option>San Luis</option>
                  <option>La Rioja</option>
                  <option>Catamarca</option>
                  <option>Jujuy</option>
                  <option>Formosa</option>
                  <option>La Pampa</option>
                  <option>Neuquén</option>
                  <option>Río Negro</option>
                  <option>Chubut</option>
                  <option>Santa Cruz</option>
                  <option>Tierra del Fuego</option>
                </select>
              </div>
              <div>
                <div style={lbl}>TELÉFONO</div>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} style={input} placeholder="+54 11 1234-5678" />
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <div style={lbl}>EMAIL</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} placeholder="contacto@proveedor.com" />
            </div>
          </div>

          {/* DATOS BANCARIOS */}
          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🏦 Datos bancarios</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={lbl}>CBU</div>
                <input value={cbu} onChange={(e) => setCbu(e.target.value)} style={input} placeholder="0000000000000000000000" />
              </div>
              <div>
                <div style={lbl}>ALIAS CBU</div>
                <input value={aliasCbu} onChange={(e) => setAliasCbu(e.target.value)} style={input} placeholder="alias.proveedor" />
              </div>
              <div>
                <div style={lbl}>BANCO</div>
                <input value={banco} onChange={(e) => setBanco(e.target.value)} style={input} placeholder="Banco Nación" />
              </div>
            </div>
          </div>

          {/* CONTACTO */}
          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>👤 Contacto comercial</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={lbl}>NOMBRE</div>
                <input value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} style={input} placeholder="Juan García" />
              </div>
              <div>
                <div style={lbl}>TELÉFONO</div>
                <input value={contactoTelefono} onChange={(e) => setContactoTelefono(e.target.value)} style={input} placeholder="+54 11 1234-5678" />
              </div>
            </div>
          </div>

          {/* NOTAS */}
          <div style={section}>
            <div style={lbl}>NOTAS INTERNAS</div>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} style={{ ...input, height: 80, resize: "vertical" }} placeholder="Condiciones comerciales, observaciones..." />
          </div>

          {guardado && (
            <div style={{ marginTop: 16, background: "#e8f5e9", borderRadius: 8, padding: "12px 16px", color: "#2e7d32", fontWeight: 600, fontSize: 14 }}>
              ✅ Proveedor guardado correctamente
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <button onClick={guardarProveedor} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              💾 Guardar proveedor
            </button>
          </div>
        </div>

        {/* PANEL LATERAL */}
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

          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>✅ Campos requeridos</div>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.8 }}>
              <div>• CUIT</div>
              <div>• Razón social</div>
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>El resto es opcional pero recomendado para el balance.</div>
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