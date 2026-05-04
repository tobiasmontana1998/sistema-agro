import Link from "next/link";

export default function Home() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Sistema Agro</h1>

      <p>Bienvenido al sistema de gestión agrícola.</p>

      <ul>
        <li>
          <Link href="/labores">Labores</Link>
        </li>
      </ul>
    </div>
  );
}
