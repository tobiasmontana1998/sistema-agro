"use client";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function Sidebar() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ margin: 0 }}>Sistema Agro</h2>
        <p style={{ fontSize: 12, opacity: 0.7 }}>Administrador de Campo</p>
      </div>

      <div style={{ marginBottom: 25 }}>
        <p style={{ fontSize: 12, opacity: 0.6 }}>GENERAL</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/" style={{ color: "white", textDecoration: "none" }}>
            🏠 Inicio
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 25 }}>
        <p style={{ fontSize: 12, opacity: 0.6 }}>GESTIÓN</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/control-gestion/gastos" style={{ color: "white", textDecoration: "none" }}>
            💰 Gastos
          </Link>
          <Link href="/control-gestion/facturas" style={{ color: "white", textDecoration: "none" }}>
            ➕ Cargar gasto
          </Link>
          <Link href="/control-gestion/proveedores" style={{ color: "white", textDecoration: "none" }}>
            🏢 Proveedores
          </Link>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6 }}>AGRICULTURA</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/agricultura/nueva-labor" style={{ color: "white", textDecoration: "none" }}>
            🚜 Cargar labor
          </Link>
          <Link href="/agricultura/labores-por-lote" style={{ color: "white", textDecoration: "none" }}>
            📊 Labores por lote
          </Link>
          <Link href="/agricultura/stock" style={{ color: "white", textDecoration: "none" }}>
  📦 Stock
</Link>
<Link href="/agricultura/remitos" style={{ color: "white", textDecoration: "none" }}>
  📥 Remitos
</Link>
<Link href="/agricultura/historial-remitos" style={{ color: "white", textDecoration: "none" }}>
  📋 Historial remitos
</Link>
        </div>
      </div>

      <div style={{ marginTop: "auto" }}>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: 6,
            cursor: "pointer",
            width: "100%",
            marginBottom: 10,
          }}
        >
          🚪 Cerrar sesión
        </button>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Sistema activo ✅</div>
      </div>
    </div>
  );
}