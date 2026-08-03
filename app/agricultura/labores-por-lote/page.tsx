"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import React from "react";
import Link from "next/link";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LaboresPorLote() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<any>(null);
  const [labores, setLabores] = useState<any[]>([]);
  const [laborExpandida, setLaborExpandida] = useState<string | null>(null);
  const [insumosLabor, setInsumosLabor] = useState<Record<string, any[]>>({});
  const [laborEditando, setLaborEditando] = useState<any>(null);
  const [editForm, setEditForm] = useState({ Tipo: "", Fecha: "", Costo_total: "", hectareas: "" });
  const [eliminando, setEliminando] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.from("lotes").select().then(({ data }) => setLotes(data || []));
  }, []);

  useEffect(() => {
    if (!loteSeleccionado) return;
    cargarLabores();
  }, [loteSeleccionado]);

  const cargarLabores = async () => {
    const { data } = await supabase.from("labores").select("*").eq("Lote_id", loteSeleccionado.id).order("Fecha", { ascending: false });
    setLabores(data || []);
    setLaborExpandida(null);
    setInsumosLabor({});
  };

  const toggleLabor = async (labor: any) => {
    if (laborExpandida === labor.id) { setLaborExpandida(null); return; }
    setLaborExpandida(labor.id);
    if (insumosLabor[labor.id]) return;

    // OJO: saqué el filtro .eq("tipo", "egreso") a propósito para diagnosticar.
    // Si acá aparecen filas con un valor de "tipo" distinto a "egreso" (por
    // ejemplo "salida"), ese es el motivo de que no se vieran los insumos.
    // Avisame qué valor de "tipo" trae el log y lo dejamos filtrado bien.
    const { data, error } = await supabase
      .from("stock_movimientos")
      .select("*, insumos(nombre, unidad)")
      .eq("referencia_id", labor.id);

    console.log("insumos de labor", labor.id, "→", data, error);

    setInsumosLabor((prev) => ({ ...prev, [labor.id]: data || [] }));
  };

  const abrirEdicion = (labor: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setLaborEditando(labor);
    setEditForm({
      Tipo: labor.Tipo || "",
      Fecha: labor.Fecha || "",
      Costo_total: labor.Costo_total?.toString() || "",
      hectareas: labor.hectareas?.toString() || "",
    });
  };

  const guardarEdicion = async () => {
    if (!laborEditando) return;
    await supabase.from("labores").update({
      Tipo: editForm.Tipo,
      Fecha: editForm.Fecha,
      Costo_total: Number(editForm.Costo_total),
      hectareas: editForm.hectareas ? Number(editForm.hectareas) : null,
    }).eq("id", laborEditando.id);
    setLaborEditando(null);
    cargarLabores();
  };

  const confirmarEliminar = async (id: string) => {
    const { data: laborData } = await supabase.from("labores").select("numero, factura_id").eq("id", id).single();
    if (laborData?.factura_id) {
      alert(`No se puede eliminar la labor L-${String(laborData.numero).padStart(3, "0")} porque tiene una factura vinculada.`);
      setEliminando(null);
      return;
    }
    await supabase.from("stock_movimientos").delete().eq("referencia_id", id);
    await supabase.from("labores").delete().eq("id", id);
    setEliminando(null);
    cargarLabores();
  };

  const totalCosto = labores.reduce((acc, l) => acc + (l.Costo_total || 0), 0);

  const tipoIcono: Record<string, string> = {
    Fumigación: "🌿", Siembra: "🌱", Cosecha: "🌾", Fertilización: "💊", Labranza: "🚜", Pulverización: "💧",
  };

  const inputCls = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all mt-1";
  const lblCls = "text-xs font-semibold text-gray-400 uppercase tracking-wider";

  return (
    <div className="max-w-6xl mx-auto">

      {/* MODAL EDICIÓN */}
      {laborEditando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-5">✏️ Editar Labor</h2>
            <div className="space-y-4">
              <div>
                <p className={lblCls}>Tipo de labor</p>
                <select value={editForm.Tipo} onChange={(e) => setEditForm({ ...editForm, Tipo: e.target.value })} className={inputCls}>
                  <option>Siembra</option>
                  <option>Fertilización</option>
                  <option>Pulverización</option>
                  <option>Cosecha</option>
                  <option>Fumigación</option>
                  <option>Labranza</option>
                </select>
              </div>
              <div>
                <p className={lblCls}>Fecha</p>
                <input type="date" value={editForm.Fecha} onChange={(e) => setEditForm({ ...editForm, Fecha: e.target.value })} className={inputCls} />
              </div>
              <div>
                <p className={lblCls}>Costo total</p>
                <input type="number" value={editForm.Costo_total} onChange={(e) => setEditForm({ ...editForm, Costo_total: e.target.value })} className={inputCls} />
              </div>
              <div>
                <p className={lblCls}>Hectáreas</p>
                <input type="number" value={editForm.hectareas} onChange={(e) => setEditForm({ ...editForm, hectareas: e.target.value })} className={inputCls} placeholder="Ej: 50" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={guardarEdicion} className="flex-1 py-2.5 bg-[#0f1f17] text-white rounded-xl font-semibold text-sm hover:bg-[#1a3329] transition-colors">
                💾 Guardar
              </button>
              <button onClick={() => setLaborEditando(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {eliminando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <h2 className="text-base font-bold text-gray-800 mb-2">¿Eliminar esta labor?</h2>
            <p className="text-sm text-gray-400 mb-6">Se eliminarán también los movimientos de stock asociados. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => confirmarEliminar(eliminando)} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors">
                Eliminar
              </button>
              <button onClick={() => setEliminando(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Labores por Lote</h1>
        <p className="text-sm text-gray-400 mt-1">Historial de trabajos por campo.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* SIDEBAR LOTES */}
        <div className="w-full lg:w-56 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Lotes activos</p>
            <div className="space-y-1">
              {lotes.map((l) => (
                <button
                  key={l.id}
                  onClick={() => loteSeleccionado?.id === l.id ? (setLoteSeleccionado(null), setLabores([])) : setLoteSeleccionado(l)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all border-l-2
                    ${loteSeleccionado?.id === l.id
                      ? "bg-emerald-50 text-emerald-800 border-yellow-400 font-semibold"
                      : "text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-800"
                    }`}
                >
                  🌾 {l.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* IMAGEN LOTE */}
          <div className="relative rounded-2xl overflow-hidden h-36 hidden lg:block">
            <img src="/campo.png" className="w-full h-full object-cover" alt="Campo" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-4 text-white">
              <p className="text-xs opacity-60">Vista satelital</p>
              <p className="text-sm font-bold">{loteSeleccionado?.nombre || "Seleccionar lote"}</p>
            </div>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 min-w-0">
          {!loteSeleccionado ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <p className="text-5xl mb-3">🗺️</p>
              <p className="font-semibold text-gray-400">Seleccioná un lote para ver sus labores</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* MÉTRICAS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 border-l-4 border-l-yellow-400">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Labores</p>
                  <p className="text-3xl font-black text-gray-900 mt-1 tabular-nums">{labores.length}</p>
                </div>
                <div className="bg-[#0f1f17] rounded-2xl p-5">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Costo total</p>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1 tabular-nums leading-none">
                    ${totalCosto.toLocaleString("es-AR")}
                  </p>
                </div>
              </div>

              {/* TABLA */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-800">Historial de labores</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Tocá una fila para ver los insumos usados</p>
                  </div>
                  <Link href="/agricultura/nueva-labor" className="text-xs font-semibold bg-[#0f1f17] text-white px-3 py-2 rounded-xl hover:bg-[#1a3329] transition-colors">
                    + Nueva
                  </Link>
                </div>

                {labores.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <p className="text-4xl mb-2">📋</p>
                    <p className="text-sm">No hay labores para este lote.</p>
                  </div>
                ) : (
                  <>
                    {/* TABLA DESKTOP */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            {["N°", "Fecha", "Labor", "Ha", "Costo", ""].map((h) => (
                              <th key={h} className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {labores.map((l) => (
                            <React.Fragment key={l.id}>
                              <tr
                                onClick={() => toggleLabor(l)}
                                className={`border-t border-gray-50 cursor-pointer transition-colors ${laborExpandida === l.id ? "bg-emerald-50/50" : "hover:bg-gray-50/50"}`}
                              >
                                <td className="px-5 py-3.5 font-mono text-xs text-gray-400">L-{String(l.numero || "—").padStart(3, "0")}</td>
                                <td className="px-5 py-3.5 text-gray-600">{l.Fecha || "—"}</td>
                                <td className="px-5 py-3.5">
                                  <span className="flex items-center gap-1.5 font-semibold text-gray-800">
                                    {tipoIcono[l.Tipo] || "🚜"} {l.Tipo}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-gray-500">{l.hectareas ? `${l.hectareas} ha` : "—"}</td>
                                <td className="px-5 py-3.5 font-semibold text-gray-800 tabular-nums">${l.Costo_total?.toLocaleString("es-AR") || 0}</td>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); router.push(`/agricultura/labores-por-lote/editar/${l.id}`); }}
                                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs">✏️</button>
                                    <button onClick={(e) => { e.stopPropagation(); setEliminando(l.id); }}
                                      className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors text-xs">🗑️</button>
                                    <span className="text-gray-300 text-xs">{laborExpandida === l.id ? "▲" : "▼"}</span>
                                  </div>
                                </td>
                              </tr>
                              {laborExpandida === l.id && (
                                <tr key={`${l.id}-ins`}>
                                  <td colSpan={6} className="px-8 py-4 bg-emerald-50/40 border-t border-emerald-100">
                                    {!insumosLabor[l.id] ? (
                                      <p className="text-xs text-gray-400">Cargando...</p>
                                    ) : insumosLabor[l.id].length === 0 ? (
                                      <p className="text-xs text-gray-400">Sin insumos registrados.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {insumosLabor[l.id].map((m, i) => (
                                          <span key={i} className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full">
                                            {m.insumos?.nombre} — {m.cantidad} {m.insumos?.unidad}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* CARDS MOBILE */}
                    <div className="sm:hidden divide-y divide-gray-50">
                      {labores.map((l) => (
                        <div key={l.id}>
                          <div
                            onClick={() => toggleLabor(l)}
                            className={`px-4 py-4 cursor-pointer transition-colors ${laborExpandida === l.id ? "bg-emerald-50/50" : "hover:bg-gray-50"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">
                                  {tipoIcono[l.Tipo] || "🚜"}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-gray-800">{l.Tipo}</p>
                                  <p className="text-xs text-gray-400">{l.Fecha} {l.hectareas ? `· ${l.hectareas} ha` : ""}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <p className="font-bold text-sm text-gray-800 tabular-nums">${l.Costo_total?.toLocaleString("es-AR") || 0}</p>
                                <button onClick={(e) => { e.stopPropagation(); setEliminando(l.id); }} className="p-1.5 bg-red-50 rounded-lg text-xs">🗑️</button>
                              </div>
                            </div>
                          </div>
                          {laborExpandida === l.id && (
                            <div className="px-4 pb-4 bg-emerald-50/40">
                              {!insumosLabor[l.id] ? (
                                <p className="text-xs text-gray-400">Cargando...</p>
                              ) : insumosLabor[l.id].length === 0 ? (
                                <p className="text-xs text-gray-400">Sin insumos registrados.</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {insumosLabor[l.id].map((m, i) => (
                                    <span key={i} className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full">
                                      {m.insumos?.nombre} — {m.cantidad} {m.insumos?.unidad}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}