import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <nav style={{ padding: 20, borderBottom: "1px solid #ccc" }}>
       <Link href="/">Inicio</Link>
        {" | "}
       <Link href="/labores">Labores</Link>
       </nav>


        <main>{children}</main>
      </body>
    </html>
  );
}

