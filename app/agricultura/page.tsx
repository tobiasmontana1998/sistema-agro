import Link from "next/link";

export default function Agricultura() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Agricultura</h1>

      <ul>
        <li>
          <Link href="/agricultura/nueva-labor">Nueva labor</Link>
        </li>
        <li>
          <Link href="/agricultura/lotes">Labores por lote</Link>
        </li>
      </ul>
    </div>
  );
}