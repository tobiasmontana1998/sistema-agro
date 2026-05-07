"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <div
      style={{
        width: 240,
        background: "#0f3d2e",
        color: "white",
        height: "100vh",
        padding: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ✅ TÍTULO */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ margin: 0 }}>Sistema Agro</h2>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Administrador de Campo
        </p>
      </div>

      {/* ✅ GENERAL */}
      <div style={{ marginBottom: 25 }}>
        <p style={{ fontSize: 12, opacity: 0.6 }}>GENERAL</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/" style={{ color: "white", textDecoration: "none" }}>
            🏠 Inicio
          </Link>
        </div>
      </div>

      {/* ✅ GESTIÓN */}
      <div style={{ marginBottom: 25 }}>
        <p style={{ fontSize: 12, opacity: 0.6 }}>GESTIÓN</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/control-gestion/gastos"
            style={{ color: "white", textDecoration: "none" }}
          >
            💰 Gastos
          </Link>

          <Link
            href="/control-gestion/facturas"
            style={{ color: "white", textDecoration: "none" }}
          >
            ➕ Cargar gasto
          </Link>
        </div>
      </div>

      {/* ✅ AGRICULTURA */}
      <div>
        <p style={{ fontSize: 12, opacity: 0.6 }}>AGRICULTURA</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/agricultura/nueva-labor"
            style={{ color: "white", textDecoration: "none" }}
          >
            🚜 Cargar labor
          </Link>

          <Link
            href="/agricultura/labores-por-lote"
            style={{ color: "white", textDecoration: "none" }}
          >
            📊 Labores por lote
          </Link>
        </div>
      </div>

      {/* ✅ FOOTER */}
      <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.7 }}>
        Sistema activo ✅
      </div>
    </div>
  );
}