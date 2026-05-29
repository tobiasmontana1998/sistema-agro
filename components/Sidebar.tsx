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
      { href: "/asistente", label: "Asistente IA", icon: "🤖" },
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
      { href: "/agricultura/planes", label: "Planes de cultivos", icon: "🌱" },
      { href: "/agricultura/monitoreos", label: "Monitoreos", icon: "🔍" },
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

  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  const navContent = (
    <div className="flex flex-col h-full">
      {/* LOGO */}
      <div className="mb-8 px-2">
        <div className="text-xl font-extrabold text-yellow-400 tracking-tight">Sistema Agro</div>
        <div className="text-xs text-white/30 mt-0.5">Administrador de Campo</div>
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto space-y-6">
        {navItems.map((group) => (
          <div key={group.section}>
            <p className="text-[10px] font-semibold text-white/30 tracking-widest mb-2 px-2">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all border-l-2
                      ${active
                        ? "bg-yellow-400/10 text-yellow-400 border-yellow-400 font-semibold"
                        : "text-white/60 border-transparent hover:bg-white/5 hover:text-white/90"
                      }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* CERRAR SESIÓN */}
      <div className="border-t border-white/10 pt-4 mt-4">
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
        >
          <span>🚪</span> Cerrar Sesión
        </button>
      </div>
    </div>
  );

  /* ── MOBILE ── */
  if (esMobil) {
    return (
      <>
        {/* TOPBAR */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-[#0f1f17] flex items-center justify-between px-4 z-50 shadow-lg">
          <span className="text-lg font-extrabold text-yellow-400">Sistema Agro</span>
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="text-white text-2xl p-1 hover:text-yellow-400 transition-colors"
          >
            {menuAbierto ? "✕" : "☰"}
          </button>
        </div>

        {/* OVERLAY */}
        {menuAbierto && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        {/* DRAWER */}
        <div className={`fixed top-14 left-0 bottom-0 w-64 bg-[#0f1f17] z-50 p-4 overflow-y-auto transition-transform duration-300
          ${menuAbierto ? "translate-x-0" : "-translate-x-full"}`}
        >
          {navContent}
        </div>

        {/* SPACER */}
        <div className="h-14 flex-shrink-0" />
      </>
    );
  }

  /* ── DESKTOP ── */
  return (
    <div className="w-56 bg-[#0f1f17] text-white min-h-screen p-5 flex flex-col sticky top-0 flex-shrink-0">
      {navContent}
    </div>
  );
}