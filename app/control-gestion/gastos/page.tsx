"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Gastos() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [remitos, setRemitos] = useState<any[]>([]);
  const [itemsData, setItemsData] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState("fecha");
  const [filtroRemito, setFiltroRemito] = useState("todos");
  const [modalPago, setModalPago] = useState<any>(null);
  const [pagadorModal, setPagadorModal] = useState("OC");
  const [montoModal, setMontoModal] = useState("");
  const [fechaModal, setFechaModal] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    const [{ data: facturas }, { data: pagosData }, { data: remitosData }, { data: items }] = await Promise.all([
      supabase.from("facturas").select(`
        id, Fecha, Fecha_vencimiento, Numero_factura, Concepto, Tipo, Pagador, pdf_url,
        Monto, monto_usd, dolar, pagada, moneda, proveedor_id,
        tipo_comprobante, monto_neto, monto_iva, percepciones, retenciones,
        proveedores!fk_facturas_proveedor (razon_social, cuit),
        actividades!fk_facturas_actividad (nombre),
        labores!fk_facturas_labor (numero)
      `).order("Fecha", { ascending: false }),
      supabase.from("pagos_facturas").select("*"),
      supabase.from("stock_movimientos").select("factura_id, insumo_id, cantidad").eq("tipo", "entrada").eq("motivo", "remito").not("factura_id", "is", null),
      supabase.from("factura_items").select("factura_id, insumo_id, cantidad"),
    ]);
    setGastos(facturas || []);
    setPagos(pagosData || []);
    setRemitos(remitosData || []);
    setItemsData(items || []);
    return { facturas, pagosData };
  };

  const getEstadoRemito = (facturaId: string) => {
    const itemsFactura = itemsData.filter((i: any) => i.factura_id === facturaId);
    const algunoRemitido = remitos.some(r => r.factura_id === facturaId);

    if (itemsFactura.length === 0) return algunoRemitido ? "vinculado" : "sin_remito";

    const todosCompletos = itemsFactura.every((item: any) => {
      const remitido = remitos
        .filter(r => r.factura_id === facturaId && r.insumo_id === item.insumo_id)
        .reduce((acc: number, r: any) => acc + Number(r.cantidad), 0);
      return remitido >= Number(item.cantidad);
    });

    if (todosCompletos) return "vinculado";
    if (algunoRemitido) return "parcial";
    return "sin_remito";
  };

  const tieneRemito = (facturaId: string) => getEstadoRemito(facturaId) !== "sin_remito";

  const eliminarGasto = async (id: string) => {
    if (!confirm("¿Eliminar gasto?")) return;
    const { error } = await supabase.from("facturas").delete().eq("id", id);
    if (error) { alert("Error eliminando"); return; }
    setGastos((prev) => prev.filter((g) => g.id !== id));
  };

  const eliminarPago = async (pagoId: string, facturaId: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    await supabase.from("pagos_facturas").delete().eq("id", pagoId);
    await supabase.from("facturas").update({ pagada: false }).eq("id", facturaId);
    const { pagosData } = await cargarDatos();
    if (modalPago?.id === facturaId) {
      const pagosRestantes = (pagosData || []).filter((p: any) => p.factura_id === facturaId);
      setModalPago((prev: any) => ({ ...prev, pagada: false, _pagos: pagosRestantes }));
    }
  };

  const exportarCSV = () => {
    const encabezado = ["Fecha emisión", "Fecha vencimiento", "Proveedor", "Factura", "Concepto", "Tipo", "Pagador", "Actividad", "Monto ARS", "Monto USD", "Dólar", "PDF"];
    const filas = gastos.map((g) => [
      g.Fecha, g.Fecha_vencimiento, g.proveedores?.razon_social, g.Numero_factura,
      g.Concepto, g.Tipo, g.Pagador, g.actividades?.nombre || "",
      Number(g.Monto).toFixed(2), Number(g.monto_usd).toFixed(2), Number(g.dolar).toFixed(2), g.pdf_url || "",
    ]);
    const csv = [encabezado, ...filas].map((f) => f.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gastos_completo.csv";
    a.click();
  };

  const exportarIVAComprasTXT = () => {
    const tipoComprobanteMap: Record<string, string> = {
      "Factura A": "001", "Factura B": "006", "Factura C": "011",
      "Nota de Crédito A": "003", "Nota de Crédito B": "008", "Nota de Crédito C": "013",
      "Recibo": "004",
    };
    const monedaMap: Record<string, string> = { "ARS": "PES", "USD": "DOL" };

    const lineas = gastos
      .filter(g => g.proveedores?.cuit && g.tipo_comprobante)
      .map(g => {
        const fecha = g.Fecha?.replace(/-/g, "");
        const tipoComp = tipoComprobanteMap[g.tipo_comprobante] || "001";
        const partes = (g.Numero_factura || "0000-00000000").split("-");
        const puntoVenta = (partes[0] || "0000").padStart(5, "0");
        const nroComp = (partes[1] || "00000000").padStart(8, "0");
        const cuitSinGuiones = (g.proveedores?.cuit || "").replace(/-/g, "");
        const moneda = monedaMap[g.moneda] || "PES";
        const tipoCambio = g.moneda === "USD" ? Number(g.dolar).toFixed(6) : "1.000000";
        const alicuota = Number(g.alicuota_iva || 21);

        return [
          fecha, tipoComp, puntoVenta, nroComp, "",
          "80", cuitSinGuiones, g.proveedores?.razon_social || "",
          Number(g.Monto).toFixed(2), "0.00",
          alicuota === 0 ? Number(g.monto_neto || 0).toFixed(2) : "0.00",
          "0.00", "0.00",
          Number(g.percepciones || 0).toFixed(2),
          "0.00", "0.00",
          moneda, tipoCambio, "1", "",
          Number(g.monto_iva || 0).toFixed(2),
          Number(g.retenciones || 0).toFixed(2),
          "", "", "0.00",
        ].join(",");
      });

    const blob = new Blob([lineas.join("\n")], { type: "text/plain;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `IVA_Compras_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };

  const esUSD = (g: any) => g.moneda === "USD";

  const abrirModalPago = (g: any) => {
    setModalPago(g);
    const montoDefault = esUSD(g) ? Number(g.monto_usd).toFixed(2) : Number(g.Monto).toFixed(2);
    setMontoModal(montoDefault);
    setPagadorModal("OC");
    setFechaModal(new Date().toISOString().split("T")[0]);
  };

  const guardarPago = async () => {
    if (!montoModal || !pagadorModal) return;
    const montoEnARS = esUSD(modalPago) ? Number(montoModal) * (modalPago.dolar || 1) : Number(montoModal);
    const { error } = await supabase.from("pagos_facturas").insert([{ factura_id: modalPago.id, pagador: pagadorModal, monto: montoEnARS, fecha: fechaModal }]);
    if (error) { alert("Error: " + error.message); return; }
    const pagosFactura = [...pagos.filter(p => p.factura_id === modalPago.id), { monto: montoEnARS }];
    const totalPagado = pagosFactura.reduce((acc, p) => acc + Number(p.monto), 0);
    if (totalPagado >= modalPago.Monto) {
      await supabase.from("facturas").update({ pagada: true }).eq("id", modalPago.id);
    }
    setModalPago(null);
    cargarDatos();
  };

  const getPagosFactura = (facturaId: string) => pagos.filter(p => p.factura_id === facturaId);
  const getTotalPagadoCT = (facturaId: string) => getPagosFactura(facturaId).filter(p => p.pagador === "CT").reduce((acc, p) => acc + Number(p.monto), 0);
  const getTotalPagadoOC = (facturaId: string) => getPagosFactura(facturaId).filter(p => p.pagador === "OC").reduce((acc, p) => acc + Number(p.monto), 0);

  const gastosFiltrados = gastos
    .filter((g) => {
      const matchTexto = !filtro ||
        g.proveedores?.razon_social?.toLowerCase().includes(filtro.toLowerCase()) ||
        g.Concepto?.toLowerCase().includes(filtro.toLowerCase()) ||
        g.Numero_factura?.toLowerCase().includes(filtro.toLowerCase());
      if (!matchTexto) return false;
      if (filtroRemito === "sin_remito") return g.Tipo === "Insumos" && !tieneRemito(g.id);
      if (filtroRemito === "con_remito") return g.Tipo === "Insumos" && tieneRemito(g.id);
      return true;
    })
    .sort((a, b) => orden === "monto" ? b.Monto - a.Monto : new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime());

  const totalGastado = gastos.reduce((acc, g) => acc + (g.Monto || 0), 0);
  const totalPagadoCT = pagos.filter(p => p.pagador === "CT").reduce((acc, p) => acc + Number(p.monto), 0);
  const totalPagadoOC = pagos.filter(p => p.pagador === "OC").reduce((acc, p) => acc + Number(p.monto), 0);
  const totalPagado = totalPagadoCT + totalPagadoOC;
  const pctCT = totalPagado > 0 ? ((totalPagadoCT / totalPagado) * 100).toFixed(1) : "0";
  const pctOC = totalPagado > 0 ? ((totalPagadoOC / totalPagado) * 100).toFixed(1) : "0";
  const diferenciaOC = totalPagadoOC - totalPagado * 0.8;
  const diferenciaCT = totalPagadoCT - totalPagado * 0.2;
  const sinRemitoCount = gastos.filter(g => g.Tipo === "Insumos" && getEstadoRemito(g.id) === "sin_remito").length;

  const dataPie = [{ name: "CT", value: totalPagadoCT }, { name: "OC", value: totalPagadoOC }];
  const COLORS = ["#f5c542", "#0f1f17"];

  const facturasPendientes = gastos
    .filter((g) => g.pagada === false && g.Fecha_vencimiento)
    .sort((a, b) => new Date(a.Fecha_vencimiento).getTime() - new Date(b.Fecha_vencimiento).getTime());

  const card: React.CSSProperties = { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24 };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#888", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>

      {/* MODAL PAGO */}
      {modalPago && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 32, width: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>💳 Registrar pago</h2>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 20px" }}>{modalPago.proveedores?.razon_social} — {modalPago.Numero_factura}</p>

            <div style={{ background: esUSD(modalPago) ? "#e3f2fd" : "#f0faf4", borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{esUSD(modalPago) ? "💵 Factura en USD" : "💲 Factura en ARS"}</div>
              <div style={{ color: "#888", marginTop: 2 }}>Total: {esUSD(modalPago) ? `USD ${Number(modalPago.monto_usd).toFixed(2)}` : `$${Number(modalPago.Monto).toLocaleString("es-AR")}`}</div>
            </div>

            {getPagosFactura(modalPago.id).length > 0 && (
              <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Pagos registrados:</div>
                {getPagosFactura(modalPago.id).map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "4px 0", borderBottom: "1px solid #eee" }}>
                    <div>
                      <span style={{ color: p.pagador === "OC" ? "#0f1f17" : "#f59f00", fontWeight: 700 }}>{p.pagador}</span>
                      <span style={{ color: "#888", marginLeft: 8, fontSize: 12 }}>{p.fecha}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{esUSD(modalPago) ? `USD ${(Number(p.monto) / (modalPago.dolar || 1)).toFixed(2)}` : `$${Number(p.monto).toLocaleString("es-AR")}`}</span>
                      <button onClick={() => eliminarPago(p.id, modalPago.id)} style={{ background: "#fee", border: "1px solid #fcc", color: "red", padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 8 }}>
                  <span>Saldo pendiente:</span>
                  <span>{esUSD(modalPago) ? `USD ${((modalPago.Monto - getTotalPagadoCT(modalPago.id) - getTotalPagadoOC(modalPago.id)) / (modalPago.dolar || 1)).toFixed(2)}` : `$${(modalPago.Monto - getTotalPagadoCT(modalPago.id) - getTotalPagadoOC(modalPago.id)).toLocaleString("es-AR")}`}</span>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>PAGADOR</div>
                <select value={pagadorModal} onChange={(e) => setPagadorModal(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14 }}>
                  <option value="OC">OC</option>
                  <option value="CT">CT</option>
                  <option value="Sociedad">Sociedad</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>MONTO {esUSD(modalPago) ? "(USD)" : "(ARS)"}</div>
                <input type="number" value={montoModal} onChange={(e) => setMontoModal(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>FECHA DE PAGO</div>
              <input type="date" value={fechaModal} onChange={(e) => setFechaModal(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14 }} />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={guardarPago} style={{ flex: 1, padding: "12px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>💾 Registrar pago</button>
              <button onClick={() => setModalPago(null)} style={{ padding: "12px 20px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Gastos del Período</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Visualización completa de erogaciones y costos.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={exportarIVAComprasTXT} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e0e0e0", background: "white", color: "#0f1f17", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            📋 Exportar IVA ARCA
          </button>
          <button onClick={exportarCSV} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#0f1f17", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            ⬇ Exportar CSV
          </button>
        </div>
      </div>

      {/* ALERTA REMITOS PENDIENTES */}
      {sinRemitoCount > 0 && (
        <div style={{ background: "#fff3e0", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, color: "#e65100" }}>
            ⚠️ <strong>{sinRemitoCount} factura{sinRemitoCount > 1 ? "s" : ""} de insumos</strong> sin remito vinculado
          </div>
          <button onClick={() => setFiltroRemito("sin_remito")} style={{ fontSize: 13, padding: "6px 14px", background: "#e65100", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            Ver sin remito
          </button>
        </div>
      )}

      {/* MÉTRICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ ...card, borderLeft: "4px solid #f5c542" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TOTAL GASTADO</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>${totalGastado.toLocaleString("es-AR")}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{gastos.length} facturas registradas</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>BALANCE OC(80%) / CT(20%)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: diferenciaOC >= 0 ? "#fff8e1" : "#e8f5e9", borderRadius: 8, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888" }}>OC pagó</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f1f17" }}>{pctOC}%</div>
              <div style={{ fontSize: 11, color: diferenciaOC >= 0 ? "#f59f00" : "#2e7d32" }}>
                {diferenciaOC >= 0 ? `+$${diferenciaOC.toLocaleString("es-AR", { maximumFractionDigits: 0 })} de más` : `$${Math.abs(diferenciaOC).toLocaleString("es-AR", { maximumFractionDigits: 0 })} le falta`}
              </div>
            </div>
            <div style={{ background: diferenciaCT >= 0 ? "#fff8e1" : "#e8f5e9", borderRadius: 8, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888" }}>CT pagó</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f59f00" }}>{pctCT}%</div>
              <div style={{ fontSize: 11, color: diferenciaCT >= 0 ? "#f59f00" : "#2e7d32" }}>
                {diferenciaCT >= 0 ? `+$${diferenciaCT.toLocaleString("es-AR", { maximumFractionDigits: 0 })} de más` : `$${Math.abs(diferenciaCT).toLocaleString("es-AR", { maximumFractionDigits: 0 })} le falta`}
              </div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>DISTRIBUCIÓN</div>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={dataPie} dataKey="value" outerRadius={50} innerRadius={28}>
                {dataPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, fontSize: 13, marginTop: 4 }}>
            <span><span style={{ color: "#f5c542", fontWeight: 700 }}>●</span> CT: {pctCT}%</span>
            <span><span style={{ color: "#0f1f17", fontWeight: 700 }}>●</span> OC: {pctOC}%</span>
          </div>
        </div>
      </div>

      {/* FACTURAS PENDIENTES */}
      {facturasPendientes.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>FACTURAS PENDIENTES</div>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 100px", fontWeight: 700, fontSize: 12, color: "#888", borderBottom: "1px solid #eee", paddingBottom: 6, marginBottom: 6 }}>
            <div>Vto</div><div>Proveedor</div><div>Fact.</div><div>Monto</div>
          </div>
          {facturasPendientes.slice(0, 5).map((f) => (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 100px", padding: "5px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13, color: new Date(f.Fecha_vencimiento) < new Date() ? "red" : "#333" }}>
              <div style={{ fontWeight: 600 }}>{f.Fecha_vencimiento}</div>
              <div>{f.proveedores?.razon_social || "—"}</div>
              <div style={{ color: "#888" }}>{f.Numero_factura}</div>
              <div style={{ fontWeight: 700 }}>${Number(f.Monto).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="text" placeholder="Buscar proveedor o concepto..." value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, width: 280 }} />
        <select value={orden} onChange={(e) => setOrden(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
          <option value="fecha">Ordenar por fecha</option>
          <option value="monto">Ordenar por monto</option>
        </select>
        <select value={filtroRemito} onChange={(e) => setFiltroRemito(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
          <option value="todos">Todos los gastos</option>
          <option value="sin_remito">⚠️ Insumos sin remito</option>
          <option value="con_remito">✅ Insumos con remito</option>
        </select>
        {filtroRemito !== "todos" && (
          <button onClick={() => setFiltroRemito("todos")} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, background: "white", cursor: "pointer" }}>
            Limpiar filtro
          </button>
        )}
      </div>

      {/* TABLA */}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #eee" }}>
              <th style={th}>F. EMISIÓN</th>
              <th style={th}>F. VTO</th>
              <th style={th}>PROVEEDOR</th>
              <th style={th}>FACTURA</th>
              <th style={th}>CONCEPTO</th>
              <th style={th}>TIPO</th>
              <th style={th}>REMITO</th>
              <th style={th}>PAGOS</th>
              <th style={th}>PAGÓ</th>
              <th style={th}>MONTO</th>
              <th style={th}>USD</th>
              <th style={th}>PDF</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {gastosFiltrados.map((g) => {
              const pagadoCT = getTotalPagadoCT(g.id);
              const pagadoOC = getTotalPagadoOC(g.id);
              const totalPagadoFactura = pagadoCT + pagadoOC;
              const saldo = g.Monto - totalPagadoFactura;
              const facturaUSD = esUSD(g);
              const esInsumo = g.Tipo === "Insumos";
              const estadoRemito = getEstadoRemito(g.id);

              return (
                <tr
                  key={g.id}
                  onDoubleClick={() => { window.location.href = `/control-gestion/facturas?id=${g.id}`; }}
                  style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", backgroundColor: g.pagada ? "#d4edda" : "white" }}
                  onMouseEnter={(e) => { if (!g.pagada) e.currentTarget.style.backgroundColor = "#f9f9f9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = g.pagada ? "#d4edda" : "white"; }}
                >
                  <td style={td}>{g.Fecha}</td>
                  <td style={{ ...td, color: g.Fecha_vencimiento && new Date(g.Fecha_vencimiento) < new Date() && !g.pagada ? "red" : "#333", fontWeight: g.Fecha_vencimiento && new Date(g.Fecha_vencimiento) < new Date() && !g.pagada ? 700 : 400 }}>
                    {g.Fecha_vencimiento || "-"}
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{g.proveedores?.razon_social || "-"}</td>
                  <td style={{ ...td, color: "#888" }}>{g.Numero_factura}</td>
                  <td style={td}>{g.Concepto}</td>
                  <td style={td}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: "#f0f0f0", fontSize: 12, fontWeight: 600 }}>{g.Tipo}</span>
                  </td>
                  <td style={td}>
                    {esInsumo ? (
                      estadoRemito === "vinculado" ? (
                        <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✅ Vinculado</span>
                      ) : estadoRemito === "parcial" ? (
                        <span style={{ background: "#e3f2fd", color: "#1565c0", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>🔄 Parcial</span>
                      ) : (
                        <a href="/agricultura/remitos" onClick={(e) => e.stopPropagation()} style={{ background: "#fff3e0", color: "#e65100", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>⚠️ Sin remito</a>
                      )
                    ) : (
                      <span style={{ color: "#ddd", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 12 }}>
                      {pagadoCT > 0 && <div style={{ color: "#f59f00", fontWeight: 600 }}>CT: {facturaUSD ? `USD ${(pagadoCT / (g.dolar || 1)).toFixed(2)}` : `$${pagadoCT.toLocaleString("es-AR")}`}</div>}
                      {pagadoOC > 0 && <div style={{ color: "#0f1f17", fontWeight: 600 }}>OC: {facturaUSD ? `USD ${(pagadoOC / (g.dolar || 1)).toFixed(2)}` : `$${pagadoOC.toLocaleString("es-AR")}`}</div>}
                      {saldo > 0.01 && totalPagadoFactura > 0 && <div style={{ color: "#888" }}>Saldo: {facturaUSD ? `USD ${(saldo / (g.dolar || 1)).toFixed(2)}` : `$${saldo.toLocaleString("es-AR")}`}</div>}
                      {totalPagadoFactura === 0 && <span style={{ color: "#ccc" }}>—</span>}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={g.pagada || false} style={{ display: "none" }}
                          onChange={async (e) => {
                            e.stopPropagation();
                            if (!g.pagada) { abrirModalPago(g); }
                            else {
                              if (!confirm("¿Marcar como NO pagada?")) return;
                              await supabase.from("facturas").update({ pagada: false }).eq("id", g.id);
                              cargarDatos();
                            }
                          }}
                        />
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: g.pagada ? "#28a745" : "white" }}>
                          {g.pagada && <span style={{ color: "white", fontWeight: "bold", fontSize: 13 }}>✓</span>}
                        </div>
                      </label>
                      <button onClick={(e) => { e.stopPropagation(); abrirModalPago(g); }} style={{ fontSize: 10, padding: "2px 6px", background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 4, cursor: "pointer", color: "#2e7d32", fontWeight: 600 }}>+ Pago</button>
                    </div>
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>${g.Monto?.toLocaleString("es-AR")}</td>
                  <td style={{ ...td, color: "#888" }}>USD {Number(g.monto_usd || 0).toFixed(2)}</td>
                  <td style={td}>
                    {g.pdf_url ? (
                      <a href={g.pdf_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 6, color: "#0f1f17", fontWeight: 600, fontSize: 12, textDecoration: "none" }}>
                        📄 Ver PDF
                      </a>
                    ) : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(g.Labor_id || g.labores?.numero) && (
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("¿Desvincular la labor de esta factura?")) return;
                          await supabase.from("facturas").update({ Labor_id: null }).eq("id", g.id);
                          cargarDatos();
                        }} style={{ background: "#fff3e0", border: "1px solid #ffcc80", color: "#e65100", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          🔗 Desvincular labor
                        </button>
                      )}
                      {g.Tipo === "Insumos" && estadoRemito !== "sin_remito" && (
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("¿Desvincular el remito de esta factura?")) return;
                          await supabase.from("remitos").update({ factura_id: null }).eq("factura_id", g.id);
                          await supabase.from("stock_movimientos").update({ factura_id: null }).eq("factura_id", g.id);
                          cargarDatos();
                        }} style={{ background: "#fff3e0", border: "1px solid #ffcc80", color: "#e65100", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          🔗 Desvincular remito
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); eliminarGasto(g.id); }} style={{ background: "#fee", border: "1px solid #fcc", color: "red", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}