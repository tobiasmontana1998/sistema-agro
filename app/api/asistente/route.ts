import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const mensaje = formData.get('mensaje') as string;
    const file = formData.get('file') as File | null;
    const historialStr = formData.get('historial') as string;
    const historial = historialStr ? JSON.parse(historialStr) : [];

    const [{ data: lotes }, { data: proveedores }, { data: insumos }, { data: actividades }] = await Promise.all([
      supabase.from('lotes').select('id, nombre, cultivo_activo, hectareas'),
      supabase.from('proveedores').select('id, razon_social, cuit').eq('activo', true),
      supabase.from('insumos').select('id, nombre, unidad, categoria'),
      supabase.from('actividades').select('id, nombre'),
    ]);

    const sistema = `Sos un asistente para un sistema de gestión agropecuaria argentino.
Tenés acceso a los siguientes datos del sistema:

LOTES: ${JSON.stringify(lotes?.map(l => ({ id: l.id, nombre: l.nombre, cultivo_activo: l.cultivo_activo, hectareas: l.hectareas })))}
PROVEEDORES: ${JSON.stringify(proveedores?.map(p => ({ id: p.id, nombre: p.razon_social, cuit: p.cuit })))}
INSUMOS: ${JSON.stringify(insumos?.map(i => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, categoria: i.categoria })))}
ACTIVIDADES: ${JSON.stringify(actividades?.map(a => ({ id: a.id, nombre: a.nombre })))}

Tu tarea es interpretar el mensaje del usuario y responder SOLO con un JSON con esta estructura:
{
  "accion": "cargar_factura" | "cargar_labor" | "cargar_remito" | "crear_insumo" | "cargar_monitoreo" | "consulta",
  "mensaje_usuario": "respuesta amigable explicando qué vas a hacer",
  "insumos_sin_match": ["nombre del insumo que no encontré en la lista"],
  "datos": {

    // Para cargar_factura:
    // proveedor_id, fecha, fecha_vencimiento, tipo_comprobante, numero_factura, concepto
    // tipo: "Insumos" / "Servicios" / "Combustible" / "Otros"
    // moneda: "ARS" o "USD", dolar: tipo de cambio o null
    // monto_neto, alicuota_iva, monto_iva, percepciones, retenciones, no_gravado — EN ARS
    // cae: sin espacios
    // items: [{ descripcion, insumo_id, cantidad, unidad, precio_unitario, descuento, precio_neto, total }] en ARS

    // Para cargar_labor:
    // Tipo: "Fumigación" / "Siembra" / "Cosecha" / "Fertilización" / "Labranza"
    // Fecha: YYYY-MM-DD
    // Lote_id: uuid del lote
    // hectareas: número
    // Costo_total: en ARS
    // insumos_usados: [{ nombre, insumo_id, cantidad_total, unidad, dosis_por_ha }]
    //   - Si dice "X por hectárea": cantidad_total = X * hectareas del lote
    //   - Si dice "X totales": cantidad_total = X

    // Para cargar_remito:
    // proveedor_id, fecha, numero_remito, observaciones

    // Para crear_insumo:
    // nombre, categoria, unidad, subcategoria

    // Para cargar_monitoreo:
    // lote_id, fecha (hoy si no se menciona), operador, cultivo
    // estado_fenologico, condicion_general, cobertura, comentario

    // Para consulta: null
  }
}

IMPORTANTE:
- Usá el historial de la conversación para completar datos que falten en el mensaje actual.
- Si en un mensaje anterior se mencionó un lote, fecha o labor, usá esos datos para el mensaje actual.
- Todos los importes en ARS. Si es USD multiplicar por tipo de cambio.
- Para labores: si dice "X por hectárea" multiplicar por hectáreas del lote.
- Matchear insumos con la lista INSUMOS. Si no matchea: insumo_id null y agregar a insumos_sin_match.
- Respondé SOLO con JSON válido, sin texto extra ni backticks.`;

    // Construir mensajes con historial
    const mensajesHistorial = historial.map((h: any) => ({
      role: h.rol === 'usuario' ? 'user' : 'assistant',
      content: h.texto
    }));

    // Nuevo mensaje del usuario
    let nuevoContenido: any[];
    if (file) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const isPdf = file.type === 'application/pdf';
      nuevoContenido = [
        {
          type: isPdf ? 'document' : 'image',
          source: { type: 'base64', media_type: file.type, data: base64 }
        },
        { type: 'text', text: 'Analizá este archivo y extraé los datos relevantes.' }
      ];
    } else {
      nuevoContenido = [{ type: 'text', text: mensaje }];
    }

    const messages = [
      ...mensajesHistorial,
      { role: 'user', content: nuevoContenido }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: sistema,
        messages
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
   console.log('INSUMOS_SIN_MATCH:', JSON.stringify(parsed.insumos_sin_match));
console.log('INSUMOS_USADOS:', JSON.stringify(parsed.datos?.insumos_usados));
console.log('INSUMOS_BD:', insumos?.map((i: any) => i.nombre));
    return NextResponse.json({ ...parsed, _respuestaTexto: text });

  } catch (error: any) {
    console.error('Error asistente:', error.message);
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}