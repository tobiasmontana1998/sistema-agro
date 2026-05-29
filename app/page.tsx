"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const [laboresCount, setLaboresCount] = useState(0);
  const [gastosTotal, setGastosTotal] = useState(0);
  const [stockBajo, setStockBajo] = useState<any[]>([]);
  const [ultimasLabores, setUltimasLabores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];

    const [{ data: labores }, { data: facturas }, { data: insumos }, { data: movimientos }] = await Promise.all([
      supabase.from("labores").select("*").gte("Fecha", primerDiaMes),
      supabase.from("facturas").select("Monto"),
      supabase.from("insumos").select("*"),
      supabase.from("stock_movimientos").select("*"),
    ]);

    setLaboresCount(labores?.length || 0);
    setGastosTotal((facturas || []).reduce((acc, f) => acc + (f.Monto || 0), 0));

    const stockCalculado = (insumos || []).map((insumo) => {
      const entradas = (movimientos || []).filter(m => m.insumo_id === insumo.id && m.tipo === "entrada").reduce((acc, m) => acc + Number(m.cantidad), 0);
      const salidas = (movimientos || []).filter(m => m.insumo_id === insumo.id && m.tipo === "salida").reduce((acc, m) => acc + Number(m.cantidad), 0);
      return { ...insumo, stock_actual: entradas - salidas };
    }).filter(i => i.stock_actual <= 10);
    setStockBajo(stockCalculado);

    const { data: ultimas } = await supabase.from("labores").select("*, lotes(nombre)").order("Fecha", { ascending: false }).limit(5);
    setUltimasLabores(ultimas || []);
    setLoading(false);
  };

  const tipoIcono: Record<string, string> = {
    Fumigación: "🌿", Siembra: "🌱", Cosecha: "🌾", Fertilización: "💊", Labranza: "🚜",
  };

  const fecha = new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* HERO */}
      <div className="relative rounded-3xl overflow-hidden h-52 sm:h-64">
        <img src="/campo.png" className="w-full h-full object-cover" alt="Campo" />
        {/* overlay escalonado */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

        {/* texto */}
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-[0.2em] mb-1">Bienvenido a</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight">El Encuentro</h1>
          <p className="text-sm text-white/50 mt-1.5 capitalize">{fecha}</p>
        </div>

        {/* botón asistente */}
        <Link
          href="/asistente"
          className="absolute top-5 right-5 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl transition-all"
        >
          <span className="text-base">🤖</span> Asistente IA
        </Link>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Labores */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 group hover:border-yellow-300 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <span className="text-2xl">🚜</span>
            <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full">Este mes</span>
          </div>
          <p className="text-4xl font-black text-gray-900 tabular-nums">
            {loading ? <span className="text-gray-200 animate-pulse">—</span> : laboresCount}
          </p>
          <p className="text-sm text-gray-400 mt-1 font-medium">Labores registradas</p>
        </div>

        {/* Gastos */}
        <div className="bg-[#0f1f17] rounded-2xl p-5 border border-transparent group hover:border-emerald-700 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <span className="text-2xl">💰</span>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-900/50 px-2.5 py-1 rounded-full">Facturas</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">
            {loading ? <span className="text-white/20 animate-pulse">—</span> : `$${gastosTotal.toLocaleString("es-AR")}`}
          </p>
          <p className="text-sm text-white/40 mt-1 font-medium">Gastos totales del mes</p>
        </div>

        {/* Stock */}
        <div className={`rounded-2xl p-5 border transition-all ${stockBajo.length > 0 ? "bg-red-50 border-red-100 hover:border-red-300" : "bg-white border-gray-100 hover:border-green-300"}`}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-2xl">📦</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stockBajo.length > 0 ? "text-red-700 bg-red-100" : "text-green-700 bg-green-100"}`}>
              {stockBajo.length > 0 ? "⚠️ Crítico" : "✓ Ok"}
            </span>
          </div>
          <p className={`text-4xl font-black tabular-nums ${stockBajo.length > 0 ? "text-red-600" : "text-gray-900"}`}>
            {loading ? <span className="text-gray-200 animate-pulse">—</span> : stockBajo.length}
          </p>
          <p className={`text-sm mt-1 font-medium ${stockBajo.length > 0 ? "text-red-400" : "text-gray-400"}`}>
            {stockBajo.length === 0 ? "Todo el stock en orden" : "Insumos con stock crítico"}
          </p>
        </div>
      </div>

      {/* GRILLA INFERIOR */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ACTIVIDAD RECIENTE — ocupa 3/5 */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-base">Actividad reciente</h2>
            <Link href="/agricultura/labores-por-lote" className="text-xs font-semibold text-yellow-500 hover:text-yellow-600 transition-colors">
              Ver historial →
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded-full animate-pulse w-1/3" />
                    <div className="h-3 bg-gray-50 rounded-full animate-pulse w-1/2" />
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full animate-pulse w-16" />
                </div>
              ))
            ) : ultimasLabores.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-4xl mb-2">🌾</p>
                <p className="text-sm text-gray-400">Sin labores registradas este mes.</p>
                <Link href="/agricultura/nueva-labor" className="inline-block mt-3 text-xs font-semibold text-[#0f1f17] hover:underline">
                  + Cargar primera labor
                </Link>
              </div>
            ) : (
              ultimasLabores.map((l) => (
                <div key={l.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">
                    {tipoIcono[l.Tipo] || "🚜"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{l.Tipo}</p>
                    <p className="text-xs text-gray-400 truncate">{l.lotes?.nombre || "Sin lote"} · {l.Fecha || "Sin fecha"}</p>
                  </div>
                  <p className="font-bold text-sm text-gray-800 flex-shrink-0 tabular-nums">
                    ${l.Costo_total?.toLocaleString("es-AR") || "0"}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/30 flex gap-2">
            <Link href="/agricultura/nueva-labor" className="text-xs font-semibold text-[#0f1f17] bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              + Nueva labor
            </Link>
            <Link href="/asistente" className="text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              🤖 Cargar con IA
            </Link>
          </div>
        </div>

        {/* STOCK CRÍTICO — ocupa 2/5 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-base">Stock crítico</h2>
            <Link href="/agricultura/stock" className="text-xs font-semibold text-yellow-500 hover:text-yellow-600 transition-colors">
              Ver todo →
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="px-5 py-3.5 space-y-1.5">
                  <div className="h-3.5 bg-gray-100 rounded-full animate-pulse w-2/3" />
                  <div className="h-3 bg-gray-50 rounded-full animate-pulse w-1/3" />
                </div>
              ))
            ) : stockBajo.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-4xl mb-2">✅</p>
                <p className="text-sm text-gray-400">Todo el stock en orden</p>
              </div>
            ) : (
              stockBajo.slice(0, 6).map((item) => (
                <div key={item.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{item.categoria}</p>
                  </div>
                  <span className={`text-xs font-bold flex-shrink-0 px-2.5 py-1 rounded-full tabular-nums ${item.stock_actual <= 0 ? "text-red-700 bg-red-100" : "text-orange-700 bg-orange-100"}`}>
                    {item.stock_actual} {item.unidad}
                  </span>
                </div>
              ))
            )}
          </div>

          {stockBajo.length > 6 && (
            <div className="px-5 py-3 border-t border-gray-50 text-center">
              <p className="text-xs text-gray-400">y {stockBajo.length - 6} más...</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}