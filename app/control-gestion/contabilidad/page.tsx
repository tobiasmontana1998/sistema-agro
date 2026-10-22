"use client";

// ════════════════════════════════════════════════════════════════════════════
// CONTABILIDAD DE GESTIÓN
// ----------------------------------------------------------------------------
// Los asientos NO se cargan acá: los genera la base de datos sola (triggers en
// supabase/migrations/20261013_contabilidad.sql) cada vez que se guarda una
// factura, un pago o un aporte. Esta pantalla solo los muestra y permite:
//   - Sumas y saldos  (lo que más le sirve a la contadora)
//   - Libro diario
//   - Mayor por cuenta
//   - A clasificar    (facturas que cayeron en "Gastos a clasificar")
//   - Plan de cuentas
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Cuenta = { id: string; codigo: string; nombre: string; tipo: string; imputable: boolean; activa: boolean };
type Linea = {
  id: string; cuenta_id: string; debe: number; haber: number;
  debe_usd: number | null; haber_usd: number | null; detalle: string | null;
  lote_id: string | null; actividad_id: string | null;
};
type Asiento = {
  id: string; numero: number; fecha: string; descripcion: string;
  origen_tipo: string; origen_id: string; asiento_lineas: Linea[];
};
type FilaSaldo = {
  cuenta_id: string; codigo: string; nombre: string; tipo: string;
  debe: number; haber: number; saldo: number; debe_usd: number; haber_usd: number; saldo_usd: number;
};

type Tab = "saldos" | "diario" | "mayor" | "clasificar" | "plan" | "apertura";

const CODIGO_A_CLASIFICAR = "5.9.01";

const TIPOS_CUENTA: Record<string, string> = {
  activo: "Activo", pasivo: "Pasivo", patrimonio: "Patrimonio neto", ingreso: "Ingresos", egreso: "Egresos",
};

