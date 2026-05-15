"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORIAS = ["LABOR", "HERBICIDA", "FUNGICIDA", "INSECTICIDA", "FERTILIZANTE", "SEMILLA", "CURASEMILLA", "COADYUVANTE", "COSECHA", "SEGURO", "ARRENDAMIENTO", "OTRO"];
const CULTIVOS = ["Maíz 1ra", "Maíz 2da", "Soja 1ra", "Soja 2da", "Trigo", "Girasol", "Sorgo"];
const ALICUOTAS = ["0%", "10.5%", "21%", "27%"];

type PlanItem = {
  id?: string;
  categoria: string;
  descripcion: string;
  insumo_id: string;
  fecha_aplicacion: string;
  fecha_pago: string;
  cantidad_por_ha: string;
  unidad: string;
  alicuota_iva: string;
  orden?: number;
};

const ITEM_VACIO: PlanItem = { categoria: "", descripcion: "", insumo_id: "", fecha_aplicacion: "", fecha_pago: "", cantidad_por_ha: "", unidad: "", alicuota_iva: "21%" };

export default function PlanesPage() {
  const [vista, setVista] = useState<"lista" | "form">("lista");
  const [planes, setPlanes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [preciosInsumos, setPreciosInsumos] = useState<Record<string, number>>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [campaña, setCampaña] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [busquedaItems, setBusquedaItems] = useState<Record<number, string>>({});
  const [mostrarDropdown, setMostrarDropdown] = useState<Record<number, boolean>>({});
  const [filtroCultivo, setFiltroCultivo] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    const [{ data: planesData }, { data: insumosData }, { data: preciosData }] = await Promise.all([
      supabase.from("planes_cultivo").select("*, plan_items(*)").order("created_at", { ascending: false }),
      supabase.from("insumos").select().order("nombre"),
      supabase.from("precios_insumos").select("*"),
    ]);
    setPlanes(planesData || []);
    setInsumos(insumosData || []);
    const map: Record<string, number> = {};
    (preciosData || []).forEach((p: any) => { map[p.insumo_id] = p.precio; });
    setPreciosInsumos(map);
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setNombre(""); setCultivo(""); setCampaña(""); setDescripcion("");
    setItems([{ ...ITEM_VACIO }]);
    setBusquedaItems({}); setMostrarDropdown({});
    setVista("form");
  };

  const abrirEdicion = async (plan: any) => {
    setEditandoId(plan.id);
    setNombre(plan.nombre || "");
    setCultivo(plan.cultivo || "");
    setCampaña(plan.campaña || "");
    setDescripcion(plan.descripcion || "");
    const { data: itemsData } = await supabase.from("plan_items").select("*").eq("plan_id", plan.id).order("orden", { ascending: true });
    setItems((itemsData || [])
      .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0))
      .map((i: any) => ({
        id: i.id,
        categoria: i.categoria || "",
        descripcion: i.descripcion || "",
        insumo_id: i.insumo_id || "",
        fecha_aplicacion: i.fecha_aplicacion || "",
        fecha_pago: i.fecha_pago || "",
        cantidad_por_ha: i.cantidad_por_ha?.toString() || "",
        unidad: i.unidad || "",
        alicuota_iva: i.alicuota_iva || "21%",
        orden: i.orden,
      })));
    setBusquedaItems({}); setMostrarDropdown({});
    setVista("form");
  };

  // DRAG & DROP
  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDraggingIndex(index);
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newItems = [...items];
    const dragged = newItems.splice(dragItem.current, 1)[0];
    newItems.splice(dragOverItem.current, 0, dragged);
    setItems(newItems);
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
    // Limpiar busquedaItems para que los índices coincidan
    setBusquedaItems({});
  };

  const agregarItem = () => setItems([...items, { ...ITEM_VACIO }]);
  const quitarItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const actualizarItem = (index: number, campo: string, valor: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [campo]: valor };
    setItems(updated);
  };

  const seleccionarInsumo = (index: number, insumo: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], insumo_id: insumo.id, descripcion: insumo.nombre, unidad: insumo.unidad };
    setItems(updated);
    setBusquedaItems(prev => ({ ...prev, [index]: insumo.nombre }));
    setMostrarDropdown(prev => ({ ...prev, [index]: false }));
  };

  const getPrecioItem = (item: PlanItem) => {
    if (item.insumo_id && preciosInsumos[item.insumo_id]) return preciosInsumos[item.insumo_id];
    return null;
  };

  const calcularUSDporHA = (item: PlanItem) => {
    const precio = getPrecioItem(item);
    if (!precio || !item.cantidad_por_ha) return null;
    return Number(item.cantidad_por_ha) * precio;
  };

  const guardarPlan = async () => {
    if (!nombre || !cultivo) { alert("Completá nombre y cultivo"); return; }
    let planId = editandoId;
    if (editandoId) {
      await supabase.from("planes_cultivo").update({ nombre, cultivo, campaña, descripcion }).eq("id", editandoId);
      await supabase.from("plan_items").delete().eq("plan_id", editandoId);
    } else {
      const { data } = await supabase.from("planes_cultivo").insert([{ nombre, cultivo, campaña, descripcion }]).select().single();
      planId = data?.id;
    }
    if (planId && items.length > 0) {
      const itemsParaGuardar = items.filter(i => i.descripcion || i.insumo_id).map((i, index) => ({
        plan_id: planId,
        categoria: i.categoria,
        descripcion: i.descripcion,
        insumo_id: i.insumo_id || null,
        fecha_aplicacion: i.fecha_aplicacion,
        fecha_pago: i.fecha_pago,
        cantidad_por_ha: Number(i.cantidad_por_ha) || 0,
        unidad: i.unidad,
        alicuota_iva: i.alicuota_iva,
        moneda: "USD",
        orden: index + 1,
      }));
      await supabase.from("plan_items").insert(itemsParaGuardar);
    }
    await cargarDatos();
    setVista("lista");
  };

  const eliminarPlan = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar plan "${nombre}"?`)) return;
    await supabase.from("planes_cultivo").delete().eq("id", id);
    await cargarDatos();
  };

  const calcularTotalPlan = (plan: any) => {
    return (plan.plan_items || []).reduce((acc: number, item: any) => {
      const precio = preciosInsumos[item.insumo_id] || 0;
      return acc + (Number(item.cantidad_por_ha) * precio);
    }, 0);
  };

  const planesFiltrados = planes.filter(p => !filtroCultivo || p.cultivo === filtroCultivo);
  const totalItemsForm = items.reduce((acc, i) => acc + (calcularUSDporHA(i) || 0), 0);

  const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: 0.3, marginBottom: 3, display: "block" };
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap", background: "#f8f9fa" };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f0f0f0" };

  const colorCategoria: Record<string, string> = {
    LABOR: "#e3f2fd", HERBICIDA: "#e8f5e9", FUNGICIDA: "#f3e5f5", INSECTICIDA: "#fff3e0",
    FERTILIZANTE: "#e0f7fa", SEMILLA: "#fff8e1", CURASEMILLA: "#fce4ec", COADYUVANTE: "#f5f5f5",
    COSECHA: "#e8eaf6", SEGURO: "#fafafa", ARRENDAMIENTO: "#efebe9", OTRO: "#f5f5f5",
  };

  // LISTA
  if (vista === "lista") return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Planes de Cultivo</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Presupuesto de insumos y labores por cultivo.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => window.location.href = "/agricultura/planes/precios"}
            style={{ padding: "10px 20px", background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#0f1f17", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            💲 Precios insumos
          </button>
          <button onClick={abrirNuevo} style={{ padding: "10px 20px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            + Nuevo plan
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {["", ...CULTIVOS].map(c => (
          <button key={c} onClick={() => setFiltroCultivo(c)}
            style={{ padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: filtroCultivo === c ? "#0f1f17" : "#f0f0f0", color: filtroCultivo === c ? "white" : "#333" }}>
            {c || "Todos"}
          </button>
        ))}
      </div>

      {planesFiltrados.length === 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 40, textAlign: "center", color: "#bbb" }}>
          No hay planes — creá el primero con el botón de arriba.
        </div>
      )}

      {planesFiltrados.map(plan => (
        <div key={plan.id} style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{plan.nombre}</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                {plan.cultivo} {plan.campaña ? `— Campaña ${plan.campaña}` : ""}
                {plan.descripcion && <span style={{ marginLeft: 8 }}>— {plan.descripcion}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#888" }}>TOTAL REF./HA</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f1f17" }}>USD {calcularTotalPlan(plan).toFixed(0)}/ha</div>
                <div style={{ fontSize: 11, color: "#888" }}>{(plan.plan_items || []).length} ítems</div>
              </div>
              <button onClick={() => abrirEdicion(plan)} style={{ padding: "8px 16px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✏️ Editar</button>
              <button onClick={() => eliminarPlan(plan.id, plan.nombre)} style={{ padding: "8px 12px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "red" }}>🗑</button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>CATEGORÍA</th>
                  <th style={th}>INSUMO / LABOR</th>
                  <th style={th}>F. APLICACIÓN</th>
                  <th style={th}>F. PAGO</th>
                  <th style={th}>DOSIS/HA</th>
                  <th style={th}>UNIDAD</th>
                  <th style={{ ...th, textAlign: "right" }}>PRECIO USD</th>
                  <th style={{ ...th, textAlign: "right" }}>USD/HA</th>
                  <th style={th}>IVA</th>
                </tr>
              </thead>
              <tbody>
                {(plan.plan_items || []).sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0)).map((item: any, i: number) => {
                  const precio = preciosInsumos[item.insumo_id] || null;
                  const usdHa = precio ? Number(item.cantidad_por_ha) * precio : null;
                  return (
                    <tr key={i}>
                      <td style={td}><span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: colorCategoria[item.categoria] || "#f5f5f5" }}>{item.categoria}</span></td>
                      <td style={{ ...td, fontWeight: 500 }}>{item.descripcion}</td>
                      <td style={{ ...td, color: "#888" }}>{item.fecha_aplicacion}</td>
                      <td style={{ ...td, color: "#888" }}>{item.fecha_pago}</td>
                      <td style={{ ...td, textAlign: "right" }}>{Number(item.cantidad_por_ha).toFixed(2)}</td>
                      <td style={{ ...td, color: "#888" }}>{item.unidad}</td>
                      <td style={{ ...td, textAlign: "right", color: precio ? "#0f1f17" : "#ccc" }}>{precio ? `USD ${precio.toFixed(2)}` : "Sin precio"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600, color: usdHa ? "#0f1f17" : "#ccc" }}>{usdHa ? `USD ${usdHa.toFixed(2)}` : "—"}</td>
                      <td style={{ ...td, color: "#888" }}>{item.alicuota_iva}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#f8f9fa", fontWeight: 700 }}>
                  <td colSpan={7} style={{ ...td, textAlign: "right", color: "#555" }}>TOTAL / HA:</td>
                  <td style={{ ...td, textAlign: "right", fontSize: 15 }}>USD {calcularTotalPlan(plan).toFixed(2)}</td>
                  <td style={td}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );

  // FORMULARIO
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => setVista("lista")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888" }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{editandoId ? "✏️ Editar Plan" : "Nuevo Plan de Cultivo"}</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Definí los insumos y labores con dosis. Los precios vienen de la tabla de precios centralizada.</p>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20 }}>
          <div><label style={lbl}>NOMBRE DEL PLAN *</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} style={input} placeholder="Ej: Maíz 1ra 2024/25" /></div>
          <div>
            <label style={lbl}>CULTIVO *</label>
            <select value={cultivo} onChange={(e) => setCultivo(e.target.value)} style={input}>
              <option value="">Seleccionar</option>
              {CULTIVOS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={lbl}>CAMPAÑA</label><input value={campaña} onChange={(e) => setCampaña(e.target.value)} style={input} placeholder="2024/25" /></div>
          <div><label style={lbl}>DESCRIPCIÓN</label><input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={input} placeholder="Notas opcionales" /></div>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>📦 Ítems del plan</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#888" }}>Los precios se toman de <a href="/agricultura/planes/precios" style={{ color: "#0f1f17", fontWeight: 600 }}>Precios insumos</a></span>
            <button onClick={agregarItem} style={{ padding: "7px 14px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Agregar ítem</button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 30 }}></th>
                <th style={{ ...th, width: 130 }}>CATEGORÍA</th>
                <th style={{ ...th, width: 220 }}>INSUMO / LABOR</th>
                <th style={{ ...th, width: 120 }}>F. APLICACIÓN</th>
                <th style={{ ...th, width: 120 }}>F. PAGO</th>
                <th style={{ ...th, width: 90 }}>DOSIS/HA</th>
                <th style={{ ...th, width: 80 }}>UNIDAD</th>
                <th style={{ ...th, width: 110, textAlign: "right" }}>PRECIO REF.</th>
                <th style={{ ...th, width: 90, textAlign: "right" }}>USD/HA</th>
                <th style={{ ...th, width: 90 }}>IVA</th>
                <th style={{ ...th, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const precio = getPrecioItem(item);
                const usdHa = calcularUSDporHA(item);
                const isDragging = draggingIndex === index;
                const isDragOver = dragOverIndex === index;
                return (
                  <tr
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      opacity: isDragging ? 0.4 : 1,
                      background: isDragOver && !isDragging ? "#e8f5e9" : "white",
                      transition: "background 0.15s",
                    }}
                  >
                    <td style={{ padding: "6px 8px", cursor: "grab", color: "#ccc", textAlign: "center", fontSize: 16 }}>⠿</td>
                    <td style={{ padding: "6px 8px" }}>
                      <select value={item.categoria} onChange={(e) => actualizarItem(index, "categoria", e.target.value)} style={input}>
                        <option value="">—</option>
                        {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <div style={{ position: "relative" }}>
                        <input
                          value={busquedaItems[index] ?? (insumos.find(i => i.id === item.insumo_id)?.nombre || item.descripcion || "")}
                          onChange={(e) => {
                            setBusquedaItems(prev => ({ ...prev, [index]: e.target.value }));
                            actualizarItem(index, "descripcion", e.target.value);
                            setMostrarDropdown(prev => ({ ...prev, [index]: true }));
                          }}
                          onFocus={() => setMostrarDropdown(prev => ({ ...prev, [index]: true }))}
                          onBlur={() => setTimeout(() => setMostrarDropdown(prev => ({ ...prev, [index]: false })), 200)}
                          placeholder="Buscar o escribir..."
                          style={input}
                        />
                        {mostrarDropdown[index] && (busquedaItems[index] || "").length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e0e0e0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                            {insumos.filter(i => i.nombre.toLowerCase().includes((busquedaItems[index] || "").toLowerCase())).slice(0, 8).map(i => (
                              <div key={i.id} onMouseDown={() => seleccionarInsumo(index, i)}
                                style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between" }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#f0faf4"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "white"}>
                                <span>{i.nombre}</span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  {preciosInsumos[i.id] && <span style={{ color: "#2e7d32", fontWeight: 600, fontSize: 11 }}>USD {preciosInsumos[i.id]}</span>}
                                  <span style={{ color: "#888", fontSize: 11 }}>{i.unidad}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "6px 8px" }}><input type="month" value={item.fecha_aplicacion} onChange={(e) => actualizarItem(index, "fecha_aplicacion", e.target.value)} style={input} /></td>
                    <td style={{ padding: "6px 8px" }}><input type="month" value={item.fecha_pago} onChange={(e) => actualizarItem(index, "fecha_pago", e.target.value)} style={input} /></td>
                    <td style={{ padding: "6px 8px" }}><input type="number" value={item.cantidad_por_ha} onChange={(e) => actualizarItem(index, "cantidad_por_ha", e.target.value)} style={input} placeholder="0" /></td>
                    <td style={{ padding: "6px 8px" }}><input value={item.unidad} onChange={(e) => actualizarItem(index, "unidad", e.target.value)} style={input} placeholder="L, Kg..." /></td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 13, color: precio ? "#0f1f17" : "#ccc" }}>
                      {precio ? `USD ${precio.toFixed(2)}` : "Sin precio"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 13, color: usdHa ? "#0f1f17" : "#ccc" }}>
                      {usdHa ? usdHa.toFixed(2) : "—"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <select value={item.alicuota_iva} onChange={(e) => actualizarItem(index, "alicuota_iva", e.target.value)} style={input}>
                        {ALICUOTAS.map(a => <option key={a}>{a}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <button onClick={() => quitarItem(index)} style={{ padding: "6px 10px", background: "#fee", border: "1px solid #fcc", borderRadius: 6, cursor: "pointer", color: "red" }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f0faf4" }}>
                  <td colSpan={8} style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right", fontSize: 13 }}>TOTAL / HA:</td>
                  <td style={{ padding: "10px 12px", fontWeight: 800, fontSize: 15 }}>USD {totalItemsForm.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={guardarPlan} style={{ padding: "12px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          💾 {editandoId ? "Guardar cambios" : "Crear plan"}
        </button>
        <button onClick={() => setVista("lista")} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}