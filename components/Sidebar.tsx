"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <div
      style={{
        width: 240,
        background: "#f5f5f5",
        height: "100vh",
        padding: 20,
        borderRight: "1px solid #ddd",
      }}
    >
      <h2 style={{ marginBottom: 20 }}>Sistema Agro</h2>

      {/* 🔹 GENERAL */}
      <div style={{ marginBottom: 20 }}>
        <strong>General</strong>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/">Inicio</Link>
        </div>
      </div>

      {/* 🔹 GESTIÓN */}
      <div style={{ marginBottom: 20 }}>
        <strong>Gestión</strong>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/control-gestion/gastos">Gastos</Link>
          <Link href="/control-gestion/facturas">Cargar gasto</Link>
        </div>
      </div>

      {/* 🔹 AGRICULTURA */}
      <div>
        <strong>Agricultura</strong>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/agricultura/nueva-labor">Cargar labor</Link>
          <Link href="/agricultura/labores">Labores</Link>
          <Link href="/agricultura/labores-por-lote">Labores por lote</Link>
        </div>
      </div>
    </div>
  );
}