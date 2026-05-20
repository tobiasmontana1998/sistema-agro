"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HistorialRemitosPage() {
  const router = useRouter();
  const [remitos, setRemitos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);

  const [filtroNro, setFiltroNro] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroInsumo, setFiltroInsumo] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: movimientos }, { data: provs }, { data: ins }] = await Promise.all([
supabase.from("stock_movimientos").select("*, insumos(nombre, unidad), proveedores(razon_social), remitos(numero, numero_remito)").eq("tipo", "entrada").order("fecha", { ascending: false }),

      supabase.from("proveedores").select(),
      supabase.from("insumos").select(),
    ]);

    setProveedores(provs || []);
    setInsumos(ins || []);

    if (!movimientos) return;

    const agrupados: Record<string, any> = {};
    for (const m of movimientos) {
      const key = m.numero_remito || m.id;
      if (!agrupados[key]) {
       agrupados[key] = {
  numero_remito: key,
  numero_sistema: m.remitos?.numero ? `R-${String(m.remitos.numero).padStart(3, "0")}` : "—",
  fecha: m.fecha,
  proveedor_id: m.proveedor_id,
  proveedor: m.proveedores?.razon_social || "Sin proveedor",
  lineas: [],
};
      }
      agrupados[key].lineas.push({
        id: m.id,
        insumo_id: m.insumo_id,
        insumo: m.insumos?.nombre || "—",
        unidad: m.insumos?.unidad || "",
        cantidad: m.cantidad,
      });
    }

    setRemitos(Object.values(agrupados));
    setLoading(false);
  };

  const remitorsFiltrados = remitos.filter((r) => {
    if (filtroNro && !r.numero_remito.toLowerCase().includes(filtroNro.toLowerCase())) return false;
    if (filtroFechaDesde && r.fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && r.fecha > filtroFechaHasta) return false;
    if (filtroProveedor && r.proveedor_id !== filtroProveedor) return false;
    if (filtroInsumo && !r.lineas.some((l: any) => l.insumo_id === filtroInsumo)) return false;
    return true;
  });

  const iniciarEdicion = (remito: any) => {
    setEditando(remito.numero_remito);
    setEditData({
      numero_remito: remito.numero_remito,
      fecha: remito.fecha,
      proveedor_id: remito.proveedor_id || "",
      lineas: remito.lineas.map((l: any) => ({ ...l })),
    });
  };

  const guardarEdicion = async () => {
    for (const linea of editData.lineas) {
      const { error } = await supabase
        .from("stock_movimientos")
        .update({
          fecha: editData.fecha,
          proveedor_id: editData.proveedor_id || null,
          numero_remito: editData.numero_remito,
          cantidad: Number(linea.cantidad),
          insumo_id: linea.insumo_id,
        })
        .eq("id", linea.id);

      if (error) { alert("Error: " + error.message); return; }
    }

    setEditando(null);
    setEditData(null);
    await cargarDatos();
  };

 const eliminarRemito = async (remito: any) => {
  // Verificar si tiene factura vinculada
  const { data: remitoData } = await supabase
    .from("remitos")
    .select("factura_id, numero")
    .eq("numero_remito", remito.numero_remito)
    .single();

  if (remitoData?.factura_id) {
    alert(`No se puede eliminar el remito R-${String(remitoData.numero).padStart(3, "0")} porque tiene una factura vinculada. Desvinculala primero desde Gastos.`);
    return;
  }

  if (!confirm(`¿Eliminar el remito ${remito.numero_remito}?`)) return;

  const ids = remito.lineas.map((l: any) => l.id);
  await supabase.from("stock_movimientos").delete().in("id", ids);
  await supabase.from("remitos").delete().eq("numero_remito", remito.numero_remito);
  cargarDatos();
};

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "8px 16px", background: "#0f3d2e", color: "white",
    border: "none", borderRadius: 8, cursor: "pointer",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "8px 16px", background: "#eee", border: "none",
    borderRadius: 8, cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* FILTROS */}
      <div style={{ background: "white", padding: 20, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.1)", marginBottom: 20 }}>
        <h3 style={{ marginBottom: 15 }}>🔍 Filtros</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 15 }}>
          <div>
            <label style={{ fontSize: 13 }}>N° Remito</label>
            <input value={filtroNro} onChange={(e) => setFiltroNro(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 13 }}>Fecha desde</label>
            <input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 13 }}>Fecha hasta</label>
            <input type="date" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 13 }}>Proveedor</label>
            <select value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }}>
              <option value="">Todos</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13 }}>Insumo</label>
            <select value={filtroInsumo} onChange={(e) => setFiltroInsumo(e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }}>
              <option value="">Todos</option>
              {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => { setFiltroNro(""); setFiltroFechaDesde(""); setFiltroFechaHasta(""); setFiltroProveedor(""); setFiltroInsumo(""); }} style={{ ...btnSecondary, marginTop: 12, fontSize: 13 }}>
          Limpiar filtros
        </button>
      </div>

      {/* TABLA */}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        <div style={{ padding: "20px 25px", borderBottom: "1px solid #eee" }}>
          <h1 style={{ margin: 0 }}>📋 Historial de Remitos</h1>
          <p style={{ color: "#777", margin: "5px 0 0", fontSize: 14 }}>Doble click en una fila para editar</p>
        </div>

        {loading ? (
          <p style={{ padding: 20 }}>Cargando...</p>
        ) : remitorsFiltrados.length === 0 ? (
          <p style={{ padding: 20, color: "#999" }}>No hay remitos para mostrar.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
<th style={{ padding: "12px 16px" }}>N° Sistema</th>
<th style={{ padding: "12px 16px" }}>N° Remito</th>
                <th style={{ padding: "12px 16px" }}>Fecha</th>
                <th style={{ padding: "12px 16px" }}>Proveedor</th>
                <th style={{ padding: "12px 16px" }}>Insumos</th>
                <th style={{ padding: "12px 16px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {remitorsFiltrados.map((remito) => (
                editando === remito.numero_remito ? (
                  <tr key={remito.numero_remito} style={{ background: "#f0faf4", borderTop: "2px solid #0f3d2e" }}>
                    <td colSpan={5} style={{ padding: 20 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 15, marginBottom: 15 }}>
                        <div>
                          <label style={{ fontSize: 13 }}>N° Remito</label>
                          <input value={editData.numero_remito} onChange={(e) => setEditData({ ...editData, numero_remito: e.target.value })} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13 }}>Fecha</label>
                          <input type="date" value={editData.fecha || ""} onChange={(e) => setEditData({ ...editData, fecha: e.target.value })} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13 }}>Proveedor</label>
                          <select value={editData.proveedor_id} onChange={(e) => setEditData({ ...editData, proveedor_id: e.target.value })} style={{ ...inputStyle, width: "100%", marginTop: 4 }}>
                            <option value="">Sin proveedor</option>
                            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                          </select>
                        </div>
                      </div>

                      {editData.lineas.map((linea: any, i: number) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 13 }}>Insumo</label>
                            <select
                              value={linea.insumo_id}
                              onChange={(e) => {
                                const updated = [...editData.lineas];
                                updated[i] = { ...updated[i], insumo_id: e.target.value };
                                setEditData({ ...editData, lineas: updated });
                              }}
                              style={{ ...inputStyle, width: "100%", marginTop: 4 }}
                            >
                              {insumos.map((ins) => <option key={ins.id} value={ins.id}>{ins.nombre}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 13 }}>Cantidad</label>
                            <input
                              type="number"
                              value={linea.cantidad}
                              onChange={(e) => {
                                const updated = [...editData.lineas];
                                updated[i] = { ...updated[i], cantidad: e.target.value };
                                setEditData({ ...editData, lineas: updated });
                              }}
                              style={{ ...inputStyle, width: "100%", marginTop: 4 }}
                            />
                          </div>
                        </div>
                      ))}

                      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <button onClick={guardarEdicion} style={btnPrimary}>💾 Guardar</button>
                        <button onClick={() => { setEditando(null); setEditData(null); }} style={btnSecondary}>Cancelar</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={remito.numero_remito}
                    onDoubleClick={() => iniciarEdicion(remito)}
                    style={{ borderTop: "1px solid #eee", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f9f9f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                  >
                   <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f1f17" }}>{remito.numero_sistema}</td>
<td style={{ padding: "12px 16px" }}>{remito.numero_remito || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>{remito.fecha || "Sin fecha"}</td>
                    <td style={{ padding: "12px 16px" }}>{remito.proveedor}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {remito.lineas.map((l: any, i: number) => (
                        <span key={i} style={{ marginRight: 8, background: "#e8f5e9", padding: "2px 8px", borderRadius: 12, fontSize: 13 }}>
                          {l.insumo} ({l.cantidad} {l.unidad})
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/agricultura/historial-remitos/editar/${encodeURIComponent(remito.numero_remito)}`); }}
  style={{ background: "#f0f4ff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "5px 10px", marginRight: 6 }}>
  ✏️ Editar
</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminarRemito(remito); }}
                        style={{ background: "#fee", border: "1px solid #fcc", color: "red", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
                      >
                        🗑 Eliminar
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}