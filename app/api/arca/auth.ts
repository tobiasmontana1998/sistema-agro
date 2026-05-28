import * as forge from 'node-forge';
import axios from 'axios';
import * as fs from 'fs';

const WSAA_URL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms';

let cachedTokenWsfe: { token: string; sign: string; expira: Date } | null = null;
let cachedTokenWscdc: { token: string; sign: string; expira: Date } | null = null;

async function generateToken(
  service: string,
  cachedToken: { token: string; sign: string; expira: Date } | null,
  certPath?: string
) {
  if (cachedToken && cachedToken.expira > new Date()) {
    return cachedToken;
  }

  const cert = fs.readFileSync(certPath || process.env.CERT_PATH!, 'utf8');
  const key = fs.readFileSync(process.env.KEY_PATH!, 'utf8');

  const now = new Date();
  const from = new Date(now.getTime() - 60000).toISOString();
  const to = new Date(now.getTime() + 43200000).toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);

  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${from}</generationTime>
    <expirationTime>${to}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key),
    certificate: forge.pki.certificateFromPem(cert),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: []
  });
  p7.sign({ detached: false });

  const cms = Buffer.from(
    forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary'
  ).toString('base64');

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const wsaaResponse = await axios.post(WSAA_URL, soapBody, {
    headers: { 'Content-Type': 'text/xml', 'SOAPAction': '' }
  });

  const loginCmsReturn = wsaaResponse.data.match(/loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/)[1];
  const decoded = loginCmsReturn.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const token = decoded.match(/<token>([\s\S]*?)<\/token>/)[1];
  const sign = decoded.match(/<sign>([\s\S]*?)<\/sign>/)[1];

  return {
    token,
    sign,
    expira: new Date(now.getTime() + 11 * 60 * 60 * 1000)
  };
}

export async function getToken(): Promise<{ token: string; sign: string }> {
  console.log('CERT_PATH:', process.env.CERT_PATH);
  console.log('KEY_PATH:', process.env.KEY_PATH);
  const result = await generateToken('wsfe', cachedTokenWsfe);
  cachedTokenWsfe = result;
  return { token: result.token, sign: result.sign };
}

export async function getTokenWscdc(): Promise<{ token: string; sign: string }> {
  const result = await generateToken('wscdc', cachedTokenWscdc, process.env.CERT_PATH_WSCDC);
  cachedTokenWscdc = result;
  return { token: result.token, sign: result.sign };
}