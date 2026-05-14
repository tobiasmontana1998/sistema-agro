"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !pathname.startsWith("/login");

  return (
    <html lang="es">
      <body style={{ display: "flex", margin: 0, background: "#f4f6f4", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", minHeight: "100vh" }}>
        {showSidebar && <Sidebar />}
        <main style={{ flex: 1, padding: showSidebar ? 32 : 0, overflowY: "auto", minHeight: "100vh" }}>
          {children}
        </main>
      </body>
    </html>
  );
}