const fmt = (n: number) =>
  (n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const descargarCSV = (nombre: string, filas: (string | number)[][]) => {
  const csv = filas
    .map((f) => f.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// Para CSV: número con coma decimal, que es lo que espera el Excel en es-AR.
const num = (n: number) => (n || 0).toFixed(2).replace(".", ",");

const diaAnterior = (fecha: string) => {
  const d = new Date(fecha + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function Contabilidad() {
  const [tab, setTab] = useState<Tab>("saldos");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [saldos, setSaldos] = useState<FilaSaldo[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [errores, setErrores] = useState<any[]>([]);
  const [desbalanceados, setDesbalanceados] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);

  // Mayor
  const [cuentaMayor, setCuentaMayor] = useState("");
  const [movMayor, setMovMayor] = useState<any[]>([]);
  const [saldoInicialMayor, setSaldoInicialMayor] = useState(0);

  // A clasificar
  const [aClasificar, setAClasificar] = useState<any[]>([]);
  const [eleccion, setEleccion] = useState<Record<string, { cuenta: string; todoElProveedor: boolean }>>({});

  // Ajuste de apertura (saldos reales de banco y proveedores a una fecha)
  const [apertura, setApertura] = useState({ fecha: "2026-09-30", banco: "", proveedores: "" });
  const [aperturaGuardada, setAperturaGuardada] = useState<any>(null);
  const [asientoApertura, setAsientoApertura] = useState<Asiento | null>(null);

  // Plan de cuentas (alta)
  const [nuevaCuenta, setNuevaCuenta] = useState({ codigo: "", nombre: "", tipo: "egreso", imputable: true });

  const enUSD = moneda === "USD";
  const cuentaPorId = useMemo(() => Object.fromEntries(cuentas.map((c) => [c.id, c])), [cuentas]);
  const cuentasImputables = useMemo(() => cuentas.filter((c) => c.imputable && c.activa), [cuentas]);

  // ── CARGA ─────────────────────────────────────────────────────────────────
  const cargarCuentas = async () => {
    const { data } = await supabase.from("cuentas").select("*").order("codigo");
    setCuentas(data || []);
    return data || [];
  };

  const cargarSaldos = async () => {
    const { data, error } = await supabase.rpc("contab_sumas_saldos", {
      p_desde: desde || null, p_hasta: hasta || null,
    });
    if (error) { alert("Error cargando saldos: " + error.message); return; }
    setSaldos((data || []).map((r: any) => ({
      ...r,
      debe: Number(r.debe), haber: Number(r.haber), saldo: Number(r.saldo),
      debe_usd: Number(r.debe_usd), haber_usd: Number(r.haber_usd), saldo_usd: Number(r.saldo_usd),
    })));
  };

  const cargarDiario = async () => {
    let q = supabase
      .from("asientos")
      .select("id, numero, fecha, descripcion, origen_tipo, origen_id, asiento_lineas(id, cuenta_id, debe, haber, debe_usd, haber_usd, detalle, lote_id, actividad_id)")
      .order("fecha", { ascending: true })
      .order("numero", { ascending: true })
      .limit(2000);
    if (desde) q = q.gte("fecha", desde);
    if (hasta) q = q.lte("fecha", hasta);
    const { data, error } = await q;
    if (error) { alert("Error cargando diario: " + error.message); return; }
    setAsientos((data || []) as any);
  };

  const cargarControles = async () => {
    const [{ data: errs }, { data: desb }] = await Promise.all([
      supabase.from("asientos_errores").select("*").order("created_at", { ascending: false }),
      supabase.from("contab_desbalanceados").select("*"),
    ]);
    setErrores(errs || []);
    setDesbalanceados(desb || []);
  };

  const cargarMayor = async (cuentaId: string) => {
    if (!cuentaId) { setMovMayor([]); setSaldoInicialMayor(0); return; }
    let q = supabase
      .from("asiento_lineas")
      .select("id, debe, haber, debe_usd, haber_usd, detalle, asientos!inner(numero, fecha, descripcion, origen_tipo, origen_id)")
      .eq("cuenta_id", cuentaId)
      .limit(5000);
    if (desde) q = q.gte("asientos.fecha", desde);
    if (hasta) q = q.lte("asientos.fecha", hasta);
    const { data, error } = await q;
    if (error) { alert("Error cargando mayor: " + error.message); return; }
    const movs = (data || []).sort((a: any, b: any) =>
      a.asientos.fecha === b.asientos.fecha ? a.asientos.numero - b.asientos.numero : a.asientos.fecha.localeCompare(b.asientos.fecha));
    setMovMayor(movs);

    // Saldo inicial = todo lo anterior a "desde"
    if (desde) {
      const { data: previo } = await supabase.rpc("contab_sumas_saldos", { p_desde: null, p_hasta: diaAnterior(desde) });
      const fila = (previo || []).find((r: any) => r.cuenta_id === cuentaId);
      setSaldoInicialMayor(fila ? Number(enUSD ? fila.saldo_usd : fila.saldo) : 0);
    } else {
      setSaldoInicialMayor(0);
    }
  };

  const cargarAClasificar = async (lista: Cuenta[]) => {
    const cta = lista.find((c) => c.codigo === CODIGO_A_CLASIFICAR);
    if (!cta) { setAClasificar([]); return; }
    const { data: lineas } = await supabase
      .from("asiento_lineas")
      .select("debe, haber, asientos!inner(origen_tipo, origen_id, fecha)")
      .eq("cuenta_id", cta.id)
      .eq("asientos.origen_tipo", "factura");
    const ids = [...new Set((lineas || []).map((l: any) => l.asientos.origen_id))];
    if (ids.length === 0) { setAClasificar([]); return; }
    const { data: facturas } = await supabase
      .from("facturas")
      .select("id, Fecha, Numero_factura, Concepto, Tipo, tipo_comprobante, Monto, monto_neto, no_gravado, dolar, moneda, proveedor_id, proveedores(razon_social)")
      .in("id", ids)
      .order("Fecha", { ascending: false });
    setAClasificar(facturas || []);
  };

  const cargarApertura = async () => {
    const [{ data: ap }, { data: as }] = await Promise.all([
      supabase.from("contab_apertura").select("*").maybeSingle(),
      supabase.from("asientos")
        .select("id, numero, fecha, descripcion, origen_tipo, origen_id, asiento_lineas(id, cuenta_id, debe, haber, debe_usd, haber_usd, detalle, lote_id, actividad_id)")
        .eq("origen_tipo", "apertura").maybeSingle(),
    ]);
    setAperturaGuardada(ap || null);
    setAsientoApertura((as as any) || null);
    if (ap) setApertura({ fecha: ap.fecha, banco: String(ap.banco_real), proveedores: ap.proveedores_real == null ? "" : String(ap.proveedores_real) });
  };

  const guardarApertura = async () => {
    if (!apertura.fecha || apertura.banco === "") { alert("Completá la fecha y el saldo real del banco"); return; }
    const { error } = await supabase.rpc("contab_set_apertura", {
      p_fecha: apertura.fecha,
      p_banco_real: Number(apertura.banco),
      p_proveedores_real: apertura.proveedores === "" ? null : Number(apertura.proveedores),
    });
    if (error) { alert("Error: " + error.message); return; }
    alert("✅ Ajuste de apertura guardado");
    cargarTodo();
  };

  const borrarApertura = async () => {
    if (!confirm("¿Borrar el ajuste de apertura? Bancos y Proveedores vuelven a mostrar lo que surge de los comprobantes.")) return;
    const { error } = await supabase.rpc("contab_borrar_apertura");
    if (error) { alert("Error: " + error.message); return; }
    cargarTodo();
  };

  const cargarTodo = async () => {
    setCargando(true);
    const lista = await cargarCuentas();
    await Promise.all([cargarSaldos(), cargarDiario(), cargarControles(), cargarAClasificar(lista), cargarApertura()]);
    if (cuentaMayor) await cargarMayor(cuentaMayor);
    setCargando(false);
  };

  useEffect(() => { cargarTodo(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [desde, hasta]);
  useEffect(() => { cargarMayor(cuentaMayor); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cuentaMayor, moneda]);

  // ── ACCIONES ──────────────────────────────────────────────────────────────
  const regenerar = async () => {
    if (!confirm("¿Regenerar todos los asientos desde facturas, pagos y aportes?")) return;
    setRegenerando(true);
    const { data, error } = await supabase.rpc("contab_regenerar_todo");
    setRegenerando(false);
    if (error) { alert("Error: " + error.message); return; }
    alert(`✅ Asientos generados: ${data?.generados ?? "?"} — Errores: ${data?.errores ?? 0}`);
    cargarTodo();
  };

  const clasificar = async (factura: any) => {
    const sel = eleccion[factura.id];
    if (!sel?.cuenta) { alert("Elegí una cuenta"); return; }
    // El trigger de la base regenera el asiento solo al cambiar cuenta_id.
    if (sel.todoElProveedor && factura.proveedor_id) {
      const { error } = await supabase.from("proveedores").update({ cuenta_id: sel.cuenta }).eq("id", factura.proveedor_id);
      if (error) { alert("Error: " + error.message); return; }
    } else {
      const { error } = await supabase.from("facturas").update({ cuenta_id: sel.cuenta }).eq("id", factura.id);
      if (error) { alert("Error: " + error.message); return; }
    }
    cargarTodo();
  };

  const crearCuenta = async () => {
    const { codigo, nombre, tipo, imputable } = nuevaCuenta;
    if (!codigo.trim() || !nombre.trim()) { alert("Completá código y nombre"); return; }
    const { error } = await supabase.from("cuentas").insert([{ codigo: codigo.trim(), nombre: nombre.trim(), tipo, imputable }]);
    if (error) { alert("Error: " + error.message); return; }
    setNuevaCuenta({ codigo: "", nombre: "", tipo: "egreso", imputable: true });
    cargarCuentas();
  };

  const toggleActiva = async (c: Cuenta) => {
    await supabase.from("cuentas").update({ activa: !c.activa }).eq("id", c.id);
    cargarCuentas();
  };

  // ── DERIVADOS ─────────────────────────────────────────────────────────────
  const saldosPorTipo = useMemo(() => {
    const grupos: Record<string, FilaSaldo[]> = {};
    saldos.forEach((s) => { (grupos[s.tipo] ||= []).push(s); });
    return grupos;
  }, [saldos]);

  const totalesSaldos = useMemo(() => saldos.reduce(
    (acc, s) => ({
      debe: acc.debe + (enUSD ? s.debe_usd : s.debe),
      haber: acc.haber + (enUSD ? s.haber_usd : s.haber),
    }), { debe: 0, haber: 0 }), [saldos, enUSD]);

  // Resultado del período = ingresos - egresos (saldo de ingresos es acreedor → negativo)
  const resultado = useMemo(() => -saldos
    .filter((s) => s.tipo === "ingreso" || s.tipo === "egreso")
    .reduce((acc, s) => acc + (enUSD ? s.saldo_usd : s.saldo), 0), [saldos, enUSD]);

  // ── EXPORTACIONES ─────────────────────────────────────────────────────────
  const rango = `${desde || "inicio"}_${hasta || "hoy"}`;

  const exportarSaldos = () => {
    descargarCSV(`sumas_y_saldos_${rango}.csv`, [
      ["Código", "Cuenta", "Tipo", "Debe ARS", "Haber ARS", "Saldo ARS", "Debe USD", "Haber USD", "Saldo USD"],
      ...saldos.map((s) => [s.codigo, s.nombre, TIPOS_CUENTA[s.tipo] || s.tipo,
        num(s.debe), num(s.haber), num(s.saldo), num(s.debe_usd), num(s.haber_usd), num(s.saldo_usd)]),
    ]);
  };

  const exportarDiario = () => {
    const filas: (string | number)[][] = [["N° asiento", "Fecha", "Descripción", "Código", "Cuenta", "Detalle", "Debe ARS", "Haber ARS", "Debe USD", "Haber USD", "Origen"]];
    asientos.forEach((a) => a.asiento_lineas.forEach((l) => {
      const c = cuentaPorId[l.cuenta_id];
      filas.push([a.numero, a.fecha, a.descripcion, c?.codigo || "", c?.nombre || "", l.detalle || "",
        num(l.debe), num(l.haber), num(l.debe_usd || 0), num(l.haber_usd || 0), a.origen_tipo]);
    }));
    descargarCSV(`libro_diario_${rango}.csv`, filas);
  };

  const exportarMayor = () => {
    const c = cuentaPorId[cuentaMayor];
    let saldo = saldoInicialMayor;
    const filas: (string | number)[][] = [["Fecha", "N° asiento", "Descripción", "Detalle", "Debe", "Haber", "Saldo"], ["", "", "Saldo inicial", "", "", "", num(saldo)]];
    movMayor.forEach((m) => {
      const d = Number(enUSD ? m.debe_usd || 0 : m.debe), h = Number(enUSD ? m.haber_usd || 0 : m.haber);
      saldo += d - h;
      filas.push([m.asientos.fecha, m.asientos.numero, m.asientos.descripcion, m.detalle || "", num(d), num(h), num(saldo)]);
    });
    descargarCSV(`mayor_${c?.codigo || "cuenta"}_${moneda}_${rango}.csv`, filas);
  };

  // ── ESTILOS ───────────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20 };
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap", borderBottom: "2px solid #eee" };
  const thR: React.CSSProperties = { ...th, textAlign: "right" };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f3f3f3" };
  const tdR: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const input: React.CSSProperties = { padding: "9px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 };
  const btn: React.CSSProperties = { padding: "9px 16px", borderRadius: 8, border: "1px solid #e0e0e0", background: "white", color: "#0f1f17", cursor: "pointer", fontWeight: 600, fontSize: 13 };
  const btnDark: React.CSSProperties = { ...btn, background: "#0f1f17", color: "white", border: "none" };
  const tabBtn = (t: Tab): React.CSSProperties => ({
    padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
    background: tab === t ? "#0f1f17" : "transparent", color: tab === t ? "white" : "#555",
  });

  const simbolo = enUSD ? "U$S " : "$";

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Contabilidad</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>
            Asientos automáticos de facturas, pagos y aportes. Contabilidad de gestión — no reemplaza la legal.
          </p>
        </div>
        <button onClick={regenerar} disabled={regenerando} style={btn}>
          {regenerando ? "Regenerando…" : "🔄 Regenerar asientos"}
        </button>
      </div>

      {/* CONTROLES (errores / desbalanceados) */}
      {(errores.length > 0 || desbalanceados.length > 0) && (
        <div style={{ ...card, background: "#fff3e0", marginBottom: 16, padding: 14 }}>
          {errores.length > 0 && (
            <div style={{ fontSize: 13, color: "#e65100", marginBottom: desbalanceados.length ? 8 : 0 }}>
              <strong>⚠️ {errores.length} comprobante{errores.length > 1 ? "s" : ""} sin asiento</strong>
              {errores.slice(0, 5).map((e) => (
                <div key={e.id} style={{ marginLeft: 8, fontSize: 12 }}>• {e.origen_tipo} {e.origen_id.slice(0, 8)}…: {e.error}</div>
              ))}
            </div>
          )}
          {desbalanceados.length > 0 && (
            <div style={{ fontSize: 13, color: "#c62828" }}>
              <strong>❌ {desbalanceados.length} asiento{desbalanceados.length > 1 ? "s" : ""} no balancea{desbalanceados.length > 1 ? "n" : ""}</strong>
              {desbalanceados.slice(0, 5).map((d) => (
                <div key={d.id} style={{ marginLeft: 8, fontSize: 12 }}>• N° {d.numero} {d.descripcion}: debe {fmt(d.debe)} / haber {fmt(d.haber)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 10, padding: 3, gap: 2 }}>
          <button style={tabBtn("saldos")} onClick={() => setTab("saldos")}>Sumas y saldos</button>
          <button style={tabBtn("diario")} onClick={() => setTab("diario")}>Libro diario</button>
          <button style={tabBtn("mayor")} onClick={() => setTab("mayor")}>Mayor</button>
          <button style={tabBtn("clasificar")} onClick={() => setTab("clasificar")}>
            A clasificar {aClasificar.length > 0 && <span style={{ background: "#e65100", color: "white", borderRadius: 10, padding: "1px 7px", marginLeft: 4, fontSize: 11 }}>{aClasificar.length}</span>}
          </button>
          <button style={tabBtn("plan")} onClick={() => setTab("plan")}>Plan de cuentas</button>
          <button style={tabBtn("apertura")} onClick={() => setTab("apertura")}>Apertura</button>
        </div>
        {tab !== "plan" && tab !== "clasificar" && tab !== "apertura" && (
          <>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={input} />
            <span style={{ color: "#888" }}>→</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={input} />
            <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 8, padding: 3 }}>
              {(["ARS", "USD"] as const).map((m) => (
                <button key={m} onClick={() => setMoneda(m)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: moneda === m ? "white" : "transparent", color: moneda === m ? "#0f1f17" : "#888" }}>{m}</button>
              ))}
            </div>
          </>
        )}
        {cargando && <span style={{ fontSize: 13, color: "#888" }}>Cargando…</span>}
      </div>

      {/* ── SUMAS Y SALDOS ──────────────────────────────────────────────── */}
      {tab === "saldos" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "#555" }}>
              Resultado del período (ingresos − egresos):{" "}
              <strong style={{ color: resultado >= 0 ? "#2e7d32" : "#c62828" }}>{simbolo}{fmt(resultado)}</strong>
            </div>
            <button onClick={exportarSaldos} style={btnDark}>⬇ Exportar CSV</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>CÓDIGO</th><th style={th}>CUENTA</th>
                <th style={thR}>DEBE</th><th style={thR}>HABER</th><th style={thR}>SALDO</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(TIPOS_CUENTA).filter((t) => saldosPorTipo[t]).map((t) => (
                <FragmentoTipo key={t} titulo={TIPOS_CUENTA[t]} filas={saldosPorTipo[t]} enUSD={enUSD} td={td} tdR={tdR}
                  onClickCuenta={(id) => { setCuentaMayor(id); setTab("mayor"); }} />
              ))}
              <tr style={{ background: "#f8f9fa", fontWeight: 700 }}>
                <td style={td} colSpan={2}>TOTALES</td>
                <td style={tdR}>{fmt(totalesSaldos.debe)}</td>
                <td style={tdR}>{fmt(totalesSaldos.haber)}</td>
                <td style={tdR}>{fmt(totalesSaldos.debe - totalesSaldos.haber)}</td>
              </tr>
            </tbody>
          </table>
          {saldos.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 14 }}>Sin movimientos en el período.</div>}
          <p style={{ fontSize: 11, color: "#999", marginTop: 12 }}>
            Saldo positivo = deudor (activo / egreso). Negativo = acreedor (pasivo / patrimonio / ingreso).
            {enUSD && " Los importes en USD son informativos (convertidos al tipo de cambio de cada comprobante) y pueden no cerrar al centavo."}
            {" "}Hacé clic en una cuenta para ver su mayor.
          </p>
        </div>
      )}

      {/* ── LIBRO DIARIO ────────────────────────────────────────────────── */}
      {tab === "diario" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#888" }}>{asientos.length} asientos{asientos.length >= 2000 ? " (se muestran los primeros 2000: acotá las fechas)" : ""}</span>
            <button onClick={exportarDiario} style={btnDark}>⬇ Exportar CSV</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>N°</th><th style={th}>FECHA</th><th style={th}>CUENTA</th><th style={th}>DETALLE</th>
                <th style={thR}>DEBE</th><th style={thR}>HABER</th>
              </tr>
            </thead>
            <tbody>
              {asientos.map((a) => (
                <AsientoFilas key={a.id} a={a} cuentaPorId={cuentaPorId} enUSD={enUSD} td={td} tdR={tdR} cuentas={cuentasImputables} onReclasificado={cargarTodo} />
              ))}
            </tbody>
          </table>
          {asientos.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 14 }}>Sin asientos en el período.</div>}
        </div>
      )}

      {/* ── MAYOR ───────────────────────────────────────────────────────── */}
      {tab === "mayor" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <select value={cuentaMayor} onChange={(e) => setCuentaMayor(e.target.value)} style={{ ...input, minWidth: 340 }}>
              <option value="">Elegí una cuenta</option>
              {cuentasImputables.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
            </select>
            {cuentaMayor && <button onClick={exportarMayor} style={btnDark}>⬇ Exportar CSV</button>}
          </div>
          {cuentaMayor && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>FECHA</th><th style={th}>N°</th><th style={th}>DESCRIPCIÓN</th><th style={th}>DETALLE</th>
                  <th style={thR}>DEBE</th><th style={thR}>HABER</th><th style={thR}>SALDO</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: "#f8f9fa" }}>
                  <td style={td} colSpan={6}><em>Saldo inicial</em></td>
                  <td style={tdR}>{fmt(saldoInicialMayor)}</td>
                  <td style={td}></td>
                </tr>
                {(() => {
                  let saldo = saldoInicialMayor;
                  return movMayor.map((m) => {
                    const d = Number(enUSD ? m.debe_usd || 0 : m.debe);
                    const h = Number(enUSD ? m.haber_usd || 0 : m.haber);
                    saldo += d - h;
                    return (
                      <tr key={m.id}>
                        <td style={td}>{m.asientos.fecha}</td>
                        <td style={{ ...td, color: "#888" }}>{m.asientos.numero}</td>
                        <td style={td}>{m.asientos.descripcion}</td>
                        <td style={{ ...td, color: "#888" }}>{m.detalle}</td>
                        <td style={tdR}>{d ? fmt(d) : ""}</td>
                        <td style={tdR}>{h ? fmt(h) : ""}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{fmt(saldo)}</td>
                        <td style={td}>
                          {m.asientos.origen_tipo === "factura" && cuentaEsReclasificable(cuentaPorId[cuentaMayor]) && (
                            <Reclasificar facturaId={m.asientos.origen_id} cuentas={cuentasImputables} onDone={cargarTodo} />
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}
          {cuentaMayor && movMayor.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 14 }}>Sin movimientos en el período.</div>}
        </div>
      )}

      {/* ── A CLASIFICAR ────────────────────────────────────────────────── */}
      {tab === "clasificar" && (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555" }}>
            Estas facturas no tienen una regla que diga a qué cuenta van, y quedaron en <strong>Gastos a clasificar</strong>.
            Elegí la cuenta. Si marcás <em>&ldquo;todas las del proveedor&rdquo;</em>, queda como cuenta por defecto de ese proveedor
            y se aplica a sus facturas futuras también (salvo Insumos y facturas con labor, que tienen su propia regla).
          </p>
          {aClasificar.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#2e7d32", fontWeight: 600, fontSize: 14 }}>✅ No hay nada para clasificar</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>FECHA</th><th style={th}>PROVEEDOR</th><th style={th}>COMPROBANTE</th><th style={th}>CONCEPTO</th>
                  <th style={thR}>IMPORTE A CLASIFICAR ARS</th><th style={th}>CUENTA</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {aClasificar.map((f) => {
                  const sel = eleccion[f.id] || { cuenta: "", todoElProveedor: false };
                  return (
                    <tr key={f.id}>
                      <td style={td}>{f.Fecha}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{f.proveedores?.razon_social || "—"}</td>
                      <td style={{ ...td, color: "#888" }}>{f.tipo_comprobante} {f.Numero_factura}</td>
                      <td style={td}>{f.Concepto}</td>
                      <td style={tdR}>{fmt(Number(f.monto_neto || 0) + Number(f.no_gravado || 0) * (f.moneda === "USD" ? Number(f.dolar || 1) : 1))}</td>
                      <td style={td}>
                        <select value={sel.cuenta} onChange={(e) => setEleccion({ ...eleccion, [f.id]: { ...sel, cuenta: e.target.value } })} style={{ ...input, padding: "6px 8px", fontSize: 12, minWidth: 240 }}>
                          <option value="">Elegir cuenta…</option>
                          {cuentasImputables.filter((c) => c.codigo !== CODIGO_A_CLASIFICAR).map((c) => (
                            <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                          ))}
                        </select>
                        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "#666", marginTop: 4 }}>
                          <input type="checkbox" checked={sel.todoElProveedor} onChange={(e) => setEleccion({ ...eleccion, [f.id]: { ...sel, todoElProveedor: e.target.checked } })} />
                          todas las del proveedor
                        </label>
                      </td>
                      <td style={td}><button onClick={() => clasificar(f)} style={{ ...btnDark, padding: "6px 12px", fontSize: 12 }}>Guardar</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── AJUSTE DE APERTURA ──────────────────────────────────────────── */}
      {tab === "apertura" && (
        <div style={card}>
          <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>
            Sirve para <strong>arrancar de cero</strong> sin reconstruir quién pagó cada factura vieja. Indicá, a una fecha de corte,
            los saldos <strong>reales</strong>: cuánta plata había en el banco (del resumen del Santander) y cuánto se les debía a los
            proveedores. El sistema genera un asiento a esa fecha que lleva <em>Bancos</em> y <em>Proveedores</em> a esos valores, y la
            diferencia queda en la cuenta <em>Ajuste de apertura (a conciliar)</em>. Los aportes de capital no se tocan.
            Desde el día siguiente, todo se carga normal.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 16, alignItems: "end", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>FECHA DE CORTE</div>
              <input type="date" value={apertura.fecha} onChange={(e) => setApertura({ ...apertura, fecha: e.target.value })} style={{ ...input, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>SALDO REAL DEL BANCO A ESA FECHA ($)</div>
              <input type="number" value={apertura.banco} onChange={(e) => setApertura({ ...apertura, banco: e.target.value })} placeholder="Del resumen del Santander" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>DEUDA REAL CON PROVEEDORES ($) — OPCIONAL</div>
              <input type="number" value={apertura.proveedores} onChange={(e) => setApertura({ ...apertura, proveedores: e.target.value })} placeholder="Vacío = no ajustar proveedores" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={guardarApertura} style={btnDark}>💾 {aperturaGuardada ? "Actualizar ajuste" : "Generar ajuste de apertura"}</button>
            {aperturaGuardada && <button onClick={borrarApertura} style={{ ...btn, color: "#c62828", borderColor: "#fcc" }}>Borrar ajuste</button>}
          </div>

          {asientoApertura && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8, letterSpacing: 0.5 }}>ASIENTO GENERADO</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>N°</th><th style={th}>FECHA</th><th style={th}>CUENTA</th><th style={th}>DETALLE</th><th style={thR}>DEBE</th><th style={thR}>HABER</th></tr></thead>
                <tbody>
                  <AsientoFilas a={asientoApertura} cuentaPorId={cuentaPorId} enUSD={false} td={td} tdR={tdR} cuentas={cuentasImputables} onReclasificado={cargarTodo} />
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "#999", marginTop: 10 }}>
                Se recalcula solo si después corregís facturas, pagos o aportes anteriores al corte. Va en pesos: en la vista USD este ajuste no se muestra.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── PLAN DE CUENTAS ─────────────────────────────────────────────── */}
      {tab === "plan" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap", background: "#f8f9fa", padding: 12, borderRadius: 8 }}>
            <strong style={{ fontSize: 13 }}>Nueva cuenta:</strong>
            <input placeholder="Código (ej. 5.3.03)" value={nuevaCuenta.codigo} onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, codigo: e.target.value })} style={{ ...input, width: 150 }} />
            <input placeholder="Nombre" value={nuevaCuenta.nombre} onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, nombre: e.target.value })} style={{ ...input, width: 260 }} />
            <select value={nuevaCuenta.tipo} onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, tipo: e.target.value })} style={input}>
              {Object.entries(TIPOS_CUENTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={nuevaCuenta.imputable} onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, imputable: e.target.checked })} />
              Imputable
            </label>
            <button onClick={crearCuenta} style={btnDark}>+ Agregar</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>CÓDIGO</th><th style={th}>NOMBRE</th><th style={th}>TIPO</th><th style={th}>IMPUTABLE</th><th style={th}>ESTADO</th></tr>
            </thead>
            <tbody>
              {cuentas.map((c) => {
                const nivel = c.codigo.split(".").length - 1;
                return (
                  <tr key={c.id} style={{ opacity: c.activa ? 1 : 0.45 }}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{c.codigo}</td>
                    <td style={{ ...td, paddingLeft: 12 + nivel * 16, fontWeight: c.imputable ? 400 : 700 }}>{c.nombre}</td>
                    <td style={{ ...td, color: "#888" }}>{TIPOS_CUENTA[c.tipo]}</td>
                    <td style={td}>{c.imputable ? "Sí" : "Título"}</td>
                    <td style={td}>
                      <button onClick={() => toggleActiva(c)} style={{ ...btn, padding: "3px 10px", fontSize: 11 }}>{c.activa ? "Activa" : "Inactiva"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SUBCOMPONENTES ──────────────────────────────────────────────────────────

function FragmentoTipo({ titulo, filas, enUSD, td, tdR, onClickCuenta }: {
  titulo: string; filas: FilaSaldo[]; enUSD: boolean;
  td: React.CSSProperties; tdR: React.CSSProperties; onClickCuenta: (id: string) => void;
}) {
  const sub = filas.reduce((acc, s) => ({
    debe: acc.debe + (enUSD ? s.debe_usd : s.debe),
    haber: acc.haber + (enUSD ? s.haber_usd : s.haber),
  }), { debe: 0, haber: 0 });
  return (
    <>
      <tr><td colSpan={5} style={{ ...td, background: "#fafafa", fontWeight: 700, fontSize: 12, color: "#555", letterSpacing: 0.5 }}>{titulo.toUpperCase()}</td></tr>
      {filas.map((s) => {
        const d = enUSD ? s.debe_usd : s.debe, h = enUSD ? s.haber_usd : s.haber, sal = enUSD ? s.saldo_usd : s.saldo;
        return (
          <tr key={s.cuenta_id} onClick={() => onClickCuenta(s.cuenta_id)} style={{ cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9f9f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
            <td style={{ ...td, fontFamily: "monospace", color: "#888" }}>{s.codigo}</td>
            <td style={td}>{s.nombre}</td>
            <td style={tdR}>{fmt(d)}</td>
            <td style={tdR}>{fmt(h)}</td>
            <td style={{ ...tdR, fontWeight: 600, color: sal < 0 ? "#1565c0" : "#333" }}>{fmt(sal)}</td>
          </tr>
        );
      })}
      <tr>
        <td style={{ ...td, color: "#888", fontSize: 12 }} colSpan={2}>Subtotal {titulo}</td>
        <td style={{ ...tdR, color: "#888", fontSize: 12 }}>{fmt(sub.debe)}</td>
        <td style={{ ...tdR, color: "#888", fontSize: 12 }}>{fmt(sub.haber)}</td>
        <td style={{ ...tdR, color: "#888", fontSize: 12 }}>{fmt(sub.debe - sub.haber)}</td>
      </tr>
    </>
  );
}

function AsientoFilas({ a, cuentaPorId, enUSD, td, tdR, cuentas, onReclasificado }: {
  a: Asiento; cuentaPorId: Record<string, Cuenta>; enUSD: boolean;
  td: React.CSSProperties; tdR: React.CSSProperties;
  cuentas: Cuenta[]; onReclasificado: () => void;
}) {
  // Debe primero, después haber (como en un libro diario)
  const lineas = [...a.asiento_lineas].sort((x, y) => Number(y.debe) - Number(x.debe));
  return (
    <>
      <tr style={{ background: "#f8f9fa" }}>
        <td style={{ ...td, fontWeight: 700 }}>{a.numero}</td>
        <td style={{ ...td, fontWeight: 700 }}>{a.fecha}</td>
        <td style={{ ...td, fontWeight: 600 }} colSpan={4}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span>{a.descripcion} <span style={{ fontSize: 11, color: "#999", fontWeight: 400 }}>({a.origen_tipo})</span></span>
            {a.origen_tipo === "factura" && <Reclasificar facturaId={a.origen_id} cuentas={cuentas} onDone={onReclasificado} />}
          </div>
        </td>
      </tr>
      {lineas.map((l) => {
        const c = cuentaPorId[l.cuenta_id];
        const d = Number(enUSD ? l.debe_usd || 0 : l.debe), h = Number(enUSD ? l.haber_usd || 0 : l.haber);
        return (
          <tr key={l.id}>
            <td style={td}></td><td style={td}></td>
            <td style={{ ...td, paddingLeft: h ? 40 : 12 }}>
              <span style={{ fontFamily: "monospace", color: "#888", fontSize: 12 }}>{c?.codigo}</span> {c?.nombre}
            </td>
            <td style={{ ...td, color: "#888", fontSize: 12 }}>{l.detalle}</td>
            <td style={tdR}>{d ? fmt(d) : ""}</td>
            <td style={tdR}>{h ? fmt(h) : ""}</td>
          </tr>
        );
      })}
    </>
  );
}

// Cuentas donde tiene sentido ofrecer "Reclasificar" en el mayor: la cuenta
// de imputación del neto. No en Proveedores, IVA ni créditos impositivos,
// que salen de reglas fijas y no se eligen.
function cuentaEsReclasificable(c?: Cuenta) {
  if (!c) return false;
  return !c.codigo.startsWith("2.1.1") && !c.codigo.startsWith("1.1.3");
}

// Cambia la cuenta de imputación de una factura (facturas.cuenta_id). El
// trigger de la base regenera el asiento solo. "Automática" borra la elección
// y la factura vuelve a seguir las reglas (Insumos → Stock, labor → Sementera…).
function Reclasificar({ facturaId, cuentas, onDone }: {
  facturaId: string; cuentas: Cuenta[]; onDone: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cuenta, setCuenta] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!cuenta) { alert("Elegí una cuenta"); return; }
    setGuardando(true);
    const { error } = await supabase.from("facturas")
      .update({ cuenta_id: cuenta === "AUTO" ? null : cuenta })
      .eq("id", facturaId);
    setGuardando(false);
    if (error) { alert("Error: " + error.message); return; }
    setAbierto(false); setCuenta("");
    onDone();
  };

  if (!abierto) {
    return (
      <button onClick={(e) => { e.stopPropagation(); setAbierto(true); }}
        style={{ padding: "3px 10px", fontSize: 11, borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#555", whiteSpace: "nowrap", fontWeight: 500 }}>
        ✏️ Reclasificar
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
      <select value={cuenta} onChange={(e) => setCuenta(e.target.value)}
        style={{ padding: "4px 6px", fontSize: 11, borderRadius: 6, border: "1px solid #ddd", maxWidth: 260, fontWeight: 400 }}>
        <option value="">Cuenta…</option>
        <option value="AUTO">↺ Automática (según reglas)</option>
        {cuentas.filter((c) => !c.codigo.startsWith("2.1.1") && !c.codigo.startsWith("1.1.3")).map((c) => (
          <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
        ))}
      </select>
      <button onClick={guardar} disabled={guardando}
        style={{ padding: "4px 10px", fontSize: 11, borderRadius: 6, border: "none", background: "#0f1f17", color: "white", cursor: "pointer" }}>
        {guardando ? "…" : "OK"}
      </button>
      <button onClick={() => { setAbierto(false); setCuenta(""); }}
        style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>✕</button>
    </span>
  );
}
