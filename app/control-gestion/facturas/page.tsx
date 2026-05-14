"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = "force-dynamic";

export default function Page() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [fecha, setFecha] = useState("");
  const [fechaVto, setFechaVto] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [numeroFactura, setNumeroFactura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagador, setPagador] = useState("");
  const [monto, setMonto] = useState("");
  const [actividad, setActividad] = useState("");
  const [actividades, setActividades] = useState<any[]>([]);
  const [labor, setLabor] = useState("");
  const [labores, setLabores] = useState<any[]>([]);
  const [dolar, setDolar] = useState<number | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("actividades").select(),
      supabase.from("proveedores").select("id, razon_social").eq("activo", true).order("razon_social"),
      supabase.from("labores").select(),
    ]).then(([{ data: acts }, { data: provs }, { data: labs }]) => {
      setActividades(acts || []);
      setProveedores(provs || []);
      setLabores(labs || []);
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
      setFecha(data.Fecha || ""); setFechaVto(data.Fecha_vencimiento || "");
      setProveedorId(data.proveedor_id || ""); setNumeroFactura(data.Numero_factura || "");
      setConcepto(data.Concepto || ""); setTipo(data.Tipo || ""); setPagador(data.Pagador || "");
      setMonto(data.Monto || ""); setActividad(data.Actividad_id || ""); setLabor(data.Labor_id || "");
      setDolar(data.dolar || null); setPdfUrl(data.pdf_url || null);
    });
  }, [id]);

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
    if (!fecha || !monto || !dolar) { alert("Completá los campos obligatorios"); return; }
    if (!proveedorId) { alert("Seleccioná un proveedor"); return; }

    const urlPdf = await subirPdf();
    const montoUSD = Number(monto) / dolar;
    const payload = {
      Fecha: fecha, Fecha_vencimiento: fechaVto || null, Numero_factura: numeroFactura,
      Concepto: concepto, Tipo: tipo, Pagador: pagador, Monto: Number(monto),
      monto_usd: montoUSD, dolar, Actividad_id: actividad, Labor_id: labor || null,
      pdf_url: urlPdf || null,
    };

    let error;
    if (id) {
      const { error: e } = await supabase.from("facturas").update(payload).eq("id", id);
      error = e;
    } else {
      const { error: e } = await supabase.from("facturas").insert([{ ...payload, proveedor_id: proveedorId }]);
      error = e;
    }

    if (error) { alert(error.message); return; }
    alert(`✅ ARS ${monto} | USD ${montoUSD.toFixed(2)}`);
    setFecha(""); setFechaVto(""); setProveedorId(""); setNumeroFactura(""); setConcepto("");
    setTipo(""); setPagador(""); setMonto(""); setActividad(""); setLabor(""); setDolar(null);
    setPdfFile(null); setPdfUrl(null);
  };

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", marginTop: 6, fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: 0.3 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{id ? "✏️ Editar Factura" : "Nueva Factura"}</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Complete los detalles para registrar el egreso.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 28 }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div><div style={lbl}>FECHA *</div><input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); obtenerDolarPorFecha(e.target.value).then(setDolar); }} style={input} /></div>
            <div><div style={lbl}>VENCIMIENTO</div><input type="date" value={fechaVto} onChange={(e) => setFechaVto(e.target.value)} style={input} /></div>
            <div>
              <div style={lbl}>PROVEEDOR *</div>
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={input}>
                <option value="">Seleccionar proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
            </div>
            <div><div style={lbl}>N° FACTURA</div><input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} style={input} /></div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={lbl}>CONCEPTO DETALLADO</div>
            <textarea value={concepto} onChange={(e) => setConcepto(e.target.value)} style={{ ...input, height: 80, resize: "vertical" }} placeholder="Describí los productos o servicios..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <div style={lbl}>ACTIVIDAD</div>
              <select value={actividad} onChange={(e) => setActividad(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                {actividades.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>LABOR</div>
              <select value={labor} onChange={(e) => setLabor(e.target.value)} style={input}>
                <option value="">Sin asociar</option>
                {labores.map((l) => <option key={l.id} value={l.id}>#{l.numero} - {l.Tipo}</option>)}
              </select>
            </div>
            <div>
              <div style={lbl}>TIPO</div>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                <option>Insumos</option><option>Servicios</option><option>Combustible</option>
              </select>
            </div>
            <div>
              <div style={lbl}>PAGADOR</div>
              <select value={pagador} onChange={(e) => setPagador(e.target.value)} style={input}>
                <option value="">Seleccionar</option>
                <option value="CT">CT</option><option value="OC">OC</option><option value="Sociedad">Sociedad</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div><div style={lbl}>MONTO ARS *</div><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={input} placeholder="0.00" /></div>
            <div><div style={lbl}>DÓLAR APLICADO</div><input type="number" value={dolar || ""} onChange={(e) => setDolar(Number(e.target.value))} style={input} /></div>
          </div>

          {monto && dolar && (
            <div style={{ marginBottom: 20, padding: "10px 16px", background: "#f0faf4", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
              ≈ USD {(Number(monto) / dolar).toFixed(2)}
            </div>
          )}

          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
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
  <button
    onClick={async () => {
      if (!confirm("¿Eliminar el PDF adjunto?")) return;
      const nombreArchivo = pdfUrl!.split("/").pop()!;
      await supabase.storage.from("facturas").remove([nombreArchivo]);
      await supabase.from("facturas").update({ pdf_url: null }).eq("id", id!);
      setPdfUrl(null);
    }}
    style={{ background: "none", border: "none", color: "red", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
  >
    🗑 Eliminar
  </button>
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
              {subiendo ? "Subiendo PDF..." : `💾 ${id ? "Guardar cambios" : "Registrar factura"}`}
            </button>
            <button onClick={() => window.history.back()} style={{ padding: "12px 24px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
              Cancelar
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Resumen</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>MONTO ARS</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>${Number(monto || 0).toLocaleString("es-AR")}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>MONTO USD</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f1f17" }}>USD {monto && dolar ? (Number(monto) / dolar).toFixed(2) : "0.00"}</div>
          </div>
          <div style={{ background: "#fff8e1", borderRadius: 12, padding: 16, fontSize: 13, color: "#7c5c00" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>💡 Tip</div>
            Verificá que el CUIT del proveedor coincida con AFIP antes de registrar el pago.
          </div>
        </div>
      </div>
    </div>
  );
}