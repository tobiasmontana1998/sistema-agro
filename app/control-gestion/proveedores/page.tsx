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

  const guardarProveedor = async () => {
    if (!cuit || !razonSocial) {
      alert("Completá CUIT y Razón Social");
      return;
    }

    const { error } = await supabase.from("proveedores").insert([
      {
        cuit,
        razon_social: razonSocial,
        tipo_persona: tipoPersona,
        condicion_iva: condicionIVA,
        emite_factura_a: condicionIVA === "RESPONSABLE_INSCRIPTO",
        emite_factura_b: condicionIVA === "RESPONSABLE_INSCRIPTO",
        emite_factura_c: condicionIVA === "MONOTRIBUTISTA",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("✅ Proveedor guardado");

    setCuit("");
    setRazonSocial("");
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <h1>Alta de proveedor</h1>

      <div style={{ marginBottom: 15 }}>
        <label>CUIT *</label>
        <input
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          style={{ width: "100%", padding: 8 }}
          placeholder="30-50000000-1"
        />
      </div>

      <div style={{ marginBottom: 15 }}>
        <label>Razón social *</label>
        <input
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <div style={{ marginBottom: 15 }}>
        <label>Tipo de persona</label>
        <select
          value={tipoPersona}
          onChange={(e) => setTipoPersona(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        >
          <option value="JURIDICA">Jurídica</option>
          <option value="FISICA">Física</option>
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Condición IVA</label>
        <select
          value={condicionIVA}
          onChange={(e) => setCondicionIVA(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        >
          <option value="RESPONSABLE_INSCRIPTO">
            Responsable Inscripto
          </option>
          <option value="MONOTRIBUTISTA">Monotributista</option>
          <option value="EXENTO">Exento</option>
          <option value="NO_RESPONSABLE">No responsable</option>
        </select>
      </div>

      <button
        onClick={guardarProveedor}
        style={{
          padding: "10px 20px",
          background: "#0f3d2e",
          color: "white",
          border: "none",
          borderRadius: 6,
        }}
      >
        Guardar proveedor
      </button>
    </div>
  );
}