import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://www.matbarofex.com.ar/api/v1/futuros/precios-cierre", {
      headers: { "Accept": "application/json" },
      next: { revalidate: 3600 }
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "No se pudo obtener precios" }, { status: 500 });
  }
}