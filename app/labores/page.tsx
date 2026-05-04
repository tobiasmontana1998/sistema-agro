"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CargarLabor() {
  // ESTADOS
  const [cultivos, setCultivos] = useState<any[]>([]);
  const [labores, setLabores] = useState<any[]>([]);
  const [tipo, setTipo] = useState("");
  const [cultivoId, setCultivoId] = useState("");
  const [costo, setCosto] = useState("");
  const [lotes, setLotes] = useState<any[]>([]);
  const [loteId, setLoteId] = useState("");


  // CARGAR CULTIVOS
  useEffect(() => {
    const cargarCultivos = async () => {
      const { data, error } = await supabase
        .from("cultivos")
        .select("id, nombre");

      if (error) {
        console.error(error);
        return;
      }

      setCultivos(data || []);
    };

    cargarCultivos();
  }, []);

  // CARGAR LABORES
  useEffect(() => {
    const cargarLabores = async () => {
      const { data, error } = await supabase
        .from("labores")
        .select(`
          id,
          Tipo,
          Fecha,
          Costo_total,
          Cultivo_id,
          cultivos ( nombre )
        `)
        .order("Fecha", { ascending: false });

      if (error) {
        console.error("Error cargando labores:", error);
        return;
      }

      setLabores(data || []);
    };
    cargarLabores();
  }, []);

  useEffect(() => {
  const cargarLotes = async () => {
    const { data, error } = await supabase
      .from("lotes")
      .select("id, nombre")
      .order("nombre");

    if (error) {
      console.error("Error cargando lotes:", error);
      return;
    }

    setLotes(data || []);
  };

  cargarLotes();
}, []);
   

  // GUARDAR LABOR
  const guardarLabor = async () => {
    const { error } = await supabase.from("labores").insert({
      Tipo: tipo,
      Fecha: new Date().toISOString().slice(0, 10),
      Costo_total: Number(costo),
      Cultivo_id: cultivoId,
    });

    if (error) {
      alert("Error al guardar la labor");
      console.error(error);
      return;
    }

    alert("Labor guardada ✅");

    setTipo("");
    setCultivoId("");
    setCosto("");
  };

  return (
    <div style={{ padding: 40 }}>
        <Link href="/">← Volver al inicio</Link>

<br />
<br />
      <h1>Cargar Labor</h1>

      {/* FORMULARIO */}
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

      <hr />

      {/* LISTADO */}
      <h2>Labores cargadas</h2>

      <table border={1} cellPadding={8}>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Cultivo</th>
            <th>Fecha</th>
            <th>Costo</th>
          </tr>
        </thead>
        <tbody>
          {labores.map((l) => (
            <tr key={l.id}>
              <td>{l.Tipo}</td>
              <td>{l.cultivos?.nombre}</td>
              <td>{l.Fecha}</td>
              <td>{l.Costo_total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}