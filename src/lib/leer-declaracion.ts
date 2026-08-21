import { exigirEnv } from './supabase';
import { modelosDisponibles, Cadencia } from './gemini';
import { UA } from './descubrir';
import { extractText, getDocumentProxy } from 'unpdf';

export interface DeclaracionLeida {
  fecha_declaracion: string | null;
  rendimientos_trabajo: number | null;
  rendimientos_capital: number | null;
  rendimientos_actividades: number | null;
  rentas_detalle: string | null;
  irpf_pagado: number | null;
  inmuebles_urbanos: number | null;
  inmuebles_rusticos: number | null;
  inmuebles_detalle: string | null;
  depositos: number | null;
  valores: number | null;
  planes_pensiones: number | null;
  vehiculos: number | null;
  vehiculos_detalle: string | null;
  prestamos_concedido: number | null;
  deuda_pendiente: number | null;
  observaciones: string | null;
  confianza: string;
  dudas: string[];
}

const NUM = { type: ['number', 'null'] };
const TXT = { type: ['string', 'null'] };

const ESQUEMA = {
  type: 'object',
  properties: {
    fecha_declaracion: TXT,
    rendimientos_trabajo: NUM, rendimientos_capital: NUM, rendimientos_actividades: NUM,
    rentas_detalle: TXT, irpf_pagado: NUM,
    inmuebles_urbanos: NUM, inmuebles_rusticos: NUM, inmuebles_detalle: TXT,
    depositos: NUM, valores: NUM, planes_pensiones: NUM,
    vehiculos: NUM, vehiculos_detalle: TXT,
    prestamos_concedido: NUM, deuda_pendiente: NUM,
    observaciones: TXT,
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    dudas: { type: 'array', items: { type: 'string' } }
  },
  required: ['confianza', 'dudas']
};

const PROMPT = `Lees una DECLARACIÓN DE BIENES Y RENTAS de un diputado del Congreso de España.
Es un documento escaneado o con texto. Extrae los valores EXACTAMENTE como aparecen escritos.

REGLAS CRÍTICAS:
- Si una casilla está VACÍA, devuelve null. NUNCA pongas 0. Vacío y cero son cosas distintas.
- Los importes están en formato español: 37.357,80 significa treinta y siete mil. Devuélvelos como
  número decimal con punto: 37357.80
- Nunca inventes una cifra. Si no la lees con seguridad, ponla en "dudas" y devuelve null.
- No sumes ni calcules nada que no esté escrito, salvo lo indicado abajo.

QUÉ EXTRAER, sección por sección:

RENTAS PERCIBIDAS POR EL PARLAMENTARIO
- rendimientos_trabajo: suma de las filas de "Percepciones netas de tipo salarial, sueldos,
  honorarios, aranceles y otras retribuciones". Si hay varias filas, súmalas.
- rendimientos_capital: filas de "Dividendos y participación en beneficios" más
  "Intereses o rendimientos de cuentas, depósitos y activos financieros".
- rendimientos_actividades: filas de "OTRAS rentas o percepciones de cualquier clase".
- rentas_detalle: los conceptos escritos, literales, separados por punto y coma.
- irpf_pagado: recuadro "CANTIDAD PAGADA POR IRPF".

BIENES PATRIMONIALES
- inmuebles_urbanos: número de filas rellenas en "Bienes Inmuebles de naturaleza urbana".
- inmuebles_rusticos: número de filas rellenas en "de naturaleza rústica".
- inmuebles_detalle: clase, provincia, fecha y porcentaje de cada uno. Ej:
  "Vivienda, Madrid, 2020, 40% de propiedad"

DEPÓSITOS
- depositos: el "SALDO de todos los depósitos".

OTROS BIENES O DERECHOS
- valores: suma de la columna VALOR de deuda pública, acciones y participaciones.
- planes_pensiones: solo si aparece identificado como plan de pensiones.

VEHÍCULOS, EMBARCACIONES Y AERONAVES
- vehiculos: número de filas rellenas.
- vehiculos_detalle: descripción de cada uno, separados por punto y coma.

DEUDAS Y OBLIGACIONES
- prestamos_concedido: columna "IMPORTE CONCEDIDO".
- deuda_pendiente: columna "SALDO PENDIENTE".

OBSERVACIONES
- observaciones: el texto del recuadro, o null si está vacío.

CABECERA
- fecha_declaracion: la fecha de la declaración en formato AAAA-MM-DD.

Y ADEMÁS:
- confianza: "alta" si el escaneo se lee bien y estás seguro de todas las cifras.
  "media" si alguna casilla es dudosa. "baja" si el documento está torcido, borroso o cortado.
- dudas: lista de campos concretos que no has podido leer con seguridad. Sé específico.`;

