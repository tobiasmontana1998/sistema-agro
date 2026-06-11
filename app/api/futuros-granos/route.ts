import { NextResponse } from "next/server";

export const revalidate = 1800; // cache 30 minutos

// Posiciones de cosecha por cultivo
const POSICIONES_COSECHA: Record<string, string[]> = {
  soja:  ["05/", "11/"],        // Mayo y Noviembre
  maiz:  ["04/", "07/", "12/"], // Abril, Julio, Diciembre
  trigo: ["12/", "01/", "03/"], // Diciembre, Enero, Marzo
};

function proximaPositcion(filas: string[], posiciones: string[]): number | null {
  const ahora = new Date();
  const mesActual = ahora.getMonth() + 1;
  const anioActual = ahora.getFullYear();

  for (const fila of filas) {
    for (const pos of posiciones) {
      if (fila.includes(pos)) {
        // Extraer mes y año del formato MM/YYYY
        const match = fila.match(/(\d{2})\/(\d{4})/);
        if (match) {
          const mes = parseInt(match[1]);
          const anio = parseInt(match[2]);
          // Solo posiciones futuras o del mes actual
          if (anio > anioActual || (anio === anioActual && mes >= mesActual)) {
            // Extraer precio (columna "Cierre")
            const nums = fila.match(/[\d]+\.[\d]+/g);
            if (nums && nums.length >= 6) {
              const cierre = parseFloat(nums[5]); // índice del cierre
              if (cierre > 0) return cierre;
            }
          }
        }
      }
    }
  }
  return null;
}

export async function GET() {
  try {
    const res = await fetch("https://www.bolsadecereales.com/mercados", {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 },
    });

    const html = await res.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Separar en líneas por producto
    const lineas = texto.split(/(?=MAIZ ROS|SOJA ROS|TRIGO ROS)/);

    const sojaLineas  = lineas.filter(l => l.startsWith("SOJA ROS") && !l.includes("CHICAGO") && !l.includes("MINI"));
    const maizLineas  = lineas.filter(l => l.startsWith("MAIZ ROS") && !l.includes("CHICAGO") && !l.includes("MINI"));
    const trigoLineas = lineas.filter(l => l.startsWith("TRIGO ROS") && !l.includes("MINI"));

    const soja  = proximaPositcion(sojaLineas, POSICIONES_COSECHA.soja);
    const maiz  = proximaPositcion(maizLineas, POSICIONES_COSECHA.maiz);
    const trigo = proximaPositcion(trigoLineas, POSICIONES_COSECHA.trigo);

    // Extraer posición usada para mostrar en UI
    const getPosLabel = (filas: string[], posiciones: string[]) => {
      for (const fila of filas) {
        for (const pos of posiciones) {
          if (fila.includes(pos)) {
            const match = fila.match(/(\d{2}\/\d{4})/);
            return match ? match[1] : null;
          }
        }
      }
      return null;
    };

    return NextResponse.json({
      soja:  soja  ? { precio: soja,  posicion: getPosLabel(sojaLineas,  POSICIONES_COSECHA.soja)  } : null,
      maiz:  maiz  ? { precio: maiz,  posicion: getPosLabel(maizLineas,  POSICIONES_COSECHA.maiz)  } : null,
      trigo: trigo ? { precio: trigo, posicion: getPosLabel(trigoLineas, POSICIONES_COSECHA.trigo) } : null,
      fuente: "Bolsa de Cereales de Buenos Aires",
      actualizado: new Date().toISOString(),
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}