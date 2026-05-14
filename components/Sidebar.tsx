"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const navItems = [
  { section: "GENERAL", items: [{ href: "/", label: "Inicio", icon: "⊞" }] },
  {
    section: "GESTIÓN",
    items: [
      { href: "/control-gestion/gastos", label: "Gastos", icon: "💳" },
      { href: "/control-gestion/facturas", label: "Cargar Gasto", icon: "➕" },
      { href: "/control-gestion/proveedores", label: "Proveedores", icon: "🏢" },
    ],
  },
  {
    section: "AGRICULTURA",
    items: [
      { href: "/agricultura/nueva-labor", label: "Cargar Labor", icon: "🚜" },
      { href: "/agricultura/labores-por-lote", label: "Labores por Lote", icon: "📋" },
      { href: "/agricultura/stock", label: "Stock", icon: "📦" },
      { href: "/agricultura/remitos", label: "Remitos", icon: "📥" },
      { href: "/agricultura/historial-remitos", label: "Historial Remitos", icon: "📄" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div style={{
      width: 240,
      background: "#0f1f17",
      color: "white",
      height: "100vh",
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 0,
      flexShrink: 0,
    }}>
      {/* LOGO */}
      <div style={{ marginBottom: 32, paddingLeft: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f5c542", letterSpacing: -0.5 }}>
          Sistema Agro
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
          Administrador de Campo
        </div>
      </div>

      {/* NAV */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {navItems.map((group) => (
          <div key={group.section} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 8, paddingLeft: 8 }}>
              {group.section}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    marginBottom: 2,
                    textDecoration: "none",
                    color: active ? "#f5c542" : "rgba(255,255,255,0.7)",
                    background: active ? "rgba(245,197,66,0.1)" : "transparent",
                    fontWeight: active ? 600 : 400,
                    fontSize: 14,
                    transition: "all 0.15s",
                    borderLeft: active ? "2px solid #f5c542" : "2px solid transparent",
                  }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            width: "100%", padding: "9px 12px", borderRadius: 8,
            background: "transparent", border: "none", color: "rgba(255,255,255,0.5)",
            fontSize: 14, cursor: "pointer", textAlign: "left",
          }}
        >
          <span>🚪</span> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}