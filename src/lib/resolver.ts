import { db, exigirEnv } from './supabase.js';
import { modeloActivo } from './gemini.js';
import { normalizarNombre } from './texto.js';

export type OrigenResolucion = 'alias' | 'trigrama' | 'llm' | 'sin_resolver';

export interface Resolucion {
  nombreOrigen: string;
  mandatoId: string | null;
  politicoId: string | null;
  origen: OrigenResolucion;
  confianza: number;
  candidatos: { mandatoId: string; nombre: string; similitud: number }[];
}

export interface ResumenCola {
  procesados: number;
  nombresIntentados: number;
  resueltos: number;
  porOrigen: Record<string, number>;
  sinResolver: string[];
  quedanPendientes: number;
  agotadoElTiempo: boolean;
}

interface Candidato {
  mandato_id: string;
  politico_id: string;
  nombre_completo: string;
  similitud: number;
  decision: 'auto' | 'ambiguo' | 'sin_candidato';
}

const MODELO_ANTHROPIC_DEFECTO = 'claude-haiku-4-5-20251001';

export function modeloAnthropic(): string {
  const elegido = process.env.MODELO_ANTHROPIC?.trim();
  return elegido && elegido.length > 0 ? elegido : MODELO_ANTHROPIC_DEFECTO;
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
  const modelo = modeloAnthropic();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': exigirEnv('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 200,
      messages: [{ role: 'user', content: construirPrompt(nombre, candidatos) }]
    })
  });
  if (!res.ok) {
    const cuerpo = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
    console.error(`resolver/anthropic ${res.status} modelo=${modelo} ${cuerpo}`);
    return null;
  }
  const data = await res.json();
  const texto = (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  return extraerVeredicto(texto, candidatos.length);
}

async function porGemini(nombre: string, candidatos: Candidato[]) {
  const modelo = modeloActivo();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
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
  if (!res.ok) {
    const cuerpo = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
    console.error(`resolver/gemini ${res.status} modelo=${modelo} ${cuerpo}`);
    return null;
  }
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
  } catch (e) {
    console.error('resolver/llm', e);
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

interface FilaCola {
  id: string;
  nombre_origen: string;
  votacion_id: string | null;
  voto_origen: string | null;
  asiento_origen: string | null;
}

interface OpcionesCola {
  maxNombres?: number;
  tamPagina?: number;
  msMaximo?: number;
}

async function paginaPendiente(desdeId: string | null, tam: number): Promise<FilaCola[]> {
  let consulta = db()
    .from('cola_revision')
    .select('id, nombre_origen, votacion_id, voto_origen, asiento_origen')
    .eq('resuelto', false)
    .eq('motivo', 'nombre_no_encontrado')
    .order('id', { ascending: true })
    .limit(tam);

  if (desdeId !== null) consulta = consulta.gt('id', desdeId);

  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []) as FilaCola[];
}

async function asentarNombre(
  nombre: string,
  mandatoId: string,
  origen: string,
  confianza: number
): Promise<number> {
  const marca = new Date().toISOString();
  const nota = `automatico via ${origen} (confianza ${confianza.toFixed(2)})`;
  let cerradas = 0;
  let cursor: string | null = null;

  for (;;) {
    let consulta = db()
      .from('cola_revision')
      .select('id, votacion_id, voto_origen, asiento_origen')
      .eq('resuelto', false)
      .eq('nombre_origen', nombre)
      .order('id', { ascending: true })
      .limit(1000);

    if (cursor !== null) consulta = consulta.gt('id', cursor);

    const { data, error } = await consulta;
    if (error) throw error;
    const lote = (data ?? []) as Omit<FilaCola, 'nombre_origen'>[];
    if (lote.length === 0) break;

    const votos = lote
      .filter(f => f.votacion_id)
      .map(f => ({
        votacion_id: f.votacion_id,
        mandato_id: mandatoId,
        voto: mapearVoto(f.voto_origen),
        telematico: f.asiento_origen === '-1'
      }))
      .filter(v => v.voto !== null);

    if (votos.length > 0) {
      const { error: eVotos } = await db()
        .from('votos')
        .upsert(votos, { onConflict: 'votacion_id,mandato_id' });
      if (eVotos) throw eVotos;
    }

    const { error: eCola } = await db()
      .from('cola_revision')
      .update({ resuelto: true, mandato_asignado: mandatoId, resuelto_at: marca, nota })
      .in('id', lote.map(f => f.id));
    if (eCola) throw eCola;

    cerradas += lote.length;
    cursor = lote[lote.length - 1].id;
    if (lote.length < 1000) break;
  }

  return cerradas;
}

export async function vaciarCola(
  legislaturaId: string,
  limite: number | OpcionesCola = {}
): Promise<ResumenCola> {
  const opciones: OpcionesCola = typeof limite === 'number' ? { tamPagina: limite } : limite;
  const { maxNombres = 40, tamPagina = 200, msMaximo = 25_000 } = opciones;
  const arranque = Date.now();

  const porOrigen: Record<string, number> = { alias: 0, trigrama: 0, llm: 0, sin_resolver: 0 };
  const fallidos = new Set<string>();
  const sinResolver: string[] = [];

  let procesados = 0;
  let nombresIntentados = 0;
  let resueltos = 0;
  let cursor: string | null = null;
  let agotadoElTiempo = false;

  while (nombresIntentados < maxNombres && !agotadoElTiempo) {
    const pagina = await paginaPendiente(cursor, tamPagina);
    if (pagina.length === 0) break;

    procesados += pagina.length;
    cursor = pagina[pagina.length - 1].id;

    const orden: string[] = [];
    const porClave = new Map<string, string>();
    for (const fila of pagina) {
      const clave = normalizarNombre(fila.nombre_origen);
      if (fallidos.has(clave) || porClave.has(clave)) continue;
      porClave.set(clave, fila.nombre_origen);
      orden.push(clave);
    }

    for (const clave of orden) {
      if (nombresIntentados >= maxNombres) break;
      if (Date.now() - arranque > msMaximo) {
        agotadoElTiempo = true;
        break;
      }

      const nombre = porClave.get(clave)!;
      nombresIntentados++;

      const r = await resolver(nombre, legislaturaId);
      porOrigen[r.origen] = (porOrigen[r.origen] ?? 0) + 1;

      if (!r.mandatoId) {
        fallidos.add(clave);
        sinResolver.push(nombre);
        continue;
      }

      resueltos += await asentarNombre(nombre, r.mandatoId, r.origen, r.confianza);
    }

    if (pagina.length < tamPagina) break;
  }

  const { count } = await db()
    .from('cola_revision')
    .select('id', { count: 'exact', head: true })
    .eq('resuelto', false);

  return {
    procesados,
    nombresIntentados,
    resueltos,
    porOrigen,
    sinResolver,
    quedanPendientes: count ?? 0,
    agotadoElTiempo
  };
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