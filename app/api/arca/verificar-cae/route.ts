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

export async function POST(req: NextRequest) {
  try {
    const { cae, cuitEmisor, tipoComprobante, ptoVta, nroComprobante, fecha, importe } = await req.json();
    console.log('Datos recibidos:', { cae, cuitEmisor, tipoComprobante, ptoVta, nroComprobante, fecha, importe });

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
        <CuitEmisor>${cuitEmisor}</CuitEmisor>
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

    const valido = response.data.includes('>A<') && response.data.includes('Resultado');
    return NextResponse.json({ valido });

  } catch (error: any) {
    console.log('Respuesta ARCA:', error.response?.data);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}