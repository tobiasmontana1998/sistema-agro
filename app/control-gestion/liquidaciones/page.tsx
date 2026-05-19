"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ESPECIES = ["Soja", "Maíz", "Trigo", "Girasol", "Sorgo"];

export default function LiquidacionesPage() {
  const [vista, setVista] = useState<"lista" | "form">("lista");
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [corredoras, setCorredoras] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const [fecha, setFecha] = useState("");
  const [numeroLiq, setNumeroLiq] = useState("");
  const [corredoraId, setCorredoraId] = useState("");
  const [especie, setEspecie] = useState("");
  const [kilos, setKilos] = useState("");
  const [precioTonelada, setPrecioTonelada] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [dolar, setDolar] = useState<number | null>(null);
  const [comisiones, setComisiones] = useState("");
  const [gastos, setGastos] = useState("");
  const [ivaComisiones, setIvaComisiones] = useState("");
  const [alicuotaIva, setAlicuotaIva] = useState("10.5");
  const [loteId, setLoteId] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const montoBruto = Number(kilos) * Number(precioTonelada) / 1000;
  const totalComisiones = Number(comisiones || 0) + Number(gastos || 0) + Number(ivaComisiones || 0);
  const montoNeto = montoBruto - totalComisiones;
  const montoIva = montoNeto * (Number(alicuotaIva) / 100);
  const montoBrutoARS = moneda === "USD" && dolar ? montoBruto * dolar : montoBruto;
  const montoNetoARS = moneda === "USD" && dolar ? montoNeto * dolar : montoNeto;

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    if (!fecha) return;
    obtenerDolar(fecha).then(setDolar);
  }, [fecha]);

  const obtenerDolar = async (fecha: string) => {
    try {
      const res = await fetch("https://api.bluelytics.com.ar/v2/evolution.json");
      const data = await res.json();
      const fechaISO = new Date(fecha).toISOString().slice(0, 10);
      let encontrado = data.find((d: any) => d.date.startsWith(fechaISO));
      if (!encontrado) encontrado = data[data.length - 1];
      return (encontrado.value_buy + encontrado.value_sell) / 2;
    } catch { return null; }
  };

  const cargarDatos = async () => {
    const [{ data: liqData }, { data: lotesData }, { data: corredorasData }] = await Promise.all([
      supabase.from("liquidaciones_venta").select("*, lotes(nombre)").order("fecha", { ascending: false }),
      supabase.from("lotes").select(),
      supabase.from("proveedores").select("id, razon_social, cuit").in("tipo_proveedor", ["Corredora", "Acopiador"]).order("razon_social"),
    ]);
    setLiquidaciones(liqData || []);
    setLotes(lotesData || []);
    setCorredoras(corredorasData || []);
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setFecha(""); setNumeroLiq(""); setCorredoraId("");
    setEspecie(""); setKilos(""); setPrecioTonelada(""); setMoneda("USD");
    setDolar(null); setComisiones(""); setGastos(""); setIvaComisiones("");
    setAlicuotaIva("10.5"); setLoteId(""); setPdfUrl(null); setPdfFile(null);
    setVista("form");
  };

  const abrirEdicion = (l: any) => {
    setEditandoId(l.id);
    setFecha(l.fecha || "");
    setNumeroLiq(l.numero_liquidacion || "");
    const corredora = corredoras.find(c => c.cuit === l.corredora_cuit);
    setCorredoraId(corredora?.id || "");
    setEspecie(l.especie || "");
    setKilos(l.kilos?.toString() || "");
    setPrecioTonelada(l.precio_tonelada?.toString() || "");
    setMoneda(l.moneda || "USD");
    setDolar(l.dolar || null);
    setComisiones(l.comisiones?.toString() || "");
    setGastos(l.gastos?.toString() || "");
    setIvaComisiones(l.iva_comisiones?.toString() || "");
    setAlicuotaIva(l.alicuota_iva?.toString() || "10.5");
    setLoteId(l.lote_id || "");
    setPdfUrl(l.pdf_url || null);
    setPdfFile(null);
    setVista("form");
  };

  const subirPdf = async (): Promise<string | null> => {
    if (!pdfFile) return pdfUrl;
    setSubiendo(true);
    const nombreArchivo = `liq_${Date.now()}_${pdfFile.name.replace(/\s/g, "_")}`;
    const { error } = await supabase.storage.from("facturas").upload(nombreArchivo, pdfFile, { contentType: "application/pdf", upsert: true });
    setSubiendo(false);
    if (error) { alert("Error subiendo PDF: " + error.message); return null; }
    const { data } = supabase.storage.from("facturas").getPublicUrl(nombreArchivo);
    return data.publicUrl;
  };

  const guardar = async () => {
    if (!fecha || !especie || !kilos || !precioTonelada) { alert("Completá fecha, especie, kilos y precio"); return; }
    const urlPdf = await subirPdf();
    const corredora = corredoras.find(c => c.id === corredoraId);
    const payload = {
      fecha, numero_liquidacion: numeroLiq,
      corredora_cuit: corredora?.cuit || "",
      corredora_nombre: corredora?.razon_social || "",
      especie, kilos: Number(kilos), precio_tonelada: Number(precioTonelada),
      moneda, dolar,
      monto_bruto: montoBruto, comisiones: Number(comisiones || 0),
      gastos: Number(gastos || 0), iva_comisiones: Number(ivaComisiones || 0),
      monto_neto: montoNeto, monto_iva: montoIva,
      alicuota_iva: Number(alicuotaIva),
      lote_id: loteId || null, pdf_url: urlPdf || null,
    };
    let error;
    if (editandoId) {
      const { error: e } = await supabase.from("liquidaciones_venta").update(payload).eq("id", editandoId);
      error = e;
    } else {
      const { error: e } = await supabase.from("liquidaciones_venta").insert([payload]);
      error = e;
    }
    if (error) { alert(error.message); return; }
    await cargarDatos();
    setVista("lista");
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar liquidación?")) return;
    await supabase.from("liquidaciones_venta").delete().eq("id", id);
    await cargarDatos();
  };

  const exportarIVAVentasTXT = () => {
    const tipoComp = "011";
    const lineas = liquidaciones.map(l => {
      const fecha = l.fecha?.replace(/-/g, "");
      const cuitSinGuiones = (l.corredora_cuit || "").replace(/-/g, "");
      const nroLiq = (l.numero_liquidacion || "0000-00000000").split("-");
      const puntoVenta = (nroLiq[0] || "00000").padStart(5, "0");
      const nroComp = (nroLiq[1] || "00000000").padStart(8, "0");
      const monedaCod = l.moneda === "USD" ? "DOL" : "PES";
      const tipoCambio = l.moneda === "USD" ? Number(l.dolar || 1).toFixed(6) : "1.000000";
      return [
        fecha, tipoComp, puntoVenta, nroComp, "",
        "80", cuitSinGuiones, l.corredora_nombre || "",
        Number(l.monto_bruto || 0).toFixed(2), "0.00", "0.00",
        "0.00", "0.00", "0.00", "0.00", "0.00",
        monedaCod, tipoCambio, "1", "",
        Number(l.monto_iva || 0).toFixed(2), "0.00",
        "", "", "0.00",
      ].join(",");
    });
    const blob = new Blob([lineas.join("\n")], { type: "text/plain;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `IVA_Ventas_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };

  const totalVendido = liquidaciones.reduce((acc, l) => acc + (l.monto_neto || 0), 0);
  const totalKilos = liquidaciones.reduce((acc, l) => acc + (l.kilos || 0), 0);

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };
  const section: React.CSSProperties = { borderTop: "1px solid #f0f0f0", paddingTop: 20, marginTop: 20 };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#888", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #f0f0f0" };

  if (vista === "lista") return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Liquidaciones de Venta</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registro de ventas de granos.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={exportarIVAVentasTXT}
            style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e0e0e0", background: "white", color: "#0f1f17", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            📋 Exportar IVA Ventas ARCA
          </button>
          <button onClick={abrirNuevo}
            style={{ padding: "10px 20px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            + Nueva liquidación
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24, borderLeft: "4px solid #f5c542" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TOTAL VENDIDO (NETO)</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>USD {totalVendido.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{liquidaciones.length} liquidaciones</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TOTAL KILOS</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{totalKilos.toLocaleString("es-AR")} kg</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{(totalKilos / 1000).toFixed(1)} toneladas</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>LIQUIDACIONES COBRADAS</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{liquidaciones.filter(l => l.cobrada).length} / {liquidaciones.length}</div>
        </div>
      </div>

      {corredoras.length === 0 && (
        <div style={{ background: "#fff3e0", borderRadius: 12, padding: "14px 20px", marginBottom: 20, fontSize: 14, color: "#e65100" }}>
          ⚠️ No tenés corredoras cargadas — agregá una en <a href="/control-gestion/proveedores" style={{ color: "#e65100", fontWeight: 600 }}>Proveedores</a> con tipo "Corredora" o "Acopiador".
        </div>
      )}

      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #eee" }}>
              <th style={th}>FECHA</th>
              <th style={th}>N° LIQ.</th>
              <th style={th}>CORREDORA</th>
              <th style={th}>ESPECIE</th>
              <th style={th}>LOTE</th>
              <th style={th}>KILOS</th>
              <th style={th}>PRECIO/TON</th>
              <th style={th}>MONTO BRUTO</th>
              <th style={th}>MONTO NETO</th>
              <th style={th}>COBRADA</th>
              <th style={th}>PDF</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {liquidaciones.map((l) => (
              <tr key={l.id}
                onDoubleClick={() => abrirEdicion(l)}
                style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", backgroundColor: l.cobrada ? "#d4edda" : "white" }}
                onMouseEnter={(e) => { if (!l.cobrada) e.currentTarget.style.backgroundColor = "#f9f9f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = l.cobrada ? "#d4edda" : "white"; }}
              >
                <td style={td}>{l.fecha}</td>
                <td style={{ ...td, color: "#888" }}>{l.numero_liquidacion || "—"}</td>
                <td style={{ ...td, fontWeight: 600 }}>{l.corredora_nombre || "—"}</td>
                <td style={td}><span style={{ padding: "3px 10px", borderRadius: 20, background: "#fff8e1", fontSize: 12, fontWeight: 600 }}>{l.especie}</span></td>
                <td style={{ ...td, color: "#888" }}>{l.lotes?.nombre || "—"}</td>
                <td style={td}>{Number(l.kilos || 0).toLocaleString("es-AR")} kg</td>
                <td style={td}>{l.moneda} {Number(l.precio_tonelada || 0).toFixed(2)}/ton</td>
                <td style={{ ...td, fontWeight: 600 }}>{l.moneda} {Number(l.monto_bruto || 0).toFixed(2)}</td>
                <td style={{ ...td, fontWeight: 700, color: "#2e7d32" }}>{l.moneda} {Number(l.monto_neto || 0).toFixed(2)}</td>
                <td style={td}>
                  <div onClick={async (e) => { e.stopPropagation(); await supabase.from("liquidaciones_venta").update({ cobrada: !l.cobrada }).eq("id", l.id); cargarDatos(); }}
                    style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: l.cobrada ? "#28a745" : "white", cursor: "pointer" }}>
                    {l.cobrada && <span style={{ color: "white", fontWeight: "bold", fontSize: 13 }}>✓</span>}
                  </div>
                </td>
                <td style={td}>
                  {l.pdf_url ? (
                    <a href={l.pdf_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 6, color: "#0f1f17", fontWeight: 600, fontSize: 12, textDecoration: "none" }}>
                      📄 Ver
                    </a>
                  ) : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>}
                </td>
                <td style={td}>
                  <button onClick={(e) => { e.stopPropagation(); eliminar(l.id); }}
                    style={{ background: "#fee", border: "1px solid #fcc", color: "red", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🗑</button>
                </td>
              </tr>
            ))}
            {liquidaciones.length === 0 && (
              <tr><td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#bbb" }}>Sin liquidaciones — cargá la primera</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => setVista("lista")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888" }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{editandoId ? "✏️ Editar Liquidación" : "Nueva Liquidación"}</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registrá la venta de granos.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28 }}>

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📋 Datos de la liquidación</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div><div style={lbl}>FECHA *</div><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} /></div>
            <div><div style={lbl}>N° LIQUIDACIÓN</div><input value={numeroLiq} onChange={(e) => setNumeroLiq(e.target.value)} style={input} placeholder="0001-00000001" /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lbl}>CORREDORA / ACOPIADOR</div>
              <select value={corredoraId} onChange={(e) => setCorredoraId(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                {corredoras.map(c => <option key={c.id} value={c.id}>{c.razon_social} — {c.cuit}</option>)}
              </select>
              {corredoras.length === 0 && (
                <div style={{ fontSize: 12, color: "#e65100", marginTop: 6 }}>
                  ⚠️ No hay corredoras — agregá en <a href="/control-gestion/proveedores" style={{ color: "#e65100" }}>Proveedores</a> con tipo "Corredora"
                </div>
              )}
            </div>
            <div>
              <div style={lbl}>ESPECIE *</div>
              <select value={especie} onChange={(e) => setEspecie(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                {ESPECIES.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>LOTE</div>
              <select value={loteId} onChange={(e) => setLoteId(e.target.value)} style={input}>
                <option value="">Sin asignar</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
          </div>

          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>⚖️ Volumen y precio</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div><div style={lbl}>KILOS *</div><input type="number" value={kilos} onChange={(e) => setKilos(e.target.value)} style={input} placeholder="0" /></div>
              <div><div style={lbl}>PRECIO / TONELADA *</div><input type="number" value={precioTonelada} onChange={(e) => setPrecioTonelada(e.target.value)} style={input} placeholder="0.00" /></div>
              <div>
                <div style={lbl}>MONEDA</div>
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={input}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div>
                <div style={lbl}>TIPO DE CAMBIO</div>
                <input type="number" value={dolar || ""} onChange={(e) => setDolar(Number(e.target.value))} style={input} placeholder="Auto" />
              </div>
            </div>
            {kilos && precioTonelada && (
              <div style={{ marginTop: 12, background: "#f0faf4", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600 }}>
                Monto bruto: {moneda} {montoBruto.toFixed(2)}
                {moneda === "USD" && dolar && <span style={{ color: "#888", marginLeft: 12, fontWeight: 400 }}>= ARS ${montoBrutoARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>}
              </div>
            )}
          </div>

          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📉 Descuentos y gastos</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div><div style={lbl}>COMISIONES</div><input type="number" value={comisiones} onChange={(e) => setComisiones(e.target.value)} style={input} placeholder="0.00" /></div>
              <div><div style={lbl}>GASTOS</div><input type="number" value={gastos} onChange={(e) => setGastos(e.target.value)} style={input} placeholder="0.00" /></div>
              <div><div style={lbl}>IVA COMISIONES</div><input type="number" value={ivaComisiones} onChange={(e) => setIvaComisiones(e.target.value)} style={input} placeholder="0.00" /></div>
            </div>
          </div>

          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>💰 IVA de la venta</div>
            <div>
              <div style={lbl}>ALÍCUOTA IVA</div>
              <select value={alicuotaIva} onChange={(e) => setAlicuotaIva(e.target.value)} style={input}>
                <option value="0">0% (Exento)</option>
                <option value="10.5">10.5%</option>
                <option value="21">21%</option>
              </select>
            </div>
            {kilos && precioTonelada && (
              <div style={{ marginTop: 12, background: "#f8f9fa", borderRadius: 8, padding: 16, fontSize: 13 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ color: "#888" }}>Monto bruto:</div>
                  <div style={{ fontWeight: 600, textAlign: "right" }}>{moneda} {montoBruto.toFixed(2)}</div>
                  <div style={{ color: "#888" }}>Descuentos y gastos:</div>
                  <div style={{ fontWeight: 600, textAlign: "right", color: "red" }}>- {moneda} {totalComisiones.toFixed(2)}</div>
                  <div style={{ color: "#888" }}>Monto neto:</div>
                  <div style={{ fontWeight: 600, textAlign: "right" }}>{moneda} {montoNeto.toFixed(2)}</div>
                  <div style={{ color: "#888" }}>IVA ({alicuotaIva}%):</div>
                  <div style={{ fontWeight: 600, textAlign: "right" }}>{moneda} {montoIva.toFixed(2)}</div>
                  <div style={{ borderTop: "1px solid #ddd", paddingTop: 8, fontWeight: 700 }}>TOTAL A COBRAR:</div>
                  <div style={{ borderTop: "1px solid #ddd", paddingTop: 8, fontWeight: 800, textAlign: "right", fontSize: 15 }}>{moneda} {(montoNeto + montoIva).toFixed(2)}</div>
                  {moneda === "USD" && dolar && (
                    <>
                      <div style={{ color: "#888" }}>Equivalente ARS:</div>
                      <div style={{ fontWeight: 600, textAlign: "right" }}>${montoNetoARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={section}>
            <div style={lbl}>ADJUNTAR LIQUIDACIÓN PDF</div>
            <div style={{ marginTop: 8 }}>
              {pdfUrl && !pdfFile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 14px", background: "#f0faf4", borderRadius: 8 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>PDF adjunto</div></div>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0f1f17", fontWeight: 600, textDecoration: "none" }}>Ver →</a>
                </div>
              )}
              {pdfFile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 14px", background: "#fff8e1", borderRadius: 8 }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{pdfFile.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{(pdfFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button onClick={() => setPdfFile(null)} style={{ background: "none", border: "none", color: "red", cursor: "pointer" }}>✕</button>
                </div>
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#f5f5f5", border: "1px dashed #ccc", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                📎 {pdfFile ? "Cambiar PDF" : "Seleccionar PDF"}
                <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) setPdfFile(e.target.files[0]); }} />
              </label>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button onClick={guardar} disabled={subiendo}
              style={{ padding: "12px 24px", background: subiendo ? "#888" : "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              {subiendo ? "Subiendo PDF..." : `💾 ${editandoId ? "Guardar cambios" : "Registrar liquidación"}`}
            </button>
            <button onClick={() => setVista("lista")} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
              Cancelar
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Resumen</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>MONTO BRUTO</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{moneda} {montoBruto.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>MONTO NETO</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#2e7d32", marginBottom: 8 }}>{moneda} {montoNeto.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>IVA</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{moneda} {montoIva.toFixed(2)}</div>
          </div>
          <div style={{ background: "#f0faf4", borderRadius: 12, padding: 16, fontSize: 13, color: "#2e7d32" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>💡 IVA granos</div>
            Para granos la alícuota es 10.5%. Las comisiones de corredores tienen 21%.
          </div>
        </div>
      </div>
    </div>
  );
}