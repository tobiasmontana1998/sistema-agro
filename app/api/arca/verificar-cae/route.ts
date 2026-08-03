import { NextRequest, NextResponse } from 'next/server';
import { getTokenWscdc } from '../auth';
import axios from 'axios';
import https from 'https';

const WSCDC_URL = 'https://servicios1.afip.gov.ar/wscdc/service.asmx';

const httpsAgent = new https.Agent({
  secureOptions: require('crypto').constants.SSL_OP_LEGACY_SERVER_CONNECT,
  ciphers: 'DEFAULT:@SECLEVEL=0',
  minVersion: 'TLSv1' as any,
});

// Extrae el texto de un tag XML simple, sin importar el orden en el documento.
function extraerTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : null;
}

// Extrae todas las observaciones (pueden venir varias <Obs> dentro de <Observaciones>)
function extraerObservaciones(xml: string): string[] {
  const bloque = extraerTag(xml, 'Observaciones');
  if (!bloque) return [];
  const msgs = [...bloque.matchAll(/<Msg>([\s\S]*?)<\/Msg>/g)].map(m => m[1].trim());
  return msgs;
}

// Decodifica entidades HTML básicas que vienen dentro de <faultstring>
// (AFIP manda "--&gt;" en vez de "-->", por ejemplo).
function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function POST(req: NextRequest) {
  try {
    const { cae, cuitEmisor, tipoComprobante, ptoVta, nroComprobante, fecha, importe } = await req.json();

    // AFIP espera el CUIT como entero puro, sin guiones ni espacios
    // (ej: "30-70749193-7" -> "30707491937"). Si se manda con guiones,
    // WSCDC rechaza todo el XML con "Input string was not in a correct format".
    const cuitEmisorLimpio = String(cuitEmisor).replace(/\D/g, '');

    console.log('Datos recibidos:', { cae, cuitEmisor: cuitEmisorLimpio, tipoComprobante, ptoVta, nroComprobante, fecha, importe });

    const { token, sign } = await getTokenWscdc();

    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ComprobanteConstatar xmlns="http://servicios1.afip.gob.ar/wscdc/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${process.env.CUIT_EMPRESA}</Cuit>
      </Auth>
      <CmpReq>
        <CbteModo>CAE</CbteModo>
        <CuitEmisor>${cuitEmisorLimpio}</CuitEmisor>
        <PtoVta>${ptoVta}</PtoVta>
        <CbteTipo>${tipoComprobante}</CbteTipo>
        <CbteNro>${nroComprobante}</CbteNro>
        <CbteFch>${fecha}</CbteFch>
        <ImpTotal>${importe}</ImpTotal>
        <CodAutorizacion>${cae}</CodAutorizacion>
        <DocTipoReceptor>80</DocTipoReceptor>
        <DocNroReceptor>${process.env.CUIT_EMPRESA}</DocNroReceptor>
      </CmpReq>
    </ComprobanteConstatar>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios.post(WSCDC_URL, soapBody, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://servicios1.afip.gob.ar/wscdc/ComprobanteConstatar"',
      },
      httpsAgent,
    });

    console.log('Respuesta WSCDC:', response.data.substring(0, 1500));

    // Parseo puntual del tag <Resultado>, no una búsqueda de substring
    // suelta en todo el XML (evita falsos positivos/negativos).
    const resultado = extraerTag(response.data, 'Resultado');
    const valido = resultado === 'A';
    const observaciones = extraerObservaciones(response.data);

    return NextResponse.json({
      valido,
      resultado,
      observaciones: observaciones.length > 0 ? observaciones : undefined,
    });

  } catch (error: any) {
    console.log('Respuesta ARCA:', error.response?.data);

    // Intentamos sacar el motivo real del rechazo. Puede venir en dos
    // formatos distintos de AFIP:
    // 1) SOAP Fault (rechazo de la petición en sí, ej: XML mal formado,
    //    CUIT con guiones, etc.) -> <faultstring>
    // 2) Respuesta de negocio con observaciones (comprobante rechazado
    //    pero la petición era válida) -> <Observaciones><Msg>
    // Si no hay XML de AFIP disponible, caemos al mensaje genérico de axios.
    const dataError: string | undefined = error.response?.data;
    let detalle = error.message;
    if (dataError) {
      const faultString = extraerTag(dataError, 'faultstring');
      const msgError = extraerTag(dataError, 'Msg');
      const obs = extraerObservaciones(dataError);
      if (faultString) detalle = decodificarEntidades(faultString);
      else if (msgError) detalle = msgError;
      else if (obs.length > 0) detalle = obs.join(' | ');
    }

    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}