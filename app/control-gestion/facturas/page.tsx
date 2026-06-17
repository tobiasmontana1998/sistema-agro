"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function CargarFacturaInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [fecha, setFecha] = useState("");
  const [fechaVto, setFechaVto] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [numeroFactura, setNumeroFactura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("");
  const [tipo, setTipo] = useState("");
  const [moneda, setMoneda] = useState("ARS");
  const [montoIngresado, setMontoIngresado] = useState("");
  const [alicuotaIva, setAlicuotaIva] = useState("21");
  const [percepciones, setPercepciones] = useState("");
  const [retenciones, setRetenciones] = useState("");
  const [noGravado, setNoGravado] = useState("");
  const [facturaOriginalId, setFacturaOriginalId] = useState("");
  const [actividad, setActividad] = useState("");
  const [actividades, setActividades] = useState<any[]>([]);
  const [labor, setLabor] = useState("");
  const [labores, setLabores] = useState<any[]>([]);
  const [remitos, setRemitos] = useState<any[]>([]);
  const [remito, setRemito] = useState("");
  const [filtroProveedorRemito, setFiltroProveedorRemito] = useState("");
  const [dolar, setDolar] = useState<number | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [items, setItems] = useState<{
    descripcion: string;
    insumo_id: string;
    cantidad: string;
    unidad: string;
    precio_unitario: string;
    descuento: string;
  }[]>([]);
  const [busquedaItems, setBusquedaItems] = useState<Record<number, string>>({});
  const [mostrarDropdown, setMostrarDropdown] = useState<Record<number, boolean>>({});

  const [cae, setCae] = useState("");
  const [caeEstado, setCaeEstado] = useState<"idle" | "verificando" | "valido" | "invalido">("idle");

  const esNotaCredito = tipoComprobante.includes("Nota de Crédito");

  const montoNetoPuro = Number(montoIngresado) || 0;
  const montoIvaPuro = montoNetoPuro * (Number(alicuotaIva) / 100);
  const montoTotalPuro = montoNetoPuro + montoIvaPuro + Number(percepciones || 0) + Number(retenciones || 0) + Number(noGravado || 0);
  const montoNeto = moneda === "USD" ? montoNetoPuro * (dolar || 1) : montoNetoPuro;
  const montoIva = moneda === "USD" ? montoIvaPuro * (dolar || 1) : montoIvaPuro;
  const montoTotal = moneda === "USD" ? montoTotalPuro * (dolar || 1) : montoTotalPuro;
  const montoEnUSD = moneda === "USD" ? montoTotalPuro : (dolar ? montoTotal / dolar : 0);

  useEffect(() => {
    Promise.all([
      supabase.from("actividades").select(),
      supabase.from("proveedores").select("id, razon_social, cuit").eq("activo", true).order("razon_social"),
      supabase.from("labores").select(),
      supabase.from("facturas").select("id, Numero_factura, Concepto, proveedores(razon_social)").order("Fecha", { ascending: false }),
      supabase.from("insumos").select().order("nombre"),
      supabase.from("remitos").select("id, numero, numero_remito, fecha, proveedor_id, proveedores(razon_social), stock_movimientos(insumo_id, cantidad, insumos(nombre))").is("factura_id", null).order("created_at", { ascending: false }),
    ]).then(([{ data: acts }, { data: provs }, { data: labs }, { data: facts }, { data: ins }, { data: rems }]) => {
      setActividades(acts || []);
      setProveedores(provs || []);
      setLabores(labs || []);
      setFacturas(facts || []);
      setInsumos(ins || []);
      setRemitos(rems || []);
    });
  }, []);

  const obtenerDolarPorFecha = async (fecha: string) => {
    try {
      const res = await fetch("https://api.bluelytics.com.ar/v2/evolution.json");
      const data = await res.json();
      const fechaISO = new Date(fecha).toISOString().slice(0, 10);
      let encontrado = data.find((d: any) => d.date.startsWith(fechaISO));
      if (!encontrado) encontrado = data[data.length - 1];
      return (encontrado.value_buy + encontrado.value_sell) / 2;
    } catch { return null; }
  };

  useEffect(() => {
    if (!fecha) return;
    obtenerDolarPorFecha(fecha).then(setDolar);
  }, [fecha]);

  useEffect(() => {
    if (!id) return;
    supabase.from("facturas").select("*").eq("id", id).single().then(({ data }) => {
      if (!data) return;
      setFecha(data.Fecha || "");
      setFechaVto(data.Fecha_vencimiento || "");
      setProveedorId(data.proveedor_id || "");
      setNumeroFactura(data.Numero_factura || "");
      setConcepto(data.Concepto || "");
      setTipo(data.Tipo || "");
      setTipoComprobante(data.tipo_comprobante || "");
      const monedaFactura = data.moneda || "ARS";
      setMoneda(monedaFactura);
      setMontoIngresado(
        monedaFactura === "USD"
          ? (data.monto_neto / (data.dolar || 1)).toFixed(2)
          : data.monto_neto?.toString() || ""
      );
      setAlicuotaIva(data.alicuota_iva?.toString() || "21");
      setPercepciones(data.percepciones?.toString() || "");
      setRetenciones(data.retenciones?.toString() || "");
      setNoGravado(data.no_gravado?.toString() || "");
      setFacturaOriginalId(data.factura_original_id || "");
      setActividad(data.Actividad_id || "");
      setLabor(data.Labor_id || "");
      setDolar(data.dolar || null);
      setPdfUrl(data.pdf_url || null);
      setCae(data.cae || "");
      setCaeEstado(data.cae ? "valido" : "idle");
    });

    supabase.from("factura_items").select("*").eq("factura_id", id).then(({ data }) => {
      if (data && data.length > 0) {
        setItems(data.map((item: any) => ({
          descripcion: item.descripcion || "",
          insumo_id: item.insumo_id || "",
          cantidad: item.cantidad?.toString() || "",
          unidad: item.unidad || "",
          precio_unitario: item.precio_unitario?.toString() || "",
          descuento: item.descuento?.toString() || "0",
        })));
      }
    });
  }, [id]);

  const verificarCAE = async () => {
    if (!cae) { alert("Ingresá el CAE"); return; }
    if (!proveedorId) { alert("Seleccioná un proveedor primero"); return; }
    if (!numeroFactura) { alert("Ingresá el número de comprobante primero"); return; }
    if (!fecha) { alert("Ingresá la fecha primero"); return; }
    if (!montoIngresado) { alert("Ingresá el monto primero"); return; }

    setCaeEstado("verificando");
    try {
      const proveedor = proveedores.find(p => p.id === proveedorId);
      const partes = numeroFactura.split('-');
      const ptoVta = partes.length === 2 ? parseInt(partes[0]) : 1;
      const nroComp = partes.length === 2 ? parseInt(partes[1]) : parseInt(numeroFactura);
      const tipoMap: Record<string, number> = {
        'Factura A': 1, 'Factura B': 6, 'Factura C': 11,
        'Nota de Crédito A': 3, 'Nota de Crédito B': 8, 'Nota de Crédito C': 13,
      };
      const tipoCbte = tipoMap[tipoComprobante] || 1;
      const fechaAFIP = fecha.replace(/-/g, '');
      const res = await fetch("/api/arca/verificar-cae", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cae,
          cuitEmisor: proveedor?.cuit,
          tipoComprobante: tipoCbte,
          ptoVta,
          nroComprobante: nroComp,
          fecha: fechaAFIP,
          importe: montoTotal,
        }),
      });
      const data = await res.json();
      if (data.error) { setCaeEstado("invalido"); console.error("Error ARCA:", data.error); }
      else { setCaeEstado(data.valido ? "valido" : "invalido"); }
    } catch { setCaeEstado("invalido"); }
  };

  const agregarItem = () => setItems([...items, { descripcion: "", insumo_id: "", cantidad: "", unidad: "", precio_unitario: "", descuento: "0" }]);
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

  const calcularTotalItem = (item: typeof items[0]) => {
    const precioNeto = Number(item.precio_unitario) * (1 - Number(item.descuento) / 100);
    return precioNeto * Number(item.cantidad);
  };

  const subirPdf = async (): Promise<string | null> => {
    if (!pdfFile) return pdfUrl;
    setSubiendo(true);
    const nombreArchivo = `${Date.now()}_${pdfFile.name.replace(/\s/g, "_")}`;
    const { error } = await supabase.storage.from("facturas").upload(nombreArchivo, pdfFile, { contentType: "application/pdf", upsert: true });
    setSubiendo(false);
    if (error) { alert("Error subiendo PDF: " + error.message); return null; }
    const { data } = supabase.storage.from("facturas").getPublicUrl(nombreArchivo);
    return data.publicUrl;
  };

  const guardarFactura = async () => {
    if (!fecha || !montoIngresado) { alert("Completá fecha y monto"); return; }
    if (!proveedorId) { alert("Seleccioná un proveedor"); return; }
    if (moneda === "ARS" && !dolar) { alert("Esperá que cargue el tipo de cambio"); return; }

    const urlPdf = await subirPdf();

    // ── proveedor_id incluido en payload para que el UPDATE también lo actualice ──
    const payload = {
      Fecha: fecha,
      Fecha_vencimiento: fechaVto || null,
      proveedor_id: proveedorId,
      Numero_factura: numeroFactura,
      Concepto: concepto,
      Tipo: tipo,
      tipo_comprobante: tipoComprobante,
      Monto: montoTotal,
      monto_neto: montoNeto,
      alicuota_iva: Number(alicuotaIva),
      monto_iva: montoIva,
      percepciones: Number(percepciones || 0),
      retenciones: Number(retenciones || 0),
      no_gravado: Number(noGravado || 0),
      monto_usd: montoEnUSD,
      dolar: dolar,
      moneda: moneda,
      Actividad_id: actividad,
      Labor_id: labor || null,
      factura_original_id: facturaOriginalId || null,
      pdf_url: urlPdf || null,
      cae: cae || null,
      cae_valido: caeEstado === "valido",
    };

    let facturaId = id;
    let error;

    if (id) {
      const { error: e } = await supabase.from("facturas").update(payload).eq("id", id);
      error = e;
    } else {
      const { data: nueva, error: e } = await supabase.from("facturas").insert([payload]).select().single();
      error = e;
      facturaId = nueva?.id;
    }

    if (error) { alert(error.message); return; }

    if (remito && facturaId) {
      await supabase.from("remitos").update({ factura_id: facturaId }).eq("id", remito);
      await supabase.from("stock_movimientos").update({ factura_id: facturaId }).eq("remito_id", remito);
    }

    if (facturaId && items.length > 0) {
      await supabase.from("factura_items").delete().eq("factura_id", facturaId);
      const itemsParaGuardar = items
        .filter(item => item.descripcion || item.insumo_id)
        .map(item => {
          const precioNeto = Number(item.precio_unitario) * (1 - Number(item.descuento) / 100);
          const total = precioNeto * Number(item.cantidad);
          return {
            factura_id: facturaId,
            descripcion: item.descripcion,
            insumo_id: item.insumo_id || null,
            cantidad: Number(item.cantidad) || 0,
            unidad: item.unidad,
            precio_unitario: Number(item.precio_unitario) || 0,
            descuento: Number(item.descuento) || 0,
            precio_neto: precioNeto,
            total,
          };
        });
      if (itemsParaGuardar.length > 0) {
        await supabase.from("factura_items").insert(itemsParaGuardar);
      }
    }

    alert(`✅ Total ARS $${montoTotal.toLocaleString("es-AR")} | USD ${montoEnUSD.toFixed(2)}`);
    setFecha(""); setFechaVto(""); setProveedorId(""); setNumeroFactura(""); setConcepto("");
    setTipo(""); setTipoComprobante(""); setMontoIngresado(""); setAlicuotaIva("21");
    setPercepciones(""); setRetenciones(""); setNoGravado(""); setFacturaOriginalId("");
    setActividad(""); setLabor(""); setRemito(""); setDolar(null); setPdfFile(null); setPdfUrl(null);
    setItems([]); setBusquedaItems({}); setMostrarDropdown({});
    setCae(""); setCaeEstado("idle");
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };
  const section: React.CSSProperties = { borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 20 };
  const totalItems = items.reduce((acc, item) => acc + calcularTotalItem(item), 0);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{id ? "✏️ Editar Comprobante" : "Nuevo Comprobante"}</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registrá facturas y notas de crédito.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28 }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <div style={lbl}>TIPO DE COMPROBANTE *</div>
              <select value={tipoComprobante} onChange={(e) => setTipoComprobante(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                <option>Factura A</option><option>Factura B</option><option>Factura C</option>
                <option>Nota de Crédito A</option><option>Nota de Crédito B</option><option>Nota de Crédito C</option>
                <option>Recibo</option><option>Otro</option>
              </select>
            </div>
            <div><div style={lbl}>N° COMPROBANTE</div><input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} style={input} placeholder="0001-00012345" /></div>
            <div><div style={lbl}>FECHA *</div><input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); obtenerDolarPorFecha(e.target.value).then(setDolar); }} style={input} /></div>
            <div><div style={lbl}>VENCIMIENTO</div><input type="date" value={fechaVto} onChange={(e) => setFechaVto(e.target.value)} style={input} /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lbl}>PROVEEDOR *</div>
              <select value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setCaeEstado("idle"); }} style={input}>
                <option value="">Seleccionar proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}{p.cuit ? ` — ${p.cuit}` : ""}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lbl}>CAE (CÓDIGO DE AUTORIZACIÓN ELECTRÓNICA)</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input
                  value={cae}
                  onChange={(e) => { setCae(e.target.value); setCaeEstado("idle"); }}
                  style={{ ...input, marginTop: 0, flex: 1 }}
                  placeholder="Ej: 71123456789012"
                />
                <button
                  onClick={verificarCAE}
                  disabled={caeEstado === "verificando" || !cae}
                  style={{
                    padding: "10px 16px",
                    background: caeEstado === "verificando" || !cae ? "#ccc" : "#0f1f17",
                    color: "white", border: "none", borderRadius: 8,
                    cursor: caeEstado === "verificando" || !cae ? "not-allowed" : "pointer",
                    fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
                  }}
                >
                  {caeEstado === "verificando" ? "Verificando..." : "🔍 Verificar en ARCA"}
                </button>
              </div>
              {caeEstado === "valido" && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#2e7d32", background: "#e8f5e9", padding: "6px 12px", borderRadius: 6 }}>
                  ✅ CAE válido — verificado en ARCA
                </div>
              )}
              {caeEstado === "invalido" && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#c62828", background: "#ffebee", padding: "6px 12px", borderRadius: 6 }}>
                  ❌ CAE inválido o no encontrado en ARCA. Podés igualmente guardar la factura.
                </div>
              )}
            </div>
          </div>

          {esNotaCredito && (
            <div style={{ ...section, background: "#fff8e1", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📎 Vincular a factura original</div>
              <div style={lbl}>FACTURA ORIGINAL</div>
              <select value={facturaOriginalId} onChange={(e) => setFacturaOriginalId(e.target.value)} style={input}>
                <option value="">Seleccionar factura</option>
                {facturas.map((f) => (
                  <option key={f.id} value={f.id}>{f.Numero_factura} — {(f.proveedores as any)?.razon_social} — {f.Concepto?.slice(0, 30)}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={lbl}>CONCEPTO DETALLADO</div>
            <textarea value={concepto} onChange={(e) => setConcepto(e.target.value)} style={{ ...input, height: 80, resize: "vertical" }} placeholder="Describí los productos o servicios..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <div style={lbl}>CATEGORÍA</div>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                <option>Insumos</option><option>Servicios</option><option>Combustible</option>
              </select>
            </div>
            <div>
              <div style={lbl}>ACTIVIDAD</div>
              <select value={actividad} onChange={(e) => setActividad(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                {actividades.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* ÍTEMS */}
          <div style={section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📦 Ítems de la factura</div>
              <button onClick={agregarItem} style={{ padding: "7px 14px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                + Agregar ítem
              </button>
            </div>

            {items.length === 0 && (
              <p style={{ color: "#bbb", fontSize: 13 }}>Sin ítems — opcional pero recomendado para calcular costos por insumo.</p>
            )}

            {items.map((item, index) => (
              <div key={index} style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...lbl, marginBottom: 4 }}>PRODUCTO</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={busquedaItems[index] ?? (insumos.find(i => i.id === item.insumo_id)?.nombre || "")}
                      onChange={(e) => {
                        setBusquedaItems(prev => ({ ...prev, [index]: e.target.value }));
                        setMostrarDropdown(prev => ({ ...prev, [index]: true }));
                        if (!e.target.value) {
                          actualizarItem(index, "insumo_id", "");
                          actualizarItem(index, "descripcion", "");
                        }
                      }}
                      onFocus={() => setMostrarDropdown(prev => ({ ...prev, [index]: true }))}
                      onBlur={() => setTimeout(() => setMostrarDropdown(prev => ({ ...prev, [index]: false })), 200)}
                      placeholder="Escribí para buscar..."
                      style={input}
                    />
                    {mostrarDropdown[index] && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1px solid #e0e0e0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 240, overflowY: "auto" }}>
                        {insumos
                          .filter(i => i.nombre.toLowerCase().includes((busquedaItems[index] || "").toLowerCase()))
                          .map(i => (
                            <div key={i.id} onMouseDown={() => seleccionarInsumo(index, i)}
                              style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#f0faf4"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "white"}>
                              <span style={{ fontWeight: 500 }}>{i.nombre}</span>
                              <span style={{ color: "#888", fontSize: 12 }}>{i.unidad} — {i.categoria}</span>
                            </div>
                          ))}
                        {insumos.filter(i => i.nombre.toLowerCase().includes((busquedaItems[index] || "").toLowerCase())).length === 0 && (
                          <div style={{ padding: "12px 14px", color: "#888", fontSize: 13 }}>No encontrado</div>
                        )}
                      </div>
                    )}
                  </div>
                  {item.insumo_id && (
                    <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 4, fontWeight: 600 }}>
                      ✅ {insumos.find(i => i.id === item.insumo_id)?.categoria} — {insumos.find(i => i.id === item.insumo_id)?.unidad}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                  <div>
                    <div style={{ ...lbl, marginBottom: 4 }}>CANTIDAD</div>
                    <input type="number" value={item.cantidad} onChange={(e) => actualizarItem(index, "cantidad", e.target.value)} style={input} />
                  </div>
                  <div>
                    <div style={{ ...lbl, marginBottom: 4 }}>UNIDAD</div>
                    <input value={item.unidad} onChange={(e) => actualizarItem(index, "unidad", e.target.value)} style={input} placeholder="BOL, Kg, L..." />
                  </div>
                  <div>
                    <div style={{ ...lbl, marginBottom: 4 }}>PRECIO UNIT. ({moneda})</div>
                    <input type="number" value={item.precio_unitario} onChange={(e) => actualizarItem(index, "precio_unitario", e.target.value)} style={input} />
                  </div>
                  <div>
                    <div style={{ ...lbl, marginBottom: 4 }}>DESCUENTO %</div>
                    <input type="number" value={item.descuento} onChange={(e) => actualizarItem(index, "descuento", e.target.value)} style={input} placeholder="0" />
                  </div>
                  <button onClick={() => quitarItem(index)} style={{ padding: "10px 12px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", color: "red", marginTop: 22 }}>✕</button>
                </div>

                {item.cantidad && item.precio_unitario && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#555", textAlign: "right", background: "#f8f9fa", borderRadius: 6, padding: "6px 12px" }}>
                    Total ítem: <strong>{moneda} {calcularTotalItem(item).toFixed(2)}</strong>
                    {moneda === "USD" && dolar && (
                      <span style={{ color: "#888", marginLeft: 8 }}>(ARS ${(calcularTotalItem(item) * dolar).toLocaleString("es-AR", { maximumFractionDigits: 0 })})</span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {items.length > 0 && (
              <div style={{ background: "#f0faf4", borderRadius: 8, padding: 12, fontSize: 14, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Total ítems:</span>
                <span>{moneda} {totalItems.toFixed(2)}{moneda === "USD" && dolar ? ` (ARS $${(totalItems * dolar).toLocaleString("es-AR", { maximumFractionDigits: 0 })})` : ""}</span>
              </div>
            )}
          </div>

          {/* MONTOS */}
          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>💰 Importes totales</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 16 }}>
              <div>
                <div style={lbl}>MONEDA</div>
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={input}>
                  <option value="ARS">$ Pesos (ARS)</option>
                  <option value="USD">U$D Dólares (USD)</option>
                </select>
              </div>
              <div>
                <div style={lbl}>MONTO NETO GRAVADO {moneda === "USD" ? "EN USD *" : "*"}</div>
                <input type="number" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} style={input} placeholder="0.00" />
              </div>
              <div>
                <div style={lbl}>TIPO DE CAMBIO</div>
                <input type="number" value={dolar || ""} onChange={(e) => setDolar(Number(e.target.value))} style={input} placeholder="Auto" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20, marginBottom: 16 }}>
              <div>
                <div style={lbl}>ALÍCUOTA IVA</div>
                <select value={alicuotaIva} onChange={(e) => setAlicuotaIva(e.target.value)} style={input}>
                  <option value="0">0% (Exento)</option>
                  <option value="10.5">10.5%</option>
                  <option value="21">21%</option>
                  <option value="27">27%</option>
                </select>
              </div>
              <div>
                <div style={lbl}>NO GRAVADO</div>
                <input type="number" value={noGravado} onChange={(e) => setNoGravado(e.target.value)} style={input} placeholder="0.00" />
              </div>
              <div>
                <div style={lbl}>PERCEPCIONES</div>
                <input type="number" value={percepciones} onChange={(e) => setPercepciones(e.target.value)} style={input} placeholder="0.00" />
              </div>
              <div>
                <div style={lbl}>RETENCIONES</div>
                <input type="number" value={retenciones} onChange={(e) => setRetenciones(e.target.value)} style={input} placeholder="0.00" />
              </div>
            </div>

            {montoIngresado && (
              <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 16, fontSize: 13 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ color: "#888" }}>Monto neto gravado:</div>
                  <div style={{ fontWeight: 600, textAlign: "right" }}>${montoNeto.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
                  {Number(noGravado) > 0 && <>
                    <div style={{ color: "#888" }}>No gravado:</div>
                    <div style={{ fontWeight: 600, textAlign: "right" }}>${Number(noGravado).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
                  </>}
                  <div style={{ color: "#888" }}>IVA ({alicuotaIva}%):</div>
                  <div style={{ fontWeight: 600, textAlign: "right" }}>${montoIva.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
                  {Number(percepciones) > 0 && <>
                    <div style={{ color: "#888" }}>Percepciones:</div>
                    <div style={{ fontWeight: 600, textAlign: "right" }}>${Number(percepciones).toLocaleString("es-AR")}</div>
                  </>}
                  {Number(retenciones) > 0 && <>
                    <div style={{ color: "#888" }}>Retenciones:</div>
                    <div style={{ fontWeight: 600, textAlign: "right" }}>${Number(retenciones).toLocaleString("es-AR")}</div>
                  </>}
                  <div style={{ borderTop: "1px solid #ddd", paddingTop: 8, fontWeight: 700 }}>TOTAL ARS:</div>
                  <div style={{ borderTop: "1px solid #ddd", paddingTop: 8, fontWeight: 800, textAlign: "right", fontSize: 15 }}>${montoTotal.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
                  {dolar && <>
                    <div style={{ color: "#888" }}>USD:</div>
                    <div style={{ fontWeight: 600, textAlign: "right" }}>USD {montoEnUSD.toFixed(2)}</div>
                  </>}
                </div>
              </div>
            )}
          </div>

          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              {tipo === "Insumos" ? "📦 Remito asociado" : "🚜 Labor asociada"}
            </div>

            {tipo === "Insumos" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={lbl}>FILTRAR POR PROVEEDOR</div>
                  <select value={filtroProveedorRemito} onChange={(e) => { setFiltroProveedorRemito(e.target.value); setRemito(""); }} style={input}>
                    <option value="">Todos los proveedores</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                  </select>
                </div>
                <div>
                  <div style={lbl}>SELECCIONAR REMITO</div>
                  <select value={remito} onChange={(e) => setRemito(e.target.value)} style={input}>
                    <option value="">Sin asociar</option>
                    {remitos
                      .filter(r => !filtroProveedorRemito || r.proveedor_id === filtroProveedorRemito)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          R-{String(r.numero).padStart(3, "0")} — {r.numero_remito || "Sin N°"} — {r.fecha} — {r.proveedores?.razon_social || "Sin proveedor"} — {(r.stock_movimientos || []).map((m: any) => m.insumos?.nombre).filter(Boolean).join(", ")}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div style={lbl}>SELECCIONAR LABOR</div>
                <select value={labor} onChange={(e) => setLabor(e.target.value)} style={input}>
                  <option value="">Sin asociar</option>
                  {labores.map((l) => {
                    const costoLabor = l.Costo_total || 0;
                    const coincide = montoNeto > 0 && Math.abs(costoLabor - montoNeto) < 1;
                    const nroLabor = l.numero ? `L-${String(l.numero).padStart(3, "0")}` : "";
                    return (
                      <option key={l.id} value={l.id} disabled={montoNeto > 0 && !coincide}>
                        {nroLabor} — {l.Tipo} — {l.Fecha} — ${Number(l.Costo_total || 0).toLocaleString("es-AR")}
                        {montoNeto > 0 && coincide ? " ✅" : montoNeto > 0 ? " ❌ monto no coincide" : ""}
                      </option>
                    );
                  })}
                </select>
                {labor && montoNeto > 0 && (() => {
                  const laborSel = labores.find(l => l.id === labor);
                  const coincide = laborSel && Math.abs((laborSel.Costo_total || 0) - montoNeto) < 1;
                  return coincide ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#2e7d32", background: "#e8f5e9", padding: "6px 12px", borderRadius: 6 }}>
                      ✅ El monto coincide con el costo del labor
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#c62828", background: "#ffebee", padding: "6px 12px", borderRadius: 6 }}>
                      ⚠️ El monto no coincide — Labor: ${Number(laborSel?.Costo_total || 0).toLocaleString("es-AR")} / Factura (neto): ${montoNeto.toLocaleString("es-AR")}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <div style={section}>
            <div style={lbl}>ADJUNTAR PDF</div>
            <div style={{ marginTop: 8 }}>
              {pdfUrl && !pdfFile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 14px", background: "#f0faf4", borderRadius: 8 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>PDF adjunto</div>
                    <div style={{ fontSize: 12, color: "#888" }}>Ya tiene un PDF cargado</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0f1f17", fontWeight: 600, textDecoration: "none" }}>Ver PDF →</a>
                    <button onClick={async () => {
                      if (!confirm("¿Eliminar el PDF adjunto?")) return;
                      const nombreArchivo = pdfUrl!.split("/").pop()!;
                      await supabase.storage.from("facturas").remove([nombreArchivo]);
                      await supabase.from("facturas").update({ pdf_url: null }).eq("id", id!);
                      setPdfUrl(null);
                    }} style={{ background: "none", border: "none", color: "red", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑 Eliminar</button>
                  </div>
                </div>
              )}
              {pdfFile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 14px", background: "#fff8e1", borderRadius: 8 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{pdfFile.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{(pdfFile.size / 1024).toFixed(0)} KB — listo para subir</div>
                  </div>
                  <button onClick={() => setPdfFile(null)} style={{ background: "none", border: "none", color: "red", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#f5f5f5", border: "1px dashed #ccc", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                📎 {pdfFile ? "Cambiar PDF" : "Seleccionar PDF"}
                <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) setPdfFile(e.target.files[0]); }} />
              </label>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button onClick={guardarFactura} disabled={subiendo} style={{ padding: "12px 24px", background: subiendo ? "#888" : "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: subiendo ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}>
              {subiendo ? "Subiendo PDF..." : `💾 ${id ? "Guardar cambios" : "Registrar comprobante"}`}
            </button>
            <button onClick={() => window.history.back()} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
              Cancelar
            </button>
          </div>
        </div>

        {/* PANEL LATERAL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Resumen</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>NETO GRAVADO</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>${montoNeto.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
            {Number(noGravado) > 0 && <>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>NO GRAVADO</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>${Number(noGravado).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
            </>}
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>IVA</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>${montoIva.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>TOTAL ARS</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>${montoTotal.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>TOTAL USD</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f1f17" }}>USD {montoEnUSD.toFixed(2)}</div>
            {items.length > 0 && (
              <>
                <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 12, paddingTop: 12, fontSize: 12, color: "#888", marginBottom: 4 }}>TOTAL ÍTEMS</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f1f17" }}>{moneda} {totalItems.toFixed(2)}</div>
              </>
            )}
            {cae && (
              <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 12, paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>ESTADO CAE</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: caeEstado === "valido" ? "#2e7d32" : caeEstado === "invalido" ? "#c62828" : "#888" }}>
                  {caeEstado === "valido" ? "✅ Verificado" : caeEstado === "invalido" ? "❌ Inválido" : "⏳ Sin verificar"}
                </div>
              </div>
            )}
          </div>
          {esNotaCredito && (
            <div style={{ background: "#fff3e0", borderRadius: 12, padding: 16, fontSize: 13, color: "#e65100" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Nota de Crédito</div>
              Este comprobante reduce el saldo con el proveedor.
            </div>
          )}
          <div style={{ background: "#fff8e1", borderRadius: 12, padding: 16, fontSize: 13, color: "#7c5c00" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>💡 Tip</div>
            Vinculá cada ítem a un insumo del stock para calcular el costo por unidad automáticamente.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Cargando...</div>}>
      <CargarFacturaInner />
    </Suspense>
  );
}