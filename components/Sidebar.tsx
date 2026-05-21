"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useState, useEffect } from "react";

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
      { href: "/control-gestion/liquidaciones", label: "Liquidaciones", icon: "🌾" },
      { href: "/control-gestion/aportes", label: "Aportes", icon: "💰" },
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
      { href: "/agricultura/planes", label: "Planes de cultivos", icon: "📋" },
      { href: "/agricultura/margenes", label: "Márgenes", icon: "📊" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [esMobil, setEsMobil] = useState(false);

  useEffect(() => {
    const check = () => setEsMobil(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Cerrar menu al cambiar de página
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  const navContent = (
    <>
      <div style={{ marginBottom: 32, paddingLeft: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f5c542", letterSpacing: -0.5 }}>Sistema Agro</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Administrador de Campo</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {navItems.map((group) => (
          <div key={group.section} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 8, paddingLeft: 8 }}>
              {group.section}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                  textDecoration: "none",
                  color: active ? "#f5c542" : "rgba(255,255,255,0.7)",
                  background: active ? "rgba(245,197,66,0.1)" : "transparent",
                  fontWeight: active ? 600 : 400, fontSize: 14,
                  borderLeft: active ? "2px solid #f5c542" : "2px solid transparent",
                }}>
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 8, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer" }}>
          <span>🚪</span> Cerrar Sesión
        </button>
      </div>
    </>
  );

  if (esMobil) {
    return (
      <>
        {/* BARRA SUPERIOR MÓVIL */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: "#0f1f17", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 1000 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f5c542" }}>Sistema Agro</div>
          <button onClick={() => setMenuAbierto(!menuAbierto)} style={{ background: "none", border: "none", color: "white", fontSize: 24, cursor: "pointer" }}>
            {menuAbierto ? "✕" : "☰"}
          </button>
        </div>

        {/* MENÚ DESPLEGABLE */}
        {menuAbierto && (
          <div style={{ position: "fixed", top: 56, left: 0, right: 0, bottom: 0, background: "#0f1f17", zIndex: 999, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {navContent}
          </div>
        )}

        {/* ESPACIADOR para que el contenido no quede debajo de la barra */}
        <div style={{ height: 56 }} />
      </>
    );
  }

  return (
    <div style={{ width: 240, background: "#0f1f17", color: "white", height: "100vh", padding: "24px 16px", display: "flex", flexDirection: "column", position: "sticky", top: 0, flexShrink: 0 }}>
      {navContent}
    </div>
  );
}