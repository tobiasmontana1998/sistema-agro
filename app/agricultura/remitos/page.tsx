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
  const [facturas, setFacturas] = useState<any[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [facturaId, setFacturaId] = useState("");
  const [fecha, setFecha] = useState("");
  const [nroRemito, setNroRemito] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<{ insumo_id: string; cantidad: string }[]>([{ insumo_id: "", cantidad: "" }]);
  const [nuevoInsumo, setNuevoInsumo] = useState({ nombre: "", categoria: "", unidad: "" });
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
 const [filtroProveedor, setFiltroProveedor] = useState("");
  const [itemsFactura, setItemsFactura] = useState<any[]>([]);

  useEffect(() => { cargarDatos(); }, []);

  // Cuando se selecciona una factura, autocompletar proveedor
 useEffect(() => {
  if (!facturaId) {
    setItemsFactura([]);
    return;
  }
  const factura = facturas.find(f => f.id === facturaId);
  if (factura?.proveedor_id) setProveedorId(factura.proveedor_id);
 Promise.all([
  supabase.from("factura_items").select("insumo_id, cantidad").eq("factura_id", facturaId),
  supabase.from("stock_movimientos").select("insumo_id, cantidad").eq("factura_id", facturaId).eq("tipo", "entrada").eq("motivo", "remito"),
]).then(([{ data: items }, { data: remitidos }]) => {
 const remitidosData = remitidos || [];
const itemsConDisponible = (items || []).map((item: any) => {
  const yaRemitido = remitidosData
    .filter((r: any) => r.insumo_id === item.insumo_id)
    .reduce((acc: number, r: any) => acc + Number(r.cantidad), 0);
  const disponible = Number(item.cantidad) - yaRemitido;
  return { ...item, yaRemitido, disponible };
});
  setItemsFactura(itemsConDisponible);
});
}, [facturaId]);

  const cargarDatos = async () => {
  const [{ data: ins }, { data: prov }, { data: facts }, { data: remitidos }] = await Promise.all([
    supabase.from("insumos").select(),
    supabase.from("proveedores").select(),
    supabase.from("facturas")
      .select("id, Numero_factura, Concepto, Fecha, proveedor_id, proveedores(razon_social), tipo_comprobante, factura_items(insumo_id, cantidad, insumos(nombre))")
      .eq("Tipo", "Insumos")
      .order("Fecha", { ascending: false }),
    supabase.from("stock_movimientos")
      .select("factura_id, insumo_id, cantidad")
      .eq("tipo", "entrada")
      .eq("motivo", "remito")
      .not("factura_id", "is", null),
  ]);

  setInsumos(ins || []);
  setProveedores(prov || []);

  const facturasConEstado = (facts || []).map((f: any) => {
    const items = f.factura_items || [];
    const completa = items.length > 0 && items.every((item: any) => {
      const yaRemitido = (remitidos || [])
        .filter((r: any) => r.factura_id === f.id && r.insumo_id === item.insumo_id)
        .reduce((acc: number, r: any) => acc + Number(r.cantidad), 0);
      return yaRemitido >= Number(item.cantidad);
    });
    const nombresInsumos = items.map((i: any) => i.insumos?.nombre).filter(Boolean).join(", ");
    return { ...f, completa, nombresInsumos };
  });

  setFacturas(facturasConEstado);
};

  const agregarLinea = () => setLineas([...lineas, { insumo_id: "", cantidad: "" }]);
  const actualizarLinea = (index: number, campo: string, valor: string) => {
    const u = [...lineas];
    u[index] = { ...u[index], [campo]: valor };
    setLineas(u);
  };
  const quitarLinea = (index: number) => {
    if (lineas.length === 1) return;
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const guardarRemito = async () => {
    if (!fecha) { alert("Ingresá la fecha del remito"); return; }
    if (lineas.some(l => !l.insumo_id || !l.cantidad)) { alert("Completá todos los insumos"); return; }
   if (facturaId && itemsFactura.length > 0) {
  // Traer remitos ya asociados a esta factura
  const { data: remitosExistentes } = await supabase
    .from("stock_movimientos")
    .select("insumo_id, cantidad")
    .eq("factura_id", facturaId)
    .eq("tipo", "entrada")
    .eq("motivo", "remito");

  for (const linea of lineas) {
    if (!linea.insumo_id || !linea.cantidad) continue;
    const itemFactura = itemsFactura.find(i => i.insumo_id === linea.insumo_id);
    if (!itemFactura) continue;

    const yaRemitido = (remitosExistentes || [])
      .filter(r => r.insumo_id === linea.insumo_id)
      .reduce((acc, r) => acc + Number(r.cantidad), 0);

    const totalConNuevo = yaRemitido + Number(linea.cantidad);
    if (totalConNuevo > Number(itemFactura.cantidad)) {
      const insumoNombre = insumos.find(i => i.id === linea.insumo_id)?.nombre || "Insumo";
      alert(`La cantidad de ${insumoNombre} supera la de la factura.\nFactura: ${itemFactura.cantidad} | Ya remitido: ${yaRemitido} | Nuevo: ${linea.cantidad} | Total: ${totalConNuevo}`);
      return;
    }
  }
}
    // Crear remito en tabla remitos
const { data: remitoData, error: remitoError } = await supabase
  .from("remitos")
  .insert([{
    numero_remito: nroRemito || null,
    fecha,
    proveedor_id: proveedorId || null,
    observaciones,
    factura_id: facturaId || null,
  }])
  .select()
  .single();

if (remitoError) { alert("Error creando remito: " + remitoError.message); return; }

// Crear movimientos de stock vinculados al remito
for (const linea of lineas) {
  const { error } = await supabase.from("stock_movimientos").insert([{
    insumo_id: linea.insumo_id,
    tipo: "entrada",
    cantidad: Number(linea.cantidad),
    motivo: "remito",
    fecha,
    proveedor_id: proveedorId || null,
    numero_remito: nroRemito || null,
    observaciones,
    factura_id: facturaId || null,
    remito_id: remitoData.id,
  }]);
  if (error) { alert("Error: " + error.message); return; }
}

setFecha(""); setNroRemito(""); setProveedorId(""); setFacturaId("");
setObservaciones(""); setLineas([{ insumo_id: "", cantidad: "" }]);
alert(`Remito R-${remitoData.numero} guardado ✅`);
  };

  const guardarInsumo = async () => {
    if (!nuevoInsumo.nombre || !nuevoInsumo.categoria || !nuevoInsumo.unidad) { alert("Completá todos los campos"); return; }
    const { error } = await supabase.from("insumos").insert([nuevoInsumo]);
    if (error) { alert("Error: " + error.message); return; }
    setNuevoInsumo({ nombre: "", categoria: "", unidad: "" }); setMostrarNuevo(false); cargarDatos();
    alert("Insumo creado ✅");
  };

  const facturaSeleccionada = facturas.find(f => f.id === facturaId);

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

        {/* FACTURA VINCULADA */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📎 Vincular a factura</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
  <div>
    <div style={lbl}>FILTRAR POR PROVEEDOR</div>
    <select value={filtroProveedor} onChange={(e) => { setFiltroProveedor(e.target.value); setFacturaId(""); }} style={input}>
      <option value="">Todos los proveedores</option>
      {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
    </select>
  </div>
  <div>
    <div style={lbl}>FACTURA DE INSUMOS</div>
    <select value={facturaId} onChange={(e) => setFacturaId(e.target.value)} style={input}>
      <option value="">Sin vincular</option>
      {facturas
  .filter(f => (!filtroProveedor || f.proveedor_id === filtroProveedor) && !f.completa)
  .map((f) => (
    <option key={f.id} value={f.id}>
      {f.Numero_factura} — {f.nombresInsumos || f.Concepto?.slice(0, 30)} ({f.Fecha})
    </option>
  ))}
    </select>
  </div>
</div>

          {facturaSeleccionada && (
            <div style={{ marginTop: 10, background: "#f0faf4", borderRadius: 8, padding: 12, fontSize: 13 }}>
              <div style={{ display: "flex", gap: 20 }}>
                <div><span style={{ color: "#888" }}>Proveedor:</span> <strong>{(facturaSeleccionada.proveedores as any)?.razon_social}</strong></div>
                <div><span style={{ color: "#888" }}>Fecha:</span> <strong>{facturaSeleccionada.Fecha}</strong></div>
                <div><span style={{ color: "#888" }}>Tipo:</span> <strong>{facturaSeleccionada.tipo_comprobante}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* DATOS REMITO */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24, borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
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

        {/* INSUMOS */}
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
               <div style={{ ...lbl, marginBottom: 4 }}>
  CANTIDAD
  {facturaId && itemsFactura.find(i => i.insumo_id === linea.insumo_id) && (
    <span style={{ color: "#888", fontWeight: 400, marginLeft: 8 }}>
{(() => {
  const item = itemsFactura.find(i => i.insumo_id === linea.insumo_id);
  if (!item) return null;
  return ` — factura: ${item.cantidad} | ya remitido: ${item.yaRemitido} | disponible: ${item.disponible}`;
})()}
    </span>
  )}
</div>
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

        {!facturaId && (
          <div style={{ marginTop: 16, background: "#fff8e1", borderRadius: 8, padding: 12, fontSize: 13, color: "#7c5c00" }}>
            ⚠️ Este remito no está vinculado a ninguna factura. Se recomienda vincularlo para poder calcular el costo por unidad.
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <button onClick={guardarRemito} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            💾 Guardar remito
          </button>
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