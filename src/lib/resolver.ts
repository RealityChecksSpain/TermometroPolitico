import { db, exigirEnv } from './supabase';
import { normalizarNombre } from './texto';

export type OrigenResolucion = 'alias' | 'trigrama' | 'llm' | 'sin_resolver';

export interface Resolucion {
  nombreOrigen: string;
  mandatoId: string | null;
  politicoId: string | null;
  origen: OrigenResolucion;
  confianza: number;
  candidatos: { mandatoId: string; nombre: string; similitud: number }[];
}

interface Candidato {
  mandato_id: string;
  politico_id: string;
  nombre_completo: string;
  similitud: number;
  decision: 'auto' | 'ambiguo' | 'sin_candidato';
}

async function porAlias(nombre: string, legislaturaId: string): Promise<string | null> {
  const { data } = await db().rpc('resolver_desde_alias', {
    p_nombre_normalizado: normalizarNombre(nombre),
    p_legislatura_id: legislaturaId
  });
  return (data as string | null) ?? null;
}

async function porTrigrama(nombre: string, legislaturaId: string): Promise<Candidato[]> {
  const { data, error } = await db().rpc('resolver_nombre', {
    p_nombre: nombre,
    p_legislatura_id: legislaturaId
  });
  if (error) throw error;
  return (data ?? []) as Candidato[];
}

export type Proveedor = 'anthropic' | 'gemini' | 'ninguno';

export function proveedorActivo(): Proveedor {
  const explicito = process.env.PROVEEDOR_IA?.trim().toLowerCase();
  if (explicito === 'ninguno') return 'ninguno';
  if (explicito === 'gemini') return 'gemini';
  if (explicito === 'anthropic') return 'anthropic';
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
  return 'ninguno';
}

function construirPrompt(nombre: string, candidatos: Candidato[]): string {
  const lista = candidatos
    .map((c, i) => `${i}. ${c.nombre_completo} (similitud ${c.similitud.toFixed(3)})`)
    .join('\n');

  return `Registro oficial del Congreso de los Diputados. El nombre aparece como "Apellidos, Nombre".

Nombre a identificar: "${nombre}"

Candidatos del censo de la legislatura:
${lista}

Reglas:
- Los apellidos compuestos y las particulas ("de", "del", "de la") pueden aparecer al final del nombre propio.
- "Ma" o "Mª" equivalen a "Maria".
- Elige UNICAMENTE entre los candidatos listados. No propongas ninguna otra persona.
- Si ninguno es la misma persona con certeza, devuelve indice -1.

Responde solo con JSON, sin markdown: {"indice": number, "confianza": number entre 0 y 1}`;
}

function extraerVeredicto(texto: string, total: number): { indice: number; confianza: number } | null {
  const limpio = texto.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(limpio);
    if (typeof parsed.indice !== 'number') return null;
    if (parsed.indice < 0 || parsed.indice >= total) return null;
    return { indice: parsed.indice, confianza: Number(parsed.confianza) || 0 };
  } catch {
    return null;
  }
}

async function porAnthropic(nombre: string, candidatos: Candidato[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': exigirEnv('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.MODELO_IA ?? 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: construirPrompt(nombre, candidatos) }]
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const texto = data.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  return extraerVeredicto(texto, candidatos.length);
}

async function porGemini(nombre: string, candidatos: Candidato[]) {
  const modelo = process.env.MODELO_IA ?? 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': exigirEnv('GEMINI_API_KEY')
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: construirPrompt(nombre, candidatos) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 200, responseMimeType: 'application/json' }
      })
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
  return extraerVeredicto(texto, candidatos.length);
}

async function porLlm(nombre: string, candidatos: Candidato[]) {
  const proveedor = proveedorActivo();
  if (proveedor === 'ninguno') return null;
  try {
    return proveedor === 'gemini'
      ? await porGemini(nombre, candidatos)
      : await porAnthropic(nombre, candidatos);
  } catch {
    return null;
  }
}

