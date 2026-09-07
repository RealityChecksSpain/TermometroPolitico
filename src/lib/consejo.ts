import { Cadencia, preguntar as preguntarGemini } from './gemini';

export type Proveedor = 'gemini' | 'anthropic' | 'groq' | 'mistral' | 'cerebras' | 'openrouter' | 'deepseek' | 'openai' | 'compatible';

export interface Miembro {
  proveedor: Proveedor;
  modelo: string;
  id: string;
}

interface Compatible {
  url: string;
  clave: string;
}

export const COMPATIBLES: Record<string, Compatible> = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', clave: 'GROQ_API_KEY' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', clave: 'MISTRAL_API_KEY' },
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', clave: 'CEREBRAS_API_KEY' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', clave: 'OPENROUTER_API_KEY' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', clave: 'DEEPSEEK_API_KEY' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', clave: 'OPENAI_API_KEY' },
  compatible: { url: '', clave: 'COMPATIBLE_API_KEY' }
};

export const PROVEEDORES: Proveedor[] = ['gemini', 'anthropic', ...Object.keys(COMPATIBLES) as Proveedor[]];

export function leerConsejo(): Miembro[] {
  const bruto = (process.env.CONSEJO ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!bruto.length) {
    throw new Error(
      'Falta CONSEJO. Ejemplo:\n' +
      '  CONSEJO="gemini:gemini-flash-latest,groq:llama-3.3-70b-versatile,mistral:mistral-large-latest"\n' +
      `Proveedores: ${PROVEEDORES.join(', ')}`
    );
  }
  return bruto.map(entrada => {
    const i = entrada.indexOf(':');
    if (i < 0) throw new Error(`Miembro mal formado: "${entrada}". Usa proveedor:modelo`);
    const proveedor = entrada.slice(0, i).trim();
    const modelo = entrada.slice(i + 1).trim();
    if (!PROVEEDORES.includes(proveedor as Proveedor)) {
      throw new Error(`Proveedor no soportado: "${proveedor}". Usa uno de: ${PROVEEDORES.join(', ')}`);
    }
    if (!modelo) throw new Error(`Falta el modelo en "${entrada}"`);
    return { proveedor: proveedor as Proveedor, modelo, id: `${proveedor}:${modelo}` };
  });
}

export function familias(miembros: Miembro[]): number {
  return new Set(miembros.map(m => m.proveedor)).size;
}

export function claveDe(proveedor: Proveedor): string {
  if (proveedor === 'gemini') return 'GEMINI_API_KEY';
  if (proveedor === 'anthropic') return 'ANTHROPIC_API_KEY';
  return COMPATIBLES[proveedor].clave;
}

export function comprobarCredenciales(miembros: Miembro[]): string[] {
  const faltan: string[] = [];
  for (const proveedor of new Set(miembros.map(m => m.proveedor))) {
    const variable = claveDe(proveedor);
    if (!process.env[variable]?.trim()) faltan.push(`${proveedor} -> ${variable}`);
    if (proveedor === 'compatible' && !process.env.COMPATIBLE_BASE_URL?.trim()) {
      faltan.push('compatible -> COMPATIBLE_BASE_URL');
    }
  }
  return faltan;
}

function extraerJson(texto: string): any {
  const limpio = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const a = limpio.indexOf('{');
    const b = limpio.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try {
      return JSON.parse(limpio.slice(a, b + 1));
    } catch {
      return null;
    }
  }
}

