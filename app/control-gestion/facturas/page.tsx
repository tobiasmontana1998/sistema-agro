"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CargarFactura() {
  const [fecha, setFecha] = useState("");
  const [fechaVto, setFechaVto] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagador, setPagador] = useState("");
  const [monto, setMonto] = useState("");

  // ✅ GUARDAR FACTURA
  const guardarFactura = async () => {
    if (!fecha || !proveedor || !monto) {
      alert("Completá los campos obligatorios");
      return;
    }

    const { error } = await supabase.from("facturas").insert([
      {
        Fecha: fecha,
        Fecha_vencimiento: fechaVto || null,
        Proveedor: proveedor,
        Numero_factura: numeroFactura,
        Concepto: concepto,
        Tipo: tipo,
        Pagador: pagador,
        Monto: Number(monto),
      },
    ]);

    if (error) {
      console.error(error);
      alert("Error guardando factura");
      return;
    }

    alert("Factura guardada ✅");

    // ✅ limpiar form
    setFecha("");
    setFechaVto("");
    setProveedor("");
    setNumeroFactura("");
    setConcepto("");
    setTipo("");
    setPagador("");
    setMonto("");
  };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  marginTop: 5,
  fontSize: 14,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 20px",
  background: "#0f3d2e",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "12px 20px",
  background: "#eee",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 900 }}>
        <div
          style={{
            background: "white",
            padding: 30,
            borderRadius: 12,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <h1>Cargar facturas</h1>

          <p style={{ color: "#555", marginBottom: 25 }}>
            Registro de gastos del sistema.
          </p>

          {/* ✅ GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}
          >
            <div>
              <label>Fecha de emisión *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label>Fecha de vencimiento</label>
              <input
                type="date"
                value={fechaVto}
                onChange={(e) => setFechaVto(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label>Proveedor *</label>
              <input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Ej: Agroinsumos SA"
                style={inputStyle}
              />
            </div>

            <div>
              <label>Número factura</label>
              <input
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* ✅ CONCEPTO */}
          <div style={{ marginTop: 20 }}>
            <label>Concepto</label>
            <textarea
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              style={{
                ...inputStyle,
                height: 80,
              }}
            />
          </div>

          {/* ✅ TIPO + PAGADOR */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginTop: 20,
            }}
          >
            <div>
              <label>Tipo de gasto</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar</option>
                <option>Insumos</option>
                <option>Servicios</option>
                <option>Combustible</option>
              </select>
            </div>

            <div>
              <label>Quién pagó</label>
              <select
                value={pagador}
                onChange={(e) => setPagador(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar</option>
                <option>CT</option>
                <option>OC</option>
              </select>
            </div>
          </div>

          {/* ✅ MONTO */}
          <div style={{ marginTop: 20 }}>
            <label>Monto *</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* ✅ BOTONES */}
          <div style={{ marginTop: 30, display: "flex", gap: 10 }}>
            <button onClick={guardarFactura} style={btnPrimary}>
              💾 Guardar factura
            </button>

            <button style={btnSecondary}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}