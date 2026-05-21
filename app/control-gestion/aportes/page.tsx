"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AportesPage() {
  const [aportes, setAportes] = useState<any[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [socio, setSocio] = useState("OC");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("ARS");
  const [dolar, setDolar] = useState<number | null>(null);
  const [concepto, setConcepto] = useState("");

  useEffect(() => { cargarAportes(); }, []);

  useEffect(() => {
    if (!fecha) return;
    obtenerDolarPorFecha(fecha).then(setDolar);
  }, [fecha]);

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

  const cargarAportes = async () => {
    const { data } = await supabase.from("aportes").select("*").order("fecha", { ascending: false });
    setAportes(data || []);
  };

  const guardarAporte = async () => {
    if (!fecha || !monto) { alert("Completá fecha y monto"); return; }
    if (!dolar) { alert("Esperá que cargue el tipo de cambio"); return; }

    const montoNum = Number(monto);
    const montoARS = moneda === "USD" ? montoNum * dolar : montoNum;
    const montoUSD = moneda === "USD" ? montoNum : montoNum / dolar;

    const { error } = await supabase.from("aportes").insert([{
      fecha, socio,
      monto: montoARS,
      monto_usd: montoUSD,
      dolar,
      moneda,
      concepto,
    }]);
    if (error) { alert("Error: " + error.message); return; }
    setMonto(""); setConcepto("");
    cargarAportes();
  };

  const eliminarAporte = async (id: string) => {
    if (!confirm("¿Eliminar este aporte?")) return;
    await supabase.from("aportes").delete().eq("id", id);
    cargarAportes();
  };

  const totalOC_USD = aportes.filter(a => a.socio === "OC").reduce((acc, a) => acc + Number(a.monto_usd || 0), 0);
  const totalCT_USD = aportes.filter(a => a.socio === "CT").reduce((acc, a) => acc + Number(a.monto_usd || 0), 0);
  const totalUSD = totalOC_USD + totalCT_USD;
  const totalOC_ARS = aportes.filter(a => a.socio === "OC").reduce((acc, a) => acc + Number(a.monto || 0), 0);
  const totalCT_ARS = aportes.filter(a => a.socio === "CT").reduce((acc, a) => acc + Number(a.monto || 0), 0);
  const totalARS = totalOC_ARS + totalCT_ARS;

  const montoIngresado = Number(monto) || 0;
  const montoARS = moneda === "USD" ? montoIngresado * (dolar || 1) : montoIngresado;
  const montoUSD = moneda === "USD" ? montoIngresado : montoIngresado / (dolar || 1);

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" };
  const card: React.CSSProperties = { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>💰 Aportes de Capital</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Registrá los aportes de cada socio.</p>
      </div>

      {/* MÉTRICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ ...card, borderLeft: "4px solid #0f1f17" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TOTAL APORTES</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>USD {totalUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>${totalARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS</div>
        </div>
        <div style={{ ...card, borderLeft: "4px solid #f5c542" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>OC</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>USD {totalOC_USD.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>${totalOC_ARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{totalUSD > 0 ? ((totalOC_USD / totalUSD) * 100).toFixed(1) : 0}% del total</div>
        </div>
        <div style={{ ...card, borderLeft: "4px solid #2e7d32" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>CT</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>USD {totalCT_USD.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>${totalCT_ARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{totalUSD > 0 ? ((totalCT_USD / totalUSD) * 100).toFixed(1) : 0}% del total</div>
        </div>
      </div>

      {/* FORMULARIO */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>➕ Registrar aporte</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 16, alignItems: "end" }}>
          <div>
            <label style={lbl}>FECHA</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} />
          </div>
          <div>
            <label style={lbl}>SOCIO</label>
            <select value={socio} onChange={(e) => setSocio(e.target.value)} style={input}>
              <option value="OC">OC</option>
              <option value="CT">CT</option>
            </select>
          </div>
          <div>
            <label style={lbl}>MONEDA</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={input}>
              <option value="ARS">$ Pesos</option>
              <option value="USD">U$D Dólares</option>
            </select>
          </div>
          <div>
            <label style={lbl}>MONTO</label>
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={input} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>CONCEPTO</label>
            <input value={concepto} onChange={(e) => setConcepto(e.target.value)} style={input} placeholder="Opcional" />
          </div>
        </div>

        {monto && dolar && (
          <div style={{ marginTop: 12, background: "#f8f9fa", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
            <span style={{ color: "#888" }}>Tipo de cambio: </span><strong>${dolar.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</strong>
            <span style={{ marginLeft: 16, color: "#888" }}>Equivale a: </span>
            {moneda === "ARS"
              ? <strong>USD {montoUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
              : <strong>${montoARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS</strong>}
          </div>
        )}

        <button onClick={guardarAporte} style={{ marginTop: 16, padding: "10px 24px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          💾 Registrar aporte
        </button>
      </div>

      {/* TABLA */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Historial de aportes</div>
        {aportes.length === 0 ? (
          <p style={{ color: "#999" }}>No hay aportes registrados.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #eee" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#888", fontWeight: 600 }}>FECHA</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#888", fontWeight: 600 }}>SOCIO</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#888", fontWeight: 600 }}>MONTO ARS</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#888", fontWeight: 600 }}>MONTO USD</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#888", fontWeight: 600 }}>TC</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, color: "#888", fontWeight: 600 }}>CONCEPTO</th>
                <th style={{ padding: "10px 14px" }}></th>
              </tr>
            </thead>
            <tbody>
              {aportes.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{a.fecha}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>
                    <span style={{ background: a.socio === "OC" ? "#fff8e1" : "#e8f5e9", color: a.socio === "OC" ? "#f59f00" : "#2e7d32", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {a.socio}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>${Number(a.monto || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>USD {Number(a.monto_usd || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>${Number(a.dolar || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#888" }}>{a.concepto || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => eliminarAporte(a.id)} style={{ background: "#fee", border: "1px solid #fcc", color: "red", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}