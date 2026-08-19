import { db } from '../src/lib/supabase';
import { preguntar, Cadencia, modeloActivo } from '../src/lib/gemini';

const ESQUEMA = {
  type: 'object',
  properties: {
    colectivos: { type: 'array', items: { type: 'string' } },
    materias: { type: 'array', items: { type: 'string' } },
    entendido: { type: 'boolean' }
  },
  required: ['colectivos', 'materias', 'entendido']
};

export const config = { maxDuration: 20 };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const { texto, normalizado } = await req.json();
  if (!texto || !normalizado || String(normalizado).length < 3) {
    return Response.json({ colectivos: [], materias: [], origen: 'vacio' });
  }

  const { data: cache } = await db().rpc('buscar_en_cache', { p_normalizado: normalizado });
  const enCache = Array.isArray(cache) ? cache[0] : cache;
  if (enCache?.colectivos?.length) {
    return Response.json({
      colectivos: enCache.colectivos,
      materias: enCache.materias ?? [],
      origen: 'cache'
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    await db().rpc('registrar_busqueda', {
      p_texto: texto, p_normalizado: normalizado,
      p_colectivos: [], p_materias: [], p_origen: 'sin_resolver'
    });
    return Response.json({ colectivos: [], materias: [], origen: 'sin_ia' });
  }

  const [{ data: cols }, { data: mats }] = await Promise.all([
    db().from('colectivos').select('slug, nombre, descripcion').order('orden'),
    db().from('materias').select('slug, nombre, descripcion').order('orden')
  ]);

  const prompt = `Una persona describe su situación personal para ver qué leyes le afectan.

LO QUE HA ESCRITO:
"${String(texto).slice(0, 300)}"

COLECTIVOS (elige de 1 a 3, solo los que le apliquen claramente):
${(cols ?? []).map((c: any) => `  ${c.slug} = ${c.nombre} (${c.descripcion})`).join('\n')}

MATERIAS (elige de 0 a 2):
${(mats ?? []).map((m: any) => `  ${m.slug} = ${m.nombre}`).join('\n')}

REGLAS:
- Usa SOLO los identificadores de las listas. Si inventas uno, se descarta.
- Entiende el español coloquial, las erratas y las expresiones indirectas.
  "me acaban de echar" es desempleados. "no llego a fin de mes" no basta para deducir un colectivo.
- Si el texto no describe una situación personal reconocible, entendido = false y listas vacías.
- No supongas cosas que no ha dicho.`;

  const cadencia = new Cadencia(modeloActivo());
  const r = await preguntar<any>(prompt, cadencia, { esquema: ESQUEMA, reintentos: 1 });

  const validos = new Set((cols ?? []).map((c: any) => c.slug));
  const validasM = new Set((mats ?? []).map((m: any) => m.slug));

  const colectivos = r.ok && r.datos?.entendido
    ? (r.datos.colectivos ?? []).filter((s: string) => validos.has(s)).slice(0, 3) : [];
  const materias = r.ok && r.datos?.entendido
    ? (r.datos.materias ?? []).filter((s: string) => validasM.has(s)).slice(0, 2) : [];

  await db().rpc('registrar_busqueda', {
    p_texto: texto, p_normalizado: normalizado,
    p_colectivos: colectivos, p_materias: materias,
    p_origen: colectivos.length ? 'ia' : 'sin_resolver'
  });

  return Response.json({ colectivos, materias, origen: colectivos.length ? 'ia' : 'sin_resolver' });
}
