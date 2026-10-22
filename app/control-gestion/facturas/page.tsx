"use client";

import { Fragment, Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Alícuotas de IVA ────────────────────────────────────────────────────────
type LineaIva = { alicuota: string; neto: string; iva: string };

const ALICUOTAS_IVA = [
  { valor: "21", label: "21%" },
  { valor: "10.5", label: "10,5%" },
  { valor: "27", label: "27%" },
  { valor: "5", label: "5%" },
  { valor: "2.5", label: "2,5%" },
  { valor: "0", label: "Exento" },
];

const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

// Nueva línea: por defecto 21%, o 10,5% si ya hay una de 21% (caso típico).
const lineaIvaVacia = (existentes: LineaIva[] = []): LineaIva => {
  const usadas = existentes.map((l) => l.alicuota);
  const alicuota = ["21", "10.5", "27", "5", "2.5", "0"].find((a) => !usadas.includes(a)) || "21";
  return { alicuota, neto: "", iva: "" };
};

// IVA calculado = neto × alícuota, redondeado a centavos por línea.
const ivaCalculado = (l: LineaIva) => r2(Number(l.neto || 0) * Number(l.alicuota) / 100);
// IVA de la línea: el escrito a mano si lo hay, si no el calculado.
const ivaDeLinea = (l: LineaIva) => (l.iva !== "" ? Number(l.iva) : ivaCalculado(l));

// Al editar una factura guardada: si el IVA guardado coincide con el
// calculado, se deja el campo vacío (automático); si no, queda "a mano".
const lineaDesdeGuardado = (alicuota: string, neto: number, iva: number): LineaIva => {
  const linea: LineaIva = { alicuota, neto: neto ? r2(neto).toFixed(2) : "", iva: "" };
  if (Math.abs(r2(iva) - ivaCalculado(linea)) > 0.005) linea.iva = r2(iva).toFixed(2);
  return linea;
};

function CargarFacturaInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const proveedorParam = searchParams.get("proveedor");

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
  // ── ALÍCUOTAS DE IVA ──────────────────────────────────────────────────────
  // Una factura puede tener varias alícuotas (ej. semilla 10,5% + agroquímico
  // 21%). Cada línea guarda su neto y su IVA en la MONEDA ORIGINAL de la
  // factura. Alícuota 0 = importe exento. El IVA se calcula solo, pero se
  // puede pisar si la factura trae un centavo de diferencia.
  const [lineasIva, setLineasIva] = useState<LineaIva[]>([lineaIvaVacia()]);
  const [percepciones, setPercepciones] = useState("");
  const [retenciones, setRetenciones] = useState("");
  const [noGravado, setNoGravado] = useState("");
  const [facturaOriginalId, setFacturaOriginalId] = useState("");
  // Nota de débito/crédito por DIFERENCIA DE CAMBIO (factura en USD pagada en
  // pesos a otro dólar). Su neto va a la cuenta 5.4.04 "Diferencias de cambio"
  // y no a Stock/Servicios. Se guarda como facturas.cuenta_id.
  const [porDifCambio, setPorDifCambio] = useState(false);
  const [cuentaDifCambioId, setCuentaDifCambioId] = useState<string | null>(null);
  const [cuentaIdGuardada, setCuentaIdGuardada] = useState<string | null>(null);
  const [actividad, setActividad] = useState("");
  const [actividades, setActividades] = useState<any[]>([]);
  const [labor, setLabor] = useState("");
  const [labores, setLabores] = useState<any[]>([]);
  const [remitos, setRemitos] = useState<any[]>([]);
  const [remito, setRemito] = useState("");
  const [filtroProveedorRemito, setFiltroProveedorRemito] = useState("");

  // ── Vinculación con remitos POR RENGLÓN (como Finnegans / Physis) ─────────
  // Al elegir el proveedor se muestran solo las líneas de remito de ESE
  // proveedor que todavía no tienen factura. Se tildan, se agregan como ítems
  // (insumo + cantidad) y al guardar quedan vinculadas a esta factura. Con eso
  // el stock toma el precio de la factura y se recalculan los costos.
  const [lineasRemito, setLineasRemito] = useState<any[]>([]);
  const [lineasSel, setLineasSel] = useState<Set<string>>(new Set());
  const [lineasOriginales, setLineasOriginales] = useState<Set<string>>(new Set());

  // ── Vinculación con LABORES (facturas de contratista) ─────────────────────
  // Al elegir el proveedor (contratista) se muestran SUS labores que todavía
  // no tienen factura. Una factura puede cubrir varias labores: el neto se
  // reparte por hectárea entre ellas (lo hace la base de datos).
  const [laboresSel, setLaboresSel] = useState<string[]>([]);
  const [laborFactura, setLaborFactura] = useState<Record<string, string>>({}); // labor_id → factura_id
  const [verOtrasLabores, setVerOtrasLabores] = useState(false);
  // Alta rápida de una labor que figura en la factura pero no estaba cargada
  const [lotesList, setLotesList] = useState<any[]>([]);
  const [nuevaLabor, setNuevaLabor] = useState<{ abierto: boolean; tipo: string; lote: string; fecha: string; hectareas: string; costo: string }>(
    { abierto: false, tipo: "", lote: "", fecha: "", hectareas: "", costo: "" });
  const [creandoLabor, setCreandoLabor] = useState(false);
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
  const [caeObservaciones, setCaeObservaciones] = useState<string[]>([]);

  const esNotaCredito = tipoComprobante.includes("Nota de Crédito");
  const esNotaDebito = tipoComprobante.includes("Nota de Débito");
  const esNota = esNotaCredito || esNotaDebito;

  const lineasIvaValidas = lineasIva.filter((l) => Number(l.neto) > 0);
  const montoNetoPuro = r2(lineasIvaValidas.reduce((acc, l) => acc + Number(l.neto), 0));
  const montoIvaPuro = r2(lineasIvaValidas.reduce((acc, l) => acc + ivaDeLinea(l), 0));
  // Alícuota "principal" que se sigue guardando en facturas.alicuota_iva para
  // compatibilidad (CSV, asistente, facturas viejas): si hay una sola, esa;
  // si hay varias, la de mayor neto gravado; si todo es exento, 0.
  const alicuotaPrincipal = (() => {
    const gravadas = lineasIvaValidas.filter((l) => Number(l.alicuota) > 0);
    if (gravadas.length === 0) return 0;
    return Number([...gravadas].sort((a, b) => Number(b.neto) - Number(a.neto))[0].alicuota);
  })();
  const hayMontos = lineasIvaValidas.length > 0;
  const montoTotalPuro = montoNetoPuro + montoIvaPuro + Number(percepciones || 0) + Number(retenciones || 0) + Number(noGravado || 0);
  const montoNeto = moneda === "USD" ? montoNetoPuro * (dolar || 1) : montoNetoPuro;
  const montoIva = moneda === "USD" ? montoIvaPuro * (dolar || 1) : montoIvaPuro;
  const montoTotal = moneda === "USD" ? montoTotalPuro * (dolar || 1) : montoTotalPuro;
  const montoEnUSD = moneda === "USD" ? montoTotalPuro : (dolar ? montoTotal / dolar : 0);

  useEffect(() => {
    supabase.from("cuentas").select("id").eq("codigo", "5.4.04").maybeSingle()
      .then(({ data }) => setCuentaDifCambioId(data?.id || null));
  }, []);

  // Al editar: tildar la casilla si la nota ya estaba en "Diferencias de cambio"
  useEffect(() => {
    if (cuentaIdGuardada && cuentaDifCambioId) setPorDifCambio(cuentaIdGuardada === cuentaDifCambioId);
  }, [cuentaIdGuardada, cuentaDifCambioId]);

  useEffect(() => {
    Promise.all([
      supabase.from("actividades").select(),
      supabase.from("proveedores").select("id, razon_social, cuit").eq("activo", true).order("razon_social"),
      supabase.from("labores").select("*").order("Fecha", { ascending: false }),
      supabase.from("facturas").select("id, Numero_factura, Concepto, proveedores(razon_social)").order("Fecha", { ascending: false }),
      supabase.from("insumos").select().order("nombre"),
      // Traemos TODOS los remitos recientes (no solo los que tienen
      // factura_id null a nivel remito, porque un remito puede cubrir varias
      // facturas y quedar con factura_id=null aunque ya tenga alguna línea
      // vinculada). El filtrado de "todavía tiene algo pendiente" se hace
      // más abajo, línea por línea, con el factura_id de cada
      // stock_movimiento.
      supabase.from("remitos").select("id, numero, numero_remito, fecha, proveedor_id, proveedores(razon_social), stock_movimientos(insumo_id, cantidad, factura_id, insumos(nombre))").order("created_at", { ascending: false }).limit(200),
    ]).then(([{ data: acts }, { data: provs }, { data: labs }, { data: facts }, { data: ins }, { data: rems }]) => {
      setActividades(acts || []);
      setProveedores(provs || []);
      setLabores(labs || []);
      // Nombre del lote de cada labor (se trae aparte: no depende de que la
      // relación labores→lotes esté declarada en la base)
      supabase.from("lotes").select("id, nombre").then(({ data: ls, error: eL }) => {
        if (eL) return;
        setLotesList(ls || []);
        const nombres = Object.fromEntries((ls || []).map((x: any) => [String(x.id), x.nombre]));
        setLabores((labs || []).map((l: any) => ({ ...l, lotes: { nombre: nombres[String(l.Lote_id)] || "" } })));
      });
      setFacturas(facts || []);
      setInsumos(ins || []);
      // Un remito sirve para asociar si tiene AL MENOS UNA línea todavía sin
      // factura vinculada.
      setRemitos((rems || []).filter((r: any) => (r.stock_movimientos || []).some((m: any) => !m.factura_id)));
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
      // Facturas viejas (sin filas en factura_alicuotas): una sola línea
      // armada con los campos de la cabecera. Si tiene filas, se pisan abajo.
      const tcFactura = monedaFactura === "USD" ? (data.dolar || 1) : 1;
      setLineasIva([lineaDesdeGuardado(
        data.alicuota_iva != null ? String(data.alicuota_iva) : "21",
        Number(data.monto_neto || 0) / tcFactura,
        Number(data.monto_iva || 0) / tcFactura,
      )]);
      setPercepciones(data.percepciones?.toString() || "");
      setRetenciones(data.retenciones?.toString() || "");
      setNoGravado(data.no_gravado?.toString() || "");
      setFacturaOriginalId(data.factura_original_id || "");
      setCuentaIdGuardada(data.cuenta_id || null);
      setActividad(data.Actividad_id || "");
      setLabor(data.Labor_id || "");
      if (data.Labor_id) setLaboresSel((prev) => (prev.length > 0 ? prev : [String(data.Labor_id)]));
      setDolar(data.dolar || null);
      setPdfUrl(data.pdf_url || null);
      setCae(data.cae || "");
      setCaeEstado(data.cae ? "valido" : "idle");
      setCaeObservaciones([]);
    });

    supabase.from("factura_alicuotas").select("*").eq("factura_id", id).order("orden").then(({ data }) => {
      if (data && data.length > 0) {
        setLineasIva(data.map((l: any) =>
          lineaDesdeGuardado(String(Number(l.alicuota)), Number(l.neto_original || 0), Number(l.iva_original || 0))));
      }
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
    if (!hayMontos) { alert("Ingresá el monto primero"); return; }

    setCaeEstado("verificando");
    setCaeObservaciones([]);
    try {
      const proveedor = proveedores.find(p => p.id === proveedorId);
      const partes = numeroFactura.split('-');
      const ptoVta = partes.length === 2 ? parseInt(partes[0]) : 1;
      const nroComp = partes.length === 2 ? parseInt(partes[1]) : parseInt(numeroFactura);
      const tipoMap: Record<string, number> = {
        'Factura A': 1, 'Factura B': 6, 'Factura C': 11,
        'Nota de Débito A': 2, 'Nota de Débito B': 7, 'Nota de Débito C': 12,
        'Nota de Crédito A': 3, 'Nota de Crédito B': 8, 'Nota de Crédito C': 13,
      };
      const tipoCbte = tipoMap[tipoComprobante] || 1;
      const fechaAFIP = fecha.replace(/-/g, '');

      // AFIP registra el ImpTotal en la MONEDA ORIGINAL del comprobante.
      // Si la factura es en USD, hay que constatar contra montoTotalPuro
      // (el total en USD), no contra montoTotal (que ya viene convertido
      // a ARS con el tipo de cambio del día).
      const importeParaAfip = moneda === "USD" ? montoTotalPuro : montoTotal;

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
          importe: importeParaAfip,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setCaeEstado("invalido");
        setCaeObservaciones([data.error]);
        console.error("Error ARCA:", data.error);
      } else {
        setCaeEstado(data.valido ? "valido" : "invalido");
        setCaeObservaciones(data.observaciones || []);
      }
    } catch {
      setCaeEstado("invalido");
      setCaeObservaciones(["No se pudo conectar con el servicio de ARCA."]);
    }
  };

  useEffect(() => {
    supabase.from("factura_labores").select("labor_id, factura_id").then(({ data }) => {
      setLaborFactura(Object.fromEntries((data || []).map((x: any) => [String(x.labor_id), String(x.factura_id)])));
      if (id) {
        const mias = (data || []).filter((x: any) => String(x.factura_id) === String(id)).map((x: any) => String(x.labor_id));
        if (mias.length > 0) setLaboresSel(mias);
      }
    });
  }, [id]);

  // Proveedor precargado desde la bandeja de Pendientes (?proveedor=...)
  useEffect(() => {
    if (!id && proveedorParam) { setProveedorId(proveedorParam); setTipo(searchParams.get("tipo") || "Insumos"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, proveedorParam]);

  // Líneas de remito del proveedor: pendientes (sin factura) + las ya
  // vinculadas a ESTA factura (si se está editando).
  useEffect(() => {
    if (!proveedorId) { setLineasRemito([]); return; }
    let q = supabase
      .from("stock_movimientos")
      .select("id, insumo_id, cantidad, fecha, numero_remito, remito_id, factura_id, proveedor_id, insumos(nombre, unidad), remitos(numero, numero_remito, fecha, proveedor_id, factura_id)")
      .eq("tipo", "entrada");
    q = id ? q.or(`factura_id.is.null,factura_id.eq.${id}`) : q.is("factura_id", null);
    q.order("fecha", { ascending: false }).limit(500).then(({ data }) => {
      const delProveedor = (data || []).filter((m: any) =>
        String(m.proveedor_id || m.remitos?.proveedor_id || "") === String(proveedorId) &&
        // si el remito entero ya apunta a otra factura (vínculo viejo), no es pendiente
        (!m.remitos?.factura_id || String(m.remitos.factura_id) === String(id || "") || m.factura_id));
      setLineasRemito(delProveedor);
      const yaMias = new Set<string>(delProveedor.filter((m: any) => id && String(m.factura_id) === String(id)).map((m: any) => String(m.id)));
      setLineasOriginales(yaMias);
      setLineasSel(new Set(yaMias));
    });
  }, [proveedorId, id]);

  const crearLaborDesdeFactura = async () => {
    const { tipo: t, lote: lt, fecha: f, hectareas: h, costo: c } = nuevaLabor;
    if (!t || !lt || !f) { alert("Completá tipo, lote y fecha de la labor"); return; }
    setCreandoLabor(true);
    const { data, error } = await supabase.from("labores").insert([{
      Tipo: t, Lote_id: lt, Fecha: f,
      hectareas: h ? Number(h) : null,
      contratista_id: proveedorId || null,
      labor_propia: false,
      Costo_total: c ? Number(c) : 0,   // costo del contratista en pesos (se controla contra el neto)
    }]).select().single();
    setCreandoLabor(false);
    if (error || !data) { alert("Error creando la labor: " + (error?.message || "")); return; }
    const nombreLote = lotesList.find((x) => String(x.id) === String(lt))?.nombre || "";
    setLabores((prev) => [{ ...data, lotes: { nombre: nombreLote } }, ...prev]);
    setLaboresSel((prev) => [...prev, String(data.id)]);
    setNuevaLabor({ abierto: false, tipo: "", lote: "", fecha: "", hectareas: "", costo: "" });
  };

  const toggleLinea = (lineaId: string) => {
    setLineasSel((prev) => {
      const n = new Set(prev);
      if (n.has(lineaId)) n.delete(lineaId); else n.add(lineaId);
      return n;
    });
  };

  // Agrega las líneas tildadas como ítems de la factura (suma cantidades por
  // insumo; no duplica un insumo que ya esté en los ítems).
  const agregarLineasComoItems = () => {
    const sel = lineasRemito.filter((m) => lineasSel.has(String(m.id)));
    if (sel.length === 0) { alert("Tildá al menos una línea de remito"); return; }
    const porInsumo: Record<string, { nombre: string; unidad: string; cantidad: number }> = {};
    for (const m of sel) {
      const k = String(m.insumo_id);
      if (!porInsumo[k]) porInsumo[k] = { nombre: m.insumos?.nombre || "", unidad: m.insumos?.unidad || "", cantidad: 0 };
      porInsumo[k].cantidad += Number(m.cantidad || 0);
    }
    const nuevos = [...items];
    for (const [insumoId, d] of Object.entries(porInsumo)) {
      const idx = nuevos.findIndex((it) => String(it.insumo_id) === insumoId);
      if (idx >= 0) nuevos[idx] = { ...nuevos[idx], cantidad: String(d.cantidad) };
      else nuevos.push({ descripcion: d.nombre, insumo_id: insumoId, cantidad: String(d.cantidad), unidad: d.unidad, precio_unitario: "", descuento: "0" });
    }
    setItems(nuevos);
    setBusquedaItems({});
  };

  const actualizarLineaIva = (index: number, cambios: Partial<LineaIva>) => {
    setLineasIva((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
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
    if (!fecha || !hayMontos) { alert("Completá fecha y monto"); return; }
    // Una factura de contratista siempre tiene que estar vinculada a al menos
    // una labor: si no, su costo no llega a ningún lote.
    if (tipo === "Labor contratada" && laboresSel.length === 0) {
      alert("Una factura de Labor contratada tiene que tener al menos una labor vinculada.\n\nTildá la labor en la lista o, si no está cargada, creala con \"+ Crear labor que falta\".");
      return;
    }
    // Control: el neto de la factura (en pesos) tiene que coincidir con el
    // costo cargado en las labores (en pesos). Tolerancia: 1% o $1.
    if (tipo === "Labor contratada") {
      const costoLabores = labores.filter((l: any) => laboresSel.includes(String(l.id)))
        .reduce((a: number, l: any) => a + Number(l.Costo_total || 0), 0);
      const dif = montoNeto - costoLabores;
      if (Math.abs(dif) > Math.max(1, montoNeto * 0.01)) {
        const fmtP = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
        const ok = confirm(
          `⚠️ EL GASTO DE LA FACTURA NO COINCIDE CON EL COSTO DE LAS LABORES\n\n` +
          `Neto de la factura: ${fmtP(montoNeto)}\n` +
          `Costo cargado en las labores: ${fmtP(costoLabores)}\n` +
          `Diferencia: ${fmtP(dif)}\n\n` +
          (costoLabores === 0 ? "Las labores no tienen costo cargado.\n\n" : "") +
          `Revisá el monto de la factura o el costo de la labor (Editar labor).\n\n¿Guardar igual?`);
        if (!ok) return;
      }
    }
    const alicuotasRepetidas = lineasIvaValidas.map((l) => Number(l.alicuota))
      .filter((a, i, arr) => arr.indexOf(a) !== i);
    // Aviso: factura en USD con ítems que suman mucho más que el neto →
    // casi seguro se cargaron los precios en pesos.
    if (moneda === "USD" && montoNetoPuro > 0) {
      const sumaItems = items.reduce((acc, it) => acc + calcularTotalItem(it), 0);
      if (sumaItems > montoNetoPuro * 3 &&
          !confirm(`⚠️ La factura es en DÓLARES pero los ítems suman USD ${sumaItems.toLocaleString("es-AR", { maximumFractionDigits: 2 })} contra un neto de USD ${montoNetoPuro.toLocaleString("es-AR", { maximumFractionDigits: 2 })}.\n\nParece que cargaste los precios de los ítems en PESOS. Los precios tienen que ir en USD.\n\n¿Guardar igual?`)) {
        return;
      }
    }
    if (alicuotasRepetidas.length > 0) {
      alert(`La alícuota ${alicuotasRepetidas[0]}% está repetida. Sumá los netos en una sola línea por alícuota.`);
      return;
    }
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
      alicuota_iva: alicuotaPrincipal,
      monto_iva: montoIva,
      percepciones: Number(percepciones || 0),
      retenciones: Number(retenciones || 0),
      no_gravado: Number(noGravado || 0),
      monto_usd: montoEnUSD,
      dolar: dolar,
      moneda: moneda,
      Actividad_id: actividad,
      Labor_id: tipo === "Labor contratada" ? (laboresSel[0] || null) : null,
      factura_original_id: facturaOriginalId || null,
      // Cuenta contable: si es nota por diferencia de cambio → 5.4.04. Si se
      // destildó, se borra solo si era esa cuenta (no pisa una reclasificación
      // hecha a mano desde Contabilidad).
      ...(esNota && porDifCambio && cuentaDifCambioId
        ? { cuenta_id: cuentaDifCambioId }
        : (cuentaIdGuardada && cuentaIdGuardada === cuentaDifCambioId ? { cuenta_id: null } : {})),
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

    // ── Apertura por alícuota (factura_alicuotas) ──
    // Se reemplazan siempre todas las líneas: es la fuente que usan el Libro
    // IVA (PDF) y el TXT de ARCA para el archivo de alícuotas.
    if (facturaId) {
      const tc = moneda === "USD" ? (dolar || 1) : 1;
      await supabase.from("factura_alicuotas").delete().eq("factura_id", facturaId);
      const filasAlicuotas = lineasIvaValidas.map((l, i) => ({
        factura_id: facturaId,
        alicuota: Number(l.alicuota),
        neto_original: r2(Number(l.neto)),
        iva_original: r2(ivaDeLinea(l)),
        neto_ars: r2(Number(l.neto) * tc),
        iva_ars: r2(ivaDeLinea(l) * tc),
        orden: i,
      }));
      if (filasAlicuotas.length > 0) {
        const { error: eAlic } = await supabase.from("factura_alicuotas").insert(filasAlicuotas);
        if (eAlic) { alert("La factura se guardó, pero falló el detalle de alícuotas: " + eAlic.message); }
      }
    }

    // ── Vinculación con labores (contratista) ──
    if (facturaId) {
      await supabase.from("factura_labores").delete().eq("factura_id", facturaId);
      if (tipo === "Labor contratada" && laboresSel.length > 0) {
        const { error: eLab } = await supabase.from("factura_labores")
          .insert(laboresSel.map((lid) => ({ factura_id: facturaId, labor_id: lid })));
        if (eLab) alert("La factura se guardó, pero falló el vínculo con las labores: " + eLab.message);
        // Las labores vinculadas quedan con este proveedor como contratista
        if (proveedorId) {
          await supabase.from("labores").update({ contratista_id: proveedorId }).in("id", laboresSel).is("contratista_id", null);
        }
      }
    }

    // ── Vinculación por renglón con remitos ──
    if (facturaId) {
      const seleccionadas = [...lineasSel];
      const desvincular = [...lineasOriginales].filter((x) => !lineasSel.has(x));
      if (seleccionadas.length > 0) {
        await supabase.from("stock_movimientos").update({ factura_id: facturaId }).in("id", seleccionadas);
      }
      if (desvincular.length > 0) {
        await supabase.from("stock_movimientos").update({ factura_id: null }).in("id", desvincular);
      }
      // remitos.factura_id (vínculo "legado" de un solo valor): solo si TODAS
      // las líneas del remito apuntan a la misma factura.
      const remitosAfectados = [...new Set(lineasRemito
        .filter((m) => seleccionadas.includes(String(m.id)) || desvincular.includes(String(m.id)))
        .map((m) => m.remito_id).filter(Boolean))];
      for (const rid of remitosAfectados) {
        const { data: movs } = await supabase.from("stock_movimientos").select("factura_id").eq("remito_id", rid);
        const ids = new Set((movs || []).map((m: any) => m.factura_id).filter(Boolean));
        const todas = (movs || []).every((m: any) => m.factura_id);
        await supabase.from("remitos").update({ factura_id: ids.size === 1 && todas ? [...ids][0] : null }).eq("id", rid);
      }
    }

    if (remito && facturaId) {
      // Solo vinculamos las líneas de ESTE remito que todavía no tenían
      // factura asignada — así, si el remito cubre más de una factura, no
      // pisamos el vínculo que ya tenía la otra.
      await supabase.from("stock_movimientos")
        .update({ factura_id: facturaId })
        .eq("remito_id", remito)
        .is("factura_id", null);

      // remitos.factura_id es una columna "legado" de un solo vínculo.
      // La actualizamos solo si, después de este cambio, TODAS las líneas
      // del remito terminaron apuntando a la misma factura; si el remito
      // sigue cubriendo más de una, la dejamos en null (el vínculo real
      // vive en cada línea de stock_movimientos).
      const { data: movimientosRemito } = await supabase
        .from("stock_movimientos")
        .select("factura_id")
        .eq("remito_id", remito);
      const facturaIdsDelRemito = new Set((movimientosRemito || []).map((m: any) => m.factura_id).filter(Boolean));
      await supabase.from("remitos")
        .update({ factura_id: facturaIdsDelRemito.size === 1 ? [...facturaIdsDelRemito][0] : null })
        .eq("id", remito);
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
    setTipo(""); setTipoComprobante(""); setLineasIva([lineaIvaVacia()]);
    setPercepciones(""); setRetenciones(""); setNoGravado(""); setFacturaOriginalId("");
    setPorDifCambio(false); setCuentaIdGuardada(null);
    setActividad(""); setLabor(""); setLaboresSel([]); setVerOtrasLabores(false); setRemito(""); setLineasSel(new Set()); setLineasOriginales(new Set()); setDolar(null); setPdfFile(null); setPdfUrl(null);
    setItems([]); setBusquedaItems({}); setMostrarDropdown({});
    setCae(""); setCaeEstado("idle"); setCaeObservaciones([]);
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
                <option>Nota de Débito A</option><option>Nota de Débito B</option><option>Nota de Débito C</option>
                <option>Recibo</option><option>Otro</option>
              </select>
            </div>
            <div><div style={lbl}>N° COMPROBANTE</div><input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} style={input} placeholder="0001-00012345" /></div>
            <div><div style={lbl}>FECHA *</div><input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); obtenerDolarPorFecha(e.target.value).then(setDolar); }} style={input} /></div>
            <div><div style={lbl}>VENCIMIENTO</div><input type="date" value={fechaVto} onChange={(e) => setFechaVto(e.target.value)} style={input} /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lbl}>PROVEEDOR *</div>
              <select value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setCaeEstado("idle"); setCaeObservaciones([]); }} style={input}>
                <option value="">Seleccionar proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}{p.cuit ? ` — ${p.cuit}` : ""}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lbl}>CAE (CÓDIGO DE AUTORIZACIÓN ELECTRÓNICA)</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input
                  value={cae}
                  onChange={(e) => { setCae(e.target.value); setCaeEstado("idle"); setCaeObservaciones([]); }}
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
                  {caeObservaciones.length > 0 && (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {caeObservaciones.map((obs, i) => (
                        <li key={i}>{obs}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {esNota && (
            <div style={{ ...section, background: "#fff8e1", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                📎 Vincular a factura original {esNotaDebito ? "(Nota de Débito)" : "(Nota de Crédito)"}
              </div>
              <div style={lbl}>FACTURA ORIGINAL</div>
              <select value={facturaOriginalId} onChange={(e) => setFacturaOriginalId(e.target.value)} style={input}>
                <option value="">Seleccionar factura</option>
                {facturas.map((f) => (
                  <option key={f.id} value={f.id}>{f.Numero_factura} — {(f.proveedores as any)?.razon_social} — {f.Concepto?.slice(0, 30)}</option>
                ))}
              </select>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <input type="checkbox" checked={porDifCambio} onChange={(e) => setPorDifCambio(e.target.checked)} />
                Por diferencia de cambio
              </label>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4, marginLeft: 24 }}>
                Para la {esNotaDebito ? "ND" : "NC"} que manda el proveedor cuando pagaste en pesos una factura en dólares
                a un dólar distinto al de la factura. Va a la cuenta &ldquo;Diferencias de cambio&rdquo;, no a Stock.
                {!cuentaDifCambioId && <span style={{ color: "#c62828" }}> (Falta correr el SQL de diferencia de cambio en Supabase.)</span>}
              </div>
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
                <option>Insumos</option><option>Labor contratada</option><option>Servicios</option><option>Combustible</option>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
              <div>
                <div style={lbl}>MONEDA</div>
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={input}>
                  <option value="ARS">$ Pesos (ARS)</option>
                  <option value="USD">U$D Dólares (USD)</option>
                </select>
              </div>
              <div>
                <div style={lbl}>TIPO DE CAMBIO</div>
                <input type="number" value={dolar || ""} onChange={(e) => setDolar(Number(e.target.value))} style={input} placeholder="Auto" />
              </div>
            </div>

            {/* NETO E IVA POR ALÍCUOTA */}
            <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={lbl}>NETO E IVA POR ALÍCUOTA {moneda === "USD" ? "(EN USD)" : ""} *</div>
                <button onClick={() => setLineasIva([...lineasIva, lineaIvaVacia(lineasIva)])}
                  style={{ padding: "5px 12px", background: "white", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  + Otra alícuota
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr 40px", gap: 10, fontSize: 11, color: "#888", fontWeight: 600, marginBottom: 2 }}>
                <div>ALÍCUOTA</div><div>NETO</div><div>IVA</div><div></div>
              </div>
              {lineasIva.map((l, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr 40px", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <select value={l.alicuota} onChange={(e) => actualizarLineaIva(i, { alicuota: e.target.value, iva: "" })} style={{ ...input, marginTop: 0 }}>
                    {ALICUOTAS_IVA.map((a) => <option key={a.valor} value={a.valor}>{a.label}</option>)}
                  </select>
                  <input type="number" value={l.neto} onChange={(e) => actualizarLineaIva(i, { neto: e.target.value, iva: "" })} style={{ ...input, marginTop: 0 }} placeholder="0.00" />
                  <input type="number" value={l.iva} onChange={(e) => actualizarLineaIva(i, { iva: e.target.value })}
                    style={{ ...input, marginTop: 0, background: l.iva ? "#fffde7" : "white" }}
                    placeholder={Number(l.neto) > 0 ? ivaCalculado(l).toFixed(2) : "0.00"}
                    title="Se calcula solo. Escribí un valor solo si la factura trae otro (ej. diferencia de centavos)." />
                  <button onClick={() => setLineasIva(lineasIva.length > 1 ? lineasIva.filter((_, j) => j !== i) : [lineaIvaVacia()])}
                    style={{ padding: "8px 0", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", color: "red" }}>✕</button>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                Una línea por alícuota (ej. semilla 10,5% + agroquímico 21%). Para importes exentos usá &ldquo;Exento&rdquo;.
                El IVA se calcula solo; si lo escribís a mano queda resaltado en amarillo.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 16 }}>
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

            {hayMontos && (
              <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 16, fontSize: 13 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {lineasIvaValidas.map((l, i) => {
                    const tc = moneda === "USD" ? (dolar || 1) : 1;
                    const exento = Number(l.alicuota) === 0;
                    return (
                      <Fragment key={i}>
                        <div style={{ color: "#888" }}>{exento ? "Exento:" : `Neto gravado ${l.alicuota}%:`}</div>
                        <div style={{ fontWeight: 600, textAlign: "right" }}>${(Number(l.neto) * tc).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
                        {!exento && <>
                          <div style={{ color: "#888" }}>IVA {l.alicuota}%:</div>
                          <div style={{ fontWeight: 600, textAlign: "right" }}>${(ivaDeLinea(l) * tc).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
                        </>}
                      </Fragment>
                    );
                  })}
                  {Number(noGravado) > 0 && <>
                    <div style={{ color: "#888" }}>No gravado:</div>
                    <div style={{ fontWeight: 600, textAlign: "right" }}>${Number(noGravado).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div>
                  </>}
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

          {/* Solo Insumos (remitos) y Labor contratada (labores) se vinculan.
              Servicios generales y combustible no piden vínculo. */}
          {(tipo === "Insumos" || tipo === "Labor contratada") && (
          <div style={section}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              {tipo === "Insumos" ? "📦 Remitos pendientes de facturar" : "🚜 Labores de esta factura"}
            </div>

            {tipo === "Insumos" ? (
              !proveedorId ? (
                <p style={{ color: "#999", fontSize: 13, margin: 0 }}>Elegí el proveedor arriba para ver sus remitos pendientes de facturar.</p>
              ) : lineasRemito.length === 0 ? (
                <p style={{ color: "#999", fontSize: 13, margin: 0 }}>
                  Este proveedor no tiene remitos pendientes de facturar. (Si la mercadería todavía no llegó, guardá la factura igual: queda en la bandeja de Pendientes.)
                </p>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                    Remitos de <strong>{proveedores.find((p) => p.id === proveedorId)?.razon_social}</strong> sin facturar.
                    Tildá las líneas que corresponden a esta factura.
                  </div>
                  <div style={{ border: "1px solid #eee", borderRadius: 8, maxHeight: 280, overflowY: "auto" }}>
                    {lineasRemito.map((m) => {
                      const sel = lineasSel.has(String(m.id));
                      const item = items.find((it) => String(it.insumo_id) === String(m.insumo_id));
                      const difCantidad = sel && item && Math.abs(Number(item.cantidad || 0) -
                        lineasRemito.filter((x) => lineasSel.has(String(x.id)) && String(x.insumo_id) === String(m.insumo_id))
                          .reduce((a, x) => a + Number(x.cantidad || 0), 0)) > 0.001;
                      return (
                        <label key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f3f3f3", cursor: "pointer", background: sel ? "#f0faf4" : "white", fontSize: 13 }}>
                          <input type="checkbox" checked={sel} onChange={() => toggleLinea(String(m.id))} />
                          <span style={{ color: "#888", minWidth: 150 }}>
                            {m.remitos?.numero ? `R-${String(m.remitos.numero).padStart(3, "0")}` : "Remito"} · {m.remitos?.numero_remito || m.numero_remito || "s/n"} · {m.fecha || m.remitos?.fecha || ""}
                          </span>
                          <span style={{ fontWeight: 600, flex: 1 }}>{m.insumos?.nombre || "Insumo"}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{Number(m.cantidad).toLocaleString("es-AR")} {m.insumos?.unidad || ""}</span>
                          {difCantidad && <span title="La cantidad del ítem no coincide con la del remito" style={{ color: "#e65100" }}>⚠️</span>}
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: "#888" }}>{lineasSel.size} línea(s) seleccionada(s) — se vinculan al guardar.</span>
                    <button onClick={agregarLineasComoItems}
                      style={{ padding: "8px 14px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      ⬆ Agregar seleccionadas a los ítems
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                    Los ítems quedan con insumo y cantidad del remito: solo cargá el precio {moneda === "USD" ? "(en USD)" : "(en pesos)"}.
                  </div>
                </div>
              )
            ) : (() => {
              // Labores candidatas: sin factura (o ya de ESTA factura), no propias,
              // del contratista elegido (o de cualquiera si se pide ver todas).
              const filtrar = (todas: boolean) => labores.filter((l: any) => {
                const fac = laborFactura[String(l.id)];
                const libre = !fac || String(fac) === String(id || "");
                if (!libre && !laboresSel.includes(String(l.id))) return false;
                if (laboresSel.includes(String(l.id))) return true;
                if (l.labor_propia) return false;
                if (todas) return true;
                return proveedorId && String(l.contratista_id || "") === String(proveedorId);
              });
              // Si el contratista no tiene labores propias pendientes (ej. labores
              // viejas cargadas sin contratista), se muestran todas las libres.
              const delContratista = filtrar(false);
              const mostrandoTodas = verOtrasLabores || (!!proveedorId && delContratista.filter((l: any) => !laboresSel.includes(String(l.id))).length === 0);
              const candidatas = mostrandoTodas ? filtrar(true) : delContratista;
              const sel = labores.filter((l: any) => laboresSel.includes(String(l.id)));
              const haSel = sel.reduce((a: number, l: any) => a + Number(l.hectareas || 0), 0);
              const costoEsperado = sel.reduce((a: number, l: any) => a + Number(l.Costo_total || 0), 0);
              const noCoincide = sel.length > 0 && montoNeto > 0 && Math.abs(montoNeto - costoEsperado) > Math.max(1, montoNeto * 0.01);
              return (
                <div>
                  {!proveedorId && !verOtrasLabores && (
                    <p style={{ color: "#999", fontSize: 13, margin: "0 0 8px" }}>Elegí el contratista (proveedor) para ver sus labores sin factura.</p>
                  )}
                  {mostrandoTodas && !verOtrasLabores && candidatas.length > 0 && (
                    <p style={{ color: "#e65100", fontSize: 12, margin: "0 0 8px" }}>
                      Este contratista no tiene labores asignadas sin factura: se muestran todas las labores sin factura.
                      Al vincular una, queda asignada a este contratista.
                    </p>
                  )}
                  {candidatas.length === 0 && (proveedorId || verOtrasLabores) && (
                    <p style={{ color: "#999", fontSize: 13, margin: "0 0 8px" }}>
                      No hay labores {verOtrasLabores ? "" : "de este contratista "}sin factura.
                      {!verOtrasLabores && " Si la labor se cargó sin contratista, tildá “mostrar también otras labores”."}
                    </p>
                  )}
                  {candidatas.length > 0 && (
                    <div style={{ border: "1px solid #eee", borderRadius: 8, maxHeight: 280, overflowY: "auto" }}>
                      {candidatas.map((l: any) => {
                        const marcado = laboresSel.includes(String(l.id));
                        return (
                          <label key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f3f3f3", cursor: "pointer", background: marcado ? "#f0faf4" : "white", fontSize: 13 }}>
                            <input type="checkbox" checked={marcado}
                              onChange={() => setLaboresSel((prev) => marcado ? prev.filter((x) => x !== String(l.id)) : [...prev, String(l.id)])} />
                            <span style={{ color: "#888", minWidth: 90 }}>{l.Fecha}</span>
                            <span style={{ fontWeight: 600, minWidth: 120 }}>{l.Tipo}</span>
                            <span style={{ flex: 1 }}>{l.lotes?.nombre || "Sin lote"}</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", color: "#555" }}>{l.hectareas ? `${l.hectareas} ha` : "— ha"}</span>
                            {!l.contratista_id && <span style={{ fontSize: 11, color: "#999" }}>(sin contratista)</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, marginTop: 8, color: "#555", cursor: "pointer" }}>
                    <input type="checkbox" checked={verOtrasLabores} onChange={(e) => setVerOtrasLabores(e.target.checked)} />
                    Mostrar también otras labores sin factura (sin contratista o de otro contratista)
                  </label>

                  {/* Alta rápida de la labor que falta */}
                  {!nuevaLabor.abierto ? (
                    <button onClick={() => {
                      // costo sugerido = lo que falta para llegar al neto de la factura
                      const yaCargado = labores.filter((l: any) => laboresSel.includes(String(l.id))).reduce((a: number, l: any) => a + Number(l.Costo_total || 0), 0);
                      const resto = Math.max(montoNeto - yaCargado, 0);
                      setNuevaLabor({ ...nuevaLabor, abierto: true, fecha: nuevaLabor.fecha || fecha, costo: resto ? resto.toFixed(2) : "" });
                    }}
                      style={{ marginTop: 10, padding: "7px 14px", background: "white", border: "1px dashed #0f1f17", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      + Crear labor que falta
                    </button>
                  ) : (
                    <div style={{ marginTop: 10, border: "1px solid #c3e6cb", background: "#f0faf4", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Nueva labor{proveedorId ? ` de ${proveedores.find((p) => p.id === proveedorId)?.razon_social || ""}` : ""}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 140px", gap: 8 }}>
                        <select value={nuevaLabor.tipo} onChange={(e) => setNuevaLabor({ ...nuevaLabor, tipo: e.target.value })} style={{ ...input, marginTop: 0 }}>
                          <option value="">Tipo…</option>
                          <option>Siembra</option><option>Fertilización</option><option>Pulverización</option><option>Cosecha</option>
                        </select>
                        <select value={nuevaLabor.lote} onChange={(e) => setNuevaLabor({ ...nuevaLabor, lote: e.target.value })} style={{ ...input, marginTop: 0 }}>
                          <option value="">Lote…</option>
                          {lotesList.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </select>
                        <input type="date" value={nuevaLabor.fecha} onChange={(e) => setNuevaLabor({ ...nuevaLabor, fecha: e.target.value })} style={{ ...input, marginTop: 0 }} />
                        <input type="number" placeholder="Ha" value={nuevaLabor.hectareas} onChange={(e) => setNuevaLabor({ ...nuevaLabor, hectareas: e.target.value })} style={{ ...input, marginTop: 0 }} />
                        <input type="number" placeholder="Costo $ (neto)" value={nuevaLabor.costo} onChange={(e) => setNuevaLabor({ ...nuevaLabor, costo: e.target.value })} style={{ ...input, marginTop: 0 }}
                          title="Costo del contratista para esta labor, en pesos y sin IVA. Viene sugerido con lo que falta para llegar al neto de la factura." />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                        <button onClick={crearLaborDesdeFactura} disabled={creandoLabor}
                          style={{ padding: "7px 14px", background: "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                          {creandoLabor ? "Creando…" : "Crear y vincular"}
                        </button>
                        <button onClick={() => setNuevaLabor({ abierto: false, tipo: "", lote: "", fecha: "", hectareas: "", costo: "" })}
                          style={{ padding: "7px 12px", background: "white", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                        <span style={{ fontSize: 11, color: "#888" }}>La campaña se asigna sola por la fecha. Si la labor usó insumos del stock, agregalos después en Editar labor.</span>
                      </div>
                    </div>
                  )}
                  {sel.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, background: "#f8f9fa", borderRadius: 6, padding: "8px 12px" }}>
                      {sel.length} labor(es) · {haSel.toLocaleString("es-AR")} ha.
                      {sel.length > 1 && " El neto se reparte entre ellas por hectárea."}
                      {noCoincide ? (
                        <div style={{ color: "#c62828", marginTop: 6, fontWeight: 600, background: "#ffebee", padding: "6px 10px", borderRadius: 6 }}>
                          ⚠️ No coincide: neto de la factura ${montoNeto.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ·
                          costo de las labores ${costoEsperado.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ·
                          diferencia ${(montoNeto - costoEsperado).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                          {costoEsperado === 0 && " (las labores no tienen costo cargado)"}
                        </div>
                      ) : (
                        <div style={{ color: "#2e7d32", marginTop: 6, fontWeight: 600 }}>✅ El neto coincide con el costo de las labores</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          )}

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
          {esNotaDebito && (
            <div style={{ background: "#e3f2fd", borderRadius: 12, padding: 16, fontSize: 13, color: "#0d47a1" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>ℹ️ Nota de Débito</div>
              Este comprobante aumenta el saldo con el proveedor.
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