"use client";

import { useState, useRef, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Mensaje = {
  rol: "usuario" | "asistente";
  texto: string;
  archivo?: string;
  accion?: any;
};

export default function Asistente() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      rol: "asistente",
      texto: "Hola! Soy tu asistente agropecuario. Podés:\n• Subir una factura o remito en PDF/imagen\n• Decirme un labor: \"Fumigación en La Esperanza, 140 ha, hoy, 3 litros de glifosato por ha\"\n• Registrar un monitoreo: \"Monitoreé La Esperanza, maíz en R3, condición buena, 85% cobertura\"\n• Hablar por micrófono 🎤\n¿En qué te ayudo?",
    },
  ]);
  const [input, setInput] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [pendiente, setPendiente] = useState<any>(null);
  const [insumosSinMatch, setInsumosSinMatch] = useState<string[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [resolucionInsumos, setResolucionInsumos] = useState<Record<string, { accion: "crear" | "asignar"; insumo_id?: string }>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  useEffect(() => {
    supabase.from("insumos").select("id, nombre, unidad, categoria").then(({ data }) => {
      setInsumos(data || []);
    });
  }, []);

  const enviar = async () => {
    if (!input.trim() && !archivo) return;

    const nuevoMensaje: Mensaje = {
      rol: "usuario",
      texto: input || `📎 ${archivo?.name}`,
      archivo: archivo?.name,
    };

    const mensajesActualizados = [...mensajes, nuevoMensaje];
    setMensajes(mensajesActualizados);
    const archivoActual = archivo;
    setInput("");
    setArchivo(null);
    setCargando(true);

    try {
      const formData = new FormData();
      if (input) formData.append("mensaje", input);
      if (archivoActual) formData.append("file", archivoActual);

      const historialParaMandar = mensajesActualizados.map(m => ({
        rol: m.rol,
        texto: m.accion ? m.accion._respuestaTexto || m.texto : m.texto
      }));
      formData.append("historial", JSON.stringify(historialParaMandar));

      const res = await fetch("/api/asistente", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const sinMatch = data.insumos_sin_match || [];
      setInsumosSinMatch(sinMatch);
      setResolucionInsumos({});

      const respuesta: Mensaje = {
        rol: "asistente",
        texto: data.mensaje_usuario || "Procesado.",
        accion: data,
      };

      setMensajes((prev) => [...prev, respuesta]);
      if (data.accion !== "consulta") {
        setPendiente({ ...data, _archivo: archivoActual });
      }

    } catch (e: any) {
      setMensajes((prev) => [...prev, { rol: "asistente", texto: `Error: ${e.message}` }]);
    } finally {
      setCargando(false);
    }
  };

  const iniciarVoz = () => {
    if (escuchando) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu browser no soporta reconocimiento de voz. Usá Chrome o Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setEscuchando(true);

    recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript;
      setInput(texto);
    };

    recognition.onend = () => {
      setEscuchando(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setEscuchando(false);
      recognitionRef.current = null;
      if (event.error === "not-allowed") {
        alert("Permiso de micrófono denegado.");
      }
    };

    recognition.start();
  };

  const confirmar = async () => {
    if (!pendiente) return;
    setCargando(true);

    try {
      let error: any = null;

      if (pendiente.accion === "cargar_factura") {
        const d = pendiente.datos;

        const itemsResueltos = (d.items || []).map((item: any) => {
          if (!item.insumo_id && resolucionInsumos[item.descripcion]) {
            const res = resolucionInsumos[item.descripcion];
            if (res.accion === "asignar" && res.insumo_id) {
              return { ...item, insumo_id: res.insumo_id };
            }
          }
          return item;
        });

        for (const nombre of insumosSinMatch) {
          const res = resolucionInsumos[nombre];
          if (res?.accion === "crear") {
            const { data: nuevoInsumo } = await supabase
              .from("insumos")
              .insert([{ nombre, categoria: "Semillas", unidad: "BOL", subcategoria: "" }])
              .select()
              .single();
            if (nuevoInsumo) {
              itemsResueltos.forEach((item: any) => {
                if (item.descripcion?.includes(nombre) && !item.insumo_id) {
                  item.insumo_id = nuevoInsumo.id;
                }
              });
            }
          }
        }

        let pdfUrl = null;
        if (pendiente._archivo) {
          const nombreArchivo = `fact_${Date.now()}_${pendiente._archivo.name.replace(/\s/g, "_")}`;
          const { error: uploadError } = await supabase.storage
            .from("facturas")
            .upload(nombreArchivo, pendiente._archivo, { contentType: "application/pdf", upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("facturas").getPublicUrl(nombreArchivo);
            pdfUrl = urlData.publicUrl;
          }
        }

        const { data: facturaInsertada, error: e } = await supabase.from("facturas").insert([{
          Tipo: d.tipo || "Insumos",
          proveedor_id: d.proveedor_id,
          Fecha: d.fecha,
          Fecha_vencimiento: d.fecha_vencimiento || null,
          tipo_comprobante: d.tipo_comprobante,
          Numero_factura: d.numero_factura,
          Concepto: d.concepto,
          monto_neto: d.monto_neto,
          alicuota_iva: d.alicuota_iva,
          monto_iva: d.monto_iva,
          percepciones: d.percepciones || 0,
          retenciones: d.retenciones || 0,
          moneda: d.moneda || "ARS",
          dolar: d.dolar || null,
          no_gravado: d.no_gravado || 0,
          cae: d.cae || null,
          Monto: (d.monto_neto || 0) + (d.monto_iva || 0) + (d.percepciones || 0) + (d.no_gravado || 0),
          pdf_url: pdfUrl,
        }]).select().single();
        error = e;

        if (!e && facturaInsertada && itemsResueltos.length > 0) {
          await supabase.from("factura_items").insert(
            itemsResueltos.map((item: any) => ({
              factura_id: facturaInsertada.id,
              descripcion: item.descripcion || "",
              insumo_id: item.insumo_id || null,
              cantidad: item.cantidad || 0,
              unidad: item.unidad || "",
              precio_unitario: item.precio_unitario || 0,
              descuento: item.descuento || 0,
              precio_neto: item.precio_neto || 0,
              total: item.total || 0,
            }))
          );
        }
      }

      if (pendiente.accion === "cargar_labor") {
        const d = pendiente.datos;

        // Resolver insumos sin match
        const insumosResueltos = (d.insumos_usados || []).map((item: any) => {
          if (!item.insumo_id && resolucionInsumos[item.nombre]) {
            const res = resolucionInsumos[item.nombre];
            if (res.accion === "asignar" && res.insumo_id) {
              return { ...item, insumo_id: res.insumo_id };
            }
          }
          return item;
        });

        // Crear insumos nuevos si corresponde
        for (const nombre of insumosSinMatch) {
          const res = resolucionInsumos[nombre];
          if (res?.accion === "crear") {
            const { data: nuevoInsumo } = await supabase
              .from("insumos")
              .insert([{ nombre, categoria: "Fitosanitarios", unidad: "L", subcategoria: "" }])
              .select()
              .single();
            if (nuevoInsumo) {
              insumosResueltos.forEach((item: any) => {
                if (item.nombre === nombre && !item.insumo_id) {
                  item.insumo_id = nuevoInsumo.id;
                }
              });
            }
          }
        }

        // Insertar labor
        const { data: laborInsertado, error: e } = await supabase.from("labores").insert([{
          Tipo: d.Tipo,
          Fecha: d.Fecha,
          Lote_id: d.Lote_id,
          hectareas: d.hectareas,
          Costo_total: d.Costo_total || 0,
        }]).select().single();
        error = e;

        // Insertar movimientos de stock
        if (!e && laborInsertado && insumosResueltos.length > 0) {
          const movimientos = insumosResueltos
            .filter((item: any) => item.insumo_id)
            .map((item: any) => ({
              insumo_id: item.insumo_id,
              tipo: "egreso",
              cantidad: item.cantidad_total || 0,
              motivo: "labor",
              referencia_id: laborInsertado.id,
              observaciones: `${d.Tipo} — ${item.nombre}`,
              fecha: d.Fecha,
            }));

          console.log('movimientos a insertar:', JSON.stringify(movimientos));

          if (movimientos.length > 0) {
            const { error: stockError } = await supabase.from("stock_movimientos").insert(movimientos);
            if (stockError) {
              console.error('Error insertando stock:', stockError.message);
            }
          }
        }
      }

      if (pendiente.accion === "crear_insumo") {
        const d = pendiente.datos;
        const { error: e } = await supabase.from("insumos").insert([{
          nombre: d.nombre,
          categoria: d.categoria,
          unidad: d.unidad,
          subcategoria: d.subcategoria || "",
        }]);
        error = e;
      }

      if (pendiente.accion === "cargar_remito") {
        const d = pendiente.datos;
        const { error: e } = await supabase.from("remitos").insert([{
          proveedor_id: d.proveedor_id,
          fecha: d.fecha,
          numero_remito: d.numero_remito,
          observaciones: d.observaciones || "",
        }]);
        error = e;
      }

      if (pendiente.accion === "cargar_monitoreo") {
        const d = pendiente.datos;
        const { error: e } = await supabase.from("monitoreos").insert([{
          lote_id: d.lote_id,
          fecha: d.fecha,
          operador: d.operador || null,
          cultivo: d.cultivo || null,
          estado_fenologico: d.estado_fenologico || null,
          condicion_general: d.condicion_general || null,
          cobertura: d.cobertura || null,
          comentario: d.comentario || null,
          fotos: null,
        }]);
        error = e;
      }

      if (error) throw new Error(error.message);

      setMensajes((prev) => [
        ...prev,
        { rol: "asistente", texto: "✅ Guardado correctamente en el sistema." },
      ]);
      setPendiente(null);
      setInsumosSinMatch([]);
      setResolucionInsumos({});

    } catch (e: any) {
      setMensajes((prev) => [...prev, { rol: "asistente", texto: `❌ Error al guardar: ${e.message}` }]);
    } finally {
      setCargando(false);
    }
  };

  const rechazar = () => {
    setPendiente(null);
    setInsumosSinMatch([]);
    setResolucionInsumos({});
    setMensajes((prev) => [...prev, { rol: "asistente", texto: "Entendido, descartado. ¿En qué más te ayudo?" }]);
  };

  const todasResueltas = insumosSinMatch.every(nombre => resolucionInsumos[nombre]);

  const renderDatos = (accion: any) => {
    if (!accion?.datos) return null;
    const d = accion.datos;
    return (
      <div style={{ marginTop: 10, background: "#f8f9fa", borderRadius: 8, padding: 12, fontSize: 12 }}>
        {Object.entries(d).map(([k, v]) => {
          if (k === "items" || k === "insumos_usados") return null;
          if (Array.isArray(v)) return null;
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
              <span style={{ color: "#888", flexShrink: 0 }}>{k}:</span>
              <span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{String(v)}</span>
            </div>
          );
        })}
        {d.items && d.items.length > 0 && (
          <div style={{ marginTop: 8, borderTop: "1px solid #e0e0e0", paddingTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ítems ({d.items.length}):</div>
            {d.items.map((item: any, i: number) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: item.insumo_id ? "#2e7d32" : "#e65100" }}>
                  {item.insumo_id ? "✅" : "⚠️"} {item.descripcion}
                </span>
                <span style={{ color: "#888" }}>{item.cantidad} {item.unidad}</span>
              </div>
            ))}
          </div>
        )}
        {d.insumos_usados && d.insumos_usados.length > 0 && (
          <div style={{ marginTop: 8, borderTop: "1px solid #e0e0e0", paddingTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Insumos usados ({d.insumos_usados.length}):</div>
            {d.insumos_usados.map((item: any, i: number) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: item.insumo_id ? "#2e7d32" : "#e65100" }}>
                  {item.insumo_id ? "✅" : "⚠️"} {item.nombre}
                </span>
                <span style={{ color: "#888" }}>
                  {item.cantidad_total} {item.unidad}
                  {item.dosis_por_ha ? ` (${item.dosis_por_ha}/ha)` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🤖 Asistente</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Cargá facturas, labores, remitos y monitoreos con IA.</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20, marginBottom: 16 }}>
        {mensajes.map((m, i) => (
          <div key={i} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: m.rol === "usuario" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: m.rol === "usuario" ? "12px 12px 0 12px" : "12px 12px 12px 0",
              background: m.rol === "usuario" ? "#0f1f17" : "#f0f0f0",
              color: m.rol === "usuario" ? "white" : "#333",
              fontSize: 14,
              whiteSpace: "pre-wrap",
            }}>
              {m.texto}
              {m.accion && renderDatos(m.accion)}
            </div>

            {m.accion?.accion !== "consulta" && pendiente && i === mensajes.length - 1 && (
              <div style={{ maxWidth: "85%", width: "100%", marginTop: 8 }}>
                {insumosSinMatch.length > 0 && (
                  <div style={{ background: "#fff8e1", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: "#e65100", marginBottom: 8 }}>
                      ⚠️ No encontré estos insumos en el sistema:
                    </div>
                    {insumosSinMatch.map((nombre) => (
                      <div key={nombre} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #ffe0b2" }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{nombre}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            onClick={() => setResolucionInsumos(prev => ({ ...prev, [nombre]: { accion: "crear" } }))}
                            style={{
                              padding: "5px 12px", fontSize: 12, borderRadius: 6, border: "1px solid",
                              cursor: "pointer",
                              background: resolucionInsumos[nombre]?.accion === "crear" ? "#0f1f17" : "white",
                              color: resolucionInsumos[nombre]?.accion === "crear" ? "white" : "#0f1f17",
                              borderColor: "#0f1f17",
                            }}
                          >
                            ➕ Crear nuevo
                          </button>
                          <span style={{ fontSize: 12, color: "#888" }}>o asignar a:</span>
                          <select
                            value={resolucionInsumos[nombre]?.insumo_id || ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                setResolucionInsumos(prev => ({
                                  ...prev,
                                  [nombre]: { accion: "asignar", insumo_id: e.target.value }
                                }));
                              }
                            }}
                            style={{ padding: "4px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #ddd" }}
                          >
                            <option value="">Seleccionar...</option>
                            {insumos.map(ins => (
                              <option key={ins.id} value={ins.id}>{ins.nombre}</option>
                            ))}
                          </select>
                        </div>
                        {resolucionInsumos[nombre] && (
                          <div style={{ fontSize: 11, color: "#2e7d32", marginTop: 4 }}>
                            ✅ {resolucionInsumos[nombre].accion === "crear"
                              ? "Se creará un nuevo insumo"
                              : `Se asignará a: ${insumos.find(i => i.id === resolucionInsumos[nombre].insumo_id)?.nombre}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={confirmar}
                    disabled={cargando || (insumosSinMatch.length > 0 && !todasResueltas)}
                    style={{
                      padding: "8px 16px",
                      background: (insumosSinMatch.length > 0 && !todasResueltas) ? "#ccc" : "#0f1f17",
                      color: "white", border: "none", borderRadius: 8,
                      cursor: (insumosSinMatch.length > 0 && !todasResueltas) ? "not-allowed" : "pointer",
                      fontWeight: 600, fontSize: 13
                    }}
                  >
                    ✅ Confirmar y guardar
                  </button>
                  <button
                    onClick={rechazar}
                    style={{ padding: "8px 16px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                  >
                    ✕ Descartar
                  </button>
                </div>
                {insumosSinMatch.length > 0 && !todasResueltas && (
                  <div style={{ fontSize: 12, color: "#e65100", marginTop: 6 }}>
                    Resolvé todos los insumos antes de confirmar.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {cargando && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#888", fontSize: 13 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#888", animation: "pulse 1s infinite" }}></div>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#888", animation: "pulse 1s infinite 0.2s" }}></div>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#888", animation: "pulse 1s infinite 0.4s" }}></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {archivo && (
        <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 14px", marginBottom: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>📎 {archivo.name}</span>
          <button onClick={() => setArchivo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "red" }}>✕</button>
        </div>
      )}

      {escuchando && (
        <div style={{ background: "#fee", borderRadius: 8, padding: "8px 14px", marginBottom: 8, fontSize: 13, textAlign: "center", color: "#cc0000", fontWeight: 600 }}>
          🔴 Escuchando... apretá el micrófono para parar
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ padding: "10px 14px", background: "white", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontSize: 16 }}
          title="Adjuntar archivo"
        >
          📎
        </button>
        <button
          onClick={iniciarVoz}
          style={{
            padding: "10px 14px",
            background: escuchando ? "#ff4444" : "white",
            border: escuchando ? "2px solid #cc0000" : "1px solid #e0e0e0",
            borderRadius: 8, cursor: "pointer", fontSize: 16,
          }}
          title={escuchando ? "Parar de escuchar" : "Hablar por micrófono"}
        >
          {escuchando ? "🔴" : "🎤"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.[0]) setArchivo(e.target.files[0]); }}
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribí, hablá o subí un archivo..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14 }}
        />
        <button
          onClick={enviar}
          disabled={cargando || (!input.trim() && !archivo)}
          style={{ padding: "10px 20px", background: cargando ? "#888" : "#0f1f17", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          Enviar
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}