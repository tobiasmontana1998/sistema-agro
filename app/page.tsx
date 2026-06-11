"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PreciosBCR = {
  trigo: { ars: string; usd: string } | null;
  maiz: { ars: string; usd: string } | null;
  soja: { ars: string; usd: string } | null;
  girasol: { ars: string; usd: string } | null;
  sorgo: { ars: string; usd: string } | null;
  dolar: string | null;
  fecha: string | null;
};

export default function HomePage() {
  const [laboresCount, setLaboresCount] = useState(0);
  const [gastosTotal, setGastosTotal] = useState(0);
  const [ultimasLabores, setUltimasLabores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [precios, setPrecios] = useState<PreciosBCR | null>(null);
  const [loadingPrecios, setLoadingPrecios] = useState(true);

  useEffect(() => {
    cargarDatos();
    cargarPrecios();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];
    const [{ data: labores }, { data: facturas }, { data: ultimas }] = await Promise.all([
      supabase.from("labores").select("*").gte("Fecha", primerDiaMes),
      supabase.from("facturas").select("Monto"),
      supabase.from("labores").select("*, lotes(nombre)").order("Fecha", { ascending: false }).limit(5),
    ]);
    setLaboresCount(labores?.length || 0);
    setGastosTotal((facturas || []).reduce((acc, f) => acc + (f.Monto || 0), 0));
    setUltimasLabores(ultimas || []);
    setLoading(false);
  };

  const cargarPrecios = async () => {
    setLoadingPrecios(true);
    try {
      const res = await fetch("/api/precios-bcr");
      const data = await res.json();
      setPrecios(data);
    } catch {
      setPrecios(null);
    }
    setLoadingPrecios(false);
  };

  const tipoIcono: Record<string, string> = {
    Fumigación: "🌿", Siembra: "🌱", Cosecha: "🌾", Fertilización: "💊", Labranza: "🚜",
  };

  const fecha = new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const cultivos = [
    { key: "soja", label: "Soja", icon: "🌿" },
    { key: "maiz", label: "Maíz", icon: "🌽" },
    { key: "trigo", label: "Trigo", icon: "🌾" },
    { key: "girasol", label: "Girasol", icon: "🌻" },
    { key: "sorgo", label: "Sorgo", icon: "🌱" },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* HERO */}
      <div className="relative rounded-3xl overflow-hidden h-52 sm:h-64">
        <img src="/campo.png" className="w-full h-full object-cover" alt="Campo" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-[0.2em] mb-1">Bienvenido a</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight">El Encuentro</h1>
          <p className="text-sm text-white/50 mt-1.5 capitalize">{fecha}</p>
        </div>
        <Link href="/asistente" className="absolute top-5 right-5 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl transition-all">
          <span className="text-base">🤖</span> Asistente IA
        </Link>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-yellow-300 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <span className="text-2xl">🚜</span>
            <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full">Este mes</span>
          </div>
          <p className="text-4xl font-black text-gray-900 tabular-nums">
            {loading ? <span className="text-gray-200 animate-pulse">—</span> : laboresCount}
          </p>
          <p className="text-sm text-gray-400 mt-1 font-medium">Labores registradas</p>
        </div>

        <div className="bg-[#0f1f17] rounded-2xl p-5 border border-transparent hover:border-emerald-700 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <span className="text-2xl">💰</span>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-900/50 px-2.5 py-1 rounded-full">Facturas</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">
            {loading ? <span className="text-white/20 animate-pulse">—</span> : `$${gastosTotal.toLocaleString("es-AR")}`}
          </p>
          <p className="text-sm text-white/40 mt-1 font-medium">Gastos totales del mes</p>
        </div>
      </div>

      {/* PRECIOS PIZARRA BCR */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-gray-800 text-base">Precios Pizarra</h2>
            <span className="text-xs text-gray-400 font-medium">BCR · Rosario</span>
          </div>
          <div className="flex items-center gap-3">
            {precios?.dolar && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-emerald-600 font-semibold">USD divisa BNA</span>
                <span className="text-sm font-black text-emerald-700">${precios.dolar}</span>
              </div>
            )}
            {precios?.fecha && (
              <span className="text-xs text-gray-400">{precios.fecha}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-gray-50">
          {cultivos.map(({ key, label, icon }) => {
            const precio = precios?.[key];
            return (
              <div key={key} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{icon}</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
                {loadingPrecios ? (
                  <div className="space-y-1.5">
                    <div className="h-5 bg-gray-100 rounded-full animate-pulse w-3/4" />
                    <div className="h-4 bg-gray-50 rounded-full animate-pulse w-1/2" />
                  </div>
                ) : precio ? (
                  <>
                    <p className="text-sm font-black text-gray-900 tabular-nums leading-tight">
                      ${Number(precio.ars.replace(/\./g, "").replace(",", ".")).toLocaleString("es-AR", { maximumFractionDigits: 0 })}<span className="text-xs font-medium text-gray-400">/tn</span>
                    </p>
                    <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                      USD {precio.usd}<span className="text-gray-400 font-normal">/tn</span>
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-300">S/C</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTIVIDAD RECIENTE */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-base">Actividad reciente</h2>
          <Link href="/agricultura/labores-por-lote" className="text-xs font-semibold text-yellow-500 hover:text-yellow-600 transition-colors">
            Ver historial →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            [1, 2, 3].map(i => (
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

    </div>
  );
}