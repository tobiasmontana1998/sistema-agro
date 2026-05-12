"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

export default function CargarFactura() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  useEffect(() => {
    console.log("ID:", id);
  }, [id]);

  // 🔹 estados
  const [fecha, setFecha] = useState("");
  const [fechaVto, setFechaVto] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [proveedorId, setProveedorId] = useState("");

  const [numeroFactura, setNumeroFactura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagador, setPagador] = useState("");
  const [monto, setMonto] = useState("");

  const [actividad, setActividad] = useState("");
  const [actividades, setActividades] = useState<any[]>([]);

  const [labor, setLabor] = useState("");
  const [labores, setLabores] = useState<any[]>([]);

  const [dolar, setDolar] = useState<number | null>(null);

  // 🔹 cargar actividades
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("actividades").select();
      setActividades(data || []);
    };
    fetchData();
  }, []);
useEffect(() => {
  const fetchProveedores = async () => {
    const { data, error } = await supabase
      .from("proveedores")
      .select("id, razon_social")
      .eq("activo", true)
      .order("razon_social");

    if (error) {
      console.error(error);
      return;
    }

    setProveedores(data || []);
  };

  fetchProveedores();
}, []);
  // 🔹 cargar labores
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("labores").select();
      setLabores(data || []);
    };
    fetchData();
  }, []);

  // ✅ dólar histórico
  const obtenerDolarPorFecha = async (fecha: string) => {
    try {
      const res = await fetch("https://api.bluelytics.com.ar/v2/evolution.json");
      const data = await res.json();

      const fechaISO = new Date(fecha).toISOString().slice(0, 10);

      let encontrado = data.find((d: any) =>
        d.date.startsWith(fechaISO)
      );

      if (!encontrado) {
        encontrado = data[data.length - 1];
      }

      return (encontrado.value_buy + encontrado.value_sell) / 2;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  // ✅ actualizar dólar
  useEffect(() => {
    if (!fecha) return;

    const fetchData = async () => {
      const valor = await obtenerDolarPorFecha(fecha);
      setDolar(valor);
    };

    fetchData();
  }, [fecha]);

  // ✅ traer factura si hay id
  useEffect(() => {
    if (!id) return;

    const fetchFactura = async () => {
      const { data, error } = await supabase
        .from("facturas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setFecha(data.Fecha || "");
        setFechaVto(data.Fecha_vencimiento || "");
        setProveedorId(data.proveedor_id);
        setNumeroFactura(data.Numero_factura || "");
        setConcepto(data.Concepto || "");
        setTipo(data.Tipo || "");
        setPagador(data.Pagador || "");
        setMonto(data.Monto || "");

        setActividad(data.Actividad_id || "");
        setLabor(data.Labor_id || "");

        setDolar(data.dolar || null);
      }
    };

    fetchFactura();
  }, [id]);

  // ✅ guardar
  const guardarFactura = async () => {
    if (!fecha || !monto || !dolar) {
      alert("Completá los campos obligatorios");
      return;
    }
    if (!proveedorId) {
  alert("Seleccioná un proveedor");
  return;
}

    const montoUSD = Number(monto) / dolar;

    let error;

    if (id) {
      const { error: updateError } = await supabase
        .from("facturas")
        .update({
          Fecha: fecha,
          Fecha_vencimiento: fechaVto || null,
          Numero_factura: numeroFactura,
          Concepto: concepto,
          Tipo: tipo,
          Pagador: pagador,
          Monto: Number(monto),
          monto_usd: montoUSD,
          dolar: dolar,
          Actividad_id: actividad,
          Labor_id: labor || null,
        })
        .eq("id", id);

      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("facturas")
        .insert([
          {
            Fecha: fecha,
            Fecha_vencimiento: fechaVto || null,
            proveedor_id: proveedorId,
            Proveedor: proveedor,
            Numero_factura: numeroFactura,
            Concepto: concepto,
            Tipo: tipo,
            Pagador: pagador,
            Monto: Number(monto),
            monto_usd: montoUSD,
            dolar: dolar,
            Actividad_id: actividad,
            Labor_id: labor || null,
          },
        ]);

      error = insertError;
    }

    if (error) {
      console.error("ERROR REAL:", error);
      alert(error.message);
      return;
    }

    alert(`✅ ARS ${monto} | USD ${montoUSD.toFixed(2)}`);

    // limpiar
    setFecha("");
    setFechaVto("");
    setProveedor("");
    setNumeroFactura("");
    setConcepto("");
    setTipo("");
    setPagador("");
    setMonto("");
    setActividad("");
    setLabor("");
    setDolar(null);
  };

  // 🎨 estilos
  const cardStyle = {
    background: "white",
    padding: 30,
    borderRadius: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };

  const grid2 = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  };

  const inputStyle = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
    marginTop: 5,
  };

  const btnPrimary = {
    padding: "12px 20px",
    background: "#0f3d2e",
    color: "white",
    border: "none",
    borderRadius: 8,
  };

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 900 }}>
        <div style={cardStyle}>
          <h1>{id ? "✏️ Editar factura" : "➕ Cargar facturas"}</h1>

          <div style={grid2}>
            <div>
              <label>Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => {
                  const nuevaFecha = e.target.value;
                  setFecha(nuevaFecha);

                  obtenerDolarPorFecha(nuevaFecha).then(setDolar);
                }}
                style={inputStyle}
              />
            </div>

            <div>
              <label>Vencimiento</label>
              <input
                type="date"
                value={fechaVto}
                onChange={(e) => setFechaVto(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
  <label>Proveedor *</label>
  <select
    value={proveedorId}
    onChange={(e) => setProveedorId(e.target.value)}
    style={{ width: "100%", padding: 10, borderRadius: 8 }}
  >
    <option value="">Seleccionar proveedor</option>

    {proveedores.map((p) => (
      <option key={p.id} value={p.id}>
        {p.razon_social}
      </option>
    ))}
  </select>
</div>

            <div>
              <label>Factura</label>
              <input
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Concepto</label>
            <textarea
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              style={{ ...inputStyle, height: 80 }}
            />
          </div>

          <div style={{ ...grid2, marginTop: 20 }}>
            <div>
              <label>Actividad</label>
              <select
                value={actividad}
                onChange={(e) => setActividad(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar</option>
                {actividades.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Labor</label>
              <select
                value={labor}
                onChange={(e) => setLabor(e.target.value)}
                style={inputStyle}
              >
                <option value="">Sin asociar</option>
                {labores.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.numero} - {l.Tipo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ ...grid2, marginTop: 20 }}>
            <div>
              <label>Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar</option>
                <option>Insumos</option>
                <option>Servicios</option>
                <option>Combustible</option>
              </select>
            </div>

            <div>
              <label>Pagador</label>
              <select
                value={pagador}
                onChange={(e) => setPagador(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar</option>
                <option value="CT">CT</option>
                <option value="OC">OC</option>
                <option value="Sociedad">Sociedad</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Monto *</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: 15 }}>
            <label>Dólar aplicado</label>
            <input
              type="number"
              value={dolar || ""}
              onChange={(e) => setDolar(Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          {monto && dolar && (
            <p style={{ marginTop: 10 }}>
              ≈ USD {(Number(monto) / dolar).toFixed(2)}
            </p>
          )}

          <div style={{ marginTop: 30 }}>
            <button onClick={guardarFactura} style={btnPrimary}>
              💾 Guardar factura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}