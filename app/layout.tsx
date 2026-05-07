import Sidebar from "@/components/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex" }}>

          {/* ✅ Sidebar izquierda */}
          <Sidebar />

          {/* ✅ Contenido derecha */}
          <div style={{ flex: 1, padding: 30 }}>
            {children}
          </div>

        </div>
      </body>
    </html>
  );
}