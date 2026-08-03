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
  const [planExpandido, setPlanExpandido] = useState<string | null>(null);
  const [seguimientoPorPlan, setSeguimientoPorPlan] = useState<Record<string, any[]>>({});
  const [cargandoSeguimiento, setCargandoSeguimiento] = useState<string | null>(null);

  // Normaliza nombres de labor para que variantes del mismo trabajo cuenten
  // como una sola cosa (ej. "Pulverización terrestre gruesa" = "Pulverización").
  const normalizarTipoLabor = (nombre: string) => {
    const n = (nombre || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (n.includes("pulveriz")) return "Pulverización";
    if (n.includes("siembra")) return "Siembra";
    if (n.includes("cosech")) return "Cosecha";
    if (n.includes("fertiliz")) return "Fertilización";
    if (n.includes("fumig")) return "Fumigación";
    if (n.includes("labranza") || n.includes("rastra") || n.includes("disco") || n.includes("arada")) return "Labranza";
    return (nombre || "Labor").trim();
  };

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    const [{ data: planesData }, { data: insumosData }, { data: preciosData }] = await Promise.all([
      supabase.from("planes_cultivo").select("*, plan_items(*)").order("created_at", { ascending: false }),
      supabase.from("insumos").select().order("nombre"),
      // precios_insumos ahora es un HISTORIAL (se inserta, no se pisa). Traemos
      // ordenado por fecha desc para quedarnos con el precio más reciente por insumo.
      supabase.from("precios_insumos").select("*").order("fecha_actualizacion", { ascending: false }),
    ]);
    setPlanes(planesData || []);
    setInsumos(insumosData || []);
    const map: Record<string, number> = {};
    (preciosData || []).forEach((p: any) => {
      if (!(p.insumo_id in map)) map[p.insumo_id] = p.precio; // el primero que aparece es el más reciente
    });
    setPreciosInsumos(map);
    return planesData || [];
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

  // ── SEGUIMIENTO: presupuesto vs. cómo se viene haciendo realmente ────────
  // Agrupa los ítems del plan en "aplicaciones": cada ítem LABOR abre un grupo
  // nuevo, y los insumos que le siguen en el orden del plan pertenecen a esa
  // aplicación. Cada grupo se matchea con la labor REAL correspondiente según
  // el orden cronológico (la 1ª aplicación planificada de un tipo con la 1ª
  // real de ese tipo, la 2ª con la 2ª, etc.) — así una aplicación pendiente no
  // queda marcada como completa solo porque se hizo OTRA aplicación del mismo
  // tipo. Dentro de cada aplicación, se compara insumo por insumo contra lo
  // que efectivamente se descargó de stock para ESA labor puntual (no contra
  // todo lo aplicado en el plan), y se listan aparte los productos que se
  // usaron sin estar presupuestados en esa aplicación.
  const calcularSeguimiento = async (plan: any) => {
    const { data: lotesPlan } = await supabase.from("lotes").select("id, nombre, hectareas").eq("plan_id", plan.id);
    const lotes = lotesPlan || [];
    const loteIds = lotes.map((l: any) => l.id);
    const haTotal = lotes.reduce((acc: number, l: any) => acc + (Number(l.hectareas) || 0), 0);

    if (loteIds.length === 0) return [];

    const { data: laboresData } = await supabase
      .from("labores")
      .select("id, Tipo, Fecha, Lote_id, Costo_total, hectareas")
      .in("Lote_id", loteIds);
    const labores = laboresData || [];
    const laborIds = labores.map((l: any) => l.id);

    const { data: salidasCrudas } = laborIds.length
      ? await supabase
          .from("stock_movimientos")
          .select("insumo_id, cantidad, referencia_id, factura_item_id, fecha, tipo, motivo")
          .in("referencia_id", laborIds)
      : { data: [] as any[] };
    // Tolerante a mayúsculas/minúsculas en tipo/motivo, por si vienen distinto en la base.
    const salidas = (salidasCrudas || []).filter((s: any) =>
      (s.tipo || "").toLowerCase() === "salida" && (s.motivo || "").toLowerCase() === "labor"
    );

    const facturaItemIds = [...new Set(salidas.map((s: any) => s.factura_item_id).filter(Boolean))];
    const { data: facturaItemsData } = facturaItemIds.length
      ? await supabase.from("factura_items").select("id, factura_id, precio_unitario, precio_neto").in("id", facturaItemIds)
      : { data: [] as any[] };
    const facturaIds = [...new Set((facturaItemsData || []).map((fi: any) => fi.factura_id).filter(Boolean))];
    const { data: facturasData } = facturaIds.length
      ? await supabase.from("facturas").select("id, moneda, dolar").in("id", facturaIds)
      : { data: [] as any[] };

    const facturaItemsPorId: Record<string, any> = {};
    (facturaItemsData || []).forEach((fi: any) => { facturaItemsPorId[fi.id] = fi; });
    const facturasPorId: Record<string, any> = {};
    (facturasData || []).forEach((f: any) => { facturasPorId[f.id] = f; });

    // Link directo salida → factura_item (cuando el movimiento de stock quedó
    // vinculado a la factura de compra puntual). En la práctica los movimientos
    // de "salida por labor" casi nunca tienen este link (la factura es de la
    // compra/entrada, no del consumo), así que además armamos un fallback abajo
    // buscando la compra de ese insumo más cercana en fecha a la aplicación.
    const precioMovUSDDirecto = (s: any): number | null => {
      if (!s.factura_item_id) return null;
      const fi = facturaItemsPorId[s.factura_item_id];
      if (!fi) return null;
      const precio = fi.precio_neto ?? fi.precio_unitario;
      if (precio == null) return null;
      const factura = facturasPorId[fi.factura_id];
      if (!factura || factura.moneda === "USD" || !factura.dolar) return Number(precio);
      return Number(precio) / Number(factura.dolar);
    };

    // Fallback: buscamos, para cada insumo involucrado, todas sus compras
    // (factura_items) y quedamos con la más cercana (idealmente anterior) a la
    // fecha de la aplicación real. Esto es lo que realmente resuelve el caso
    // típico: la salida no tiene factura propia, pero sabemos a cuánto se
    // compró ese insumo alrededor de esa fecha.
    const insumoIdsRelevantes = [...new Set([
      ...salidas.map((s: any) => s.insumo_id),
      ...(plan.plan_items || []).map((i: any) => i.insumo_id),
    ].filter(Boolean))];
    const { data: comprasInsumoData } = insumoIdsRelevantes.length
      ? await supabase.from("factura_items").select("id, factura_id, insumo_id, precio_unitario, precio_neto").in("insumo_id", insumoIdsRelevantes)
      : { data: [] as any[] };
    const facturaIdsCompras = [...new Set((comprasInsumoData || []).map((fi: any) => fi.factura_id).filter(Boolean))];
    const { data: facturasComprasData } = facturaIdsCompras.length
      ? await supabase.from("facturas").select("id, Fecha, moneda, dolar").in("id", facturaIdsCompras)
      : { data: [] as any[] };
    const facturasComprasPorId: Record<string, any> = {};
    (facturasComprasData || []).forEach((f: any) => { facturasComprasPorId[f.id] = f; });

    const comprasPorInsumo: Record<string, { fecha: string; precioUSD: number; precioARS: number | null; dolar: number | null }[]> = {};
    for (const fi of comprasInsumoData || []) {
      const factura = facturasComprasPorId[fi.factura_id];
      if (!factura || !factura.Fecha) continue;
      const precio = fi.precio_neto ?? fi.precio_unitario;
      if (precio == null) continue;
      let precioUSD: number | null = null;
      let precioARS: number | null = null;
      if (factura.moneda === "USD") {
        precioUSD = Number(precio);
        precioARS = factura.dolar ? Number(precio) * Number(factura.dolar) : null;
      } else {
        precioARS = Number(precio);
        precioUSD = factura.dolar ? Number(precio) / Number(factura.dolar) : null;
      }
      if (precioUSD == null) continue;
      (comprasPorInsumo[fi.insumo_id] ||= []).push({ fecha: factura.Fecha, precioUSD, precioARS, dolar: factura.dolar ? Number(factura.dolar) : null });
    }
    Object.values(comprasPorInsumo).forEach(arr => arr.sort((a, b) => a.fecha.localeCompare(b.fecha)));

    const compraCercana = (insumoId: string, fechaObjetivo: string | null) => {
      const lista = comprasPorInsumo[insumoId] || [];
      if (!lista.length) return null;
      if (!fechaObjetivo) return lista[lista.length - 1];
      const anteriores = lista.filter(c => c.fecha <= fechaObjetivo);
      if (anteriores.length) return anteriores[anteriores.length - 1];
      return lista[0]; // no hay compra anterior a la fecha: usamos la más próxima disponible
    };

    // Precio pagado real de un movimiento: exacto si está linkeado, si no la
    // compra más cercana a la fecha de la aplicación.
    const precioMovUSD = (s: any): number | null => {
      const directo = precioMovUSDDirecto(s);
      if (directo != null) return directo;
      const cercana = compraCercana(s.insumo_id, s.fecha || null);
      return cercana ? cercana.precioUSD : null;
    };
    const dolarDeMovimiento = (s: any): number | null => {
      if (s.factura_item_id) {
        const fi = facturaItemsPorId[s.factura_item_id];
        const factura = fi ? facturasPorId[fi.factura_id] : null;
        if (factura?.dolar) return Number(factura.dolar);
      }
      const cercana = compraCercana(s.insumo_id, s.fecha || null);
      return cercana?.dolar ?? null;
    };
    // Costo del movimiento en pesos (para poder restarle a Costo_total de la labor,
    // que según nos confirmaron incluye insumos + servicio en pesos).
    const montoARSdeMovimiento = (s: any): number | null => {
      if (s.factura_item_id) {
        const fi = facturaItemsPorId[s.factura_item_id];
        if (fi) {
          const precio = fi.precio_neto ?? fi.precio_unitario;
          const factura = facturasPorId[fi.factura_id];
          if (precio != null && factura) {
            if (factura.moneda === "USD" && factura.dolar) return Number(precio) * Number(s.cantidad) * Number(factura.dolar);
            if (factura.moneda !== "USD") return Number(precio) * Number(s.cantidad);
          }
        }
      }
      const cercana = compraCercana(s.insumo_id, s.fecha || null);
      if (cercana?.precioARS != null) return cercana.precioARS * Number(s.cantidad);
      return null;
    };

    // Movimientos reales agrupados por labor real puntual (no por tipo/insumo global)
    const salidasPorLabor: Record<string, any[]> = {};
    for (const s of salidas) {
      (salidasPorLabor[s.referencia_id] ||= []).push(s);
    }

    // Cola de labores reales por tipo normalizado, ordenadas por fecha —
    // así se matchea la 1ª aplicación planificada con la 1ª real, etc.
    const laboresPorTipo: Record<string, any[]> = {};
    for (const l of labores) {
      const tipoNorm = normalizarTipoLabor(l.Tipo);
      (laboresPorTipo[tipoNorm] ||= []).push(l);
    }
    Object.values(laboresPorTipo).forEach((arr: any) => arr.sort((a: any, b: any) => (a.Fecha || "").localeCompare(b.Fecha || "")));
    const punteroPorTipo: Record<string, number> = {};

    // Agrupar ítems del plan en aplicaciones (cada LABOR abre grupo, los insumos
    // que siguen pertenecen a esa aplicación) respetando el orden del plan.
    const itemsOrdenados = [...(plan.plan_items || [])].sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0));
    const grupos: any[] = [];
    let grupoActual: any = null;
    for (const item of itemsOrdenados) {
      const esLabor = (item.categoria || "").toUpperCase() === "LABOR";
      if (esLabor || !grupoActual) {
        grupoActual = { laborItem: esLabor ? item : null, insumoItems: esLabor ? [] : [] };
        grupos.push(grupoActual);
        if (!esLabor) grupoActual.insumoItems.push(item);
      } else {
        grupoActual.insumoItems.push(item);
      }
    }

    return grupos.map((grupo) => {
      const laborItem = grupo.laborItem;
      let laborReal: any = null;
      if (laborItem) {
        const tipoNorm = normalizarTipoLabor(laborItem.descripcion);
        const cola = laboresPorTipo[tipoNorm] || [];
        const i = punteroPorTipo[tipoNorm] || 0;
        laborReal = cola[i] || null;
        punteroPorTipo[tipoNorm] = i + 1;
      }

      const movimientosDeEstaAplicacion = laborReal ? (salidasPorLabor[laborReal.id] || []) : [];
      const idsPlanificados = new Set(grupo.insumoItems.map((i: any) => i.insumo_id).filter(Boolean));

      const insumosCalculados = grupo.insumoItems.map((item: any) => {
        const dosisPlan = Number(item.cantidad_por_ha) || 0;
        const planificado = dosisPlan * haTotal;
        const movsItem = movimientosDeEstaAplicacion.filter((s: any) => s.insumo_id === item.insumo_id);
        const cantidadAuto = movsItem.reduce((acc: number, s: any) => acc + Number(s.cantidad), 0);
        const realizado = item.cantidad_real_manual != null ? Number(item.cantidad_real_manual) : cantidadAuto;
        const movsConPrecio = movsItem.filter((s: any) => precioMovUSD(s) != null);
        const totalPonderado = movsConPrecio.reduce((acc: number, s: any) => acc + (precioMovUSD(s) as number) * Number(s.cantidad), 0);
        const cantidadConPrecio = movsConPrecio.reduce((acc: number, s: any) => acc + Number(s.cantidad), 0);
        const precioAuto = cantidadConPrecio > 0 ? totalPonderado / cantidadConPrecio : null;
        const precioEsAproximado = precioAuto != null && !movsItem.some((s: any) => precioMovUSDDirecto(s) != null);
        // Si no hubo NADA de movimiento para este insumo en esta aplicación puntual,
        // igual mostramos el último precio de compra conocido como referencia informativa.
        const precioSinMovimiento = movsItem.length === 0 ? compraCercana(item.insumo_id, laborReal ? laborReal.Fecha : null) : null;
        const precioFinalAuto = precioAuto ?? (precioSinMovimiento ? precioSinMovimiento.precioUSD : null);
        const precioReal = item.precio_real_manual != null ? Number(item.precio_real_manual) : precioFinalAuto;
        return {
          itemId: item.id,
          nombre: item.descripcion,
          categoria: item.categoria,
          planificado,
          realizado,
          unidad: item.unidad,
          fechaPresupuestada: item.fecha_aplicacion,
          fechaReal: item.fecha_real_manual || (laborReal ? laborReal.Fecha : null),
          fechaEsManual: !!item.fecha_real_manual,
          precioPresupuestado: preciosInsumos[item.insumo_id] || null,
          precioReal,
          precioEsManual: item.precio_real_manual != null,
          precioEsAproximado: item.precio_real_manual == null && (precioEsAproximado || (precioAuto == null && precioSinMovimiento != null)),
          sinPrecioDisponible: precioReal == null,
        };
      });

      // Productos aplicados en esta labor real que NO estaban presupuestados en el grupo
      const extrasMap: Record<string, { insumo_id: string; cantidad: number; totalPrecio: number; cantPrecio: number }> = {};
      for (const s of movimientosDeEstaAplicacion) {
        if (idsPlanificados.has(s.insumo_id)) continue;
        const acc = extrasMap[s.insumo_id] || { insumo_id: s.insumo_id, cantidad: 0, totalPrecio: 0, cantPrecio: 0 };
        acc.cantidad += Number(s.cantidad);
        const precio = precioMovUSD(s);
        if (precio != null) { acc.totalPrecio += precio * Number(s.cantidad); acc.cantPrecio += Number(s.cantidad); }
        extrasMap[s.insumo_id] = acc;
      }
      const extras = Object.values(extrasMap).map((e) => {
        const insumoInfo = insumos.find(i => i.id === e.insumo_id);
        return {
          insumo_id: e.insumo_id,
          nombre: insumoInfo?.nombre || "Insumo sin identificar",
          unidad: insumoInfo?.unidad || "",
          cantidad: e.cantidad,
          precio: e.cantPrecio > 0 ? e.totalPrecio / e.cantPrecio : null,
        };
      });

      let laborInfo: any = null;
      if (laborItem) {
        const costoTotalARS = laborReal ? Number(laborReal.Costo_total) || 0 : null;
        const costoInsumosARS = laborReal
          ? movimientosDeEstaAplicacion.reduce((acc: number, s: any) => acc + (montoARSdeMovimiento(s) || 0), 0)
          : null;
        const costoServicioARS = (costoTotalARS != null && costoInsumosARS != null) ? costoTotalARS - costoInsumosARS : null;
        const dolarAprox = movimientosDeEstaAplicacion.map(dolarDeMovimiento).find((d: any) => d != null) || null;
        const costoServicioUSDporHa = (costoServicioARS != null && laborReal?.hectareas && dolarAprox)
          ? (costoServicioARS / dolarAprox) / Number(laborReal.hectareas)
          : null;
        const presupuestadoUSDporHa = laborItem.cantidad_por_ha ? Number(laborItem.cantidad_por_ha) : null;
        laborInfo = {
          itemId: laborItem.id,
          nombre: laborItem.descripcion,
          categoria: laborItem.categoria,
          realizado: laborReal ? 1 : 0,
          fechaPresupuestada: laborItem.fecha_aplicacion,
          fechaReal: laborItem.fecha_real_manual || (laborReal ? laborReal.Fecha : null),
          fechaEsManual: !!laborItem.fecha_real_manual,
          costoTotalARS, costoInsumosARS, costoServicioARS,
          costoServicioUSDporHa, presupuestadoUSDporHa,
        };
      }

      return { laborInfo, insumos: insumosCalculados, extras };
    });
  };

  const toggleSeguimiento = async (plan: any) => {
    if (planExpandido === plan.id) { setPlanExpandido(null); return; }
    setPlanExpandido(plan.id);
    if (seguimientoPorPlan[plan.id]) return;
    setCargandoSeguimiento(plan.id);
    const grupos = await calcularSeguimiento(plan);
    setSeguimientoPorPlan(prev => ({ ...prev, [plan.id]: grupos }));
    setCargandoSeguimiento(null);
  };

  // Override manual: se usa cuando todavía no hay factura/movimiento cargado
  // y querés anotar a mano lo que realmente pasó en el campo.
  const guardarOverrideReal = async (planId: string, itemId: string, campo: "fecha_real_manual" | "cantidad_real_manual" | "precio_real_manual", valorTexto: string) => {
    const valor = valorTexto === "" ? null : (campo === "fecha_real_manual" ? valorTexto : Number(valorTexto));
    await supabase.from("plan_items").update({ [campo]: valor }).eq("id", itemId);
    const planesActualizados = await cargarDatos();
    const planFresco = (planesActualizados || []).find((p: any) => p.id === planId);
    if (planFresco) {
      const grupos = await calcularSeguimiento(planFresco);
      setSeguimientoPorPlan(prev => ({ ...prev, [planId]: grupos }));
    }
  };

  const planesFiltrados = planes.filter(p => !filtroCultivo || p.cultivo === filtroCultivo);
  const totalItemsForm = items.reduce((acc, i) => acc + (calcularUSDporHA(i) || 0), 0);

  const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: 0.3, marginBottom: 3, display: "block" };
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap", background: "#f8f9fa" };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f0f0f0" };
  const inputChico: React.CSSProperties = { width: 100, padding: "4px 6px", borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 12, textAlign: "right" };
  const inputFechaChico: React.CSSProperties = { width: 130, padding: "4px 6px", borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 12 };
  const estadoBadge = (tipo: "completo" | "parcial" | "pendiente" | "sustituido") => {
    const estilos: Record<string, React.CSSProperties> = {
      completo: { background: "#e8f5e9", color: "#2e7d32" },
      parcial: { background: "#fff8e1", color: "#f57f17" },
      pendiente: { background: "#fff3e0", color: "#e65100" },
      sustituido: { background: "#fce4ec", color: "#ad1457" },
    };
    const textos: Record<string, string> = { completo: "✅ Completo", parcial: "🔄 Parcial", pendiente: "🔲 Pendiente", sustituido: "🔁 Sustituido" };
    return <span style={{ ...estilos[tipo], padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{textos[tipo]}</span>;
  };

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
              <button onClick={() => toggleSeguimiento(plan)} style={{ padding: "8px 16px", background: planExpandido === plan.id ? "#0f1f17" : "#f5f5f5", color: planExpandido === plan.id ? "white" : "#0f1f17", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                📊 Seguimiento
              </button>
              <button onClick={() => abrirEdicion(plan)} style={{ padding: "8px 16px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✏️ Editar</button>
              <button onClick={() => eliminarPlan(plan.id, plan.nombre)} style={{ padding: "8px 12px", background: "#fee", border: "1px solid #fcc", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "red" }}>🗑</button>
            </div>
          </div>

          {planExpandido === plan.id && (
            <div style={{ padding: "16px 20px", background: "#fbfbf9", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📊 Presupuesto vs. cómo se viene haciendo</div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 14 }}>
                Cada aplicación planificada se compara con la real correspondiente en orden cronológico. Los campos vacíos se pueden completar a mano.
              </div>
              {cargandoSeguimiento === plan.id ? (
                <p style={{ fontSize: 13, color: "#888" }}>Cargando...</p>
              ) : !seguimientoPorPlan[plan.id] || seguimientoPorPlan[plan.id].length === 0 ? (
                <p style={{ fontSize: 13, color: "#888" }}>Todavía no hay lotes usando este plan, o el plan no tiene ítems.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {seguimientoPorPlan[plan.id].map((grupo: any, gi: number) => (
                    <div key={gi} style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden", background: "white" }}>
                      {grupo.laborInfo && (
                        <>
                          <div style={{ padding: "10px 14px", background: "#f3f8f5", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, background: colorCategoria.LABOR }}>LABOR</span>
                              <strong style={{ fontSize: 13 }}>{grupo.laborInfo.nombre}</strong>
                              <span style={{ color: "#888", fontSize: 12 }}>{grupo.laborInfo.fechaPresupuestada || "—"} →</span>
                              <input
                                type="date"
                                defaultValue={grupo.laborInfo.fechaReal || ""}
                                style={{ ...inputFechaChico, background: grupo.laborInfo.fechaEsManual ? "#fffde7" : "white" }}
                                onBlur={(e) => guardarOverrideReal(plan.id, grupo.laborInfo.itemId, "fecha_real_manual", e.target.value)}
                              />
                            </div>
                            {estadoBadge(grupo.laborInfo.realizado ? "completo" : "pendiente")}
                          </div>
                          {grupo.laborInfo.realizado === 1 && (
                            <div style={{ padding: "6px 14px", fontSize: 12, color: "#555", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
                              Costo real de la aplicación: <strong>$ {grupo.laborInfo.costoTotalARS?.toLocaleString("es-AR")}</strong>
                              {grupo.laborInfo.costoInsumosARS != null && (
                                <> &nbsp;(insumos $ {grupo.laborInfo.costoInsumosARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} + servicio $ {grupo.laborInfo.costoServicioARS?.toLocaleString("es-AR", { maximumFractionDigits: 0 })})</>
                              )}
                              {grupo.laborInfo.presupuestadoUSDporHa != null && grupo.laborInfo.costoServicioUSDporHa != null ? (
                                <div style={{ marginTop: 2 }}>
                                  Servicio: presupuestado USD {grupo.laborInfo.presupuestadoUSDporHa.toFixed(2)}/ha vs. real USD {grupo.laborInfo.costoServicioUSDporHa.toFixed(2)}/ha
                                </div>
                              ) : (
                                <div style={{ marginTop: 2, color: "#aaa" }}>Sin costo de servicio presupuestado para comparar (cargalo en "DOSIS/HA" de este ítem al editar el plan).</div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {grupo.insumos.length > 0 && (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th style={th}>INSUMO</th>
                              <th style={{ ...th, textAlign: "right" }}>PLANIFICADO</th>
                              <th style={{ ...th, textAlign: "right" }}>REALIZADO</th>
                              <th style={{ ...th, textAlign: "right" }}>PRECIO REF. → PAGADO</th>
                              <th style={{ ...th, textAlign: "center" }}>ESTADO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.insumos.map((f: any, i: number) => {
                              const completo = f.planificado > 0 && f.realizado >= f.planificado;
                              const parcial = !completo && f.realizado > 0;
                              const diferenciaPrecio = f.precioPresupuestado && f.precioReal
                                ? ((f.precioReal - f.precioPresupuestado) / f.precioPresupuestado) * 100
                                : null;
                              let estado: "completo" | "parcial" | "pendiente" | "sustituido" = "pendiente";
                              if (completo) estado = "completo";
                              else if (parcial) estado = "parcial";
                              else if (grupo.laborInfo?.realizado === 1) estado = "sustituido"; // la labor se hizo pero este insumo no se usó
                              return (
                                <tr key={i}>
                                  <td style={td}>
                                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, background: colorCategoria[f.categoria] || "#f5f5f5", marginRight: 6 }}>{f.categoria}</span>
                                    {f.nombre}
                                  </td>
                                  <td style={{ ...td, textAlign: "right" }}>{f.planificado.toLocaleString("es-AR", { maximumFractionDigits: 1 })} {f.unidad}</td>
                                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                                    {f.realizado.toLocaleString("es-AR", { maximumFractionDigits: 1 })} {f.unidad}
                                    <div style={{ marginTop: 4 }}>
                                      <input type="number" defaultValue={f.realizado || ""} placeholder="corregir a mano" style={inputChico}
                                        onBlur={(e) => guardarOverrideReal(plan.id, f.itemId, "cantidad_real_manual", e.target.value)} />
                                    </div>
                                  </td>
                                  <td style={{ ...td, textAlign: "right" }}>
                                    <div style={{ color: "#888", fontSize: 12 }}>{f.precioPresupuestado ? `USD ${f.precioPresupuestado.toFixed(2)}` : "sin ref."}</div>
                                    <input type="number" defaultValue={f.precioReal != null ? f.precioReal.toFixed(2) : ""}
                                      placeholder={f.sinPrecioDisponible ? "sin compra registrada" : "precio pagado"}
                                      style={{ ...inputChico, background: f.precioEsManual ? "#fffde7" : "white" }}
                                      onBlur={(e) => guardarOverrideReal(plan.id, f.itemId, "precio_real_manual", e.target.value)} />
                                    {f.precioEsAproximado && (
                                      <div style={{ fontSize: 10, color: "#aaa" }}>≈ última compra registrada</div>
                                    )}
                                    {diferenciaPrecio !== null && (
                                      <div style={{ fontSize: 10, fontWeight: 700, color: diferenciaPrecio > 0 ? "#e65100" : "#2e7d32" }}>
                                        {diferenciaPrecio > 0 ? "+" : ""}{diferenciaPrecio.toFixed(1)}%
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ ...td, textAlign: "center" }}>{estadoBadge(estado)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {grupo.extras.length > 0 && (
                        <div style={{ padding: "10px 14px", background: "#fff8e1", fontSize: 12, color: "#8a6300" }}>
                          ⚠️ En esta aplicación también se usó, sin estar presupuestado:{" "}
                          {grupo.extras.map((e: any, i: number) => (
                            <span key={e.insumo_id}>
                              <strong>{e.nombre}</strong> — {e.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 1 })} {e.unidad}{e.precio != null ? ` (USD ${e.precio.toFixed(2)})` : ""}
                              {i < grupo.extras.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Definí los insumos y labores con dosis. Los precios vienen de la tabla de precios centralizada. Para LABOR, "DOSIS/HA" se puede usar como costo de servicio presupuestado en USD/ha (opcional).</p>
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