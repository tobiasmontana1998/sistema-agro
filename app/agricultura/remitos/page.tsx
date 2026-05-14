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
  const [lineas, setLineas] = useState<{ insumo_id: string; cantidad: string }[]>([{ insumo_id: "", cantidad: "" }]);
  const [nuevoInsumo, setNuevoInsumo] = useState({ nombre: "", categoria: "", unidad: "" });
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    const [{ data: ins }, { data: prov }] = await Promise.all([supabase.from("insumos").select(), supabase.from("proveedores").select()]);
    setInsumos(ins || []);
    setProveedores(prov || []);
  };

  const agregarLinea = () => setLineas([...lineas, { insumo_id: "", cantidad: "" }]);
  const actualizarLinea = (index: number, campo: string, valor: string) => { const u = [...lineas]; u[index] = { ...u[index], [campo]: valor }; setLineas(u); };
  const quitarLinea = (index: number) => { if (lineas.length === 1) return; setLineas(lineas.filter((_, i) => i !== index)); };

  const guardarRemito = async () => {
    if (!fecha) { alert("Ingresá la fecha del remito"); return; }
    if (lineas.some(l => !l.insumo_id || !l.cantidad)) { alert("Completá todos los insumos"); return; }
    const numeroRemito = nroRemito || `REM-${Date.now()}`;
    for (const linea of lineas) {
      const { error } = await supabase.from("stock_movimientos").insert([{ insumo_id: linea.insumo_id, tipo: "entrada", cantidad: Number(linea.cantidad), motivo: "remito", fecha, proveedor_id: proveedorId || null, numero_remito: numeroRemito, observaciones }]);
      if (error) { alert("Error: " + error.message); return; }
    }
    setFecha(""); setNroRemito(""); setProveedorId(""); setObservaciones(""); setLineas([{ insumo_id: "", cantidad: "" }]);
    alert("Remito guardado ✅");
  };

  const guardarInsumo = async () => {
    if (!nuevoInsumo.nombre || !nuevoInsumo.categoria || !nuevoInsumo.unidad) { alert("Completá todos los campos"); return; }
    const { error } = await supabase.from("insumos").insert([nuevoInsumo]);
    if (error) { alert("Error: " + error.message); return; }
    setNuevoInsumo({ nombre: "", categoria: "", unidad: "" }); setMostrarNuevo(false); cargarDatos();
    alert("Insumo creado ✅");
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };
  const card: React.CSSProperties = { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28, marginBottom: 20 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Cargar Remito</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registrá la entrada de insumos al stock.</p>
      </div>

      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
          <div><div style={lbl}>FECHA *</div><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} /></div>
          <div><div style={lbl}>N° REMITO</div><input value={nroRemito} onChange={(e) => setNroRemito(e.target.value)} placeholder="Ej: 0001-00012345" style={input} /></div>
          <div>
            <div style={lbl}>PROVEEDOR</div>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={input}>
              <option value="">Seleccionar</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Insumos *</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setMostrarNuevo(!mostrarNuevo)} style={{ padding: "7px 14px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0f1f17" }}>+ Nuevo insumo</button>
              <button onClick={agregarLinea} style={{ padding: "7px 14px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Agregar línea</button>
            </div>
          </div>

          {lineas.map((linea, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, marginBottom: 10, alignItems: "end" }}>
              <div>
                <div style={{ ...lbl, marginBottom: 4 }}>INSUMO</div>
                <select value={linea.insumo_id} onChange={(e) => actualizarLinea(index, "insumo_id", e.target.value)} style={input}>
                  <option value="">Seleccionar</option>
                  {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                </select>
              </div>
              <div>
                <div style={{ ...lbl, marginBottom: 4 }}>CANTIDAD</div>
                <input type="number" value={linea.cantidad} onChange={(e) => actualizarLinea(index, "cantidad", e.target.value)} style={input} />
              </div>
              <button onClick={() => quitarLinea(index)} style={{ padding: "10px 14px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", color: "red" }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 8 }}>
          <div style={lbl}>OBSERVACIONES</div>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} style={{ ...input, height: 80, resize: "vertical" }} />
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={guardarRemito} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>💾 Guardar remito</button>
        </div>
      </div>

      {mostrarNuevo && (
        <div style={card}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>➕ Nuevo insumo</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div><div style={lbl}>NOMBRE</div><input value={nuevoInsumo.nombre} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, nombre: e.target.value })} style={input} /></div>
            <div>
              <div style={lbl}>CATEGORÍA</div>
              <select value={nuevoInsumo.categoria} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, categoria: e.target.value })} style={input}>
                <option value="">Seleccionar</option>
                <option>Semillas</option><option>Agroquímicos</option><option>Fertilizantes</option><option>Combustible</option><option>Otros</option>
              </select>
            </div>
            <div>
              <div style={lbl}>UNIDAD</div>
              <select value={nuevoInsumo.unidad} onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, unidad: e.target.value })} style={input}>
                <option value="">Seleccionar</option>
                <option>Kg</option><option>Litros</option><option>Bolsas</option><option>Toneladas</option><option>Unidades</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={guardarInsumo} style={{ padding: "10px 20px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>✅ Crear insumo</button>
          </div>
        </div>
      )}
    </div>
  );
}