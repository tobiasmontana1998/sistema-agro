import Sidebar from "@/components/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{ display: "flex", margin: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 30 }}>
          {children}
        </main>
      </body>
    </html>
  );
}