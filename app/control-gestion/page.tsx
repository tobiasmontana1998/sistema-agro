import Link from "next/link";

export default function ControlGestion() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Control de gestión</h1>

      <ul>
        <li>
          <Link href="/control-gestion/facturas">
            Cargar facturas
          </Link>
        </li>
        <li>
          <Link href="/control-gestion/gastos">
            Gastos totales
          </Link>
        </li>
      </ul>
    </div>
  );
}