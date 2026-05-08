"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CargarFactura() {

  // 🔹 Estados
  const [fecha, setFecha] = useState("");
  const [fechaVto, setFechaVto] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagador, setPagador] = useState("");
  const [monto, setMonto] = useState("");

  const [actividad, setActividad] = useState("");
  const [actividades, setActividades] = useState<any[]>([]);

  const [labor, setLabor] = useState("");
  const [labores, setLabores] = useState<any[]>([]);

  // ✅ Cargar actividades
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("actividades").select();
      setActividades(data || []);
    };
    fetch();
  }, []);

  // ✅ Cargar labores
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("labores").select();
      setLabores(data || []);
    };
    fetch();
  }, []);

  // ✅ Guardar factura
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

        Actividad_id: actividad || null,
        Labor_id: labor || null,
      },
    ]);

    if (error) {
      console.error(error);
      alert("Error guardando");
      return;
    }

    alert("Factura guardada ✅");
  };
const cardStyle: React.CSSProperties = {
  background: "white",
  padding: 30,
  borderRadius: 12,
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  marginTop: 5,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 20px",
  background: "#0f3d2e",
  color: "white",
  border: "none",
  borderRadius: 8,
};

const btnSecondary: React.CSSProperties = {
  padding: "12px 20px",
  background: "#eee",
  border: "none",
  borderRadius: 8,
};
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 900 }}>

        <div style={cardStyle}>

          <h1>Cargar facturas</h1>

          <p style={{ color: "#555", marginBottom: 25 }}>
            Registro completo de gastos del sistema.
          </p>

          {/* GRID */}
          <div style={grid2}>

            <div>
              <label>Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label>Vencimiento</label>
              <input type="date" value={fechaVto} onChange={(e) => setFechaVto(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label>Proveedor *</label>
              <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label>Factura</label>
              <input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} style={inputStyle} />
            </div>

          </div>

          {/* CONCEPTO */}
          <div style={{ marginTop: 20 }}>
            <label>Concepto</label>
            <textarea value={concepto} onChange={(e) => setConcepto(e.target.value)} style={{ ...inputStyle, height: 80 }} />
          </div>

          {/* ACTIVIDAD + LABOR */}
          <div style={{ ...grid2, marginTop: 20 }}>

            <div>
              <label>Actividad</label>
              <select value={actividad} onChange={(e) => setActividad(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                {actividades.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Labor (opcional)</label>
              <select value={labor} onChange={(e) => setLabor(e.target.value)} style={inputStyle}>
                <option value="">Sin asociar</option>
                {labores.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.numero} - {l.Tipo}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* TIPO + PAGADOR */}
          <div style={{ ...grid2, marginTop: 20 }}>

            <div>
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option>Insumos</option>
                <option>Servicios</option>
                <option>Combustible</option>
              </select>
            </div>

            <div>
              <label>Pagador</label>
              <select value={pagador} onChange={(e) => setPagador(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option>CT</option>
                <option>OC</option>
                <option>Sociedad</option>
              </select>
            </div>

          </div>

          {/* MONTO */}
          <div style={{ marginTop: 20 }}>
            <label>Monto *</label>
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={inputStyle} />
          </div>

          {/* BOTONES */}
          <div style={{ marginTop: 30, display: "flex", gap: 10 }}>
            <button onClick={guardarFactura} style={btnPrimary}>
              💾 Guardar
            </button>

            <button style={btnSecondary}>
              Cancelar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}