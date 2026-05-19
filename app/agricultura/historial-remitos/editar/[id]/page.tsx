"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditarRemito() {
  const { id } = useParams();
  const router = useRouter();
  const numeroRemito = decodeURIComponent(id as string);

  const [fecha, setFecha] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [nroRemito, setNroRemito] = useState("");
  const [facturaId, setFacturaId] = useState("");
const [facturas, setFacturas] = useState<any[]>([]);
  const [lineas, setLineas] = useState<{ id: string; insumo_id: string; cantidad: string }[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    const [{ data: provs }, { data: ins }, { data: movs }, { data: facts }, { data: remitoData }] = await Promise.all([
      supabase.from("proveedores").select(),
      supabase.from("insumos").select().order("nombre"),
      supabase.from("stock_movimientos").select("*").eq("numero_remito", numeroRemito).eq("tipo", "entrada"),
      supabase.from("facturas").select("id, Numero_factura, Fecha, proveedores(razon_social), factura_items(insumo_id, insumos(nombre))").eq("Tipo", "Insumos").order("Fecha", { ascending: false }),
      supabase.from("remitos").select("factura_id").eq("numero_remito", numeroRemito).single(),
    ]);
    setProveedores(provs || []);
    setInsumos(ins || []);
    setFacturas(facts || []);
    setFacturaId(remitoData?.factura_id || "");
    if (movs && movs.length > 0) {
      setFecha(movs[0].fecha || "");
      setProveedorId(movs[0].proveedor_id || "");
      setNroRemito(movs[0].numero_remito || "");
      setLineas(movs.map((m: any) => ({ id: m.id, insumo_id: m.insumo_id, cantidad: m.cantidad?.toString() || "" })));
    }
    setCargando(false);
  };
  fetchData();
}, [numeroRemito]);

  const agregarLinea = () => setLineas([...lineas, { id: "", insumo_id: "", cantidad: "" }]);
  const quitarLinea = (index: number) => setLineas(lineas.filter((_, i) => i !== index));
  const actualizarLinea = (index: number, campo: string, valor: string) => {
    const updated = [...lineas];
    updated[index] = { ...updated[index], [campo]: valor };
    setLineas(updated);
  };

  const guardarEdicion = async () => {
    if (!fecha) { alert("Ingresá la fecha"); return; }
    if (lineas.some(l => !l.insumo_id || !l.cantidad)) { alert("Completá todos los insumos"); return; }

    // Actualizar líneas existentes
    for (const linea of lineas.filter(l => l.id)) {
      await supabase.from("stock_movimientos").update({
        fecha,
        proveedor_id: proveedorId || null,
        numero_remito: nroRemito,
        insumo_id: linea.insumo_id,
        cantidad: Number(linea.cantidad),
      }).eq("id", linea.id);
    }

    // Insertar líneas nuevas
    const nuevas = lineas.filter(l => !l.id);
    for (const linea of nuevas) {
      await supabase.from("stock_movimientos").insert([{
        insumo_id: linea.insumo_id,
        tipo: "entrada",
        cantidad: Number(linea.cantidad),
        motivo: "remito",
        fecha,
        proveedor_id: proveedorId || null,
        numero_remito: nroRemito,
      }]);
    }
await supabase.from("remitos").update({ factura_id: facturaId || null }).eq("numero_remito", nroRemito);

if (facturaId) {
  await supabase.from("stock_movimientos")
    .update({ factura_id: facturaId })
    .eq("numero_remito", nroRemito)
    .eq("tipo", "entrada")
    .eq("motivo", "remito");
} else {
  await supabase.from("stock_movimientos")
    .update({ factura_id: null })
    .eq("numero_remito", nroRemito)
    .eq("tipo", "entrada")
    .eq("motivo", "remito");
}
    alert("Remito actualizado ✅");
    router.back();
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };

  if (cargando) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>✏️ Editar Remito</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Modificá los datos del remito.</p>
      </div>

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 30 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
          <div>
            <div style={lbl}>N° REMITO</div>
            <input value={nroRemito} onChange={(e) => setNroRemito(e.target.value)} style={input} />
          </div>
          <div>
            <div style={lbl}>FECHA *</div>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} />
          </div>
          <div>
            <div style={lbl}>PROVEEDOR</div>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={input}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              
            </select>
          </div>
          <div>
  <div style={lbl}>FACTURA VINCULADA</div>
  <select value={facturaId} onChange={(e) => setFacturaId(e.target.value)} style={input}>
    <option value="">Sin vincular</option>
    {facturas.map((f) => (
      <option key={f.id} value={f.id}>
        {f.Numero_factura} — {(f.proveedores as any)?.razon_social} — {(f.factura_items || []).map((i: any) => i.insumos?.nombre).filter(Boolean).join(", ")} ({f.Fecha})
      </option>
    ))}
  </select>
</div>
        </div>

        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Insumos</div>
            <button onClick={agregarLinea} style={{ padding: "7px 14px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              + Agregar insumo
            </button>
          </div>

          {lineas.map((linea, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, marginBottom: 12, alignItems: "end" }}>
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
              <button onClick={() => quitarLinea(index)} style={{ padding: "10px 14px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", color: "red", marginTop: 22 }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <button onClick={guardarEdicion} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            💾 Guardar cambios
          </button>
          <button onClick={() => router.back()} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}