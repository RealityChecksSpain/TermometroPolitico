export const BASE_CONGRESO = 'https://www.congreso.es';

export const UA = 'EscanoBot/1.0 (+https://escano.app/sobre-los-datos)';

export async function descargarHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9'
    }
  });
  if (!res.ok) throw new Error(`${url} devolvio HTTP ${res.status}`);
  return res.text();
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