async function preguntarAnthropic(modelo: string, prompt: string, reintentos = 2): Promise<any> {
  const clave = process.env.ANTHROPIC_API_KEY?.trim();
  if (!clave) return { ok: false, error: 'falta ANTHROPIC_API_KEY' };
  let ultimo = '';
  for (let intento = 0; intento < reintentos; intento++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': clave,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: Number(process.env.MAX_TOKENS_IA ?? 4096),
          temperature: 0,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (res.status === 429 || res.status >= 500) {
        ultimo = `HTTP ${res.status}`;
        await new Promise(r => setTimeout(r, 4000 * (intento + 1)));
        continue;
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const cuerpo = await res.json();
      const texto = (cuerpo?.content ?? [])
        .filter((c: any) => c?.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      const datos = extraerJson(texto);
      return datos ? { ok: true, datos } : { ok: false, error: 'respuesta no parseable' };
    } catch (e: any) {
      ultimo = String(e?.message ?? e);
      await new Promise(r => setTimeout(r, 3000 * (intento + 1)));
    }
  }
  return { ok: false, error: ultimo || 'sin detalle' };
}

const ultimaLlamada = new Map<string, number>();

async function esperarTurno(proveedor: Proveedor) {
  const minimo = Number(process.env.ESPERA_PROVEEDOR_MS ?? 2500);
  const previo = ultimaLlamada.get(proveedor) ?? 0;
  const falta = previo + minimo - Date.now();
  if (falta > 0) await new Promise(r => setTimeout(r, falta));
  ultimaLlamada.set(proveedor, Date.now());
}

async function preguntarCompatible(
  proveedor: Proveedor,
  modelo: string,
  prompt: string,
  reintentos = Number(process.env.REINTENTOS_CONSEJO ?? 4)
): Promise<any> {
  const cfg = COMPATIBLES[proveedor];
  const clave = process.env[cfg.clave]?.trim();
  if (!clave) return { ok: false, error: `falta ${cfg.clave}` };
  const url = proveedor === 'compatible'
    ? (process.env.COMPATIBLE_BASE_URL?.trim() ?? '')
    : cfg.url;
  if (!url) return { ok: false, error: 'falta COMPATIBLE_BASE_URL' };

  let ultimo = '';
  for (let intento = 0; intento < reintentos; intento++) {
    try {
      await esperarTurno(proveedor);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${clave}`
        },
        body: JSON.stringify({
          model: modelo,
          temperature: 0,
          max_tokens: Number(process.env.MAX_TOKENS_IA ?? 4096),
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (res.status === 429 || res.status >= 500) {
        const cabecera = res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-reset-requests') ?? '';
        const segundos = Number(String(cabecera).replace(/[^0-9.]/g, ''));
        const espera = Number.isFinite(segundos) && segundos > 0
          ? Math.min(segundos * 1000, 90000)
          : 8000 * (intento + 1);
        ultimo = `HTTP ${res.status} (espera ${Math.round(espera / 1000)}s)`;
        await new Promise(r => setTimeout(r, espera));
        continue;
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const cuerpo = await res.json();
      const mensaje = cuerpo?.choices?.[0]?.message ?? {};
      const partes = [mensaje.content, mensaje.reasoning, mensaje.reasoning_content]
        .map((x: any) => (typeof x === 'string' ? x : ''))
        .filter(Boolean);
      for (const parte of partes) {
        const datos = extraerJson(parte);
        if (datos) return { ok: true, datos };
      }
      return {
        ok: false,
        error: partes.length ? 'respuesta no parseable' : 'respuesta vacia',
        crudo: (partes[0] ?? JSON.stringify(cuerpo)).slice(0, 600),
        motivo: cuerpo?.choices?.[0]?.finish_reason ?? null
      };
    } catch (e: any) {
      ultimo = String(e?.message ?? e);
      await new Promise(r => setTimeout(r, 3000 * (intento + 1)));
    }
  }
  return { ok: false, error: ultimo || 'sin detalle' };
}

export async function preguntarMiembro(
  miembro: Miembro,
  prompt: string,
  esquema: object,
  cadencias: Map<string, Cadencia>
): Promise<{ ok: boolean; datos?: any; error?: string }> {
  if (miembro.proveedor === 'anthropic') {
    return preguntarAnthropic(miembro.modelo, prompt);
  }
  if (miembro.proveedor !== 'gemini') {
    return preguntarCompatible(miembro.proveedor, miembro.modelo, prompt);
  }
  if (!cadencias.has(miembro.modelo)) cadencias.set(miembro.modelo, new Cadencia(miembro.modelo));
  const previo = process.env.MODELO_IA;
  process.env.MODELO_IA = miembro.modelo;
  try {
    const r = await preguntarGemini<any>(prompt, cadencias.get(miembro.modelo)!, { esquema, temperatura: 0 });
    return { ok: Boolean(r.ok && r.datos), datos: r.datos, error: r.error };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 160) };
  } finally {
    if (previo === undefined) delete process.env.MODELO_IA;
    else process.env.MODELO_IA = previo;
  }
}

export function urlModelos(proveedor: Proveedor): string | null {
  if (proveedor === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/models';
  if (proveedor === 'anthropic') return 'https://api.anthropic.com/v1/models';
  const cfg = COMPATIBLES[proveedor];
  const base = proveedor === 'compatible'
    ? (process.env.COMPATIBLE_BASE_URL?.trim() ?? '')
    : cfg.url;
  if (!base) return null;
  return base.replace(/\/chat\/completions$/, '/models');
}

export async function listarModelos(proveedor: Proveedor): Promise<{ ok: boolean; modelos?: string[]; error?: string }> {
  const url = urlModelos(proveedor);
  if (!url) return { ok: false, error: 'sin endpoint de modelos' };
  const clave = process.env[claveDe(proveedor)]?.trim();
  if (!clave) return { ok: false, error: `falta ${claveDe(proveedor)}` };

  const cabeceras: Record<string, string> = { 'content-type': 'application/json' };
  let destino = url;
  if (proveedor === 'gemini') destino = `${url}?key=${clave}&pageSize=200`;
  else if (proveedor === 'anthropic') {
    cabeceras['x-api-key'] = clave;
    cabeceras['anthropic-version'] = '2023-06-01';
  } else cabeceras.authorization = `Bearer ${clave}`;

  try {
    const res = await fetch(destino, { headers: cabeceras });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 160)}` };
    const cuerpo = await res.json();
    const bruto: any[] = cuerpo?.data ?? cuerpo?.models ?? [];
    const modelos = bruto
      .map(m => String(m?.id ?? m?.name ?? '').replace(/^models\//, ''))
      .filter(Boolean)
      .sort();
    return { ok: true, modelos };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 160) };
  }
}

export function media(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function desviacion(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}