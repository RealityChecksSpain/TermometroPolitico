export const BASE_CONGRESO = 'https://www.congreso.es';

export const UA = 'LenteDemocraticaBot/1.0 (+https://lente-democratica.vercel.app/)';

const ESPERA_MS = Number(process.env.TIMEOUT_CONGRESO_MS ?? 20000);

export async function descargarHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ESPERA_MS),
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9'
    }
  });
  if (!res.ok) throw new Error(`${url} devolvio HTTP ${res.status}`);
  return res.text();
}

export async function descargarJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ESPERA_MS),
    headers: { 'User-Agent': UA, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`${url} devolvió ${res.status}`);
  return (await res.json()) as T;
}

export function extraerUrls(html: string, patronRuta: RegExp): string[] {
  const fuente = patronRuta.source.replace(/^\^/, '');
  const combinado = new RegExp(
    `(?:https?:\\/\\/www\\.congreso\\.es)?(\\/${fuente})`,
    'gi'
  );
  const vistos = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = combinado.exec(html)) !== null) {
    vistos.add(BASE_CONGRESO + m[1]);
  }
  return Array.from(vistos);
}

export function masReciente(urls: string[]): string | null {
  if (urls.length === 0) return null;
  return urls
    .map(u => ({ u, ts: Number(u.match(/__(\d{14})\./)?.[1] ?? 0) }))
    .sort((a, b) => b.ts - a.ts)[0].u;
}