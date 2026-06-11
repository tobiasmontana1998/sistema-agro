import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch("https://www.cac.bcr.com.ar/es/precios-de-pizarra", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });

    const html = await res.text();

    // Extraer todo el texto visible eliminando tags HTML
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Busca patrón: "Cultivo $NNN.NNN,NN US$ NNN,NN"
    const extraer = (nombre: string) => {
      const r = new RegExp(
        nombre + "\\s*\\$?\\s*([\\d]{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2}))\\s*(?:US\\$|USD)\\s*(?:\\(E\\)\\s*)?([\\d]{1,3}(?:[.,]\\d{2,3}))",
        "i"
      );
      const m = texto.match(r);
      if (!m) return null;
      return { ars: m[1], usd: m[2] };
    };

    const dolarMatch = texto.match(/TC BNA Divisas\s*Comprador[^$]*\$\s*([\d\.,]+)/i);
    const dolar = dolarMatch ? dolarMatch[1].trim() : null;

    const fechaMatch = texto.match(/Precios Pizarra del d[ií]a\s*([\d\/]+)/i);
    const fecha = fechaMatch ? fechaMatch[1] : null;

    // Log para debug — lo podés ver en los logs de Vercel
    const resultado = {
      soja: extraer("Soja"),
      maiz: extraer("Ma[ií]z"),
      trigo: extraer("Trigo"),
      girasol: extraer("Girasol"),
      sorgo: extraer("Sorgo"),
      dolar,
      fecha,
      _debug: texto.substring(texto.indexOf("Trigo"), texto.indexOf("Trigo") + 200),
    };

    return NextResponse.json(resultado);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}