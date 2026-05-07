"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CargarFacturas() {
  const [fecha, setFecha] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipo, setTipo] = useState("");
  const [monto, setMonto] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [laborId, setLaborId] = useState("");
  const [actividadId, setActividadId] = useState("");
  const [labores, setLabores] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);

  // 🔹 Cargar labores (para asociar factura)
  useEffect(() => {
    const cargarLabores = async () => {
      const { data } = await supabase
        .from("labores")
        .select("id, Tipo, Fecha")
        .order("Fecha", { ascending: false });

      setLabores(data || []);
    };
    cargarLabores();
  }, []);

  // 🔹 Cargar actividades
  useEffect(() => {
    const cargarActividades = async () => {
      const { data } = await supabase
       .from("actividades")
       .select("id, nombre")
       .order("nombre");

      setActividades(data || []);
      
    if (data && data.length > 0) {
         setActividadId(data[0].id);
      }

    };

    cargarActividades();
  }, []);


  

  const guardarFactura = async () => {
    if (!fecha || !proveedor || !concepto || !tipo || !monto) {
      alert("Completá todos los campos obligatorios");
      return;
    }
    
     if (!actividadId) {
       alert("Seleccioná una actividad");
       return;
      }


    const { error } = await supabase.from("facturas").insert([
      {
        "Fecha": fecha,
        "Proveedor": proveedor,
        "Concepto": concepto,
        "Tipo": tipo,
        "Monto": Number(monto),
        "Numero_factura": numeroFactura || null,
        "Actividad_id": actividadId,
        "Labor_id": laborId || null,
      },
    ]);

    if (error) {
      console.error("ERROR SUPABASE:", error);
      alert("Error al guardar la factura: " + error.message);
     return;

  
    }

    alert("Factura guardada ✅");

    // limpiar formulario
    setFecha("");
    setProveedor("");
    setConcepto("");
    setNumeroFactura("");
    setTipo("");
    setMonto("");
    setLaborId("");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Cargar facturas</h1>

      <div>
        <label>Fecha</label>
        <br />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      <br />

      <div>
        <label>Proveedor</label>
        <br />
        <input
          type="text"
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
        />
      </div>
      
<br />

<div>
  <label>Número de factura (opcional)</label>
  <br />
  <input
    type="text"
    value={numeroFactura}
    onChange={(e) => setNumeroFactura(e.target.value)}
  />
</div>


      <br />
      

      <div>
        <label>Concepto</label>
        <br />
        <input
          type="text"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />
      </div>

      <br />

      <div>
        <label>Tipo de gasto</label>
        <br />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Seleccionar</option>
          <option value="insumos">Insumos</option>
          <option value="servicios">Servicios</option>
          <option value="combustible">Combustible</option>
          <option value="impuestos">Impuestos</option>
        </select>
      </div>

      <br />
      

<div>
  <label>Actividad</label>
  <br />
  <select
    value={actividadId}
    onChange={(e) => setActividadId(e.target.value)}
  >
    <option value="">Seleccionar actividad...</option>
    
    {actividades.map((a) => (
      <option key={a.id} value={a.id}>
        {a.nombre}
      </option>
    ))}

  </select>
</div>
<br />

      <div>
        <label>Monto</label>
        <br />
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </div>

      <br />

      <div>
        <label>Labor asociada (opcional)</label>
        <br />
        <select
          value={laborId}
          onChange={(e) => setLaborId(e.target.value)}
        >
          <option value="">Sin asociar</option>
          {labores.map((l) => (
            <option key={l.id} value={l.id}>
              {l.Tipo} - {l.Fecha}
            </option>
          ))}
        </select>
      </div>

      <br />

      <button onClick={guardarFactura}>Guardar factura</button>
    </div>
  );
}
