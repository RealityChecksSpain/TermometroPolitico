import { exigirEnv } from './supabase';
import { modelosDisponibles, Cadencia } from './gemini';
import { UA } from './descubrir';
import { extractText, getDocumentProxy } from 'unpdf';
import { sanearDeclaracion } from './euros.js';

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

const NUM = { type: 'NUMBER', nullable: true };
const TXT = { type: 'STRING', nullable: true };
const INT = { type: 'INTEGER', nullable: true };

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    fecha_declaracion: TXT,
    rendimientos_trabajo: NUM,
    rendimientos_capital: NUM,
    rendimientos_actividades: NUM,
    rentas_detalle: TXT,
    irpf_pagado: NUM,
    inmuebles_urbanos: INT,
    inmuebles_rusticos: INT,
    inmuebles_detalle: TXT,
    depositos: NUM,
    valores: NUM,
    planes_pensiones: NUM,
    vehiculos: INT,
    vehiculos_detalle: TXT,
    prestamos_concedido: NUM,
    deuda_pendiente: NUM,
    observaciones: TXT,
    confianza: { type: 'STRING', enum: ['alta', 'media', 'baja'] },
    dudas: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['confianza', 'dudas']
};

const PROMPT = `Lees una DECLARACIÓN DE BIENES Y RENTAS de un diputado del Congreso de España.
Es un documento escaneado o con texto. Extrae los valores EXACTAMENTE como aparecen escritos.

REGLAS CRÍTICAS:
- Si una casilla está VACÍA, devuelve null. NUNCA pongas 0. Vacío y cero son cosas distintas.
- Importes en formato español: 37.357,80 = 37357.80 (punto decimal, MÁXIMO 2 decimales).
  3.122.070,00 → 3122070.00. El punto es de miles; la coma, de decimales.
- Si el PDF muestra 3 decimales por errata (ej. 187.425,535), redondea a 2: 187425.54.
  NUNCA conviertas eso en 187425535 ni en 187 millones.
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

BIENES PATRIMONIALES (urbanos + rústicos + inmuebles de sociedad si aparecen)
- NO cuentes solo filas. Suma las CANTIDADES escritas en cada celda:
  "2 VIVIENDAS" = 2, "13 FINCAS RUSTICAS" = 13, "4 FINCAS URBANAS" = 4,
  "PLAZA DE GARAJE" sin número = 1, "VIVIENDA" + "VIVIENDA" en la misma fila = 2.
- inmuebles_urbanos: total de unidades urbanas (viviendas, casas, plazas, locales, naves…).
- inmuebles_rusticos: total de unidades rústicas (fincas rústicas, terrenos…).
- Incluye también los inmuebles listados como propiedad de una sociedad.
- inmuebles_detalle: UNA entrada por grupo, con la cantidad al inicio, separadas por "; ".
  Ej: "2 VIVIENDAS Madrid 2011 25%; 13 FINCAS RUSTICAS León 2021 25%"

DEPÓSITOS
- depositos: el "SALDO de todos los depósitos" (máx. 2 decimales). Cifras > 5 millones son
  rarísimas aquí: revisa puntos/comas antes de devolverlas.

OTROS BIENES O DERECHOS
- valores: suma de la columna VALOR de deuda pública, acciones y participaciones.
- planes_pensiones: solo si aparece identificado como plan de pensiones.

VEHÍCULOS, EMBARCACIONES Y AERONAVES
- vehiculos: número de filas rellenas.
- vehiculos_detalle: UNA línea por vehículo, separadas por punto y coma, empezando por el tipo
  literal del PDF. Ejemplos correctos:
  "VEHÍCULO TODO TERRENO JEEP COMMANDER; MOTOCICLETA BMW R80RT"
  "TURISMO SEAT LEÓN; EMBARCACIÓN LANCHA 5M"
  Incluye la descripción completa de cada fila.

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
  parts: object[],
  conEsquema = true
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
          ...(conEsquema && process.env.SIN_ESQUEMA !== 'true' ? { responseSchema: ESQUEMA } : {})
        }
      })
    }
  );

  if (!res.ok) {
    const cuerpo = (await res.text()).slice(0, 280).replace(/\s+/g, ' ');
    // Si el esquema no gusta al modelo, reintentar sin él
    if (conEsquema && res.status === 400 && /response_schema|responseSchema|Proto field/i.test(cuerpo)) {
      return llamarModelo(modelo, clave, parts, false);
    }
    return { ok: false, error: `${modelo}: HTTP ${res.status} ${cuerpo}` };
  }

  const cuerpo = await res.json();
  const texto = (cuerpo.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p.text ?? '').join('');
  if (!texto) return { ok: false, error: `${modelo}: respuesta vacia` };

  try {
    const datos = sanearDeclaracion(
      JSON.parse(texto.replace(/```json|```/g, '').trim())
    ) as DeclaracionLeida;
    return { ok: true, datos };
  } catch (e: any) {
    return { ok: false, error: `${modelo}: JSON invalido (${e.message})` };
  }
}

const ESQUEMA_CORRECCION = {
  type: 'OBJECT',
  properties: {
    depositos: NUM,
    valores: NUM,
    planes_pensiones: NUM,
    deuda_pendiente: NUM,
    inmuebles_urbanos: INT,
    inmuebles_rusticos: INT,
    inmuebles_detalle: TXT,
    explicacion: TXT,
    cifras_confirmadas: { type: 'BOOLEAN', nullable: true }
  },
  required: ['explicacion']
};

/**
 * Segunda pasada cuando depósitos/patrimonio salen anómalos (p. ej. 187 M por mala lectura ES).
 */
export async function revalidarCifrasAnomalas(
  url: string,
  sospecha: DeclaracionLeida,
  motivo: string
): Promise<{ ok: boolean; datos?: DeclaracionLeida; error?: string }> {
  const clave = exigirEnv('GEMINI_API_KEY');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
  const buf = Buffer.from(await r.arrayBuffer());
  const { texto } = await textoDelPdf(buf);
  const resumen = JSON.stringify({
    depositos: sospecha.depositos,
    valores: sospecha.valores,
    planes_pensiones: sospecha.planes_pensiones,
    deuda_pendiente: sospecha.deuda_pendiente,
    inmuebles_urbanos: sospecha.inmuebles_urbanos,
    inmuebles_rusticos: sospecha.inmuebles_rusticos
  });

  const prompt =
    `Revisas una declaración de bienes del Congreso. Motivo de alarma: ${motivo}.\n` +
    `Valores extraídos antes (pueden estar MAL por puntos/comas o 3 decimales):\n${resumen}\n\n` +
    `REGLAS: formato español 187.425,53 = 187425.53 euros (NO 187 millones). ` +
    `Máximo 2 decimales. Si hay ,535 trunca a ,53.\n` +
    `Inmuebles: suma cantidades ("13 FINCAS" = 13), no solo filas.\n` +
    `Devuelve JSON con depositos, valores, planes_pensiones, deuda_pendiente, ` +
    `inmuebles_urbanos, inmuebles_rusticos, inmuebles_detalle, explicacion, cifras_confirmadas.\n` +
    (texto.length >= 400
      ? `\n--- TEXTO PDF ---\n${texto.slice(0, 50_000)}`
      : '\n(El PDF va adjunto; léelo con cuidado en depósitos e inmuebles.)');

  const parts: object[] = texto.length >= 400
    ? [{ text: prompt }]
    : [
        { inline_data: { mime_type: 'application/pdf', data: buf.toString('base64') } },
        { text: prompt }
      ];

  const modelos = texto.length >= 400 ? modelosParaTexto() : modelosParaPdf();
  const cadencia = new Cadencia(modelos[0]);
  for (const modelo of modelos) {
    await cadencia.esperar();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: ESQUEMA_CORRECCION
          }
        })
      }
    );
    if (!res.ok) continue;
    const cuerpo = await res.json();
    const raw = (cuerpo.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? '').join('');
    if (!raw) continue;
    try {
      const corr = sanearDeclaracion(JSON.parse(raw.replace(/```json|```/g, '').trim()));
      const datos: DeclaracionLeida = {
        ...sospecha,
        depositos: corr.depositos ?? sospecha.depositos,
        valores: corr.valores ?? sospecha.valores,
        planes_pensiones: corr.planes_pensiones ?? sospecha.planes_pensiones,
        deuda_pendiente: corr.deuda_pendiente ?? sospecha.deuda_pendiente,
        inmuebles_urbanos: corr.inmuebles_urbanos ?? sospecha.inmuebles_urbanos,
        inmuebles_rusticos: corr.inmuebles_rusticos ?? sospecha.inmuebles_rusticos,
        inmuebles_detalle: corr.inmuebles_detalle ?? sospecha.inmuebles_detalle,
        confianza: corr.cifras_confirmadas === false ? 'baja' : 'media',
        dudas: [
          ...(sospecha.dudas ?? []),
          `revalidación: ${corr.explicacion || motivo}`
        ]
      };
      return { ok: true, datos };
    } catch {
      /* siguiente modelo */
    }
  }
  return { ok: false, error: 'revalidación fallida' };
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