export async function resolver(
  nombre: string,
  legislaturaId: string,
  opciones: { permitirLlm?: boolean; umbralLlm?: number } = {}
): Promise<Resolucion> {
  const { permitirLlm = proveedorActivo() !== 'ninguno', umbralLlm = 0.8 } = opciones;

  const base: Resolucion = {
    nombreOrigen: nombre,
    mandatoId: null,
    politicoId: null,
    origen: 'sin_resolver',
    confianza: 0,
    candidatos: []
  };

  const alias = await porAlias(nombre, legislaturaId);
  if (alias) {
    return { ...base, mandatoId: alias, origen: 'alias', confianza: 1 };
  }

  const candidatos = await porTrigrama(nombre, legislaturaId);
  base.candidatos = candidatos.map(c => ({
    mandatoId: c.mandato_id,
    nombre: c.nombre_completo,
    similitud: c.similitud
  }));

  if (candidatos.length === 0) return base;

  const mejor = candidatos[0];
  if (mejor.decision === 'auto') {
    await guardarAlias(nombre, mejor.politico_id, 'trigrama');
    return {
      ...base,
      mandatoId: mejor.mandato_id,
      politicoId: mejor.politico_id,
      origen: 'trigrama',
      confianza: mejor.similitud
    };
  }

  if (!permitirLlm) return base;

  const veredicto = await porLlm(nombre, candidatos);
  if (!veredicto || veredicto.confianza < umbralLlm) return base;

  const elegido = candidatos[veredicto.indice];
  await guardarAlias(nombre, elegido.politico_id, 'llm');

  return {
    ...base,
    mandatoId: elegido.mandato_id,
    politicoId: elegido.politico_id,
    origen: 'llm',
    confianza: veredicto.confianza
  };
}

export async function guardarAlias(nombre: string, politicoId: string, origen: string) {
  await db()
    .from('alias_diputados')
    .upsert(
      { politico_id: politicoId, alias_normalizado: normalizarNombre(nombre), origen },
      { onConflict: 'alias_normalizado' }
    );
}

export async function vaciarCola(legislaturaId: string, limite = 200) {
  const { data: pendientes } = await db()
    .from('cola_revision')
    .select('id, nombre_origen, votacion_id, voto_origen, asiento_origen')
    .eq('resuelto', false)
    .eq('motivo', 'nombre_no_encontrado')
    .limit(limite);

  if (!pendientes?.length) {
    return { procesados: 0, resueltos: 0, porOrigen: {}, quedanPendientes: 0 };
  }

  const unicos = new Map<string, typeof pendientes>();
  pendientes.forEach(p => {
    const clave = normalizarNombre(p.nombre_origen);
    if (!unicos.has(clave)) unicos.set(clave, []);
    unicos.get(clave)!.push(p);
  });

  const porOrigen: Record<string, number> = { alias: 0, trigrama: 0, llm: 0, sin_resolver: 0 };
  let resueltos = 0;

  for (const [, filas] of unicos) {
    const r = await resolver(filas[0].nombre_origen, legislaturaId);
    porOrigen[r.origen] = (porOrigen[r.origen] ?? 0) + 1;
    if (!r.mandatoId) continue;

    const votos = filas
      .filter(f => f.votacion_id)
      .map(f => ({
        votacion_id: f.votacion_id,
        mandato_id: r.mandatoId,
        voto: mapearVoto(f.voto_origen),
        telematico: f.asiento_origen === '-1'
      }))
      .filter(v => v.voto !== null);

    if (votos.length > 0) {
      await db().from('votos').upsert(votos, { onConflict: 'votacion_id,mandato_id' });
    }

    await db()
      .from('cola_revision')
      .update({
        resuelto: true,
        mandato_asignado: r.mandatoId,
        resuelto_at: new Date().toISOString(),
        nota: `automatico via ${r.origen} (confianza ${r.confianza.toFixed(2)})`
      })
      .in('id', filas.map(f => f.id));

    resueltos += filas.length;
  }

  const { count } = await db()
    .from('cola_revision')
    .select('id', { count: 'exact', head: true })
    .eq('resuelto', false);

  return { procesados: pendientes.length, resueltos, porOrigen, quedanPendientes: count ?? 0 };
}

function mapearVoto(origen: string | null): string | null {
  const mapa: Record<string, string> = {
    'Sí': 'si',
    'Si': 'si',
    'No': 'no',
    'Abstención': 'abstencion',
    'Abstencion': 'abstencion',
    'No vota': 'no_vota'
  };
  return origen ? mapa[origen] ?? null : null;
}
