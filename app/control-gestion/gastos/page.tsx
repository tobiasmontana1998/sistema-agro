"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import jsPDF from "jspdf";

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
  const [montoModal, setMontoModal] = useState("");
  const [fechaModal, setFechaModal] = useState(new Date().toISOString().split("T")[0]);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [proveedoresFiltro, setProveedoresFiltro] = useState<string[]>([]);
  const [mostrarFiltroProveedores, setMostrarFiltroProveedores] = useState(false);

  const [archivoArca, setArchivoArca] = useState<File | null>(null);
  const [comparacion, setComparacion] = useState<any[] | null>(null);
  const [mostrarComparador, setMostrarComparador] = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  // Helpers para obtener percepciones con fallback
  // Si existen percepciones_iva / percepciones_iibb las usa,
  // si no, reparte el campo percepciones genérico entre los dos.
  const getPercIVA  = (g: any) => Number(g.percepciones_iva  ?? g.percepciones ?? 0);
  const getPercIIBB = (g: any) => Number(g.percepciones_iibb ?? 0);

  const cargarDatos = async () => {
    const [{ data: facturas, error: errFact }, { data: pagosData }, { data: remitosData }, { data: items }] = await Promise.all([
      supabase.from("facturas").select(`
        id, Fecha, Fecha_vencimiento, Numero_factura, Concepto, Tipo, pdf_url,
        Monto, monto_usd, dolar, pagada, moneda, proveedor_id,
        tipo_comprobante, monto_neto, monto_iva, percepciones, percepciones_iva, percepciones_iibb, retenciones,
        no_gravado, alicuota_iva, cae, cae_valido,
        proveedores!fk_facturas_proveedor (razon_social, cuit),
        actividades!fk_facturas_actividad (nombre),
        labores!fk_facturas_labor (numero)
      `).order("Fecha", { ascending: false }),
      supabase.from("pagos_facturas").select("*"),
      supabase.from("stock_movimientos").select("factura_id, insumo_id, cantidad").eq("tipo", "entrada").eq("motivo", "remito").not("factura_id", "is", null),
      supabase.from("factura_items").select("factura_id, insumo_id, cantidad"),
    ]);

    // Si falla por columnas que no existen, reintentamos sin ellas
    if (errFact) {
      const { data: facturasFallback } = await supabase.from("facturas").select(`
        id, Fecha, Fecha_vencimiento, Numero_factura, Concepto, Tipo, pdf_url,
        Monto, monto_usd, dolar, pagada, moneda, proveedor_id,
        tipo_comprobante, monto_neto, monto_iva, percepciones, retenciones,
        no_gravado, alicuota_iva, cae, cae_valido,
        proveedores!fk_facturas_proveedor (razon_social, cuit),
        actividades!fk_facturas_actividad (nombre),
        labores!fk_facturas_labor (numero)
      `).order("Fecha", { ascending: false });
      setGastos(facturasFallback || []);
    } else {
      setGastos(facturas || []);
    }

    setPagos(pagosData || []);
    setRemitos(remitosData || []);
    setItemsData(items || []);
    return { facturas: facturas || [], pagosData };
  };

  const getEstadoRemito = (facturaId: string) => {
    const itemsFactura = itemsData.filter((i: any) => i.factura_id === facturaId);
    const algunoRemitido = remitos.some(r => r.factura_id === facturaId);
    if (itemsFactura.length === 0) return algunoRemitido ? "vinculado" : "sin_remito";
    const todosCompletos = itemsFactura.every((item: any) => {
      const remitado = remitos
        .filter(r => r.factura_id === facturaId && r.insumo_id === item.insumo_id)
        .reduce((acc: number, r: any) => acc + Number(r.cantidad), 0);
      return remitado >= Number(item.cantidad);
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
    const { pagosData } = await cargarDatos() as any;
    if (modalPago?.id === facturaId) {
      const pagosRestantes = (pagosData || []).filter((p: any) => p.factura_id === facturaId);
      setModalPago((prev: any) => ({ ...prev, pagada: false, _pagos: pagosRestantes }));
    }
  };

  const getPagosFactura = (facturaId: string) => pagos.filter(p => p.factura_id === facturaId);
  const getTotalPagado = (facturaId: string) => getPagosFactura(facturaId).reduce((acc, p) => acc + Number(p.monto), 0);
  const esUSD = (g: any) => g.moneda === "USD";

  const abrirModalPago = (g: any) => {
    setModalPago(g);
    const montoDefault = esUSD(g) ? Number(g.monto_usd).toFixed(2) : Number(g.Monto).toFixed(2);
    setMontoModal(montoDefault);
    setFechaModal(new Date().toISOString().split("T")[0]);
  };

  const guardarPago = async () => {
    if (!montoModal) return;
    const montoEnARS = esUSD(modalPago) ? Number(montoModal) * (modalPago.dolar || 1) : Number(montoModal);
    const { error } = await supabase.from("pagos_facturas").insert([{ factura_id: modalPago.id, monto: montoEnARS, fecha: fechaModal }]);
    if (error) { alert("Error: " + error.message); return; }
    const pagosFactura = [...pagos.filter(p => p.factura_id === modalPago.id), { monto: montoEnARS }];
    const totalPagado = pagosFactura.reduce((acc, p) => acc + Number(p.monto), 0);
    if (totalPagado >= modalPago.Monto) {
      await supabase.from("facturas").update({ pagada: true }).eq("id", modalPago.id);
    }
    setModalPago(null);
    cargarDatos();
  };

  const gastosFiltrados = gastos
    .filter((g) => {
      const matchTexto = !filtro ||
        g.proveedores?.razon_social?.toLowerCase().includes(filtro.toLowerCase()) ||
        g.Concepto?.toLowerCase().includes(filtro.toLowerCase()) ||
        g.Numero_factura?.toLowerCase().includes(filtro.toLowerCase());
      if (!matchTexto) return false;
      if (filtroRemito === "sin_remito") return g.Tipo === "Insumos" && !tieneRemito(g.id);
      if (filtroRemito === "con_remito") return g.Tipo === "Insumos" && tieneRemito(g.id);
      if (fechaDesde && g.Fecha < fechaDesde) return false;
      if (fechaHasta && g.Fecha > fechaHasta) return false;
      if (proveedoresFiltro.length > 0 && !proveedoresFiltro.includes(g.proveedor_id)) return false;
      return true;
    })
    .sort((a, b) => orden === "monto" ? b.Monto - a.Monto : new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime());

  // ── EXPORTAR CSV ──────────────────────────────────────────────────────────
  const exportarCSV = () => {
    const encabezado = [
      "Fecha emisión", "Fecha vencimiento", "Proveedor", "CUIT",
      "N° Factura", "Tipo comprobante", "Concepto", "Categoría", "Actividad",
      "Moneda", "Monto neto gravado", "No gravado", "Alícuota IVA %",
      "IVA", "Percepciones IVA", "Percepciones IIBB", "Retenciones", "Monto total ARS",
      "Monto USD", "Tipo de cambio", "CAE válido",
      "Estado remito", "Pagada", "Total pagado ARS", "Saldo ARS", "PDF",
    ];
    const filas = gastosFiltrados.map((g) => {
      const totalPagado = getTotalPagado(g.id);
      const saldo = (g.Monto || 0) - totalPagado;
      const estadoRemito = g.Tipo === "Insumos" ? getEstadoRemito(g.id) : "N/A";
      return [
        g.Fecha || "", g.Fecha_vencimiento || "",
        g.proveedores?.razon_social || "", g.proveedores?.cuit || "",
        g.Numero_factura || "", g.tipo_comprobante || "",
        (g.Concepto || "").replace(/;/g, ","), g.Tipo || "",
        g.actividades?.nombre || "", g.moneda || "ARS",
        Number(g.monto_neto || 0).toFixed(2), Number(g.no_gravado || 0).toFixed(2),
        Number(g.alicuota_iva || 21).toFixed(1), Number(g.monto_iva || 0).toFixed(2),
        getPercIVA(g).toFixed(2), getPercIIBB(g).toFixed(2),
        Number(g.retenciones || 0).toFixed(2),
        Number(g.Monto || 0).toFixed(2), Number(g.monto_usd || 0).toFixed(2),
        Number(g.dolar || 0).toFixed(2),
        g.cae_valido ? "Sí" : g.cae ? "No verificado" : "",
        estadoRemito === "vinculado" ? "Vinculado" : estadoRemito === "parcial" ? "Parcial" : estadoRemito === "sin_remito" ? "Sin remito" : "N/A",
        g.pagada ? "Sí" : "No",
        totalPagado.toFixed(2),
        saldo > 0.01 ? saldo.toFixed(2) : "0.00",
        g.pdf_url || "",
      ];
    });
    const csv = [encabezado, ...filas]
      .map((fila) => fila.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gastos_${fechaDesde || "inicio"}_${fechaHasta || "hoy"}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── EXPORTAR IVA ARCA TXT ─────────────────────────────────────────────────
  const exportarIVAComprasTXT = () => {
    const tipoComprobanteMap: Record<string, string> = {
      "Factura A": "001", "Factura B": "006", "Factura C": "011",
      "Nota de Crédito A": "003", "Nota de Crédito B": "008", "Nota de Crédito C": "013",
      "Recibo": "015",
    };
    const alicuotaMap: Record<string, string> = {
      "0": "0003", "10.5": "0004", "21": "0005", "27": "0006",
    };
    const padN = (val: string | number, len: number) =>
      String(val || "0").replace(/\D/g, "").padStart(len, "0").slice(-len);
    const padA = (val: string, len: number) =>
      String(val || "").slice(0, len).padEnd(len, " ");
    const fmt15 = (val: number) =>
      Math.round((val || 0) * 100).toString().padStart(15, "0");
    const facturasFiltradas = gastosFiltrados.filter(
      (g) => g.tipo_comprobante && tipoComprobanteMap[g.tipo_comprobante]
    );
    const lineasCbte = facturasFiltradas.map((g) => {
      const tipoComp = tipoComprobanteMap[g.tipo_comprobante];
      const esFacturaBC = ["006", "008", "011", "013"].includes(tipoComp);
      const fecha = (g.Fecha || "").replace(/-/g, "").padStart(8, "0");
      const partes = (g.Numero_factura || "00000-00000000").split("-");
      const puntoVenta = padN(partes[0] || "0", 5);
      const nroComp = padN(partes[1] || "0", 20);
      const despacho = " ".repeat(16);
      const codDoc = "80";
      const cuit = padN((g.proveedores?.cuit || "0").replace(/-/g, ""), 20);
      const razonSocial = padA(g.proveedores?.razon_social || "", 30);
      const total = fmt15(Number(g.Monto || 0));
      const noGravado = fmt15(Number(g.no_gravado || 0));
      const exentas = fmt15(Number(g.alicuota_iva) === 0 ? Number(g.monto_neto || 0) : 0);
      const percIVA = fmt15(getPercIVA(g));
      const percOtrosNac = fmt15(0);
      const percIIBB = fmt15(getPercIIBB(g));
      const percMunic = fmt15(0);
      const impInternos = fmt15(0);
      const moneda = g.moneda === "USD" ? "DOL" : "PES";
      const tipoCambio = g.moneda === "USD"
        ? Math.round(Number(g.dolar || 1) * 1000000).toString().padStart(10, "0")
        : "0001000000";
      const cantAlicuotas = esFacturaBC || Number(g.alicuota_iva) === 0 ? "0" : "1";
      const codOperacion = " ";
      const creditoFiscal = fmt15(Number(g.monto_iva || 0));
      const otrosTributos = fmt15(Number(g.retenciones || 0));
      const cuitCorredor = "00000000000";
      const denomCorredor = " ".repeat(30);
      const ivaComision = fmt15(0);
      return [
        fecha, tipoComp, puntoVenta, nroComp, despacho, codDoc, cuit, razonSocial,
        total, noGravado, exentas, percIVA, percOtrosNac, percIIBB, percMunic,
        impInternos, moneda, tipoCambio, cantAlicuotas, codOperacion,
        creditoFiscal, otrosTributos, cuitCorredor, denomCorredor, ivaComision,
      ].join("");
    });
    const lineasAlicuotas = facturasFiltradas
      .filter((g) => {
        const tipoComp = tipoComprobanteMap[g.tipo_comprobante];
        const esFacturaBC = ["006", "008", "011", "013"].includes(tipoComp);
        return !esFacturaBC && Number(g.alicuota_iva) > 0;
      })
      .map((g) => {
        const tipoComp = tipoComprobanteMap[g.tipo_comprobante];
        const partes = (g.Numero_factura || "00000-00000000").split("-");
        const puntoVenta = padN(partes[0] || "0", 5);
        const nroComp = padN(partes[1] || "0", 20);
        const codDoc = "80";
        const cuit = padN((g.proveedores?.cuit || "0").replace(/-/g, ""), 20);
        const neto = fmt15(Number(g.monto_neto || 0));
        const alicuota = alicuotaMap[String(g.alicuota_iva || "21")] || "0005";
        const ivaLiquidado = fmt15(Number(g.monto_iva || 0));
        return [tipoComp, puntoVenta, nroComp, codDoc, cuit, neto, alicuota, ivaLiquidado].join("");
      });
    const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const blobCbte = new Blob([lineasCbte.join("\r\n")], { type: "text/plain;charset=windows-1252;" });
    const aCbte = document.createElement("a");
    aCbte.href = URL.createObjectURL(blobCbte);
    aCbte.download = `LIBRO_IVA_DIGITAL_COMPRAS_CBTE_${fechaHoy}.txt`;
    document.body.appendChild(aCbte); aCbte.click(); document.body.removeChild(aCbte);
    setTimeout(() => {
      const blobAlic = new Blob([lineasAlicuotas.join("\r\n")], { type: "text/plain;charset=windows-1252;" });
      const aAlic = document.createElement("a");
      aAlic.href = URL.createObjectURL(blobAlic);
      aAlic.download = `LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS_${fechaHoy}.txt`;
      document.body.appendChild(aAlic); aAlic.click(); document.body.removeChild(aAlic);
    }, 1500);
  };

  // ── EXPORTAR LIBRO IVA COMPRAS PDF ────────────────────────────────────────
  const exportarLibroIVAPDF = () => {
    const fmtM  = (n: number) => n === 0 ? "" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtM0 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const tipoLabel: Record<string, string> = {
      "Factura A": "FC", "Factura B": "FC", "Factura C": "FC",
      "Nota de Crédito A": "NC", "Nota de Crédito B": "NC", "Nota de Crédito C": "NC",
      "Recibo": "RT",
    };
    const letraLabel: Record<string, string> = {
      "Factura A": "A", "Factura B": "B", "Factura C": "C",
      "Nota de Crédito A": "A", "Nota de Crédito B": "B", "Nota de Crédito C": "C",
      "Recibo": "",
    };

    const facturas = gastosFiltrados.filter(g => g.tipo_comprobante && tipoLabel[g.tipo_comprobante]);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const PW = 297;
    const ML = 8;
    const MR = 8;

    const C = {
      fecha:   { x: ML,      w: 17 },
      comp:    { x: ML+17,   w: 28 },
      rs:      { x: ML+45,   w: 50 },
      cuit:    { x: ML+95,   w: 25 },
      regEsp:  { x: ML+120,  w: 26 },
      noGrav:  { x: ML+146,  w: 24 },
      neto:    { x: ML+170,  w: 32 },
      iva:     { x: ML+202,  w: 22 },
      ivaComp: { x: ML+224,  w: 26 },
      asig:    { x: ML+250,  w: 16 },
      total:   { x: ML+266,  w: 23 },
    };

    let y = 0;

    const dibujarEncabezado = () => {
      y = 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Libro IVA Compras", PW / 2, y + 5, { align: "center" });
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const desde = fechaDesde || "inicio";
      const hasta = fechaHasta || new Date().toISOString().slice(0, 10);
      doc.text("EL ENCUENTRO MSA SA", ML, y);
      doc.text(`Desde el: ${desde}`, PW / 2 - 30, y);
      doc.text(`Hasta el: ${hasta}`, PW / 2 + 20, y);
      y += 5;

      doc.setDrawColor(150);
      doc.setLineWidth(0.3);
      doc.line(ML, y, PW - MR, y);
      y += 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(60);

      const hY1 = y + 3.5;
      const hY2 = y + 7;

      doc.text("Fecha",                    C.fecha.x,                     hY1);
      doc.text("Comprobante",              C.comp.x,                      hY1);
      doc.text("Razón Social Proveedor",   C.rs.x,                        hY1);
      doc.text("C.U.I.T.",                 C.cuit.x,                      hY1);
      doc.text("Nr.Ing.Brutos",            C.regEsp.x,                    hY1);
      doc.text("NInsGrav/ExMon",           C.noGrav.x,                    hY1);
      doc.text("Neto Grav.",               C.neto.x + C.neto.w,           hY1, { align: "right" });
      doc.text("IVA",                      C.iva.x + C.iva.w,             hY1, { align: "right" });
      doc.text("IVA CF (DF)",              C.ivaComp.x + C.ivaComp.w,    hY1, { align: "right" });
      doc.text("Asignación",               C.asig.x + C.asig.w,          hY1, { align: "right" });
      doc.text("Total",                    C.total.x + C.total.w,         hY1, { align: "right" });

      doc.text("Reg. Especiales",          C.regEsp.x,                    hY2);
      doc.text("Ex.Mon.Ncat",              C.noGrav.x,                    hY2);
      doc.text("computable",               C.ivaComp.x + C.ivaComp.w,    hY2, { align: "right" });
      doc.text("Cred. Fiscal",             C.asig.x + C.asig.w,          hY2, { align: "right" });

      y += 10;
      doc.setDrawColor(150);
      doc.line(ML, y, PW - MR, y);
      y += 1;
      doc.setTextColor(0);
    };

    const checkPage = (needed: number) => {
      if (y + needed > 200) {
        doc.addPage();
        dibujarEncabezado();
      }
    };

    dibujarEncabezado();

    let sumNeto21 = 0, sumNeto27 = 0;
    let sumIVA21 = 0, sumIVA27 = 0;
    let sumNoGrav = 0;
    let sumPercIVA = 0, sumPercIIBB = 0;
    let sumReten = 0, sumTotal = 0;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    for (const g of facturas) {
      const alic      = Number(g.alicuota_iva || 21);
      const neto      = Number(g.monto_neto   || 0);
      const iva       = Number(g.monto_iva    || 0);
      const noGrav    = Number(g.no_gravado   || 0);
      const percIVA   = getPercIVA(g);
      const percIIBB  = getPercIIBB(g);
      const reten     = Number(g.retenciones  || 0);
      const total     = Number(g.Monto        || 0);
      const tieneRegs = percIVA > 0 || percIIBB > 0;

      const alturasNecesarias = 5.5 + (percIIBB > 0 ? 4 : 0) + (percIVA > 0 ? 4 : 0) + 1.5;
      checkPage(alturasNecesarias);

      const tipo   = tipoLabel[g.tipo_comprobante] || "";
      const letra  = letraLabel[g.tipo_comprobante] || "";
      const partes = (g.Numero_factura || "").split("-");
      const pv     = partes[0] ? String(parseInt(partes[0])).padStart(5, "0") : "00000";
      const nro    = partes[1] ? String(parseInt(partes[1])).padStart(8, "0") : "00000000";
      const compStr = `${tipo}${letra}${pv}-${nro}`;
      const cuit   = (g.proveedores?.cuit || "").replace(/-/g, "");
      const rs     = (g.proveedores?.razon_social || "—").substring(0, 28);

      const rowY = y + 3.5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);

      doc.text(g.Fecha || "",  C.fecha.x, rowY);
      doc.text(compStr,        C.comp.x,  rowY);
      doc.text(rs,             C.rs.x,    rowY);
      doc.text(cuit,           C.cuit.x,  rowY);

      if (noGrav > 0) doc.text(fmtM(noGrav), C.noGrav.x + C.noGrav.w, rowY, { align: "right" });
      if (neto > 0)   doc.text(`${fmtM(neto)} ${alic.toFixed(2)}%`, C.neto.x + C.neto.w, rowY, { align: "right" });
      if (iva > 0) {
        doc.text(fmtM(iva), C.iva.x + C.iva.w,           rowY, { align: "right" });
        doc.text(fmtM(iva), C.ivaComp.x + C.ivaComp.w,   rowY, { align: "right" });
        doc.setFontSize(6);
        doc.text("Dir. Grav.", C.asig.x + C.asig.w, rowY, { align: "right" });
        doc.setFontSize(7);
      }
      doc.setFont("helvetica", "bold");
      doc.text(fmtM(total), C.total.x + C.total.w, rowY, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5;

      // Regímenes especiales por factura
      if (tieneRegs) {
        doc.setFontSize(6.5);
        doc.setTextColor(80);
        if (percIIBB > 0) {
          const ry = y + 3;
          doc.text("127", C.regEsp.x,     ry);
          doc.text("IB",  C.regEsp.x + 7, ry);
          doc.text("PERCEPCION IIBB", C.noGrav.x, ry);
          doc.text(fmtM(percIIBB), C.neto.x + C.neto.w, ry, { align: "right" });
          y += 4;
        }
        if (percIVA > 0) {
          const ry = y + 3;
          doc.text("IVA", C.regEsp.x,     ry);
          doc.text("PER", C.regEsp.x + 7, ry);
          doc.text("PERCEPCION IVA", C.noGrav.x, ry);
          doc.text(fmtM(percIVA), C.neto.x + C.neto.w, ry, { align: "right" });
          y += 4;
        }
        doc.setTextColor(0);
        doc.setFontSize(7);
      }

      doc.setDrawColor(220);
      doc.setLineWidth(0.1);
      doc.line(ML, y + 0.5, PW - MR, y + 0.5);
      y += 1.5;

      // Acumular
      sumNoGrav += noGrav;
      if (alic === 27) { sumNeto27 += neto; sumIVA27 += iva; }
      else             { sumNeto21 += neto; sumIVA21 += iva; }
      sumPercIVA  += percIVA;
      sumPercIIBB += percIIBB;
      sumReten    += reten;
      sumTotal    += total;
    }

    const sumNetoTotal = sumNeto21 + sumNeto27;
    const sumIVATotal  = sumIVA21  + sumIVA27;

    // ── TOTALES DE OPERACIONES QUE GENERAN CRÉDITO FISCAL ─────────────────
    checkPage(55);
    y += 3;
    doc.setDrawColor(80);
    doc.setLineWidth(0.4);
    doc.line(ML, y, PW - MR, y);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("TOTALES DE OPERACIONES QUE GENERAN CRÉDITO FISCAL", ML, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    if (sumNeto21 > 0) {
      const ry = y + 3;
      doc.text("DIRECTO GRAVADO", ML + 4, ry);
      doc.text("Tasa IVA",        ML + 40, ry);
      doc.text("21,00%",          ML + 56, ry);
      doc.text(fmtM0(sumNeto21),  C.neto.x + C.neto.w,         ry, { align: "right" });
      doc.text(fmtM0(sumIVA21),   C.iva.x + C.iva.w,           ry, { align: "right" });
      doc.text(fmtM0(sumIVA21),   C.ivaComp.x + C.ivaComp.w,   ry, { align: "right" });
      y += 5;
    }
    if (sumNeto27 > 0) {
      const ry = y + 3;
      doc.text("DIRECTO GRAVADO", ML + 4, ry);
      doc.text("Tasa IVA",        ML + 40, ry);
      doc.text("27,00%",          ML + 56, ry);
      doc.text(fmtM0(sumNeto27),  C.neto.x + C.neto.w,         ry, { align: "right" });
      doc.text(fmtM0(sumIVA27),   C.iva.x + C.iva.w,           ry, { align: "right" });
      doc.text(fmtM0(sumIVA27),   C.ivaComp.x + C.ivaComp.w,   ry, { align: "right" });
      y += 5;
    }

    // Subtotal
    {
      const ry = y + 3;
      doc.setFont("helvetica", "bold");
      doc.text("Subtotal",          ML + 4, ry);
      doc.text(fmtM0(sumNetoTotal), C.neto.x + C.neto.w,       ry, { align: "right" });
      doc.text(fmtM0(sumIVATotal),  C.iva.x + C.iva.w,         ry, { align: "right" });
      doc.text(fmtM0(sumIVATotal),  C.ivaComp.x + C.ivaComp.w, ry, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5;
    }

    // Impuestos internos / No gravado
    if (sumNoGrav > 0) {
      const ry = y + 3;
      doc.text("II    Impuestos Internos", ML + 4, ry);
      doc.text(fmtM0(sumNoGrav), C.regEsp.x + C.regEsp.w, ry, { align: "right" });
      y += 5;
    }

    // Fila totales crédito fiscal
    {
      const ry = y + 3;
      doc.setFont("helvetica", "bold");
      doc.text(fmtM0(sumNoGrav),    C.regEsp.x + C.regEsp.w,   ry, { align: "right" });
      doc.text("0,00",              C.noGrav.x + C.noGrav.w,    ry, { align: "right" });
      doc.text(fmtM0(sumNetoTotal), C.neto.x + C.neto.w,        ry, { align: "right" });
      doc.text(fmtM0(sumIVATotal),  C.iva.x + C.iva.w,          ry, { align: "right" });
      doc.text(fmtM0(sumIVATotal),  C.ivaComp.x + C.ivaComp.w,  ry, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 6;
    }

    // ── REGÍMENES ESPECIALES ───────────────────────────────────────────────
    if (sumPercIIBB > 0 || sumPercIVA > 0) {
      doc.setDrawColor(150);
      doc.setLineWidth(0.2);
      doc.line(ML, y, PW - MR, y);
      y += 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("REGÍMENES ESPECIALES", ML, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);

      if (sumPercIIBB > 0) {
        const ry = y + 3;
        doc.text("127",              ML + 4,  ry);
        doc.text("IB",               ML + 14, ry);
        doc.text("PERCEPCION IIBB",  ML + 22, ry);
        doc.text(fmtM0(sumPercIIBB), C.neto.x + C.neto.w, ry, { align: "right" });
        y += 5;
      }
      if (sumPercIVA > 0) {
        const ry = y + 3;
        doc.text("IVA",             ML + 4,  ry);
        doc.text("PER",             ML + 14, ry);
        doc.text("PERCEPCION IVA",  ML + 22, ry);
        doc.text(fmtM0(sumPercIVA), C.neto.x + C.neto.w, ry, { align: "right" });
        y += 5;
      }

      // Total regímenes
      {
        const ry = y + 3;
        doc.setFont("helvetica", "bold");
        doc.text(fmtM0(sumPercIIBB + sumPercIVA), C.neto.x + C.neto.w, ry, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 6;
      }
    }

    // ── TOTALES FINALES ───────────────────────────────────────────────────
    checkPage(20);
    doc.setDrawColor(60);
    doc.setLineWidth(0.5);
    doc.line(ML, y, PW - MR, y);
    y += 5;

    const labelFecha = fechaHasta || new Date().toLocaleDateString("es-AR");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`TOTALES AL ${labelFecha}`, ML, y);

    if (sumNoGrav > 0)
      doc.text(fmtM0(sumNoGrav),              C.regEsp.x + C.regEsp.w,   y, { align: "right" });
    doc.text(fmtM0(sumPercIIBB + sumPercIVA), C.noGrav.x + C.noGrav.w,   y, { align: "right" });
    doc.text("0,00",                          C.noGrav.x + C.noGrav.w + 2, y);
    doc.text(fmtM0(sumNetoTotal),             C.neto.x + C.neto.w,        y, { align: "right" });
    doc.text(fmtM0(sumIVATotal),              C.iva.x + C.iva.w,          y, { align: "right" });
    doc.text(fmtM0(sumIVATotal),              C.ivaComp.x + C.ivaComp.w,  y, { align: "right" });
    doc.text(fmtM0(sumTotal),                 C.total.x + C.total.w,      y, { align: "right" });
    y += 6;

    doc.setLineWidth(0.5);
    doc.line(ML, y, PW - MR, y);
    y += 4;

    // Leyenda
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100);
    doc.text("Observaciones:  FC = Factura    NC = Nota de Crédito    RT = Resumen Tarjeta de Crédito", ML, y);

    // Numeración de páginas
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(130);
      doc.text(`Pág. ${i} / ${totalPages}`, PW - MR, 205, { align: "right" });
      doc.setTextColor(0);
    }

    const desde = fechaDesde || "inicio";
    const hasta = fechaHasta || new Date().toISOString().slice(0, 10);
    doc.save(`Libro_IVA_Compras_${desde}_${hasta}.pdf`);
  };

  // ── COMPARADOR ARCA ───────────────────────────────────────────────────────
  const compararConArca = async () => {
    if (!archivoArca) return;
    const texto = await archivoArca.text();
    const lineasArca = texto.split(/\r?\n/).filter(Boolean);
    const tipoComprobanteMap: Record<string, string> = {
      "Factura A": "001", "Factura B": "006", "Factura C": "011",
      "Nota de Crédito A": "003", "Nota de Crédito B": "008", "Nota de Crédito C": "013",
    };
    const resultados = gastosFiltrados
      .filter(g => g.tipo_comprobante && tipoComprobanteMap[g.tipo_comprobante])
      .map((g) => {
        const tipoComp = tipoComprobanteMap[g.tipo_comprobante];
        const partes = (g.Numero_factura || "00000-00000000").split("-");
        const puntoVenta = String(parseInt(partes[0] || "0")).padStart(5, "0");
        const nroComp = String(parseInt(partes[1] || "0")).padStart(20, "0");
        const cuitLimpio = (g.proveedores?.cuit || "").replace(/-/g, "").padStart(20, "0");
        const fechaFactura = (g.Fecha || "").replace(/-/g, "");
        const lineaArca = lineasArca.find(l =>
          l.substring(0, 3) === tipoComp &&
          l.substring(3, 8) === puntoVenta &&
          l.substring(8, 28).trim() === nroComp.trim()
        );
        if (!lineaArca) return { factura: g, estado: "no_encontrada", diferencias: ["No encontrada en el archivo ARCA"], lineaArca: null };
        const diferencias: string[] = [];
        const cuitArca = lineaArca.substring(52, 72).trim();
        if (cuitArca && cuitArca !== cuitLimpio.trim()) diferencias.push(`CUIT: sistema=${cuitLimpio.trim()} | ARCA=${cuitArca}`);
        const fechaArca = lineaArca.substring(0, 8);
        if (fechaArca !== fechaFactura) diferencias.push(`Fecha: sistema=${fechaFactura} | ARCA=${fechaArca}`);
        const importeArca = parseInt(lineaArca.substring(82, 97) || "0") / 100;
        const importeSistema = Number(g.Monto || 0);
        if (Math.abs(importeArca - importeSistema) > 1) diferencias.push(`Monto: sistema=$${importeSistema.toFixed(2)} | ARCA=$${importeArca.toFixed(2)}`);
        return { factura: g, estado: diferencias.length === 0 ? "ok" : "diferencias", diferencias, lineaArca };
      });
    const facturasEnSistema = new Set(
      gastosFiltrados
        .filter(g => tipoComprobanteMap[g.tipo_comprobante])
        .map(g => {
          const tipoComp = tipoComprobanteMap[g.tipo_comprobante];
          const partes = (g.Numero_factura || "").split("-");
          return `${tipoComp}${String(parseInt(partes[0] || "0")).padStart(5, "0")}${String(parseInt(partes[1] || "0")).padStart(20, "0")}`;
        })
    );
    lineasArca.forEach(l => {
      const key = l.substring(0, 28);
      if (!facturasEnSistema.has(key)) {
        resultados.push({ factura: null, estado: "solo_en_arca", diferencias: [`Solo en ARCA — tipo:${l.substring(0, 3)} PV:${l.substring(3, 8)} N°:${l.substring(8, 28).trim()}`], lineaArca: l });
      }
    });
    setComparacion(resultados);
    setMostrarComparador(true);
  };

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  const totalGastado = gastos.reduce((acc, g) => acc + (g.Monto || 0), 0);
  const sinRemitoCount = gastos.filter(g => g.Tipo === "Insumos" && getEstadoRemito(g.id) === "sin_remito").length;
  const facturasPendientes = gastos
    .filter((g) => g.pagada === false && g.Fecha_vencimiento)
    .sort((a, b) => new Date(a.Fecha_vencimiento).getTime() - new Date(b.Fecha_vencimiento).getTime());
  const hayFiltrosActivos = filtroRemito !== "todos" || fechaDesde || fechaHasta || proveedoresFiltro.length > 0 || filtro;

  const card: React.CSSProperties = { background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24 };
  const th: React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#888", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", overflowX: "auto" }}>

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
                    <span style={{ color: "#888", fontSize: 12 }}>{p.fecha}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{esUSD(modalPago) ? `USD ${(Number(p.monto) / (modalPago.dolar || 1)).toFixed(2)}` : `$${Number(p.monto).toLocaleString("es-AR")}`}</span>
                      <button onClick={() => eliminarPago(p.id, modalPago.id)} style={{ background: "#fee", border: "1px solid #fcc", color: "red", padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 8 }}>
                  <span>Saldo pendiente:</span>
                  <span>{esUSD(modalPago) ? `USD ${((modalPago.Monto - getTotalPagado(modalPago.id)) / (modalPago.dolar || 1)).toFixed(2)}` : `$${(modalPago.Monto - getTotalPagado(modalPago.id)).toLocaleString("es-AR")}`}</span>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>MONTO {esUSD(modalPago) ? "(USD)" : "(ARS)"}</div>
              <input type="number" value={montoModal} onChange={(e) => setMontoModal(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, boxSizing: "border-box" }} />
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
          <button onClick={exportarLibroIVAPDF} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e0e0e0", background: "white", color: "#0f1f17", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            📑 Libro IVA PDF {hayFiltrosActivos ? `(${gastosFiltrados.length})` : ""}
          </button>
          <button onClick={exportarIVAComprasTXT} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e0e0e0", background: "white", color: "#0f1f17", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            📋 Exportar IVA ARCA {hayFiltrosActivos ? `(${gastosFiltrados.length})` : ""}
          </button>
          <button onClick={exportarCSV} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#0f1f17", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            ⬇ Exportar CSV {hayFiltrosActivos ? `(${gastosFiltrados.length})` : ""}
          </button>
        </div>
      </div>

      {/* ALERTA REMITOS */}
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ ...card, borderLeft: "4px solid #f5c542" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>TOTAL GASTADO</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>${totalGastado.toLocaleString("es-AR")}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{gastos.length} facturas registradas</div>
        </div>
        <div style={{ ...card, borderLeft: "4px solid #2e7d32" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>FACTURAS PAGADAS</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{gastos.filter(g => g.pagada).length}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{gastos.filter(g => !g.pagada).length} pendientes</div>
        </div>
      </div>

      {/* VENCIMIENTOS */}
      {facturasPendientes.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>PRÓXIMOS VENCIMIENTOS</div>
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

      {/* COMPARADOR ARCA */}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🔍 Comparar con archivo ARCA</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#f5f5f5", border: "1px dashed #ccc", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            📂 {archivoArca ? archivoArca.name : "Subir TXT de ARCA (CBTE)"}
            <input type="file" accept=".txt" style={{ display: "none" }} onChange={(e) => {
              if (e.target.files?.[0]) { setArchivoArca(e.target.files[0]); setComparacion(null); setMostrarComparador(false); }
            }} />
          </label>
          {archivoArca && (
            <button onClick={compararConArca} style={{ padding: "9px 18px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Comparar ({gastosFiltrados.length} facturas)
            </button>
          )}
          {archivoArca && (
            <button onClick={() => { setArchivoArca(null); setComparacion(null); setMostrarComparador(false); }} style={{ padding: "9px 14px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "red" }}>
              ✕ Quitar archivo
            </button>
          )}
          {comparacion && (
            <span style={{ fontSize: 13, color: "#555" }}>
              ✅ {comparacion.filter(r => r.estado === "ok").length} ok —{" "}
              ⚠️ {comparacion.filter(r => r.estado === "diferencias").length} con diferencias —{" "}
              ❌ {comparacion.filter(r => r.estado === "no_encontrada").length} no encontradas —{" "}
              🔵 {comparacion.filter(r => r.estado === "solo_en_arca").length} solo en ARCA
            </span>
          )}
        </div>
        {mostrarComparador && comparacion && (
          <div style={{ marginTop: 16 }}>
            {comparacion.filter(r => r.estado !== "ok").length === 0 ? (
              <div style={{ padding: "12px 16px", background: "#e8f5e9", borderRadius: 8, color: "#2e7d32", fontWeight: 600, fontSize: 13 }}>
                ✅ Todo coincide perfectamente con el archivo ARCA
              </div>
            ) : (
              comparacion.filter(r => r.estado !== "ok").map((r, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 8, fontSize: 13, background: r.estado === "solo_en_arca" ? "#e3f2fd" : r.estado === "no_encontrada" ? "#fff3e0" : "#ffebee", borderLeft: `4px solid ${r.estado === "solo_en_arca" ? "#1565c0" : r.estado === "no_encontrada" ? "#e65100" : "#c62828"}` }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {r.estado === "solo_en_arca" ? "🔵 Solo en ARCA" : r.estado === "no_encontrada" ? "⚠️ No encontrada en ARCA" : "❌ Diferencias encontradas"}
                    {r.factura && ` — ${r.factura.Numero_factura} | ${r.factura.proveedores?.razon_social}`}
                  </div>
                  {r.diferencias.map((d: string, j: number) => (
                    <div key={j} style={{ color: "#555", fontSize: 12, marginLeft: 8 }}>• {d}</div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="Buscar proveedor, concepto o N° factura..." value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, width: 280 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }} />
          <span style={{ color: "#888", fontSize: 13 }}>→</span>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }} />
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMostrarFiltroProveedores(p => !p)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, cursor: "pointer", background: proveedoresFiltro.length > 0 ? "#0f1f17" : "white", color: proveedoresFiltro.length > 0 ? "white" : "#333" }}>
            {proveedoresFiltro.length === 0 ? "Todos los proveedores" : `${proveedoresFiltro.length} proveedor${proveedoresFiltro.length > 1 ? "es" : ""}`} ▾
          </button>
          {mostrarFiltroProveedores && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "white", border: "1px solid #ddd", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 200, minWidth: 280, maxHeight: 300, overflowY: "auto" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#888" }}>FILTRAR PROVEEDORES</span>
                <button onClick={() => setProveedoresFiltro([])} style={{ fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer" }}>Limpiar</button>
              </div>
              {Array.from(new Map(gastos.map(g => [g.proveedor_id, g.proveedores?.razon_social])).entries())
                .filter(([id]) => id)
                .sort(([, a], [, b]) => (a || "").localeCompare(b || ""))
                .map(([id, nombre]) => (
                  <label key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid #f9f9f9", fontSize: 13 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                    <input type="checkbox" checked={proveedoresFiltro.includes(id as string)}
                      onChange={() => setProveedoresFiltro(prev => prev.includes(id as string) ? prev.filter(x => x !== id) : [...prev, id as string])} />
                    {nombre}
                  </label>
                ))}
            </div>
          )}
        </div>
        <select value={orden} onChange={(e) => setOrden(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
          <option value="fecha">Por fecha</option>
          <option value="monto">Por monto</option>
        </select>
        <select value={filtroRemito} onChange={(e) => setFiltroRemito(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
          <option value="todos">Todos los gastos</option>
          <option value="sin_remito">⚠️ Sin remito</option>
          <option value="con_remito">✅ Con remito</option>
        </select>
        {hayFiltrosActivos && (
          <button onClick={() => { setFiltroRemito("todos"); setFechaDesde(""); setFechaHasta(""); setProveedoresFiltro([]); setFiltro(""); }} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, background: "white", cursor: "pointer" }}>
            ✕ Limpiar filtros
          </button>
        )}
        <span style={{ fontSize: 13, color: "#888", marginLeft: "auto" }}>{gastosFiltrados.length} de {gastos.length} facturas</span>
      </div>

      {/* TABLA */}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #eee" }}>
              <th style={th}>F. EMISIÓN</th><th style={th}>F. VTO</th><th style={th}>PROVEEDOR</th>
              <th style={th}>FACTURA</th><th style={th}>CONCEPTO</th><th style={th}>TIPO</th>
              <th style={th}>REMITO</th><th style={th}>PAGOS</th><th style={th}>PAGADO</th>
              <th style={th}>MONTO</th><th style={th}>USD</th><th style={th}>PDF</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {gastosFiltrados.map((g) => {
              const totalPagadoFactura = getTotalPagado(g.id);
              const saldo = g.Monto - totalPagadoFactura;
              const facturaUSD = esUSD(g);
              const esInsumo = g.Tipo === "Insumos";
              const estadoRemito = getEstadoRemito(g.id);
              return (
                <tr key={g.id}
                  onDoubleClick={() => { window.location.href = `/control-gestion/facturas?id=${g.id}`; }}
                  style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", backgroundColor: g.pagada ? "#d4edda" : "white" }}
                  onMouseEnter={(e) => { if (!g.pagada) e.currentTarget.style.backgroundColor = "#f9f9f9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = g.pagada ? "#d4edda" : "white"; }}>
                  <td style={td}>{g.Fecha}</td>
                  <td style={{ ...td, color: g.Fecha_vencimiento && new Date(g.Fecha_vencimiento) < new Date() && !g.pagada ? "red" : "#333", fontWeight: g.Fecha_vencimiento && new Date(g.Fecha_vencimiento) < new Date() && !g.pagada ? 700 : 400 }}>
                    {g.Fecha_vencimiento || "-"}
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{g.proveedores?.razon_social || "-"}</td>
                  <td style={{ ...td, color: "#888" }}>{g.Numero_factura}</td>
                  <td style={td}>{g.Concepto}</td>
                  <td style={td}><span style={{ padding: "3px 10px", borderRadius: 20, background: "#f0f0f0", fontSize: 12, fontWeight: 600 }}>{g.Tipo}</span></td>
                  <td style={td}>
                    {esInsumo ? (
                      estadoRemito === "vinculado" ? <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✅ Vinculado</span>
                      : estadoRemito === "parcial" ? <span style={{ background: "#e3f2fd", color: "#1565c0", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>🔄 Parcial</span>
                      : <a href="/agricultura/remitos" onClick={(e) => e.stopPropagation()} style={{ background: "#fff3e0", color: "#e65100", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>⚠️ Sin remito</a>
                    ) : <span style={{ color: "#ddd", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 12 }}>
                      {totalPagadoFactura > 0 && <div style={{ fontWeight: 600 }}>{facturaUSD ? `USD ${(totalPagadoFactura / (g.dolar || 1)).toFixed(2)}` : `$${totalPagadoFactura.toLocaleString("es-AR")}`}</div>}
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
                            else { if (!confirm("¿Marcar como NO pagada?")) return; await supabase.from("facturas").update({ pagada: false }).eq("id", g.id); cargarDatos(); }
                          }} />
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
                      <a href={g.pdf_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 6, color: "#0f1f17", fontWeight: 600, fontSize: 12, textDecoration: "none" }}>
                        📄 Ver PDF
                      </a>
                    ) : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(g.Labor_id || g.labores?.numero) && (
                        <button onClick={async (e) => { e.stopPropagation(); if (!confirm("¿Desvincular la labor?")) return; await supabase.from("facturas").update({ Labor_id: null }).eq("id", g.id); cargarDatos(); }}
                          style={{ background: "#fff3e0", border: "1px solid #ffcc80", color: "#e65100", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          🔗 Desvincular labor
                        </button>
                      )}
                      {g.Tipo === "Insumos" && estadoRemito !== "sin_remito" && (
                        <button onClick={async (e) => { e.stopPropagation(); if (!confirm("¿Desvincular el remito?")) return; await supabase.from("remitos").update({ factura_id: null }).eq("factura_id", g.id); await supabase.from("stock_movimientos").update({ factura_id: null }).eq("factura_id", g.id); cargarDatos(); }}
                          style={{ background: "#fff3e0", border: "1px solid #ffcc80", color: "#e65100", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
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
        {gastosFiltrados.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#888", fontSize: 14 }}>No hay facturas que coincidan con los filtros aplicados.</div>
        )}
      </div>
    </div>
  );
}