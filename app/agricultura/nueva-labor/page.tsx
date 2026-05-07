"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CargarLabor() {
  const [cultivos, setCultivos] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);

  const [tipo, setTipo] = useState("");
  const [cultivoId, setCultivoId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [costo, setCosto] = useState("");

  // 🔹 Cargar cultivos
  useEffect(() => {
    const cargarCultivos = async () => {
      const { data } = await supabase
        .from("cultivos")
        .select("id, nombre");

      setCultivos(data || []);
    };

    cargarCultivos();
  }, []);

  // 🔹 Cargar lotes
  useEffect(() => {
    const cargarLotes = async () => {
      const { data } = await supabase
        .from("lotes")
        .select("id, nombre")
        .order("nombre");

      setLotes(data || []);
    };

    cargarLotes();
  }, []);

  // 🔹 Guardar labor (BLINDADO)
  const guardarLabor = async () => {
    if (!tipo || !cultivoId || !loteId) {
      alert("Faltan datos. El lote es obligatorio.");
      return;
    }

    console.log("GUARDANDO LABOR CON LOTE:", loteId);

    const { data, error } = await supabase
      .from("labores")
      .insert([
        {
          Tipo: tipo,
          Fecha: new Date().toISOString().slice(0, 10),
          Costo_total: Number(costo),
          Cultivo_id: cultivoId,
          Lote_id: loteId, // ✅ ESTO ES CLAVE
        },
      ])
      .select();

    console.log("RESPUESTA SUPABASE:", data, error);

    if (error) {
      alert("Error al guardar la labor");
      console.error(error);
      return;
    }

    alert("Labor guardada ✅");

    // limpiar formulario
    setTipo("");
    setCultivoId("");
    setLoteId("");
    setCosto("");
  };

  return (
    <div style={{ padding: 40 }}>
      <Link href="/">← Volver al inicio</Link>

      <h1>Cargar Labor</h1>

      <div>
        <label>Tipo de labor</label>
        <br />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Seleccionar</option>
          <option value="pulverizacion">Pulverización</option>
          <option value="siembra">Siembra</option>
          <option value="cosecha">Cosecha</option>
          <option value="fertilizacion">Fertilización</option>
        </select>
      </div>

      <br />

      <div>
        <label>Cultivo</label>
        <br />
        <select
          value={cultivoId}
          onChange={(e) => setCultivoId(e.target.value)}
        >
          <option value="">Seleccionar</option>
          {cultivos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <br />

      <div>
        <label>Lote</label>
        <br />
        <select
          value={loteId}
          onChange={(e) => {
            console.log("LOTE SELECCIONADO:", e.target.value);
            setLoteId(e.target.value);
          }}
        >
          <option value="">Seleccionar</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
      </div>

      <br />

      <div>
        <label>Costo total</label>
        <br />
        <input
          type="number"
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
        />
      </div>

      <br />

      <button onClick={guardarLabor}>Guardar labor</button>
    </div>
  );
}
