"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RemitosPage() {
  const [insumos, setInsumos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState("");
  const [nroRemito, setNroRemito] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<{ insumo_id: string; cantidad: string }[]>([
    { insumo_id: "", cantidad: "" }
  ]);
  const [nuevoInsumo, setNuevoInsumo] = useState({ nombre: "", categoria: "", unidad: "" });
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const { data: ins } = await supabase.from("insumos").select();
    const { data: prov } = await supabase.from("proveedores").select();
    setInsumos(ins || []);
    setProveedores(prov || []);
  };

  const agregarLinea = () => {
    setLineas([...lineas, { insumo_id: "", cantidad: "" }]);
  };

  const actualizarLinea = (index: number, campo: string, valor: string) => {
    const updated = [...lineas];
    updated[index] = { ...updated[index], [campo]: valor };
    setLineas(updated);
  };

  const quitarLinea = (index: number) => {
    if (lineas.length === 1) return;
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const guardarRemito = async () => {
    if (!fecha) { alert("Ingresá la fecha del remito"); return; }
    if (lineas.some(l => !l.insumo_id || !l.cantidad)) {
      alert("Completá todos los insumos");
      return;
    }

    const numeroRemito = nroRemito || `REM-${Date.now()}`;

    for (const linea of lineas) {
      const { error } = await supabase.from("stock_movimientos").insert([{
        insumo_id: linea.insumo_id,
        tipo: "entrada",
        cantidad: Number(linea.cantidad),
        motivo: "remito",
        fecha,
        proveedor_id: proveedorId || null,
        numero_remito: numeroRemito,
        observaciones,
      }]);
      if (error) { alert("Error guardando remito: " + error.message); return; }
    }

    setFecha("");
    setNroRemito("");
    setProveedorId("");
    setObservaciones("");
    setLineas([{ insumo_id: "", cantidad: "" }]);
    alert("Remito guardado ✅");
  };

  const guardarInsumo = async () => {
    if (!nuevoInsumo.nombre || !nuevoInsumo.categoria || !nuevoInsumo.unidad) {
      alert("Completá todos los campos");
      return;
    }
    const { error } = await supabase.from("insumos").insert([nuevoInsumo]);
    if (error) { alert("Error: " + error.message); return; }
    setNuevoInsumo({ nombre: "", categoria: "", unidad: "" });
    setMostrarNuevo(false);
    cargarDatos();
    alert("Insumo creado ✅");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 10, borderRadius: 8,
    border: "1px solid #ccc", marginTop: 5, boxSizing: "border-box",
  };
  const cardStyle: React.CSSProperties = {
    background: "white", padding: 30, borderRadius: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)", marginBottom: 20,
  };
  const btnPrimary: React.CSSProperties = {
    padding: "12px 20px", background: "#0f3d2e", color: "white",
    border: "none", borderRadius: 8, cursor: "pointer",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "8px 14px", background: "#eee", border: "none",
    borderRadius: 8, cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={cardStyle}>
        <h1>📥 Cargar Remito</h1>
        <p style={{ color: "#555", marginBottom: 25 }}>Registrá la entrada de insumos al stock.</p>

        {/* FECHA, NRO REMITO Y PROVEEDOR */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div>
            <label>Fecha del remito *</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label>N° Remito</label>
            <input
              value={nroRemito}
              onChange={(e) => setNroRemito(e.target.value)}
              placeholder="Ej: 0001-00012345"
              style={inputStyle}
            />
          </div>
          <div>
            <label>Proveedor</label>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* INSUMOS */}
        <div style={{ marginBottom: 15 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ fontWeight: 600 }}>Insumos *</label>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setMostrarNuevo(!mostrarNuevo)} style={{ ...btnSecondary, color: "#0f3d2e" }}>
                + Nuevo insumo
              </button>
              <button onClick={agregarLinea} style={btnSecondary}>
                + Agregar línea
              </button>
            </div>
          </div>

          {lineas.map((linea, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 13 }}>Insumo</label>
                <select
                  value={linea.insumo_id}
                  onChange={(e) => actualizarLinea(index, "insumo_id", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Seleccionar</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13 }}>Cantidad</label>
                <input
                  type="number"
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(index, "cantidad", e.target.value)}
                  style={inputStyle}
                />
              </div>
              <button
                onClick={() => quitarLinea(index)}
                style={{ padding: 10, background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", color: "red" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* OBSERVACIONES */}
        <div style={{ marginBottom: 20 }}>
          <label>Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            style={{ ...inputStyle, height: 80 }}
          />
        </div>

        <button onClick={guardarRemito} style={btnPrimary}>💾 Guardar remito</button>
      </div>

      {/* NUEVO INSUMO */}
      {mostrarNuevo && (
        <div style={cardStyle}>
          <h2>➕ Nuevo insumo</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <label>Nombre</label>
              <input value={nuevoInsumo.nombre} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, nombre: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label>Categoría</label>
              <select value={nuevoInsumo.categoria} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, categoria: e.target.value })} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option>Semillas</option>
                <option>Agroquímicos</option>
                <option>Fertilizantes</option>
                <option>Combustible</option>
                <option>Otros</option>
              </select>
            </div>
            <div>
              <label>Unidad</label>
              <select value={nuevoInsumo.unidad} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, unidad: e.target.value })} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option>Kg</option>
                <option>Litros</option>
                <option>Bolsas</option>
                <option>Toneladas</option>
                <option>Unidades</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 15 }}>
            <button onClick={guardarInsumo} style={btnPrimary}>✅ Crear insumo</button>
          </div>
        </div>
      )}
    </div>
  );
}