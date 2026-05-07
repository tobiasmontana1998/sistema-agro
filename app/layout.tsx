import Sidebar from "@/components/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>
        
        <div style={{ display: "flex" }}>

          {/* ✅ SIDEBAR */}
          <Sidebar />

          {/* ✅ CONTENIDO */}
          <div
            style={{
              flex: 1,
              padding: 40,
              background: "#f4f6f9",   // 👈 fondo gris claro
              minHeight: "100vh",
            }}
          >
            {children}
          </div>

        </div>

      </body>
    </html>
  );
}