/** Gemma y similares no aceptan PDF inline → 400. Solo Gemini para multimodal. */
function modelosParaPdf(): string[] {
  const desdeEnv = (process.env.MODELO_BIENES ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (desdeEnv.length) return desdeEnv;

  const deLista = modelosDisponibles().filter(m => /^gemini/i.test(m) && !/gemma/i.test(m));
  const fallback = [
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.5-flash'
  ];
  const unidos = [...deLista, ...fallback];
  return [...new Set(unidos)];
}

function modelosParaTexto(): string[] {
  const lista = modelosDisponibles();
  return lista.length ? lista : ['gemini-flash-lite-latest'];
}

async function textoDelPdf(buf: Buffer): Promise<{ paginas: number; texto: string }> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const limpio = String(text ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return { paginas: totalPages, texto: limpio };
  } catch {
    return { paginas: 0, texto: '' };
  }
}

async function llamarModelo(
  modelo: string,
  clave: string,
  parts: object[]
): Promise<{ ok: true; datos: DeclaracionLeida } | { ok: false; error: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          ...(process.env.SIN_ESQUEMA === 'true' ? {} : { responseSchema: ESQUEMA })
        }
      })
    }
  );

  if (!res.ok) {
    const cuerpo = (await res.text()).slice(0, 220).replace(/\s+/g, ' ');
    return { ok: false, error: `${modelo}: HTTP ${res.status} ${cuerpo}` };
  }

  const cuerpo = await res.json();
  const texto = (cuerpo.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p.text ?? '').join('');
  if (!texto) return { ok: false, error: `${modelo}: respuesta vacia` };

  try {
    const datos = JSON.parse(texto.replace(/```json|```/g, '').trim()) as DeclaracionLeida;
    return { ok: true, datos };
  } catch (e: any) {
    return { ok: false, error: `${modelo}: JSON invalido (${e.message})` };
  }
}

export async function leerDeclaracion(url: string): Promise<{ ok: boolean; datos?: DeclaracionLeida; error?: string; modelo?: string }> {
  const clave = exigirEnv('GEMINI_API_KEY');

  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return { ok: false, error: `El PDF devolvio HTTP ${r.status}` };

  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.subarray(0, 4).toString() !== '%PDF') return { ok: false, error: 'La URL no devuelve un PDF' };
  if (buf.length > 18 * 1024 * 1024) return { ok: false, error: 'PDF demasiado grande' };

  const { paginas, texto } = await textoDelPdf(buf);
  const tieneTexto = texto.length >= 400;
  let ultimoError = '';

  // 1) Si hay capa de texto, cualquier modelo de la cadena vale (más barato / Gemma OK).
  if (tieneTexto) {
    const cadencia = new Cadencia(modelosParaTexto()[0]);
    const promptTexto = `${PROMPT}\n\n--- TEXTO EXTRAIDO DEL PDF (${paginas} paginas) ---\n${texto.slice(0, 60_000)}`;
    for (const modelo of modelosParaTexto()) {
      await cadencia.esperar();
      const r1 = await llamarModelo(modelo, clave, [{ text: promptTexto }]);
      if (r1.ok) return { ok: true, datos: r1.datos, modelo: `${modelo}+texto` };
      ultimoError = r1.error;
      if (/HTTP 404/.test(r1.error)) continue;
    }
  }

  // 2) PDF escaneado → multimodal solo con Gemini (no Gemma).
  const base64 = buf.toString('base64');
  const modelosPdf = modelosParaPdf();
  const cadenciaPdf = new Cadencia(modelosPdf[0] ?? 'gemini-2.0-flash');
  for (const modelo of modelosPdf) {
    await cadenciaPdf.esperar();
    const r2 = await llamarModelo(modelo, clave, [
      { inline_data: { mime_type: 'application/pdf', data: base64 } },
      { text: PROMPT }
    ]);
    if (r2.ok) return { ok: true, datos: r2.datos, modelo: `${modelo}+pdf` };
    ultimoError = r2.error;
    // Si el modelo no soporta PDF, prueba el siguiente
    if (/HTTP 400|HTTP 404|not supported|INVALID_ARGUMENT/i.test(r2.error)) continue;
  }

  return {
    ok: false,
    error: ultimoError || (tieneTexto
      ? 'No se pudo parsear el texto del PDF'
      : 'PDF escaneado y ningun modelo Gemini acepto el PDF. Pon MODELO_BIENES=gemini-2.0-flash en .env')
  };
}
