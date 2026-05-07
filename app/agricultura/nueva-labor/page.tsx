"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CargarLabor() {
  const [cultivos, setCultivos] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [labores, setLabores] = useState<any[]>([]);

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

  // 🔹 Cargar labores
  useEffect(() => {
    const cargarLabores = async () => {
      const { data } = await supabase
        .from("labores")
        .select("*")
        .order("Fecha", { ascending: false });

      setLabores(data || []);
    };

    cargarLabores();
  }, []);

  // 🔹 Guardar labor
  const guardarLabor = async () => {
    if (!tipo || !cultivoId || !loteId) {
      alert("Faltan datos. El lote es obligatorio.");
      return;
    }

    const { error } = await supabase
      .from("labores")
      .insert([
        {
          Tipo: tipo,
          Fecha: new Date().toISOString().slice(0, 10),
          Costo_total: Number(costo),
          Cultivo_id: cultivoId,
          Lote_id: loteId,
        },
      ]);

    if (error) {
      alert("Error al guardar la labor");
      console.error(error);
      return;
    }

    alert("Labor guardada ✅");

    // recargar lista
    const { data } = await supabase
      .from("labores")
      .select("*")
      .order("Fecha", { ascending: false });

    setLabores(data || []);

    // limpiar formulario
    setTipo("");
    setCultivoId("");
    setLoteId("");
    setCosto("");
  };

  // 🔴 ELIMINAR LABOR (OPCIÓN B)
  const eliminarLabor = async (id: string) => {
    const confirmar = confirm("¿Querés eliminar esta labor?");
    if (!confirmar) return;

    // ✅ verificar si tiene gastos
    const { data } = await supabase
      .from("facturas")
      .select("id")
      .eq("Labor_id", id);

    if (data && data.length > 0) {
      alert("No se puede eliminar: esta labor tiene gastos asociados");
      return;
    }

    // ✅ eliminar
    const { error } = await supabase
      .from("labores")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error eliminando labor");
      return;
    }

    // ✅ actualizar UI
    setLabores((prev) => prev.filter((l) => l.id !== id));
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
          onChange={(e) => setLoteId(e.target.value)}
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