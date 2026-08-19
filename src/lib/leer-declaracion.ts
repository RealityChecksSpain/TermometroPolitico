import { exigirEnv } from './supabase';
import { modelosDisponibles, Cadencia } from './gemini';
import { UA } from './descubrir';

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
Es un documento escaneado. Extrae los valores EXACTAMENTE como aparecen escritos.

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

export async function leerDeclaracion(url: string): Promise<{ ok: boolean; datos?: DeclaracionLeida; error?: string; modelo?: string }> {
  const clave = exigirEnv('GEMINI_API_KEY');

  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return { ok: false, error: `El PDF devolvio HTTP ${r.status}` };

  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.subarray(0, 4).toString() !== '%PDF') return { ok: false, error: 'La URL no devuelve un PDF' };
  if (buf.length > 18 * 1024 * 1024) return { ok: false, error: 'PDF demasiado grande' };

  const base64 = buf.toString('base64');
  const cadencia = new Cadencia(modelosDisponibles()[0]);
  let ultimoError = '';

  for (const modelo of modelosDisponibles()) {
    await cadencia.esperar();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: 'application/pdf', data: base64 } },
                { text: PROMPT }
              ]
            }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
              responseSchema: ESQUEMA
            }
          })
        }
      );

      if (!res.ok) {
        ultimoError = `${modelo}: HTTP ${res.status}`;
        continue;
      }

      const cuerpo = await res.json();
      const texto = (cuerpo.candidates?.[0]?.content?.parts ?? [])
        .map((p: any) => p.text ?? '').join('');
      if (!texto) { ultimoError = `${modelo}: respuesta vacia`; continue; }

      const datos = JSON.parse(texto.replace(/```json|```/g, '').trim()) as DeclaracionLeida;
      return { ok: true, datos, modelo };
    } catch (e: any) {
      ultimoError = `${modelo}: ${e.message}`;
    }
  }

  return { ok: false, error: ultimoError };
}
